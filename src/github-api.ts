import type { ChecksStatus, CopilotReview, MergeSafety, PullRequest } from './types'

type GitHubPR = {
  number: number
  title: string
  user: { login: string; avatar_url: string }
  html_url: string
  created_at: string
  updated_at: string
  head: { sha: string }
  draft: boolean
  labels: { name: string }[]
  commits: number
}

type GitHubReview = {
  user: { login: string; type: string } | null
  state: string
}

type GitHubCheckRun = {
  status: string
  conclusion: string | null
}

const GITHUB_API = 'https://api.github.com'

const COPILOT_BOT_LOGINS = [
  'copilot-pull-request-reviewer[bot]',
  'github-copilot[bot]',
  'copilot[bot]',
]

async function githubFetch<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) {
    if (response.status === 401) throw new Error('Invalid GitHub token. Check your PAT.')
    if (response.status === 403) throw new Error('API rate limit exceeded. Try again later.')
    if (response.status === 404) throw new Error(`Repository not found or inaccessible.`)
    throw new Error(`GitHub API error: ${response.status}`)
  }

  return response.json() as Promise<T>
}

function deriveCopilotReview(reviews: GitHubReview[]): CopilotReview {
  const copilotReviews = reviews.filter(
    (r) => r.user && (COPILOT_BOT_LOGINS.includes(r.user.login) || r.user.type === 'Bot'),
  )

  if (copilotReviews.length === 0) return 'not_run'

  const lastCopilotReview = copilotReviews[copilotReviews.length - 1]
  if (lastCopilotReview.state === 'APPROVED') return 'approved'
  if (lastCopilotReview.state === 'CHANGES_REQUESTED') return 'changes_requested'
  return 'not_run'
}

function deriveChecksStatus(checkRuns: GitHubCheckRun[]): ChecksStatus {
  if (checkRuns.length === 0) return 'pending'

  const hasFailure = checkRuns.some(
    (c) => c.conclusion === 'failure' || c.conclusion === 'cancelled' || c.conclusion === 'timed_out',
  )
  if (hasFailure) return 'failing'

  const allComplete = checkRuns.every((c) => c.status === 'completed')
  if (allComplete) return 'passing'

  return 'pending'
}

function deriveMergeSafety(
  checksStatus: ChecksStatus,
  reviews: GitHubReview[],
): MergeSafety {
  const humanReviews = reviews.filter(
    (r) => r.user && !COPILOT_BOT_LOGINS.includes(r.user.login) && r.user.type !== 'Bot',
  )

  const hasChangesRequested = humanReviews.some((r) => r.state === 'CHANGES_REQUESTED')
  if (checksStatus === 'failing' || hasChangesRequested) return 'blocked'

  const hasApproval = humanReviews.some((r) => r.state === 'APPROVED')
  if (checksStatus === 'passing' && hasApproval) return 'safe'

  return 'pending'
}

function needsReview(reviews: GitHubReview[], currentUser: string): boolean {
  const reviewerLogins = reviews
    .filter((r) => r.user)
    .map((r) => r.user!.login)

  return !reviewerLogins.includes(currentUser)
}

async function fetchPRDetails(
  owner: string,
  repo: string,
  pr: GitHubPR,
  token: string,
  currentUser: string,
): Promise<PullRequest> {
  const fullRepo = `${owner}/${repo}`

  let reviews: GitHubReview[] = []
  let checkRuns: GitHubCheckRun[] = []

  try {
    const [reviewsData, checksData] = await Promise.all([
      githubFetch<GitHubReview[]>(
        `/repos/${fullRepo}/pulls/${pr.number}/reviews`,
        token,
      ),
      githubFetch<{ check_runs: GitHubCheckRun[] }>(
        `/repos/${fullRepo}/commits/${pr.head.sha}/check-runs`,
        token,
      ),
    ])

    reviews = reviewsData
    checkRuns = checksData.check_runs
  } catch {
    // If we can't fetch details, use defaults
  }

  const checksStatus = deriveChecksStatus(checkRuns)
  const copilotReview = deriveCopilotReview(reviews)
  const mergeSafety = deriveMergeSafety(checksStatus, reviews)

  return {
    id: pr.number,
    repo: fullRepo,
    title: pr.title,
    author: pr.user.login,
    authorAvatar: pr.user.avatar_url,
    url: pr.html_url,
    openedAt: pr.created_at,
    updatedAt: pr.updated_at,
    pushesAfterOpen: pr.commits != null ? Math.max(0, pr.commits - 1) : 0,
    checksStatus,
    copilotReview,
    mergeSafety,
    needsYourReview: needsReview(reviews, currentUser),
    isDraft: pr.draft,
    labels: pr.labels.map((l) => l.name),
  }
}

export async function fetchCurrentUser(token: string): Promise<string> {
  const user = await githubFetch<{ login: string }>('/user', token)
  return user.login
}

export async function fetchRepoPullRequests(
  repoFullName: string,
  token: string,
  currentUser: string,
): Promise<PullRequest[]> {
  const [owner, repo] = repoFullName.split('/')
  if (!owner || !repo) return []

  const prs = await githubFetch<GitHubPR[]>(
    `/repos/${owner}/${repo}/pulls?state=open&sort=updated&direction=desc&per_page=50`,
    token,
  )

  const results = await Promise.all(
    prs.map((pr) => fetchPRDetails(owner, repo, pr, token, currentUser)),
  )

  return results
}

import type { BranchAnalysis, BranchStatus, ChecksStatus, CopilotReview, MergeSafety, PullRequest } from './types'

export type GitHubRepo = {
  full_name: string
  description: string | null
  private: boolean
  fork: boolean
  archived: boolean
  updated_at: string
}

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
  requested_reviewers: { login: string }[]
}

type GitHubReview = {
  user: { login: string; type: string } | null
  state: string
}

type GitHubCheckRun = {
  status: string
  conclusion: string | null
}

type GitHubBranch = {
  name: string
  protected: boolean
  commit: { sha: string }
}

type GitHubCommit = {
  commit: {
    author: { date: string | null } | null
    committer: { date: string | null } | null
  }
}

type GitHubCompare = {
  status: 'ahead' | 'behind' | 'diverged' | 'identical'
  ahead_by: number
  behind_by: number
}

type GitHubRepoMetadata = {
  default_branch: string
}

const GITHUB_API = 'https://api.github.com'

const COPILOT_BOT_LOGINS = [
  'copilot-pull-request-reviewer[bot]',
  'github-copilot[bot]',
  'copilot[bot]',
]

/* ── In-memory API response cache (3-minute TTL) ── */

type CacheEntry<T = unknown> = { data: T; timestamp: number }

const DEFAULT_CACHE_TTL = 3 * 60 * 1000 // 3 minutes
const BRANCH_DETAIL_CONCURRENCY = 8

const apiCache = new Map<string, CacheEntry>()

function getCached<T>(key: string): T | undefined {
  const entry = apiCache.get(key)
  if (!entry) return undefined
  if (Date.now() - entry.timestamp > DEFAULT_CACHE_TTL) {
    apiCache.delete(key)
    return undefined
  }
  return entry.data as T
}

function setCache<T>(key: string, data: T): void {
  apiCache.set(key, { data, timestamp: Date.now() })
}

async function mapWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(items[currentIndex])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  )

  return results
}

/** Clear all cached API responses. Call on manual refresh. */
export function clearApiCache(): void {
  apiCache.clear()
}

async function githubFetch<T>(path: string, token: string): Promise<T> {
  const cacheKey = `${token}:${path}`
  const cached = getCached<T>(cacheKey)
  if (cached !== undefined) return cached

  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) {
    if (response.status === 401) throw new Error('Invalid GitHub token. Check your PAT.')
    if (response.status === 403) {
      const remaining = response.headers.get('x-ratelimit-remaining')
      if (remaining === '0') {
        throw new Error('API rate limit exceeded. Try again later.')
      }
      let detail = ''
      try {
        const body = await response.json() as { message?: string }
        detail = body.message ?? ''
      } catch { /* ignore parse errors */ }
      throw new Error(detail ? `Forbidden: ${detail}` : 'Forbidden. Check token scopes and org access.')
    }
    if (response.status === 404) throw new Error(`Repository not found or inaccessible.`)
    throw new Error(`GitHub API error: ${response.status}`)
  }

  const data = await response.json() as T
  setCache(cacheKey, data)
  return data
}

function deriveCopilotReview(reviews: GitHubReview[]): CopilotReview {
  const copilotReviews = reviews.filter(
    (r) => r.user && COPILOT_BOT_LOGINS.includes(r.user.login),
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
    (c) =>
      c.status === 'completed' &&
      c.conclusion !== null &&
      c.conclusion !== 'success' &&
      c.conclusion !== 'neutral' &&
      c.conclusion !== 'skipped',
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

function needsReview(requestedReviewers: { login: string }[], currentUser: string): boolean {
  if (!currentUser) return false
  return requestedReviewers.some((r) => r.login === currentUser)
}

function deriveBranchStatus(
  branchName: string,
  defaultBranch: string,
  aheadBy: number,
  comparisonKnown: boolean,
  lastCommitAt: string,
): BranchStatus {
  if (branchName === defaultBranch) return 'default'
  if (comparisonKnown && aheadBy === 0) return 'merged'

  const lastCommitTime = lastCommitAt ? new Date(lastCommitAt).getTime() : Number.NaN
  const ageMs = Date.now() - lastCommitTime
  const staleThresholdMs = 30 * 24 * 60 * 60 * 1000

  if (Number.isFinite(ageMs) && ageMs >= staleThresholdMs) return 'stale'
  return 'active'
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
    needsYourReview: needsReview(pr.requested_reviewers ?? [], currentUser),
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

export async function fetchUserRepos(token: string): Promise<GitHubRepo[]> {
  const perPage = 100
  let page = 1
  const allRepos: GitHubRepo[] = []

  while (true) {
    const batch = await githubFetch<GitHubRepo[]>(
      `/user/repos?type=all&sort=updated&direction=desc&per_page=${perPage}&page=${page}`,
      token,
    )

    allRepos.push(...batch)

    if (batch.length < perPage) break
    page += 1
  }

  return allRepos.filter((r) => !r.archived)
}

export async function fetchRepoBranches(
  repoFullName: string,
  token: string,
): Promise<BranchAnalysis[]> {
  const [owner, repo] = repoFullName.split('/')
  if (!owner || !repo) return []

  const metadata = await githubFetch<GitHubRepoMetadata>(`/repos/${owner}/${repo}`, token)
  const branches: GitHubBranch[] = []
  const perPage = 100

  for (let page = 1; ; page += 1) {
    const batch = await githubFetch<GitHubBranch[]>(
      `/repos/${owner}/${repo}/branches?per_page=${perPage}&page=${page}`,
      token,
    )
    branches.push(...batch)
    if (batch.length < perPage) break
  }

  const branchResults = await mapWithConcurrencyLimit(
    branches,
    BRANCH_DETAIL_CONCURRENCY,
    async (branch): Promise<BranchAnalysis> => {
      const encodedBranch = encodeURIComponent(branch.name)
      const encodedDefaultBranch = encodeURIComponent(metadata.default_branch)

      let lastCommitAt = ''
      let aheadBy = 0
      let behindBy = 0
      let comparisonKnown = branch.name === metadata.default_branch

      try {
        const commit = await githubFetch<GitHubCommit>(
          `/repos/${owner}/${repo}/commits/${branch.commit.sha}`,
          token,
        )
        lastCommitAt = commit.commit.committer?.date ?? commit.commit.author?.date ?? ''
      } catch {
        // fall back to unknown commit timing
      }

      if (branch.name !== metadata.default_branch) {
        try {
          const comparison = await githubFetch<GitHubCompare>(
            `/repos/${owner}/${repo}/compare/${encodedDefaultBranch}...${encodedBranch}`,
            token,
          )
          aheadBy = comparison.ahead_by
          behindBy = comparison.behind_by
          comparisonKnown = true
        } catch {
          // fall back to unknown divergence if comparison is unavailable
        }
      }

      return {
        repo: repoFullName,
        name: branch.name,
        url: `https://github.com/${repoFullName}/tree/${encodeURIComponent(branch.name)}`,
        isDefault: branch.name === metadata.default_branch,
        isProtected: branch.protected,
        lastCommitAt,
        aheadBy,
        behindBy,
        comparisonKnown,
        status: deriveBranchStatus(
          branch.name,
          metadata.default_branch,
          aheadBy,
          comparisonKnown,
          lastCommitAt,
        ),
      }
    },
  )

  return branchResults
}

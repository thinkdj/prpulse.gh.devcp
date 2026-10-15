import type {
  BranchAnalysis,
  BranchStatus,
  ChecksStatus,
  CopilotBilling,
  CopilotBillingUsageItem,
  CopilotBillingUsageReport,
  CopilotDayMetrics,
  CopilotOrgData,
  CopilotPersonalData,
  CopilotPremiumRequestUsageReport,
  CopilotReview,
  MergeSafety,
  PRComment,
  PullRequest,
} from './types'

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
  head: { sha: string; ref: string }
  base: { ref: string }
  draft: boolean
  labels: { name: string }[]
  commits: number
  requested_reviewers: { login: string }[]
  comments: number
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
const PR_DETAIL_CONCURRENCY = 6
const PR_LIST_PER_PAGE = 100
const PR_LIST_MAX_PAGES = 5 // 500 open PRs per repo cap — bounds API cost on huge repos

const apiCache = new Map<string, CacheEntry>()

/**
 * Opaque id for cache keys — avoids storing the raw PAT string in Map keys.
 * cyrb53 (64-bit, non-cryptographic): collision probability is negligible for
 * an in-memory per-session cache, unlike the previous 32-bit FNV-1a hash.
 * The token length is mixed in so different-length tokens never collide.
 */
function tokenCacheId(token: string): string {
  let h1 = 0xdeadbeef ^ token.length
  let h2 = 0x41c6ce57 ^ token.length
  for (let i = 0; i < token.length; i += 1) {
    const ch = token.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return `${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`
}

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
  const cacheKey = `${tokenCacheId(token)}:${path}`
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
  if (lastCopilotReview.state === 'COMMENTED') return 'commented'
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

  const [reviewsResult, checksResult] = await Promise.allSettled([
    githubFetch<GitHubReview[]>(
      `/repos/${fullRepo}/pulls/${pr.number}/reviews?per_page=100`,
      token,
    ),
    githubFetch<{ check_runs: GitHubCheckRun[] }>(
      `/repos/${fullRepo}/commits/${pr.head.sha}/check-runs?per_page=100`,
      token,
    ),
  ])

  if (reviewsResult.status === 'fulfilled') {
    reviews = reviewsResult.value
  }
  if (checksResult.status === 'fulfilled') {
    checkRuns = checksResult.value.check_runs
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
    reviewers: (pr.requested_reviewers ?? []).map((r) => r.login),
    baseRef: pr.base?.ref ?? '',
    headRef: pr.head?.ref ?? '',
    commentCount: pr.comments ?? 0,
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

  // Paginate the open-PR list so repos with 50+ open PRs are not silently truncated.
  const prs: GitHubPR[] = []
  for (let page = 1; page <= PR_LIST_MAX_PAGES; page += 1) {
    const batch = await githubFetch<GitHubPR[]>(
      `/repos/${owner}/${repo}/pulls?state=open&sort=updated&direction=desc&per_page=${PR_LIST_PER_PAGE}&page=${page}`,
      token,
    )
    prs.push(...batch)
    if (batch.length < PR_LIST_PER_PAGE) break
  }

  // Bound per-PR detail fan-out (2 API calls per PR) to avoid secondary rate limits.
  return mapWithConcurrencyLimit(
    prs,
    PR_DETAIL_CONCURRENCY,
    (pr) => fetchPRDetails(owner, repo, pr, token, currentUser),
  )
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

type GitHubIssueComment = {
  id: number
  user: { login: string; avatar_url: string } | null
  body: string
  created_at: string
}

type GitHubPRReview = {
  id: number
  user: { login: string; avatar_url: string } | null
  body: string
  state: string
  submitted_at: string
}

const ACTIVITY_PAGE_SIZE = 100
const MAX_ACTIVITY_PAGES = 30

async function fetchAllPages<T>(pathForPage: (page: number) => string, token: string): Promise<T[]> {
  const all: T[] = []
  for (let page = 1; page <= MAX_ACTIVITY_PAGES; page += 1) {
    const batch = await githubFetch<T[]>(pathForPage(page), token)
    all.push(...batch)
    if (batch.length < ACTIVITY_PAGE_SIZE) break
  }
  return all
}

/**
 * Fetch all activity (issue comments + review summaries) for a PR, merged and sorted by date.
 * Skips empty review bodies (e.g. an implicit review triggered only by inline comments).
 */
export async function fetchPRActivity(
  repoFullName: string,
  prNumber: number,
  token: string,
): Promise<PRComment[]> {
  const [owner, repo] = repoFullName.split('/')
  if (!owner || !repo) return []

  const [issueComments, reviews] = await Promise.all([
    fetchAllPages<GitHubIssueComment>(
      (page) =>
        `/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=${ACTIVITY_PAGE_SIZE}&page=${page}`,
      token,
    ),
    fetchAllPages<GitHubPRReview>(
      (page) =>
        `/repos/${owner}/${repo}/pulls/${prNumber}/reviews?per_page=${ACTIVITY_PAGE_SIZE}&page=${page}`,
      token,
    ),
  ])

  const comments: PRComment[] = [
    ...issueComments.map((c) => ({
      id: c.id,
      author: c.user?.login ?? 'ghost',
      authorAvatar: c.user?.avatar_url ?? '',
      body: c.body,
      createdAt: c.created_at,
      isReview: false,
    })),
    ...reviews
      .filter((r) => r.body.trim() !== '')
      .map((r) => ({
        id: r.id,
        author: r.user?.login ?? 'ghost',
        authorAvatar: r.user?.avatar_url ?? '',
        body: r.body,
        createdAt: r.submitted_at,
        isReview: true,
        reviewState: r.state as PRComment['reviewState'],
      })),
  ]

  return comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export type PRStats = {
  additions: number
  deletions: number
  changedFiles: number
}

/**
 * Fetch diff statistics for a pull request (additions, deletions, changed files).
 * Uses the individual PR endpoint which includes these counts.
 */
export async function fetchPRStats(
  repoFullName: string,
  prNumber: number,
  token: string,
): Promise<PRStats> {
  const [owner, repo] = repoFullName.split('/')
  if (!owner || !repo) throw new Error('Invalid repository name')

  const pr = await githubFetch<{ additions: number; deletions: number; changed_files: number }>(
    `/repos/${owner}/${repo}/pulls/${prNumber}`,
    token,
  )

  return {
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changed_files,
  }
}

/**
 * Close a pull request by setting its state to "closed".
 * Requires the token to have write access.
 */
export async function closePR(
  repoFullName: string,
  prNumber: number,
  token: string,
): Promise<void> {
  const [owner, repo] = repoFullName.split('/')
  if (!owner || !repo) throw new Error('Invalid repository name')

  const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ state: 'closed' }),
  })

  if (!response.ok) {
    if (response.status === 403) throw new Error('Forbidden: token may not have write access to this repository.')
    if (response.status === 401) throw new Error('Invalid GitHub token.')
    throw new Error(`Failed to close PR: ${response.status}`)
  }
}

/**
 * Delete a branch from a repository.
 * Requires the token to have write access.
 */
export async function deleteBranch(
  repoFullName: string,
  branchName: string,
  token: string,
): Promise<void> {
  const [owner, repo] = repoFullName.split('/')
  if (!owner || !repo) throw new Error('Invalid repository name')

  const encodedBranch = encodeURIComponent(branchName)
  const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/refs/heads/${encodedBranch}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) {
    if (response.status === 422) throw new Error('Branch is protected and cannot be deleted.')
    if (response.status === 403) throw new Error('Forbidden: token may not have write access to this repository.')
    if (response.status === 401) throw new Error('Invalid GitHub token.')
    if (response.status === 404) throw new Error(`Branch "${branchName}" not found.`)
    throw new Error(`Failed to delete branch: ${response.status}`)
  }
}

/**
 * Post a general comment on a PR (uses the Issues comments endpoint).
 * Requires the token to have write access (e.g. repo scope or pull_requests:write).
 */
export async function postPRComment(
  repoFullName: string,
  prNumber: number,
  token: string,
  body: string,
): Promise<PRComment> {
  const [owner, repo] = repoFullName.split('/')
  if (!owner || !repo) throw new Error('Invalid repository name')

  const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  })

  if (!response.ok) {
    if (response.status === 403) throw new Error('Forbidden: token may not have write access to this repository.')
    if (response.status === 401) throw new Error('Invalid GitHub token.')
    throw new Error(`Failed to post comment: ${response.status}`)
  }

  const comment = await response.json() as GitHubIssueComment
  return {
    id: comment.id,
    author: comment.user?.login ?? 'ghost',
    authorAvatar: comment.user?.avatar_url ?? '',
    body: comment.body,
    createdAt: comment.created_at,
    isReview: false,
  }
}

/* ── Copilot metrics API ── */

type GitHubOrg = {
  login: string
}

/** Fetch the organisations the authenticated user belongs to. */
export async function fetchUserOrgs(token: string): Promise<string[]> {
  const orgs = await githubFetch<GitHubOrg[]>('/user/orgs?per_page=100', token)
  return Array.isArray(orgs) ? orgs.map((o) => o.login) : []
}

/**
 * Fetch Copilot daily metrics for an organisation (last 28 days).
 * Requires the token to have `manage_billing:copilot` or `read:org` scope.
 */
export async function fetchCopilotMetrics(
  org: string,
  token: string,
): Promise<CopilotDayMetrics[]> {
  return githubFetch<CopilotDayMetrics[]>(
    `/orgs/${encodeURIComponent(org)}/copilot/metrics`,
    token,
  )
}

/**
 * Fetch Copilot billing / seat info for an organisation.
 * Requires the token to have `manage_billing:copilot` or `read:org` scope.
 */
export async function fetchCopilotBilling(
  org: string,
  token: string,
): Promise<CopilotBilling> {
  return githubFetch<CopilotBilling>(
    `/orgs/${encodeURIComponent(org)}/copilot/billing`,
    token,
  )
}

/**
 * Fetch Copilot data for an organisation: billing + metrics.
 * Both calls are made concurrently; partial failures are tolerated.
 */
export async function fetchCopilotOrgData(
  org: string,
  token: string,
): Promise<CopilotOrgData> {
  const [billingResult, metricsResult] = await Promise.allSettled([
    fetchCopilotBilling(org, token),
    fetchCopilotMetrics(org, token),
  ])

  const billing = billingResult.status === 'fulfilled' ? billingResult.value : null
  const metrics = metricsResult.status === 'fulfilled' ? metricsResult.value : []

  const errors: string[] = []
  if (billingResult.status === 'rejected') {
    errors.push(`Billing: ${billingResult.reason instanceof Error ? billingResult.reason.message : 'Unknown error'}`)
  }
  if (metricsResult.status === 'rejected') {
    errors.push(`Metrics: ${metricsResult.reason instanceof Error ? metricsResult.reason.message : 'Unknown error'}`)
  }

  return {
    type: 'organization',
    target: `org:${org}`,
    org,
    billing,
    metrics,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  }
}

const COPILOT_BILLING_PATTERN = /(?:^|[\s._-])copilot(?:$|[\s._-])/i

function isCopilotBillingItem(item: Pick<CopilotBillingUsageItem, 'product' | 'sku'>): boolean {
  return COPILOT_BILLING_PATTERN.test(item.product ?? '') || COPILOT_BILLING_PATTERN.test(item.sku ?? '')
}

function filterCopilotBillingItems(items: CopilotBillingUsageItem[]): CopilotBillingUsageItem[] {
  return items.filter(isCopilotBillingItem)
}

/**
 * Fetch billing usage for a personal account. This includes Copilot usage billed
 * directly to the authenticated user.
 */
export async function fetchUserBillingUsage(
  username: string,
  token: string,
): Promise<CopilotBillingUsageItem[]> {
  const report = await githubFetch<CopilotBillingUsageReport>(
    `/users/${encodeURIComponent(username)}/settings/billing/usage`,
    token,
  )
  return filterCopilotBillingItems(report.usageItems ?? [])
}

/**
 * Fetch premium request usage for a personal account.
 */
export async function fetchUserPremiumRequestUsage(
  username: string,
  token: string,
): Promise<CopilotBillingUsageItem[]> {
  const report = await githubFetch<CopilotPremiumRequestUsageReport>(
    `/users/${encodeURIComponent(username)}/settings/billing/premium_request/usage`,
    token,
  )
  return filterCopilotBillingItems(report.usageItems ?? [])
}

/**
 * Fetch personal Copilot analytics using GitHub billing usage APIs.
 */
export async function fetchCopilotPersonalData(
  username: string,
  token: string,
): Promise<CopilotPersonalData> {
  const [usageResult, premiumRequestsResult] = await Promise.allSettled([
    fetchUserBillingUsage(username, token),
    fetchUserPremiumRequestUsage(username, token),
  ])

  const usage = usageResult.status === 'fulfilled' ? usageResult.value : []
  const premiumRequests = premiumRequestsResult.status === 'fulfilled' ? premiumRequestsResult.value : []

  const errors: string[] = []
  if (usageResult.status === 'rejected') {
    errors.push(`Usage: ${usageResult.reason instanceof Error ? usageResult.reason.message : 'Unknown error'}`)
  }
  if (premiumRequestsResult.status === 'rejected') {
    errors.push(`Premium requests: ${premiumRequestsResult.reason instanceof Error ? premiumRequestsResult.reason.message : 'Unknown error'}`)
  }

  return {
    type: 'personal',
    target: `personal:${username}`,
    account: username,
    usage,
    premiumRequests,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  }
}

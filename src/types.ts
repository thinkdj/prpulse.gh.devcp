export type CopilotReview = 'approved' | 'changes_requested' | 'not_run'
export type MergeSafety = 'safe' | 'blocked' | 'pending'
export type ChecksStatus = 'passing' | 'failing' | 'pending'
export type BranchStatus = 'default' | 'active' | 'stale' | 'merged'

export type PullRequest = {
  id: number
  repo: string
  title: string
  author: string
  authorAvatar: string
  url: string
  openedAt: string
  updatedAt: string
  pushesAfterOpen: number
  checksStatus: ChecksStatus
  copilotReview: CopilotReview
  mergeSafety: MergeSafety
  needsYourReview: boolean
  isDraft: boolean
  labels: string[]
}

export type BranchAnalysis = {
  repo: string
  name: string
  url: string
  isDefault: boolean
  isProtected: boolean
  lastCommitAt: string
  aheadBy: number
  behindBy: number
  comparisonKnown: boolean
  status: BranchStatus
}

export type RepoState = {
  repos: string[]
  selectedRepos: string[]
}

export type DashboardFilter = 'all' | 'needs_review' | 'safe' | 'blocked'

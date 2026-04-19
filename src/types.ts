export type CopilotReview = 'approved' | 'changes_requested' | 'commented' | 'not_run'
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
  reviewers: string[]
  baseRef: string
  headRef: string
  commentCount: number
}

export type PRComment = {
  id: number
  author: string
  authorAvatar: string
  body: string
  createdAt: string
  isReview: boolean
  reviewState?: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING'
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

/* ── Copilot metrics types (from /orgs/{org}/copilot/metrics) ── */

export type CopilotLanguageMetrics = {
  name: string
  total_engaged_users: number
  total_code_suggestions?: number
  total_code_acceptances?: number
  total_code_lines_suggested?: number
  total_code_lines_accepted?: number
}

export type CopilotModelMetrics = {
  name: string
  is_custom_model: boolean
  custom_model_training_date: string | null
  total_engaged_users: number
  languages?: CopilotLanguageMetrics[]
  total_chats?: number
  total_chat_insertion_events?: number
  total_chat_copy_events?: number
  total_pr_summaries_created?: number
  total_code_suggestions?: number
  total_code_acceptances?: number
  total_code_lines_suggested?: number
  total_code_lines_accepted?: number
}

export type CopilotEditorMetrics = {
  name: string
  total_engaged_users: number
  models: CopilotModelMetrics[]
}

export type CopilotDayMetrics = {
  date: string
  total_active_users: number
  total_engaged_users: number
  copilot_ide_code_completions?: {
    total_engaged_users: number
    languages: CopilotLanguageMetrics[]
    editors: CopilotEditorMetrics[]
  }
  copilot_ide_chat?: {
    total_engaged_users: number
    editors: CopilotEditorMetrics[]
  }
  copilot_dotcom_chat?: {
    total_engaged_users: number
    models: CopilotModelMetrics[]
  }
  copilot_dotcom_pull_requests?: {
    total_engaged_users: number
    repositories: {
      name: string
      total_engaged_users: number
      models: CopilotModelMetrics[]
    }[]
  }
}

/* ── Copilot billing types (from /orgs/{org}/copilot/billing) ── */

export type CopilotBilling = {
  seat_breakdown: {
    total: number
    added_this_cycle: number
    pending_invitation: number
    pending_cancellation: number
    active_this_cycle: number
    inactive_this_cycle: number
  }
  seat_management_setting: string
  public_code_suggestions: string
  plan_type: string
}

/* ── Aggregated Copilot metrics for display ── */

export type CopilotOrgData = {
  type: 'organization'
  target: string
  org: string
  billing: CopilotBilling | null
  metrics: CopilotDayMetrics[]
  error?: string
}

export type CopilotBillingUsageItem = {
  product: string
  sku: string
  unitType: string
  pricePerUnit: number
  grossAmount: number
  discountAmount: number
  netAmount: number
  quantity?: number
  grossQuantity?: number
  discountQuantity?: number
  netQuantity?: number
  repositoryName?: string
  model?: string
}

export type CopilotBillingUsageReport = {
  usageItems: CopilotBillingUsageItem[]
}

export type CopilotPremiumRequestUsageReport = {
  timePeriod: {
    year: number
    month?: number
    day?: number
  }
  user: string
  product?: string
  model?: string
  usageItems: CopilotBillingUsageItem[]
}

export type CopilotPersonalData = {
  type: 'personal'
  target: string
  account: string
  usage: CopilotBillingUsageItem[]
  premiumRequests: CopilotBillingUsageItem[]
  error?: string
}

export type CopilotAccountData = CopilotOrgData | CopilotPersonalData

export type CopilotAnalyticsTarget = {
  id: string
  label: string
  type: 'organization' | 'personal'
}

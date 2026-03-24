import type { ChecksStatus, CopilotReview, MergeSafety } from './types'

export const formatReview = (value: CopilotReview) =>
  ({
    approved: 'Approved',
    changes_requested: 'Changes requested',
    not_run: 'Not run',
  })[value]

export const formatSafety = (value: MergeSafety) =>
  ({
    safe: 'Safe',
    blocked: 'Blocked',
    pending: 'Pending',
  })[value]

export const formatChecks = (value: ChecksStatus) =>
  ({
    passing: 'Passing',
    failing: 'Failing',
    pending: 'Pending',
  })[value]

export const relativeTime = (dateString: string): string => {
  const now = Date.now()
  const then = new Date(dateString).getTime()

  if (!Number.isFinite(then)) return '—'

  const diffMs = now - then

  if (diffMs < 0) return 'just now'

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`

  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

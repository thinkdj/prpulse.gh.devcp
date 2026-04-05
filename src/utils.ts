import type { BranchStatus, ChecksStatus, CopilotReview, MergeSafety } from './types'

export const formatReview = (value: CopilotReview) =>
  ({
    approved: 'Approved',
    changes_requested: 'Changes requested',
    commented: 'Commented',
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

export const formatBranchStatus = (value: BranchStatus) =>
  ({
    default: 'Default',
    active: 'Active',
    stale: 'Stale',
    merged: 'Merged',
  })[value]

function formatAgeParts(diffMs: number): string {
  if (diffMs < 0) return 'just now'

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) {
    return `${seconds} second${seconds === 1 ? '' : 's'} ago`
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }

  const days = Math.floor(hours / 24)
  if (days < 30) {
    return `${days} day${days === 1 ? '' : 's'} ago`
  }

  const months = Math.floor(days / 30)
  return `${months} month${months === 1 ? '' : 's'} ago`
}

/** Relative age from an ISO date string (e.g. PR timestamps). */
export const relativeTime = (dateString: string): string => {
  const then = new Date(dateString).getTime()
  if (!Number.isFinite(then)) return '—'
  return formatAgeParts(Date.now() - then)
}

/** Relative age from a Unix epoch milliseconds value (e.g. React Query `dataUpdatedAt`). */
export function formatAgeAgoFromMs(epochMs: number): string {
  if (!epochMs) return '—'
  return formatAgeParts(Date.now() - epochMs)
}

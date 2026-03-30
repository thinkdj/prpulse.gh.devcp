import type { BranchStatus, ChecksStatus, CopilotReview, MergeSafety } from '../types'
import { formatBranchStatus, formatChecks, formatReview, formatSafety } from '../utils'

type StatusBadgeProps =
  | { kind: 'copilotReview'; value: CopilotReview }
  | { kind: 'mergeSafety'; value: MergeSafety }
  | { kind: 'checksStatus'; value: ChecksStatus }
  | { kind: 'branchStatus'; value: BranchStatus }

const badgeStyles: Record<string, string> = {
  // Copilot review
  'copilotReview:approved': 'bg-gh-success/20 text-gh-success-fg border-gh-success/40',
  'copilotReview:changes_requested': 'bg-gh-danger/20 text-gh-danger-fg border-gh-danger/40',
  'copilotReview:commented': 'bg-gh-accent/15 text-gh-accent-fg border-gh-accent/40',
  'copilotReview:not_run': 'bg-gh-border/50 text-gh-fg-muted border-gh-border',
  // Merge safety
  'mergeSafety:safe': 'bg-gh-success/20 text-gh-success-fg border-gh-success/40',
  'mergeSafety:blocked': 'bg-gh-danger/20 text-gh-danger-fg border-gh-danger/40',
  'mergeSafety:pending': 'bg-gh-warning/20 text-gh-warning border-gh-warning/40',
  // Checks status
  'checksStatus:passing': 'bg-gh-success/20 text-gh-success-fg border-gh-success/40',
  'checksStatus:failing': 'bg-gh-danger/20 text-gh-danger-fg border-gh-danger/40',
  'checksStatus:pending': 'bg-gh-warning/20 text-gh-warning border-gh-warning/40',
  // Branch status
  'branchStatus:default': 'bg-gh-accent/15 text-gh-accent-fg border-gh-accent/40',
  'branchStatus:active': 'bg-gh-success/20 text-gh-success-fg border-gh-success/40',
  'branchStatus:stale': 'bg-gh-warning/20 text-gh-warning border-gh-warning/40',
  'branchStatus:merged': 'bg-gh-border/50 text-gh-fg-muted border-gh-border',
}

const statusIcons: Record<string, string> = {
  'copilotReview:approved': '✓',
  'copilotReview:changes_requested': '✕',
  'copilotReview:commented': '💬',
  'copilotReview:not_run': '—',
  'mergeSafety:safe': '✓',
  'mergeSafety:blocked': '✕',
  'mergeSafety:pending': '◷',
  'checksStatus:passing': '✓',
  'checksStatus:failing': '✕',
  'checksStatus:pending': '◷',
  'branchStatus:default': '◆',
  'branchStatus:active': '●',
  'branchStatus:stale': '◷',
  'branchStatus:merged': '↳',
}

const formatters: Record<string, (v: string) => string> = {
  copilotReview: (v) => formatReview(v as CopilotReview),
  mergeSafety: (v) => formatSafety(v as MergeSafety),
  checksStatus: (v) => formatChecks(v as ChecksStatus),
  branchStatus: (v) => formatBranchStatus(v as BranchStatus),
}

export default function StatusBadge(props: StatusBadgeProps) {
  const key = `${props.kind}:${props.value}`
  const style = badgeStyles[key] ?? 'bg-gh-border/50 text-gh-fg-muted border-gh-border'
  const icon = statusIcons[key] ?? ''
  const label = formatters[props.kind]?.(props.value) ?? props.value

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  )
}

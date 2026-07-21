import { Check, X, ChatCircle, Minus, Clock, Circle, Diamond, GitMerge } from '@phosphor-icons/react'
import type { ComponentType } from 'react'
import type { BranchStatus, ChecksStatus, CopilotReview, MergeSafety } from '../types'
import { formatBranchStatus, formatChecks, formatReview, formatSafety } from '../utils'

type StatusBadgeProps =
  | { kind: 'copilotReview'; value: CopilotReview }
  | { kind: 'mergeSafety'; value: MergeSafety }
  | { kind: 'checksStatus'; value: ChecksStatus }
  | { kind: 'branchStatus'; value: BranchStatus }

const badgeStyles: Record<string, string> = {
  // Copilot review
  'copilotReview:approved': 'bg-gh-success/15 text-gh-success-fg',
  'copilotReview:changes_requested': 'bg-gh-danger/15 text-gh-danger-fg',
  'copilotReview:commented': 'bg-gh-accent/15 text-gh-accent-fg',
  'copilotReview:not_run': 'bg-gh-border/60 text-gh-fg-muted',
  // Merge safety
  'mergeSafety:safe': 'bg-gh-success/15 text-gh-success-fg',
  'mergeSafety:blocked': 'bg-gh-danger/15 text-gh-danger-fg',
  'mergeSafety:pending': 'bg-gh-warning/15 text-gh-warning',
  // Checks status
  'checksStatus:passing': 'bg-gh-success/15 text-gh-success-fg',
  'checksStatus:failing': 'bg-gh-danger/15 text-gh-danger-fg',
  'checksStatus:pending': 'bg-gh-warning/15 text-gh-warning',
  // Branch status
  'branchStatus:default': 'bg-gh-accent/15 text-gh-accent-fg',
  'branchStatus:active': 'bg-gh-success/15 text-gh-success-fg',
  'branchStatus:stale': 'bg-gh-warning/15 text-gh-warning',
  'branchStatus:merged': 'bg-gh-border/60 text-gh-fg-muted',
}

type IconComponent = ComponentType<{ className?: string }>

const statusIcons: Record<string, IconComponent> = {
  'copilotReview:approved': Check,
  'copilotReview:changes_requested': X,
  'copilotReview:commented': ChatCircle,
  'copilotReview:not_run': Minus,
  'mergeSafety:safe': Check,
  'mergeSafety:blocked': X,
  'mergeSafety:pending': Clock,
  'checksStatus:passing': Check,
  'checksStatus:failing': X,
  'checksStatus:pending': Clock,
  'branchStatus:default': Diamond,
  'branchStatus:active': Circle,
  'branchStatus:stale': Clock,
  'branchStatus:merged': GitMerge,
}

const formatters: Record<string, (v: string) => string> = {
  copilotReview: (v) => formatReview(v as CopilotReview),
  mergeSafety: (v) => formatSafety(v as MergeSafety),
  checksStatus: (v) => formatChecks(v as ChecksStatus),
  branchStatus: (v) => formatBranchStatus(v as BranchStatus),
}

export default function StatusBadge(props: StatusBadgeProps) {
  const key = `${props.kind}:${props.value}`
  const style = badgeStyles[key] ?? 'bg-gh-border/60 text-gh-fg-muted'
  const Icon = statusIcons[key]
  const label = formatters[props.kind]?.(props.value) ?? props.value

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {label}
    </span>
  )
}

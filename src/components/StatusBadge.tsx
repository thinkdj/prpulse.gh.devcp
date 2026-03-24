import type { ChecksStatus, CopilotReview, MergeSafety } from '../types'
import { formatChecks, formatReview, formatSafety } from '../utils'

type StatusBadgeProps =
  | { kind: 'copilotReview'; value: CopilotReview }
  | { kind: 'mergeSafety'; value: MergeSafety }
  | { kind: 'checksStatus'; value: ChecksStatus }

const badgeStyles: Record<string, string> = {
  // Copilot review
  'copilotReview:approved': 'bg-[#238636]/20 text-[#3fb950] border-[#238636]/40',
  'copilotReview:changes_requested': 'bg-[#da3633]/20 text-[#f85149] border-[#da3633]/40',
  'copilotReview:not_run': 'bg-[#30363d]/50 text-[#8b949e] border-[#30363d]',
  // Merge safety
  'mergeSafety:safe': 'bg-[#238636]/20 text-[#3fb950] border-[#238636]/40',
  'mergeSafety:blocked': 'bg-[#da3633]/20 text-[#f85149] border-[#da3633]/40',
  'mergeSafety:pending': 'bg-[#d29922]/20 text-[#d29922] border-[#d29922]/40',
  // Checks status
  'checksStatus:passing': 'bg-[#238636]/20 text-[#3fb950] border-[#238636]/40',
  'checksStatus:failing': 'bg-[#da3633]/20 text-[#f85149] border-[#da3633]/40',
  'checksStatus:pending': 'bg-[#d29922]/20 text-[#d29922] border-[#d29922]/40',
}

const statusIcons: Record<string, string> = {
  'copilotReview:approved': '✓',
  'copilotReview:changes_requested': '✕',
  'copilotReview:not_run': '—',
  'mergeSafety:safe': '✓',
  'mergeSafety:blocked': '✕',
  'mergeSafety:pending': '◷',
  'checksStatus:passing': '✓',
  'checksStatus:failing': '✕',
  'checksStatus:pending': '◷',
}

const formatters: Record<string, (v: string) => string> = {
  copilotReview: (v) => formatReview(v as CopilotReview),
  mergeSafety: (v) => formatSafety(v as MergeSafety),
  checksStatus: (v) => formatChecks(v as ChecksStatus),
}

export default function StatusBadge(props: StatusBadgeProps) {
  const key = `${props.kind}:${props.value}`
  const style = badgeStyles[key] ?? 'bg-[#30363d]/50 text-[#8b949e] border-[#30363d]'
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

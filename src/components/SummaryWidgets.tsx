import type { DashboardFilter } from '../types'

type SummaryWidgetsProps = {
  total: number
  needsReview: number
  safeToMerge: number
  blocked: number
  activeFilter: DashboardFilter
  onFilterClick: (filter: DashboardFilter) => void
}

export default function SummaryWidgets({
  total,
  needsReview,
  safeToMerge,
  blocked,
  activeFilter,
  onFilterClick,
}: SummaryWidgetsProps) {
  const cards: { filter: DashboardFilter; label: string; count: number; color: string; testId: string }[] = [
    { filter: 'all', label: 'Open PRs', count: total, color: 'text-gh-fg', testId: 'summary-total' },
    { filter: 'needs_review', label: 'Need your review', count: needsReview, color: 'text-gh-warning', testId: 'summary-needs-review' },
    { filter: 'safe', label: 'Safe to merge', count: safeToMerge, color: 'text-gh-success-fg', testId: 'summary-safe' },
    { filter: 'blocked', label: 'Blocked', count: blocked, color: 'text-gh-danger-fg', testId: 'summary-blocked' },
  ]

  return (
    <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="summary widgets">
      {cards.map(({ filter, label, count, color, testId }) => (
        <button
          key={filter}
          type="button"
          onClick={() => onFilterClick(filter)}
          className={`rounded-md border bg-gh-surface p-4 text-left transition-colors ${
            activeFilter === filter
              ? 'border-gh-accent ring-1 ring-gh-accent/30'
              : 'border-gh-border hover:border-gh-border-hover'
          }`}
        >
          <p className="text-xs text-gh-fg-muted">{label}</p>
          <p className={`mt-2 text-2xl font-semibold ${color}`} data-testid={testId}>
            {count}
          </p>
        </button>
      ))}
    </section>
  )
}

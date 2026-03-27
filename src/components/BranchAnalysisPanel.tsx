import { useMemo, useState } from 'react'
import type { BranchAnalysis, BranchStatus } from '../types'
import { relativeTime } from '../utils'
import { STALE_BRANCH_DAYS } from '../github-api'
import StatusBadge from './StatusBadge'

type BranchAnalysisPanelProps = {
  branches: BranchAnalysis[]
  isLoading: boolean
  hasSelectedRepos: boolean
}

type BranchFilter = 'all' | BranchStatus

const filters: { value: BranchFilter; label: string }[] = [
  { value: 'all', label: 'All branches' },
  { value: 'stale', label: 'Stale' },
  { value: 'merged', label: 'Merged' },
  { value: 'active', label: 'Active' },
  { value: 'default', label: 'Default' },
]

function branchAgeColor(dateString: string): string {
  if (!dateString) return 'text-gh-fg-muted'

  const ageMs = Date.now() - new Date(dateString).getTime()
  const days = ageMs / (1000 * 60 * 60 * 24)

  if (days >= STALE_BRANCH_DAYS) return 'text-gh-danger-fg'
  if (days >= 14) return 'text-gh-warning'
  return 'text-gh-fg-muted'
}

function branchSortTime(dateString: string): number {
  if (!dateString) return 0

  const timestamp = new Date(dateString).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function divergenceLabel(branch: BranchAnalysis): string {
  if (branch.isDefault) return 'Default branch'
  if (!branch.comparisonKnown) return 'Comparison unavailable'
  if (branch.aheadBy === 0 && branch.behindBy === 0) return 'Up to date'
  return `+${branch.aheadBy} ahead / -${branch.behindBy} behind`
}

export default function BranchAnalysisPanel({
  branches,
  isLoading,
  hasSelectedRepos,
}: BranchAnalysisPanelProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<BranchFilter>('all')

  const summary = useMemo(
    () => ({
      total: branches.length,
      stale: branches.filter((branch) => branch.status === 'stale').length,
      merged: branches.filter((branch) => branch.status === 'merged').length,
      active: branches.filter((branch) => branch.status === 'active').length,
      default: branches.filter((branch) => branch.status === 'default').length,
    }),
    [branches],
  )

  const filteredBranches = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return [...branches]
      .filter((branch) => filter === 'all' || branch.status === filter)
      .filter((branch) => {
        if (!normalizedSearch) return true
        return `${branch.repo} ${branch.name}`.toLowerCase().includes(normalizedSearch)
      })
      .sort((a, b) => {
        const rank: Record<BranchStatus, number> = {
          stale: 0,
          active: 1,
          merged: 2,
          default: 3,
        }

        const rankDelta = rank[a.status] - rank[b.status]
        if (rankDelta !== 0) return rankDelta

        return branchSortTime(b.lastCommitAt) - branchSortTime(a.lastCommitAt)
      })
  }, [branches, filter, search])

  if (!hasSelectedRepos) {
    return (
      <section className="rounded-lg border border-gh-border bg-gh-surface p-6" data-testid="branch-analysis-panel">
        <p className="text-sm text-gh-fg-muted">Select at least one repository to analyze branches.</p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-gh-border bg-gh-surface p-5" data-testid="branch-analysis-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gh-fg">Branch analysis</h2>
          <p className="mt-1 text-sm text-gh-fg-muted">
            Surface stale branches, fully merged work, and active branches across the repos you track.
          </p>
        </div>
        <div className="grid min-w-[14rem] gap-2 text-right text-sm text-gh-fg-muted sm:grid-cols-2">
          <div className="rounded-md border border-gh-border bg-gh-overlay px-3 py-2">
            <div className="text-xs uppercase tracking-wide">Stale</div>
            <div className="mt-1 text-xl font-semibold text-gh-warning" data-testid="branch-summary-stale">{summary.stale}</div>
          </div>
          <div className="rounded-md border border-gh-border bg-gh-overlay px-3 py-2">
            <div className="text-xs uppercase tracking-wide">Merged</div>
            <div className="mt-1 text-xl font-semibold text-gh-fg" data-testid="branch-summary-merged">{summary.merged}</div>
          </div>
          <div className="rounded-md border border-gh-border bg-gh-overlay px-3 py-2">
            <div className="text-xs uppercase tracking-wide">Active</div>
            <div className="mt-1 text-xl font-semibold text-gh-success-fg" data-testid="branch-summary-active">{summary.active}</div>
          </div>
          <div className="rounded-md border border-gh-border bg-gh-overlay px-3 py-2">
            <div className="text-xs uppercase tracking-wide">Default</div>
            <div className="mt-1 text-xl font-semibold text-gh-accent-fg" data-testid="branch-summary-default">{summary.default}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              filter === item.value
                ? 'border-gh-accent bg-gh-accent/10 text-gh-accent-fg'
                : 'border-gh-border text-gh-fg-muted hover:border-gh-border-hover'
            }`}
          >
            {item.label}
          </button>
        ))}

        <label className="ml-auto flex min-w-[14rem] items-center gap-2 rounded-md border border-gh-border bg-gh-overlay px-3 py-2 text-sm text-gh-fg-muted">
          <span>Search</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="repo or branch"
            aria-label="Search branches"
            className="min-w-0 flex-1 bg-transparent text-gh-fg-default outline-none placeholder:text-gh-fg-placeholder"
          />
        </label>
      </div>

      {isLoading && branches.length === 0 ? (
        <div className="mt-4 rounded-md border border-gh-border bg-gh-overlay px-4 py-6 text-sm text-gh-fg-muted">
          Loading branch analysis…
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="mt-4 rounded-md border border-gh-border bg-gh-overlay px-4 py-6 text-sm text-gh-fg-muted">
          No branches match the current filters.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gh-fg-muted">
                <th className="border-b border-gh-border px-3 py-2 font-medium">Branch</th>
                <th className="border-b border-gh-border px-3 py-2 font-medium">Status</th>
                <th className="border-b border-gh-border px-3 py-2 font-medium">Divergence</th>
                <th className="border-b border-gh-border px-3 py-2 font-medium">Last commit</th>
              </tr>
            </thead>
            <tbody>
              {filteredBranches.map((branch) => (
                <tr key={`${branch.repo}:${branch.name}`} className="align-top">
                  <td className="border-b border-gh-border/80 px-3 py-3">
                    <div className="min-w-[20rem]">
                      <a
                        href={branch.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-gh-accent-fg hover:underline"
                      >
                        {branch.name}
                      </a>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gh-fg-muted">
                        <span>{branch.repo}</span>
                        {branch.isProtected && (
                          <span className="rounded-full border border-gh-border px-2 py-0.5">Protected</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="border-b border-gh-border/80 px-3 py-3">
                    <StatusBadge kind="branchStatus" value={branch.status} />
                  </td>
                  <td className="border-b border-gh-border/80 px-3 py-3 text-gh-fg-muted">
                    {divergenceLabel(branch)}
                  </td>
                  <td className="border-b border-gh-border/80 px-3 py-3">
                    <span className={branchAgeColor(branch.lastCommitAt)} title={branch.lastCommitAt || 'Unknown'}>
                      {branch.lastCommitAt ? relativeTime(branch.lastCommitAt) : 'Unknown'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-gh-fg-muted" data-testid="branch-summary-total">
        {filteredBranches.length} of {summary.total} branches shown
      </p>
    </section>
  )
}

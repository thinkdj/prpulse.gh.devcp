import { useEffect, useMemo, useRef, useState } from 'react'
import type { BranchAnalysis, BranchStatus } from '../types'
import { relativeTime } from '../utils'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import StatusBadge from './StatusBadge'
import CopyClipboardIconButton from './CopyClipboardIconButton'
import { Play } from '@phosphor-icons/react'

type BranchAnalysisPanelProps = {
  branches: BranchAnalysis[]
  isLoading: boolean
  hasSelectedRepos: boolean
  repos: string[]
  analysisRepos: string[]
  analysisTriggered: boolean
  onRunAnalysis: (repos: string[]) => void
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

  if (days >= 30) return 'text-gh-danger-fg'
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
  repos,
  analysisRepos,
  analysisTriggered,
  onRunAnalysis,
}: BranchAnalysisPanelProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<BranchFilter>('all')
  const { copiedKey: copiedBranchKey, copy: copyBranchNameToClipboard } = useCopyFeedback()
  const prevReposForSyncRef = useRef<string[] | null>(null)
  const [localRepos, setLocalRepos] = useState<string[]>(() =>
    analysisRepos.length > 0 ? analysisRepos : [...repos],
  )

  // When `repos` changes: prune removed repos; auto-check only repos newly added to tracking.
  // Skip the first run so initial state (e.g. subset from last analysis) is not expanded to all repos.
  useEffect(() => {
    const prevList = prevReposForSyncRef.current
    prevReposForSyncRef.current = repos
    if (prevList === null) return

    const prevSet = new Set(prevList)
    setLocalRepos((selection) => {
      const repoSet = new Set(repos)
      const kept = selection.filter((r) => repoSet.has(r))
      const newlyTracked = repos.filter((r) => !prevSet.has(r))
      return [...kept, ...newlyTracked]
    })
  }, [repos])

  const toggleLocalRepo = (repo: string) => {
    setLocalRepos((prev) =>
      prev.includes(repo) ? prev.filter((r) => r !== repo) : [...prev, repo],
    )
  }

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

  if (!hasSelectedRepos && repos.length === 0) {
    return (
      <section className="rounded-md border border-gh-border bg-gh-surface p-6 shadow-sm" data-testid="branch-analysis-panel">
        <p className="text-sm text-gh-fg-muted">Select at least one repository to analyze branches.</p>
      </section>
    )
  }

  return (
    <section className="rounded-md border border-gh-border bg-gh-surface p-5 shadow-sm" data-testid="branch-analysis-panel">
      {/* Repo selection + manual trigger */}
      <div className="mb-5 rounded-md border border-gh-border bg-gh-overlay p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gh-fg">Select repositories to analyze</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLocalRepos(repos)}
              className="text-xs text-gh-accent-fg hover:underline"
            >
              All
            </button>
            <span className="text-xs text-gh-fg-placeholder">·</span>
            <button
              type="button"
              onClick={() => setLocalRepos([])}
              className="text-xs text-gh-fg-muted hover:underline"
            >
              None
            </button>
          </div>
        </div>
        {repos.length === 0 ? (
          <p className="text-xs text-gh-fg-muted">No repositories added. Add repositories in the section above.</p>
        ) : (
          <ul className="mb-3 flex flex-wrap gap-2">
            {repos.map((repo) => {
              const checked = localRepos.includes(repo)
              return (
                <li key={repo}>
                  <label className={`inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    checked
                      ? 'border-gh-accent bg-gh-accent/10 text-gh-accent-fg'
                      : 'border-gh-border text-gh-fg-muted hover:border-gh-border-hover hover:bg-gh-overlay'
                  }`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleLocalRepo(repo)}
                      className="accent-gh-accent"
                    />
                    {repo}
                  </label>
                </li>
              )
            })}
          </ul>
        )}
        <button
          type="button"
          onClick={() => onRunAnalysis(localRepos)}
          disabled={localRepos.length === 0 || isLoading}
          className="inline-flex items-center gap-1.5 rounded-md bg-gh-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Play className="h-3.5 w-3.5" />
          {isLoading ? 'Analyzing…' : 'Run analysis'}
        </button>
      </div>

      {!analysisTriggered ? (
        <div className="rounded-md border border-gh-border bg-gh-overlay px-4 py-10 text-center text-sm text-gh-fg-muted">
          Select repositories above and click <span className="font-medium text-gh-fg">Run analysis</span> to fetch branch data.
        </div>
      ) : (
        <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gh-fg">Branch analysis</h2>
          <p className="mt-1 text-sm text-gh-fg-muted">
            Surface stale branches, fully merged work, and active branches across the repos you track.
          </p>
        </div>
        <div className="grid min-w-[14rem] gap-2.5 text-right text-sm text-gh-fg-muted sm:grid-cols-2">
          <div className="rounded-md border border-gh-border bg-gh-overlay px-3.5 py-2.5 shadow-sm">
            <div className="text-xs uppercase tracking-wide">Stale</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-gh-warning" data-testid="branch-summary-stale">{summary.stale}</div>
          </div>
          <div className="rounded-md border border-gh-border bg-gh-overlay px-3.5 py-2.5 shadow-sm">
            <div className="text-xs uppercase tracking-wide">Merged</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-gh-fg" data-testid="branch-summary-merged">{summary.merged}</div>
          </div>
          <div className="rounded-md border border-gh-border bg-gh-overlay px-3.5 py-2.5 shadow-sm">
            <div className="text-xs uppercase tracking-wide">Active</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-gh-success-fg" data-testid="branch-summary-active">{summary.active}</div>
          </div>
          <div className="rounded-md border border-gh-border bg-gh-overlay px-3.5 py-2.5 shadow-sm">
            <div className="text-xs uppercase tracking-wide">Default</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-gh-accent-fg" data-testid="branch-summary-default">{summary.default}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
              filter === item.value
                ? 'bg-gh-accent text-white shadow-sm'
                : 'border border-gh-border text-gh-fg-muted hover:border-gh-border-hover hover:bg-gh-overlay'
            }`}
          >
            {item.label}
          </button>
        ))}

        <label className="ml-auto flex min-w-[14rem] items-center gap-2 rounded-md border border-gh-border bg-gh-overlay px-3 py-2 text-sm text-gh-fg-muted transition-colors focus-within:border-gh-accent focus-within:ring-2 focus-within:ring-gh-accent/20">
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
              <tr className="bg-gh-overlay/60 text-left text-xs uppercase tracking-wide text-gh-fg-muted">
                <th className="border-b border-gh-border px-3 py-2 font-semibold">Branch</th>
                <th className="border-b border-gh-border px-3 py-2 font-semibold">Status</th>
                <th className="border-b border-gh-border px-3 py-2 font-semibold">Divergence</th>
                <th className="border-b border-gh-border px-3 py-2 font-semibold">Last commit</th>
              </tr>
            </thead>
            <tbody>
              {filteredBranches.map((branch) => {
                const rowKey = `${branch.repo}:${branch.name}`
                return (
                <tr key={rowKey} className="align-top">
                  <td className="border-b border-gh-border/80 px-3 py-3">
                    <div className="min-w-[20rem]">
                      <div className="flex flex-wrap items-center gap-1">
                        <a
                          href={branch.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 font-medium text-gh-accent-fg hover:underline break-all"
                        >
                          {branch.name}
                        </a>
                        <CopyClipboardIconButton
                          text={branch.name}
                          copyKey={rowKey}
                          copiedKey={copiedBranchKey}
                          onCopy={copyBranchNameToClipboard}
                          title="Copy branch name"
                          ariaLabel={`Copy branch name ${branch.name}`}
                        />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gh-fg-muted">
                        <span>{branch.repo}</span>
                        {branch.isProtected && (
                          <span className="rounded-full bg-gh-border/60 px-2 py-0.5 font-medium">Protected</span>
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
              )})}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-gh-fg-muted" data-testid="branch-summary-total">
        {filteredBranches.length} of {summary.total} branches shown
      </p>
        </>
      )}
    </section>
  )
}

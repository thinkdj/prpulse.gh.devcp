import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import type { ColumnDef, SortingState, ColumnFiltersState } from '@tanstack/react-table'
import { ArrowsClockwise, X, ChatCircle, ArrowSquareOut } from '@phosphor-icons/react'
import type { PullRequest, DashboardFilter } from '../types'
import { formatAgeAgoFromMs, relativeTime } from '../utils'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import StatusBadge from './StatusBadge'
import CopyClipboardIconButton from './CopyClipboardIconButton'

type PullRequestTableProps = {
  pullRequests: PullRequest[]
  filter: DashboardFilter
  onFilterChange: (filter: DashboardFilter) => void
  isLoading: boolean
  hasToken: boolean
  hasSelectedRepos: boolean
  currentUser?: string
  onRefresh?: () => void
  dataUpdatedAt?: number
  onPRSelect?: (pr: PullRequest) => void
  /** When the detail panel is open, the matching row is highlighted */
  selectedPR?: PullRequest | null
}

const filterLabels: { value: DashboardFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'safe', label: 'Safe to merge' },
  { value: 'blocked', label: 'Blocked' },
]

// Varying widths so skeleton rows read as placeholder titles rather than a rigid grid.
const SKELETON_ROW_WIDTHS = ['w-64', 'w-44', 'w-52', 'w-72', 'w-40', 'w-56']

const labelColorMap: Record<string, string> = {
  bug: 'bg-gh-danger/15 text-gh-danger-fg',
  urgent: 'bg-gh-warning/15 text-gh-warning',
  critical: 'bg-gh-danger/15 text-gh-danger-fg',
  enhancement: 'bg-gh-accent/15 text-gh-accent-fg',
  feature: 'bg-gh-accent/15 text-gh-accent-fg',
  documentation: 'bg-gh-purple/15 text-gh-purple',
  docs: 'bg-gh-purple/15 text-gh-purple',
  chore: 'bg-gh-border/60 text-gh-fg-muted',
  dependencies: 'bg-gh-success/15 text-gh-success-fg',
}

function getLabelStyle(label: string): string {
  return labelColorMap[label.toLowerCase()] ?? 'bg-gh-border/60 text-gh-fg-muted'
}

function ageColor(dateString: string): string {
  const ms = Date.now() - new Date(dateString).getTime()
  const days = ms / (1000 * 60 * 60 * 24)
  if (days > 14) return 'text-gh-danger-fg'
  if (days > 7) return 'text-gh-warning'
  return 'text-gh-fg-muted'
}

const columnFilterInputStyle =
  'mt-1 w-full rounded-md border border-gh-border bg-gh-surface px-1.5 py-0.5 text-[10px] text-gh-fg-default placeholder-gh-fg-placeholder outline-none transition-colors focus:border-gh-accent'

export default function PullRequestTable({
  pullRequests,
  filter,
  onFilterChange,
  isLoading,
  hasToken,
  hasSelectedRepos,
  currentUser = '',
  onRefresh,
  dataUpdatedAt,
  onPRSelect,
  selectedPR = null,
}: PullRequestTableProps) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [hideDrafts, setHideDrafts] = useState(false)
  const [hideCopilot, setHideCopilot] = useState(false)
  const [hideDependabot, setHideDependabot] = useState(false)
  const [hideMine, setHideMine] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'openedAt', desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const { copiedKey: copiedHeadRefKey, copy: copyHeadRefToClipboard } = useCopyFeedback()

  /* ── Dashboard-level filter (needs_review / safe / blocked) ── */
  const dashboardFiltered = useMemo(() => {
    let result = pullRequests
    if (filter === 'needs_review') result = result.filter((pr) => pr.needsYourReview)
    else if (filter === 'safe') result = result.filter((pr) => pr.mergeSafety === 'safe')
    else if (filter === 'blocked') result = result.filter((pr) => pr.mergeSafety === 'blocked')
    if (hideDrafts) result = result.filter((pr) => !pr.isDraft)
    if (hideCopilot) result = result.filter((pr) => {
      const a = pr.author.toLowerCase()
      return !a.includes('copilot')
    })
    if (hideDependabot) result = result.filter((pr) => {
      const a = pr.author.toLowerCase()
      return !a.includes('dependabot')
    })
    if (hideMine && currentUser) result = result.filter((pr) => pr.author !== currentUser)
    return result
  }, [pullRequests, filter, hideDrafts, hideCopilot, hideDependabot, hideMine, currentUser])

  const columns: ColumnDef<PullRequest, unknown>[] = [
      {
        id: 'repo',
        accessorKey: 'repo',
        header: 'Repo',
        size: 180,
        filterFn: 'includesString',
        enableColumnFilter: true,
        cell: ({ row }) => {
          const pr = row.original
          const [owner, repoName] = pr.repo.split('/')
          return (
            <div className="min-w-0 max-w-[14rem]">
              <span
                className="inline-flex cursor-pointer whitespace-nowrap text-gh-fg-muted hover:text-gh-accent-fg"
                title={`Filter by repo: ${pr.repo}`}
                aria-label={`Filter by repo: ${pr.repo}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  const col = table.getColumn('repo')
                  col?.setFilterValue(pr.repo)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    const col = table.getColumn('repo')
                    col?.setFilterValue(pr.repo)
                  }
                }}
              >
                <span className="text-xs text-gh-fg-placeholder">{owner}/</span>
                <span className="text-xs font-medium">{repoName}</span>
              </span>
              {pr.headRef && (
                <div className="mt-0.5 flex min-w-0 items-center gap-0.5">
                  <span
                    className="min-w-0 flex-1 truncate text-[10px] text-gh-fg-muted"
                    title={pr.headRef}
                  >
                    {pr.headRef}
                  </span>
                  <CopyClipboardIconButton
                    text={pr.headRef}
                    copyKey={`${pr.repo}#${pr.id}`}
                    copiedKey={copiedHeadRefKey}
                    onCopy={copyHeadRefToClipboard}
                    title="Copy branch name"
                    ariaLabel={`Copy branch ${pr.headRef}`}
                    stopPropagation
                  />
                </div>
              )}
            </div>
          )
        },
      },
      {
        id: 'title',
        accessorFn: (row) => `#${row.id} ${row.title} ${row.repo} ${row.labels.join(' ')}`,
        header: 'PR',
        size: 340,
        filterFn: 'includesString',
        enableColumnFilter: true,
        cell: ({ row }) => {
          const pr = row.original
          return (
            <div className="flex items-start gap-2">
              {pr.needsYourReview && (
                <span
                  className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-gh-warning"
                  title="Needs your review"
                />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onPRSelect?.(pr)}
                    aria-label={`View details for PR #${pr.id}: ${pr.title}`}
                    className="text-left font-semibold text-gh-accent-fg transition-colors hover:text-gh-accent hover:underline"
                  >
                    #{pr.id} {pr.title}
                  </button>
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open on GitHub"
                    aria-label={`Open PR #${pr.id} on GitHub`}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-gh-fg-muted transition-colors hover:bg-gh-overlay hover:text-gh-accent-fg"
                  >
                    <ArrowSquareOut className="h-3 w-3" />
                  </a>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {pr.isDraft && (
                    <span className="rounded-full bg-gh-border/60 px-2 py-0.5 text-[10px] font-medium text-gh-fg-muted">
                      Draft
                    </span>
                  )}
                  {pr.labels.map((label) => (
                    <span
                      key={label}
                      className={`inline-flex cursor-pointer items-center rounded-full px-2 py-0.5 text-[10px] font-medium transition-opacity hover:opacity-75 ${getLabelStyle(label)}`}
                      title={`Filter by label: ${label}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        const col = table.getColumn('title')
                        col?.setFilterValue(label)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          const col = table.getColumn('title')
                          col?.setFilterValue(label)
                        }
                      }}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        },
      },
      {
        id: 'author',
        accessorKey: 'author',
        header: 'Author',
        size: 140,
        filterFn: 'includesString',
        enableColumnFilter: true,
        cell: ({ row }) => {
          const pr = row.original
          return (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                {pr.authorAvatar && (
                  <img src={pr.authorAvatar} alt="" className="h-5 w-5 rounded-full" />
                )}
                <span
                  className="cursor-pointer text-gh-fg-default hover:text-gh-accent-fg"
                  title={`Filter by author: ${pr.author}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    const col = table.getColumn('author')
                    col?.setFilterValue(pr.author)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      const col = table.getColumn('author')
                      col?.setFilterValue(pr.author)
                    }
                  }}
                >
                  {pr.author}
                </span>
              </div>
              {pr.reviewers.length > 0 && (
                <div className="flex flex-wrap gap-1 pl-7">
                  {pr.reviewers.slice(0, 3).map((r) => (
                    <span
                      key={r}
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                        r === currentUser
                          ? 'bg-gh-warning/15 text-gh-warning'
                          : 'bg-gh-border/50 text-gh-fg-placeholder'
                      }`}
                      title={`Reviewer: ${r}`}
                    >
                      {r}
                    </span>
                  ))}
                  {pr.reviewers.length > 3 && (
                    <span className="text-[9px] text-gh-fg-placeholder">+{pr.reviewers.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          )
        },
      },
      {
        id: 'openedAt',
        accessorKey: 'openedAt',
        header: 'Opened',
        size: 90,
        enableColumnFilter: false,
        cell: ({ row }) => {
          const pr = row.original
          return (
            <span
              className={ageColor(pr.openedAt)}
              title={new Date(pr.openedAt).toLocaleString()}
            >
              {relativeTime(pr.openedAt)}
            </span>
          )
        },
        sortingFn: (a, b) =>
          new Date(a.original.openedAt).getTime() - new Date(b.original.openedAt).getTime(),
      },
      {
        id: 'updatedAt',
        accessorKey: 'updatedAt',
        header: 'Updated',
        size: 90,
        enableColumnFilter: false,
        cell: ({ row }) => {
          const pr = row.original
          return (
            <span
              className={ageColor(pr.updatedAt)}
              title={new Date(pr.updatedAt).toLocaleString()}
            >
              {relativeTime(pr.updatedAt)}
            </span>
          )
        },
        sortingFn: (a, b) =>
          new Date(a.original.updatedAt).getTime() - new Date(b.original.updatedAt).getTime(),
      },
      {
        id: 'checksStatus',
        accessorKey: 'checksStatus',
        header: 'Checks',
        size: 80,
        filterFn: 'includesString',
        enableColumnFilter: true,
        cell: ({ row }) => <StatusBadge kind="checksStatus" value={row.original.checksStatus} />,
      },
      {
        id: 'copilotReview',
        accessorKey: 'copilotReview',
        header: 'Copilot',
        size: 80,
        filterFn: 'includesString',
        enableColumnFilter: true,
        cell: ({ row }) => <StatusBadge kind="copilotReview" value={row.original.copilotReview} />,
      },
      {
        id: 'mergeSafety',
        accessorKey: 'mergeSafety',
        header: 'Merge',
        size: 80,
        filterFn: 'includesString',
        enableColumnFilter: true,
        cell: ({ row }) => <StatusBadge kind="mergeSafety" value={row.original.mergeSafety} />,
      },
      {
        id: 'pushesAfterOpen',
        accessorKey: 'pushesAfterOpen',
        header: 'Pushes',
        size: 60,
        enableColumnFilter: false,
        cell: ({ row }) => {
          const pr = row.original
          return (
            <span
              className={`inline-flex min-w-[1.75rem] items-center justify-center rounded-md border px-2 py-1 text-xs font-semibold ${
                pr.pushesAfterOpen >= 3
                  ? 'border-gh-warning/30 bg-gh-warning/10 text-gh-warning'
                  : 'border-gh-border bg-gh-overlay/60 text-gh-fg-muted'
              }`}
            >
              {pr.pushesAfterOpen}
            </span>
          )
        },
      },
      {
        id: 'commentCount',
        accessorKey: 'commentCount',
        header: () => (
          <span className="inline-flex items-center">
            <span className="sr-only">Comments</span>
            <ChatCircle className="h-3.5 w-3.5 text-gh-fg-muted" aria-hidden="true" />
          </span>
        ),
        size: 48,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <span className="inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-gh-border bg-gh-overlay/60 px-2 py-1 text-xs font-semibold text-gh-fg-muted">
            {row.original.commentCount}
          </span>
        ),
      },
  ]

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: dashboardFiltered,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: 'includesString',
    getRowId: (row) => `${row.repo}#${row.id}`,
  })

  const rows = table.getRowModel().rows
  const hasActiveColumnFilters = columnFilters.length > 0
  const hasActiveFilters = !!(globalFilter || hasActiveColumnFilters || hideDrafts || hideCopilot || hideDependabot || hideMine)

  const clearAllFilters = () => {
    setGlobalFilter('')
    setColumnFilters([])
    setHideDrafts(false)
    setHideCopilot(false)
    setHideDependabot(false)
    setHideMine(false)
    onFilterChange('all')
  }

  return (
    <section className="overflow-hidden rounded-md border border-gh-border bg-gh-surface shadow-sm">
      {/* Toolbar: search, facets, refresh */}
      <div className="space-y-2.5 border-b border-gh-border px-3 py-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search PRs by title, author, or #number…"
            aria-label="Search pull requests"
            className="flex-1 rounded-md border border-gh-border bg-gh-surface py-2 pl-3.5 pr-3.5 text-sm text-gh-fg-default outline-none transition-colors placeholder-gh-fg-placeholder focus:border-gh-accent focus:ring-2 focus:ring-gh-accent/20"
          />
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="shrink-0 rounded-md border border-gh-border bg-gh-overlay px-3 py-2 text-sm text-gh-fg-default transition-colors hover:border-gh-border-hover hover:bg-gh-border/40"
              title="Refresh data (clears cache)"
              aria-label="Refresh data"
            >
              <ArrowsClockwise className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className={`flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            hideDrafts ? 'border-gh-accent/40 bg-gh-accent/10 text-gh-accent-fg' : 'border-gh-border text-gh-fg-muted hover:border-gh-border-hover hover:bg-gh-overlay'
          }`}>
            <input
              type="checkbox"
              checked={hideDrafts}
              onChange={() => setHideDrafts(!hideDrafts)}
              className="accent-gh-accent"
            />
            Hide drafts
          </label>

          <label className={`flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            hideCopilot ? 'border-gh-accent/40 bg-gh-accent/10 text-gh-accent-fg' : 'border-gh-border text-gh-fg-muted hover:border-gh-border-hover hover:bg-gh-overlay'
          }`}>
            <input
              type="checkbox"
              checked={hideCopilot}
              onChange={() => setHideCopilot(!hideCopilot)}
              className="accent-gh-accent"
            />
            Hide Copilot
          </label>

          <label className={`flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            hideDependabot ? 'border-gh-accent/40 bg-gh-accent/10 text-gh-accent-fg' : 'border-gh-border text-gh-fg-muted hover:border-gh-border-hover hover:bg-gh-overlay'
          }`}>
            <input
              type="checkbox"
              checked={hideDependabot}
              onChange={() => setHideDependabot(!hideDependabot)}
              className="accent-gh-accent"
            />
            Hide Dependabot
          </label>

          {currentUser && (
            <label className={`flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              hideMine ? 'border-gh-accent/40 bg-gh-accent/10 text-gh-accent-fg' : 'border-gh-border text-gh-fg-muted hover:border-gh-border-hover hover:bg-gh-overlay'
            }`}>
              <input
                type="checkbox"
                checked={hideMine}
                onChange={() => setHideMine(!hideMine)}
                className="accent-gh-accent"
              />
              Hide mine
            </label>
          )}

          {dataUpdatedAt != null && dataUpdatedAt > 0 && (
            <span
              className="text-xs text-gh-fg-muted"
              title={new Date(dataUpdatedAt).toLocaleString()}
            >
              Data {formatAgeAgoFromMs(dataUpdatedAt)}
            </span>
          )}

          {(hasActiveFilters || filter !== 'all') && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="ml-auto inline-flex items-center gap-1 rounded-full border border-gh-border px-2.5 py-1 text-xs font-medium text-gh-fg-muted transition-colors hover:border-gh-border-hover hover:bg-gh-overlay hover:text-gh-fg-default"
            >
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Status filter buttons */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gh-border px-3 py-2.5">
        <span className="text-xs font-medium text-gh-fg-muted">Status:</span>
        {filterLabels.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => onFilterChange(value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === value
                ? 'bg-gh-accent text-white shadow-sm'
                : 'bg-gh-border/50 text-gh-fg-muted hover:bg-gh-border/70 hover:text-gh-fg-default'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-gh-fg-muted">
          {rows.length} {rows.length === 1 ? 'PR' : 'PRs'}
        </span>
      </div>

      {isLoading && rows.length === 0 ? (
        <div aria-hidden="true">
          {SKELETON_ROW_WIDTHS.map((titleWidth, i) => (
            <div key={i} className="flex items-center gap-4 border-t border-gh-border px-4 py-3.5 first:border-t-0">
              <div className="h-2.5 w-20 shrink-0 animate-pulse rounded bg-gh-overlay" />
              <div className={`h-2.5 shrink-0 animate-pulse rounded bg-gh-overlay ${titleWidth}`} />
              <div className="ml-auto h-2.5 w-14 shrink-0 animate-pulse rounded bg-gh-overlay" />
              <div className="h-5 w-14 shrink-0 animate-pulse rounded-full bg-gh-overlay" />
              <div className="h-5 w-14 shrink-0 animate-pulse rounded-full bg-gh-overlay" />
            </div>
          ))}
        </div>
      ) : !hasToken ? (
        <div className="px-4 py-12 text-center text-sm text-gh-fg-muted">
          Add a GitHub token in settings to fetch live data.
        </div>
      ) : !hasSelectedRepos ? (
        <div className="px-4 py-12 text-center text-sm text-gh-fg-muted">
          Select a repository above to view pull requests.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm" data-testid="pr-table">
            <thead className="bg-gh-overlay/60 text-xs font-semibold uppercase tracking-wide text-gh-fg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort()
                    const sorted = header.column.getIsSorted()
                    const sortIcon = sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : '↕'
                    const isLast = header.column.id === 'commentCount'
                    return (
                      <th
                        key={header.id}
                        className={`px-3 py-2 ${isLast ? 'text-right' : ''}`}
                        style={{ width: header.column.columnDef.size, minWidth: header.column.columnDef.size }}
                        aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}
                      >
                        {canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className={`inline-flex w-full items-center gap-1 text-inherit hover:text-gh-fg-default ${isLast ? 'justify-end' : ''}`}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}{' '}
                            <span className="text-[10px] opacity-60">{sortIcon}</span>
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                        {header.column.getCanFilter() && (
                          <input
                            type="text"
                            value={(header.column.getFilterValue() as string) ?? ''}
                            onChange={(e) => header.column.setFilterValue(e.target.value || undefined)}
                            placeholder={`Filter…`}
                            aria-label={`Filter by ${header.column.columnDef.header as string}`}
                            className={columnFilterInputStyle}
                          />
                        )}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-gh-fg-muted">
                    {pullRequests.length === 0
                      ? 'No open pull requests found.'
                      : 'No PRs match the current filters.'}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const pr = row.original
                  const isRowSelected =
                    selectedPR != null && selectedPR.repo === pr.repo && selectedPR.id === pr.id
                  return (
                    <tr
                      key={row.id}
                      aria-selected={isRowSelected}
                      className={`cursor-pointer border-t border-gh-border transition-colors hover:bg-gh-overlay ${
                        isRowSelected
                          ? 'bg-gh-accent/15 ring-1 ring-inset ring-gh-accent/45'
                          : pr.needsYourReview
                            ? 'bg-gh-warning/8'
                            : ''
                      }`}
                      onClick={(event) => {
                        // Don't open panel if click landed on an interactive element inside a cell
                        const target = event.target as HTMLElement
                        if (
                          target.closest(
                            'button, a, input, select, textarea, [role="button"], [role="link"]',
                          )
                        ) return
                        onPRSelect?.(pr)
                      }}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const isLast = cell.column.id === 'commentCount'
                        return (
                          <td
                            key={cell.id}
                            className={`px-3 py-3 ${isLast ? 'text-right' : ''}`}
                            style={{ width: cell.column.columnDef.size, minWidth: cell.column.columnDef.size }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

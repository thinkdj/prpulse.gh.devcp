import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import type { ColumnDef, SortingState, ColumnFiltersState } from '@tanstack/react-table'
import type { PullRequest, DashboardFilter } from '../types'
import { relativeTime } from '../utils'
import StatusBadge from './StatusBadge'

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
}

const filterLabels: { value: DashboardFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'safe', label: 'Safe to merge' },
  { value: 'blocked', label: 'Blocked' },
]

const labelColorMap: Record<string, string> = {
  bug: 'border-gh-danger-fg/60 text-gh-danger-fg',
  urgent: 'border-gh-warning/60 text-gh-warning',
  critical: 'border-gh-danger-fg/60 text-gh-danger-fg',
  enhancement: 'border-gh-accent/60 text-gh-accent-fg',
  feature: 'border-gh-accent/60 text-gh-accent-fg',
  documentation: 'border-gh-purple/60 text-gh-purple',
  docs: 'border-gh-purple/60 text-gh-purple',
  chore: 'border-gh-fg-muted/40 text-gh-fg-muted',
  dependencies: 'border-gh-success-fg/60 text-gh-success-fg',
}

function getLabelStyle(label: string): string {
  return labelColorMap[label.toLowerCase()] ?? 'border-gh-border text-gh-fg-muted'
}

function ageColor(dateString: string): string {
  const ms = Date.now() - new Date(dateString).getTime()
  const days = ms / (1000 * 60 * 60 * 24)
  if (days > 14) return 'text-gh-danger-fg'
  if (days > 7) return 'text-gh-warning'
  return 'text-gh-fg-muted'
}

const columnFilterInputStyle =
  'mt-1 w-full rounded border border-gh-border bg-gh-surface px-1.5 py-0.5 text-[10px] text-gh-fg-default placeholder-gh-fg-placeholder focus:border-gh-accent focus:outline-none'

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
}: PullRequestTableProps) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [hideDrafts, setHideDrafts] = useState(false)
  const [hideCopilot, setHideCopilot] = useState(false)
  const [hideMine, setHideMine] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'openedAt', desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  /* ── Dashboard-level filter (needs_review / safe / blocked) ── */
  const dashboardFiltered = useMemo(() => {
    let result = pullRequests
    if (filter === 'needs_review') result = result.filter((pr) => pr.needsYourReview)
    else if (filter === 'safe') result = result.filter((pr) => pr.mergeSafety === 'safe')
    else if (filter === 'blocked') result = result.filter((pr) => pr.mergeSafety === 'blocked')
    if (hideDrafts) result = result.filter((pr) => !pr.isDraft)
    if (hideCopilot) result = result.filter((pr) => {
      const a = pr.author.toLowerCase()
      return !a.includes('copilot') && !a.endsWith('[bot]')
    })
    if (hideMine && currentUser) result = result.filter((pr) => pr.author !== currentUser)
    return result
  }, [pullRequests, filter, hideDrafts, hideCopilot, hideMine, currentUser])

  const columns: ColumnDef<PullRequest, unknown>[] = [
      {
        id: 'title',
        accessorFn: (row) => `#${row.id} ${row.title} ${row.repo} ${row.labels.join(' ')}`,
        header: 'PR',
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
                <a
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-gh-accent-fg hover:underline"
                >
                  #{pr.id} {pr.title}
                </a>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-gh-fg-muted">{pr.repo}</span>
                  {pr.isDraft && (
                    <span className="rounded-full border border-gh-border bg-gh-border/50 px-1.5 py-0 text-[10px] text-gh-fg-muted">
                      Draft
                    </span>
                  )}
                  {pr.labels.map((label) => (
                    <span
                      key={label}
                      className={`inline-flex cursor-pointer items-center rounded-full border px-1.5 py-0 text-[10px] hover:opacity-80 ${getLabelStyle(label)}`}
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
        filterFn: 'includesString',
        enableColumnFilter: true,
        cell: ({ row }) => {
          const pr = row.original
          return (
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
          )
        },
      },
      {
        id: 'openedAt',
        accessorKey: 'openedAt',
        header: 'Opened',
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
        id: 'checksStatus',
        accessorKey: 'checksStatus',
        header: 'Checks',
        filterFn: 'includesString',
        enableColumnFilter: true,
        cell: ({ row }) => <StatusBadge kind="checksStatus" value={row.original.checksStatus} />,
      },
      {
        id: 'copilotReview',
        accessorKey: 'copilotReview',
        header: 'Copilot',
        filterFn: 'includesString',
        enableColumnFilter: true,
        cell: ({ row }) => <StatusBadge kind="copilotReview" value={row.original.copilotReview} />,
      },
      {
        id: 'mergeSafety',
        accessorKey: 'mergeSafety',
        header: 'Merge',
        filterFn: 'includesString',
        enableColumnFilter: true,
        cell: ({ row }) => <StatusBadge kind="mergeSafety" value={row.original.mergeSafety} />,
      },
      {
        id: 'pushesAfterOpen',
        accessorKey: 'pushesAfterOpen',
        header: 'Pushes',
        enableColumnFilter: false,
        cell: ({ row }) => {
          const pr = row.original
          return (
            <span
              className={`text-sm ${
                pr.pushesAfterOpen >= 3 ? 'font-medium text-gh-warning' : 'text-gh-fg-muted'
              }`}
            >
              {pr.pushesAfterOpen}
            </span>
          )
        },
      },
  ]

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
  const hasActiveFilters = !!(globalFilter || hasActiveColumnFilters || hideDrafts || hideCopilot || hideMine)

  const clearAllFilters = () => {
    setGlobalFilter('')
    setColumnFilters([])
    setHideDrafts(false)
    setHideCopilot(false)
    setHideMine(false)
    onFilterChange('all')
  }

  return (
    <section className="overflow-hidden rounded-lg border border-gh-border bg-gh-surface">
      {/* Toolbar: search, facets, refresh */}
      <div className="space-y-2 border-b border-gh-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search PRs by title, author, or #number…"
            aria-label="Search pull requests"
            className="flex-1 rounded-md border border-gh-border bg-gh-surface py-1.5 pl-3 pr-3 text-sm text-gh-fg-default placeholder-gh-fg-placeholder focus:border-gh-accent focus:outline-none"
          />
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="shrink-0 rounded-md border border-gh-border bg-gh-overlay px-3 py-1.5 text-sm text-gh-fg-default hover:border-gh-border-hover"
              title="Refresh data (clears cache)"
            >
              ↻ Refresh
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer select-none items-center gap-1.5 rounded-md border border-gh-border px-2 py-1.5 text-xs text-gh-fg-muted hover:border-gh-border-hover">
            <input
              type="checkbox"
              checked={hideDrafts}
              onChange={() => setHideDrafts(!hideDrafts)}
              className="accent-gh-accent"
            />
            Hide drafts
          </label>

          <label className="flex cursor-pointer select-none items-center gap-1.5 rounded-md border border-gh-border px-2 py-1.5 text-xs text-gh-fg-muted hover:border-gh-border-hover">
            <input
              type="checkbox"
              checked={hideCopilot}
              onChange={() => setHideCopilot(!hideCopilot)}
              className="accent-gh-accent"
            />
            Hide Copilot
          </label>

          {currentUser && (
            <label className="flex cursor-pointer select-none items-center gap-1.5 rounded-md border border-gh-border px-2 py-1.5 text-xs text-gh-fg-muted hover:border-gh-border-hover">
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
            <span className="text-xs text-gh-fg-muted">
              Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}

          {(hasActiveFilters || filter !== 'all') && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="ml-auto rounded-md border border-gh-border px-2 py-1 text-xs text-gh-fg-muted hover:border-gh-border-hover hover:text-gh-fg-default"
            >
              ✕ Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Status filter buttons */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gh-border px-3 py-2">
        <span className="text-xs font-medium text-gh-fg-muted">Status:</span>
        {filterLabels.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => onFilterChange(value)}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              filter === value
                ? 'bg-gh-accent text-white'
                : 'bg-gh-border/50 text-gh-fg-muted hover:text-gh-fg-default'
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
        <div className="px-4 py-12 text-center text-sm text-gh-fg-muted">
          Loading pull requests…
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
            <thead className="bg-gh-surface text-xs uppercase tracking-wide text-gh-fg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort()
                    const sorted = header.column.getIsSorted()
                    const sortIcon = sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : '↕'
                    const isLast = header.column.id === 'pushesAfterOpen'
                    return (
                      <th
                        key={header.id}
                        className={`px-3 py-2 ${isLast ? 'text-right' : ''}`}
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
                  return (
                    <tr
                      key={row.id}
                      className={`border-t border-gh-border ${
                        pr.needsYourReview ? 'bg-gh-warning/5' : ''
                      }`}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const isLast = cell.column.id === 'pushesAfterOpen'
                        return (
                          <td
                            key={cell.id}
                            className={`px-3 py-3 ${isLast ? 'text-right' : ''}`}
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

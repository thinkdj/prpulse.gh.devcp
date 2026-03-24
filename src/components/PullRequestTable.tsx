import { useMemo, useState } from 'react'
import type { PullRequest, DashboardFilter } from '../types'
import { relativeTime } from '../utils'
import StatusBadge from './StatusBadge'

type SortField = 'opened' | 'updated' | 'author' | 'pushes' | 'title'
type SortDirection = 'asc' | 'desc'

type PullRequestTableProps = {
  pullRequests: PullRequest[]
  filter: DashboardFilter
  onFilterChange: (filter: DashboardFilter) => void
  isLoading: boolean
  hasToken: boolean
  hasSelectedRepos: boolean
}

const filterLabels: { value: DashboardFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'safe', label: 'Safe to merge' },
  { value: 'blocked', label: 'Blocked' },
]

const labelColorMap: Record<string, string> = {
  bug: 'border-[#f85149]/60 text-[#f85149]',
  urgent: 'border-[#d29922]/60 text-[#d29922]',
  critical: 'border-[#f85149]/60 text-[#f85149]',
  enhancement: 'border-[#1f6feb]/60 text-[#58a6ff]',
  feature: 'border-[#1f6feb]/60 text-[#58a6ff]',
  documentation: 'border-[#a371f7]/60 text-[#a371f7]',
  docs: 'border-[#a371f7]/60 text-[#a371f7]',
  chore: 'border-[#8b949e]/40 text-[#8b949e]',
  dependencies: 'border-[#3fb950]/60 text-[#3fb950]',
}

function getLabelStyle(label: string): string {
  return labelColorMap[label.toLowerCase()] ?? 'border-[#30363d] text-[#8b949e]'
}

function ageColor(dateString: string): string {
  const ms = Date.now() - new Date(dateString).getTime()
  const days = ms / (1000 * 60 * 60 * 24)
  if (days > 14) return 'text-[#f85149]'
  if (days > 7) return 'text-[#d29922]'
  return 'text-[#8b949e]'
}

const selectStyle =
  'rounded-md border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-xs text-[#c9d1d9] focus:border-[#1f6feb] focus:outline-none cursor-pointer'

export default function PullRequestTable({
  pullRequests,
  filter,
  onFilterChange,
  isLoading,
  hasToken,
  hasSelectedRepos,
}: PullRequestTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [authorFilter, setAuthorFilter] = useState('')
  const [repoFilter, setRepoFilter] = useState('')
  const [labelFilter, setLabelFilter] = useState('')
  const [hideDrafts, setHideDrafts] = useState(false)
  const [sortField, setSortField] = useState<SortField>('opened')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const uniqueAuthors = useMemo(
    () => Array.from(new Set(pullRequests.map((pr) => pr.author))).sort(),
    [pullRequests],
  )
  const uniqueRepos = useMemo(
    () => Array.from(new Set(pullRequests.map((pr) => pr.repo))).sort(),
    [pullRequests],
  )
  const uniqueLabels = useMemo(
    () => Array.from(new Set(pullRequests.flatMap((pr) => pr.labels))).filter(Boolean).sort(),
    [pullRequests],
  )

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection(field === 'title' || field === 'author' ? 'asc' : 'desc')
    }
  }

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return '↕'
    return sortDirection === 'asc' ? '▲' : '▼'
  }

  const filtered = useMemo(() => {
    let result = pullRequests

    if (filter === 'needs_review') result = result.filter((pr) => pr.needsYourReview)
    else if (filter === 'safe') result = result.filter((pr) => pr.mergeSafety === 'safe')
    else if (filter === 'blocked') result = result.filter((pr) => pr.mergeSafety === 'blocked')

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (pr) =>
          pr.title.toLowerCase().includes(q) ||
          `#${pr.id}`.includes(q) ||
          pr.author.toLowerCase().includes(q) ||
          pr.repo.toLowerCase().includes(q),
      )
    }

    if (authorFilter) result = result.filter((pr) => pr.author === authorFilter)
    if (repoFilter) result = result.filter((pr) => pr.repo === repoFilter)
    if (labelFilter) result = result.filter((pr) => pr.labels.includes(labelFilter))
    if (hideDrafts) result = result.filter((pr) => !pr.isDraft)

    return [...result].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'opened':
          cmp = new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime()
          break
        case 'updated':
          cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          break
        case 'author':
          cmp = a.author.localeCompare(b.author)
          break
        case 'pushes':
          cmp = a.pushesAfterOpen - b.pushesAfterOpen
          break
        case 'title':
          cmp = a.title.localeCompare(b.title)
          break
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })
  }, [pullRequests, filter, searchQuery, authorFilter, repoFilter, labelFilter, hideDrafts, sortField, sortDirection])

  const hasActiveLocalFilters = !!(searchQuery || authorFilter || repoFilter || labelFilter || hideDrafts)

  const clearAllFilters = () => {
    setSearchQuery('')
    setAuthorFilter('')
    setRepoFilter('')
    setLabelFilter('')
    setHideDrafts(false)
    onFilterChange('all')
  }

  return (
    <section className="overflow-hidden rounded-md border border-[#30363d] bg-[#161b22]">
      {/* Search & facet filters */}
      <div className="space-y-2 border-b border-[#30363d] bg-[#0d1117] px-3 py-2.5">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search PRs by title, author, or #number…"
          aria-label="Search pull requests"
          className="w-full rounded-md border border-[#30363d] bg-[#161b22] py-1.5 pl-3 pr-3 text-sm text-[#c9d1d9] placeholder-[#484f58] focus:border-[#1f6feb] focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={authorFilter}
            onChange={(e) => setAuthorFilter(e.target.value)}
            aria-label="Filter by author"
            className={selectStyle}
          >
            <option value="">All authors ({uniqueAuthors.length})</option>
            {uniqueAuthors.map((author) => (
              <option key={author} value={author}>
                {author}
              </option>
            ))}
          </select>

          {uniqueRepos.length > 1 && (
            <select
              value={repoFilter}
              onChange={(e) => setRepoFilter(e.target.value)}
              aria-label="Filter by repository"
              className={selectStyle}
            >
              <option value="">All repos ({uniqueRepos.length})</option>
              {uniqueRepos.map((repo) => (
                <option key={repo} value={repo}>
                  {repo}
                </option>
              ))}
            </select>
          )}

          {uniqueLabels.length > 0 && (
            <select
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.target.value)}
              aria-label="Filter by label"
              className={selectStyle}
            >
              <option value="">All labels ({uniqueLabels.length})</option>
              {uniqueLabels.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          )}

          <label className="flex cursor-pointer select-none items-center gap-1.5 rounded-md border border-[#30363d] px-2 py-1.5 text-xs text-[#8b949e] hover:border-[#484f58]">
            <input
              type="checkbox"
              checked={hideDrafts}
              onChange={() => setHideDrafts(!hideDrafts)}
              className="accent-[#1f6feb]"
            />
            Hide drafts
          </label>

          {(hasActiveLocalFilters || filter !== 'all') && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="ml-auto rounded-md border border-[#30363d] px-2 py-1 text-xs text-[#8b949e] hover:border-[#484f58] hover:text-[#c9d1d9]"
            >
              ✕ Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Status filter buttons */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#30363d] px-3 py-2">
        <span className="text-xs font-medium text-[#8b949e]">Status:</span>
        {filterLabels.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => onFilterChange(value)}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              filter === value
                ? 'bg-[#1f6feb] text-white'
                : 'bg-[#30363d]/50 text-[#8b949e] hover:text-[#c9d1d9]'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-[#8b949e]">
          {filtered.length} {filtered.length === 1 ? 'PR' : 'PRs'}
        </span>
      </div>

      {isLoading ? (
        <div className="px-4 py-12 text-center text-sm text-[#8b949e]">
          Loading pull requests…
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-[#8b949e]">
          {!hasToken
            ? 'Add a GitHub token in settings to fetch live data.'
            : !hasSelectedRepos
              ? 'Select a repository above to view pull requests.'
              : pullRequests.length === 0
                ? 'No open pull requests found.'
                : 'No PRs match the current filters.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm" data-testid="pr-table">
            <thead className="bg-[#0d1117] text-xs uppercase tracking-wide text-[#8b949e]">
              <tr>
                <th
                  className="cursor-pointer px-3 py-2 select-none hover:text-[#c9d1d9]"
                  onClick={() => handleSort('title')}
                >
                  PR <span className="text-[10px] opacity-60">{sortIcon('title')}</span>
                </th>
                <th
                  className="cursor-pointer px-3 py-2 select-none hover:text-[#c9d1d9]"
                  onClick={() => handleSort('author')}
                >
                  Author <span className="text-[10px] opacity-60">{sortIcon('author')}</span>
                </th>
                <th
                  className="cursor-pointer px-3 py-2 select-none hover:text-[#c9d1d9]"
                  onClick={() => handleSort('opened')}
                >
                  Opened <span className="text-[10px] opacity-60">{sortIcon('opened')}</span>
                </th>
                <th className="px-3 py-2">Checks</th>
                <th className="px-3 py-2">Copilot</th>
                <th className="px-3 py-2">Merge</th>
                <th
                  className="cursor-pointer px-3 py-2 text-right select-none hover:text-[#c9d1d9]"
                  onClick={() => handleSort('pushes')}
                >
                  Pushes <span className="text-[10px] opacity-60">{sortIcon('pushes')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pr) => (
                <tr
                  key={`${pr.repo}#${pr.id}`}
                  className={`border-t border-[#30363d] ${
                    pr.needsYourReview ? 'bg-[#d29922]/5' : ''
                  }`}
                >
                  <td className="px-3 py-3">
                    <div className="flex items-start gap-2">
                      {pr.needsYourReview && (
                        <span
                          className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-[#d29922]"
                          title="Needs your review"
                        />
                      )}
                      <div className="min-w-0">
                        <a
                          href={pr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[#58a6ff] hover:underline"
                        >
                          #{pr.id} {pr.title}
                        </a>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-[#8b949e]">{pr.repo}</span>
                          {pr.isDraft && (
                            <span className="rounded-full border border-[#30363d] bg-[#30363d]/50 px-1.5 py-0 text-[10px] text-[#8b949e]">
                              Draft
                            </span>
                          )}
                          {pr.labels.map((label) => (
                            <span
                              key={label}
                              className={`inline-flex cursor-pointer items-center rounded-full border px-1.5 py-0 text-[10px] hover:opacity-80 ${getLabelStyle(label)}`}
                              title={`Filter by label: ${label}`}
                              onClick={() => setLabelFilter(label)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') setLabelFilter(label)
                              }}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      {pr.authorAvatar && (
                        <img
                          src={pr.authorAvatar}
                          alt=""
                          className="h-5 w-5 rounded-full"
                        />
                      )}
                      <span
                        className="cursor-pointer text-[#c9d1d9] hover:text-[#58a6ff]"
                        title={`Filter by author: ${pr.author}`}
                        onClick={() => setAuthorFilter(pr.author)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') setAuthorFilter(pr.author)
                        }}
                      >
                        {pr.author}
                      </span>
                    </div>
                  </td>
                  <td
                    className={`px-3 py-3 ${ageColor(pr.openedAt)}`}
                    title={new Date(pr.openedAt).toLocaleString()}
                  >
                    {relativeTime(pr.openedAt)}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge kind="checksStatus" value={pr.checksStatus} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge kind="copilotReview" value={pr.copilotReview} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge kind="mergeSafety" value={pr.mergeSafety} />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span
                      className={`text-sm ${
                        pr.pushesAfterOpen >= 3 ? 'font-medium text-[#d29922]' : 'text-[#8b949e]'
                      }`}
                    >
                      {pr.pushesAfterOpen}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

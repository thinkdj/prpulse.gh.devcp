import type { PullRequest, DashboardFilter } from '../types'
import { relativeTime } from '../utils'
import StatusBadge from './StatusBadge'

type PullRequestTableProps = {
  pullRequests: PullRequest[]
  filter: DashboardFilter
  onFilterChange: (filter: DashboardFilter) => void
  isLoading: boolean
  hasToken: boolean
}

const filterLabels: { value: DashboardFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'safe', label: 'Safe to merge' },
  { value: 'blocked', label: 'Blocked' },
]

export default function PullRequestTable({
  pullRequests,
  filter,
  onFilterChange,
  isLoading,
  hasToken,
}: PullRequestTableProps) {
  const filtered = pullRequests.filter((pr) => {
    if (filter === 'needs_review') return pr.needsYourReview
    if (filter === 'safe') return pr.mergeSafety === 'safe'
    if (filter === 'blocked') return pr.mergeSafety === 'blocked'
    return true
  })

  return (
    <section className="overflow-hidden rounded-md border border-[#30363d] bg-[#161b22]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#30363d] bg-[#0d1117] px-3 py-2">
        <span className="text-xs font-medium text-[#8b949e]">Filter:</span>
        {filterLabels.map(({ value, label }) => (
          <button
            key={value}
            type="button"
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
            : pullRequests.length === 0
              ? 'No open pull requests found.'
              : 'No PRs match the current filter.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm" data-testid="pr-table">
            <thead className="bg-[#0d1117] text-xs uppercase tracking-wide text-[#8b949e]">
              <tr>
                <th className="px-3 py-2">PR</th>
                <th className="px-3 py-2">Author</th>
                <th className="px-3 py-2">Opened</th>
                <th className="px-3 py-2">Checks</th>
                <th className="px-3 py-2">Copilot</th>
                <th className="px-3 py-2">Merge</th>
                <th className="px-3 py-2 text-right">Pushes</th>
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
                        <p className="text-xs text-[#8b949e]">
                          {pr.repo}
                          {pr.isDraft && (
                            <span className="ml-1.5 rounded-full border border-[#30363d] bg-[#30363d]/50 px-1.5 py-0.5 text-[10px] text-[#8b949e]">
                              Draft
                            </span>
                          )}
                        </p>
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
                      <span className="text-[#c9d1d9]">{pr.author}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[#8b949e]" title={new Date(pr.openedAt).toLocaleString()}>
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

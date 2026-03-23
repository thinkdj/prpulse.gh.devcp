import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'

type CopilotReview = 'approved' | 'changes_requested' | 'not_run'
type MergeSafety = 'safe' | 'blocked' | 'pending'

type PullRequest = {
  id: number
  repo: string
  title: string
  author: string
  openedAt: string
  pushesAfterOpen: number
  checksStatus: 'passing' | 'failing' | 'pending'
  copilotReview: CopilotReview
  mergeSafety: MergeSafety
  needsYourReview: boolean
}

type RepoState = {
  repos: string[]
  selectedRepos: string[]
}

const STORAGE_KEY = 'gh.devcp.dashboard.repositories'

const seedPullRequests: PullRequest[] = [
  {
    id: 1021,
    repo: 'thinkdj/gh.devcp',
    title: 'feat: dashboard widgets for PR supervision',
    author: 'priya-dev',
    openedAt: '2026-03-18T11:22:00Z',
    pushesAfterOpen: 4,
    checksStatus: 'passing',
    copilotReview: 'approved',
    mergeSafety: 'safe',
    needsYourReview: false,
  },
  {
    id: 1015,
    repo: 'thinkdj/internal-tools',
    title: 'fix: audit export race condition',
    author: 'kevin-ops',
    openedAt: '2026-03-20T07:10:00Z',
    pushesAfterOpen: 2,
    checksStatus: 'failing',
    copilotReview: 'changes_requested',
    mergeSafety: 'blocked',
    needsYourReview: true,
  },
  {
    id: 998,
    repo: 'thinkdj/website',
    title: 'chore: migrate issue templates',
    author: 'nora-web',
    openedAt: '2026-03-16T10:00:00Z',
    pushesAfterOpen: 1,
    checksStatus: 'passing',
    copilotReview: 'not_run',
    mergeSafety: 'pending',
    needsYourReview: true,
  },
  {
    id: 1004,
    repo: 'thinkdj/internal-tools',
    title: 'feat: add retry policy for webhooks',
    author: 'anil-backend',
    openedAt: '2026-03-17T14:10:00Z',
    pushesAfterOpen: 5,
    checksStatus: 'passing',
    copilotReview: 'approved',
    mergeSafety: 'safe',
    needsYourReview: false,
  },
  {
    id: 1028,
    repo: 'thinkdj/gh.devcp',
    title: 'refactor: simplify repo selector state',
    author: 'lee-ui',
    openedAt: '2026-03-22T09:55:00Z',
    pushesAfterOpen: 0,
    checksStatus: 'pending',
    copilotReview: 'not_run',
    mergeSafety: 'pending',
    needsYourReview: true,
  },
]

const practicalRequirements = [
  'See all PRs for selected repositories in one dashboard.',
  'Track who opened each PR and when it was opened.',
  'Check Copilot review state and CI/check status quickly.',
  'Know merge safety at a glance (safe, pending, blocked).',
  'Track pushes after opening to spot re-review candidates.',
  'Persist selected repositories locally for quick revisit.',
]

const greatToHaveFeatures = [
  'Daily digest mode that highlights new blockers since yesterday.',
  'Auto-priority queue that ranks PRs by age, risk, and ownership.',
  'SLA watchlist widget that flags PRs close to team response targets.',
]

const formatReview = (value: CopilotReview) =>
  ({
    approved: 'Approved',
    changes_requested: 'Changes requested',
    not_run: 'Not run',
  })[value]

const formatSafety = (value: MergeSafety) =>
  ({
    safe: 'Safe',
    blocked: 'Blocked',
    pending: 'Pending',
  })[value]

const formatChecks = (value: PullRequest['checksStatus']) =>
  ({
    passing: 'Passing',
    failing: 'Failing',
    pending: 'Pending',
  })[value]

const loadRepoState = (): RepoState => {
  const defaultRepos = Array.from(new Set(seedPullRequests.map((pr) => pr.repo)))
  const raw = localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return { repos: defaultRepos, selectedRepos: defaultRepos }
  }

  try {
    const parsed = JSON.parse(raw) as RepoState
    if (
      Array.isArray(parsed.repos) &&
      Array.isArray(parsed.selectedRepos) &&
      parsed.repos.length > 0
    ) {
      return {
        repos: parsed.repos,
        selectedRepos: parsed.selectedRepos.filter((repo) => parsed.repos.includes(repo)),
      }
    }
  } catch {
    return { repos: defaultRepos, selectedRepos: defaultRepos }
  }

  return { repos: defaultRepos, selectedRepos: defaultRepos }
}

const saveRepoState = (state: RepoState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const fetchDashboardPullRequests = async (): Promise<PullRequest[]> => seedPullRequests

function App() {
  const [initialRepoState] = useState<RepoState>(() => loadRepoState())
  const [repos, setRepos] = useState<string[]>(initialRepoState.repos)
  const [selectedRepos, setSelectedRepos] = useState<string[]>(initialRepoState.selectedRepos)
  const [newRepo, setNewRepo] = useState('')

  const { data: pullRequests = [] } = useQuery({
    queryKey: ['pull-requests'],
    queryFn: fetchDashboardPullRequests,
  })

  useEffect(() => {
    if (repos.length > 0) {
      saveRepoState({ repos, selectedRepos })
    }
  }, [repos, selectedRepos])

  const visiblePrs = useMemo(
    () => pullRequests.filter((pr) => selectedRepos.includes(pr.repo)),
    [pullRequests, selectedRepos],
  )

  const summary = useMemo(
    () => ({
      total: visiblePrs.length,
      needsReview: visiblePrs.filter((pr) => pr.needsYourReview).length,
      safeToMerge: visiblePrs.filter((pr) => pr.mergeSafety === 'safe').length,
      blocked: visiblePrs.filter((pr) => pr.mergeSafety === 'blocked').length,
    }),
    [visiblePrs],
  )

  const toggleRepo = (repo: string) => {
    setSelectedRepos((current) =>
      current.includes(repo) ? current.filter((item) => item !== repo) : [...current, repo],
    )
  }

  const addRepo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = newRepo.trim()
    if (!normalized || repos.includes(normalized)) {
      return
    }

    setRepos((current) => [...current, normalized])
    setSelectedRepos((current) => [...current, normalized])
    setNewRepo('')
  }

  return (
    <main className="min-h-screen bg-[#0d1117] text-[#c9d1d9]">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <header className="mb-6 rounded-md border border-[#30363d] bg-[#161b22] p-5">
          <h1 className="text-2xl font-semibold text-[#f0f6fc]">GitHub Dev Control Panel</h1>
          <p className="mt-2 text-sm text-[#8b949e]">
            Bird&apos;s-eye dashboard for pull requests across your selected repositories.
          </p>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="summary widgets">
          <article className="rounded-md border border-[#30363d] bg-[#161b22] p-4">
            <p className="text-xs text-[#8b949e]">Visible PRs</p>
            <p className="mt-2 text-2xl font-semibold text-[#f0f6fc]" data-testid="summary-total">
              {summary.total}
            </p>
          </article>
          <article className="rounded-md border border-[#30363d] bg-[#161b22] p-4">
            <p className="text-xs text-[#8b949e]">Need your review</p>
            <p className="mt-2 text-2xl font-semibold text-[#f0f6fc]">{summary.needsReview}</p>
          </article>
          <article className="rounded-md border border-[#30363d] bg-[#161b22] p-4">
            <p className="text-xs text-[#8b949e]">Safe to merge</p>
            <p className="mt-2 text-2xl font-semibold text-[#3fb950]">{summary.safeToMerge}</p>
          </article>
          <article className="rounded-md border border-[#30363d] bg-[#161b22] p-4">
            <p className="text-xs text-[#8b949e]">Blocked</p>
            <p className="mt-2 text-2xl font-semibold text-[#f85149]">{summary.blocked}</p>
          </article>
        </section>

        <section className="mb-6 rounded-md border border-[#30363d] bg-[#161b22] p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-sm font-medium text-[#f0f6fc]">Selectable repositories</h2>
            <form onSubmit={addRepo} className="flex gap-2">
              <input
                aria-label="Add repository"
                value={newRepo}
                onChange={(event) => setNewRepo(event.target.value)}
                placeholder="owner/repo"
                className="rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm text-[#c9d1d9] outline-none focus:border-[#1f6feb]"
              />
              <button
                type="submit"
                className="rounded-md border border-[#1f6feb] bg-[#1f6feb] px-3 py-1.5 text-sm font-medium text-white"
              >
                Add
              </button>
            </form>
          </div>

          <ul className="flex flex-wrap gap-2">
            {repos.map((repo) => {
              const active = selectedRepos.includes(repo)
              return (
                <li key={repo}>
                  <button
                    type="button"
                    onClick={() => toggleRepo(repo)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      active
                        ? 'border-[#1f6feb] bg-[#1f6feb]/15 text-[#58a6ff]'
                        : 'border-[#30363d] bg-[#0d1117] text-[#8b949e]'
                    }`}
                  >
                    {repo}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="overflow-hidden rounded-md border border-[#30363d] bg-[#161b22]">
          <table className="w-full border-collapse text-left text-sm" data-testid="pr-table">
            <thead className="bg-[#0d1117] text-xs uppercase tracking-wide text-[#8b949e]">
              <tr>
                <th className="px-3 py-2">PR</th>
                <th className="px-3 py-2">Author</th>
                <th className="px-3 py-2">Opened</th>
                <th className="px-3 py-2">Copilot review</th>
                <th className="px-3 py-2">Safety</th>
                <th className="px-3 py-2">Checks</th>
                <th className="px-3 py-2">Pushes after open</th>
              </tr>
            </thead>
            <tbody>
              {visiblePrs.map((pr) => (
                <tr key={pr.id} className="border-t border-[#30363d]">
                  <td className="px-3 py-3">
                    <p className="font-medium text-[#f0f6fc]">#{pr.id} {pr.title}</p>
                    <p className="text-xs text-[#8b949e]">{pr.repo}</p>
                  </td>
                  <td className="px-3 py-3 text-[#c9d1d9]">{pr.author}</td>
                  <td className="px-3 py-3 text-[#c9d1d9]">{new Date(pr.openedAt).toLocaleDateString()}</td>
                  <td className="px-3 py-3 text-[#c9d1d9]">{formatReview(pr.copilotReview)}</td>
                  <td className="px-3 py-3 text-[#c9d1d9]">{formatSafety(pr.mergeSafety)}</td>
                  <td className="px-3 py-3 text-[#c9d1d9]">{formatChecks(pr.checksStatus)}</td>
                  <td className="px-3 py-3 text-[#c9d1d9]">{pr.pushesAfterOpen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-md border border-[#30363d] bg-[#161b22] p-4">
            <h2 className="text-sm font-semibold text-[#f0f6fc]">Practical requirements checklist</h2>
            <ul className="mt-3 space-y-2 text-sm text-[#c9d1d9]">
              {practicalRequirements.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-[3px] text-[#3fb950]">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-md border border-[#30363d] bg-[#161b22] p-4">
            <h2 className="text-sm font-semibold text-[#f0f6fc]">3 great-to-have additions</h2>
            <ul className="mt-3 space-y-2 text-sm text-[#c9d1d9]">
              {greatToHaveFeatures.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-[3px] text-[#58a6ff]">★</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        </section>
      </div>
    </main>
  )
}

export default App

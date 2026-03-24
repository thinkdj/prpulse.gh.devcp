import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { DashboardFilter, PullRequest, RepoState } from './types'
import { loadRepoState, loadToken, saveRepoState, saveToken } from './storage'
import { fetchCurrentUser, fetchRepoPullRequests } from './github-api'
import { seedPullRequests, defaultRepoNames } from './seed-data'
import SummaryWidgets from './components/SummaryWidgets'
import RepoSelector from './components/RepoSelector'
import PullRequestTable from './components/PullRequestTable'
import TokenSettings from './components/TokenSettings'

function App() {
  const queryClient = useQueryClient()

  const [token, setToken] = useState(() => loadToken())
  const [showSettings, setShowSettings] = useState(false)
  const [filter, setFilter] = useState<DashboardFilter>('all')

  const [initialRepoState] = useState<RepoState>(() => loadRepoState(defaultRepoNames))
  const [repos, setRepos] = useState<string[]>(initialRepoState.repos)
  const [selectedRepos, setSelectedRepos] = useState<string[]>(initialRepoState.selectedRepos)
  const [newRepo, setNewRepo] = useState('')
  const [repoError, setRepoError] = useState('')

  const { data: currentUser = '' } = useQuery({
    queryKey: ['current-user', token],
    queryFn: () => fetchCurrentUser(token),
    enabled: !!token,
    staleTime: Infinity,
    retry: false,
  })

  const fetchAllPRs = useCallback(async (): Promise<PullRequest[]> => {
    if (!token || selectedRepos.length === 0) return seedPullRequests

    const results = await Promise.allSettled(
      selectedRepos.map((repo) => fetchRepoPullRequests(repo, token, currentUser)),
    )

    const allPrs = results
      .filter((r): r is PromiseFulfilledResult<PullRequest[]> => r.status === 'fulfilled')
      .flatMap((r) => r.value)

    if (allPrs.length === 0) {
      const firstError = results.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      )
      if (firstError) {
        throw firstError.reason instanceof Error
          ? firstError.reason
          : new Error('Failed to fetch pull requests.')
      }
    }

    return allPrs
  }, [token, selectedRepos, currentUser])

  const {
    data: pullRequests = [],
    isLoading,
    error,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['pull-requests', token, selectedRepos, currentUser],
    queryFn: fetchAllPRs,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
    enabled: !token || !!currentUser,
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

  const removeRepo = (repo: string) => {
    setRepos((current) => current.filter((item) => item !== repo))
    setSelectedRepos((current) => current.filter((item) => item !== repo))
  }

  const addRepo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = newRepo.trim()
    if (!normalized || repos.includes(normalized)) {
      setRepoError('')
      return
    }
    const parts = normalized.split('/')
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      setRepoError('Use owner/repo format')
      return
    }

    setRepoError('')
    setRepos((current) => [...current, normalized])
    setSelectedRepos((current) => [...current, normalized])
    setNewRepo('')
  }

  const handleSaveToken = (newToken: string) => {
    saveToken(newToken)
    setToken(newToken)
    void queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
  }

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
  }

  return (
    <main className="min-h-screen bg-[#0d1117] text-[#c9d1d9]">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <header className="mb-6 rounded-md border border-[#30363d] bg-[#161b22] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-[#f0f6fc]">GitHub Dev Control Panel</h1>
              <p className="mt-1 text-sm text-[#8b949e]">
                Bird&apos;s-eye view of pull requests across your repositories.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {dataUpdatedAt > 0 && (
                <span className="text-xs text-[#8b949e]">
                  Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
                </span>
              )}
              <button
                type="button"
                onClick={handleRefresh}
                className="rounded-md border border-[#30363d] bg-[#21262d] px-3 py-1.5 text-sm text-[#c9d1d9] hover:border-[#8b949e]"
                title="Refresh data"
              >
                ↻ Refresh
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  token
                    ? 'border-[#238636]/40 bg-[#238636]/10 text-[#3fb950]'
                    : 'border-[#d29922]/40 bg-[#d29922]/10 text-[#d29922]'
                }`}
              >
                {token ? '⚙ Connected' : '⚙ Set token'}
              </button>
            </div>
          </div>
        </header>

        <TokenSettings
          token={token}
          onSaveToken={handleSaveToken}
          currentUser={currentUser}
          isVisible={showSettings}
          onClose={() => setShowSettings(false)}
        />

        {error && (
          <div className="mb-6 rounded-md border border-[#da3633]/40 bg-[#da3633]/10 px-4 py-3 text-sm text-[#f85149]">
            {error instanceof Error ? error.message : 'Failed to fetch pull requests.'}
          </div>
        )}

        <SummaryWidgets
          total={summary.total}
          needsReview={summary.needsReview}
          safeToMerge={summary.safeToMerge}
          blocked={summary.blocked}
        />

        <RepoSelector
          repos={repos}
          selectedRepos={selectedRepos}
          newRepo={newRepo}
          repoError={repoError}
          onNewRepoChange={(v) => { setNewRepo(v); setRepoError('') }}
          onAddRepo={addRepo}
          onToggleRepo={toggleRepo}
          onRemoveRepo={removeRepo}
        />

        <PullRequestTable
          pullRequests={visiblePrs}
          filter={filter}
          onFilterChange={setFilter}
          isLoading={isLoading}
          hasToken={!!token}
        />

        {!token && (
          <p className="mt-4 text-center text-xs text-[#8b949e]">
            Showing demo data. Add a GitHub token in settings to see live PR data.
          </p>
        )}
      </div>
    </main>
  )
}

export default App

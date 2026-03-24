import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { DashboardFilter, PullRequest, RepoState } from './types'
import { loadRepoState, loadToken, loadTheme, saveRepoState, saveToken, saveTheme } from './storage'
import type { Theme } from './storage'
import { fetchCurrentUser, fetchRepoPullRequests, fetchUserRepos } from './github-api'
import SummaryWidgets from './components/SummaryWidgets'
import RepoSelector from './components/RepoSelector'
import PullRequestTable from './components/PullRequestTable'
import TokenSettings from './components/TokenSettings'
import RepoPickerModal from './components/RepoPickerModal'

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('light', theme === 'light')
}

function App() {
  const queryClient = useQueryClient()

  const [token, setToken] = useState(() => loadToken())
  const [showSettings, setShowSettings] = useState(false)
  const [showRepoPicker, setShowRepoPicker] = useState(false)
  const [filter, setFilter] = useState<DashboardFilter>('all')
  const [theme, setTheme] = useState<Theme>(() => {
    const t = loadTheme()
    applyTheme(t)
    return t
  })

  const [initialRepoState] = useState<RepoState>(() => loadRepoState([]))
  const [repos, setRepos] = useState<string[]>(initialRepoState.repos)
  const [selectedRepos, setSelectedRepos] = useState<string[]>(initialRepoState.selectedRepos)
  const [newRepo, setNewRepo] = useState('')
  const [repoError, setRepoError] = useState('')

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    saveTheme(next)
    applyTheme(next)
  }

  const { data: currentUser = '' } = useQuery({
    queryKey: ['current-user', token],
    queryFn: () => fetchCurrentUser(token),
    enabled: !!token,
    staleTime: Infinity,
    retry: false,
  })

  const { data: userRepos = [], isLoading: reposLoading } = useQuery({
    queryKey: ['user-repos', token],
    queryFn: () => fetchUserRepos(token),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const fetchAllPRs = useCallback(async (): Promise<PullRequest[]> => {
    if (!token || selectedRepos.length === 0) return []

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
    enabled: !!token && !!currentUser && selectedRepos.length > 0,
  })

  useEffect(() => {
    saveRepoState({ repos, selectedRepos })
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
    void queryClient.invalidateQueries({ queryKey: ['user-repos'] })
  }

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
  }

  const handleNewRepoChange = useCallback((v: string) => {
    setNewRepo(v)
    setRepoError('')
  }, [])

  const handleRepoPickerSave = (selected: string[]) => {
    const newRepoSet = new Set([...repos, ...selected])
    const removedRepos = repos.filter((r) => !selected.includes(r))
    removedRepos.forEach((r) => newRepoSet.delete(r))
    const finalRepos = Array.from(newRepoSet)
    setRepos(finalRepos)
    setSelectedRepos(selected)
  }

  return (
    <main className="min-h-screen bg-gh-bg text-gh-fg-default">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <header className="mb-6 rounded-md border border-gh-border bg-gh-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-gh-fg">GitHub Dev Control Panel</h1>
              <p className="mt-1 text-sm text-gh-fg-muted">
                Bird&apos;s-eye view of pull requests across your repositories.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-md border border-gh-border bg-gh-overlay px-2.5 py-1.5 text-sm text-gh-fg-default hover:border-gh-border-hover"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
              {dataUpdatedAt > 0 && (
                <span className="text-xs text-gh-fg-muted">
                  Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
                </span>
              )}
              <button
                type="button"
                onClick={handleRefresh}
                className="rounded-md border border-gh-border bg-gh-overlay px-3 py-1.5 text-sm text-gh-fg-default hover:border-gh-border-hover"
                title="Refresh data"
              >
                ↻ Refresh
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  token
                    ? 'border-gh-success/40 bg-gh-success/10 text-gh-success-fg'
                    : 'border-gh-warning/40 bg-gh-warning/10 text-gh-warning'
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
          <div className="mb-6 rounded-md border border-gh-danger/40 bg-gh-danger/10 px-4 py-3 text-sm text-gh-danger-fg">
            {error instanceof Error ? error.message : 'Failed to fetch pull requests.'}
          </div>
        )}

        {!token ? (
          /* ── Empty state: no token configured ── */
          <section className="rounded-md border border-gh-border bg-gh-surface px-6 py-16 text-center" data-testid="welcome-state">
            <div className="mx-auto max-w-md">
              <div className="mb-4 text-5xl">📋</div>
              <h2 className="text-xl font-semibold text-gh-fg">Welcome to GitHub Dev CP</h2>
              <p className="mt-2 text-sm text-gh-fg-muted">
                Monitor pull requests across all your repositories at a glance.
              </p>
              <ul className="mx-auto mt-4 max-w-xs space-y-1.5 text-left text-sm text-gh-fg-muted">
                <li>✓ See PR status, reviews &amp; CI checks</li>
                <li>✓ Filter by author, label, status</li>
                <li>✓ Track draft PRs and push counts</li>
                <li>✓ Auto-refreshes every 5 minutes</li>
              </ul>
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="mt-6 rounded-md border border-gh-accent bg-gh-accent px-5 py-2 text-sm font-medium text-white"
              >
                🔑 Connect GitHub Token
              </button>
              <p className="mt-3 text-xs text-gh-fg-muted">
                Use a fine-grained PAT with read-only pull request access.
              </p>
            </div>
          </section>
        ) : (
          /* ── Authenticated dashboard ── */
          <>
            <SummaryWidgets
              total={summary.total}
              needsReview={summary.needsReview}
              safeToMerge={summary.safeToMerge}
              blocked={summary.blocked}
              activeFilter={filter}
              onFilterClick={setFilter}
            />

            <RepoSelector
              repos={repos}
              selectedRepos={selectedRepos}
              newRepo={newRepo}
              repoError={repoError}
              onNewRepoChange={handleNewRepoChange}
              onAddRepo={addRepo}
              onToggleRepo={toggleRepo}
              onRemoveRepo={removeRepo}
              onBrowseRepos={() => setShowRepoPicker(true)}
              hasToken={!!token}
            />

            <PullRequestTable
              pullRequests={visiblePrs}
              filter={filter}
              onFilterChange={setFilter}
              isLoading={isLoading}
              hasToken={!!token}
              hasSelectedRepos={selectedRepos.length > 0}
            />

            {showRepoPicker && (
              <RepoPickerModal
                availableRepos={userRepos}
                selectedRepos={repos}
                isLoading={reposLoading}
                onSave={handleRepoPickerSave}
                onClose={() => setShowRepoPicker(false)}
              />
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default App

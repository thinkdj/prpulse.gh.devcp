import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DashboardFilter, PullRequest, RepoState } from './types'
import { loadRepoState, loadToken, loadTheme, saveRepoState, saveToken, saveTheme } from './storage'
import type { Theme } from './storage'
import { clearApiCache, fetchCurrentUser, fetchRepoBranches, fetchRepoPullRequests, fetchUserRepos } from './github-api'
import SummaryWidgets from './components/SummaryWidgets'
import RepoSelector from './components/RepoSelector'
import PullRequestTable from './components/PullRequestTable'
import TokenSettings from './components/TokenSettings'
import RepoPickerModal from './components/RepoPickerModal'
import BranchAnalysisPanel from './components/BranchAnalysisPanel'
import PRDetailPanel from './components/PRDetailPanel'
import ActionRequiredPanel from './components/ActionRequiredPanel'

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('light', theme === 'light')
  document.documentElement.classList.toggle('github', theme === 'github')
}

function App() {
  const queryClient = useQueryClient()

  const [token, setToken] = useState(() => loadToken())
  const [showSettings, setShowSettings] = useState(false)
  const [showRepoPicker, setShowRepoPicker] = useState(false)
  const [activeView, setActiveView] = useState<'pull_requests' | 'branches' | 'my_actions'>('pull_requests')
  const [filter, setFilter] = useState<DashboardFilter>('all')
  const [theme, setTheme] = useState<Theme>(() => loadTheme())
  const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const [initialRepoState] = useState<RepoState>(() => loadRepoState([]))
  const [repos, setRepos] = useState<string[]>(initialRepoState.repos)
  const [selectedRepos, setSelectedRepos] = useState<string[]>(initialRepoState.selectedRepos)
  const [newRepo, setNewRepo] = useState('')
  const [repoError, setRepoError] = useState('')

  const toggleTheme = (next: Theme) => {
    setTheme(next)
    saveTheme(next)
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
    enabled: !!token && showRepoPicker,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const STALE_TIME = 3 * 60 * 1000 // 3 minutes – matches API cache TTL

  const repoQueries = useQueries({
    queries: selectedRepos.map((repo) => ({
      queryKey: ['repo-prs', token, repo, currentUser],
      queryFn: () => fetchRepoPullRequests(repo, token, currentUser),
      staleTime: STALE_TIME,
      refetchInterval: 5 * 60 * 1000,
      retry: 1,
      enabled: !!token && !!currentUser,
    })),
  })

  const branchQueries = useQueries({
    queries: selectedRepos.map((repo) => ({
      queryKey: ['repo-branches', token, repo],
      queryFn: () => fetchRepoBranches(repo, token),
      staleTime: STALE_TIME,
      refetchInterval: 10 * 60 * 1000,
      retry: 1,
      enabled: !!token && activeView === 'branches',
    })),
  })

  const prIsLoading = repoQueries.some((q) => q.isLoading)
  const prError = repoQueries.find((q) => q.error)?.error ?? null
  const prDataUpdatedAt = Math.max(0, ...repoQueries.map((q) => q.dataUpdatedAt))

  const pullRequests = repoQueries.flatMap((q) => q.data ?? [])
  const branches = branchQueries.flatMap((q) => q.data ?? [])
  const branchIsLoading = branchQueries.some((q) => q.isLoading)
  const branchError = branchQueries.find((q) => q.error)?.error ?? null
  const branchDataUpdatedAt = Math.max(0, ...branchQueries.map((q) => q.dataUpdatedAt))
  const isLoading = activeView === 'pull_requests' ? prIsLoading : branchIsLoading
  const error = activeView === 'pull_requests' ? prError : branchError
  const dataUpdatedAt = activeView === 'pull_requests' ? prDataUpdatedAt : branchDataUpdatedAt

  useEffect(() => {
    saveRepoState({ repos, selectedRepos })
  }, [repos, selectedRepos])

  const summary = useMemo(
    () => ({
      total: pullRequests.length,
      needsReview: pullRequests.filter((pr) => pr.needsYourReview).length,
      safeToMerge: pullRequests.filter((pr) => pr.mergeSafety === 'safe').length,
      blocked: pullRequests.filter((pr) => pr.mergeSafety === 'blocked').length,
    }),
    [pullRequests],
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
    clearApiCache()
    void queryClient.invalidateQueries({ queryKey: ['repo-prs'] })
    void queryClient.invalidateQueries({ queryKey: ['repo-branches'] })
    void queryClient.invalidateQueries({ queryKey: ['user-repos'] })
  }

  const handleRefresh = () => {
    clearApiCache()
    void queryClient.invalidateQueries({ queryKey: ['repo-prs'] })
    void queryClient.invalidateQueries({ queryKey: ['repo-branches'] })
  }

  const handleNewRepoChange = useCallback((v: string) => {
    setNewRepo(v)
    setRepoError('')
  }, [])

  const handleRepoPickerSave = (selected: string[]) => {
    const selectedSet = new Set(selected)
    setRepos(selected)
    setSelectedRepos((prev) => {
      const kept = prev.filter((repo) => selectedSet.has(repo))
      const newlyAdded = selected.filter((repo) => !repos.includes(repo))
      return [...kept, ...newlyAdded]
    })
  }

  return (
    <main className="min-h-screen bg-gh-bg text-gh-fg-default">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <header className="mb-6 rounded-lg border border-gh-border bg-gh-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gh-fg">GitHub Dev Control Panel</h1>
              <p className="mt-1 text-sm text-gh-fg-muted">
                Bird&apos;s-eye view of pull requests and branches across your repositories.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="theme-select" className="sr-only">Theme</label>
              <select
                id="theme-select"
                value={theme}
                onChange={(e) => toggleTheme(e.target.value as Theme)}
                aria-label="Theme"
                className="rounded-md border border-gh-border bg-gh-overlay px-2 py-1.5 text-xs text-gh-fg-default hover:border-gh-border-hover focus:outline-none focus:border-gh-accent"
              >
                <option value="dark">🌙 Dark</option>
                <option value="light">☀️ Light</option>
                <option value="github">🐙 GitHub</option>
              </select>
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
            {error instanceof Error
              ? error.message
              : activeView === 'pull_requests'
                ? 'Failed to fetch pull requests.'
                : 'Failed to fetch branch analysis.'}
          </div>
        )}

        {!token ? (
          /* ── Empty state: no token configured ── */
          <section className="rounded-lg border border-gh-border bg-gh-surface px-6 py-16 text-center" data-testid="welcome-state">
            <div className="mx-auto max-w-md">
              <div className="mb-4 text-5xl">📋</div>
              <h2 className="text-xl font-semibold tracking-tight text-gh-fg">Welcome to GitHub Dev CP</h2>
              <p className="mt-2 text-sm text-gh-fg-muted">
                Monitor pull requests across all your repositories at a glance.
              </p>
              <ul className="mx-auto mt-4 max-w-xs space-y-1.5 text-left text-sm text-gh-fg-muted">
                <li>✓ See PR status, reviews &amp; CI checks</li>
                <li>✓ Spot stale or fully merged branches</li>
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
            <section className="mb-6 flex flex-wrap gap-2" aria-label="dashboard views">
              <button
                type="button"
                onClick={() => setActiveView('pull_requests')}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  activeView === 'pull_requests'
                    ? 'border-gh-accent bg-gh-accent/10 text-gh-accent-fg'
                    : 'border-gh-border bg-gh-surface text-gh-fg-muted hover:border-gh-border-hover'
                }`}
              >
                Pull requests
              </button>
              <button
                type="button"
                onClick={() => setActiveView('branches')}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  activeView === 'branches'
                    ? 'border-gh-accent bg-gh-accent/10 text-gh-accent-fg'
                    : 'border-gh-border bg-gh-surface text-gh-fg-muted hover:border-gh-border-hover'
                }`}
              >
                Branch analysis
              </button>
              <button
                type="button"
                onClick={() => setActiveView('my_actions')}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  activeView === 'my_actions'
                    ? 'border-gh-accent bg-gh-accent/10 text-gh-accent-fg'
                    : 'border-gh-border bg-gh-surface text-gh-fg-muted hover:border-gh-border-hover'
                }`}
              >
                My actions
                {summary.needsReview > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gh-warning px-1 text-[10px] font-semibold text-white">
                    {summary.needsReview}
                  </span>
                )}
              </button>
            </section>

            {activeView === 'pull_requests' && (
              <SummaryWidgets
                total={summary.total}
                needsReview={summary.needsReview}
                safeToMerge={summary.safeToMerge}
                blocked={summary.blocked}
                activeFilter={filter}
                onFilterClick={setFilter}
              />
            )}

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
            />

            {activeView === 'pull_requests' ? (
              <PullRequestTable
                pullRequests={pullRequests}
                filter={filter}
                onFilterChange={setFilter}
                isLoading={isLoading}
                hasToken={!!token}
                hasSelectedRepos={selectedRepos.length > 0}
                currentUser={currentUser}
                onRefresh={handleRefresh}
                dataUpdatedAt={dataUpdatedAt}
                onPRSelect={setSelectedPR}
              />
            ) : activeView === 'branches' ? (
              <BranchAnalysisPanel
                branches={branches}
                isLoading={isLoading}
                hasSelectedRepos={selectedRepos.length > 0}
              />
            ) : (
              <ActionRequiredPanel
                pullRequests={pullRequests}
                currentUser={currentUser}
                hasSelectedRepos={selectedRepos.length > 0}
                onPRSelect={setSelectedPR}
              />
            )}

            {selectedPR && (
              <PRDetailPanel
                pr={selectedPR}
                token={token}
                currentUser={currentUser}
                onClose={() => setSelectedPR(null)}
              />
            )}

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

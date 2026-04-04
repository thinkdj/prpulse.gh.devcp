import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Settings,
  RefreshCw,
  Sun,
  Moon,
  Key,
  Clipboard,
  CheckCircle,
  GitBranch,
  Tag,
  GitPullRequest,
  Zap,
} from 'lucide-react'
import type { DashboardFilter, PullRequest, RepoState } from './types'
import { loadRepoState, loadToken, loadTheme, loadMode, saveRepoState, saveToken, saveTheme, saveMode } from './storage'
import type { Theme, Mode } from './storage'
import { clearApiCache, fetchCurrentUser, fetchRepoBranches, fetchRepoPullRequests, fetchUserRepos } from './github-api'
import SummaryWidgets from './components/SummaryWidgets'
import RepoSelector from './components/RepoSelector'
import PullRequestTable from './components/PullRequestTable'
import TokenSettings from './components/TokenSettings'
import RepoPickerModal from './components/RepoPickerModal'
import BranchAnalysisPanel from './components/BranchAnalysisPanel'
import PRDetailPanel from './components/PRDetailPanel'
import ActionRequiredPanel from './components/ActionRequiredPanel'
import ConfirmDialog from './components/ConfirmDialog'

function applyTheme(theme: Theme, mode: Mode) {
  document.documentElement.classList.remove('light', 'slate', 'ocean', 'ember')
  if (mode === 'light') document.documentElement.classList.add('light')
  if (theme === 'slate') document.documentElement.classList.add('slate')
  if (theme === 'ocean') document.documentElement.classList.add('ocean')
  if (theme === 'ember') document.documentElement.classList.add('ember')
}

function App() {
  const queryClient = useQueryClient()

  const [token, setToken] = useState(() => loadToken())
  const [showSettings, setShowSettings] = useState(false)
  const [showRepoPicker, setShowRepoPicker] = useState(false)
  const [activeView, setActiveView] = useState<'pull_requests' | 'my_actions' | 'branches'>('pull_requests')
  const [filter, setFilter] = useState<DashboardFilter>('all')
  const [theme, setTheme] = useState<Theme>(() => loadTheme())
  const [mode, setMode] = useState<Mode>(() => loadMode())
  const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null)
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false)
  const [branchAnalysisTriggered, setBranchAnalysisTriggered] = useState(false)
  const [branchAnalysisRepos, setBranchAnalysisRepos] = useState<string[]>([])

  useEffect(() => {
    applyTheme(theme, mode)
  }, [theme, mode])

  const [initialRepoState] = useState<RepoState>(() => loadRepoState([]))
  const [repos, setRepos] = useState<string[]>(initialRepoState.repos)
  const [selectedRepos, setSelectedRepos] = useState<string[]>(initialRepoState.selectedRepos)
  const [newRepo, setNewRepo] = useState('')
  const [repoError, setRepoError] = useState('')

  const changeTheme = (next: Theme) => {
    setTheme(next)
    saveTheme(next)
  }

  const toggleMode = () => {
    const next: Mode = mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    saveMode(next)
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

  // Derive effective branchAnalysisRepos by filtering out repos that no longer exist
  const effectiveBranchAnalysisRepos = useMemo(() => {
    const repoSet = new Set(repos)
    return branchAnalysisRepos.filter((r) => repoSet.has(r))
  }, [repos, branchAnalysisRepos])

  const effectiveBranchAnalysisTriggered =
    branchAnalysisTriggered && effectiveBranchAnalysisRepos.length > 0

  const branchQueries = useQueries({
    queries: effectiveBranchAnalysisRepos.map((repo) => ({
      queryKey: ['repo-branches', token, repo],
      queryFn: () => fetchRepoBranches(repo, token),
      staleTime: STALE_TIME,
      retry: 1,
      enabled: !!token && effectiveBranchAnalysisTriggered,
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
    setBranchAnalysisTriggered(false)
    setBranchAnalysisRepos([])
    void queryClient.invalidateQueries({ queryKey: ['repo-prs'] })
    void queryClient.invalidateQueries({ queryKey: ['repo-branches'] })
    void queryClient.invalidateQueries({ queryKey: ['user-repos'] })
  }

  const handleRefresh = () => {
    setShowRefreshConfirm(true)
  }

  const doRefresh = () => {
    setShowRefreshConfirm(false)
    clearApiCache()
    void queryClient.invalidateQueries({ queryKey: ['repo-prs'] })
    void queryClient.invalidateQueries({ queryKey: ['repo-branches'] })
    setBranchAnalysisTriggered(false)
  }

  const handleNewRepoChange = useCallback((v: string) => {
    setNewRepo(v)
    setRepoError('')
  }, [])

  const handleRunBranchAnalysis = (reposToAnalyze: string[]) => {
    // Only analyze repos that are still in the tracked list
    const valid = reposToAnalyze.filter((r) => repos.includes(r))
    setBranchAnalysisRepos(valid)
    setBranchAnalysisTriggered(valid.length > 0)
    // Invalidate stale branch queries for selected repos so fresh data is fetched
    valid.forEach((repo) => {
      void queryClient.invalidateQueries({ queryKey: ['repo-branches', token, repo] })
    })
  }

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
            <div className="flex items-start gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-gh-fg">GitHub Dev Control Panel</h1>
                <p className="mt-1 text-sm text-gh-fg-muted">
                  Bird&apos;s-eye view of pull requests and branches across your repositories.
                </p>
              </div>
              <a
                href="https://github.com/thinkdj/gh.devcp"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View source on GitHub"
                title="View source on GitHub"
                className="mt-1 shrink-0 text-gh-fg-muted hover:text-gh-fg-default transition-colors"
              >
                <svg height="20" width="20" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
              </a>
            </div>
            <div className="flex items-center gap-2">
              {/* Theme palette selector */}
              <label htmlFor="theme-select" className="sr-only">Theme</label>
              <select
                id="theme-select"
                value={theme}
                onChange={(e) => changeTheme(e.target.value as Theme)}
                aria-label="Theme"
                className="rounded-md border border-gh-border bg-gh-overlay px-2 py-1.5 text-xs text-gh-fg-default hover:border-gh-border-hover focus:outline-none focus:border-gh-accent"
              >
                <option value="warm">Warm</option>
                <option value="slate">Slate</option>
                <option value="ocean">Ocean</option>
                <option value="ember">Ember</option>
              </select>
              {/* Light/dark mode toggle */}
              <button
                type="button"
                onClick={toggleMode}
                title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="rounded-md border border-gh-border bg-gh-overlay p-1.5 text-gh-fg-muted hover:border-gh-border-hover hover:text-gh-fg-default"
              >
                {mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              {dataUpdatedAt > 0 && (
                <span className="text-xs text-gh-fg-muted">
                  Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
                </span>
              )}
              <button
                type="button"
                onClick={handleRefresh}
                className="rounded-md border border-gh-border bg-gh-overlay p-1.5 text-gh-fg-muted hover:border-gh-border-hover hover:text-gh-fg-default"
                title="Refresh data"
                aria-label="Refresh data"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${
                  token
                    ? 'border-gh-success/40 bg-gh-success/10 text-gh-success-fg'
                    : 'border-gh-warning/40 bg-gh-warning/10 text-gh-warning'
                }`}
              >
                <Settings className="h-3.5 w-3.5" />
                {token ? 'Connected' : 'Set token'}
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
              <div className="mb-4 flex justify-center">
                <Clipboard className="h-14 w-14 text-gh-accent-fg opacity-60" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-gh-fg">Welcome to GitHub Dev CP</h2>
              <p className="mt-2 text-sm text-gh-fg-muted">
                Monitor pull requests across all your repositories at a glance.
              </p>
              <ul className="mx-auto mt-4 max-w-xs space-y-1.5 text-left text-sm text-gh-fg-muted">
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-gh-success-fg shrink-0" /> See PR status, reviews &amp; CI checks</li>
                <li className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-gh-fg-muted shrink-0" /> Spot stale or fully merged branches</li>
                <li className="flex items-center gap-2"><Tag className="h-4 w-4 text-gh-fg-muted shrink-0" /> Filter by author, label, status</li>
                <li className="flex items-center gap-2"><GitPullRequest className="h-4 w-4 text-gh-fg-muted shrink-0" /> Track draft PRs and push counts</li>
                <li className="flex items-center gap-2"><Zap className="h-4 w-4 text-gh-fg-muted shrink-0" /> Auto-refreshes every 5 minutes</li>
              </ul>
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-md border border-gh-accent bg-gh-accent px-5 py-2 text-sm font-medium text-white"
              >
                <Key className="h-4 w-4" /> Connect GitHub Token
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
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors ${
                  activeView === 'pull_requests'
                    ? 'border-gh-accent bg-gh-accent/10 text-gh-accent-fg'
                    : 'border-gh-border bg-gh-surface text-gh-fg-muted hover:border-gh-border-hover'
                }`}
              >
                <GitPullRequest className="h-3.5 w-3.5" /> Pull requests
              </button>
              <button
                type="button"
                onClick={() => setActiveView('my_actions')}
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors ${
                  activeView === 'my_actions'
                    ? 'border-gh-accent bg-gh-accent/10 text-gh-accent-fg'
                    : 'border-gh-border bg-gh-surface text-gh-fg-muted hover:border-gh-border-hover'
                }`}
              >
                <Zap className="h-3.5 w-3.5" /> My actions
                {summary.needsReview > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gh-warning px-1 text-[10px] font-semibold text-white">
                    {summary.needsReview}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveView('branches')}
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors ${
                  activeView === 'branches'
                    ? 'border-gh-accent bg-gh-accent/10 text-gh-accent-fg'
                    : 'border-gh-border bg-gh-surface text-gh-fg-muted hover:border-gh-border-hover'
                }`}
              >
                <GitBranch className="h-3.5 w-3.5" /> Branch analysis
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
              onSelectAll={() => setSelectedRepos(repos)}
              onDeselectAll={() => setSelectedRepos([])}
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
                isLoading={branchIsLoading}
                hasSelectedRepos={selectedRepos.length > 0}
                repos={repos}
                analysisRepos={effectiveBranchAnalysisRepos}
                analysisTriggered={effectiveBranchAnalysisTriggered}
                onRunAnalysis={handleRunBranchAnalysis}
              />
            ) : (
              <ActionRequiredPanel
                pullRequests={pullRequests}
                currentUser={currentUser}
                hasSelectedRepos={selectedRepos.length > 0}
                isLoading={prIsLoading}
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

      <ConfirmDialog
        isOpen={showRefreshConfirm}
        title="Refresh data?"
        message={
          Math.max(prDataUpdatedAt, branchDataUpdatedAt) > 0
            ? `Data was last refreshed at ${new Date(Math.max(prDataUpdatedAt, branchDataUpdatedAt)).toLocaleTimeString()}. Refreshing will clear the cache and re-fetch all repositories.`
            : 'Refreshing will clear the cache and re-fetch all repositories.'
        }
        confirmLabel="Refresh"
        onConfirm={doRefresh}
        onCancel={() => setShowRefreshConfirm(false)}
      />
    </main>
  )
}

export default App

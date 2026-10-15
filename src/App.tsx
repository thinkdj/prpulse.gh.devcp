import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Gear,
  ArrowsClockwise,
  Sun,
  Moon,
  Key,
  Pulse,
  Funnel,
  GitBranch,
  Palette,
  GitPullRequest,
  Lightning,
  Robot,
  Flask,
  ShieldCheck,
  WarningCircle,
} from '@phosphor-icons/react'
import type { CopilotAccountData, CopilotAnalyticsTarget, DashboardFilter, PullRequest } from './types'
import { loadRepoState, loadToken, loadTheme, loadMode, saveRepoState, saveToken, saveTheme, saveMode, loadCopilotTarget, saveCopilotTarget } from './storage'
import type { Theme, Mode } from './storage'
import { clearApiCache, fetchCopilotOrgData, fetchCopilotPersonalData, fetchCurrentUser, fetchRepoBranches, fetchRepoPullRequests, fetchUserOrgs, fetchUserRepos } from './github-api'
import { formatAgeAgoFromMs } from './utils'
import SummaryWidgets from './components/SummaryWidgets'
import RepoSelector from './components/RepoSelector'
import PullRequestTable from './components/PullRequestTable'
import TokenSettings from './components/TokenSettings'
import ActionRequiredPanel from './components/ActionRequiredPanel'
import ConfirmDialog from './components/ConfirmDialog'

// Code-split below-the-fold views: react-markdown (PR detail) and the
// branch/Copilot panels stay out of the initial bundle until opened.
const RepoPickerModal = lazy(() => import('./components/RepoPickerModal'))
const BranchAnalysisPanel = lazy(() => import('./components/BranchAnalysisPanel'))
const PRDetailPanel = lazy(() => import('./components/PRDetailPanel'))
const CopilotMetricsPanel = lazy(() => import('./components/CopilotMetricsPanel'))

function LazyPanelFallback({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-gh-border bg-gh-surface px-4 py-12 text-center text-sm text-gh-fg-muted" role="status" aria-live="polite">
      Loading {label}…
    </div>
  )
}

type DemoData = typeof import('./demo-data')

// Demo mode is strictly opt-in via `?demo=true`; every other URL (including the deployed
// homepage) shows the real app — welcome/token screen when no token is configured.
const demoParam = new URLSearchParams(window.location.search).get('demo')
const isDemoMode = demoParam === 'true'
const DEMO_TOKEN = 'demo-mode'
// Keeps the header's loading bar visible for a minimum stretch on boot, even when data
// (e.g. demo fixtures) is ready instantly — it's the project's one loading indicator.
// Skipped under Vitest so tests don't have to wait out a real timer.
const BOOT_WINDOW_MS = import.meta.env.MODE === 'test' ? 0 : 2500

// Welcome-state feature map: mirrors the dashboard's actual tab row (same icons, same labels)
// so the empty state doubles as a table of contents for the product.
const WELCOME_VIEWS = [
  {
    icon: GitPullRequest,
    title: 'Pull requests',
    description:
      'Every open PR across your repos: review state, CI checks, merge safety, drafts, labels, push counts. Search, sort, filter — or click any row for full detail.',
  },
  {
    icon: Lightning,
    title: 'My actions',
    description:
      'The short list of what’s waiting on you — reviews requested from you, plus your own PRs that are blocked, failing CI, or ready to merge.',
  },
  {
    icon: GitBranch,
    title: 'Branch analysis',
    description:
      'An on-demand sweep of any repo for stale, merged, and active branches — searchable, with copy-ready names and direct GitHub links.',
  },
  {
    icon: Robot,
    title: 'Copilot',
    description:
      'Adoption and usage metrics for your organizations, plus personal Copilot billing and premium-request usage.',
  },
] as const

function applyTheme(theme: Theme, mode: Mode) {
  document.documentElement.classList.remove('light', 'slate', 'ocean', 'ember', 'zinc', 'azure')
  if (mode === 'light') document.documentElement.classList.add('light')
  if (theme === 'slate') document.documentElement.classList.add('slate')
  if (theme === 'ocean') document.documentElement.classList.add('ocean')
  if (theme === 'ember') document.documentElement.classList.add('ember')
  if (theme === 'zinc') document.documentElement.classList.add('zinc')
  if (theme === 'azure') document.documentElement.classList.add('azure')
}

function App() {
  const queryClient = useQueryClient()

  const [demoData, setDemoData] = useState<DemoData | null>(null)

  const [token, setToken] = useState(() => isDemoMode ? DEMO_TOKEN : '')
  const [tokenHydrated, setTokenHydrated] = useState(() => isDemoMode)
  const [showSettings, setShowSettings] = useState(false)
  const [showRepoPicker, setShowRepoPicker] = useState(false)
  const [activeView, setActiveView] = useState<'pull_requests' | 'my_actions' | 'branches' | 'copilot'>('pull_requests')
  const [filter, setFilter] = useState<DashboardFilter>('all')
  const [theme, setTheme] = useState<Theme>(() => loadTheme())
  const [mode, setMode] = useState<Mode>(() => loadMode())
  const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null)
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false)
  const [branchAnalysisTriggered, setBranchAnalysisTriggered] = useState(false)
  const [branchAnalysisRepos, setBranchAnalysisRepos] = useState<string[]>([])
  const [selectedCopilotTargetRaw, setSelectedCopilotTarget] = useState(() =>
    isDemoMode ? '' : loadCopilotTarget(),
  )
  const [bootWindowElapsed, setBootWindowElapsed] = useState(BOOT_WINDOW_MS === 0)
  useEffect(() => {
    applyTheme(theme, mode)
  }, [theme, mode])

  // Keeps the header loading bar on screen for a minimum stretch on boot instead of an instant
  // flash straight to data (most noticeable in demo mode, where fixtures load immediately).
  useEffect(() => {
    if (BOOT_WINDOW_MS === 0) return
    const timer = setTimeout(() => setBootWindowElapsed(true), BOOT_WINDOW_MS)
    return () => clearTimeout(timer)
  }, [])

  // Load demo fixture data lazily so non-demo users don't pay the parse/download cost.
  useEffect(() => {
    if (isDemoMode) {
      void import('./demo-data').then(setDemoData)
    }
  }, [])

  // Token decryption uses Web Crypto and is async, so hydrate once on startup.
  useEffect(() => {
    if (isDemoMode) return
    let cancelled = false

    void loadToken().then((loadedToken) => {
      if (cancelled) return
      setToken(loadedToken)
      setTokenHydrated(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const [{ repos: initRepos, selectedRepos: initSelectedRepos }] = useState(() =>
    isDemoMode ? { repos: [] as string[], selectedRepos: [] as string[] } : loadRepoState([]),
  )
  const [repos, setRepos] = useState<string[]>(initRepos)
  const [selectedRepos, setSelectedRepos] = useState<string[]>(initSelectedRepos)
  // Populate demo repos once the demo-data module has loaded.
  useEffect(() => {
    if (isDemoMode && demoData) {
      setRepos(demoData.DEMO_REPOS)
      setSelectedRepos(demoData.DEMO_REPOS)
    }
  }, [demoData])
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

  const currentUserQuery = useQuery({
    queryKey: ['current-user', token],
    queryFn: isDemoMode
      ? () => Promise.resolve(demoData?.DEMO_CURRENT_USER ?? '')
      : () => fetchCurrentUser(token),
    enabled: !!token && (!isDemoMode || demoData !== null),
    staleTime: Infinity,
    retry: false,
  })

  const currentUser = currentUserQuery.data ?? ''
  const prQueriesReady =
    !!token && (currentUserQuery.data !== undefined || currentUserQuery.isError)

  const { data: userRepos = [], isLoading: reposLoading } = useQuery({
    queryKey: ['user-repos', token],
    queryFn: () => fetchUserRepos(token),
    enabled: !isDemoMode && !!token && showRepoPicker,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const STALE_TIME = 3 * 60 * 1000 // 3 minutes – matches API cache TTL

  // Stable query option objects: inline .map() each render gives new queryFn refs; useQueries
  // then runs setQueries every render → setOptions → refetch loop after data updates.
  const prQueryDefs = useMemo(
    () =>
      selectedRepos.map((repo) => ({
        queryKey: ['repo-prs', token, repo, currentUser] as const,
        queryFn: isDemoMode
          ? () => Promise.resolve((demoData?.demoPullRequests ?? []).filter((pr) => pr.repo === repo))
          : () => fetchRepoPullRequests(repo, token, currentUser),
        staleTime: STALE_TIME,
        refetchInterval: isDemoMode ? (false as const) : 5 * 60 * 1000,
        retry: isDemoMode ? 0 : 1,
        enabled: prQueriesReady,
      })),
    [selectedRepos, token, currentUser, prQueriesReady, STALE_TIME, demoData],
  )

  const repoQueries = useQueries({ queries: prQueryDefs })

  // Derive effective branchAnalysisRepos by filtering out repos that no longer exist
  const effectiveBranchAnalysisRepos = useMemo(() => {
    const repoSet = new Set(repos)
    return branchAnalysisRepos.filter((r) => repoSet.has(r))
  }, [repos, branchAnalysisRepos])

  const effectiveBranchAnalysisTriggered =
    branchAnalysisTriggered && effectiveBranchAnalysisRepos.length > 0

  const branchQueryDefs = useMemo(
    () =>
      effectiveBranchAnalysisRepos.map((repo) => ({
        queryKey: ['repo-branches', token, repo] as const,
        queryFn: isDemoMode
          ? () => Promise.resolve((demoData?.demoBranches ?? []).filter((b) => b.repo === repo))
          : () => fetchRepoBranches(repo, token),
        staleTime: STALE_TIME,
        retry: isDemoMode ? 0 : 1,
        enabled: !!token && effectiveBranchAnalysisTriggered,
      })),
    [effectiveBranchAnalysisRepos, token, effectiveBranchAnalysisTriggered, STALE_TIME, demoData],
  )

  const branchQueries = useQueries({ queries: branchQueryDefs })

  /* ── Copilot metrics ── */

  const { data: userOrgs = [], isPending: orgsIsPending } = useQuery({
    queryKey: ['user-orgs', token],
    queryFn: isDemoMode
      ? () => Promise.resolve(demoData?.demoCopilotOrgs ?? [])
      : () => fetchUserOrgs(token),
    enabled: !!token && activeView === 'copilot',
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })

  // Prefer API-confirmed org memberships; fall back to unique repo owners so
  // users with direct org-repo access (but no org membership) still get an org
  // candidate. The fallback can include non-org owners (personal forks) — those
  // simply surface a tolerated fetch error in the Copilot panel instead of
  // failing silently. Exclude the authenticated user's own login: personal
  // accounts are not organisations and /orgs/{user}/copilot/metrics 404s.
  // Nothing is returned while the org query is in-flight to avoid flashing
  // repo owners as org candidates.
  const copilotOrgs = useMemo(() => {
    const fromApi = new Set(userOrgs)
    if (fromApi.size > 0) return [...fromApi].sort()
    if (orgsIsPending) return []
    const fromRepos = new Set(
      repos.map((r) => r.split('/')[0]).filter((owner) => owner && owner !== currentUser),
    )
    return [...fromRepos].sort()
  }, [repos, userOrgs, orgsIsPending, currentUser])

  const copilotTargets = useMemo<CopilotAnalyticsTarget[]>(
    () => [
      ...(!isDemoMode && currentUser
        ? [{
            id: `personal:${currentUser}`,
            label: `${currentUser} (Personal)`,
            type: 'personal' as const,
          }]
        : []),
      ...copilotOrgs.map((org) => ({
        id: `org:${org}`,
        label: `${org} (Organization)`,
        type: 'organization' as const,
      })),
    ],
    [copilotOrgs, currentUser],
  )

  const copilotTargetsStillResolving =
    orgsIsPending || (!isDemoMode && !!token && activeView === 'copilot' && currentUserQuery.isLoading)
  const selectedCopilotTarget = useMemo(() => {
    const exactMatch = copilotTargets.find((target) => target.id === selectedCopilotTargetRaw)
    if (exactMatch) return exactMatch
    if (selectedCopilotTargetRaw && copilotTargetsStillResolving) return null
    return copilotTargets[0] ?? null
  }, [copilotTargets, selectedCopilotTargetRaw, copilotTargetsStillResolving])
  const selectedTargetExists = copilotTargets.some((target) => target.id === selectedCopilotTargetRaw)

  useEffect(() => {
    if (!selectedCopilotTarget || selectedTargetExists) return
    if (selectedCopilotTargetRaw && copilotTargetsStillResolving) return
    if (selectedCopilotTargetRaw !== selectedCopilotTarget.id) {
      setSelectedCopilotTarget(selectedCopilotTarget.id)
      if (!isDemoMode) saveCopilotTarget(selectedCopilotTarget.id)
    }
  }, [selectedCopilotTarget, selectedCopilotTargetRaw, selectedTargetExists, copilotTargetsStillResolving, setSelectedCopilotTarget])

  const handleCopilotTargetChange = useCallback((target: string) => {
    setSelectedCopilotTarget(target)
    if (!isDemoMode) saveCopilotTarget(target)
  }, [])

  const copilotQuery = useQuery<CopilotAccountData | null>({
    queryKey: ['copilot-account', token, selectedCopilotTarget?.id],
    queryFn: isDemoMode
      ? () => {
          const data = demoData?.demoCopilotOrgData ?? []
          return Promise.resolve(data.find((d) => d.target === selectedCopilotTarget?.id || d.org === selectedCopilotTarget?.id.replace('org:', '')) ?? data[0] ?? null)
        }
      : () => {
          if (!selectedCopilotTarget) return Promise.resolve(null)
          return selectedCopilotTarget.type === 'personal'
            ? fetchCopilotPersonalData(currentUser, token)
            : fetchCopilotOrgData(selectedCopilotTarget.id.replace('org:', ''), token)
        },
    staleTime: STALE_TIME,
    retry: isDemoMode ? 0 : 1,
    enabled: !!token && activeView === 'copilot' && (!!selectedCopilotTarget || isDemoMode),
  })

  const copilotData = copilotQuery.data ?? null
  const copilotIsLoading = copilotQuery.isLoading
  const copilotError = copilotQuery.error ?? null
  const copilotDataUpdatedAt = copilotQuery.dataUpdatedAt
  const copilotTargetsLoading =
    copilotTargetsStillResolving

  const prIsLoading = repoQueries.some((q) => q.isLoading)
  const prError = repoQueries.find((q) => q.error)?.error ?? null
  const prDataUpdatedAt = Math.max(0, ...repoQueries.map((q) => q.dataUpdatedAt))

  const pullRequests = repoQueries.flatMap((q) => q.data ?? [])
  const branches = branchQueries.flatMap((q) => q.data ?? [])
  const branchIsLoading = branchQueries.some((q) => q.isLoading)
  const branchError = branchQueries.find((q) => q.error)?.error ?? null
  const branchDataUpdatedAt = Math.max(0, ...branchQueries.map((q) => q.dataUpdatedAt))
  const isLoading = activeView === 'branches' ? branchIsLoading : activeView === 'copilot' ? copilotIsLoading : prIsLoading
  const viewError = activeView === 'branches' ? branchError : activeView === 'copilot' ? copilotError : prError
  const accountError =
    token && currentUserQuery.isError ? (currentUserQuery.error ?? null) : null
  const error = accountError ?? viewError
  const dataUpdatedAt = activeView === 'branches' ? branchDataUpdatedAt : activeView === 'copilot' ? copilotDataUpdatedAt : prDataUpdatedAt

  // Drives the header's top loading bar — the project's one loading indicator. True while any
  // background fetch is in flight (initial load, manual refresh, auto-refresh, tab switch), and
  // held true through the initial boot window so it's visible even when data resolves instantly.
  const isFetchingAny =
    !bootWindowElapsed ||
    repoQueries.some((q) => q.isFetching) ||
    branchQueries.some((q) => q.isFetching) ||
    copilotQuery.isFetching ||
    currentUserQuery.isFetching

  useEffect(() => {
    if (!isDemoMode) saveRepoState({ repos, selectedRepos })
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
    if (!normalized) {
      setRepoError('')
      return
    }
    // GitHub owner/repo names: no spaces, exactly one slash, valid characters.
    const parts = normalized.split('/')
    const namePattern = /^[A-Za-z0-9_.-]+$/
    if (parts.length !== 2 || !parts[0] || !parts[1] || !namePattern.test(parts[0]) || !namePattern.test(parts[1])) {
      setRepoError('Use owner/repo format')
      return
    }
    // Duplicate check is case-insensitive — GitHub repos are case-insensitive —
    // but the user's original casing is preserved.
    if (repos.some((r) => r.toLowerCase() === normalized.toLowerCase())) {
      setRepoError('')
      return
    }

    setRepoError('')
    setRepos((current) => [...current, normalized])
    setSelectedRepos((current) => [...current, normalized])
    setNewRepo('')
  }

  const handleSaveToken = async (newToken: string) => {
    setToken(newToken)
    await saveToken(newToken)
    clearApiCache()
    setBranchAnalysisTriggered(false)
    setBranchAnalysisRepos([])
    void queryClient.invalidateQueries({ queryKey: ['repo-prs'] })
    void queryClient.invalidateQueries({ queryKey: ['repo-branches'] })
    void queryClient.invalidateQueries({ queryKey: ['user-repos'] })
    void queryClient.invalidateQueries({ queryKey: ['copilot-account'] })
    void queryClient.invalidateQueries({ queryKey: ['user-orgs'] })
  }

  const handleRefresh = () => {
    setShowRefreshConfirm(true)
  }

  const doRefresh = () => {
    setShowRefreshConfirm(false)
    clearApiCache()
    void queryClient.invalidateQueries({ queryKey: ['repo-prs'] })
    void queryClient.invalidateQueries({ queryKey: ['repo-branches'] })
    void queryClient.invalidateQueries({ queryKey: ['copilot-account'] })
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
    // Compute from current render state — no functional updater closing over a
    // potentially stale `repos` value. Newly picked repos become selected.
    const selectedSet = new Set(selected)
    const oldReposLower = new Set(repos.map((r) => r.toLowerCase()))
    const kept = selectedRepos.filter((repo) => selectedSet.has(repo))
    const newlyAdded = selected.filter((repo) => !oldReposLower.has(repo.toLowerCase()))
    setRepos(selected)
    setSelectedRepos([...kept, ...newlyAdded])
  }

  return (
    <main className="min-h-screen bg-gh-bg text-gh-fg-default">
      <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">
        {isDemoMode && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-gh-accent/30 bg-gh-accent/10 px-4 py-3 text-sm text-gh-accent-fg shadow-sm">
            <Flask className="h-4 w-4 shrink-0" />
            <span>
              <strong>Demo mode.</strong> Exploring with sample data, no GitHub token required.{' '}
              <a href="?demo=false" className="underline hover:no-underline">Exit demo</a>
            </span>
          </div>
        )}
        <header className="relative mb-6 overflow-hidden rounded-md border border-gh-border bg-gh-surface shadow-sm">
          {/* Signature masthead treatment: soft azure wash — distinct from the flat cards below */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gh-accent/[0.07] via-transparent to-transparent" aria-hidden="true" />
          {/* Top strip doubles as a real loading indicator: transparent at rest, an indeterminate
              sweep while any query is in flight — instead of a purely decorative static bar. */}
          <div className="absolute inset-x-0 top-0 h-[3px] overflow-hidden" aria-hidden="true">
            {isFetchingAny && (
              <div className="loading-bar-sweep h-full w-1/3 bg-gradient-to-r from-transparent via-gh-accent to-transparent" />
            )}
          </div>

          <div className="relative flex flex-wrap items-start justify-between gap-4 p-5 md:p-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gh-accent/10">
                  <Pulse className="pulse-mark h-5 w-5 text-gh-accent-fg" weight="bold" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gh-fg-muted">GitHub control panel</p>
                  <h1 className="text-2xl font-bold leading-tight tracking-tight text-gh-fg md:text-[1.75rem]">PR Pulse</h1>
                </div>
              </div>
              <p className="mt-2 text-sm text-gh-fg-muted">
                Live pull request status, branch health, and Copilot usage for every repo you track.
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5">
                <a
                  href="https://github.com/thinkdj/prpulse.gh.devcp"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View source on GitHub"
                  title="View source on GitHub"
                  className="shrink-0 rounded-full p-2 text-gh-fg-muted transition-colors hover:bg-gh-overlay hover:text-gh-accent-fg"
                >
                  <svg height="18" width="18" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                  </svg>
                </a>
                {/* Theme palette selector */}
                <label htmlFor="theme-select" className="sr-only">Theme</label>
                <select
                  id="theme-select"
                  value={theme}
                  onChange={(e) => changeTheme(e.target.value as Theme)}
                  aria-label="Theme"
                  className="rounded-md border border-gh-border bg-gh-overlay px-2.5 py-1.5 text-xs font-medium text-gh-fg-default transition-colors hover:border-gh-border-hover focus:border-gh-accent focus:outline-none"
                >
                  <option value="azure">Azure</option>
                  <option value="slate">Slate</option>
                  <option value="warm">Warm</option>
                  <option value="ocean">Ocean</option>
                  <option value="ember">Ember</option>
                  <option value="zinc">Zinc</option>
                </select>
                {/* Light/dark mode toggle */}
                <button
                  type="button"
                  onClick={toggleMode}
                  title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  className="rounded-full p-2 text-gh-fg-muted transition-colors hover:bg-gh-overlay hover:text-gh-fg-default"
                >
                  {mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="rounded-full p-2 text-gh-fg-muted transition-colors hover:bg-gh-overlay hover:text-gh-fg-default"
                  title="Refresh data"
                  aria-label="Refresh data"
                >
                  <ArrowsClockwise className="h-4 w-4" />
                </button>
                {!isDemoMode && (
                  <button
                    type="button"
                    onClick={() => setShowSettings(!showSettings)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-semibold shadow-sm transition-colors ${
                      token
                        ? 'bg-gh-success/15 text-gh-success-fg hover:bg-gh-success/25'
                        : 'bg-gh-warning/15 text-gh-warning hover:bg-gh-warning/25'
                    }`}
                  >
                    <Gear className="h-3.5 w-3.5" />
                    {token ? 'Connected' : 'Set token'}
                  </button>
                )}
              </div>
              {dataUpdatedAt > 0 && (
                <span
                  className="text-xs tabular-nums text-gh-fg-muted"
                  title={new Date(dataUpdatedAt).toLocaleString()}
                >
                  Updated {formatAgeAgoFromMs(dataUpdatedAt)}
                </span>
              )}
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
          <div className="mb-6 flex items-start gap-2 rounded-md border border-gh-danger/30 bg-gh-danger/10 px-4 py-3 text-sm text-gh-danger-fg shadow-sm">
            <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {error instanceof Error
                ? error.message
                : activeView === 'branches'
                  ? 'Failed to fetch branch analysis.'
                  : activeView === 'copilot'
                    ? 'Failed to fetch Copilot data.'
                    : 'Failed to fetch pull requests.'}
            </span>
          </div>
        )}

        {!tokenHydrated && !isDemoMode ? null : !token && !isDemoMode ? (
          /* ── Empty state: no token configured — the product's homepage in miniature ── */
          <section
            className="relative overflow-hidden rounded-md border border-gh-border bg-gh-surface px-6 py-14 shadow-sm md:py-16"
            data-testid="welcome-state"
          >
            {/* Same soft accent wash as the masthead — ties the hero to the app's signature treatment */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gh-accent/[0.07] via-transparent to-transparent" aria-hidden="true" />
            <div className="relative mx-auto max-w-2xl">
              <div className="text-center">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gh-accent/10">
                  <Pulse className="pulse-mark h-9 w-9 text-gh-accent-fg" weight="bold" aria-hidden="true" />
                </div>
                <h2 className="text-[1.75rem] font-bold leading-tight tracking-tight text-gh-fg md:text-[2rem]">
                  Welcome to PR Pulse
                </h2>
                <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-gh-fg-muted">
                  When GitHub notifications turn into noise, this is the signal: everything that
                  needs your attention, in one live view.
                </p>
                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSettings(true)}
                    className="inline-flex items-center gap-2 rounded-md bg-gh-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md hover:brightness-110"
                  >
                    <Key className="h-4 w-4" /> Connect GitHub token
                  </button>
                  <a
                    href="?demo=true"
                    className="inline-flex items-center gap-2 rounded-md border border-gh-border bg-gh-surface px-5 py-2.5 text-sm font-semibold text-gh-fg-muted transition-colors hover:border-gh-border-hover hover:bg-gh-overlay hover:text-gh-fg"
                  >
                    <Flask className="h-4 w-4" /> Try the demo
                  </a>
                </div>
                <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gh-fg-muted">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-gh-accent-fg" aria-hidden="true" />
                  Your token is encrypted, stored only in this browser, and sent nowhere but GitHub.
                </p>
              </div>

              <p className="mt-12 mb-4 text-center text-[11px] font-semibold uppercase tracking-wider text-gh-fg-muted">
                The four views
              </p>
              <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
                {WELCOME_VIEWS.map(({ icon: Icon, title, description }) => (
                  <div key={title} className="rounded-md border border-gh-border bg-gh-overlay/40 p-4">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-gh-accent-fg" aria-hidden="true" />
                      <h3 className="text-sm font-semibold text-gh-fg">{title}</h3>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-gh-fg-muted">{description}</p>
                  </div>
                ))}
              </div>

              <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gh-fg-muted">
                <li className="flex items-center gap-1.5">
                  <ArrowsClockwise className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Auto-refreshes every 5 minutes
                </li>
                <li className="flex items-center gap-1.5">
                  <Funnel className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> One-click filters: needs review, safe to merge, blocked
                </li>
                <li className="flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Six color themes, light &amp; dark
                </li>
              </ul>

              <p className="mt-7 text-center text-xs text-gh-fg-muted">
                Works with a fine-grained personal access token — read-only access to pull requests
                and checks is enough to start.
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
                className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                  activeView === 'pull_requests'
                    ? 'bg-gh-accent text-white shadow-sm'
                    : 'border border-gh-border bg-gh-surface text-gh-fg-muted hover:border-gh-border-hover hover:text-gh-fg-default'
                }`}
              >
                <GitPullRequest className="h-3.5 w-3.5" /> Pull requests
              </button>
              <button
                type="button"
                onClick={() => setActiveView('my_actions')}
                className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                  activeView === 'my_actions'
                    ? 'bg-gh-accent text-white shadow-sm'
                    : 'border border-gh-border bg-gh-surface text-gh-fg-muted hover:border-gh-border-hover hover:text-gh-fg-default'
                }`}
              >
                <Lightning className="h-3.5 w-3.5" /> My actions
                {summary.needsReview > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gh-warning px-1 text-[10px] font-semibold text-white">
                    {summary.needsReview}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveView('branches')}
                className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                  activeView === 'branches'
                    ? 'bg-gh-accent text-white shadow-sm'
                    : 'border border-gh-border bg-gh-surface text-gh-fg-muted hover:border-gh-border-hover hover:text-gh-fg-default'
                }`}
              >
                <GitBranch className="h-3.5 w-3.5" /> Branch analysis
              </button>
              <button
                type="button"
                onClick={() => setActiveView('copilot')}
                className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                  activeView === 'copilot'
                    ? 'bg-gh-accent text-white shadow-sm'
                    : 'border border-gh-border bg-gh-surface text-gh-fg-muted hover:border-gh-border-hover hover:text-gh-fg-default'
                }`}
              >
                <Robot className="h-3.5 w-3.5" /> Copilot
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
                isLoading={prIsLoading}
              />
            )}

            {activeView !== 'copilot' && (
              <RepoSelector
                repos={repos}
                selectedRepos={selectedRepos}
                isLoading={isLoading}
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
            )}

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
                selectedPR={selectedPR}
              />
            ) : activeView === 'branches' ? (
              <Suspense fallback={<LazyPanelFallback label="branch analysis" />}>
                <BranchAnalysisPanel
                  branches={branches}
                  isLoading={branchIsLoading}
                  hasSelectedRepos={selectedRepos.length > 0}
                  repos={repos}
                  analysisRepos={effectiveBranchAnalysisRepos}
                  analysisTriggered={effectiveBranchAnalysisTriggered}
                  onRunAnalysis={handleRunBranchAnalysis}
                />
              </Suspense>
            ) : activeView === 'copilot' ? (
              <Suspense fallback={<LazyPanelFallback label="Copilot analytics" />}>
                <CopilotMetricsPanel
                  accountData={copilotData}
                  isLoading={copilotIsLoading}
                  targetsLoading={copilotTargetsLoading}
                  targets={copilotTargets}
                  selectedTarget={selectedCopilotTarget?.id ?? ''}
                  onTargetChange={handleCopilotTargetChange}
                  error={copilotError ? (copilotError instanceof Error ? copilotError.message : 'Failed to fetch Copilot data') : null}
                />
              </Suspense>
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
              <Suspense fallback={<LazyPanelFallback label="PR details" />}>
                <PRDetailPanel
                  pr={selectedPR}
                  token={token}
                  currentUser={currentUser}
                  isDemoMode={isDemoMode}
                  demoActivity={isDemoMode ? (demoData?.demoPRActivity[`${selectedPR.repo}/${selectedPR.id}`] ?? []) : undefined}
                  onClose={() => setSelectedPR(null)}
                  onPRClosed={() => {
                    setSelectedPR(null)
                    clearApiCache()
                    void queryClient.invalidateQueries({ queryKey: ['repo-prs'] })
                  }}
                  onBranchDeleted={() => {
                    clearApiCache()
                    void queryClient.invalidateQueries({ queryKey: ['repo-prs'] })
                  }}
                />
              </Suspense>
            )}

            {showRepoPicker && (
              <Suspense fallback={<LazyPanelFallback label="repository picker" />}>
                <RepoPickerModal
                  availableRepos={userRepos}
                  selectedRepos={repos}
                  isLoading={reposLoading}
                  onSave={handleRepoPickerSave}
                  onClose={() => setShowRepoPicker(false)}
                />
              </Suspense>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={showRefreshConfirm}
        title="Refresh data?"
        message={
          Math.max(prDataUpdatedAt, branchDataUpdatedAt) > 0
            ? `Data was last refreshed ${formatAgeAgoFromMs(Math.max(prDataUpdatedAt, branchDataUpdatedAt))} (${new Date(Math.max(prDataUpdatedAt, branchDataUpdatedAt)).toLocaleString()}). Refreshing will clear the cache and re-fetch all repositories.`
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

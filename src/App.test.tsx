import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { seedBranchAnalysis, seedPullRequests } from './seed-data'

/* ── Mock the GitHub API module ── */
vi.mock('./github-api', () => ({
  clearApiCache: vi.fn(),
  fetchCurrentUser: vi.fn().mockResolvedValue('test-user'),
  fetchRepoBranches: vi.fn().mockImplementation((repoFullName: string) =>
    Promise.resolve(seedBranchAnalysis.filter((branch) => branch.repo === repoFullName)),
  ),
  fetchRepoPullRequests: vi.fn().mockImplementation((repoFullName: string) =>
    Promise.resolve(seedPullRequests.filter((pr) => pr.repo === repoFullName)),
  ),
  fetchUserRepos: vi.fn().mockResolvedValue([]),
  fetchPRActivity: vi.fn().mockResolvedValue([]),
  postPRComment: vi.fn().mockResolvedValue({ id: 1, author: 'test-user', authorAvatar: '', body: 'ok', createdAt: '', isReview: false }),
  closePR: vi.fn().mockResolvedValue(undefined),
  deleteBranch: vi.fn().mockResolvedValue(undefined),
  fetchUserOrgs: vi.fn().mockResolvedValue([]),
  fetchCopilotMetrics: vi.fn().mockResolvedValue([]),
  fetchCopilotBilling: vi.fn().mockResolvedValue(null),
  fetchCopilotOrgData: vi.fn().mockResolvedValue({ type: 'organization', target: 'org:test-org', org: 'test-org', billing: null, metrics: [], error: undefined }),
  fetchCopilotPersonalData: vi.fn().mockResolvedValue({ type: 'personal', target: 'personal:test-user', account: 'test-user', usage: [], premiumRequests: [], error: undefined }),
}))

import { clearApiCache, fetchCurrentUser, fetchRepoBranches, fetchRepoPullRequests } from './github-api'
import type { Mock } from 'vitest'

const TOKEN_KEY = 'prpulse.gh.devcp.dashboard.token'
const REPOS_KEY = 'prpulse.gh.devcp.dashboard.repositories'
const COPILOT_TARGET_KEY = 'prpulse.gh.devcp.dashboard.copilotTarget'

const defaultRepos = Array.from(new Set(seedPullRequests.map((pr) => pr.repo)))

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

const renderApp = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}

/** Set up localStorage so the app boots in "authenticated" mode with seed repos */
function seedAuthenticatedState() {
  localStorage.setItem(TOKEN_KEY, 'ghp_test_token')
  localStorage.setItem(
    REPOS_KEY,
    JSON.stringify({ repos: defaultRepos, selectedRepos: defaultRepos }),
  )
}

describe('PR Pulse – The GitHub Control Panel', () => {
  /* ── Empty / welcome state (no token) ── */

  it('shows welcome state when no token is configured', async () => {
    renderApp()

    expect(await screen.findByTestId('welcome-state')).toBeInTheDocument()
    expect(screen.getByText(/Welcome to PR Pulse/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Connect GitHub Token/i })).toBeInTheDocument()
  })

  it('shows settings panel when connect button is clicked from welcome state', async () => {
    renderApp()

    await screen.findByTestId('welcome-state')
    fireEvent.click(screen.getByRole('button', { name: /Connect GitHub Token/i }))

    expect(screen.getByLabelText(/GitHub Personal Access Token/i)).toBeInTheDocument()
  })

  it('shows settings panel when "Set token" button is clicked', async () => {
    renderApp()

    await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
    fireEvent.click(screen.getByRole('button', { name: /Set token/i }))

    expect(screen.getByLabelText(/GitHub Personal Access Token/i)).toBeInTheDocument()
  })

  /* ── Authenticated dashboard ── */

  describe('with token', () => {
    beforeEach(seedAuthenticatedState)

    it('renders the dashboard and summary widgets', async () => {
      renderApp()

      expect(await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByTestId('summary-total')).toHaveTextContent('5')
      })
    })

    it('shows account error but still loads PRs when /user fails', async () => {
      vi.mocked(fetchCurrentUser).mockRejectedValueOnce(
        new Error('Invalid GitHub token. Check your PAT.'),
      )

      renderApp()

      expect(await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText(/Invalid GitHub token/i)).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByTestId('summary-total')).toHaveTextContent('5')
      })
    })

    it('filters PRs when a repository is toggled off', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => {
        expect(screen.getByTestId('summary-total')).toHaveTextContent('5')
      })
      fireEvent.click(screen.getByRole('button', { name: 'thinkdj/website' }))

      await waitFor(() => {
        expect(screen.getByTestId('summary-total')).toHaveTextContent('4')
      })
    })

    it('hydrates selected repositories from localStorage', async () => {
      localStorage.setItem(
        REPOS_KEY,
        JSON.stringify({
          repos: ['thinkdj/prpulse.gh.devcp', 'thinkdj/website'],
          selectedRepos: ['thinkdj/prpulse.gh.devcp'],
        }),
      )

      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => {
        expect(screen.getByTestId('summary-total')).toHaveTextContent('2')
      })
    })

    it('falls back to empty repos when localStorage has invalid JSON', async () => {
      localStorage.setItem(REPOS_KEY, '{not-valid-json')

      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => {
        expect(screen.getByTestId('summary-total')).toHaveTextContent('0')
      })
    })

    it('persists repository selection changes to localStorage', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => {
        expect(screen.getByTestId('summary-total')).toHaveTextContent('5')
      })

      setItemSpy.mockClear()
      fireEvent.click(screen.getByRole('button', { name: 'thinkdj/website' }))

      await waitFor(() => {
        expect(setItemSpy).toHaveBeenCalled()
        expect(screen.getByTestId('summary-total')).toHaveTextContent('4')
      })

      const lastCall = setItemSpy.mock.calls.at(-1)
      expect(lastCall?.[0]).toBe(REPOS_KEY)

      const payload = JSON.parse(lastCall?.[1] ?? '{}') as {
        repos?: string[]
        selectedRepos?: string[]
      }
      expect(payload.repos).toContain('thinkdj/website')
      expect(payload.selectedRepos).not.toContain('thinkdj/website')
    })

    it('filters visible PRs using the filter buttons', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => {
        expect(screen.getByTestId('summary-total')).toHaveTextContent('5')
      })

      fireEvent.click(screen.getByRole('button', { name: 'Needs review' }))

      await waitFor(() => {
        expect(screen.getByText('3 PRs')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: 'All' }))

      await waitFor(() => {
        expect(screen.getByText('5 PRs')).toBeInTheDocument()
      })
    })

    it('removes a repository when the remove button is clicked', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => {
        expect(screen.getByTestId('summary-total')).toHaveTextContent('5')
      })

      fireEvent.click(screen.getByRole('button', { name: 'Remove thinkdj/website' }))

      // Confirm the removal in the custom dialog
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

      await waitFor(() => {
        expect(screen.getByTestId('summary-total')).toHaveTextContent('4')
      })
      expect(screen.queryByRole('button', { name: 'thinkdj/website' })).not.toBeInTheDocument()
    })

    it('shows validation error for invalid repo format', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })

      const input = screen.getByLabelText('Add repository')
      fireEvent.change(input, { target: { value: 'invalid-no-slash' } })
      fireEvent.submit(input.closest('form')!)

      await waitFor(() => {
        expect(screen.getByText('Use owner/repo format')).toBeInTheDocument()
      })
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('rejects repo names with more than one slash', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })

      const input = screen.getByLabelText('Add repository')
      fireEvent.change(input, { target: { value: 'a/b/c' } })
      fireEvent.submit(input.closest('form')!)

      await waitFor(() => {
        expect(screen.getByText('Use owner/repo format')).toBeInTheDocument()
      })
    })

    it('filters PRs by search query on title', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => {
        expect(screen.getByText('5 PRs')).toBeInTheDocument()
      })

      const searchInput = screen.getByLabelText('Search pull requests')
      fireEvent.change(searchInput, { target: { value: 'audit' } })

      await waitFor(() => {
        expect(screen.getByText('1 PR')).toBeInTheDocument()
      })
    })

    it('filters PRs by author using the column filter', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => {
        expect(screen.getByText('5 PRs')).toBeInTheDocument()
      })

      const authorInput = screen.getByLabelText('Filter by Author')
      fireEvent.change(authorInput, { target: { value: 'kevin-ops' } })

      await waitFor(() => {
        expect(screen.getByText('1 PR')).toBeInTheDocument()
      })
    })

    it('hides draft PRs when hide drafts checkbox is checked', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => {
        expect(screen.getByText('5 PRs')).toBeInTheDocument()
      })

      const checkbox = screen.getByLabelText('Hide drafts')
      fireEvent.click(checkbox)

      await waitFor(() => {
        expect(screen.getByText('4 PRs')).toBeInTheDocument()
      })
    })

    it('clears all filters when clear button is clicked', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => {
        expect(screen.getByText('5 PRs')).toBeInTheDocument()
      })

      const searchInput = screen.getByLabelText('Search pull requests')
      fireEvent.change(searchInput, { target: { value: 'audit' } })

      await waitFor(() => {
        expect(screen.getByText('1 PR')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Clear filters/i }))

      await waitFor(() => {
        expect(screen.getByText('5 PRs')).toBeInTheDocument()
      })
    })

    it('filters PRs by label using the column filter', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => {
        expect(screen.getByText('5 PRs')).toBeInTheDocument()
      })

      const prColumnFilter = screen.getByLabelText('Filter by PR')
      fireEvent.change(prColumnFilter, { target: { value: 'bug' } })

      await waitFor(() => {
        expect(screen.getByText('1 PR')).toBeInTheDocument()
      })
    })

    it('applies filter when clicking a summary widget', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => {
        expect(screen.getByTestId('summary-total')).toHaveTextContent('5')
      })

      const blockedWidget = screen.getByTestId('summary-blocked').closest('button')!
      fireEvent.click(blockedWidget)

      await waitFor(() => {
        expect(screen.getByText('1 PR')).toBeInTheDocument()
      })
    })

    it('displays labels on PR rows', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => {
        expect(screen.getByTestId('summary-total')).toHaveTextContent('5')
      })

      const table = screen.getByTestId('pr-table')
      expect(table.querySelectorAll('[title^="Filter by label:"]').length).toBeGreaterThan(0)
      expect(screen.getByTitle('Filter by label: bug')).toBeInTheDocument()
      expect(screen.getByTitle('Filter by label: urgent')).toBeInTheDocument()
      expect(screen.getByTitle('Filter by label: chore')).toBeInTheDocument()
    })

    it('clears API cache and re-fetches PRs when refresh button is clicked', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => {
        expect(screen.getByTestId('summary-total')).toHaveTextContent('5')
      })

      vi.mocked(clearApiCache).mockClear()
      vi.mocked(fetchRepoPullRequests).mockClear()

      fireEvent.click(screen.getByTitle('Refresh data'))

      // Confirm the refresh in the dialog
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

      expect(clearApiCache).toHaveBeenCalledTimes(1)

      await waitFor(() => {
        expect(fetchRepoPullRequests).toHaveBeenCalled()
      })
    })

    it('shows branch analysis with stale and merged counts', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      fireEvent.click(screen.getByRole('button', { name: /Branch analysis/i }))

      await screen.findByTestId('branch-analysis-panel')
      fireEvent.click(screen.getByRole('button', { name: /Run analysis/i }))

      await waitFor(() => {
        expect(fetchRepoBranches).toHaveBeenCalledTimes(defaultRepos.length)
      })

      expect(screen.getByTestId('branch-analysis-panel')).toBeInTheDocument()
      expect(screen.getByTestId('branch-summary-stale')).toHaveTextContent('1')
      expect(screen.getByTestId('branch-summary-merged')).toHaveTextContent('2')
      expect(screen.getByText('fix/audit-export')).toBeInTheDocument()
    })

    it('branch analysis repo checkboxes, All, and None change selection', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      fireEvent.click(screen.getByRole('button', { name: /Branch analysis/i }))

      const panel = await screen.findByTestId('branch-analysis-panel')
      const websiteBox = within(panel).getByRole('checkbox', { name: /thinkdj\/website/i })
      expect(websiteBox).toBeChecked()
      fireEvent.click(websiteBox)
      expect(websiteBox).not.toBeChecked()

      fireEvent.click(within(panel).getByRole('button', { name: 'None' }))
      expect(within(panel).getByRole('checkbox', { name: /thinkdj\/prpulse\.gh\.devcp/i })).not.toBeChecked()

      fireEvent.click(within(panel).getByRole('button', { name: 'All' }))
      expect(within(panel).getByRole('checkbox', { name: /thinkdj\/website/i })).toBeChecked()
    })

    it('filters branch analysis to stale branches', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      fireEvent.click(screen.getByRole('button', { name: /Branch analysis/i }))

      await screen.findByTestId('branch-analysis-panel')
      fireEvent.click(screen.getByRole('button', { name: /Run analysis/i }))

      await waitFor(() => {
        expect(fetchRepoBranches).toHaveBeenCalled()
      })

      fireEvent.click(screen.getByRole('button', { name: 'Stale' }))

      await waitFor(() => {
        expect(screen.getByTestId('branch-summary-total')).toHaveTextContent('1 of 7 branches shown')
      })

      expect(screen.getByText('fix/audit-export')).toBeInTheDocument()
      expect(screen.queryByText('feat/branch-analysis')).not.toBeInTheDocument()
    })

    it('shows the My Actions tab with prioritised action items', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => {
        expect(screen.getByTestId('summary-total')).toHaveTextContent('5')
      })

      fireEvent.click(screen.getByRole('button', { name: /My actions/i }))

      // The "Review Requested" section heading should appear (non-draft PRs with needsYourReview)
      await waitFor(() => {
        expect(screen.getByText(/Review Requested \(2\)/i)).toBeInTheDocument()
      })

      // Two non-draft PRs have needsYourReview=true in seed data (#1015, #998)
      expect(screen.getAllByText('Review requested').length).toBeGreaterThanOrEqual(2)
    })

    it('opens PR detail panel when clicking on a PR row', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => {
        expect(screen.getByText('5 PRs')).toBeInTheDocument()
      })

      // Click on the <tr> element (not on an interactive child)
      const table = screen.getByTestId('pr-table')
      const firstRow = table.querySelector('tbody tr')
      expect(firstRow).not.toBeNull()
      fireEvent.click(firstRow!)

      expect(await screen.findByRole('dialog', { name: 'Pull request details' })).toBeInTheDocument()
    })

    it('closes PR detail panel with the close button', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => {
        expect(screen.getByText('5 PRs')).toBeInTheDocument()
      })

      const table = screen.getByTestId('pr-table')
      const firstRow = table.querySelector('tbody tr')
      fireEvent.click(firstRow!)

      await screen.findByRole('dialog', { name: 'Pull request details' })

      fireEvent.click(screen.getByRole('button', { name: 'Close PR detail panel' }))

      expect(screen.queryByRole('dialog', { name: 'Pull request details' })).not.toBeInTheDocument()
    })

    it('closes PR detail panel with the Escape key', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => {
        expect(screen.getByText('5 PRs')).toBeInTheDocument()
      })

      const table = screen.getByTestId('pr-table')
      const firstRow = table.querySelector('tbody tr')
      fireEvent.click(firstRow!)

      await screen.findByRole('dialog', { name: 'Pull request details' })

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(screen.queryByRole('dialog', { name: 'Pull request details' })).not.toBeInTheDocument()
    })
  })

  /* ── Theme / mode controls ── */

  it('changes theme palette when theme selector is changed', async () => {
    renderApp()

    await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
    const themeSelect = screen.getByRole('combobox', { name: /Theme/i })

    // Default palette is Slate
    expect(themeSelect).toHaveValue('slate')
    expect(document.documentElement.classList.contains('slate')).toBe(true)
    expect(document.documentElement.classList.contains('ocean')).toBe(false)
    expect(document.documentElement.classList.contains('ember')).toBe(false)

    // Change to warm (base palette — no slate/ocean/ember class)
    fireEvent.change(themeSelect, { target: { value: 'warm' } })
    expect(document.documentElement.classList.contains('slate')).toBe(false)
    expect(document.documentElement.classList.contains('ocean')).toBe(false)

    // Change to slate
    fireEvent.change(themeSelect, { target: { value: 'slate' } })
    expect(document.documentElement.classList.contains('slate')).toBe(true)
    expect(document.documentElement.classList.contains('ocean')).toBe(false)

    // Change to ocean
    fireEvent.change(themeSelect, { target: { value: 'ocean' } })
    expect(document.documentElement.classList.contains('ocean')).toBe(true)
    expect(document.documentElement.classList.contains('slate')).toBe(false)

    // Change to ember
    fireEvent.change(themeSelect, { target: { value: 'ember' } })
    expect(document.documentElement.classList.contains('ember')).toBe(true)
    expect(document.documentElement.classList.contains('slate')).toBe(false)
    expect(document.documentElement.classList.contains('ocean')).toBe(false)
  })

  it('toggles between dark and light mode when mode button is clicked', async () => {
    renderApp()

    await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })

    // Default is dark mode → button says "Switch to light mode"
    const modeButton = screen.getByRole('button', { name: /Switch to light mode/i })
    expect(document.documentElement.classList.contains('light')).toBe(false)

    fireEvent.click(modeButton)

    // Now in light mode
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(screen.getByRole('button', { name: /Switch to dark mode/i })).toBeInTheDocument()
  })

  /* ── Zinc theme ── */

  it('applies the zinc class when zinc theme is selected', async () => {
    renderApp()

    await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
    const themeSelect = screen.getByRole('combobox', { name: /Theme/i })

    fireEvent.change(themeSelect, { target: { value: 'zinc' } })

    expect(document.documentElement.classList.contains('zinc')).toBe(true)
    expect(document.documentElement.classList.contains('slate')).toBe(false)
    expect(document.documentElement.classList.contains('ocean')).toBe(false)
    expect(document.documentElement.classList.contains('ember')).toBe(false)
  })

  it('offers "Zinc" as a theme option in the selector', async () => {
    renderApp()

    await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
    const themeSelect = screen.getByRole('combobox', { name: /Theme/i })

    const options = Array.from(themeSelect.querySelectorAll('option')).map((o) => o.value)
    expect(options).toContain('zinc')
  })

  /* ── Hide Dependabot filter (within token block) ── */

  describe('with token — Hide Dependabot filter', () => {
    beforeEach(seedAuthenticatedState)

    // Reset any per-test mock overrides so they don't leak into subsequent tests.
    afterEach(() => {
      vi.mocked(fetchRepoPullRequests).mockImplementation((repoFullName: string) =>
        Promise.resolve(seedPullRequests.filter((pr) => pr.repo === repoFullName)),
      )
    })

    it('shows "Hide Dependabot" checkbox in the toolbar', async () => {
      renderApp()
      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => screen.getByText('5 PRs'))

      expect(screen.getByLabelText('Hide Dependabot')).toBeInTheDocument()
    })

    it('filters out dependabot PRs when "Hide Dependabot" is checked', async () => {
      // Override fetchRepoPullRequests to inject a dependabot PR
      vi.mocked(fetchRepoPullRequests).mockImplementation((repoFullName: string) => {
        const base = seedPullRequests.filter((pr) => pr.repo === repoFullName)
        if (repoFullName === 'thinkdj/prpulse.gh.devcp') {
          return Promise.resolve([
            ...base,
            {
              id: 9001,
              repo: 'thinkdj/prpulse.gh.devcp',
              title: 'chore(deps): bump lodash',
              author: 'dependabot[bot]',
              authorAvatar: '',
              url: '#',
              openedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              pushesAfterOpen: 0,
              checksStatus: 'passing' as const,
              copilotReview: 'not_run' as const,
              mergeSafety: 'pending' as const,
              needsYourReview: false,
              isDraft: false,
              labels: ['dependencies'],
              reviewers: [],
              baseRef: 'main',
              headRef: 'dependabot/npm_and_yarn/lodash-4.17.21',
              commentCount: 0,
            },
          ])
        }
        return Promise.resolve(base)
      })

      renderApp()
      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => screen.getByText('6 PRs'))

      fireEvent.click(screen.getByLabelText('Hide Dependabot'))

      await waitFor(() => {
        expect(screen.getByText('5 PRs')).toBeInTheDocument()
      })
    })

    it('"Hide Copilot" and "Hide Dependabot" are independent checkboxes', async () => {
      renderApp()
      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })

      const hideCopilot = screen.getByLabelText('Hide Copilot')
      const hideDependabot = screen.getByLabelText('Hide Dependabot')

      expect(hideCopilot).not.toBeChecked()
      expect(hideDependabot).not.toBeChecked()

      fireEvent.click(hideCopilot)
      expect(hideCopilot).toBeChecked()
      expect(hideDependabot).not.toBeChecked()

      fireEvent.click(hideDependabot)
      expect(hideDependabot).toBeChecked()
      expect(hideCopilot).toBeChecked()
    })

    it('clearing all filters resets the "Hide Dependabot" checkbox', async () => {
      renderApp()
      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => screen.getByText('5 PRs'))

      fireEvent.click(screen.getByLabelText('Hide Dependabot'))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Clear filters/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Clear filters/i }))

      await waitFor(() => {
        expect(screen.getByLabelText('Hide Dependabot')).not.toBeChecked()
      })
    })
  })

  /* ── PR detail panel — Close PR ── */

  describe('with token — PR detail panel actions', () => {
    beforeEach(() => {
      seedAuthenticatedState()
      // Re-establish mock implementations explicitly, as prior tests that called
      // mockImplementation() may have interacted with vi.restoreAllMocks() tracking.
      vi.mocked(fetchRepoPullRequests).mockImplementation((repoFullName: string) =>
        Promise.resolve(seedPullRequests.filter((pr) => pr.repo === repoFullName)),
      )
    })

    /** Helper: open the detail panel on the first PR row. */
    async function openFirstPRPanel() {
      renderApp()
      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => {
        expect(screen.getByText('5 PRs')).toBeInTheDocument()
      })
      const table = screen.getByTestId('pr-table')
      const firstRow = table.querySelector('tbody tr')
      fireEvent.click(firstRow!)
      return screen.findByRole('dialog', { name: 'Pull request details' })
    }

    it('shows an "Actions" section in the PR detail panel', async () => {
      await openFirstPRPanel()
      expect(screen.getByText('Actions')).toBeInTheDocument()
    })

    it('shows the "Close PR" button in the detail panel', async () => {
      const panel = await openFirstPRPanel()
      expect(within(panel).getByRole('button', { name: 'Close PR' })).toBeInTheDocument()
    })

    it('shows the "Delete branch" button when headRef is set', async () => {
      const panel = await openFirstPRPanel()
      expect(within(panel).getByRole('button', { name: 'Delete branch' })).toBeInTheDocument()
    })

    it('clicking "Close PR" opens a confirmation dialog', async () => {
      const panel = await openFirstPRPanel()
      fireEvent.click(within(panel).getByRole('button', { name: 'Close PR' }))

      await screen.findByRole('dialog', { name: 'Close this pull request?' })
    })

    it('cancelling the Close PR dialog does not call closePR', async () => {
      const { closePR: mockClosePR } = await import('./github-api')
      const panel = await openFirstPRPanel()
      fireEvent.click(within(panel).getByRole('button', { name: 'Close PR' }))

      const confirmDialog = await screen.findByRole('dialog', { name: 'Close this pull request?' })
      fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Cancel' }))

      expect(mockClosePR).not.toHaveBeenCalled()
      // Panel should still be visible
      expect(screen.queryByRole('dialog', { name: 'Pull request details' })).toBeInTheDocument()
    })

    it('confirming Close PR calls closePR and closes the panel', async () => {
      const { closePR: mockClosePR } = await import('./github-api')
      ;(mockClosePR as Mock).mockResolvedValue(undefined)

      const panel = await openFirstPRPanel()
      fireEvent.click(within(panel).getByRole('button', { name: 'Close PR' }))

      const confirmDialog = await screen.findByRole('dialog', { name: 'Close this pull request?' })
      fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Close PR' }))

      await waitFor(() => {
        expect(mockClosePR).toHaveBeenCalledOnce()
      })

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Pull request details' })).not.toBeInTheDocument()
      })
    })

    it('confirming Close PR invalidates the PR cache (calls clearApiCache)', async () => {
      const { closePR: mockClosePR } = await import('./github-api')
      ;(mockClosePR as Mock).mockResolvedValue(undefined)
      vi.mocked(clearApiCache).mockClear()

      const panel = await openFirstPRPanel()
      fireEvent.click(within(panel).getByRole('button', { name: 'Close PR' }))

      const confirmDialog = await screen.findByRole('dialog', { name: 'Close this pull request?' })
      fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Close PR' }))

      await waitFor(() => {
        expect(clearApiCache).toHaveBeenCalled()
      })
    })

    it('clicking "Delete branch" opens a confirmation dialog', async () => {
      const panel = await openFirstPRPanel()
      fireEvent.click(within(panel).getByRole('button', { name: 'Delete branch' }))

      await screen.findByRole('dialog', { name: 'Delete branch?' })
    })

    it('cancelling Delete branch dialog does not call deleteBranch', async () => {
      const { deleteBranch: mockDeleteBranch } = await import('./github-api')
      const panel = await openFirstPRPanel()
      fireEvent.click(within(panel).getByRole('button', { name: 'Delete branch' }))

      const confirmDialog = await screen.findByRole('dialog', { name: 'Delete branch?' })
      fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Cancel' }))

      expect(mockDeleteBranch).not.toHaveBeenCalled()
    })

    it('confirming Delete branch calls deleteBranch API', async () => {
      const { deleteBranch: mockDeleteBranch } = await import('./github-api')
      ;(mockDeleteBranch as Mock).mockResolvedValue(undefined)

      const panel = await openFirstPRPanel()
      fireEvent.click(within(panel).getByRole('button', { name: 'Delete branch' }))

      const confirmDialog = await screen.findByRole('dialog', { name: 'Delete branch?' })
      fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Delete branch' }))

      await waitFor(() => {
        expect(mockDeleteBranch).toHaveBeenCalledOnce()
      })
    })

    /* ── Copilot prompt presets ── */

    it('shows "Copilot prompts" toggle in the comment composer', async () => {
      await openFirstPRPanel()
      expect(screen.getByText(/Copilot prompts/i)).toBeInTheDocument()
    })

    it('copilot presets are hidden by default', async () => {
      await openFirstPRPanel()
      // Preset chips should not be visible until toggled
      expect(screen.queryByRole('button', { name: /Review PR/i })).toBeNull()
    })

    it('clicking "Copilot prompts" reveals the preset chips', async () => {
      await openFirstPRPanel()
      fireEvent.click(screen.getByText(/Copilot prompts/i))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Review PR/i })).toBeInTheDocument()
      })
      expect(screen.getByRole('button', { name: /Check performance/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Security audit/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Test coverage/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Summarize/i })).toBeInTheDocument()
    })

    it('clicking a preset fills the comment textarea and hides the presets', async () => {
      await openFirstPRPanel()
      fireEvent.click(screen.getByText(/Copilot prompts/i))

      await waitFor(() => screen.getByRole('button', { name: /Review PR/i }))
      fireEvent.click(screen.getByRole('button', { name: /Review PR/i }))

      const textarea = screen.getByLabelText('Comment body') as HTMLTextAreaElement
      expect(textarea.value).toContain('@copilot')
      expect(textarea.value).toContain('code review')

      // Presets should collapse after selection
      expect(screen.queryByRole('button', { name: /Check performance/i })).toBeNull()
    })

    it('preset body for "Security audit" contains "security"', async () => {
      await openFirstPRPanel()
      fireEvent.click(screen.getByText(/Copilot prompts/i))
      await waitFor(() => screen.getByRole('button', { name: /Security audit/i }))
      fireEvent.click(screen.getByRole('button', { name: /Security audit/i }))

      const textarea = screen.getByLabelText('Comment body') as HTMLTextAreaElement
      expect(textarea.value.toLowerCase()).toContain('security')
    })

    it('preset body for "Summarize" contains "summarize"', async () => {
      await openFirstPRPanel()
      fireEvent.click(screen.getByText(/Copilot prompts/i))
      await waitFor(() => screen.getByRole('button', { name: /Summarize/i }))
      fireEvent.click(screen.getByRole('button', { name: /Summarize/i }))

      const textarea = screen.getByLabelText('Comment body') as HTMLTextAreaElement
      expect(textarea.value.toLowerCase()).toContain('summarize')
    })
  })

  /* ── Copilot Analytics tab ── */

  describe('Copilot Analytics tab', () => {
    beforeEach(seedAuthenticatedState)

    /** Scope helper: find the Copilot tab button inside the view-switcher nav section */
    const getCopilotTabBtn = () => {
      const nav = screen.getByRole('region', { name: /dashboard views/i })
      return within(nav).getByRole('button', { name: /Copilot/i })
    }

    it('shows the Copilot tab button in the view switcher', async () => {
      renderApp()
      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      expect(getCopilotTabBtn()).toBeInTheDocument()
    })

    it('clicking the Copilot tab renders the metrics panel', async () => {
      renderApp()
      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })

      fireEvent.click(getCopilotTabBtn())

      expect(await screen.findByTestId('copilot-metrics-panel')).toBeInTheDocument()
    })

    it('hides RepoSelector when Copilot tab is active', async () => {
      renderApp()
      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })
      await waitFor(() => screen.getByTestId('summary-total'))

      // RepoSelector is visible on the PR tab
      expect(screen.getByLabelText('Add repository')).toBeInTheDocument()

      fireEvent.click(getCopilotTabBtn())
      await screen.findByTestId('copilot-metrics-panel')

      // RepoSelector should be hidden on the Copilot tab
      expect(screen.queryByLabelText('Add repository')).not.toBeInTheDocument()
    })

    it('shows the no-metrics empty state when org has no metrics data', async () => {
      const { fetchCopilotOrgData: mockCopilotOrgData } = await import('./github-api')
      ;(mockCopilotOrgData as Mock).mockResolvedValueOnce({
        type: 'organization',
        target: 'org:thinkdj',
        org: 'thinkdj',
        billing: null,
        metrics: [],
        error: undefined,
      })

      renderApp()
      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })

      fireEvent.click(getCopilotTabBtn())
      await screen.findByTestId('copilot-metrics-panel')

      // org query resolves to empty array; fetchUserOrgs returns [] by default so
      // the panel shows empty-state or no-metrics depending on org list
      expect(screen.getByTestId('copilot-metrics-panel')).toBeInTheDocument()
    })

    it('shows personal Copilot analytics when all tracked repos belong to the authenticated user', async () => {
      const { fetchCopilotOrgData: mockCopilotOrgData, fetchCopilotPersonalData: mockCopilotPersonalData } = await import('./github-api')

      localStorage.setItem(TOKEN_KEY, 'ghp_test_token')
      localStorage.setItem(
        REPOS_KEY,
        JSON.stringify({ repos: ['test-user/my-project', 'test-user/another-repo'], selectedRepos: ['test-user/my-project'] }),
      )

      renderApp()
      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })

      fireEvent.click(getCopilotTabBtn())

      expect(await screen.findByTestId('copilot-metrics-panel')).toBeInTheDocument()

      await waitFor(() => {
        expect(mockCopilotPersonalData).toHaveBeenCalledWith('test-user', expect.any(String))
      })
      expect(mockCopilotOrgData).not.toHaveBeenCalled()

      expect(screen.getByText(/personal copilot pro accounts/i)).toBeInTheDocument()
    })

    it('lets the user switch between organization and personal Copilot analytics', async () => {
      const { fetchCopilotOrgData: mockCopilotOrgData, fetchCopilotPersonalData: mockCopilotPersonalData } = await import('./github-api')

      ;(mockCopilotOrgData as Mock).mockResolvedValueOnce({
        type: 'organization',
        target: 'org:some-org',
        org: 'some-org',
        billing: null,
        metrics: [],
        error: undefined,
      })
      ;(mockCopilotPersonalData as Mock).mockResolvedValueOnce({
        type: 'personal',
        target: 'personal:test-user',
        account: 'test-user',
        usage: [
          {
            product: 'GitHub Copilot',
            sku: 'copilot_pro',
            unitType: 'requests',
            pricePerUnit: 0,
            grossAmount: 0,
            discountAmount: 0,
            netAmount: 0,
            quantity: 12,
          },
        ],
        premiumRequests: [
          {
            product: 'Copilot',
            sku: 'Copilot Premium Request',
            unitType: 'requests',
            pricePerUnit: 0.04,
            grossAmount: 0.96,
            discountAmount: 0.96,
            netAmount: 0,
            grossQuantity: 24,
            netQuantity: 0,
          },
        ],
        error: undefined,
      })

      localStorage.setItem(TOKEN_KEY, 'ghp_test_token')
      localStorage.setItem(
        REPOS_KEY,
        JSON.stringify({
          repos: ['test-user/my-project', 'some-org/their-repo'],
          selectedRepos: ['test-user/my-project', 'some-org/their-repo'],
        }),
      )

      renderApp()
      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })

      fireEvent.click(getCopilotTabBtn())

      await screen.findByTestId('copilot-metrics-panel')

      await waitFor(() => {
        expect(mockCopilotPersonalData).toHaveBeenCalledWith('test-user', expect.any(String))
      })

      const selector = screen.getByLabelText(/account/i)
      expect(within(selector).getByRole('option', { name: /some-org \(organization\)/i })).toBeInTheDocument()
      expect(within(selector).getByRole('option', { name: /test-user \(personal\)/i })).toBeInTheDocument()
      expect((selector as HTMLSelectElement).value).toBe('personal:test-user')
      expect(screen.getAllByText('24').length).toBeGreaterThan(0)

      fireEvent.change(selector, { target: { value: 'org:some-org' } })

      await waitFor(() => {
        expect(mockCopilotOrgData).toHaveBeenCalledWith('some-org', expect.any(String))
      })
      expect(localStorage.getItem(COPILOT_TARGET_KEY)).toBe('org:some-org')
    })

    it('uses the last saved Copilot target when available', async () => {
      const { fetchCopilotOrgData: mockCopilotOrgData, fetchCopilotPersonalData: mockCopilotPersonalData } = await import('./github-api')

      ;(mockCopilotOrgData as Mock).mockResolvedValueOnce({
        type: 'organization',
        target: 'org:some-org',
        org: 'some-org',
        billing: null,
        metrics: [],
        error: undefined,
      })

      localStorage.setItem(TOKEN_KEY, 'ghp_test_token')
      localStorage.setItem(
        REPOS_KEY,
        JSON.stringify({
          repos: ['test-user/my-project', 'some-org/their-repo'],
          selectedRepos: ['test-user/my-project', 'some-org/their-repo'],
        }),
      )
      localStorage.setItem(COPILOT_TARGET_KEY, 'org:some-org')

      renderApp()
      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })

      fireEvent.click(getCopilotTabBtn())
      await screen.findByTestId('copilot-metrics-panel')

      await waitFor(() => {
        expect(mockCopilotOrgData).toHaveBeenCalledWith('some-org', expect.any(String))
      })
      expect(screen.getByLabelText(/account/i)).toHaveValue('org:some-org')
      expect(mockCopilotPersonalData).not.toHaveBeenCalled()
    })

    it('loads organization analytics when organization target is selected', async () => {
      const { fetchCopilotOrgData: mockCopilotOrgData } = await import('./github-api')
      const { fetchUserOrgs: mockUserOrgs } = await import('./github-api')

      ;(mockUserOrgs as Mock).mockResolvedValue(['thinkdj'])
      ;(mockCopilotOrgData as Mock).mockResolvedValue({
        type: 'organization',
        target: 'org:thinkdj',
        org: 'thinkdj',
        billing: {
          seat_breakdown: { total: 10, added_this_cycle: 2, pending_invitation: 1, pending_cancellation: 0, active_this_cycle: 8, inactive_this_cycle: 2 },
          seat_management_setting: 'assign_selected',
          public_code_suggestions: 'allow',
          plan_type: 'business',
        },
        metrics: [
          {
            date: '2024-06-24',
            total_active_users: 8,
            total_engaged_users: 6,
            copilot_ide_code_completions: {
              total_engaged_users: 6,
              languages: [{ name: 'typescript', total_engaged_users: 6, total_code_suggestions: 300, total_code_acceptances: 150, total_code_lines_suggested: 600, total_code_lines_accepted: 300 }],
              editors: [{ name: 'vscode', total_engaged_users: 6, models: [{ name: 'default', is_custom_model: false, custom_model_training_date: null, total_engaged_users: 6, languages: [{ name: 'typescript', total_engaged_users: 6, total_code_suggestions: 300, total_code_acceptances: 150, total_code_lines_suggested: 600, total_code_lines_accepted: 300 }] }] }],
            },
          },
        ],
        error: undefined,
      })
      localStorage.setItem(COPILOT_TARGET_KEY, 'org:thinkdj')

      renderApp()
      await screen.findByRole('heading', { name: 'PR Pulse – The GitHub Control Panel' })

      fireEvent.click(getCopilotTabBtn())
      await screen.findByTestId('copilot-metrics-panel')

      await waitFor(() => {
        expect(mockCopilotOrgData).toHaveBeenCalledWith('thinkdj', expect.any(String))
      }, { timeout: 3000 })
      expect(screen.getByLabelText(/account/i)).toHaveValue('org:thinkdj')
    })
  })
})

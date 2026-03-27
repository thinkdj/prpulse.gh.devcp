import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
}))

import { clearApiCache, fetchRepoBranches, fetchRepoPullRequests } from './github-api'

const TOKEN_KEY = 'gh.devcp.dashboard.token'
const REPOS_KEY = 'gh.devcp.dashboard.repositories'

const defaultRepos = Array.from(new Set(seedPullRequests.map((pr) => pr.repo)))

afterEach(() => {
  cleanup()
  localStorage.clear()
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

describe('GitHub Dev Control Panel', () => {
  /* ── Empty / welcome state (no token) ── */

  it('shows welcome state when no token is configured', async () => {
    renderApp()

    expect(await screen.findByTestId('welcome-state')).toBeInTheDocument()
    expect(screen.getByText(/Welcome to GitHub Dev CP/i)).toBeInTheDocument()
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

    await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })
    fireEvent.click(screen.getByRole('button', { name: /Set token/i }))

    expect(screen.getByLabelText(/GitHub Personal Access Token/i)).toBeInTheDocument()
  })

  /* ── Authenticated dashboard ── */

  describe('with token', () => {
    beforeEach(seedAuthenticatedState)

    it('renders the dashboard and summary widgets', async () => {
      renderApp()

      expect(await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByTestId('summary-total')).toHaveTextContent('5')
      })
    })

    it('filters PRs when a repository is toggled off', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })
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
          repos: ['thinkdj/gh.devcp', 'thinkdj/website'],
          selectedRepos: ['thinkdj/gh.devcp'],
        }),
      )

      renderApp()

      await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })
      await waitFor(() => {
        expect(screen.getByTestId('summary-total')).toHaveTextContent('2')
      })
    })

    it('falls back to empty repos when localStorage has invalid JSON', async () => {
      localStorage.setItem(REPOS_KEY, '{not-valid-json')

      renderApp()

      await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })
      await waitFor(() => {
        expect(screen.getByTestId('summary-total')).toHaveTextContent('0')
      })
    })

    it('persists repository selection changes to localStorage', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

      renderApp()

      await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })
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

      await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })
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

      await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })
      await waitFor(() => {
        expect(screen.getByTestId('summary-total')).toHaveTextContent('5')
      })

      fireEvent.click(screen.getByRole('button', { name: 'Remove thinkdj/website' }))

      await waitFor(() => {
        expect(screen.getByTestId('summary-total')).toHaveTextContent('4')
      })
      expect(screen.queryByRole('button', { name: 'thinkdj/website' })).not.toBeInTheDocument()
    })

    it('shows validation error for invalid repo format', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })

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

      await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })

      const input = screen.getByLabelText('Add repository')
      fireEvent.change(input, { target: { value: 'a/b/c' } })
      fireEvent.submit(input.closest('form')!)

      await waitFor(() => {
        expect(screen.getByText('Use owner/repo format')).toBeInTheDocument()
      })
    })

    it('filters PRs by search query on title', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })
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

      await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })
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

      await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })
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

      await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })
      await waitFor(() => {
        expect(screen.getByText('5 PRs')).toBeInTheDocument()
      })

      const searchInput = screen.getByLabelText('Search pull requests')
      fireEvent.change(searchInput, { target: { value: 'audit' } })

      await waitFor(() => {
        expect(screen.getByText('1 PR')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('✕ Clear filters'))

      await waitFor(() => {
        expect(screen.getByText('5 PRs')).toBeInTheDocument()
      })
    })

    it('filters PRs by label using the column filter', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })
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

      await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })
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

      await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })
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

      await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })
      await waitFor(() => {
        expect(screen.getByTestId('summary-total')).toHaveTextContent('5')
      })

      vi.mocked(clearApiCache).mockClear()
      vi.mocked(fetchRepoPullRequests).mockClear()

      fireEvent.click(screen.getByTitle('Refresh data'))

      expect(clearApiCache).toHaveBeenCalledTimes(1)

      await waitFor(() => {
        expect(fetchRepoPullRequests).toHaveBeenCalled()
      })
    })

    it('shows branch analysis with stale and merged counts', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })
      fireEvent.click(screen.getByRole('button', { name: 'Branch analysis' }))

      await waitFor(() => {
        expect(fetchRepoBranches).toHaveBeenCalledTimes(defaultRepos.length)
      })

      expect(screen.getByTestId('branch-analysis-panel')).toBeInTheDocument()
      expect(screen.getByTestId('branch-summary-stale')).toHaveTextContent('1')
      expect(screen.getByTestId('branch-summary-merged')).toHaveTextContent('2')
      expect(screen.getByText('fix/audit-export')).toBeInTheDocument()
    })

    it('filters branch analysis to stale branches', async () => {
      renderApp()

      await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })
      fireEvent.click(screen.getByRole('button', { name: 'Branch analysis' }))

      await screen.findByTestId('branch-analysis-panel')
      fireEvent.click(screen.getByRole('button', { name: 'Stale' }))

      await waitFor(() => {
        expect(screen.getByTestId('branch-summary-total')).toHaveTextContent('1 of 7 branches shown')
      })

      expect(screen.getByText('fix/audit-export')).toBeInTheDocument()
      expect(screen.queryByText('feat/branch-analysis')).not.toBeInTheDocument()
    })
  })

  /* ── Theme toggle ── */

  it('toggles theme when theme button is clicked', async () => {
    renderApp()

    await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })
    const themeBtn = screen.getByRole('button', { name: /Toggle theme/i })

    // Default is dark → click toggles to light
    fireEvent.click(themeBtn)
    expect(document.documentElement.classList.contains('light')).toBe(true)

    // Click again → toggles back to dark
    fireEvent.click(themeBtn)
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })
})

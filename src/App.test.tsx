import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

afterEach(() => {
  cleanup()
  localStorage.clear()
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

describe('GitHub Dev Control Panel', () => {
  it('renders the dashboard and summary widgets', async () => {
    renderApp()

    expect(await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })).toBeInTheDocument()
    expect(screen.getByText('Practical requirements checklist')).toBeInTheDocument()

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
      'gh.devcp.dashboard.repositories',
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

  it('falls back to defaults when localStorage has invalid JSON', async () => {
    localStorage.setItem('gh.devcp.dashboard.repositories', '{not-valid-json')

    renderApp()

    await screen.findByRole('heading', { name: 'GitHub Dev Control Panel' })
    await waitFor(() => {
      expect(screen.getByTestId('summary-total')).toHaveTextContent('5')
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
    expect(lastCall?.[0]).toBe('gh.devcp.dashboard.repositories')

    const payload = JSON.parse(lastCall?.[1] ?? '{}') as {
      repos?: string[]
      selectedRepos?: string[]
    }
    expect(payload.repos).toContain('thinkdj/website')
    expect(payload.selectedRepos).not.toContain('thinkdj/website')
  })
})

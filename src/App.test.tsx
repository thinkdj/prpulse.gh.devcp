import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
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

    expect(screen.getByTestId('summary-total')).toHaveTextContent('4')
  })
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import App from './App'

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

    expect(await screen.findByText('GitHub Dev Control Panel')).toBeInTheDocument()
    expect(screen.getByText('Practical requirements checklist')).toBeInTheDocument()
    expect(screen.getByTestId('summary-total')).toHaveTextContent('5')
  })

  it('filters PRs when a repository is toggled off', async () => {
    renderApp()

    await screen.findByText('GitHub Dev Control Panel')
    fireEvent.click(screen.getByRole('button', { name: 'thinkdj/website' }))

    expect(screen.getByTestId('summary-total')).toHaveTextContent('4')
  })
})

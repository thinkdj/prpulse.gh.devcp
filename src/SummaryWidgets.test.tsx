import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SummaryWidgets from './components/SummaryWidgets'

afterEach(cleanup)

function renderWidgets(
  overrides: Partial<Parameters<typeof SummaryWidgets>[0]> = {},
) {
  const defaults = {
    total: 10,
    needsReview: 3,
    safeToMerge: 4,
    blocked: 2,
    activeFilter: 'all' as const,
    onFilterClick: vi.fn(),
  }
  return render(<SummaryWidgets {...defaults} {...overrides} />)
}

describe('SummaryWidgets — rendering counts', () => {
  it('displays the total count', () => {
    renderWidgets({ total: 7 })
    expect(screen.getByTestId('summary-total')).toHaveTextContent('7')
  })

  it('displays the needs-review count', () => {
    renderWidgets({ needsReview: 5 })
    expect(screen.getByTestId('summary-needs-review')).toHaveTextContent('5')
  })

  it('displays the safe-to-merge count', () => {
    renderWidgets({ safeToMerge: 6 })
    expect(screen.getByTestId('summary-safe')).toHaveTextContent('6')
  })

  it('displays the blocked count', () => {
    renderWidgets({ blocked: 1 })
    expect(screen.getByTestId('summary-blocked')).toHaveTextContent('1')
  })

  it('displays zero values', () => {
    renderWidgets({ total: 0, needsReview: 0, safeToMerge: 0, blocked: 0 })
    expect(screen.getByTestId('summary-total')).toHaveTextContent('0')
    expect(screen.getByTestId('summary-needs-review')).toHaveTextContent('0')
  })
})

describe('SummaryWidgets — label text', () => {
  it('renders the "Open PRs" label', () => {
    renderWidgets()
    expect(screen.getByText('Open PRs')).toBeInTheDocument()
  })

  it('renders the "Need your review" label', () => {
    renderWidgets()
    expect(screen.getByText('Need your review')).toBeInTheDocument()
  })

  it('renders the "Safe to merge" label', () => {
    renderWidgets()
    expect(screen.getByText('Safe to merge')).toBeInTheDocument()
  })

  it('renders the "Blocked" label', () => {
    renderWidgets()
    expect(screen.getByText('Blocked')).toBeInTheDocument()
  })
})

describe('SummaryWidgets — active filter highlighting', () => {
  it('applies ring styling to the "all" card when activeFilter is "all"', () => {
    renderWidgets({ activeFilter: 'all' })
    const allCard = screen.getByTestId('summary-total').closest('button')
    expect(allCard?.className).toMatch(/ring/)
  })

  it('does NOT apply ring styling to the "safe" card when activeFilter is "all"', () => {
    renderWidgets({ activeFilter: 'all' })
    const safeCard = screen.getByTestId('summary-safe').closest('button')
    expect(safeCard?.className).not.toMatch(/ring/)
  })

  it('applies ring styling to the "needs_review" card when that filter is active', () => {
    renderWidgets({ activeFilter: 'needs_review' })
    const reviewCard = screen.getByTestId('summary-needs-review').closest('button')
    expect(reviewCard?.className).toMatch(/ring/)
  })

  it('applies ring styling to the "safe" card when that filter is active', () => {
    renderWidgets({ activeFilter: 'safe' })
    const safeCard = screen.getByTestId('summary-safe').closest('button')
    expect(safeCard?.className).toMatch(/ring/)
  })

  it('applies ring styling to the "blocked" card when that filter is active', () => {
    renderWidgets({ activeFilter: 'blocked' })
    const blockedCard = screen.getByTestId('summary-blocked').closest('button')
    expect(blockedCard?.className).toMatch(/ring/)
  })
})

describe('SummaryWidgets — click callbacks', () => {
  it('calls onFilterClick with "all" when the total card is clicked', () => {
    const onFilterClick = vi.fn()
    renderWidgets({ onFilterClick })
    fireEvent.click(screen.getByTestId('summary-total').closest('button')!)
    expect(onFilterClick).toHaveBeenCalledWith('all')
  })

  it('calls onFilterClick with "needs_review" when the review card is clicked', () => {
    const onFilterClick = vi.fn()
    renderWidgets({ onFilterClick })
    fireEvent.click(screen.getByTestId('summary-needs-review').closest('button')!)
    expect(onFilterClick).toHaveBeenCalledWith('needs_review')
  })

  it('calls onFilterClick with "safe" when the safe card is clicked', () => {
    const onFilterClick = vi.fn()
    renderWidgets({ onFilterClick })
    fireEvent.click(screen.getByTestId('summary-safe').closest('button')!)
    expect(onFilterClick).toHaveBeenCalledWith('safe')
  })

  it('calls onFilterClick with "blocked" when the blocked card is clicked', () => {
    const onFilterClick = vi.fn()
    renderWidgets({ onFilterClick })
    fireEvent.click(screen.getByTestId('summary-blocked').closest('button')!)
    expect(onFilterClick).toHaveBeenCalledWith('blocked')
  })
})

describe('SummaryWidgets — accessibility', () => {
  it('renders four buttons (one per widget)', () => {
    renderWidgets()
    expect(screen.getAllByRole('button')).toHaveLength(4)
  })

  it('has an aria-label on the section', () => {
    const { container } = renderWidgets()
    const section = container.querySelector('[aria-label="summary widgets"]')
    expect(section).not.toBeNull()
  })
})

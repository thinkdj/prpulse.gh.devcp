import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import StatusBadge from './StatusBadge'

afterEach(cleanup)

/* ── CopilotReview ── */
describe('StatusBadge — copilotReview', () => {
  it('renders "Approved" with success styling', () => {
    render(<StatusBadge kind="copilotReview" value="approved" />)
    expect(screen.getByText('Approved')).toBeInTheDocument()
  })

  it('renders "Changes requested" badge', () => {
    render(<StatusBadge kind="copilotReview" value="changes_requested" />)
    expect(screen.getByText('Changes requested')).toBeInTheDocument()
  })

  it('renders "Commented" badge', () => {
    render(<StatusBadge kind="copilotReview" value="commented" />)
    expect(screen.getByText('Commented')).toBeInTheDocument()
  })

  it('renders "Not run" badge', () => {
    render(<StatusBadge kind="copilotReview" value="not_run" />)
    expect(screen.getByText('Not run')).toBeInTheDocument()
  })
})

/* ── MergeSafety ── */
describe('StatusBadge — mergeSafety', () => {
  it('renders "Safe" badge', () => {
    render(<StatusBadge kind="mergeSafety" value="safe" />)
    expect(screen.getByText('Safe')).toBeInTheDocument()
  })

  it('renders "Blocked" badge', () => {
    render(<StatusBadge kind="mergeSafety" value="blocked" />)
    expect(screen.getByText('Blocked')).toBeInTheDocument()
  })

  it('renders "Pending" badge', () => {
    render(<StatusBadge kind="mergeSafety" value="pending" />)
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })
})

/* ── ChecksStatus ── */
describe('StatusBadge — checksStatus', () => {
  it('renders "Passing" badge', () => {
    render(<StatusBadge kind="checksStatus" value="passing" />)
    expect(screen.getByText('Passing')).toBeInTheDocument()
  })

  it('renders "Failing" badge', () => {
    render(<StatusBadge kind="checksStatus" value="failing" />)
    expect(screen.getByText('Failing')).toBeInTheDocument()
  })

  it('renders "Pending" badge', () => {
    render(<StatusBadge kind="checksStatus" value="pending" />)
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })
})

/* ── BranchStatus ── */
describe('StatusBadge — branchStatus', () => {
  it('renders "Default" badge', () => {
    render(<StatusBadge kind="branchStatus" value="default" />)
    expect(screen.getByText('Default')).toBeInTheDocument()
  })

  it('renders "Active" badge', () => {
    render(<StatusBadge kind="branchStatus" value="active" />)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('renders "Stale" badge', () => {
    render(<StatusBadge kind="branchStatus" value="stale" />)
    expect(screen.getByText('Stale')).toBeInTheDocument()
  })

  it('renders "Merged" badge', () => {
    render(<StatusBadge kind="branchStatus" value="merged" />)
    expect(screen.getByText('Merged')).toBeInTheDocument()
  })
})

/* ── Icon rendering ── */
describe('StatusBadge — icon aria-hidden', () => {
  it('renders an icon with aria-hidden for copilotReview:approved', () => {
    const { container } = render(<StatusBadge kind="copilotReview" value="approved" />)
    const icon = container.querySelector('[aria-hidden="true"]')
    expect(icon).not.toBeNull()
  })

  it('renders an icon with aria-hidden for checksStatus:failing', () => {
    const { container } = render(<StatusBadge kind="checksStatus" value="failing" />)
    const icon = container.querySelector('[aria-hidden="true"]')
    expect(icon).not.toBeNull()
  })
})

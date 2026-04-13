import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConfirmDialog from './components/ConfirmDialog'

afterEach(cleanup)

function renderDialog(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const defaults = {
    isOpen: true,
    title: 'Are you sure?',
    message: 'This cannot be undone.',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }
  return render(<ConfirmDialog {...defaults} {...overrides} />)
}

describe('ConfirmDialog — rendering', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = renderDialog({ isOpen: false })
    expect(container.firstChild).toBeNull()
  })

  it('renders the title and message when open', () => {
    renderDialog({ title: 'Delete item', message: 'This will remove the item forever.' })
    expect(screen.getByText('Delete item')).toBeInTheDocument()
    expect(screen.getByText('This will remove the item forever.')).toBeInTheDocument()
  })

  it('has role="dialog" and aria-modal="true"', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('renders default confirm label "Confirm"', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
  })

  it('renders custom confirm label', () => {
    renderDialog({ confirmLabel: 'Delete forever' })
    expect(screen.getByRole('button', { name: 'Delete forever' })).toBeInTheDocument()
  })

  it('renders default cancel label "Cancel"', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('renders custom cancel label', () => {
    renderDialog({ cancelLabel: 'Go back' })
    expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument()
  })

  it('does not render the danger icon for the default variant', () => {
    const { container } = renderDialog({ variant: 'default' })
    // AlertTriangle is aria-hidden; verify no SVG that conveys danger styling is present
    // (no aria-hidden icon in default mode, or at least no AlertTriangle)
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0)
  })

  it('renders the danger icon (AlertTriangle aria-hidden) for the danger variant', () => {
    const { container } = renderDialog({ variant: 'danger' })
    const icons = container.querySelectorAll('[aria-hidden="true"]')
    expect(icons.length).toBeGreaterThan(0)
  })
})

describe('ConfirmDialog — callbacks', () => {
  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn()
    renderDialog({ onConfirm })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onCancel when clicking the backdrop overlay', () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    // The outer backdrop div is the dialog role element itself
    const dialog = screen.getByRole('dialog')
    // Simulate a click whose target is the backdrop itself
    fireEvent.click(dialog)
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does NOT call onCancel when clicking inside the dialog card', () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    // Click on the title text inside the card (not the backdrop)
    fireEvent.click(screen.getByText('Are you sure?'))
    expect(onCancel).not.toHaveBeenCalled()
  })
})

describe('ConfirmDialog — danger variant styling', () => {
  it('confirm button has a danger class for danger variant', () => {
    renderDialog({ variant: 'danger', confirmLabel: 'Delete' })
    const confirmBtn = screen.getByRole('button', { name: 'Delete' })
    // In danger mode the button class should reference danger colour tokens
    expect(confirmBtn.className).toMatch(/danger/)
  })

  it('confirm button uses accent styling for default variant', () => {
    renderDialog({ variant: 'default', confirmLabel: 'OK' })
    const confirmBtn = screen.getByRole('button', { name: 'OK' })
    expect(confirmBtn.className).toMatch(/accent/)
  })
})

import { useId } from 'react'
import { Warning } from '@phosphor-icons/react'

type ConfirmDialogProps = {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="w-full max-w-sm rounded-lg border border-gh-border bg-gh-surface p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          {variant === 'danger' && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gh-danger/12">
              <Warning className="h-5 w-5 text-gh-danger-fg" aria-hidden="true" />
            </div>
          )}
          <div>
            <h2 id={titleId} className="text-sm font-semibold text-gh-fg">
              {title}
            </h2>
            <p className="mt-1 text-sm text-gh-fg-muted">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gh-border bg-gh-overlay px-3.5 py-1.5 text-sm font-medium text-gh-fg-default transition-colors hover:border-gh-border-hover hover:text-gh-fg"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-md px-3.5 py-1.5 text-sm font-semibold shadow-sm transition ${
              variant === 'danger'
                ? 'bg-gh-danger/15 text-gh-danger-fg hover:bg-gh-danger/25'
                : 'bg-gh-accent text-white hover:shadow-md hover:brightness-110'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

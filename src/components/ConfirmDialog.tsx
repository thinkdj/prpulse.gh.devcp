import { AlertTriangle } from 'lucide-react'

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
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="w-full max-w-sm rounded-lg border border-gh-border bg-gh-surface p-6 shadow-xl">
        <div className="mb-4 flex items-start gap-3">
          {variant === 'danger' && (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-gh-danger-fg" aria-hidden="true" />
          )}
          <div>
            <h2 id="confirm-dialog-title" className="text-sm font-semibold text-gh-fg">
              {title}
            </h2>
            <p className="mt-1 text-sm text-gh-fg-muted">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gh-border bg-gh-overlay px-3 py-1.5 text-sm text-gh-fg-default hover:border-gh-border-hover hover:text-gh-fg"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
              variant === 'danger'
                ? 'border-gh-danger/40 bg-gh-danger/10 text-gh-danger-fg hover:bg-gh-danger/20'
                : 'border-gh-accent bg-gh-accent text-white hover:opacity-90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

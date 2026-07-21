import { useState } from 'react'
import { X, ArrowSquareOut, ShieldCheck } from '@phosphor-icons/react'

type TokenSettingsProps = {
  token: string
  onSaveToken: (token: string) => void | Promise<void>
  currentUser: string
  isVisible: boolean
  onClose: () => void
}

export default function TokenSettings({
  token,
  onSaveToken,
  currentUser,
  isVisible,
  onClose,
}: TokenSettingsProps) {
  if (!isVisible) return null

  return (
    <TokenSettingsForm
      token={token}
      onSaveToken={onSaveToken}
      currentUser={currentUser}
      onClose={onClose}
    />
  )
}

function TokenSettingsForm({
  token,
  onSaveToken,
  currentUser,
  onClose,
}: Omit<TokenSettingsProps, 'isVisible'>) {
  const [draft, setDraft] = useState(token)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSaveToken(draft.trim())
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  const handleClear = async () => {
    setDraft('')
    setIsSaving(true)
    try {
      await onSaveToken('')
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mb-6 rounded-md border border-gh-border bg-gh-surface p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gh-fg">Settings</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          disabled={isSaving}
          className="rounded-full p-1.5 text-gh-fg-muted transition-colors hover:bg-gh-overlay hover:text-gh-fg-default"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="github-token" className="mb-1 block text-xs text-gh-fg-muted">
            GitHub Personal Access Token
          </label>
          <p className="mb-2 text-xs leading-relaxed text-gh-fg-muted">
            Use a <strong>fine-grained token</strong> — read-only access to pull requests and checks
            is enough for the dashboard. The Copilot tab needs more: personal analytics use your
            account&apos;s billing access, and organization analytics may need a classic token with{' '}
            <code>read:org</code> or <code>manage_billing:copilot</code>.{' '}
            <a
              href="https://github.com/settings/personal-access-tokens/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 font-medium text-gh-accent-fg transition-colors hover:text-gh-accent hover:underline"
            >
              Create a token <ArrowSquareOut className="h-3 w-3" />
            </a>
          </p>
          <input
            id="github-token"
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            className="w-full rounded-md border border-gh-border bg-gh-bg px-3.5 py-2 text-sm text-gh-fg-default outline-none transition-colors focus:border-gh-accent focus:ring-2 focus:ring-gh-accent/20"
            autoComplete="off"
            disabled={isSaving}
          />
          <div className="mt-2 flex items-start gap-2 rounded-md border border-gh-accent/30 bg-gh-accent/10 px-3 py-2 text-xs leading-relaxed text-gh-fg-default">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gh-accent-fg" aria-hidden="true" />
            <span>
              <strong>Private by design.</strong> Your token is encrypted (AES-GCM) before it&apos;s
              saved to this browser&apos;s local storage — there&apos;s no backend, and it&apos;s
              sent nowhere but GitHub&apos;s API. <strong>Clear token</strong> removes it instantly;
              a one-way fingerprint is also kept locally for state tracking.
            </span>
          </div>
        </div>

        {currentUser && (
          <p className="text-xs text-gh-success-fg">
            Authenticated as <strong>{currentUser}</strong>
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-md bg-gh-accent px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Save token'}
          </button>
          {token && (
            <button
              type="button"
              onClick={handleClear}
              disabled={isSaving}
              className="rounded-md border border-gh-border bg-gh-bg px-3.5 py-1.5 text-sm font-medium text-gh-fg-muted transition-colors hover:border-gh-danger/40 hover:bg-gh-danger/8 hover:text-gh-danger-fg disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear token
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

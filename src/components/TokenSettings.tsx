import { useState } from 'react'
import { X } from 'lucide-react'

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
    <div className="mb-6 rounded-lg border border-gh-border bg-gh-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gh-fg">Settings</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          disabled={isSaving}
          className="rounded-md p-1 text-gh-fg-muted hover:bg-gh-overlay hover:text-gh-fg-default"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="github-token" className="mb-1 block text-xs text-gh-fg-muted">
            GitHub Personal Access Token
          </label>
          <p className="mb-2 text-xs text-gh-fg-muted">
            Required for fetching live PR data. Recommend a <strong>fine-grained PAT</strong> with
            read-only access to pull requests and checks. For the Copilot tab, personal analytics use your
            account billing usage access and organization analytics may require a classic PAT with{' '}
            <code>read:org</code> or <code>manage_billing:copilot</code>. Token is stored encrypted in this
            browser profile&apos;s localStorage and remains until you clear it; a one-way fingerprint is
            also stored for state tracking.
          </p>
          <input
            id="github-token"
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            className="w-full rounded-md border border-gh-border bg-gh-bg px-3 py-1.5 text-sm text-gh-fg-default outline-none focus:border-gh-accent"
            autoComplete="off"
            disabled={isSaving}
          />
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
            className="rounded-md border border-gh-accent bg-gh-accent px-3 py-1.5 text-sm font-medium text-white"
          >
            {isSaving ? 'Saving…' : 'Save token'}
          </button>
          {token && (
            <button
              type="button"
              onClick={handleClear}
              disabled={isSaving}
              className="rounded-md border border-gh-border bg-gh-bg px-3 py-1.5 text-sm text-gh-fg-muted hover:text-gh-danger-fg"
            >
              Clear token
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

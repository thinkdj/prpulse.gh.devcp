import { useState } from 'react'

type TokenSettingsProps = {
  token: string
  onSaveToken: (token: string) => void
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
  const [draft, setDraft] = useState(token)

  if (!isVisible) return null

  const handleSave = () => {
    onSaveToken(draft.trim())
    onClose()
  }

  const handleClear = () => {
    setDraft('')
    onSaveToken('')
    onClose()
  }

  return (
    <div className="mb-6 rounded-md border border-[#30363d] bg-[#161b22] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-[#f0f6fc]">Settings</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-[#8b949e] hover:text-[#c9d1d9]"
        >
          Close
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="github-token" className="mb-1 block text-xs text-[#8b949e]">
            GitHub Personal Access Token
          </label>
          <p className="mb-2 text-xs text-[#8b949e]">
            Required for fetching live PR data. Needs <code className="rounded bg-[#30363d] px-1">repo</code> scope.
            Token is stored locally in your browser.
          </p>
          <input
            id="github-token"
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm text-[#c9d1d9] outline-none focus:border-[#1f6feb]"
            autoComplete="off"
          />
        </div>

        {currentUser && (
          <p className="text-xs text-[#3fb950]">
            Authenticated as <strong>{currentUser}</strong>
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md border border-[#1f6feb] bg-[#1f6feb] px-3 py-1.5 text-sm font-medium text-white"
          >
            Save token
          </button>
          {token && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm text-[#8b949e] hover:text-[#f85149]"
            >
              Clear token
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

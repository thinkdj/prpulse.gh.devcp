import { useCallback, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { GitHubRepo } from '../github-api'

type RepoPickerModalProps = {
  availableRepos: GitHubRepo[]
  selectedRepos: string[]
  isLoading: boolean
  onSave: (repos: string[]) => void
  onClose: () => void
}

export default function RepoPickerModal({
  availableRepos,
  selectedRepos,
  isLoading,
  onSave,
  onClose,
}: RepoPickerModalProps) {
  const [search, setSearch] = useState('')
  const [checked, setChecked] = useState<Set<string>>(() => new Set(selectedRepos))

  const filtered = useMemo(() => {
    if (!search) return availableRepos
    const q = search.toLowerCase()
    return availableRepos.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q),
    )
  }, [availableRepos, search])

  const toggle = (name: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  const handleSave = () => {
    onSave(Array.from(checked))
    onClose()
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Browse repositories" onKeyDown={handleKeyDown}>
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-gh-border bg-gh-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gh-border px-4 py-3">
          <h2 className="text-sm font-semibold text-gh-fg">Select Repositories</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gh-fg-muted hover:text-gh-fg-default">
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-gh-border px-4 py-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter repositories…"
            aria-label="Filter repositories"
            autoFocus
            className="w-full rounded-md border border-gh-border bg-gh-bg px-3 py-1.5 text-sm text-gh-fg-default placeholder-gh-fg-placeholder outline-none focus:border-gh-accent"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {isLoading ? (
            <p className="px-2 py-8 text-center text-sm text-gh-fg-muted">Loading your repositories…</p>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-gh-fg-muted">
              {search ? 'No repositories match your search.' : 'No repositories found.'}
            </p>
          ) : (
            <ul>
              {filtered.map((repo) => {
                const isChecked = checked.has(repo.full_name)
                return (
                  <li key={repo.full_name}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-gh-accent/10 ${
                        isChecked ? 'bg-gh-accent/5' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(repo.full_name)}
                        className="mt-0.5 accent-gh-accent"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gh-fg-default">{repo.full_name}</p>
                        {repo.description && (
                          <p className="mt-0.5 truncate text-xs text-gh-fg-muted">{repo.description}</p>
                        )}
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gh-fg-muted">
                          {repo.private && <span>🔒 Private</span>}
                          {repo.fork && <span>🍴 Fork</span>}
                        </div>
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gh-border px-4 py-3">
          <span className="text-xs text-gh-fg-muted">
            {checked.size} {checked.size === 1 ? 'repo' : 'repos'} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gh-border px-3 py-1.5 text-sm text-gh-fg-muted hover:text-gh-fg-default"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-md border border-gh-accent bg-gh-accent px-3 py-1.5 text-sm font-medium text-white"
            >
              Save selection
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

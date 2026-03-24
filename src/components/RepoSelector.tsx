import type { FormEvent } from 'react'

type RepoSelectorProps = {
  repos: string[]
  selectedRepos: string[]
  newRepo: string
  repoError: string
  onNewRepoChange: (value: string) => void
  onAddRepo: (event: FormEvent<HTMLFormElement>) => void
  onToggleRepo: (repo: string) => void
  onRemoveRepo: (repo: string) => void
  onBrowseRepos?: () => void
}

export default function RepoSelector({
  repos,
  selectedRepos,
  newRepo,
  repoError,
  onNewRepoChange,
  onAddRepo,
  onToggleRepo,
  onRemoveRepo,
  onBrowseRepos,
}: RepoSelectorProps) {
  return (
    <section className="mb-6 rounded-md border border-gh-border bg-gh-surface p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-sm font-medium text-gh-fg">Repositories</h2>
        <div className="flex items-center gap-2">
          {onBrowseRepos && (
            <button
              type="button"
              onClick={onBrowseRepos}
              className="rounded-md border border-gh-accent bg-gh-accent/10 px-3 py-1.5 text-sm text-gh-accent-fg hover:bg-gh-accent/20"
            >
              Browse repos
            </button>
          )}
          <form onSubmit={onAddRepo} className="flex items-center gap-2">
            <label htmlFor="add-repo-input" className="sr-only">
              Add repository
            </label>
            <div className="flex flex-col">
              <input
                id="add-repo-input"
                value={newRepo}
                onChange={(event) => onNewRepoChange(event.target.value)}
                placeholder="owner/repo"
                aria-invalid={!!repoError}
                aria-describedby={repoError ? 'add-repo-error' : undefined}
                className="rounded-md border border-gh-border bg-gh-bg px-3 py-1.5 text-sm text-gh-fg-default outline-none focus:border-gh-accent"
              />
              {repoError && (
                <span id="add-repo-error" className="mt-1 text-xs text-gh-danger-fg">{repoError}</span>
              )}
            </div>
            <button
              type="submit"
              className="rounded-md border border-gh-accent bg-gh-accent px-3 py-1.5 text-sm font-medium text-white"
            >
              Add
            </button>
          </form>
        </div>
      </div>

      {repos.length === 0 ? (
        <p className="py-2 text-center text-sm text-gh-fg-muted">
          No repositories added yet. Click &quot;Browse repos&quot; or add one manually.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {repos.map((repo) => {
            const active = selectedRepos.includes(repo)
            return (
              <li key={repo} className="group flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onToggleRepo(repo)}
                  className={`rounded-l-full border px-3 py-1 text-xs ${
                    active
                      ? 'border-gh-accent bg-gh-accent/15 text-gh-accent-fg'
                      : 'border-gh-border bg-gh-bg text-gh-fg-muted'
                  }`}
                >
                  {repo}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveRepo(repo)}
                  aria-label={`Remove ${repo}`}
                  className={`rounded-r-full border border-l-0 px-1.5 py-1 text-xs opacity-50 hover:opacity-100 ${
                    active
                      ? 'border-gh-accent bg-gh-accent/15 text-gh-danger-fg hover:bg-gh-danger-fg/15'
                      : 'border-gh-border bg-gh-bg text-gh-danger-fg hover:bg-gh-danger-fg/15'
                  }`}
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

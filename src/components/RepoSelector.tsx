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
    <section className="mb-6 rounded-lg border border-gh-border bg-gh-surface">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gh-border px-4 py-3">
        <h2 className="mr-auto text-sm font-semibold text-gh-fg">
          Repositories
          {repos.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gh-fg-muted">
              {selectedRepos.length}/{repos.length} active
            </span>
          )}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {onBrowseRepos && (
            <button
              type="button"
              onClick={onBrowseRepos}
              className="rounded-md border border-gh-accent bg-gh-accent/10 px-3 py-1.5 text-xs font-medium text-gh-accent-fg hover:bg-gh-accent/20 transition-colors"
            >
              + Browse repos
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
                className="rounded-md border border-gh-border bg-gh-bg px-3 py-1.5 text-xs text-gh-fg-default outline-none focus:border-gh-accent"
              />
              {repoError && (
                <span id="add-repo-error" className="mt-1 text-xs text-gh-danger-fg">{repoError}</span>
              )}
            </div>
            <button
              type="submit"
              className="rounded-md border border-gh-accent bg-gh-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
            >
              Add
            </button>
          </form>
        </div>
      </div>

      {/* Repo grid */}
      {repos.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-gh-fg-muted">No repositories added yet.</p>
          <p className="mt-1 text-xs text-gh-fg-placeholder">Click &quot;+ Browse repos&quot; or type <code className="rounded bg-gh-overlay px-1 py-0.5 font-mono text-gh-fg-muted">owner/repo</code> above.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {repos.map((repo) => {
            const active = selectedRepos.includes(repo)
            const [owner, repoName] = repo.split('/')
            return (
              <li key={repo} className="group relative">
                <button
                  type="button"
                  onClick={() => onToggleRepo(repo)}
                  aria-label={repo}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left transition-all ${
                    active
                      ? 'border-gh-accent bg-gh-accent/10 shadow-sm'
                      : 'border-gh-border bg-gh-bg hover:border-gh-border-hover'
                  }`}
                >
                  {/* Active indicator dot */}
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        active ? 'bg-gh-accent' : 'bg-gh-border'
                      }`}
                    />
                    <span className={`text-[10px] font-medium uppercase tracking-wide ${
                      active ? 'text-gh-accent-fg' : 'text-gh-fg-placeholder'
                    }`}>
                      {active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <p className="text-[10px] text-gh-fg-muted">{owner}/</p>
                  <p className={`truncate text-xs font-semibold leading-tight ${
                    active ? 'text-gh-fg' : 'text-gh-fg-muted'
                  }`}>
                    {repoName}
                  </p>
                </button>
                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => onRemoveRepo(repo)}
                  aria-label={`Remove ${repo}`}
                  className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gh-surface text-[9px] text-gh-fg-muted opacity-0 transition-opacity hover:bg-gh-danger/20 hover:text-gh-danger-fg group-hover:opacity-100"
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

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
}: RepoSelectorProps) {
  return (
    <section className="mb-6 rounded-md border border-[#30363d] bg-[#161b22] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-sm font-medium text-[#f0f6fc]">Repositories</h2>
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
              className="rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm text-[#c9d1d9] outline-none focus:border-[#1f6feb]"
            />
            {repoError && (
              <span id="add-repo-error" className="mt-1 text-xs text-[#f85149]">{repoError}</span>
            )}
          </div>
          <button
            type="submit"
            className="rounded-md border border-[#1f6feb] bg-[#1f6feb] px-3 py-1.5 text-sm font-medium text-white"
          >
            Add
          </button>
        </form>
      </div>

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
                    ? 'border-[#1f6feb] bg-[#1f6feb]/15 text-[#58a6ff]'
                    : 'border-[#30363d] bg-[#0d1117] text-[#8b949e]'
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
                    ? 'border-[#1f6feb] bg-[#1f6feb]/15 text-[#f85149] hover:bg-[#f85149]/15'
                    : 'border-[#30363d] bg-[#0d1117] text-[#f85149] hover:bg-[#f85149]/15'
                }`}
              >
                ✕
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

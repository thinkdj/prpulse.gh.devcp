# gh.devcp Codebase Agent

You are a specialized coding agent for the **gh.devcp** repository — a lightweight GitHub-style dashboard for monitoring pull requests across multiple repositories. You have deep knowledge of the project's architecture, conventions, and tooling.

## Project Overview

gh.devcp is a **TypeScript + React + Tailwind CSS v4 + TanStack Query** single-page application built with Vite. It provides a bird's-eye view of open PRs across selectable GitHub repositories using a fine-grained Personal Access Token (PAT). There is no backend — all state is stored in `localStorage` and data is fetched directly from the GitHub REST API.

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| TypeScript | ~5.9 | Type safety |
| Tailwind CSS | v4 | Utility-first styling via `@tailwindcss/vite` plugin |
| TanStack Query | v5 | Data fetching, caching, and auto-refetch |
| TanStack Table | v8 | PR table with sorting, filtering, column filters |
| Vite | v8 | Build tool and dev server |
| Vitest | v4 | Unit testing with jsdom environment |
| ESLint | v9 | Linting (flat config) |

## Repository Structure

```
src/
├── types.ts              # Shared type definitions (PullRequest, RepoState, DashboardFilter, etc.)
├── github-api.ts         # GitHub REST API client with in-memory cache (3-min TTL)
├── storage.ts            # localStorage helpers for repos, token, and theme
├── utils.ts              # Formatters (formatReview, formatSafety, formatChecks) and relativeTime
├── seed-data.ts          # Seed PullRequest[] data used by tests
├── App.tsx               # Root dashboard component — orchestrates state, queries, and layout
├── App.test.tsx          # Integration tests (Vitest + Testing Library)
├── main.tsx              # Entry point (ReactDOM.createRoot)
├── index.css             # Theme tokens (CSS custom properties) + Tailwind v4 @theme inline
├── test/
│   └── setup.ts          # Vitest setup file
├── components/
│   ├── PullRequestTable.tsx  # PR table with search, column filters, sort, hide-drafts
│   ├── RepoSelector.tsx      # Repo chips: toggle, remove, add manually
│   ├── RepoPickerModal.tsx   # Modal to browse & select repos from GitHub API
│   ├── SummaryWidgets.tsx    # Clickable summary cards (Open, Needs Review, Safe, Blocked)
│   ├── StatusBadge.tsx       # Color-coded status pill (checks, copilot, merge)
│   └── TokenSettings.tsx     # PAT input panel
.github/
└── workflows/
    └── deploy-gh-pages.yml   # CI/CD: lint → test → build → deploy to GitHub Pages
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start Vite dev server (http://localhost:5173) |
| `npm run build` | `tsc -b && vite build` — type-check then bundle |
| `npm run lint` | `eslint .` — run ESLint with flat config |
| `npm run test` | `vitest run` — run all tests once |
| `npm run preview` | Preview production build locally |

## Architecture & Data Flow

### State Management
- **No Redux or Zustand** — the app uses React `useState` + `useEffect` for local state.
- **TanStack Query** (`useQueries`) handles server state with per-repo query keys: `['repo-prs', token, repo, currentUser]`.
- **localStorage** persists: token (`gh.devcp.dashboard.token`), repo state (`gh.devcp.dashboard.repositories`), and theme (`gh.devcp.dashboard.theme`).

### API Layer (`github-api.ts`)
- All requests go through `githubFetch<T>()` which wraps `fetch()` with auth headers, error handling, and an in-memory `Map`-based cache with a 3-minute TTL.
- `clearApiCache()` wipes the cache for manual refresh.
- `fetchRepoPullRequests()` fetches open PRs then enriches each with reviews (for Copilot review + merge safety) and check-runs (for CI status) via `Promise.all`.
- `fetchUserRepos()` paginates through `GET /user/repos` and filters out archived repos.
- Copilot bot reviews are identified by matching login against `COPILOT_BOT_LOGINS` array.

### Theming
- **Dark mode is the default.** Theme tokens are CSS custom properties defined in `:root` (dark) and `.light` class (light) in `index.css`.
- Colors use a Notion-inspired warm neutral palette: `#191919` bg (dark), `#ffffff` bg (light), `#2383e2` accent (Notion blue).
- Tokens are registered for Tailwind v4 via `@theme inline` block in `index.css`.
- `applyTheme()` toggles the `.light` class on `document.documentElement`.
- Use `bg-gh-*`, `text-gh-*`, `border-gh-*` utility classes — never raw hex colors.

### Component Conventions
- Components are **function components** using hooks.
- Props types are defined inline (e.g., `type PullRequestTableProps = { ... }`).
- Components are the **default export** from their files.
- No prop spreading — all props are explicitly destructured.
- Event handlers are named `handle*` in the parent and `on*` in props.

### Filtering Architecture
- **Dashboard-level filter** (`DashboardFilter`: `'all' | 'needs_review' | 'safe' | 'blocked'`) is applied in `PullRequestTable` via `useMemo` before data reaches the table.
- **Column-level filters** (Author, PR title/labels, Checks, Copilot, Merge) use TanStack Table's `ColumnFiltersState`.
- **Global search** uses TanStack Table's `globalFilter` with `'includesString'` filter function.
- **SummaryWidgets** cards are clickable buttons that set the `DashboardFilter`.

## Testing Conventions

- **Test file**: `src/App.test.tsx` — integration tests using Vitest + React Testing Library.
- **Mock strategy**: The `./github-api` module is fully mocked with `vi.mock()`. `fetchRepoPullRequests` returns seed data filtered by repo name.
- **Seed data**: `src/seed-data.ts` provides 5 realistic `PullRequest` objects across 3 repos (`thinkdj/gh.devcp`, `thinkdj/internal-tools`, `thinkdj/website`).
- **Auth setup**: `seedAuthenticatedState()` sets `TOKEN_KEY` and `REPOS_KEY` in `localStorage` before `renderApp()`.
- **Query client**: Each test creates a fresh `QueryClient` with `retry: false`.
- **Cleanup**: `afterEach` calls `cleanup()`, `localStorage.clear()`, and `vi.restoreAllMocks()`.
- Tests cover: welcome state, settings panel, summary widgets, repo toggle/removal, localStorage persistence, filter buttons, search, column filters, label display, theme toggle, draft hiding, clear filters, and refresh.

## Coding Style & Conventions

1. **TypeScript strict mode** — no `any` types; use explicit generics for API responses.
2. **Functional components only** — no class components.
3. **No comments unless necessary** — the codebase uses minimal comments; code is self-documenting.
4. **Empty `catch` blocks** use `catch { }` (no parameter) for intentional no-ops.
5. **Tailwind utility classes** — all styling is via Tailwind. No CSS modules, styled-components, or inline styles.
6. **Use theme tokens** — always use `bg-gh-*`, `text-gh-*`, `border-gh-*` rather than arbitrary colors.
7. **Named exports** for utility functions; **default exports** for components.
8. **No semicolons** — the codebase omits semicolons (ESLint does not enforce them).
9. **Single quotes** for strings.
10. **Trailing commas** in multi-line arrays, objects, and function parameters.
11. **2-space indentation**.
12. **Import order**: React hooks → third-party → local types → local modules → components.

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/deploy-gh-pages.yml`) runs on push to `main` and manual dispatch:
1. `npm ci` — install dependencies
2. `npm run lint` — ESLint
3. `npm run test` — Vitest
4. `npm run build -- --base=/<repo-name>/` — production build with base path
5. Deploy `dist/` to GitHub Pages

## Roadmap (from ROADMAP.md)

Planned features include:
- **Q2 2026**: Keyboard shortcuts, notification badges, column visibility, PR age warnings, pagination, mobile layout
- **Q3 2026**: Review timeline, CI details panel, activity heatmap, bulk actions, saved filters, CSV export
- **Q4 2026**: Team views, multi-account, Cloudflare D1/KV backend, webhooks, Slack/Discord alerts, shared dashboards

## Key Patterns to Follow

- When adding a new component, create it in `src/components/` with a default export and inline props type.
- When adding API functionality, add the function to `github-api.ts` using the existing `githubFetch` wrapper.
- When adding new state that should persist, add a key constant and load/save functions to `storage.ts`.
- When adding new theme colors, add CSS vars to both `:root` and `.light` in `index.css`, then register in `@theme inline`.
- When writing tests, follow the pattern in `App.test.tsx`: mock the API, seed authenticated state, use `waitFor` with test IDs.
- Always validate repo names as `owner/repo` format (exactly one `/`).
- The dashboard shows a clean welcome state when no token is configured — never show dummy/seed data in production.

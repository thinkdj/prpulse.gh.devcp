# PR Pulse Codebase Agent

You are a specialized coding agent for the **PR Pulse** (`prpulse.gh.devcp`) repository — a lightweight GitHub control panel for monitoring pull requests, branches, and Copilot analytics across multiple repositories. You have deep knowledge of the project's architecture, conventions, and tooling.

## Project Overview

PR Pulse is a **TypeScript + React + Tailwind CSS v4 + TanStack Query + TanStack Table** single-page application built with Vite. It provides a bird's-eye view of open PRs across selectable GitHub repositories using a fine-grained Personal Access Token (PAT). There is no backend — all state lives in `localStorage` and data is fetched directly from the GitHub REST API. A demo mode (`?demo=true`) renders the full dashboard from synthetic fixtures with no token.

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

`react-markdown` + `remark-gfm` render PR comment bodies; `@phosphor-icons/react` supplies icons.

## Repository Structure

```
src/
├── types.ts              # Shared type definitions (PullRequest, BranchAnalysis, Copilot metrics, etc.)
├── github-api.ts         # GitHub REST API client with in-memory GET cache (3-min TTL)
├── storage.ts            # localStorage helpers (repos, theme/mode, encrypted token)
├── utils.ts              # Formatters (formatReview, formatSafety, formatChecks) and relative-time
├── seed-data.ts          # Seed PullRequest[] / BranchAnalysis[] used by tests
├── demo-data.ts          # Synthetic fixtures for demo mode (?demo=true), lazy-loaded
├── App.tsx               # Root dashboard — orchestrates state, queries, and layout
├── main.tsx              # Entry point (ReactDOM.createRoot)
├── index.css             # Theme tokens (CSS custom properties) + Tailwind v4 @theme inline
├── hooks/
│   └── useCopyFeedback.ts    # Copy-to-clipboard feedback state
├── test/
│   └── setup.ts              # Vitest setup file
├── components/
│   ├── PullRequestTable.tsx  # PR table: search, column filters, sort, hide toggles
│   ├── SummaryWidgets.tsx    # Clickable summary cards (Open, Needs Review, Safe, Blocked)
│   ├── RepoSelector.tsx      # Repo chips: toggle, remove, add manually
│   ├── RepoPickerModal.tsx   # Modal to browse & select repos from the GitHub API
│   ├── BranchAnalysisPanel.tsx   # Stale/merged/active branch analysis per repo
│   ├── ActionRequiredPanel.tsx   # "My actions" — reviews requested + your at-risk PRs
│   ├── CopilotMetricsPanel.tsx   # Org + personal Copilot analytics
│   ├── PRDetailPanel.tsx     # PR side panel: metadata, diff stats, activity, comment/close
│   ├── TokenSettings.tsx     # PAT input + encryption/privacy notice
│   ├── StatusBadge.tsx       # Color-coded status pill (checks, Copilot, merge)
│   ├── ConfirmDialog.tsx     # Reusable confirm modal
│   ├── CommentMarkdown.tsx   # Markdown renderer for PR comments
│   └── CopyClipboardIconButton.tsx
└── *.test.ts(x)          # Vitest + Testing Library suites, beside the code they cover
.github/
├── agents/codebase-agent.md    # This file
└── workflows/deploy-gh-pages.yml   # CI/CD: lint → test → build → deploy to GitHub Pages
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
- **TanStack Query** (`useQueries`) handles server state with per-repo query keys, e.g. `['repo-prs', token, repo, currentUser]`.
- **localStorage** persists (all keys prefixed `prpulse.gh.devcp.dashboard.`): `repositories`, `theme`, `mode`, `copilotTarget`, an encrypted token (`token.encrypted`), and a one-way token fingerprint (`token`). The decrypted token is mirrored to `sessionStorage` (`token.session`) for the session.

### Token Storage (`storage.ts`)
- The PAT is encrypted with **AES-GCM via the Web Crypto API** before being written to `localStorage`; the key is derived from a fixed context string plus origin/user-agent. There is no backend — the token is only ever sent to GitHub's API.
- A one-way SHA-256 fingerprint is stored for state tracking (never the raw token).

### API Layer (`github-api.ts`)
- All requests go through a `githubFetch` wrapper around `fetch()` with auth headers, error handling, and an in-memory `Map` cache with a 3-minute TTL. `clearApiCache()` wipes it for manual refresh.
- `fetchRepoPullRequests()` fetches open PRs then enriches each with reviews (Copilot review + merge safety) and check-runs (CI status).
- Copilot analytics: `fetchCopilotOrgData()` (org metrics/billing) and `fetchCopilotPersonalData()` (personal billing + premium-request usage).
- Write actions used by the PR detail panel: `postPRComment()` (Issues comments endpoint), `closePR()` (pulls PATCH), `deleteBranch()` (git refs DELETE) — all require write access.

### Theming
- Six palettes defined as CSS custom properties in `index.css`: **Azure (default)**, Warm, Slate, Ocean, Ember, Zinc — each with dark and light values. A separate light/dark **mode** applies on top. The default is **Azure + light**.
- `applyTheme()` toggles palette/`.light` classes on `document.documentElement`.
- Use `bg-gh-*`, `text-gh-*`, `border-gh-*` utility classes — never raw hex colors.

### Views / Tabs
- **Pull requests** (table + summary widgets), **My actions** (reviews requested + your at-risk PRs), **Branch analysis** (on-demand per-repo run), **Copilot** (org + personal analytics).

### Filtering Architecture
- **Dashboard-level filter** (`DashboardFilter`: `'all' | 'needs_review' | 'safe' | 'blocked'`) is applied before data reaches the table.
- **Column-level filters** use TanStack Table's `ColumnFiltersState`; **global search** uses `globalFilter`. Quick-hide toggles cover drafts, Copilot, Dependabot, and your own PRs.

## Testing Conventions

- **Framework**: Vitest + React Testing Library (jsdom). Suites live beside the code they cover (`*.test.ts` / `*.test.tsx`).
- **Integration**: `src/App.test.tsx` mocks the `./github-api` module with `vi.mock()`; `fetchRepoPullRequests` returns seed data filtered by repo name.
- **Seed data**: `src/seed-data.ts` provides 5 `PullRequest` objects across 3 sample repos (`thinkdj/prpulse.gh.devcp`, `acme/internal-tools`, `acme/website`) plus branch fixtures. Sample repo owners other than this repo are fictional placeholders.
- **Auth setup**: `seedAuthenticatedState()` seeds token + repo keys in `localStorage` before `renderApp()`.
- **Cleanup**: `afterEach` runs `cleanup()`, clears storage, and restores mocks.

## Coding Style & Conventions

1. **TypeScript strict mode** — avoid `any`; use explicit generics for API responses.
2. **Functional components only** — no class components.
3. **Comments** explain non-obvious intent or constraints; don't narrate what the code already says.
4. **Empty `catch` blocks** use `catch { }` (no parameter) for intentional no-ops (e.g. restricted `localStorage`).
5. **Tailwind utility classes** for all styling — no CSS modules, styled-components, or inline styles.
6. **Theme tokens** — always `bg-gh-*`, `text-gh-*`, `border-gh-*` rather than arbitrary colors.
7. **Named exports** for utilities; **default exports** for components.
8. **No semicolons**; **single quotes**; **2-space indentation**; **trailing commas** in multi-line literals.
9. **Inline props types** (e.g. `type PullRequestTableProps = { ... }`), explicitly destructured — no prop spreading.
10. **Event handlers** named `handle*` in the parent, `on*` in props.

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/deploy-gh-pages.yml`) runs on push to `main` and manual dispatch:
1. `npm ci` — install dependencies
2. `npm run lint` — ESLint
3. `npm run test` — Vitest
4. `npm run build` — production build (base path via the `VITE_BASE_PATH` env var; defaults to `/`, which suits the custom domain `prpulse.32mb.dev`)
5. Deploy `dist/` to GitHub Pages

## Key Patterns to Follow

- New component → `src/components/` with a default export and inline props type; add a `*.test.tsx` beside it.
- New API call → add to `github-api.ts` using the existing `githubFetch` wrapper.
- New persisted state → add a key constant and load/save functions to `storage.ts`.
- New theme color → add CSS vars to every palette (and its `.light` variant) in `index.css`, then register in `@theme inline`.
- Always validate repo names as `owner/repo` (exactly one `/`).
- The dashboard shows a clean welcome/empty state when no token is configured — never show dummy/seed data in production.

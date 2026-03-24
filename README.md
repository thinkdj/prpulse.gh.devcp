# GitHub Dev Control Panel (gh.devcp)

A lightweight GitHub-style dashboard for personal repositories with many collaborators and frequent pull requests.

Built with **TypeScript + React + Tailwind CSS + TanStack Query** using Vite.

## What this dashboard solves

When notifications become noisy, this dashboard gives a bird's-eye view of PRs that need your attention across selectable repositories.

## Dashboard preview

![Dashboard preview](./public/dashboard-preview.png)

## Features

- **Live GitHub API integration** — fetches open PRs, reviews, and check-run status in real time using your GitHub PAT
- **Repository picker modal** — browse your GitHub repos with checkboxes; also supports manual owner/repo entry
- **Repository selector** — toggle and remove tracked repositories; selection persists in localStorage
- **Summary widgets** — clickable at-a-glance counts for open PRs, items needing your review, safe-to-merge, and blocked
- **Color-coded status badges** — visual indicators for CI checks, Copilot review state, and merge safety
- **Dark / light theme toggle** — switch between dark and light modes; preference persisted in localStorage
- **PR search and filtering** — search by title/author/number, filter by author/repo/label dropdowns, hide drafts
- **Sortable columns** — click column headers to sort by PR title, author, opened date, or pushes
- **Relative time display** — "3d ago" instead of raw dates, with full timestamp on hover; color-coded by age
- **"Needs your review" highlighting** — amber dot and subtle background on PRs awaiting your review
- **Draft PR indicator** — clearly marks draft PRs in the table
- **Label display** — color-coded labels on each PR row, clickable to filter
- **Push count tracking** — highlights PRs with many pushes after opening (potential re-review candidates)
- **Auto-refresh** — data refreshes every 5 minutes; manual refresh button available
- **Error handling** — clear messages for auth failures, rate limits, and API errors
- **Clean zero state** — welcoming empty state when no token is configured; no dummy data

## Architecture

```
src/
├── types.ts              # Shared type definitions
├── github-api.ts         # GitHub REST API client
├── storage.ts            # localStorage helpers (repos, token & theme)
├── utils.ts              # Formatters and relative-time helper
├── seed-data.ts          # Seed data for tests
├── components/
│   ├── StatusBadge.tsx   # Color-coded status pill
│   ├── SummaryWidgets.tsx# Clickable summary cards
│   ├── RepoSelector.tsx  # Repo add/toggle/remove UI
│   ├── RepoPickerModal.tsx # Browse & select repos modal
│   ├── PullRequestTable.tsx # PR table with filter bar
│   └── TokenSettings.tsx # PAT input panel
├── App.tsx               # Dashboard orchestrator
├── App.test.tsx          # Component & integration tests
├── main.tsx              # Entry point
├── index.css             # Theme tokens & global styles
└── test/
    └── setup.ts          # Vitest setup
```

- **Storage:** `localStorage` for repo selection and token (local-first, no backend needed)
- **Data fetching:** GitHub REST API via `fetch` with TanStack Query for caching, refetch, and error handling
- **UI:** GitHub-inspired dark theme with Tailwind CSS utility classes

If you later need multi-device sync, audit history, or team-shared state, Cloudflare Wrangler services (D1/KV) can be added as a next step.

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:5173, click **Set token**, and paste a GitHub fine-grained Personal Access Token with read-only access to the repositories you want to monitor (pull requests, checks, and metadata).

### Required token permissions

Use a **fine-grained Personal Access Token** scoped to the repositories (or the entire account) you want to monitor.

| Permission | Access | Used for |
|---|---|---|
| **Pull requests** | Read-only | Fetch open PRs, reviews, and requested reviewers |
| **Checks** | Read-only | Fetch CI check-run statuses for each PR |
| **Metadata** | Read-only | List your repositories in the repo picker |

> **Security note:** The token is stored in your browser's `localStorage` so it persists between sessions.
> For best security, use a **fine-grained Personal Access Token** with the minimum required permissions
> (read-only access to pull requests, checks, and repository metadata). Avoid classic tokens with broad
> scopes. If you suspect your browser environment may be compromised, use a short-lived token or clear
> it after each session via the settings panel.

## Scripts

- `npm run dev` — start development server
- `npm run lint` — run ESLint
- `npm run test` — run unit tests (Vitest)
- `npm run build` — type-check and build
- `npm run preview` — preview production build

## GitHub Pages CI/CD

- Workflow file: `.github/workflows/deploy-gh-pages.yml`
- Deploys automatically on pushes to `main` and supports manual dispatch.
- CI/CD pipeline runs `npm ci`, `npm run lint`, `npm run test`, and then builds with:
  - `npm run build -- --base=/<repo-name>/`
- Build output from `dist/` is published via GitHub Pages actions.

## Testing

Focused tests validate:

- Dashboard renders summary widgets with seed data
- Repository toggle filters visible PR counts
- localStorage hydration and persistence
- Invalid JSON fallback to defaults
- Settings panel visibility toggle
- PR filter buttons (All / Needs review)
- Repository removal

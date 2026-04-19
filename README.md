# PR Pulse – The GitHub Control Panel

A lightweight GitHub control panel for monitoring pull requests, branches, and Copilot analytics across your repositories.

Built with **TypeScript + React + Tailwind CSS + TanStack Query** using Vite.

## What it solves

When notifications become noisy, this dashboard gives a bird's-eye view of PRs that need your attention across selectable repositories.

<img src="./public/dashboard-preview.png" alt="Dashboard preview" style="border-radius: 6px;" />
<figcaption><em>Dashboard preview with repository filters, summary widgets, and PR status indicators.</em></figcaption>

## Features

- **Live GitHub API integration** — fetches open PRs, reviews, and check-run status in real time using your GitHub PAT
- **Repository picker modal** — browse your GitHub repos with checkboxes; also supports manual owner/repo entry
- **Repository selector** — toggle and remove tracked repositories; selection persists in localStorage
- **Summary widgets** — clickable at-a-glance counts for open PRs, items needing your review, safe-to-merge, and blocked
- **Color-coded status badges** — visual indicators for CI checks, Copilot review state, and merge safety
- **Theme palettes + dark / light** — Slate (default), Warm, Ocean, Ember; brightness toggle; preferences in `localStorage`
- **My actions** — tab surfacing PRs that need your review and related follow-ups
- **Branch analysis** — optional per-repo run: stale / merged / active branch table, search, copy branch name, GitHub links
- **Copilot Analytics** — org-level Copilot usage metrics: seat utilisation, engagement rate, acceptance rate, daily trend chart, language/editor/model breakdowns (requires `manage_billing:copilot` or `read:org` token scope)
- **PR search and filtering** — search by title/author/number, filter by author/repo/label dropdowns, hide drafts / Copilot / yours
- **Sortable columns** — sort by title, repo, author, opened, updated, checks, Copilot, merge safety, pushes, comments
- **Relative time** — e.g. "5 minutes ago" (full datetime on hover); color-coded by age where relevant
- **PR detail side panel** — metadata, activity thread, optional comment (needs write permission on the repo)
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
├── types.ts              # Shared type definitions (PullRequest, BranchAnalysis, Copilot metrics)
├── github-api.ts         # GitHub REST API client
├── storage.ts            # localStorage helpers (repos, token & theme)
├── utils.ts              # Formatters and relative-time helper
├── seed-data.ts          # Seed data for tests
├── components/
│   ├── StatusBadge.tsx, SummaryWidgets.tsx, RepoSelector.tsx, RepoPickerModal.tsx
│   ├── PullRequestTable.tsx, TokenSettings.tsx, PRDetailPanel.tsx, ConfirmDialog.tsx
│   ├── BranchAnalysisPanel.tsx, ActionRequiredPanel.tsx
│   ├── CopilotMetricsPanel.tsx
├── App.tsx               # Dashboard orchestrator
├── App.test.tsx          # Component & integration tests
├── main.tsx              # Entry point
├── index.css             # Theme tokens & global styles
└── test/
    └── setup.ts          # Vitest setup
```

- **Storage:** `localStorage` for repo selection and token (local-first, no backend needed)
- **Data fetching:** GitHub REST API via `fetch` with TanStack Query for caching, refetch, and error handling
- **UI:** GitHub-inspired styling with Tailwind CSS; in-memory response cache (~3 min TTL) for GETs

If you later need multi-device sync, audit history, or team-shared state, Cloudflare Wrangler services (D1/KV) can be added as a next step.

## GitHub API usage and rate limits

Figures below are **typical for github.com REST** with a valid token; see [GitHub’s rate limit docs](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) for the source of truth (limits can change).

| Context                          | Rough limit                                           |
| -------------------------------- | ----------------------------------------------------- |
| **Authenticated** (PAT or OAuth) | **5,000 requests/hour** per user (primary REST limit) |
| **Unauthenticated**              | **60 requests/hour** (this app always uses a token)   |

GitHub may also apply **secondary** throttling (e.g. concurrent requests, abuse detection). The UI surfaces **403** responses when the primary hourly budget is exhausted.

**Rough request cost (order of magnitude):**

- **PR dashboard (per repo, per refresh):** list open PRs, then per PR fetches for reviews + check runs (cached ~3 minutes in-app).
- **Branch analysis (per repo, per run):** one repo metadata call, paginated branch list, then **~2 calls per branch** (commit + compare vs default). Large repos can mean **hundreds** of calls in one run—use a subset of repos or rerun sparingly if you hit limits.

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:5173, click **Set token**, and paste a GitHub fine-grained Personal Access Token with read-only access to the repositories you want to monitor (pull requests, checks, and metadata).

### Required token permissions

Use a **fine-grained Personal Access Token** scoped to the repositories (or the entire account) you want to monitor.

| Permission        | Access    | Used for                                         |
| ----------------- | --------- | ------------------------------------------------ |
| **Pull requests** | Read-only | Fetch open PRs, reviews, and requested reviewers |
| **Checks**        | Read-only | Fetch CI check-run statuses for each PR          |
| **Metadata**      | Read-only | List your repositories in the repo picker        |

Branch listing and comparisons may require **Contents: Read** (or broader repo access) on fine-grained tokens for private repositories—if analysis fails with 403, widen read access for those repos.

#### Copilot Analytics tab

The **Copilot Analytics** tab uses additional org-level APIs. Grant these **organisation-level** permissions on a **classic PAT** (or add an OAuth scope):

| Scope / Permission              | Access    | Used for                                                    |
| ------------------------------- | --------- | ----------------------------------------------------------- |
| `read:org`                      | Read-only | List org memberships, fetch Copilot usage metrics           |
| `manage_billing:copilot`        | Read-only | Fetch seat breakdown and billing details                    |

> **Note:** Copilot usage metrics (`/orgs/{org}/copilot/metrics`) require the token owner to be an **org owner or billing manager** in the target organisation. The panel shows a helpful error banner if the token lacks sufficient access. Personal GitHub accounts are not supported — GitHub does not provide a personal Copilot metrics API.

> **Premium requests percentage** (as shown in GitHub's billing UI) is not available through the public GitHub REST API. The dashboard instead surfaces the acceptance rate, seat utilisation, and engagement rate as the key quality and adoption indicators.

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
- Branch analysis panel and filtering
- My Actions tab
- PR detail panel open/close, Close PR, Delete branch actions
- Copilot Analytics tab navigation, panel rendering, usage bars

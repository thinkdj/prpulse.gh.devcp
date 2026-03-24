# GitHub Dev Control Panel (gh.devcp)

A lightweight GitHub-style dashboard for personal repositories with many collaborators and frequent pull requests.

Built with **TypeScript + React + Tailwind CSS + TanStack Query** using Vite.

## What this dashboard solves

When notifications become noisy, this dashboard gives a bird's-eye view of PRs that need your attention across selectable repositories.

## Dashboard preview

![Dashboard preview](./public/dashboard-preview.png)

## Practical requirements implemented

- Show all PRs for selected repositories in one dashboard
- Show who created each PR
- Show PR status details (checks, Copilot review, merge safety)
- Show when each PR was opened
- Show how many pushes happened after open
- Keep repository selection persistent locally (localStorage)

## 3 great-to-have features included in planning widget

- Daily digest mode for new blockers since yesterday
- Auto-priority queue by age/risk/ownership
- SLA watchlist for near-breach PR response targets

## Architecture notes

- **Storage choice:** `localStorage` is used for a simple local-first setup (no backend required for this scope)
- **Data model:** currently seeded dashboard data in UI layer to keep the first iteration simple
- **UI:** GitHub-inspired dark design with compact status widgets and PR table

If you later need multi-device sync, audit history, or team-shared state, Cloudflare Wrangler services (D1/KV) can be added as a next step.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Scripts

- `npm run dev` - start development server
- `npm run lint` - run ESLint
- `npm run test` - run unit tests (Vitest)
- `npm run build` - type-check and build
- `npm run preview` - preview production build

## GitHub Pages CI/CD

- Workflow file: `.github/workflows/deploy-gh-pages.yml`
- Deploys automatically on pushes to `main` and supports manual dispatch.
- CI/CD pipeline runs `npm ci`, `npm run lint`, `npm run test`, and then builds with:
  - `npm run build -- --base=/<repo-name>/`
- Build output from `dist/` is published via GitHub Pages actions.

## Testing

Focused tests validate:

- Dashboard renders key widgets and requirement section
- Repository toggle filters visible PR summary

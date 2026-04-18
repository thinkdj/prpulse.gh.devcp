# Roadmap — PR Pulse – The GitHub Control Panel

Six-month plan for making prpulse.gh.devcp the single pane of glass for repo owners.

## Q2 2026 (Apr – Jun) — Foundations

- [x] **Copilot Analytics tab** — org-level usage metrics, seat utilisation, acceptance rate, daily trend, language/editor/model breakdowns
- [ ] **Keyboard shortcuts** — `j/k` navigation, `r` to refresh, `/` to focus search
- [ ] **Notification badge** — show count of new PRs since last visit
- [ ] **Column visibility preferences** — hide/show columns (Copilot, Merge, Pushes, etc.)
- [ ] **PR age warnings** — configurable threshold (e.g., highlight PRs older than 7 days)
- [ ] **Pagination / virtual scroll** — support repos with 100+ open PRs
- [ ] **Mobile-responsive table** — card layout on small screens

## Q3 2026 (Jul – Sep) — Deeper Insights

- [ ] **Review timeline** — expandable row showing review history per PR
- [ ] **CI details panel** — click a check badge to see individual check-run names/statuses
- [ ] **PR activity heatmap** — sparkline or mini chart of push/comment activity per PR
- [ ] **Bulk actions** — select multiple PRs, bulk-approve or request changes (with token scope)
- [ ] **Saved filter presets** — save author/label/status combos, switch between them
- [ ] **Export to CSV** — download filtered PR list for reporting

## Q4 2026 (Oct – Dec) — Collaboration & Sync

- [ ] **Team views** — define team members, see "team needs review" vs "my review"
- [ ] **Multi-account support** — switch between personal / org tokens
- [ ] **Cloudflare D1/KV backend** — optional server sync for multi-device state
- [ ] **Webhook listener** — real-time updates via GitHub webhook (Cloudflare Worker)
- [ ] **Slack / Discord notifications** — alert when a PR becomes blocked or stale
- [ ] **Shared dashboards** — shareable read-only link to a filtered view

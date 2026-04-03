import { Flag, XCircle, CheckCircle, CheckCheck } from 'lucide-react'
import type { PullRequest } from '../types'
import { relativeTime } from '../utils'
import StatusBadge from './StatusBadge'

type ActionRequiredPanelProps = {
  pullRequests: PullRequest[]
  currentUser: string
  hasSelectedRepos: boolean
  onPRSelect: (pr: PullRequest) => void
}

type ActionItem = {
  pr: PullRequest
  priority: number
  actionLabel: string
  actionColor: string
}

function buildActionItems(prs: PullRequest[], currentUser: string): ActionItem[] {
  const items: ActionItem[] = []

  for (const pr of prs) {
    if (pr.isDraft) continue

    // Highest priority: needs your review
    if (pr.needsYourReview) {
      items.push({ pr, priority: 1, actionLabel: 'Review requested', actionColor: 'text-gh-warning' })
      continue
    }

    // Your PRs with issues
    if (pr.author === currentUser) {
      if (pr.mergeSafety === 'blocked') {
        items.push({ pr, priority: 2, actionLabel: 'Blocked — address feedback', actionColor: 'text-gh-danger-fg' })
        continue
      }
      if (pr.checksStatus === 'failing') {
        items.push({ pr, priority: 2, actionLabel: 'CI failing — fix required', actionColor: 'text-gh-danger-fg' })
        continue
      }
      if (pr.mergeSafety === 'safe') {
        items.push({ pr, priority: 3, actionLabel: 'Ready to merge', actionColor: 'text-gh-success-fg' })
        continue
      }
    }
  }

  return items.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return new Date(b.pr.updatedAt).getTime() - new Date(a.pr.updatedAt).getTime()
  })
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <CheckCheck className="h-12 w-12 text-gh-success-fg" />
      <p className="text-sm text-gh-fg-muted">{message}</p>
    </div>
  )
}

export default function ActionRequiredPanel({
  pullRequests,
  currentUser,
  hasSelectedRepos,
  onPRSelect,
}: ActionRequiredPanelProps) {
  if (!hasSelectedRepos) {
    return (
      <section className="rounded-lg border border-gh-border bg-gh-surface p-6">
        <p className="text-sm text-gh-fg-muted">Select at least one repository to see action items.</p>
      </section>
    )
  }

  if (!currentUser) {
    return (
      <section className="rounded-lg border border-gh-border bg-gh-surface p-6">
        <p className="text-sm text-gh-fg-muted">Set up a GitHub token to see personalized action items.</p>
      </section>
    )
  }

  const items = buildActionItems(pullRequests, currentUser)

  const reviewRequested = items.filter((i) => i.priority === 1)
  const needsAction = items.filter((i) => i.priority === 2)
  const readyToMerge = items.filter((i) => i.priority === 3)

  return (
    <section className="rounded-lg border border-gh-border bg-gh-surface">
      <div className="border-b border-gh-border px-5 py-4">
        <h2 className="text-base font-semibold text-gh-fg">My Action Items</h2>
        <p className="mt-1 text-sm text-gh-fg-muted">
          Prioritised view of PRs that need your attention across all tracked repos.
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState message="You're all caught up! No open action items right now." />
      ) : (
        <div className="divide-y divide-gh-border">
          {/* Review requested */}
          {reviewRequested.length > 0 && (
            <div className="px-5 py-4">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gh-warning">
                <Flag className="h-3.5 w-3.5" /> Review Requested ({reviewRequested.length})
              </h3>
              <ul className="space-y-2">
                {reviewRequested.map(({ pr, actionLabel, actionColor }) => (
                  <ActionRow key={`${pr.repo}#${pr.id}`} pr={pr} actionLabel={actionLabel} actionColor={actionColor} onPRSelect={onPRSelect} />
                ))}
              </ul>
            </div>
          )}

          {/* Needs action on your PRs */}
          {needsAction.length > 0 && (
            <div className="px-5 py-4">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gh-danger-fg">
                <XCircle className="h-3.5 w-3.5" /> Your PRs Needing Attention ({needsAction.length})
              </h3>
              <ul className="space-y-2">
                {needsAction.map(({ pr, actionLabel, actionColor }) => (
                  <ActionRow key={`${pr.repo}#${pr.id}`} pr={pr} actionLabel={actionLabel} actionColor={actionColor} onPRSelect={onPRSelect} />
                ))}
              </ul>
            </div>
          )}

          {/* Ready to merge */}
          {readyToMerge.length > 0 && (
            <div className="px-5 py-4">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gh-success-fg">
                <CheckCircle className="h-3.5 w-3.5" /> Ready to Merge ({readyToMerge.length})
              </h3>
              <ul className="space-y-2">
                {readyToMerge.map(({ pr, actionLabel, actionColor }) => (
                  <ActionRow key={`${pr.repo}#${pr.id}`} pr={pr} actionLabel={actionLabel} actionColor={actionColor} onPRSelect={onPRSelect} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

type ActionRowProps = {
  pr: PullRequest
  actionLabel: string
  actionColor: string
  onPRSelect: (pr: PullRequest) => void
}

function ActionRow({ pr, actionLabel, actionColor, onPRSelect }: ActionRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onPRSelect(pr)}
        className="w-full rounded-lg border border-gh-border bg-gh-overlay p-3 text-left hover:border-gh-border-hover hover:bg-gh-overlay/80 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-gh-fg-muted">{pr.repo}</span>
              <span className="text-xs text-gh-fg-placeholder">#{pr.id}</span>
            </div>
            <p className="mt-0.5 text-sm font-medium text-gh-fg-default leading-snug">
              {pr.title}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className={`text-xs font-medium ${actionColor}`}>{actionLabel}</span>
              <span className="text-[10px] text-gh-fg-placeholder">{relativeTime(pr.updatedAt)}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <StatusBadge kind="checksStatus" value={pr.checksStatus} />
            <StatusBadge kind="mergeSafety" value={pr.mergeSafety} />
          </div>
        </div>
      </button>
    </li>
  )
}

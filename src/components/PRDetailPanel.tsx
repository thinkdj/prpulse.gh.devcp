import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X,
  GitBranch,
  Clock,
  ChatCircle,
  CheckCircle,
  XCircle,
  Flag,
  ArrowSquareOut,
  WarningCircle,
  PaperPlaneTilt,
  WarningOctagon,
  Trash,
  Robot,
  CaretDown,
  CaretUp,
  FileText,
} from '@phosphor-icons/react'
import type { PRComment, PullRequest } from '../types'
import { fetchPRActivity, fetchPRStats, postPRComment, closePR, deleteBranch } from '../github-api'
import type { PRStats } from '../github-api'
import { relativeTime } from '../utils'
import StatusBadge from './StatusBadge'
import CommentMarkdown from './CommentMarkdown'
import ConfirmDialog from './ConfirmDialog'

type PRDetailPanelProps = {
  pr: PullRequest
  token: string
  currentUser: string
  isDemoMode: boolean
  demoActivity?: PRComment[]
  onClose: () => void
  onPRClosed?: () => void
  onBranchDeleted?: () => void
}

const COPILOT_PRESETS = [
  { label: 'Review PR', body: '@copilot Please do a thorough code review of this PR, covering correctness, readability, and maintainability.' },
  { label: 'Check performance', body: '@copilot Review this PR for performance bottlenecks. Identify any expensive operations, unnecessary re-renders, or algorithmic issues.' },
  { label: 'Security audit', body: '@copilot Review this PR for security vulnerabilities including injection risks, auth issues, data exposure, and insecure dependencies.' },
  { label: 'Test coverage', body: '@copilot Identify gaps in test coverage for the changes in this PR and suggest what unit and integration tests should be added.' },
  { label: 'Summarize', body: '@copilot Summarize the key changes in this PR, their purpose, and any potential risks or breaking changes to be aware of.' },
]

const labelColorMap: Record<string, string> = {
  bug: 'bg-gh-danger/15 text-gh-danger-fg',
  urgent: 'bg-gh-warning/15 text-gh-warning',
  critical: 'bg-gh-danger/15 text-gh-danger-fg',
  enhancement: 'bg-gh-accent/15 text-gh-accent-fg',
  feature: 'bg-gh-accent/15 text-gh-accent-fg',
  documentation: 'bg-gh-purple/15 text-gh-purple',
  docs: 'bg-gh-purple/15 text-gh-purple',
  chore: 'bg-gh-border/60 text-gh-fg-muted',
  dependencies: 'bg-gh-success/15 text-gh-success-fg',
}

function getLabelStyle(label: string): string {
  return labelColorMap[label.toLowerCase()] ?? 'bg-gh-border/60 text-gh-fg-muted'
}

function ReviewIcon({ state }: { state?: string }) {
  if (state === 'APPROVED') return <CheckCircle className="h-3 w-3 text-gh-success-fg" />
  if (state === 'CHANGES_REQUESTED') return <XCircle className="h-3 w-3 text-gh-danger-fg" />
  if (state === 'COMMENTED') return <ChatCircle className="h-3 w-3 text-gh-fg-muted" />
  if (state === 'PENDING') return <Clock className="h-3 w-3 text-gh-warning" />
  return <ChatCircle className="h-3 w-3 text-gh-fg-muted" />
}

function reviewStateBadge(state?: string): string {
  if (state === 'APPROVED') return 'text-gh-success-fg'
  if (state === 'CHANGES_REQUESTED') return 'text-gh-danger-fg'
  if (state === 'COMMENTED') return 'text-gh-fg-muted'
  if (state === 'PENDING') return 'text-gh-warning'
  return 'text-gh-fg-muted'
}

function reviewStateLabel(state?: string): string {
  if (state === 'APPROVED') return 'Approved'
  if (state === 'CHANGES_REQUESTED') return 'Changes requested'
  if (state === 'COMMENTED') return 'Commented'
  if (state === 'PENDING') return 'Pending'
  if (state === 'DISMISSED') return 'Dismissed'
  return 'Review'
}

const DEMO_PR_STATS = { changedFiles: 12, additions: 340, deletions: 85 }

export default function PRDetailPanel({ pr, token, currentUser, isDemoMode, demoActivity, onClose, onPRClosed, onBranchDeleted }: PRDetailPanelProps) {
  const isDemo = isDemoMode
  const queryClient = useQueryClient()
  const [commentBody, setCommentBody] = useState('')
  const [showPresets, setShowPresets] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [showDeleteBranchConfirm, setShowDeleteBranchConfirm] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  const { data: activity = [], isLoading: activityLoading, isError: activityError } = useQuery({
    queryKey: ['pr-activity', pr.repo, pr.id, token],
    queryFn: () => fetchPRActivity(pr.repo, pr.id, token),
    enabled: !!token && !isDemo,
    staleTime: 60 * 1000,
  })

  const { data: prStats } = useQuery<PRStats>({
    queryKey: ['pr-stats', pr.repo, pr.id, token],
    queryFn: () => fetchPRStats(pr.repo, pr.id, token),
    enabled: !!token && !isDemo,
    staleTime: 5 * 60 * 1000,
  })

  const displayedActivity = isDemo ? (demoActivity ?? []) : activity

  const mutation = useMutation({
    mutationFn: (body: string) => postPRComment(pr.repo, pr.id, token, body),
    onSuccess: (newComment: PRComment) => {
      queryClient.setQueryData<PRComment[]>(
        ['pr-activity', pr.repo, pr.id, token],
        (prev = []) => [...prev, newComment],
      )
      setCommentBody('')
    },
  })

  const closePRMutation = useMutation({
    mutationFn: () => closePR(pr.repo, pr.id, token),
    onSuccess: () => {
      setShowCloseConfirm(false)
      onPRClosed?.()
    },
  })

  const deleteBranchMutation = useMutation({
    mutationFn: () => deleteBranch(pr.repo, pr.headRef, token),
    onSuccess: () => {
      setShowDeleteBranchConfirm(false)
      onBranchDeleted?.()
    },
  })

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Move initial focus into the panel when it opens
  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  const handleSubmitComment = () => {
    if (isDemo) return
    const trimmed = commentBody.trim()
    if (!trimmed || mutation.isPending) return
    mutation.mutate(trimmed)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmitComment()
    }
  }

  // Derive displayed comment count: prefer live activity count once loaded successfully
  const displayedCommentCount =
    isDemo
      ? (demoActivity ?? []).length
      : activityLoading || activityError
        ? pr.commentCount
        : activity.length

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Pull request details"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col bg-gh-surface shadow-2xl outline-none ring-1 ring-gh-border md:rounded-l-lg"
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-gh-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gh-fg-muted">{pr.repo}</span>
              <span className="text-xs text-gh-fg-muted">#{pr.id}</span>
              {pr.isDraft && (
                <span className="rounded-full bg-gh-border/60 px-2 py-0.5 text-[10px] font-medium text-gh-fg-muted">
                  Draft
                </span>
              )}
            </div>
            <h2 className="mt-1 text-base font-semibold leading-snug">
              <a href={pr.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-gh-accent-fg hover:opacity-80">
                {pr.title}
                <ArrowSquareOut className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </a>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close PR detail panel"
            className="shrink-0 rounded-full p-1.5 text-gh-fg-muted transition-colors hover:bg-gh-overlay hover:text-gh-fg-default"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Status strip */}
          <div className="flex flex-wrap gap-x-4 gap-y-3 border-b border-gh-border px-5 py-3">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-gh-fg-muted">
                Checks
              </span>
              <StatusBadge kind="checksStatus" value={pr.checksStatus} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-gh-fg-muted">
                Copilot review
              </span>
              <StatusBadge kind="copilotReview" value={pr.copilotReview} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-gh-fg-muted">
                Merge safety
              </span>
              <StatusBadge kind="mergeSafety" value={pr.mergeSafety} />
            </div>
          </div>

          {/* Meta grid */}
          <div className="border-b border-gh-border px-5 py-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-gh-fg-muted">Author</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-gh-fg-default">
                  {pr.authorAvatar && (
                    <img src={pr.authorAvatar} alt="" className="h-5 w-5 rounded-full" />
                  )}
                  {pr.author}
                  {pr.author === currentUser && (
                    <span className="text-xs text-gh-fg-muted">(you)</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gh-fg-muted">Opened</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-gh-fg-default" title={new Date(pr.openedAt).toLocaleString()}>
                  <Clock className="h-3.5 w-3.5 text-gh-fg-muted" />
                  {relativeTime(pr.openedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gh-fg-muted">Branch</dt>
                <dd className="mt-1 flex items-center gap-1 font-mono text-xs text-gh-fg-default">
                  <GitBranch className="h-3.5 w-3.5 shrink-0 text-gh-fg-muted" />
                  {pr.baseRef && pr.headRef ? (
                    <span>
                      <span className="text-gh-fg-muted">{pr.baseRef}</span>
                      <span className="mx-1 text-gh-fg-placeholder">←</span>
                      <span>{pr.headRef}</span>
                    </span>
                  ) : (
                    <span className="text-gh-fg-muted">—</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gh-fg-muted">Updated</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-gh-fg-default" title={new Date(pr.updatedAt).toLocaleString()}>
                  <Clock className="h-3.5 w-3.5 text-gh-fg-muted" />
                  {relativeTime(pr.updatedAt)}
                </dd>
              </div>
              {pr.reviewers.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-gh-fg-muted">Requested reviewers</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {pr.reviewers.map((r) => (
                      <span
                        key={r}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                          r === currentUser
                            ? 'bg-gh-warning/15 text-gh-warning'
                            : 'bg-gh-border/60 text-gh-fg-muted'
                        }`}
                      >
                        {r === currentUser && <Flag className="h-3 w-3" />}
                        {r}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              {pr.labels.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-gh-fg-muted">Labels</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {pr.labels.map((label) => (
                      <span
                        key={label}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${getLabelStyle(label)}`}
                      >
                        {label}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              <div className="col-span-2 flex gap-4 text-xs text-gh-fg-muted">
                <span>{pr.pushesAfterOpen} push{pr.pushesAfterOpen !== 1 ? 'es' : ''} after open</span>
                <span className="flex items-center gap-1">
                  <ChatCircle className="h-3 w-3" />
                  {displayedCommentCount} comment{displayedCommentCount !== 1 ? 's' : ''}
                </span>
              </div>
              {(prStats || isDemo) && (
                <div className="col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-gh-fg-muted">Diff</dt>
                  <dd className="mt-1.5 flex items-center gap-2 text-xs">
                    {(() => {
                      const stats = isDemo ? DEMO_PR_STATS : prStats!
                      return (
                        <>
                          <span className="inline-flex items-center gap-1 rounded-md border border-gh-border bg-gh-overlay/60 px-2 py-1 font-medium text-gh-fg-muted">
                            <FileText className="h-3.5 w-3.5" />
                            {stats.changedFiles} file{stats.changedFiles !== 1 ? 's' : ''}
                          </span>
                          <span className="inline-flex items-center rounded-md bg-gh-success/15 px-2 py-1 font-semibold text-gh-success-fg">+{stats.additions}</span>
                          <span className="inline-flex items-center rounded-md bg-gh-danger/15 px-2 py-1 font-semibold text-gh-danger-fg">−{stats.deletions}</span>
                        </>
                      )
                    })()}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* PR Actions */}
          <div className="border-b border-gh-border px-5 py-3">
            <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-wide text-gh-fg-muted">
              Actions
            </h3>
            {isDemo ? (
              <p className="text-xs text-gh-fg-muted italic">Actions are disabled in demo mode.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowCloseConfirm(true)}
                  disabled={closePRMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-gh-danger/12 px-3 py-1.5 text-xs font-semibold text-gh-danger-fg transition-colors hover:bg-gh-danger/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <WarningOctagon className="h-3.5 w-3.5" aria-hidden="true" />
                  {closePRMutation.isPending ? 'Closing…' : 'Close PR'}
                </button>
                {pr.headRef && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteBranchConfirm(true)}
                    disabled={deleteBranchMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gh-border bg-gh-overlay px-3 py-1.5 text-xs font-medium text-gh-fg-muted transition-colors hover:border-gh-border-hover hover:text-gh-fg-default disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash className="h-3.5 w-3.5" aria-hidden="true" />
                    {deleteBranchMutation.isPending ? 'Deleting…' : 'Delete branch'}
                  </button>
                )}
              </div>
            )}
            {closePRMutation.isError && (
              <p className="mt-2 flex items-center gap-1 text-xs text-gh-danger-fg">
                <WarningCircle className="h-3.5 w-3.5 shrink-0" />
                {closePRMutation.error instanceof Error ? closePRMutation.error.message : 'Failed to close PR.'}
              </p>
            )}
            {deleteBranchMutation.isError && (
              <p className="mt-2 flex items-center gap-1 text-xs text-gh-danger-fg">
                <WarningCircle className="h-3.5 w-3.5 shrink-0" />
                {deleteBranchMutation.error instanceof Error ? deleteBranchMutation.error.message : 'Failed to delete branch.'}
              </p>
            )}
          </div>

          {/* Comment thread */}
          <div className="px-5 py-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gh-fg-muted">
              <ChatCircle className="h-3.5 w-3.5" />
              Activity
            </h3>
            {!isDemo && activityLoading ? (
              <p className="text-sm text-gh-fg-muted">Loading activity…</p>
            ) : !isDemo && activityError ? (
              <div className="flex items-center gap-2 rounded-md border border-gh-danger/30 bg-gh-danger/10 px-4 py-3 text-sm text-gh-danger-fg">
                <WarningCircle className="h-4 w-4 shrink-0" />
                Failed to load activity. Check your token permissions.
              </div>
            ) : displayedActivity.length === 0 ? (
              <p className="text-sm text-gh-fg-muted">No comments yet.</p>
            ) : (
              <ul className="space-y-3">
                {displayedActivity.map((comment) => (
                  <li key={`${comment.isReview ? 'r' : 'c'}-${comment.id}`} className="rounded-md border border-gh-border bg-gh-overlay p-3.5 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {comment.authorAvatar ? (
                          <img src={comment.authorAvatar} alt="" className="h-5 w-5 shrink-0 rounded-full" />
                        ) : (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gh-border text-[9px] uppercase text-gh-fg-muted">
                            {comment.author[0]}
                          </span>
                        )}
                        <span className="truncate text-xs font-medium text-gh-fg-default">{comment.author}</span>
                        {comment.isReview && (
                          <span className={`flex items-center gap-1 text-xs font-medium ${reviewStateBadge(comment.reviewState)}`}>
                            <ReviewIcon state={comment.reviewState} />
                            {reviewStateLabel(comment.reviewState)}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] text-gh-fg-placeholder" title={new Date(comment.createdAt).toLocaleString()}>
                        {relativeTime(comment.createdAt)}
                      </span>
                    </div>
                    <div className="mt-2 border-t border-gh-border/60 pt-2">
                      <CommentMarkdown source={comment.body} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Comment composer */}
        <div className="border-t border-gh-border bg-gh-surface px-5 py-4">
          {/* Copilot prompt presets */}
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setShowPresets(!showPresets)}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gh-fg-muted hover:text-gh-fg-default"
            >
              <Robot className="h-3.5 w-3.5 text-gh-accent-fg" aria-hidden="true" />
              Copilot prompts
              {showPresets ? <CaretUp className="h-3 w-3" aria-hidden="true" /> : <CaretDown className="h-3 w-3" aria-hidden="true" />}
            </button>
            {showPresets && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {COPILOT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setCommentBody(preset.body)
                      setShowPresets(false)
                      textareaRef.current?.focus()
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-gh-accent/12 px-2.5 py-1 text-[11px] font-semibold text-gh-accent-fg transition-colors hover:bg-gh-accent/20"
                  >
                    <Robot className="h-3 w-3" aria-hidden="true" />
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {mutation.isError && (
            <div className="mb-2 flex items-center gap-1.5 text-xs text-gh-danger-fg">
              <WarningCircle className="h-3.5 w-3.5 shrink-0" />
              {mutation.error instanceof Error ? mutation.error.message : 'Failed to post comment.'}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isDemo ? 'Commenting is disabled in demo mode.' : 'Leave a comment… (Ctrl+Enter to submit)'}
            aria-label="Comment body"
            disabled={isDemo}
            rows={3}
            className="w-full resize-none rounded-md border border-gh-border bg-gh-bg px-3.5 py-2.5 text-sm text-gh-fg-default placeholder-gh-fg-placeholder outline-none transition-colors focus:border-gh-accent focus:ring-2 focus:ring-gh-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-gh-fg-placeholder">{isDemo ? 'Demo mode' : 'Ctrl+Enter to submit'}</span>
            <button
              type="button"
              onClick={handleSubmitComment}
              disabled={isDemo || !commentBody.trim() || mutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-gh-accent px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:shadow-md hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PaperPlaneTilt className="h-3.5 w-3.5" />
              {mutation.isPending ? 'Posting…' : 'Comment'}
            </button>
          </div>
        </div>
      </aside>

      {/* Close PR confirmation */}
      <ConfirmDialog
        isOpen={showCloseConfirm}
        title="Close this pull request?"
        message={`This will close PR #${pr.id} "${pr.title}". The branch will not be deleted.`}
        confirmLabel="Close PR"
        variant="danger"
        onConfirm={() => closePRMutation.mutate()}
        onCancel={() => setShowCloseConfirm(false)}
      />

      {/* Delete branch confirmation */}
      <ConfirmDialog
        isOpen={showDeleteBranchConfirm}
        title="Delete branch?"
        message={`This will permanently delete the branch "${pr.headRef}" from ${pr.repo}. This cannot be undone.`}
        confirmLabel="Delete branch"
        variant="danger"
        onConfirm={() => deleteBranchMutation.mutate()}
        onCancel={() => setShowDeleteBranchConfirm(false)}
      />
    </>
  )
}

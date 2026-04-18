import { useMemo, useState } from 'react'
import {
  BarChart3,
  Bot,
  Code,
  MessageSquare,
  GitPullRequest,
  Users,
  Monitor,
  Cpu,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react'
import type { CopilotDayMetrics, CopilotOrgData } from '../types'

type CopilotMetricsPanelProps = {
  orgData: CopilotOrgData[]
  isLoading: boolean
  orgs: string[]
  selectedOrg: string
  onOrgChange: (org: string) => void
  error?: string | null
}

/* ── Aggregation helpers ── */

type AggregatedMetrics = {
  totalDays: number
  avgActiveUsers: number
  avgEngagedUsers: number
  engagementRate: number
  totalSuggestions: number
  totalAcceptances: number
  acceptanceRate: number
  totalLinesAccepted: number
  totalLinesSuggested: number
  lineAcceptanceRate: number
  totalChats: number
  totalChatInsertions: number
  totalChatCopies: number
  totalPRSummaries: number
  totalDotcomChats: number
  languageBreakdown: { name: string; suggestions: number; acceptances: number; rate: number }[]
  editorBreakdown: { name: string; users: number; suggestions: number; acceptances: number }[]
  modelBreakdown: { name: string; isCustom: boolean; suggestions: number; acceptances: number; chats: number; prSummaries: number }[]
  dailyTrend: { date: string; activeUsers: number; engagedUsers: number; suggestions: number; acceptances: number; chats: number }[]
}

function aggregateMetrics(metrics: CopilotDayMetrics[]): AggregatedMetrics {
  if (metrics.length === 0) {
    return {
      totalDays: 0,
      avgActiveUsers: 0,
      avgEngagedUsers: 0,
      engagementRate: 0,
      totalSuggestions: 0,
      totalAcceptances: 0,
      acceptanceRate: 0,
      totalLinesAccepted: 0,
      totalLinesSuggested: 0,
      lineAcceptanceRate: 0,
      totalChats: 0,
      totalChatInsertions: 0,
      totalChatCopies: 0,
      totalPRSummaries: 0,
      totalDotcomChats: 0,
      languageBreakdown: [],
      editorBreakdown: [],
      modelBreakdown: [],
      dailyTrend: [],
    }
  }

  const langMap = new Map<string, { suggestions: number; acceptances: number }>()
  const editorMap = new Map<string, { users: number; suggestions: number; acceptances: number }>()
  const modelMap = new Map<string, { isCustom: boolean; suggestions: number; acceptances: number; chats: number; prSummaries: number }>()

  let totalSuggestions = 0
  let totalAcceptances = 0
  let totalLinesSuggested = 0
  let totalLinesAccepted = 0
  let totalChats = 0
  let totalChatInsertions = 0
  let totalChatCopies = 0
  let totalPRSummaries = 0
  let totalDotcomChats = 0
  let totalActiveUsers = 0
  let totalEngagedUsers = 0

  const dailyTrend: AggregatedMetrics['dailyTrend'] = []

  for (const day of metrics) {
    totalActiveUsers += day.total_active_users
    totalEngagedUsers += day.total_engaged_users

    let daySuggestions = 0
    let dayAcceptances = 0
    let dayChats = 0

    // IDE code completions
    if (day.copilot_ide_code_completions) {
      for (const editor of day.copilot_ide_code_completions.editors) {
        const existing = editorMap.get(editor.name) ?? { users: 0, suggestions: 0, acceptances: 0 }
        existing.users = Math.max(existing.users, editor.total_engaged_users)

        for (const model of editor.models) {
          const mKey = model.name
          const mExisting = modelMap.get(mKey) ?? { isCustom: model.is_custom_model, suggestions: 0, acceptances: 0, chats: 0, prSummaries: 0 }

          if (model.languages) {
            for (const lang of model.languages) {
              const lExisting = langMap.get(lang.name) ?? { suggestions: 0, acceptances: 0 }
              lExisting.suggestions += lang.total_code_suggestions ?? 0
              lExisting.acceptances += lang.total_code_acceptances ?? 0
              langMap.set(lang.name, lExisting)

              const s = lang.total_code_suggestions ?? 0
              const a = lang.total_code_acceptances ?? 0
              totalSuggestions += s
              totalAcceptances += a
              daySuggestions += s
              dayAcceptances += a
              totalLinesSuggested += lang.total_code_lines_suggested ?? 0
              totalLinesAccepted += lang.total_code_lines_accepted ?? 0

              existing.suggestions += s
              existing.acceptances += a
              mExisting.suggestions += s
              mExisting.acceptances += a
            }
          }

          modelMap.set(mKey, mExisting)
        }

        editorMap.set(editor.name, existing)
      }
    }

    // IDE chat
    if (day.copilot_ide_chat) {
      for (const editor of day.copilot_ide_chat.editors) {
        for (const model of editor.models) {
          const c = model.total_chats ?? 0
          totalChats += c
          dayChats += c
          totalChatInsertions += model.total_chat_insertion_events ?? 0
          totalChatCopies += model.total_chat_copy_events ?? 0

          const mKey = model.name
          const mExisting = modelMap.get(mKey) ?? { isCustom: model.is_custom_model, suggestions: 0, acceptances: 0, chats: 0, prSummaries: 0 }
          mExisting.chats += c
          modelMap.set(mKey, mExisting)
        }
      }
    }

    // Dotcom chat
    if (day.copilot_dotcom_chat) {
      for (const model of day.copilot_dotcom_chat.models) {
        const c = model.total_chats ?? 0
        totalDotcomChats += c
        dayChats += c

        const mKey = model.name
        const mExisting = modelMap.get(mKey) ?? { isCustom: model.is_custom_model, suggestions: 0, acceptances: 0, chats: 0, prSummaries: 0 }
        mExisting.chats += c
        modelMap.set(mKey, mExisting)
      }
    }

    // PR summaries
    if (day.copilot_dotcom_pull_requests) {
      for (const repo of day.copilot_dotcom_pull_requests.repositories) {
        for (const model of repo.models) {
          const p = model.total_pr_summaries_created ?? 0
          totalPRSummaries += p

          const mKey = model.name
          const mExisting = modelMap.get(mKey) ?? { isCustom: model.is_custom_model, suggestions: 0, acceptances: 0, chats: 0, prSummaries: 0 }
          mExisting.prSummaries += p
          modelMap.set(mKey, mExisting)
        }
      }
    }

    dailyTrend.push({
      date: day.date,
      activeUsers: day.total_active_users,
      engagedUsers: day.total_engaged_users,
      suggestions: daySuggestions,
      acceptances: dayAcceptances,
      chats: dayChats,
    })
  }

  const n = metrics.length
  const avgActiveUsers = Math.round(totalActiveUsers / n)
  const avgEngagedUsers = Math.round(totalEngagedUsers / n)
  const engagementRate = totalActiveUsers > 0 ? (totalEngagedUsers / totalActiveUsers) * 100 : 0
  const acceptanceRate = totalSuggestions > 0 ? (totalAcceptances / totalSuggestions) * 100 : 0
  const lineAcceptanceRate = totalLinesSuggested > 0 ? (totalLinesAccepted / totalLinesSuggested) * 100 : 0

  const languageBreakdown = [...langMap.entries()]
    .map(([name, data]) => ({
      name,
      suggestions: data.suggestions,
      acceptances: data.acceptances,
      rate: data.suggestions > 0 ? (data.acceptances / data.suggestions) * 100 : 0,
    }))
    .sort((a, b) => b.suggestions - a.suggestions)

  const editorBreakdown = [...editorMap.entries()]
    .map(([name, data]) => ({
      name,
      users: data.users,
      suggestions: data.suggestions,
      acceptances: data.acceptances,
    }))
    .sort((a, b) => b.suggestions - a.suggestions)

  const modelBreakdown = [...modelMap.entries()]
    .map(([name, data]) => ({
      name,
      isCustom: data.isCustom,
      suggestions: data.suggestions,
      acceptances: data.acceptances,
      chats: data.chats,
      prSummaries: data.prSummaries,
    }))
    .sort((a, b) => (b.suggestions + b.chats) - (a.suggestions + a.chats))

  return {
    totalDays: n,
    avgActiveUsers,
    avgEngagedUsers,
    engagementRate,
    totalSuggestions,
    totalAcceptances,
    acceptanceRate,
    totalLinesAccepted,
    totalLinesSuggested,
    lineAcceptanceRate,
    totalChats,
    totalChatInsertions,
    totalChatCopies,
    totalPRSummaries,
    totalDotcomChats,
    languageBreakdown,
    editorBreakdown,
    modelBreakdown,
    dailyTrend,
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

/* ── Sub-components ── */

function UsageBar({ percentage, label }: { percentage: number; label: string }) {
  const clamped = Math.min(100, Math.max(0, percentage))
  const barColor = clamped >= 90 ? 'bg-gh-danger-fg' : clamped >= 70 ? 'bg-gh-warning' : 'bg-gh-success-fg'

  return (
    <div className="rounded-lg border border-gh-border bg-gh-surface p-5" data-testid="copilot-usage-bar">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gh-fg">{label}</span>
        <span className="text-sm font-semibold text-gh-fg">{clamped.toFixed(1)}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-gh-overlay">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}

function SummaryCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gh-border bg-gh-surface p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-gh-fg-muted">{icon}</span>
        <span className="text-xs text-gh-fg-muted">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-gh-fg">{value}</p>
      {sub && <p className="mt-1 text-xs text-gh-fg-muted">{sub}</p>}
    </div>
  )
}

function DailyTrendChart({ data }: { data: AggregatedMetrics['dailyTrend'] }) {
  if (data.length === 0) return null

  const maxSuggestions = Math.max(1, ...data.map((d) => d.suggestions))

  return (
    <div className="rounded-lg border border-gh-border bg-gh-surface p-5" data-testid="copilot-daily-trend">
      <h3 className="mb-4 text-sm font-semibold text-gh-fg flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-gh-accent-fg" />
        Daily code completions trend
      </h3>
      <div className="flex items-end gap-[2px] h-32">
        {data.map((day) => {
          const heightPct = (day.suggestions / maxSuggestions) * 100
          const acceptPct = day.suggestions > 0 ? (day.acceptances / day.suggestions) * 100 : 0
          return (
            <div
              key={day.date}
              className="group relative flex-1 min-w-[3px]"
              title={`${day.date}\n${day.suggestions.toLocaleString()} suggestions\n${day.acceptances.toLocaleString()} accepted (${acceptPct.toFixed(0)}%)\n${day.chats.toLocaleString()} chats\n${day.activeUsers} active users`}
            >
              <div
                className="w-full rounded-t-sm bg-gh-accent/30 transition-colors group-hover:bg-gh-accent/50"
                style={{ height: `${heightPct}%` }}
              >
                <div
                  className="w-full rounded-t-sm bg-gh-accent-fg"
                  style={{ height: `${acceptPct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-gh-fg-placeholder">
        <span>{data[0]?.date ?? ''}</span>
        <span>{data[data.length - 1]?.date ?? ''}</span>
      </div>
      <div className="mt-2 flex items-center gap-4 text-[10px] text-gh-fg-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-gh-accent-fg" /> Accepted
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-gh-accent/30" /> Suggested
        </span>
      </div>
    </div>
  )
}

function BreakdownTable<T extends Record<string, unknown>>({
  title,
  icon,
  columns,
  rows,
  getKey,
}: {
  title: string
  icon: React.ReactNode
  columns: { header: string; accessor: (row: T) => string; align?: 'right' }[]
  rows: T[]
  getKey: (row: T) => string
}) {
  if (rows.length === 0) return null

  return (
    <div className="rounded-lg border border-gh-border bg-gh-surface p-5">
      <h3 className="mb-3 text-sm font-semibold text-gh-fg flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-gh-fg-muted">
              {columns.map((col) => (
                <th
                  key={col.header}
                  className={`border-b border-gh-border px-3 py-2 font-medium ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={getKey(row)} className="hover:bg-gh-overlay/50">
                {columns.map((col) => (
                  <td
                    key={col.header}
                    className={`border-b border-gh-border/60 px-3 py-2 ${col.align === 'right' ? 'text-right tabular-nums' : ''}`}
                  >
                    {col.accessor(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Main panel ── */

export default function CopilotMetricsPanel({
  orgData,
  isLoading,
  orgs,
  selectedOrg,
  onOrgChange,
  error,
}: CopilotMetricsPanelProps) {
  const [activeSection, setActiveSection] = useState<'overview' | 'languages' | 'editors' | 'models'>('overview')

  const currentOrgData = useMemo(
    () => orgData.find((d) => d.org === selectedOrg),
    [orgData, selectedOrg],
  )

  const agg = useMemo(
    () => aggregateMetrics(currentOrgData?.metrics ?? []),
    [currentOrgData],
  )

  const billing = currentOrgData?.billing ?? null

  // Seat utilisation as the top-level "usage" percentage
  const seatUtilisation = billing
    ? billing.seat_breakdown.total > 0
      ? (billing.seat_breakdown.active_this_cycle / billing.seat_breakdown.total) * 100
      : 0
    : null

  if (orgs.length === 0) {
    return (
      <section className="rounded-lg border border-gh-border bg-gh-surface p-6" data-testid="copilot-metrics-panel">
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Bot className="h-12 w-12 text-gh-accent-fg opacity-60" />
          <h2 className="text-lg font-semibold text-gh-fg">Copilot Metrics</h2>
          <p className="text-sm text-gh-fg-muted max-w-md">
            Copilot usage metrics are available for organisations you belong to. Add repositories from
            an organisation to get started, or ensure your token has the{' '}
            <code className="rounded bg-gh-overlay px-1 py-0.5 text-xs">manage_billing:copilot</code>{' '}
            or <code className="rounded bg-gh-overlay px-1 py-0.5 text-xs">read:org</code> scope.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4" data-testid="copilot-metrics-panel">
      {/* Org selector */}
      <div className="rounded-lg border border-gh-border bg-gh-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-gh-accent-fg" />
            <div>
              <h2 className="text-base font-semibold text-gh-fg">Copilot Analytics</h2>
              <p className="text-xs text-gh-fg-muted">Usage metrics and insights for your organisation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="org-select" className="text-xs text-gh-fg-muted">Organisation</label>
            <select
              id="org-select"
              value={selectedOrg}
              onChange={(e) => onOrgChange(e.target.value)}
              className="rounded-md border border-gh-border bg-gh-overlay px-2.5 py-1.5 text-sm text-gh-fg-default hover:border-gh-border-hover focus:outline-none focus:border-gh-accent"
            >
              {orgs.map((org) => (
                <option key={org} value={org}>{org}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {(error || currentOrgData?.error) && (
        <div className="rounded-md border border-gh-warning/40 bg-gh-warning/10 px-4 py-3 text-sm text-gh-warning flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Some data could not be loaded</p>
            <p className="text-xs mt-0.5 opacity-80">{currentOrgData?.error ?? error}</p>
            <p className="text-xs mt-1 opacity-70">
              Ensure your token has{' '}
              <code className="rounded bg-gh-overlay px-1 py-0.5">manage_billing:copilot</code>{' '}
              or <code className="rounded bg-gh-overlay px-1 py-0.5">read:org</code>{' '}
              scope and you have org owner/billing manager access.
            </p>
          </div>
        </div>
      )}

      {isLoading && !currentOrgData ? (
        <div className="rounded-lg border border-gh-border bg-gh-surface px-6 py-16 text-center text-sm text-gh-fg-muted">
          Loading Copilot metrics…
        </div>
      ) : (
        <>
          {/* Top-level usage bars */}
          <div className="grid gap-3 sm:grid-cols-2">
            {seatUtilisation !== null && (
              <UsageBar
                percentage={seatUtilisation}
                label="Seat utilisation (active / total)"
              />
            )}
            {agg.totalDays > 0 && (
              <UsageBar
                percentage={agg.engagementRate}
                label="Engagement rate (engaged / active users)"
              />
            )}
          </div>

          {/* Summary cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {billing && (
              <SummaryCard
                icon={<Users className="h-4 w-4" />}
                label="Total seats"
                value={billing.seat_breakdown.total.toString()}
                sub={`${billing.seat_breakdown.active_this_cycle} active · ${billing.seat_breakdown.inactive_this_cycle} inactive · ${billing.plan_type}`}
              />
            )}
            <SummaryCard
              icon={<Users className="h-4 w-4" />}
              label="Avg daily active users"
              value={agg.avgActiveUsers.toString()}
              sub={`${agg.avgEngagedUsers} avg engaged (${agg.totalDays} days)`}
            />
            <SummaryCard
              icon={<Code className="h-4 w-4" />}
              label="Code suggestions"
              value={formatNumber(agg.totalSuggestions)}
              sub={`${formatNumber(agg.totalAcceptances)} accepted (${agg.acceptanceRate.toFixed(1)}%)`}
            />
            <SummaryCard
              icon={<MessageSquare className="h-4 w-4" />}
              label="Total chats"
              value={formatNumber(agg.totalChats + agg.totalDotcomChats)}
              sub={`${formatNumber(agg.totalChatInsertions)} insertions · ${formatNumber(agg.totalChatCopies)} copies`}
            />
            <SummaryCard
              icon={<GitPullRequest className="h-4 w-4" />}
              label="PR summaries"
              value={formatNumber(agg.totalPRSummaries)}
              sub="Auto-generated PR summaries"
            />
            <SummaryCard
              icon={<BarChart3 className="h-4 w-4" />}
              label="Lines accepted"
              value={formatNumber(agg.totalLinesAccepted)}
              sub={`of ${formatNumber(agg.totalLinesSuggested)} suggested (${agg.lineAcceptanceRate.toFixed(1)}%)`}
            />
            {billing && (
              <>
                <SummaryCard
                  icon={<Users className="h-4 w-4" />}
                  label="New seats this cycle"
                  value={billing.seat_breakdown.added_this_cycle.toString()}
                  sub={`${billing.seat_breakdown.pending_invitation} pending invitation${billing.seat_breakdown.pending_invitation === 1 ? '' : 's'}`}
                />
                <SummaryCard
                  icon={<Cpu className="h-4 w-4" />}
                  label="Plan"
                  value={billing.plan_type.charAt(0).toUpperCase() + billing.plan_type.slice(1)}
                  sub={`Code suggestions: ${billing.public_code_suggestions}`}
                />
              </>
            )}
          </div>

          {/* Section tabs */}
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'overview' as const, label: 'Overview', icon: <TrendingUp className="h-3.5 w-3.5" /> },
              { key: 'languages' as const, label: 'Languages', icon: <Code className="h-3.5 w-3.5" /> },
              { key: 'editors' as const, label: 'Editors', icon: <Monitor className="h-3.5 w-3.5" /> },
              { key: 'models' as const, label: 'Models', icon: <Cpu className="h-3.5 w-3.5" /> },
            ]).map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveSection(key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
                  activeSection === key
                    ? 'border-gh-accent bg-gh-accent/10 text-gh-accent-fg'
                    : 'border-gh-border text-gh-fg-muted hover:border-gh-border-hover'
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Section content */}
          {activeSection === 'overview' && (
            <DailyTrendChart data={agg.dailyTrend} />
          )}

          {activeSection === 'languages' && (
            <BreakdownTable
              title="Language breakdown"
              icon={<Code className="h-4 w-4 text-gh-accent-fg" />}
              columns={[
                { header: 'Language', accessor: (r) => r.name },
                { header: 'Suggestions', accessor: (r) => formatNumber(r.suggestions), align: 'right' },
                { header: 'Accepted', accessor: (r) => formatNumber(r.acceptances), align: 'right' },
                { header: 'Accept rate', accessor: (r) => `${r.rate.toFixed(1)}%`, align: 'right' },
              ]}
              rows={agg.languageBreakdown}
              getKey={(r) => r.name}
            />
          )}

          {activeSection === 'editors' && (
            <BreakdownTable
              title="Editor breakdown"
              icon={<Monitor className="h-4 w-4 text-gh-accent-fg" />}
              columns={[
                { header: 'Editor', accessor: (r) => r.name },
                { header: 'Max users', accessor: (r) => r.users.toString(), align: 'right' },
                { header: 'Suggestions', accessor: (r) => formatNumber(r.suggestions), align: 'right' },
                { header: 'Accepted', accessor: (r) => formatNumber(r.acceptances), align: 'right' },
              ]}
              rows={agg.editorBreakdown}
              getKey={(r) => r.name}
            />
          )}

          {activeSection === 'models' && (
            <BreakdownTable
              title="Model usage"
              icon={<Cpu className="h-4 w-4 text-gh-accent-fg" />}
              columns={[
                { header: 'Model', accessor: (r) => `${r.name}${r.isCustom ? ' (custom)' : ''}` },
                { header: 'Suggestions', accessor: (r) => formatNumber(r.suggestions), align: 'right' },
                { header: 'Accepted', accessor: (r) => formatNumber(r.acceptances), align: 'right' },
                { header: 'Chats', accessor: (r) => formatNumber(r.chats), align: 'right' },
                { header: 'PR summaries', accessor: (r) => formatNumber(r.prSummaries), align: 'right' },
              ]}
              rows={agg.modelBreakdown}
              getKey={(r) => r.name}
            />
          )}

          {agg.totalDays === 0 && !isLoading && (
            <div className="rounded-lg border border-gh-border bg-gh-surface px-6 py-10 text-center text-sm text-gh-fg-muted">
              No Copilot metrics data available for <span className="font-medium text-gh-fg">{selectedOrg}</span>.
              Metrics may take up to 24 hours to appear after Copilot activity.
            </div>
          )}
        </>
      )}
    </section>
  )
}

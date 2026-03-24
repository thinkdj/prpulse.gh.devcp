type SummaryWidgetsProps = {
  total: number
  needsReview: number
  safeToMerge: number
  blocked: number
}

export default function SummaryWidgets({ total, needsReview, safeToMerge, blocked }: SummaryWidgetsProps) {
  return (
    <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="summary widgets">
      <article className="rounded-md border border-[#30363d] bg-[#161b22] p-4">
        <p className="text-xs text-[#8b949e]">Open PRs</p>
        <p className="mt-2 text-2xl font-semibold text-[#f0f6fc]" data-testid="summary-total">
          {total}
        </p>
      </article>
      <article className="rounded-md border border-[#30363d] bg-[#161b22] p-4">
        <p className="text-xs text-[#8b949e]">Need your review</p>
        <p className="mt-2 text-2xl font-semibold text-[#d29922]" data-testid="summary-needs-review">
          {needsReview}
        </p>
      </article>
      <article className="rounded-md border border-[#30363d] bg-[#161b22] p-4">
        <p className="text-xs text-[#8b949e]">Safe to merge</p>
        <p className="mt-2 text-2xl font-semibold text-[#3fb950]" data-testid="summary-safe">
          {safeToMerge}
        </p>
      </article>
      <article className="rounded-md border border-[#30363d] bg-[#161b22] p-4">
        <p className="text-xs text-[#8b949e]">Blocked</p>
        <p className="mt-2 text-2xl font-semibold text-[#f85149]" data-testid="summary-blocked">
          {blocked}
        </p>
      </article>
    </section>
  )
}

import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function isSafeUrl(href: string | undefined): boolean {
  if (!href || href.trim() === '') return false
  const lower = href.trim().toLowerCase()
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return false
  }
  return true
}

const mdComponents: Components = {
  p: ({ children }) => (
    <p className="mb-2 text-xs leading-relaxed text-gh-fg-default last:mb-0">{children}</p>
  ),
  a: ({ href, children }) =>
    isSafeUrl(href) ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="wrap-break-word text-gh-accent-fg underline-offset-2 hover:underline"
      >
        {children}
      </a>
    ) : (
      <span className="text-gh-fg-muted">{children}</span>
    ),
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-4 text-xs text-gh-fg-default">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-4 text-xs text-gh-fg-default">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed [&>p]:mb-0">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-gh-accent/50 pl-3 text-xs italic text-gh-fg-muted">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-gh-border" />,
  h1: ({ children }) => (
    <h4 className="mb-1.5 mt-3 text-sm font-semibold text-gh-fg first:mt-0">{children}</h4>
  ),
  h2: ({ children }) => (
    <h5 className="mb-1.5 mt-2.5 text-xs font-semibold text-gh-fg first:mt-0">{children}</h5>
  ),
  h3: ({ children }) => (
    <h6 className="mb-1 mt-2 text-xs font-semibold text-gh-fg first:mt-0">{children}</h6>
  ),
  h4: ({ children }) => (
    <h6 className="mb-1 mt-2 text-xs font-semibold text-gh-fg first:mt-0">{children}</h6>
  ),
  h5: ({ children }) => (
    <h6 className="mb-1 mt-2 text-xs font-semibold text-gh-fg first:mt-0">{children}</h6>
  ),
  h6: ({ children }) => (
    <h6 className="mb-1 mt-2 text-xs font-semibold text-gh-fg first:mt-0">{children}</h6>
  ),
  strong: ({ children }) => <strong className="font-semibold text-gh-fg">{children}</strong>,
  em: ({ children }) => <em className="italic text-gh-fg-default">{children}</em>,
  del: ({ children }) => <del className="text-gh-fg-muted line-through">{children}</del>,
  table: ({ children }) => (
    <div className="my-2 max-w-full overflow-x-auto rounded-md border border-gh-border">
      <table className="min-w-full border-collapse text-left text-[11px] text-gh-fg-default">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-gh-border bg-gh-bg">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-gh-border">{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th className="border-gh-border px-2 py-1.5 font-semibold text-gh-fg">{children}</th>
  ),
  td: ({ children }) => <td className="border-gh-border px-2 py-1.5 align-top">{children}</td>,
  pre: ({ children }) => (
    <pre className="my-2 max-h-80 overflow-auto rounded-md border border-gh-border bg-gh-bg p-2.5 text-[11px] leading-relaxed text-gh-fg-default">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className?.includes('language-'))
    if (isBlock) {
      return (
        <code className={`block whitespace-pre font-mono text-gh-fg-default ${className ?? ''}`} {...props}>
          {children}
        </code>
      )
    }
    return (
      <code
        className="rounded bg-gh-border/50 px-1 py-0.5 font-mono text-[11px] text-gh-accent-fg"
        {...props}
      >
        {children}
      </code>
    )
  },
  img: ({ src, alt, title }) => {
    if (!src || !isSafeUrl(src)) return null
    return (
      <img
        src={src}
        alt={alt ?? ''}
        title={title}
        className="my-2 max-h-64 max-w-full rounded-md border border-gh-border object-contain"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    )
  },
  input: ({ type, checked, disabled, ...props }) => {
    if (type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={Boolean(checked)}
          disabled={disabled ?? true}
          readOnly
          className="mr-1.5 align-middle accent-gh-accent"
          {...props}
        />
      )
    }
    return <input type={type} {...props} />
  },
}

type CommentMarkdownProps = {
  source: string
  className?: string
}

/** GitHub-flavoured markdown for issue comments, review bodies, Copilot text, etc. */
export default function CommentMarkdown({ source, className = '' }: CommentMarkdownProps) {
  const trimmed = source.trim()
  if (!trimmed) {
    return <p className="text-xs italic text-gh-fg-placeholder">No description.</p>
  }

  return (
    <div className={`gh-comment-md min-w-0 text-xs ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {source}
      </ReactMarkdown>
    </div>
  )
}

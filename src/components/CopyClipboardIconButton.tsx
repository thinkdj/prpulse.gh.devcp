import type { MouseEvent } from 'react'
import { Check, Copy } from 'lucide-react'

type CopyClipboardIconButtonProps = {
  text: string
  copyKey: string
  copiedKey: string | null
  onCopy: (text: string, key: string) => void
  title?: string
  ariaLabel?: string
  /** Use when the button sits inside a clickable row */
  stopPropagation?: boolean
}

/** Very small copy control (used after branch names). */
export default function CopyClipboardIconButton({
  text,
  copyKey,
  copiedKey,
  onCopy,
  title = 'Copy to clipboard',
  ariaLabel,
  stopPropagation = false,
}: CopyClipboardIconButtonProps) {
  const justCopied = copiedKey === copyKey

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) e.stopPropagation()
    onCopy(text, copyKey)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={justCopied ? 'Copied' : title}
      aria-label={ariaLabel ?? `Copy ${text}`}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border p-0 transition-colors ${
        justCopied
          ? 'border-gh-success/60 bg-gh-success/10 text-gh-success-fg'
          : 'border-gh-accent/50 bg-transparent text-gh-accent-fg hover:border-gh-accent hover:bg-gh-accent/10'
      }`}
    >
      {justCopied ? (
        <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
      ) : (
        <Copy className="h-3 w-3" strokeWidth={2.5} aria-hidden />
      )}
    </button>
  )
}

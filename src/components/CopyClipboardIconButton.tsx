import type { MouseEvent } from 'react'
import { Check, Copy } from '@phosphor-icons/react'

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
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full p-0 transition-colors ${
        justCopied
          ? 'bg-gh-success/15 text-gh-success-fg'
          : 'bg-gh-accent/10 text-gh-accent-fg hover:bg-gh-accent/20'
      }`}
    >
      {justCopied ? (
        <Check className="h-3 w-3" weight="bold" aria-hidden />
      ) : (
        <Copy className="h-3 w-3" weight="bold" aria-hidden />
      )}
    </button>
  )
}

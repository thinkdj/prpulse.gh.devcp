import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Copy text to the clipboard and briefly remember `key` for per-row UI feedback.
 */
export function useCopyFeedback(clearAfterMs = 2000) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const copy = useCallback(
    (text: string, key: string) => {
      void navigator.clipboard.writeText(text).then(
        () => {
          setCopiedKey(key)
          if (timerRef.current) clearTimeout(timerRef.current)
          timerRef.current = setTimeout(() => {
            setCopiedKey(null)
            timerRef.current = null
          }, clearAfterMs)
        },
        () => {
          /* clipboard denied */
        },
      )
    },
    [clearAfterMs],
  )

  return { copiedKey, copy }
}

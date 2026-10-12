import { useCallback, useRef, useState } from 'react'
import { clsx } from 'clsx'

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

/** A side panel's width that the user can drag, remembered between sessions. */
export function usePanelWidth(storageKey: string, initial: number, min: number, max: number) {
  const [width, setWidth] = useState(() => {
    let saved = 0
    try {
      saved = Number(localStorage.getItem(storageKey)) || 0
    } catch {
      // Storage unavailable: start from the default.
    }
    return clamp(saved || initial, min, max)
  })

  const save = useCallback(
    (value: number) => {
      try {
        localStorage.setItem(storageKey, String(Math.round(value)))
      } catch {
        // Nothing to do; the width still applies until the app closes.
      }
    },
    [storageKey]
  )

  return { width, setWidth, save, initial, min, max }
}

/**
 * The divider on a panel's right edge. Drag it to resize, use the arrow keys when it has
 * focus, or double-click it to go back to the default width.
 */
export function PanelResizer({
  label,
  panel,
}: {
  label: string
  panel: ReturnType<typeof usePanelWidth>
}) {
  const { width, setWidth, save, initial, min, max } = panel
  const start = useRef<{ x: number; width: number } | null>(null)
  // The width the last move set; state may not have re-rendered when the drag ends.
  const latest = useRef(width)
  const [dragging, setDragging] = useState(false)

  const apply = (value: number) => {
    const next = clamp(value, min, max)
    latest.current = next
    setWidth(next)
    return next
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(width)}
      aria-valuemin={min}
      aria-valuemax={max}
      title="Drag to resize. Double-click to reset."
      tabIndex={0}
      onPointerDown={(event) => {
        start.current = { x: event.clientX, width }
        setDragging(true)
        ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (start.current) apply(start.current.width + event.clientX - start.current.x)
      }}
      onPointerUp={() => {
        if (!start.current) return
        start.current = null
        setDragging(false)
        save(latest.current)
      }}
      onDoubleClick={() => save(apply(initial))}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') save(apply(width - 16))
        if (event.key === 'ArrowRight') save(apply(width + 16))
      }}
      className="group absolute inset-y-0 -right-1 z-20 w-2 cursor-col-resize touch-none focus:outline-none"
    >
      <span
        className={clsx(
          'pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors',
          dragging
            ? 'bg-primary'
            : 'bg-transparent group-hover:bg-primary/60 group-focus-visible:bg-primary'
        )}
      />
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'

/** A position as a fraction of the viewport, so it survives a resize. */
export interface Anchor {
  x: number
  y: number
}

/** Grabbing any of these should operate the control, not drag the panel. */
const INTERACTIVE = 'button, input, select, textarea, a, [role="slider"]'

/** Keeps a dragged element this far from the viewport edge. */
const MARGIN = 12

/** How close, in px, a drag must come before it is pulled onto a snap line. */
const SNAP_RANGE = 10

export interface SnapConfig {
  enabled: boolean
  /** regular grid step in px; 0 disables the grid while leaving the guides on */
  step: number
  /** other widgets' centres in px, to line up against */
  guidesX: number[]
  guidesY: number[]
}

/** The lines a drag is currently stuck to, in px, for drawing the guides. */
export interface SnapLines {
  x: number | null
  y: number | null
}

/**
 * Pulls a coordinate onto the nearest snap line. Guides win over the grid, so
 * lining up with another widget beats landing on an arbitrary grid step.
 */
function snapAxis(
  value: number,
  guides: number[],
  config: SnapConfig,
): { value: number; guide: number | null } {
  if (!config.enabled) return { value, guide: null }

  let best: number | null = null
  let bestDistance = SNAP_RANGE
  for (const guide of guides) {
    const distance = Math.abs(value - guide)
    if (distance < bestDistance) {
      bestDistance = distance
      best = guide
    }
  }
  if (best !== null) return { value: best, guide: best }

  if (config.step > 0) {
    const stepped = Math.round(value / config.step) * config.step
    if (Math.abs(value - stepped) < SNAP_RANGE) return { value: stepped, guide: null }
  }
  return { value, guide: null }
}

export function currentDrift(): Anchor {
  const style = getComputedStyle(document.documentElement)
  return {
    x: Number.parseFloat(style.getPropertyValue('--drift-x')) || 0,
    y: Number.parseFloat(style.getPropertyValue('--drift-y')) || 0,
  }
}

function clampAxis(centre: number, half: number, extent: number): number {
  const min = half + MARGIN
  const max = extent - half - MARGIN
  // Too big to fit: park it in the middle rather than snapping to a bad edge.
  if (max < min) return 0.5
  return Math.min(max, Math.max(min, centre)) / extent
}

export function clampAnchor(anchor: Anchor, width: number, height: number): Anchor {
  return {
    x: clampAxis(anchor.x * window.innerWidth, width / 2, window.innerWidth),
    y: clampAxis(anchor.y * window.innerHeight, height / 2, window.innerHeight),
  }
}

/**
 * Makes an absolutely-positioned element draggable by its own background. Returns a
 * live anchor that follows the pointer during a drag and commits on release, plus a
 * ref to attach to the element being moved.
 */
export function useDragAnchor(
  anchor: Anchor,
  onChange: (next: Anchor) => void,
  snap?: SnapConfig,
  onSnapLines?: (lines: SnapLines | null) => void,
) {
  const ref = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<Anchor | null>(null)

  // Read through a ref so a changing snap config never restarts a drag in progress.
  const live = useRef({ snap, onSnapLines })
  useEffect(() => {
    live.current = { snap, onSnapLines }
  })

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      const node = ref.current
      if (event.button !== 0 || !node) return
      if ((event.target as HTMLElement).closest(INTERACTIVE)) return

      const box = node.getBoundingClientRect()
      const drift = currentDrift()
      // The rect is where the burn-in drift has pushed the box, so the layout centre
      // is `rendered - drift`, and the grab offset is measured against that. Getting
      // this sign wrong makes a grabbed widget jump by twice the drift.
      const grabX = event.clientX - (box.left + box.width / 2 - drift.x)
      const grabY = event.clientY - (box.top + box.height / 2 - drift.y)

      const config: SnapConfig = live.current.snap ?? {
        enabled: false,
        step: 0,
        guidesX: [],
        guidesY: [],
      }
      // The viewport centre lines are always worth snapping to.
      const guidesX = [window.innerWidth / 2, ...config.guidesX]
      const guidesY = [window.innerHeight / 2, ...config.guidesY]

      const at = (clientX: number, clientY: number) => {
        const sx = snapAxis(clientX - grabX, guidesX, config)
        const sy = snapAxis(clientY - grabY, guidesY, config)
        return {
          anchor: {
            x: clampAxis(sx.value, box.width / 2, window.innerWidth),
            y: clampAxis(sy.value, box.height / 2, window.innerHeight),
          },
          lines: { x: sx.guide, y: sy.guide },
        }
      }

      const move = (e: PointerEvent) => {
        const next = at(e.clientX, e.clientY)
        setPreview(next.anchor)
        live.current.onSnapLines?.(next.lines)
      }
      const finish = (e: PointerEvent) => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', finish)
        window.removeEventListener('pointercancel', finish)
        setDragging(false)
        setPreview(null)
        live.current.onSnapLines?.(null)
        onChange(at(e.clientX, e.clientY).anchor)
      }

      setDragging(true)
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', finish)
      window.addEventListener('pointercancel', finish)
      event.preventDefault()
    },
    [onChange],
  )

  // The element's size and the window's, so the anchor can be kept on screen.
  const [fit, setFit] = useState({ width: 0, height: 0, viewW: 0, viewH: 0 })
  useEffect(() => {
    const node = ref.current
    if (!node) return

    const measure = () => {
      // offsetWidth, not getBoundingClientRect: the rect includes transforms, and
      // the drift and DVD bounce would make it jitter every frame.
      setFit({
        width: node.offsetWidth,
        height: node.offsetHeight,
        viewW: window.innerWidth,
        viewH: window.innerHeight,
      })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  // Clamp only what is *shown*. The saved anchor stays exactly where it was put, so a
  // window shrinking — or moving to a narrower monitor — slides a widget inward for
  // now, and widening it again brings the widget straight back. Saving the clamped
  // value instead would overwrite the layout every time the window changed size.
  const shown = fit.width && fit.viewW ? clampAnchor(anchor, fit.width, fit.height) : anchor

  return { ref, dragging, anchor: preview ?? shown, onPointerDown }
}

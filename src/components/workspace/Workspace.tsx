import { useCallback, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { FlipClock } from '../FlipClock'
import { GifWidget } from './GifWidget'
import { LyricsCard } from '@/features/spotify/Lyrics'
import { PlayerCard } from '@/features/spotify/NowPlaying'
import { useSpotify } from '@/features/spotify/store'
import { useDragAnchor, type Anchor, type SnapConfig, type SnapLines } from '@/lib/drag'
import { useDvdBounce, useElementSize, usePointerActive } from '@/lib/hooks'
import {
  DEFAULT_WORKSPACE,
  clamp,
  insideGrid,
  overlaps,
  packLayout,
  type BentoSpot,
  type WidgetId,
} from '@/lib/workspace'
import { useSettings } from '@/store/settings'

/**
 * Lays out every widget in whichever mode is active. Free mode positions each one by
 * its own anchor; bento mode snaps them into a CSS grid. Both ride the Stage's
 * burn-in drift through `--drift-x` / `--drift-y`.
 */
export function Workspace() {
  const workspace = useSettings((s) => s.workspace)
  const present = usePresentWidgets()

  return workspace.mode === 'bento' ? (
    <BentoLayout present={present} />
  ) : (
    <FreeLayout present={present} />
  )
}

/** Which widgets exist right now, and which are currently faded out. */
function usePresentWidgets(): { ids: WidgetId[]; faded: Record<WidgetId, boolean> } {
  const spotify = useSettings((s) => s.spotify)
  const hideClock = useSettings((s) => s.hideClock)
  const gif = useSettings((s) => s.workspace.gif)
  const status = useSpotify((s) => s.status)
  const hasTrack = useSpotify((s) => Boolean(s.playback?.track))
  const idle = useSpotify((s) => s.idle)
  const hasPolled = useSpotify((s) => s.hasPolled)
  const pointerActive = usePointerActive()

  const connected = status === 'connected'
  const ids: WidgetId[] = ['clock']
  // Before the first poll answers, the player is mounted anyway so it can say it is
  // loading — otherwise it pops in a second or two after everything else.
  if (spotify.showNowPlaying && connected && (hasTrack || idle || !hasPolled)) ids.push('player')
  if (spotify.showLyrics && connected) ids.push('lyrics')
  if (gif.visible && gif.source) ids.push('gif')

  return {
    ids,
    faded: {
      clock: hideClock,
      player: spotify.autoHide && !pointerActive,
      lyrics: false,
      gif: false,
    },
  }
}

function widgetContent(id: WidgetId, fill: boolean, budget?: { width: number; height: number }) {
  switch (id) {
    case 'clock':
      return <FlipClock budget={budget} />
    case 'player':
      return <PlayerCard fill={fill} />
    case 'lyrics':
      return <LyricsCard fill={fill} />
    case 'gif':
      return <GifWidget fill={fill} />
  }
}

/** A hover-only affordance for putting one widget back where it started. */
function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <button
      type="button"
      title="Reset position"
      aria-label="Reset position"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onReset}
      className="glass-panel absolute -top-2 -right-2 z-30 flex h-6 w-6 items-center justify-center rounded-full text-white/80 opacity-0 transition-opacity hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
    >
      <RotateCcw className="h-3 w-3" />
    </button>
  )
}

// ------------------------------------------------------------------ free mode

function FreeLayout({ present }: { present: ReturnType<typeof usePresentWidgets> }) {
  // Guides are drawn by the layout rather than the widget, so a line can run the
  // full height of the screen instead of being clipped to the box being dragged.
  const [lines, setLines] = useState<SnapLines | null>(null)

  return (
    <>
      {present.ids.map((id) => (
        <FreeWidget key={id} id={id} faded={present.faded[id]} onSnapLines={setLines} />
      ))}
      {lines?.x != null && (
        <span
          className="pointer-events-none absolute inset-y-0 z-30 w-px bg-white/45"
          style={{ left: lines.x }}
        />
      )}
      {lines?.y != null && (
        <span
          className="pointer-events-none absolute inset-x-0 z-30 h-px bg-white/45"
          style={{ top: lines.y }}
        />
      )}
    </>
  )
}

function FreeWidget({
  id,
  faded,
  onSnapLines,
}: {
  id: WidgetId
  faded: boolean
  onSnapLines: (lines: SnapLines | null) => void
}) {
  const spot = useSettings((s) => s.workspace.placements[id].free)
  const placements = useSettings((s) => s.workspace.placements)
  const snapOn = useSettings((s) => s.workspace.snap)
  const snapStep = useSettings((s) => s.workspace.snapStep)
  const setFreeSpot = useSettings((s) => s.setFreeSpot)
  const protect = useSettings((s) => s.screenProtect)
  const commit = useCallback((next: Anchor) => setFreeSpot(id, next), [id, setFreeSpot])

  // Every other widget's centre becomes a line this one can line up against.
  const snap: SnapConfig = {
    enabled: snapOn,
    step: snapStep,
    guidesX: Object.entries(placements)
      .filter(([other]) => other !== id)
      .map(([, p]) => p.free.x * window.innerWidth),
    guidesY: Object.entries(placements)
      .filter(([other]) => other !== id)
      .map(([, p]) => p.free.y * window.innerHeight),
  }

  const { ref, dragging, anchor, onPointerDown } = useDragAnchor(spot, commit, snap, onSnapLines)
  // Only the clock does the DVD bounce, and only while it is not being dragged.
  const dvdRef = useDvdBounce<HTMLDivElement>(id === 'clock' && protect === 'dvd' && !dragging)

  return (
    <div
      ref={mergeRefs(ref, dvdRef)}
      onPointerDown={onPointerDown}
      style={{
        left: `${anchor.x * 100}%`,
        top: `${anchor.y * 100}%`,
        transform:
          'translate(-50%, -50%) translate(var(--drift-x, 0px), var(--drift-y, 0px)) translate(var(--dvd-x, 0px), var(--dvd-y, 0px))',
      }}
      // `w-max` matters: an absolutely positioned box at left:50% otherwise only gets
      // the remaining half of the viewport to lay out in, which wraps the clock.
      className={`group absolute z-10 w-max max-w-none ${
        dragging ? 'cursor-grabbing' : 'cursor-grab'
      } ${faded && !dragging ? 'pointer-events-none opacity-0' : 'opacity-100'} ${
        dragging ? '' : 'transition-opacity duration-300'
      }`}
    >
      <div className={dragging ? 'rounded-2xl ring-2 ring-white/40' : ''}>
        {widgetContent(id, false)}
      </div>
      {!dragging && (
        <ResetButton onReset={() => setFreeSpot(id, DEFAULT_WORKSPACE.placements[id].free)} />
      )}
    </div>
  )
}

// ----------------------------------------------------------------- bento mode

interface BentoDrag {
  id: WidgetId
  spot: BentoSpot
  valid: boolean
}

function BentoLayout({ present }: { present: ReturnType<typeof usePresentWidgets> }) {
  const workspace = useSettings((s) => s.workspace)
  const setBentoSpot = useSettings((s) => s.setBentoSpot)
  const setBentoSpots = useSettings((s) => s.setBentoSpots)
  const grid = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<BentoDrag | null>(null)

  const { columns, rows, gap, padding, placements, boxes } = workspace

  // What is actually shown: saved spots with any collisions resolved. Everything
  // below — drawing, where a drag starts, what it may land on — works from this, so
  // the grid on screen and the rules for moving within it can never disagree.
  const layout = useMemo(
    () => packLayout(placements, present.ids, columns, rows),
    [placements, present.ids, columns, rows],
  )

  /** Which cell a client point falls in, clamped to the grid. */
  const cellAt = useCallback(
    (clientX: number, clientY: number) => {
      const box = grid.current?.getBoundingClientRect()
      if (!box) return { col: 0, row: 0 }
      const cellW = (box.width - gap * (columns - 1)) / columns
      const cellH = (box.height - gap * (rows - 1)) / rows
      return {
        col: clamp(Math.floor((clientX - box.left) / (cellW + gap)), 0, columns - 1),
        row: clamp(Math.floor((clientY - box.top) / (cellH + gap)), 0, rows - 1),
      }
    },
    [columns, rows, gap],
  )

  const begin = useCallback(
    (id: WidgetId, event: React.PointerEvent, kind: 'move' | 'resize') => {
      const start = layout[id]
      const origin = cellAt(event.clientX, event.clientY)
      // Keep the cell the drag started on under the pointer while moving.
      const grabCol = origin.col - start.col
      const grabRow = origin.row - start.row

      const nextSpot = (clientX: number, clientY: number): BentoSpot => {
        const cell = cellAt(clientX, clientY)
        if (kind === 'resize') {
          return {
            ...start,
            w: clamp(cell.col - start.col + 1, 1, columns - start.col),
            h: clamp(cell.row - start.row + 1, 1, rows - start.row),
          }
        }
        return {
          ...start,
          col: clamp(cell.col - grabCol, 0, columns - start.w),
          row: clamp(cell.row - grabRow, 0, rows - start.h),
        }
      }

      const evaluate = (clientX: number, clientY: number): BentoDrag => {
        const spot = nextSpot(clientX, clientY)
        const valid =
          insideGrid(spot, columns, rows) &&
          !present.ids.some((other) => other !== id && overlaps(spot, layout[other]))
        return { id, spot, valid }
      }

      const move = (e: PointerEvent) => setDrag(evaluate(e.clientX, e.clientY))
      const finish = (e: PointerEvent) => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', finish)
        window.removeEventListener('pointercancel', finish)
        const final = evaluate(e.clientX, e.clientY)
        // An invalid drop snaps back rather than stacking boxes on top of each other.
        // A valid one saves the whole layout as shown, so any box that had been moved
        // aside keeps its new spot instead of reclaiming its old one out from under
        // the box that was just dropped.
        if (final.valid) setBentoSpots({ ...layout, [id]: final.spot })
        setDrag(null)
      }

      setDrag(evaluate(event.clientX, event.clientY))
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', finish)
      window.addEventListener('pointercancel', finish)
      event.preventDefault()
      event.stopPropagation()
    },
    [cellAt, columns, rows, layout, present.ids, setBentoSpots],
  )

  return (
    <div
      ref={grid}
      className="absolute inset-0 grid"
      style={{
        padding,
        gap,
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        transform: 'translate(var(--drift-x, 0px), var(--drift-y, 0px))',
      }}
    >
      {present.ids.map((id) => {
        const live = drag?.id === id ? drag : null
        const spot = live?.spot ?? layout[id]
        return (
          <BentoWidget
            key={id}
            id={id}
            spot={spot}
            boxed={boxes}
            faded={present.faded[id]}
            dragging={Boolean(live)}
            invalid={live ? !live.valid : false}
            onGrab={begin}
            onReset={() => setBentoSpot(id, DEFAULT_WORKSPACE.placements[id].bento)}
          />
        )
      })}
    </div>
  )
}

function BentoWidget({
  id,
  spot,
  boxed,
  faded,
  dragging,
  invalid,
  onGrab,
  onReset,
}: {
  id: WidgetId
  spot: BentoSpot
  boxed: boolean
  faded: boolean
  dragging: boolean
  invalid: boolean
  onGrab: (id: WidgetId, event: React.PointerEvent, kind: 'move' | 'resize') => void
  onReset: () => void
}) {
  const { ref, size } = useElementSize<HTMLDivElement>()
  const inset = boxed ? 14 : 0

  return (
    <div
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button, input, select, textarea, a, [role="slider"]'))
          return
        onGrab(id, e, 'move')
      }}
      style={{
        gridColumn: `${spot.col + 1} / span ${spot.w}`,
        gridRow: `${spot.row + 1} / span ${spot.h}`,
      }}
      className={`group relative flex min-h-0 min-w-0 items-center justify-center rounded-2xl ${
        dragging ? 'z-20 cursor-grabbing' : 'cursor-grab'
      } ${boxed ? 'glass-panel' : ''} ${
        faded && !dragging ? 'pointer-events-none opacity-0' : 'opacity-100'
      } ${dragging ? '' : 'transition-opacity duration-300'} ${
        invalid ? 'ring-2 ring-red-400/80' : dragging ? 'ring-2 ring-white/60' : ''
      }`}
    >
      <div
        ref={ref}
        className="flex h-full w-full items-center justify-center overflow-hidden"
        style={{ padding: inset }}
      >
        {size.width > 0 &&
          widgetContent(id, id !== 'clock', {
            width: Math.max(1, size.width),
            height: Math.max(1, size.height),
          })}
      </div>

      {!dragging && <ResetButton onReset={onReset} />}

      <span
        role="presentation"
        onPointerDown={(e) => onGrab(id, e, 'resize')}
        title="Resize"
        className="absolute right-1.5 bottom-1.5 h-5 w-5 cursor-nwse-resize rounded-br-lg border-r-2 border-b-2 border-white/55 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </div>
  )
}

/** Attaches one node to several refs — the drag hook and the bounce both need it. */
function mergeRefs<T extends HTMLElement>(...refs: React.RefObject<T | null>[]) {
  return (node: T | null) => {
    for (const ref of refs) ref.current = node
  }
}

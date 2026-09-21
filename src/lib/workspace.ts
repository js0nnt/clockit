export type WidgetId = 'clock' | 'player' | 'lyrics' | 'gif'
export type LayoutMode = 'free' | 'bento'

/** Free mode: the widget's centre, as a fraction of the viewport. */
export interface FreeSpot {
  x: number
  y: number
}

/** Bento mode: a rectangle of grid cells, zero-indexed from the top left. */
export interface BentoSpot {
  col: number
  row: number
  w: number
  h: number
}

export interface Placement {
  free: FreeSpot
  bento: BentoSpot
}

export interface GifSettings {
  /** an http(s) URL, or `STORED_GIF` when the file lives in IndexedDB */
  source: string | null
  fit: 'cover' | 'contain'
  visible: boolean
}

export interface Workspace {
  mode: LayoutMode
  columns: number
  rows: number
  /** space between cells, px */
  gap: number
  /** space between the grid and the window edge, px */
  padding: number
  /** draw the box behind each widget in bento mode */
  boxes: boolean
  /** magnetise free-mode dragging to a grid, the centre lines and other widgets */
  snap: boolean
  /** free-mode snap grid step, px */
  snapStep: number
  placements: Record<WidgetId, Placement>
  gif: GifSettings
}

/** Sentinel for `gif.source` meaning "the uploaded file in IndexedDB". */
export const STORED_GIF = 'stored:gif'

export const WIDGETS: { id: WidgetId; label: string }[] = [
  { id: 'clock', label: 'Clock' },
  { id: 'player', label: 'Player' },
  { id: 'lyrics', label: 'Lyrics' },
  { id: 'gif', label: 'GIF' },
]

export const GRID_LIMITS = { columns: [2, 8], rows: [2, 6] } as const

export const DEFAULT_WORKSPACE: Workspace = {
  mode: 'free',
  columns: 4,
  rows: 3,
  gap: 16,
  padding: 28,
  boxes: true,
  snap: true,
  snapStep: 24,
  placements: {
    clock: { free: { x: 0.5, y: 0.5 }, bento: { col: 0, row: 0, w: 3, h: 2 } },
    player: { free: { x: 0.5, y: 0.1 }, bento: { col: 0, row: 2, w: 2, h: 1 } },
    lyrics: { free: { x: 0.5, y: 0.8 }, bento: { col: 2, row: 2, w: 2, h: 1 } },
    gif: { free: { x: 0.82, y: 0.72 }, bento: { col: 3, row: 0, w: 1, h: 2 } },
  },
  gif: { source: null, fit: 'cover', visible: false },
}

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export function overlaps(a: BentoSpot, b: BentoSpot): boolean {
  return (
    a.col < b.col + b.w && b.col < a.col + a.w && a.row < b.row + b.h && b.row < a.row + a.h
  )
}

export function insideGrid(spot: BentoSpot, columns: number, rows: number): boolean {
  return (
    spot.col >= 0 &&
    spot.row >= 0 &&
    spot.w >= 1 &&
    spot.h >= 1 &&
    spot.col + spot.w <= columns &&
    spot.row + spot.h <= rows
  )
}

/** Pulls a placement back inside the grid after the grid is made smaller. */
export function fitToGrid(spot: BentoSpot, columns: number, rows: number): BentoSpot {
  const w = clamp(spot.w, 1, columns)
  const h = clamp(spot.h, 1, rows)
  return {
    w,
    h,
    col: clamp(spot.col, 0, columns - w),
    row: clamp(spot.row, 0, rows - h),
  }
}

/**
 * Who keeps their spot when two boxes want the same cells: the clock is what the
 * app is for, then the player, lyrics and GIF. The same order, reversed, decides
 * who shrinks first when the grid is too small for everything.
 */
const PRIORITY: WidgetId[] = ['clock', 'player', 'lyrics', 'gif']

/**
 * Lays the given widgets into the grid with no two boxes overlapping.
 *
 * Saved spots can collide: shrinking the grid pulls every box inside it on its own,
 * and a widget that appears (the player when music starts, a GIF switched on) comes
 * back to cells something else may have moved into. Each box keeps its saved spot if
 * that is free, otherwise takes the nearest free spot of the same size. When there is
 * no room at all, the lowest-priority box shrinks a step and the whole thing is tried
 * again — so with at least one cell per widget, everything always fits.
 */
export function packLayout(
  placements: Record<WidgetId, Placement>,
  ids: WidgetId[],
  columns: number,
  rows: number,
): Record<WidgetId, BentoSpot> {
  const order = PRIORITY.filter((id) => ids.includes(id))
  const wanted = Object.fromEntries(
    order.map((id) => [id, fitToGrid(placements[id].bento, columns, rows)]),
  ) as Record<WidgetId, BentoSpot>
  const sizes = Object.fromEntries(
    order.map((id) => [id, { w: wanted[id].w, h: wanted[id].h }]),
  ) as Record<WidgetId, { w: number; h: number }>

  // Each round shrinks one box by one cell, so this bounds the work outright.
  const maxRounds = order.reduce((n, id) => n + sizes[id].w + sizes[id].h, 0) + 1
  for (let round = 0; round < maxRounds; round++) {
    const placed: BentoSpot[] = []
    const result = {} as Record<WidgetId, BentoSpot>
    let blocked: WidgetId | null = null

    for (const id of order) {
      const { w, h } = sizes[id]
      const target = fitToGrid({ ...wanted[id], w, h }, columns, rows)
      const spot = nearestFree(target, placed, columns, rows)
      if (!spot) {
        blocked = id
        break
      }
      result[id] = spot
      placed.push(spot)
    }
    if (!blocked) return result

    // Make room: shrink the lowest-priority box that still can, along its longer side.
    const victim = [...order].reverse().find((id) => sizes[id].w * sizes[id].h > 1)
    if (!victim) break
    const size = sizes[victim]
    if (size.w >= size.h) size.w -= 1
    else size.h -= 1
  }

  // Fewer cells than widgets: nothing can avoid overlapping, so fall back to saved spots.
  return wanted
}

/** The free spot of `target`'s size closest to where `target` wants to be, if any. */
function nearestFree(
  target: BentoSpot,
  placed: BentoSpot[],
  columns: number,
  rows: number,
): BentoSpot | null {
  const free = (spot: BentoSpot) =>
    insideGrid(spot, columns, rows) && !placed.some((other) => overlaps(spot, other))
  if (free(target)) return target

  let best: BentoSpot | null = null
  let bestDistance = Infinity
  for (let row = 0; row + target.h <= rows; row++) {
    for (let col = 0; col + target.w <= columns; col++) {
      const spot = { col, row, w: target.w, h: target.h }
      if (!free(spot)) continue
      const distance = Math.abs(col - target.col) + Math.abs(row - target.row)
      if (distance < bestDistance) {
        best = spot
        bestDistance = distance
      }
    }
  }
  return best
}

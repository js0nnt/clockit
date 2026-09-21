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
    clock: { free: { x: 0.5, y: 0.46 }, bento: { col: 0, row: 0, w: 3, h: 2 } },
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

/**
 * A bento move is allowed only onto empty cells — overlapping boxes would stack on
 * top of each other, which is exactly what a bento layout is meant to avoid.
 */
export function spotIsFree(
  spot: BentoSpot,
  self: WidgetId,
  placements: Record<WidgetId, Placement>,
  present: WidgetId[],
  columns: number,
  rows: number,
): boolean {
  if (!insideGrid(spot, columns, rows)) return false
  return !present.some((id) => id !== self && overlaps(spot, placements[id].bento))
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

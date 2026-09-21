import type { BackdropId } from './types'

export interface BackdropMeta {
  id: BackdropId
  label: string
  /** CSS backdrops are keyframe layers; canvas backdrops run a simulation. */
  kind: 'none' | 'css' | 'canvas'
  hint: string
}

export const BACKDROPS: BackdropMeta[] = [
  { id: 'none', label: 'None', kind: 'none', hint: 'Just the background gradient' },
  { id: 'aurora', label: 'Aurora', kind: 'css', hint: 'Slow drifting light blooms' },
  { id: 'rays', label: 'Rays', kind: 'css', hint: 'Soft diagonal bands sliding past' },
  { id: 'tide', label: 'Tide', kind: 'css', hint: 'Liquid crests rolling underneath' },
  { id: 'grid', label: 'Grid', kind: 'css', hint: 'A horizon grid running to vanishing point' },
  { id: 'starfield', label: 'Starfield', kind: 'canvas', hint: 'Stars streaming toward you' },
  { id: 'bokeh', label: 'Bokeh', kind: 'canvas', hint: 'Out-of-focus orbs rising' },
  { id: 'ripple', label: 'Ripple', kind: 'canvas', hint: 'A ring on every flip of the clock' },
]

export const BACKDROP_BY_ID = new Map(BACKDROPS.map((b) => [b.id, b]))

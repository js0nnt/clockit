import type { FontId } from './types'

export const FONTS: { id: FontId; label: string; stack: string; weight?: number }[] = [
  { id: 'inter', label: 'Inter', stack: '"Inter", system-ui, sans-serif' },
  { id: 'mono', label: 'Mono', stack: '"JetBrains Mono", ui-monospace, monospace' },
  { id: 'playfair', label: 'Playfair', stack: '"Playfair Display", Georgia, serif' },
  { id: 'interBold', label: 'Inter Bold', stack: '"Inter", system-ui, sans-serif', weight: 800 },
  { id: 'baskerville', label: 'Baskerville', stack: '"Libre Baskerville", Baskerville, serif' },
  { id: 'saira', label: 'Saira', stack: '"Saira", system-ui, sans-serif' },
]

export const FONT_BY_ID = new Map(FONTS.map((f) => [f.id, f]))

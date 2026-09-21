import type { ColorSpec } from './types'

/** Turn a ColorSpec into a CSS `background-image` value (always an image, never a bare colour). */
export function toCss(spec: ColorSpec): string {
  switch (spec.kind) {
    case 'solid':
      return `linear-gradient(${spec.a}, ${spec.a})`
    case 'radial':
      return `radial-gradient(circle at ${spec.x}% ${spec.y}%, ${spec.a} 0%, ${spec.b} 100%)`
    case 'linear':
    default:
      return `linear-gradient(${spec.rotation}deg, ${spec.a} 0%, ${spec.b} 100%)`
  }
}

/** Average of the two stops — used where a single flat colour is needed (canvas, meta theme). */
export function averageColor(spec: ColorSpec): string {
  if (spec.kind === 'solid') return spec.a
  const a = parseHex(spec.a)
  const b = parseHex(spec.b)
  if (!a || !b) return spec.a
  const mix = a.map((v, i) => Math.round((v + b[i]) / 2))
  return `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

export function parseHex(hex: string): [number, number, number] | null {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6 || !/^[0-9a-f]{6}$/i.test(h)) return null
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

export function isLight(hex: string): boolean {
  const rgb = parseHex(hex)
  if (!rgb) return false
  const [r, g, b] = rgb.map((v) => v / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6
}

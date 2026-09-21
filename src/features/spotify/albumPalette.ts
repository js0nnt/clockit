import { create } from 'zustand'
import type { ColorSpec } from '@/lib/types'

export interface AlbumPalette {
  /** the strongest colour in the artwork */
  vibrant: string
  /** a second colour far enough round the wheel to read as a different hue */
  secondary: string
  /** a dark and a mid tone, for the background gradient */
  dark: string
  mid: string
  background: ColorSpec
}

interface AlbumPaletteState {
  palette: AlbumPalette | null
  /** artwork url the current palette came from, so the same art is not re-sampled */
  source: string | null
  set: (source: string | null, palette: AlbumPalette | null) => void
}

/**
 * Kept separate from the settings store so `useColors()` can read it without the
 * settings module depending on the Spotify feature.
 */
export const useAlbumPalette = create<AlbumPaletteState>((set) => ({
  palette: null,
  source: null,
  set: (source, palette) => set({ source, palette }),
}))

const SIZE = 40

/**
 * Samples the artwork on a small canvas and buckets the pixels by colour. Returns
 * null when the image cannot be read — Spotify's CDN allows cross-origin reads, but
 * a blocked or failed load must not take the clock down with it.
 */
export async function extractPalette(url: string): Promise<AlbumPalette | null> {
  const image = await loadImage(url)
  if (!image) return null

  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  let pixels: Uint8ClampedArray
  try {
    ctx.drawImage(image, 0, 0, SIZE, SIZE)
    pixels = ctx.getImageData(0, 0, SIZE, SIZE).data
  } catch {
    return null // tainted canvas
  }

  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>()
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    // 4 bits per channel is coarse enough to group shades of one colour together.
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.r += r
      bucket.g += g
      bucket.b += b
      bucket.n++
    } else {
      buckets.set(key, { r, g, b, n: 1 })
    }
  }
  if (!buckets.size) return null

  const swatches = [...buckets.values()]
    .map((b) => {
      const rgb: RGB = [b.r / b.n, b.g / b.n, b.b / b.n]
      const [h, s, l] = toHsl(rgb)
      return { rgb, hue: h, sat: s, lum: l, count: b.n }
    })
    .sort((a, b) => b.count - a.count)

  // Prefer colours that are both common and saturated, and mid-toned rather than
  // washed out at either end. Count is square-rooted so that a sleeve which is
  // mostly white does not simply hand back white — a smaller vivid area wins.
  const score = (sw: (typeof swatches)[number]) =>
    Math.sqrt(sw.count) *
    (0.1 + Math.pow(sw.sat, 1.5)) *
    Math.max(0.05, 1 - Math.abs(sw.lum - 0.55) * 1.3)

  const ranked = [...swatches].sort((a, b) => score(b) - score(a))

  // A sleeve that is mostly white or black should not hand back white or black as
  // its accent, so greyscale and blown-out swatches are set aside first. If the
  // artwork really is monochrome the filter empties and the ranking stands.
  const colourful = ranked.filter((sw) => sw.sat >= 0.18 && sw.lum > 0.12 && sw.lum < 0.9)
  const pool = colourful.length ? colourful : ranked

  const vibrant = pool[0]
  const secondary =
    pool.find((sw) => sw !== vibrant && hueGap(sw.hue, vibrant.hue) > 35) ?? pool[1] ?? vibrant

  const darkest = [...swatches].sort((a, b) => a.lum - b.lum)[0]
  const dark = shade(darkest.rgb, 0.45)
  const mid = shade(vibrant.rgb, 0.62)

  return {
    vibrant: hex(lift(vibrant.rgb)),
    secondary: hex(lift(secondary.rgb)),
    dark: hex(dark),
    mid: hex(mid),
    background: {
      a: hex(mid),
      b: hex(dark),
      kind: 'linear',
      rotation: 155,
      x: 50,
      y: 50,
    },
  }
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })
}

type RGB = [number, number, number]

function toHsl([r, g, b]: RGB): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return [h * 360, s, l]
}

function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/** Scale toward black, for background tones. */
function shade(rgb: RGB, amount: number): RGB {
  return rgb.map((v) => v * (1 - amount)) as RGB
}

/** Nudge very dark accents up so they still read as a colour over the artwork. */
function lift(rgb: RGB): RGB {
  const [, , l] = toHsl(rgb)
  if (l > 0.28) return rgb
  const factor = 0.28 / Math.max(l, 0.04)
  return rgb.map((v) => Math.min(255, v * factor)) as RGB
}

function hex(rgb: RGB): string {
  return `#${rgb
    .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'))
    .join('')}`
}

import { useAlbumPalette } from '@/features/spotify/albumPalette'
import { parseHex } from '@/lib/paint'
import { useColors, useSettings } from '@/store/settings'

export interface BackdropPalette {
  accent1: string
  accent2: string
  /** the same accents as rgb triples, for canvas work that needs its own alpha */
  rgb1: [number, number, number]
  rgb2: [number, number, number]
}

const FALLBACK: [number, number, number] = [255, 255, 255]

/**
 * Backdrops borrow the active style's colours so a new theme restyles the motion too.
 * With `accent` on they take the flap and digit colours, which read as light over the
 * background; with it off they stay inside the background's own two stops.
 */
export function useBackdropPalette(): BackdropPalette {
  const colors = useColors()
  const accent = useSettings((s) => s.backdrop.accent)
  const albumColours = useSettings((s) => s.spotify.albumColours)
  const album = useAlbumPalette((s) => s.palette)

  // Artwork colours, when enabled, take the backdrop over entirely.
  const fromAlbum = albumColours && album
  const a = fromAlbum ? album.vibrant : accent ? colors.digits.a : colors.background.a
  const b = fromAlbum ? album.secondary : accent ? colors.flap.a : colors.background.b
  const rgb1 = parseHex(a) ?? FALLBACK
  const rgb2 = parseHex(b) ?? FALLBACK

  return { accent1: a, accent2: b, rgb1, rgb2 }
}

export const rgba = (c: [number, number, number], alpha: number) =>
  `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`

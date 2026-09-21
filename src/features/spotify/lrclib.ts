import type { Track } from './types'

/**
 * Lyrics are not part of Spotify's API. LRCLIB is a free, keyless, CORS-friendly
 * community database of `.lrc` files, matched on track/artist/album/duration.
 */
const ENDPOINT = 'https://lrclib.net/api/get'

export interface LyricLine {
  /** milliseconds from the start of the track */
  at: number
  text: string
}

export interface LyricsResult {
  /** empty when only unsynced lyrics were found */
  lines: LyricLine[]
  plain: string | null
  synced: boolean
}

interface LrclibResponse {
  syncedLyrics?: string | null
  plainLyrics?: string | null
}

export async function fetchLyrics(track: Track, signal?: AbortSignal): Promise<LyricsResult | null> {
  const params = new URLSearchParams({
    track_name: track.name,
    artist_name: firstArtist(track.artists),
    album_name: track.album,
    duration: Math.round(track.durationMs / 1000).toString(),
  })

  let response: Response
  try {
    response = await fetch(`${ENDPOINT}?${params}`, { signal })
  } catch {
    return null
  }
  if (!response.ok) return null

  const payload = (await response.json().catch(() => null)) as LrclibResponse | null
  if (!payload) return null

  const lines = parseLrc(payload.syncedLyrics ?? '')
  if (lines.length) return { lines, plain: payload.plainLyrics ?? null, synced: true }
  if (payload.plainLyrics) return { lines: [], plain: payload.plainLyrics, synced: false }
  return null
}

/** LRCLIB matches on a single artist, so a "A, B" credit would never hit. */
function firstArtist(artists: string): string {
  return artists.split(',')[0]?.trim() ?? artists
}

const TIMESTAMP = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g

export function parseLrc(source: string): LyricLine[] {
  const lines: LyricLine[] = []

  for (const raw of source.split('\n')) {
    TIMESTAMP.lastIndex = 0
    const stamps: number[] = []
    let match: RegExpExecArray | null
    while ((match = TIMESTAMP.exec(raw))) {
      const fraction = match[3] ? Number(match[3].padEnd(3, '0')) : 0
      stamps.push(Number(match[1]) * 60_000 + Number(match[2]) * 1000 + fraction)
    }
    if (!stamps.length) continue

    // One text can carry several timestamps when a line repeats in the song.
    const text = raw.replace(TIMESTAMP, '').trim()
    for (const at of stamps) lines.push({ at, text })
  }

  return lines.sort((a, b) => a.at - b.at)
}

/** Index of the line that should be highlighted at `positionMs`, or -1 before the first. */
export function activeLineIndex(lines: LyricLine[], positionMs: number): number {
  let low = 0
  let high = lines.length - 1
  let found = -1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (lines[mid].at <= positionMs) {
      found = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return found
}

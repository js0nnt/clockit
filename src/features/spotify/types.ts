export interface Track {
  id: string
  name: string
  artists: string
  album: string
  artwork: string | null
  durationMs: number
  url: string | null
}

export type RepeatMode = 'off' | 'context' | 'track'

export interface Playback {
  track: Track | null
  isPlaying: boolean
  /** progress reported by Spotify, interpolated locally between polls */
  progressMs: number
  /** performance.now() when `progressMs` was read */
  sampledAt: number
  shuffle: boolean
  repeat: RepeatMode
  /** null on devices that do not report volume */
  volume: number | null
  deviceName: string | null
}

/** Raw shapes from `GET /v1/me/player`, narrowed to what the UI uses. */
export interface PlayerResponse {
  is_playing: boolean
  progress_ms: number | null
  shuffle_state: boolean
  repeat_state: RepeatMode
  device: { name: string; volume_percent: number | null } | null
  item: {
    id: string | null
    name: string
    duration_ms: number
    external_urls?: { spotify?: string }
    album?: { name: string; images?: { url: string; width: number | null }[] }
    artists?: { name: string }[]
  } | null
}

export function toPlayback(response: PlayerResponse): Playback {
  const item = response.item
  return {
    track: item
      ? {
          id: item.id ?? item.name,
          name: item.name,
          artists: (item.artists ?? []).map((a) => a.name).join(', '),
          album: item.album?.name ?? '',
          artwork: pickArtwork(item.album?.images),
          durationMs: item.duration_ms,
          url: item.external_urls?.spotify ?? null,
        }
      : null,
    isPlaying: response.is_playing,
    progressMs: response.progress_ms ?? 0,
    sampledAt: performance.now(),
    shuffle: response.shuffle_state,
    repeat: response.repeat_state,
    volume: response.device?.volume_percent ?? null,
    deviceName: response.device?.name ?? null,
  }
}

/** Middle size where available — big enough to sample colours, small enough to fetch. */
function pickArtwork(images?: { url: string; width: number | null }[]): string | null {
  if (!images?.length) return null
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0))
  return (sorted.find((i) => (i.width ?? 0) >= 300) ?? sorted[sorted.length - 1]).url
}

/** Where playback is right now, accounting for time passed since the last poll. */
export function currentProgress(playback: Playback): number {
  if (!playback.isPlaying) return playback.progressMs
  const elapsed = performance.now() - playback.sampledAt
  const duration = playback.track?.durationMs ?? Infinity
  return Math.min(duration, playback.progressMs + elapsed)
}

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`
}

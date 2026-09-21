import { useEffect, useRef, useState } from 'react'
import { extractPalette, useAlbumPalette } from './albumPalette'
import { fetchLyrics, type LyricsResult } from './lrclib'
import { useSpotify } from './store'
import { currentProgress } from './types'
import { usePointerActive } from '@/lib/hooks'
import { useSettings } from '@/store/settings'

const PLAYING_MS = 2_500
const PAUSED_MS = 12_000
/** Poll harder near the end of a track so the next one appears promptly. */
const NEAR_END_MS = 1_000
const NEAR_END_WINDOW = 6_000
/** Coming back to the screen with a poll older than this is worth refreshing. */
const STALE_MS = 1_500

/** Drives the now-playing poll. Mounted once, from App. */
export function useSpotifySync() {
  const hasTokens = useSpotify((s) => Boolean(s.tokens))
  const isPlaying = useSpotify((s) => s.playback?.isPlaying ?? false)

  // The redirect back from Spotify lands on a normal app load.
  useEffect(() => {
    void useSpotify.getState().handleRedirect()
  }, [])

  // A session restored from storage may predate the profile, or be a different
  // account from last time the name was cached.
  useEffect(() => {
    if (hasTokens) void useSpotify.getState().loadProfile()
  }, [hasTokens])

  useEffect(() => {
    if (!hasTokens) return
    let timer: number | undefined
    let stopped = false

    const delay = () => {
      const playback = useSpotify.getState().playback
      if (!playback?.isPlaying || !playback.track) return PAUSED_MS
      const remaining = playback.track.durationMs - currentProgress(playback)
      return remaining < NEAR_END_WINDOW ? NEAR_END_MS : PLAYING_MS
    }

    const tick = async () => {
      if (stopped) return
      if (document.visibilityState === 'visible') await useSpotify.getState().poll()
      if (!stopped) timer = window.setTimeout(tick, delay())
    }

    void tick()
    const refresh = () => {
      if (document.visibilityState === 'visible') void useSpotify.getState().poll()
    }
    document.addEventListener('visibilitychange', refresh)
    // Alt-tabbing back fires `focus` without a visibility change.
    window.addEventListener('focus', refresh)

    return () => {
      stopped = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
    // `isPlaying` is a dependency so that starting or pausing restarts the loop and
    // the new cadence takes effect at once rather than after the pending timeout.
  }, [hasTokens, isPlaying])

  useAlbumColours()
  useRefreshOnWake(hasTokens)
}

/**
 * Touching the screen after a while should show what is playing *now*, not what was
 * playing when the last interval fired.
 */
function useRefreshOnWake(hasTokens: boolean) {
  const awake = usePointerActive()

  useEffect(() => {
    if (!awake || !hasTokens) return
    const { polledAt, poll } = useSpotify.getState()
    if (performance.now() - polledAt > STALE_MS) void poll()
  }, [awake, hasTokens])
}

/** Samples the artwork whenever the track changes and the feature is on. */
function useAlbumColours() {
  const artwork = useSpotify((s) => s.playback?.track?.artwork ?? null)
  const enabled = useSettings((s) => s.spotify.albumColours)
  const setPalette = useAlbumPalette((s) => s.set)

  useEffect(() => {
    if (!enabled || !artwork) {
      setPalette(null, null)
      return
    }
    let cancelled = false
    void extractPalette(artwork).then((palette) => {
      if (!cancelled) setPalette(artwork, palette)
    })
    return () => {
      cancelled = true
    }
  }, [artwork, enabled, setPalette])
}

export interface LyricsState {
  result: LyricsResult | null
  loading: boolean
}

/** Fetches lyrics for the current track, once per track. */
export function useLyrics(): LyricsState {
  const track = useSpotify((s) => s.playback?.track ?? null)
  const enabled = useSettings((s) => s.spotify.showLyrics)
  const [state, setState] = useState<LyricsState>({ result: null, loading: false })
  const lastKey = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || !track) {
      lastKey.current = null
      return
    }

    const key = `${track.id}:${track.name}`
    if (lastKey.current === key) return
    lastKey.current = key

    const controller = new AbortController()
    setState({ result: null, loading: true })
    void fetchLyrics(track, controller.signal).then((result) => {
      if (!controller.signal.aborted) setState({ result, loading: false })
    })

    return () => controller.abort()
  }, [enabled, track])

  // Derived rather than reset through state, so turning lyrics off or losing the
  // track needs no extra render pass.
  return enabled && track ? state : IDLE
}

const IDLE: LyricsState = { result: null, loading: false }

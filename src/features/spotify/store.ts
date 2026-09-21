import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { beginLogin, completeLogin, refreshTokens, type Tokens } from './auth'
import { toPlayback, type Playback, type PlayerResponse, type RepeatMode } from './types'

const API = 'https://api.spotify.com/v1'

/**
 * Clockit's own Spotify app. It is built in so visitors only ever see one Connect
 * button — PKCE has no client secret, so a Client ID is public by design and ends up
 * in every visitor's browser regardless. `VITE_SPOTIFY_CLIENT_ID` still overrides it
 * at build time, for anyone deploying a copy against their own Spotify app.
 */
const CLOCKIT_CLIENT_ID = '3b214e389a8e437cb874c4b77709bfe4'

const BUILT_IN_CLIENT_ID = (import.meta.env.VITE_SPOTIFY_CLIENT_ID || CLOCKIT_CLIENT_ID).trim()
export const hasBuiltInClientId = BUILT_IN_CLIENT_ID.length > 0

/** A Client ID typed into the panel wins; otherwise the deployment's own is used. */
export function effectiveClientId(override: string): string {
  return override.trim() || BUILT_IN_CLIENT_ID
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface Profile {
  name: string
  image: string | null
  /** null when the token predates the `user-read-private` scope */
  premium: boolean | null
}

interface SpotifyState {
  /** a user-supplied Client ID; empty means "use the built-in one" */
  clientId: string
  tokens: Tokens | null
  profile: Profile | null
  status: ConnectionStatus
  error: string | null
  /** set when Spotify is reachable but nothing is playing anywhere */
  idle: boolean
  playback: Playback | null
  /** false until the first poll answers, so the UI can say "loading" not "nothing" */
  hasPolled: boolean
  /** performance.now() of the last completed poll */
  polledAt: number

  setClientId: (id: string) => void
  connect: () => Promise<void>
  handleRedirect: () => Promise<void>
  disconnect: () => void
  poll: () => Promise<void>
  loadProfile: () => Promise<void>
  /** A fresh access token, refreshed if needed — for callers outside the store. */
  getAccessToken: () => Promise<string | null>

  togglePlay: () => Promise<void>
  next: () => Promise<void>
  previous: () => Promise<void>
  seek: (ms: number) => Promise<void>
  setVolume: (percent: number) => Promise<void>
  toggleShuffle: () => Promise<void>
  cycleRepeat: () => Promise<void>
}

const REPEAT_ORDER: RepeatMode[] = ['off', 'context', 'track']

export const useSpotify = create<SpotifyState>()(
  persist(
    (set, get) => {
      /**
       * Returns a usable access token, refreshing first if it is close to expiry.
       * Single-flighted so a burst of calls cannot start several refreshes.
       */
      let refreshing: Promise<string | null> | null = null

      const accessToken = async (): Promise<string | null> => {
        const { tokens } = get()
        const clientId = effectiveClientId(get().clientId)
        if (!tokens || !clientId) return null
        if (Date.now() < tokens.expiresAt - 30_000) return tokens.accessToken
        if (!tokens.refreshToken) return null

        refreshing ??= (async () => {
          try {
            const fresh = await refreshTokens(clientId, tokens.refreshToken)
            set({ tokens: fresh, status: 'connected', error: null })
            return fresh.accessToken
          } catch (e) {
            set({
              status: 'error',
              error: e instanceof Error ? e.message : 'Could not refresh the Spotify session.',
            })
            return null
          } finally {
            refreshing = null
          }
        })()
        return refreshing
      }

      const request = async (path: string, init?: RequestInit): Promise<Response | null> => {
        const token = await accessToken()
        if (!token) return null
        const response = await fetch(`${API}${path}`, {
          ...init,
          headers: { ...init?.headers, Authorization: `Bearer ${token}` },
        })

        if (response.status === 401) {
          set({ status: 'error', error: 'Spotify session expired — reconnect.' })
          return null
        }
        if (response.status === 403) {
          set({ error: await describeForbidden(response) })
          return response
        }
        if (response.status === 404) {
          set({ idle: true, error: 'No active Spotify device — start playing something first.' })
          return response
        }
        if (response.status === 429) {
          set({ error: 'Spotify is rate limiting — backing off.' })
          return response
        }
        return response
      }

      /** Control endpoints return 204 and Spotify's state lags, so re-read shortly after. */
      const command = async (path: string, init: RequestInit) => {
        const response = await request(path, init)
        if (response?.ok) set({ error: null, idle: false })
        setTimeout(() => void get().poll(), 350)
      }

      /** Updates the local playback immediately so buttons feel instant. */
      const optimistic = (patch: Partial<Playback>) => {
        const playback = get().playback
        if (playback) set({ playback: { ...playback, ...patch } })
      }

      return {
        clientId: '',
        tokens: null,
        profile: null,
        status: 'disconnected',
        error: null,
        idle: false,
        playback: null,
        hasPolled: false,
        polledAt: 0,

        setClientId: (clientId) => set({ clientId: clientId.trim(), error: null }),

        connect: async () => {
          const clientId = effectiveClientId(get().clientId)
          if (!clientId) {
            set({ status: 'error', error: 'Add your Spotify Client ID first.' })
            return
          }
          set({ status: 'connecting', error: null })
          await beginLogin(clientId)
        },

        handleRedirect: async () => {
          const clientId = effectiveClientId(get().clientId)
          if (!clientId) return
          const result = await completeLogin(clientId)
          if (!result) return
          if (result.error) {
            set({ status: 'error', error: result.error })
            return
          }
          set({ tokens: result.tokens ?? null, status: 'connected', error: null })
          void get().loadProfile()
          void get().poll()
        },

        getAccessToken: () => accessToken(),

        loadProfile: async () => {
          const response = await request('/me')
          if (!response?.ok) return
          const me = (await response.json().catch(() => null)) as {
            display_name?: string | null
            id?: string
            images?: { url: string }[]
            product?: string
          } | null
          if (!me) return
          set({
            profile: {
              name: me.display_name || me.id || 'Spotify user',
              image: me.images?.[0]?.url ?? null,
              premium: me.product ? me.product === 'premium' : null,
            },
          })
        },

        disconnect: () =>
          set({
            tokens: null,
            profile: null,
            status: 'disconnected',
            playback: null,
            error: null,
            idle: false,
            hasPolled: false,
          }),

        poll: async () => {
          if (!get().tokens) return
          const response = await request('/me/player')
          if (!response) return
          const done = { hasPolled: true, polledAt: performance.now() }
          // 204 means Spotify is reachable but no device is playing.
          if (response.status === 204) {
            set({ idle: true, playback: null, status: 'connected', ...done })
            return
          }
          if (!response.ok) {
            set(done)
            return
          }
          const payload = (await response.json().catch(() => null)) as PlayerResponse | null
          if (!payload) {
            set(done)
            return
          }
          set({
            playback: toPlayback(payload),
            status: 'connected',
            idle: false,
            error: null,
            ...done,
          })
        },

        togglePlay: async () => {
          const playing = get().playback?.isPlaying ?? false
          optimistic({ isPlaying: !playing })
          await command(playing ? '/me/player/pause' : '/me/player/play', { method: 'PUT' })
        },

        next: async () => command('/me/player/next', { method: 'POST' }),
        previous: async () => command('/me/player/previous', { method: 'POST' }),

        seek: async (ms) => {
          optimistic({ progressMs: Math.max(0, Math.round(ms)), sampledAt: performance.now() })
          await command(`/me/player/seek?position_ms=${Math.max(0, Math.round(ms))}`, {
            method: 'PUT',
          })
        },

        setVolume: async (percent) => {
          const value = Math.max(0, Math.min(100, Math.round(percent)))
          optimistic({ volume: value })
          await command(`/me/player/volume?volume_percent=${value}`, { method: 'PUT' })
        },

        toggleShuffle: async () => {
          const next = !(get().playback?.shuffle ?? false)
          optimistic({ shuffle: next })
          await command(`/me/player/shuffle?state=${next}`, { method: 'PUT' })
        },

        cycleRepeat: async () => {
          const current = get().playback?.repeat ?? 'off'
          const next = REPEAT_ORDER[(REPEAT_ORDER.indexOf(current) + 1) % REPEAT_ORDER.length]
          optimistic({ repeat: next })
          await command(`/me/player/repeat?state=${next}`, { method: 'PUT' })
        },
      }
    },
    {
      name: 'clockit:spotify',
      version: 1,
      // Only the credentials survive a reload; playback is re-read on startup.
      partialize: (s) => ({ clientId: s.clientId, tokens: s.tokens, profile: s.profile }),
      onRehydrateStorage: () => (state) => {
        if (state?.tokens) state.status = 'connected'
      },
    },
  ),
)

/**
 * Spotify answers 403 for three quite different reasons, and the fix for each is
 * different, so the body is read rather than guessing from the status.
 */
async function describeForbidden(response: Response): Promise<string> {
  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as { error?: { message?: string; reason?: string } } | null
  const message = body?.error?.message?.toLowerCase() ?? ''
  const reason = body?.error?.reason ?? ''

  // An app in Development Mode only admits accounts its owner has allowlisted.
  if (message.includes('not be registered') || message.includes('not registered')) {
    return "This Clockit's Spotify app is in development mode, so only accounts its owner has added can connect. Ask them to add the email on your Spotify account."
  }
  if (reason === 'PREMIUM_REQUIRED' || message.includes('premium')) {
    return 'Controlling playback needs Spotify Premium. What is playing still shows.'
  }
  return 'Spotify refused that request.'
}

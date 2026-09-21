import { useEffect } from 'react'
import { create } from 'zustand'
import { applySettings, currentSettings, isUntouched, type Snapshot } from './snapshot'
import { useSpotify } from '@/features/spotify/store'
import { useSettings } from '@/store/settings'

/**
 * Keeps settings following the Spotify account across devices. Last write wins by
 * timestamp: a change here is sent a moment later, and signing in pulls whatever
 * was saved most recently anywhere.
 */

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'unavailable' | 'error'

export const useSync = create<{ status: SyncStatus; syncedAt: number | null }>(() => ({
  status: 'off',
  syncedAt: null,
}))

const UPDATED_KEY = 'clockit:settings:updatedAt'
const PUSH_DELAY_MS = 2000
const ENDPOINT = '/api/settings'

/** Set while applying settings from the server, so that change is not sent straight back. */
let applying = false
/** The last `updatedAt` the server is known to hold, so an unchanged state is not re-sent. */
let serverHas = 0
let pushTimer: number | undefined
/** Once the deployment says it has no storage, stop asking for the rest of the session. */
let unavailable = false

function localUpdatedAt(): number {
  return Number(localStorage.getItem(UPDATED_KEY)) || 0
}

function setLocalUpdatedAt(value: number) {
  localStorage.setItem(UPDATED_KEY, String(value))
}

type CallResult = { kind: 'ok'; data: unknown; status: number } | { kind: 'unavailable' } | { kind: 'error' }

async function call(init: RequestInit & { token: string }): Promise<CallResult> {
  const { token, ...rest } = init
  let response: Response
  try {
    response = await fetch(ENDPOINT, {
      ...rest,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
  } catch {
    return { kind: 'error' }
  }
  // No function behind the route: a local `vite dev` without the proxy serves the
  // app's own HTML here, and a deployment without storage answers 503.
  const isJson = response.headers.get('content-type')?.includes('application/json')
  if (response.status === 503 || response.status === 404 || !isJson) return { kind: 'unavailable' }
  const data = await response.json().catch(() => null)
  if (!response.ok && response.status !== 409) return { kind: 'error' }
  return { kind: 'ok', data, status: response.status }
}

function adopt(snapshot: Snapshot) {
  applying = true
  try {
    applySettings(snapshot.settings)
  } finally {
    applying = false
  }
  setLocalUpdatedAt(snapshot.updatedAt)
  serverHas = snapshot.updatedAt
}

async function push(keepalive = false) {
  if (unavailable) return
  const updatedAt = localUpdatedAt()
  if (!updatedAt || updatedAt <= serverHas) return
  const token = await useSpotify.getState().getAccessToken()
  if (!token) return

  useSync.setState({ status: 'syncing' })
  const result = await call({
    token,
    method: 'PUT',
    keepalive,
    body: JSON.stringify({ updatedAt, settings: currentSettings() }),
  })

  if (result.kind === 'unavailable') {
    unavailable = true
    useSync.setState({ status: 'unavailable' })
    return
  }
  if (result.kind === 'error') {
    useSync.setState({ status: 'error' })
    return
  }
  // 409: another device saved something newer in the meantime — take that instead.
  if (result.status === 409) {
    const newer = (result.data as { snapshot?: Snapshot } | null)?.snapshot
    if (newer) adopt(newer)
  } else {
    serverHas = updatedAt
  }
  useSync.setState({ status: 'synced', syncedAt: Date.now() })
}

async function pull() {
  if (unavailable) return
  const token = await useSpotify.getState().getAccessToken()
  if (!token) return

  useSync.setState({ status: 'syncing' })
  const result = await call({ token, method: 'GET' })
  if (result.kind === 'unavailable') {
    unavailable = true
    useSync.setState({ status: 'unavailable' })
    return
  }
  if (result.kind === 'error') {
    useSync.setState({ status: 'error' })
    return
  }

  const remote = (result.data as { snapshot?: Snapshot | null } | null)?.snapshot ?? null
  const local = localUpdatedAt()
  if (remote && remote.updatedAt > local) {
    adopt(remote)
    useSync.setState({ status: 'synced', syncedAt: Date.now() })
  } else {
    serverHas = remote?.updatedAt ?? 0
    if (local > serverHas) await push()
    else useSync.setState({ status: 'synced', syncedAt: Date.now() })
  }
}

function schedulePush() {
  window.clearTimeout(pushTimer)
  pushTimer = window.setTimeout(() => void push(), PUSH_DELAY_MS)
}

/** Mounted once, from App. */
export function useSettingsSync() {
  const hasTokens = useSpotify((s) => Boolean(s.tokens))

  // Settings customised before sync existed have no timestamp. Stamp them now so
  // they are sent the first time this browser signs in — but leave factory
  // settings unstamped, so a fresh browser never overwrites a real setup.
  useEffect(() => {
    if (localStorage.getItem(UPDATED_KEY) === null && !isUntouched()) {
      setLocalUpdatedAt(Date.now())
    }
  }, [])

  // Every local edit is timestamped and sent shortly after it settles.
  useEffect(
    () =>
      useSettings.subscribe(() => {
        if (applying) return
        setLocalUpdatedAt(Date.now())
        if (useSpotify.getState().tokens) schedulePush()
      }),
    [],
  )

  useEffect(() => {
    if (hasTokens) void pull()
    else {
      serverHas = 0
      useSync.setState({ status: 'off', syncedAt: null })
    }
  }, [hasTokens])

  // Closing the tab inside the debounce window would otherwise lose the last edit.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState !== 'hidden') return
      window.clearTimeout(pushTimer)
      void push(true)
    }
    document.addEventListener('visibilitychange', flush)
    return () => document.removeEventListener('visibilitychange', flush)
  }, [])
}

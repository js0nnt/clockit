/**
 * Authorization Code with PKCE. It is the only Spotify flow that works from a static
 * page with no server: there is no client secret, the app proves it started the login
 * by holding the verifier that matches the challenge it sent.
 */

const AUTH_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'

export const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  // Only for `product`, so a free account is told up front that controls need
  // Premium instead of finding out from a failed button press.
  'user-read-private',
].join(' ')

const VERIFIER_KEY = 'clockit:spotify:verifier'
const STATE_KEY = 'clockit:spotify:state'

export interface Tokens {
  accessToken: string
  refreshToken: string
  /** epoch ms; refreshed a little before this */
  expiresAt: number
}

/**
 * Spotify matches this string against the dashboard by exact string comparison,
 * down to the trailing slash — so this is the bare origin with nothing appended.
 * It also no longer accepts `localhost`: loopback has to be the literal IP.
 */
export function redirectUri(): string {
  return window.location.origin
}

export function isLoopbackHostname(): boolean {
  return window.location.hostname === 'localhost'
}

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  view.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomString(byteLength: number): string {
  return base64url(crypto.getRandomValues(new Uint8Array(byteLength)))
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(digest)
}

/** Sends the browser to Spotify's consent screen. Does not return. */
export async function beginLogin(clientId: string): Promise<void> {
  const verifier = randomString(48)
  const state = randomString(12)
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(STATE_KEY, state)

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: await challengeFor(verifier),
    scope: SCOPES,
    state,
  })
  window.location.assign(`${AUTH_URL}?${params}`)
}

export interface CallbackResult {
  tokens?: Tokens
  error?: string
}

/**
 * Handles the redirect back from Spotify. Returns null when this load is not a
 * callback, so it is safe to call on every startup.
 */
export async function completeLogin(clientId: string): Promise<CallbackResult | null> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const error = params.get('error')
  const state = params.get('state')
  if (!code && !error) return null

  const expectedState = sessionStorage.getItem(STATE_KEY)
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.removeItem(VERIFIER_KEY)
  clearCallbackParams()

  if (error) return { error: describeAuthError(error) }
  if (!state || state !== expectedState) return { error: 'Login state did not match — try again.' }
  if (!verifier) return { error: 'Login could not be completed in this tab — try again.' }

  try {
    return { tokens: await exchange(clientId, code!, verifier) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not reach Spotify.' }
  }
}

/** Strips `code`/`state` so a reload does not look like a second callback. */
function clearCallbackParams() {
  const url = new URL(window.location.href)
  ;['code', 'state', 'error'].forEach((k) => url.searchParams.delete(k))
  window.history.replaceState({}, '', url.pathname + url.search + url.hash)
}

async function exchange(clientId: string, code: string, verifier: string): Promise<Tokens> {
  return postToken({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  })
}

export async function refreshTokens(clientId: string, refreshToken: string): Promise<Tokens> {
  const tokens = await postToken({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
  // Spotify only sometimes rotates the refresh token; keep the old one otherwise.
  return { ...tokens, refreshToken: tokens.refreshToken || refreshToken }
}

async function postToken(body: Record<string, string>): Promise<Tokens> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
  const payload = (await response.json().catch(() => null)) as
    | { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string; error?: string }
    | null

  if (!response.ok || !payload?.access_token) {
    throw new Error(
      payload?.error_description ?? payload?.error ?? `Spotify returned ${response.status}`,
    )
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? '',
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  }
}

function describeAuthError(error: string): string {
  if (error === 'access_denied') return 'You declined the Spotify permissions.'
  if (error === 'invalid_client') return 'That Client ID is not valid.'
  return `Spotify refused the login (${error}).`
}

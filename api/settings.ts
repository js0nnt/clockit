/**
 * Settings that follow a Spotify account across devices.
 *
 * The caller proves who they are with the Spotify access token they already hold:
 * we ask Spotify's `/v1/me` who it belongs to and store under that user id. The
 * token is never stored, and nobody can read or write another account's settings
 * without that account's token.
 *
 * Storage is Upstash Redis, reached over its REST API so there is no client library
 * to bundle. Adding Upstash from the Vercel marketplace injects `KV_REST_API_URL`
 * and `KV_REST_API_TOKEN`; a database made directly on Upstash uses the
 * `UPSTASH_REDIS_REST_*` names instead, so both are accepted.
 */

const MAX_BYTES = 128 * 1024
const KEY_PREFIX = 'clockit:settings:'

interface Snapshot {
  updatedAt: number
  settings: Record<string, unknown>
}

export async function GET(request: Request): Promise<Response> {
  const store = storage()
  if (!store) return notConfigured()

  const user = await spotifyUser(request)
  if (user instanceof Response) return user

  const raw = await redis<string | null>(store, ['GET', KEY_PREFIX + user])
  if (raw instanceof Response) return raw
  if (!raw) return json({ snapshot: null })

  try {
    return json({ snapshot: JSON.parse(raw) as Snapshot })
  } catch {
    // A corrupt entry should read as "nothing saved", not wedge the account.
    return json({ snapshot: null })
  }
}

export async function PUT(request: Request): Promise<Response> {
  const store = storage()
  if (!store) return notConfigured()

  const user = await spotifyUser(request)
  if (user instanceof Response) return user

  const body = await request.text()
  if (body.length > MAX_BYTES) return json({ error: 'too-large' }, 413)

  let snapshot: Snapshot
  try {
    snapshot = JSON.parse(body) as Snapshot
  } catch {
    return json({ error: 'invalid-json' }, 400)
  }
  if (
    !snapshot ||
    typeof snapshot.updatedAt !== 'number' ||
    typeof snapshot.settings !== 'object' ||
    snapshot.settings === null ||
    Array.isArray(snapshot.settings)
  ) {
    return json({ error: 'invalid-snapshot' }, 400)
  }

  // Last write wins, but never let a stale device roll a newer save backwards —
  // two tabs open on different machines would otherwise fight each other.
  const existing = await redis<string | null>(store, ['GET', KEY_PREFIX + user])
  if (existing instanceof Response) return existing
  if (existing) {
    try {
      const current = JSON.parse(existing) as Snapshot
      if (current.updatedAt > snapshot.updatedAt) return json({ snapshot: current }, 409)
    } catch {
      // Overwrite a corrupt entry.
    }
  }

  const stored = JSON.stringify({ updatedAt: snapshot.updatedAt, settings: snapshot.settings })
  const result = await redis<string>(store, ['SET', KEY_PREFIX + user, stored])
  if (result instanceof Response) return result
  return json({ ok: true, updatedAt: snapshot.updatedAt })
}

// ------------------------------------------------------------------- helpers

interface Store {
  url: string
  token: string
}

function storage(): Store | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url, token } : null
}

/** The Spotify user id behind the bearer token, or an error response. */
async function spotifyUser(request: Request): Promise<string | Response> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return json({ error: 'no-token' }, 401)

  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (response.status === 401) return json({ error: 'spotify-token-rejected' }, 401)
  if (!response.ok) return json({ error: 'spotify-unavailable' }, 502)

  const me = (await response.json().catch(() => null)) as { id?: string } | null
  return me?.id ? me.id : json({ error: 'spotify-no-user' }, 502)
}

async function redis<T>(store: Store, command: (string | number)[]): Promise<T | Response> {
  const response = await fetch(store.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${store.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  })
  if (!response.ok) return json({ error: 'storage-unavailable' }, 502)
  const payload = (await response.json().catch(() => null)) as { result?: T; error?: string } | null
  if (!payload || payload.error) return json({ error: 'storage-error' }, 502)
  return payload.result as T
}

function notConfigured(): Response {
  return json({ error: 'storage-not-configured' }, 503)
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

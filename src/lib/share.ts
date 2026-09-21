import type { PortableState } from '@/store/settings'

const PREFIX = 'CLK1'

/** Share codes are just the portable settings, JSON -> UTF-8 -> base64url. */
export function encodeShare(state: PortableState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(state))
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return PREFIX + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeShare(code: string): PortableState | null {
  if (!code.startsWith(PREFIX)) return null
  try {
    const b64 = code.slice(PREFIX.length).replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(b64)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as PortableState
    return parsed && typeof parsed === 'object' && parsed.layout && parsed.animation ? parsed : null
  } catch {
    return null
  }
}

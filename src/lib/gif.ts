import { useEffect, useState } from 'react'
import { getBlob } from './blobStore'
import { STORED_GIF } from './workspace'
import { useSettings } from '@/store/settings'

/**
 * Resolves the GIF source to something an `<img>` can use. A pasted URL is used
 * directly; an uploaded file lives in IndexedDB and becomes an object URL, revoked
 * when it is replaced so the blob is not held twice.
 */
export function useGifUrl(): string | null {
  const source = useSettings((s) => s.workspace.gif.source)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (source !== STORED_GIF) return
    let url: string | null = null
    let cancelled = false

    void getBlob('gif').then((blob) => {
      if (cancelled || !blob) return
      url = URL.createObjectURL(blob)
      setObjectUrl(url)
    })

    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [source])

  if (!source) return null
  // A stale object URL from a previous upload is ignored while a link is in use.
  return source === STORED_GIF ? objectUrl : source
}

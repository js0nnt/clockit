import { useEffect, useRef } from 'react'
import { useAudio } from './store'

/**
 * Re-opens the mic on load when the browser already holds the permission. Screen
 * capture always needs a fresh gesture, so it is never resumed automatically.
 */
export function useAudioResume() {
  const resume = useAudio((s) => s.resume)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void resume()
  }, [resume])
}

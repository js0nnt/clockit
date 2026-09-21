import { useEffect } from 'react'
import { Stage } from './components/Stage'
import { TimerControls } from './components/TimerControls'
import { CircularMenu } from './components/menu/CircularMenu'
import { Workspace } from './components/workspace/Workspace'
import { useAudioResume } from './features/audio/resume'
import { useSpotifySync } from './features/spotify/sync'
import { useFullscreen } from './lib/hooks'
import { useSettings } from './store/settings'
import { useTimer } from './store/timer'

export default function App() {
  useKeyboardShortcuts()
  useSpotifySync()
  useAudioResume()

  return (
    <>
      <Stage>
        <Workspace />
      </Stage>
      <TimerControls />
      <CircularMenu />
    </>
  )
}

function useKeyboardShortcuts() {
  const { toggle: toggleFullscreen } = useFullscreen()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return

      const s = useSettings.getState()
      switch (e.key.toLowerCase()) {
        case 'f':
          toggleFullscreen()
          break
        case 'h':
          s.toggle('hideClock')
          break
        case 's':
          s.toggle('showSeconds')
          break
        case 't':
          s.toggle('hour24')
          break
        case ' ':
          if (s.mode !== 'clock') {
            e.preventDefault()
            useTimer.getState().toggle()
          }
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleFullscreen])
}

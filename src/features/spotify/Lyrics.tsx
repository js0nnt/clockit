import { activeLineIndex } from './lrclib'
import { useSpotify } from './store'
import { useLyrics } from './sync'
import { currentProgress } from './types'
import { useTick } from '@/lib/hooks'

/** How many lines either side of the current one stay on screen. */
const CONTEXT = 1

/**
 * Three lines of synced lyrics. In free mode the height is fixed so the clock does
 * not jump as lyrics come and go; in a bento box it fills the box instead.
 */
export function LyricsCard({ fill }: { fill?: boolean }) {
  const playback = useSpotify((s) => s.playback)
  const { result, loading } = useLyrics()

  useTick(120)

  if (!playback?.track) return <Shell fill={fill}>Nothing playing.</Shell>
  if (loading) return <Shell fill={fill}>Looking for lyrics…</Shell>
  if (!result) return <Shell fill={fill}>No lyrics found for this track.</Shell>
  if (!result.synced)
    return <Shell fill={fill}>Only unsynced lyrics exist for this track.</Shell>

  const position = currentProgress(playback)
  const index = activeLineIndex(result.lines, position)

  const window = []
  for (let i = index - CONTEXT; i <= index + CONTEXT; i++) {
    window.push({ key: i, line: i >= 0 && i < result.lines.length ? result.lines[i] : null })
  }

  return (
    <Shell fill={fill}>
      {window.map(({ key, line }) => (
        <p
          key={key}
          className={`truncate transition-all duration-300 ${
            key === index
              ? 'text-[15px] font-semibold text-white opacity-100'
              : 'text-[13px] text-white opacity-35'
          }`}
        >
          {line?.text || ' '}
        </p>
      ))}
    </Shell>
  )
}

function Shell({ children, fill }: { children: React.ReactNode; fill?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 overflow-hidden px-3 text-center text-[13px] text-white/45 ${
        fill ? 'h-full w-full' : 'h-[74px] w-[min(680px,90vw)]'
      }`}
    >
      {children}
    </div>
  )
}

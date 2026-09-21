import { useRef, useState } from 'react'
import {
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-react'
import { useSpotify } from './store'
import { currentProgress, formatTime } from './types'
import { useTick } from '@/lib/hooks'

/**
 * The player itself. Where it sits, whether it is shown and whether it is faded are
 * all decided by the Workspace — this renders the card and nothing else.
 */
export function PlayerCard({ fill }: { fill?: boolean }) {
  const playback = useSpotify((s) => s.playback)
  const hasPolled = useSpotify((s) => s.hasPolled)

  // Keeps the progress bar moving between polls.
  useTick(250)

  return (
    <div
      className={`glass-panel flex items-center gap-3 rounded-2xl p-3 ${
        fill ? 'h-full w-full' : 'w-[min(560px,calc(100vw-3rem))]'
      }`}
    >
      {playback?.track ? <TrackDetails /> : <Idle loading={!hasPolled} />}
    </div>
  )
}

function Idle({ loading }: { loading?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-1 py-1 text-[11px] text-white/60">
      <Music className={`h-4 w-4 ${loading ? 'animate-pulse' : ''}`} />
      {loading
        ? 'Checking what is playing…'
        : 'Nothing playing — start a track on any Spotify device.'}
    </div>
  )
}

function TrackDetails() {
  const playback = useSpotify((s) => s.playback)!
  const track = playback.track!
  const spotify = useSpotify()

  return (
    <>
      <Artwork url={track.artwork} />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[12px] font-semibold text-white">{track.name}</span>
          <span className="truncate text-[11px] text-white/60">{track.artists}</span>
        </div>

        <Scrubber />

        <div className="flex items-center gap-1">
          <IconButton
            label="Shuffle"
            active={playback.shuffle}
            onClick={() => void spotify.toggleShuffle()}
          >
            <Shuffle />
          </IconButton>
          <IconButton label="Previous" onClick={() => void spotify.previous()}>
            <SkipBack />
          </IconButton>
          <IconButton
            label={playback.isPlaying ? 'Pause' : 'Play'}
            primary
            onClick={() => void spotify.togglePlay()}
          >
            {playback.isPlaying ? <Pause /> : <Play />}
          </IconButton>
          <IconButton label="Next" onClick={() => void spotify.next()}>
            <SkipForward />
          </IconButton>
          <IconButton
            label={`Repeat: ${playback.repeat}`}
            active={playback.repeat !== 'off'}
            onClick={() => void spotify.cycleRepeat()}
          >
            {playback.repeat === 'track' ? <Repeat1 /> : <Repeat />}
          </IconButton>

          {playback.volume !== null && <VolumeSlider />}
        </div>
      </div>
    </>
  )
}

function Artwork({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/10">
        <Music className="h-5 w-5 text-white/50" />
      </div>
    )
  }
  return <img src={url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
}

function Scrubber() {
  const playback = useSpotify((s) => s.playback)!
  const seek = useSpotify((s) => s.seek)
  const duration = playback.track?.durationMs ?? 0
  const bar = useRef<HTMLDivElement>(null)
  const [hoverAt, setHoverAt] = useState<number | null>(null)

  const position = currentProgress(playback)
  const pct = duration ? Math.min(100, (position / duration) * 100) : 0

  const positionFrom = (clientX: number) => {
    const box = bar.current?.getBoundingClientRect()
    if (!box || !duration) return null
    return ((clientX - box.left) / box.width) * duration
  }

  return (
    <div className="flex items-center gap-2 text-[10px] tabular-nums text-white/50">
      <span className="w-8 shrink-0 text-right">{formatTime(hoverAt ?? position)}</span>
      <div
        ref={bar}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={Math.round(position)}
        tabIndex={0}
        className="group relative h-3 flex-1 cursor-pointer"
        onPointerMove={(e) => setHoverAt(positionFrom(e.clientX))}
        onPointerLeave={() => setHoverAt(null)}
        onClick={(e) => {
          const at = positionFrom(e.clientX)
          if (at !== null) void seek(at)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') void seek(position + 5000)
          if (e.key === 'ArrowLeft') void seek(position - 5000)
        }}
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white/80" style={{ width: `${pct}%` }} />
        </div>
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 transition-opacity group-hover:opacity-100"
          style={{ left: `${pct}%` }}
        />
      </div>
      <span className="w-8 shrink-0">{formatTime(duration)}</span>
    </div>
  )
}

function VolumeSlider() {
  const volume = useSpotify((s) => s.playback?.volume ?? 0)
  const setVolume = useSpotify((s) => s.setVolume)

  return (
    <label className="ml-auto flex items-center gap-1.5 pr-1" title={`Volume ${volume}%`}>
      <Volume2 className="h-3.5 w-3.5 text-white/60" />
      <span className="relative block h-3 w-20">
        <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/20">
          <span className="block h-full rounded-full bg-white/70" style={{ width: `${volume}%` }} />
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          aria-label="Volume"
          onChange={(e) => void setVolume(Number(e.target.value))}
          className="absolute inset-0 h-full w-full opacity-0"
        />
      </span>
    </label>
  )
}

function IconButton({
  label,
  active,
  primary,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  primary?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`flex items-center justify-center rounded-full transition [&_svg]:h-4 [&_svg]:w-4 ${
        primary ? 'h-8 w-8 bg-white text-black hover:bg-white/85' : 'h-7 w-7 hover:bg-white/15'
      } ${!primary && active ? 'text-white' : !primary ? 'text-white/55' : ''}`}
    >
      {children}
    </button>
  )
}

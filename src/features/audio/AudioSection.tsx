import { readAudio, type AudioSource } from './engine'
import { useAudio } from './store'
import { SectionTitle, Segmented, Slider } from '@/components/ui/controls'
import { useTick } from '@/lib/hooks'
import { useSettings } from '@/store/settings'

const SOURCES: { value: AudioSource; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'system', label: 'System' },
  { value: 'mic', label: 'Mic' },
]

export function AudioSection() {
  const audio = useAudio()
  const reactivity = useSettings((s) => s.backdrop.reactivity)
  const setBackdrop = useSettings((s) => s.setBackdrop)

  return (
    <>
      <SectionTitle>React to music</SectionTitle>
      <Segmented<AudioSource>
        value={audio.source}
        onChange={(source) => void audio.select(source)}
        options={SOURCES}
      />

      <p className="px-1 text-[10px] leading-relaxed text-white/45">
        {audio.source === 'system'
          ? 'Sharing a tab or window with its audio. Pick the one Spotify plays through and tick "Share audio".'
          : audio.source === 'mic'
            ? 'Listening through the microphone — works with speakers, and picks up the room with them.'
            : 'Spotify has no live audio to give, so Clockit listens instead: share your system audio, or use the mic.'}
      </p>

      {audio.status === 'starting' && (
        <p className="px-1 text-[10px] text-white/55">Waiting for permission…</p>
      )}
      {audio.error && (
        <p className="rounded-lg bg-red-500/20 px-3 py-2 text-[10px] leading-relaxed text-white/85">
          {audio.error}
        </p>
      )}

      {audio.status === 'listening' && <LevelMeter />}

      <Slider
        label="Reactivity"
        min={0}
        max={1}
        step={0.01}
        value={reactivity}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => setBackdrop('reactivity', v)}
      />
    </>
  )
}

/** A live read-out, so it is obvious whether the capture actually hears anything. */
function LevelMeter() {
  useTick(60)
  const { level, bass, mid, treble, beat } = readAudio()

  const bars: [string, number][] = [
    ['Bass', bass],
    ['Mid', mid],
    ['Treble', treble],
  ]

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-white/5 p-2">
      {bars.map(([label, value]) => (
        <div key={label} className="flex items-center gap-2">
          <span className="w-10 shrink-0 text-[9px] text-white/45">{label}</span>
          <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-white/70"
              style={{ width: `${Math.round(value * 100)}%` }}
            />
          </span>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-0.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-white transition-opacity duration-75"
          style={{ opacity: 0.2 + beat * 0.8 }}
        />
        <span className="text-[9px] text-white/45">
          {level < 0.02 ? 'No signal — is the right source shared?' : 'Beat'}
        </span>
      </div>
    </div>
  )
}

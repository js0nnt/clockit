import { Panel } from './Panel'
import { SectionTitle, Slider, Toggle } from '../ui/controls'
import { AudioSection } from '@/features/audio/AudioSection'
import { BACKDROPS, BACKDROP_BY_ID } from '@/lib/backdrops'
import { useSettings } from '@/store/settings'

export function BackdropPanel() {
  const backdrop = useSettings((s) => s.backdrop)
  const setBackdrop = useSettings((s) => s.setBackdrop)
  const active = BACKDROP_BY_ID.get(backdrop.id)

  return (
    <Panel title="Backdrop">
      <div className="grid grid-cols-2 gap-2">
        {BACKDROPS.map((b) => (
          <button
            key={b.id}
            type="button"
            title={b.hint}
            onClick={() => setBackdrop('id', b.id)}
            className={`h-9 rounded-lg px-3 text-[11px] font-medium transition ${
              backdrop.id === b.id
                ? 'bg-white/85 text-black'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {active && active.id !== 'none' && (
        <>
          <p className="px-1 text-[10px] leading-relaxed text-white/45">{active.hint}</p>

          <SectionTitle>Motion</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <Slider
              label="Speed"
              min={0.25}
              max={2.5}
              step={0.05}
              value={backdrop.speed}
              format={(v) => `${v.toFixed(2)}x`}
              onChange={(v) => setBackdrop('speed', v)}
            />
            <Slider
              label="Intensity"
              min={0}
              max={1}
              step={0.01}
              value={backdrop.intensity}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => setBackdrop('intensity', v)}
            />
          </div>

          <Toggle
            label={backdrop.accent ? 'Colour: flap & digits' : 'Colour: background'}
            active={backdrop.accent}
            onClick={() => setBackdrop('accent', !backdrop.accent)}
          />

          <AudioSection />
        </>
      )}
    </Panel>
  )
}

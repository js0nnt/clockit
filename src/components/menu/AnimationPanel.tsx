import { Panel } from './Panel'
import { Segmented, SectionTitle, Slider } from '../ui/controls'
import { playFlip } from '@/lib/sound'
import { useSettings } from '@/store/settings'
import type { FlipSound } from '@/lib/types'

const SOUNDS: { value: FlipSound; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'classic', label: 'Classic' },
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'electronic', label: 'Electronic' },
  { value: 'soft', label: 'Soft' },
]

export function AnimationPanel() {
  const s = useSettings()

  return (
    <Panel title="Animation & Sounds">
      <div className="grid grid-cols-2 gap-2">
        <Slider
          label="Perspective"
          min={200}
          max={3000}
          step={20}
          value={s.animation.perspective}
          onChange={(v) => s.setAnimation('perspective', v)}
        />
        <Slider
          label="Depth"
          min={0}
          max={1}
          step={0.01}
          value={s.animation.depth}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => s.setAnimation('depth', v)}
        />
        <Slider
          label="Bounce"
          min={0}
          max={1}
          step={0.01}
          value={s.animation.bounce}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => s.setAnimation('bounce', v)}
        />
        <Slider
          label="Delay"
          min={120}
          max={1400}
          step={10}
          value={s.animation.delay}
          format={(v) => `${v}ms`}
          onChange={(v) => s.setAnimation('delay', v)}
        />
      </div>

      <SectionTitle>Flip Sound</SectionTitle>
      <Segmented<FlipSound>
        value={s.flipSound}
        onChange={(v) => {
          s.setFlipSound(v)
          playFlip(v, s.volume)
        }}
        options={SOUNDS.slice(0, 3)}
      />
      <Segmented<FlipSound>
        value={s.flipSound}
        onChange={(v) => {
          s.setFlipSound(v)
          playFlip(v, s.volume)
        }}
        options={SOUNDS.slice(3)}
      />
      <Slider
        label="Volume"
        min={0}
        max={1}
        step={0.01}
        value={s.volume}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => s.setVolume(v)}
      />

      <p className="px-1 pt-1 text-[10px] leading-relaxed text-white/45">
        Flip sounds are synthesised in the browser, so they start only after your first
        interaction with the page.
      </p>
    </Panel>
  )
}

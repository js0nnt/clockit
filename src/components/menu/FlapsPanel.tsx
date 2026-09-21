import { Panel } from './Panel'
import { Slider, Toggle } from '../ui/controls'
import { useSettings } from '@/store/settings'

const pct = (v: number) => `${Math.round(v * 100)}%`

export function FlapsPanel() {
  const layout = useSettings((s) => s.layout)
  const setLayout = useSettings((s) => s.setLayout)

  return (
    <Panel title="Flaps">
      <Slider
        label="Clock Scale"
        min={0.3}
        max={1.6}
        step={0.01}
        value={layout.clockScale}
        format={pct}
        onChange={(v) => setLayout('clockScale', v)}
      />

      <div className="grid grid-cols-2 gap-2">
        <Toggle
          label="Single flap"
          active={layout.singleFlap}
          onClick={() => setLayout('singleFlap', !layout.singleFlap)}
        />
        <Slider
          label="Tile Width"
          min={0.3}
          max={1}
          step={0.01}
          value={layout.tileWidth}
          format={pct}
          onChange={(v) => setLayout('tileWidth', v)}
        />
      </div>

      <Slider
        label="Text Size"
        min={0.35}
        max={1.15}
        step={0.01}
        value={layout.textSize}
        format={pct}
        onChange={(v) => setLayout('textSize', v)}
      />

      <div className="grid grid-cols-2 gap-2">
        <Slider
          label="Text Offset"
          min={-0.2}
          max={0.2}
          step={0.005}
          value={layout.textOffset}
          format={(v) => `${Math.round(v * 100)}`}
          onChange={(v) => setLayout('textOffset', v)}
        />
        <Slider
          label="Font Thickness"
          min={100}
          max={900}
          step={100}
          value={layout.fontThickness}
          onChange={(v) => setLayout('fontThickness', v)}
        />
        <Slider
          label="Edge Rounding"
          min={0}
          max={0.5}
          step={0.005}
          value={layout.edgeRounding}
          format={pct}
          onChange={(v) => setLayout('edgeRounding', v)}
        />
        <Slider
          label="Centre Rounding"
          min={0}
          max={0.25}
          step={0.005}
          value={layout.centreRounding}
          format={pct}
          onChange={(v) => setLayout('centreRounding', v)}
        />
      </div>

      <Slider
        label="H:M:S Spacing"
        min={0}
        max={1.5}
        step={0.01}
        value={layout.groupSpacing}
        format={pct}
        onChange={(v) => setLayout('groupSpacing', v)}
      />

      <div className="grid grid-cols-2 gap-2">
        <Slider
          label="Flap Gap"
          min={0}
          max={0.06}
          step={0.001}
          value={layout.flapGap}
          format={(v) => `${(v * 100).toFixed(1)}`}
          onChange={(v) => setLayout('flapGap', v)}
        />
        <Slider
          label="Digit Gap"
          min={0}
          max={0.6}
          step={0.005}
          value={layout.digitGap}
          format={pct}
          onChange={(v) => setLayout('digitGap', v)}
        />
      </div>
    </Panel>
  )
}

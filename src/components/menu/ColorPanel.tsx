import { useState } from 'react'
import { Panel } from './Panel'
import { ColorField, Segmented, SectionTitle, Slider, Toggle } from '../ui/controls'
import { THEMES } from '@/lib/themes'
import { toCss } from '@/lib/paint'
import { decodeShare, encodeShare } from '@/lib/share'
import { portable, useColors, useSettings } from '@/store/settings'
import type { ColorSpec, ColorTarget, GradientKind, Theme } from '@/lib/types'

type Tab = 'styles' | 'presets' | 'custom'

export function ColorPanel() {
  const [tab, setTab] = useState<Tab>('styles')

  return (
    <Panel title="Color" wide>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'styles', label: 'Styles' },
          { value: 'presets', label: 'Presets' },
          { value: 'custom', label: 'Custom' },
        ]}
      />
      {tab === 'styles' && <StylesTab />}
      {tab === 'presets' && <PresetsTab />}
      {tab === 'custom' && <CustomTab />}
    </Panel>
  )
}

const GROUPS: { key: Theme['group']; title: string }[] = [
  { key: 'signature', title: 'Clockit Styles' },
  { key: 'glass', title: 'Glass Styles' },
]

function StylesTab() {
  const themeId = useSettings((s) => s.themeId)
  const custom = useSettings((s) => s.custom)
  const applyTheme = useSettings((s) => s.applyTheme)

  return (
    <>
      {GROUPS.map((g) => (
        <div key={g.key}>
          <SectionTitle>{g.title}</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.filter((t) => t.group === g.key).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTheme(t.id)}
                className={`overflow-hidden rounded-lg text-left transition ${
                  themeId === t.id && !custom ? 'ring-2 ring-white' : 'ring-1 ring-white/15'
                }`}
              >
                <Preview
                  flap={t.flap}
                  digits={t.digits}
                  background={t.background}
                  height="h-12"
                  tile="h-8 w-5 text-[10px]"
                />
                <span className="block truncate px-1.5 py-1 text-[10px] text-white/80">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

/** Two miniature tiles on the theme background — used for swatches and the custom preview. */
function Preview({
  flap,
  digits,
  background,
  height,
  tile,
}: {
  flap: ColorSpec
  digits: ColorSpec
  background: ColorSpec
  height: string
  tile: string
}) {
  return (
    <span
      className={`flex ${height} items-center justify-center gap-[3px]`}
      style={{ backgroundImage: toCss(background) }}
    >
      {['0', '9'].map((d) => (
        <span
          key={d}
          className={`flex ${tile} items-center justify-center rounded-[3px] font-semibold`}
          style={{ backgroundImage: toCss(flap) }}
        >
          <span
            style={{
              backgroundImage: toCss(digits),
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {d}
          </span>
        </span>
      ))}
    </span>
  )
}

function PresetsTab() {
  const s = useSettings()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  const share = async () => {
    const text = encodeShare(portable(s))
    try {
      await navigator.clipboard.writeText(text)
      setStatus('Share code copied to your clipboard')
    } catch {
      setCode(text)
      setStatus('Clipboard blocked, copy the code above')
    }
  }

  const load = () => {
    const state = decodeShare(code.trim())
    if (!state) {
      setStatus('That code is not valid')
      return
    }
    s.importState(state)
    setStatus('Clock loaded')
  }

  return (
    <>
      <SectionTitle>Save current clock</SectionTitle>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Preset name"
          className="h-9 min-w-0 flex-1 rounded-lg bg-white/10 px-3 text-[11px] text-white placeholder:text-white/40 focus:outline-none"
        />
        <Toggle
          label="Save"
          active={false}
          disabled={!name.trim()}
          onClick={() => {
            s.savePreset(name.trim())
            setName('')
          }}
        />
      </div>

      {s.presets.length > 0 && (
        <>
          <SectionTitle>My presets</SectionTitle>
          <div className="flex flex-col gap-1">
            {s.presets.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => s.applyPreset(p.id)}
                  className="h-9 min-w-0 flex-1 truncate rounded-lg bg-white/10 px-3 text-left text-[11px] text-white/85 hover:bg-white/20"
                >
                  {p.name}
                </button>
                <button
                  type="button"
                  onClick={() => s.deletePreset(p.id)}
                  className="h-9 rounded-lg bg-white/10 px-3 text-[11px] text-white/60 hover:bg-red-500/40 hover:text-white"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionTitle>Share my clock</SectionTitle>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Paste a code to load someone else's clock"
        className="h-9 w-full rounded-lg bg-white/10 px-3 font-mono text-[10px] text-white placeholder:font-sans placeholder:text-white/40 focus:outline-none"
      />
      <div className="flex gap-2">
        <Toggle label="Copy my code" active={false} onClick={share} />
        <Toggle label="Load code" active={false} disabled={!code.trim()} onClick={load} />
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="px-1 text-[10px] text-white/45">{status}</span>
        <button
          type="button"
          onClick={s.resetAll}
          className="shrink-0 rounded-lg px-2 py-1 text-[10px] text-white/50 hover:text-white"
        >
          Reset everything
        </button>
      </div>
    </>
  )
}

const TARGETS: { value: ColorTarget; label: string }[] = [
  { value: 'flap', label: 'Flap' },
  { value: 'digits', label: 'Digits' },
  { value: 'background', label: 'Background' },
]

const TARGET_TITLE: Record<ColorTarget, string> = {
  flap: 'Flap Style',
  digits: 'Digit Style',
  background: 'Background Style',
}

function CustomTab() {
  const [target, setTarget] = useState<ColorTarget>('flap')
  const colors = useColors()
  const setColor = useSettings((s) => s.setColor)
  const themeId = useSettings((s) => s.themeId)
  const custom = useSettings((s) => s.custom)
  const resetCustom = useSettings((s) => s.resetCustom)
  const spec = colors[target]

  return (
    <>
      <Segmented<ColorTarget> value={target} onChange={setTarget} options={TARGETS} />

      <div className="grid grid-cols-2 gap-2">
        <ColorField label="A" value={spec.a} onChange={(a) => setColor(target, { a })} />
        <ColorField label="B" value={spec.b} onChange={(b) => setColor(target, { b })} />
      </div>

      <SectionTitle>{TARGET_TITLE[target]}</SectionTitle>
      <Segmented<GradientKind>
        value={spec.kind}
        onChange={(kind) => setColor(target, { kind })}
        options={[
          { value: 'solid', label: 'Solid' },
          { value: 'linear', label: 'Linear' },
          { value: 'radial', label: 'Radial' },
        ]}
      />

      {spec.kind === 'linear' && (
        <Slider
          label="Rotation"
          min={0}
          max={360}
          value={spec.rotation}
          format={(v) => `${v}deg`}
          onChange={(rotation) => setColor(target, { rotation })}
        />
      )}

      {spec.kind === 'radial' && (
        <div className="grid grid-cols-2 gap-2">
          <Slider
            label="Position X"
            min={0}
            max={100}
            value={spec.x}
            onChange={(x) => setColor(target, { x })}
          />
          <Slider
            label="Position Y"
            min={0}
            max={100}
            value={spec.y}
            onChange={(y) => setColor(target, { y })}
          />
        </div>
      )}

      <Preview
        flap={colors.flap}
        digits={colors.digits}
        background={colors.background}
        height="h-16 rounded-lg mt-1"
        tile="h-11 w-7 text-sm"
      />

      {custom && (
        <button
          type="button"
          onClick={resetCustom}
          className="self-start px-1 py-1 text-[10px] text-white/50 hover:text-white"
        >
          Revert to {THEMES.find((t) => t.id === themeId)?.name ?? 'style'}
        </button>
      )}
    </>
  )
}

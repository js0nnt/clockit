import { Panel } from './Panel'
import { FONTS } from '@/lib/fonts'
import { useSettings } from '@/store/settings'

export function FontPanel() {
  const font = useSettings((s) => s.font)
  const setFont = useSettings((s) => s.setFont)

  return (
    <Panel title="Font">
      <div className="grid grid-cols-2 gap-2">
        {FONTS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFont(f.id)}
            style={{ fontFamily: f.stack, fontWeight: f.weight ?? 500 }}
            className={`h-10 rounded-lg text-xs transition ${
              font === f.id ? 'bg-white/85 text-black' : 'bg-white/10 text-white/85 hover:bg-white/20'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </Panel>
  )
}

import type { ReactNode } from 'react'

/** A pill that fills left-to-right with the value, with the label riding inside it. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <label className="relative block h-9 w-full cursor-ew-resize overflow-hidden rounded-lg bg-white/10">
      <span
        className="absolute inset-y-0 left-0 bg-white/30 transition-[width] duration-75"
        style={{ width: `${pct}%` }}
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-between gap-2 px-3 text-[11px] font-medium tracking-wide text-white/90">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 tabular-nums text-white/60">
          {format ? format(value) : Math.round(value)}
        </span>
      </span>
      <input
        type="range"
        className="absolute inset-0 h-full w-full opacity-0"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-white/10 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
            value === o.value ? 'bg-white/85 text-black' : 'text-white/75 hover:bg-white/10'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({
  label,
  active,
  onClick,
  disabled,
}: {
  label: ReactNode
  active: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-9 rounded-lg px-3 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-35 ${
        active ? 'bg-white/85 text-black' : 'bg-white/10 text-white/80 hover:bg-white/20'
      }`}
    >
      {label}
    </button>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="px-1 pb-1 text-[11px] font-semibold tracking-wide text-white/60">{children}</h3>
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label
      className="relative flex h-9 cursor-pointer items-center justify-between overflow-hidden rounded-lg px-3 text-[11px] font-medium"
      style={{ background: value }}
    >
      <span className="mix-blend-difference text-white">{label}</span>
      <span className="mix-blend-difference font-mono text-white/80">{value.toUpperCase()}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  )
}

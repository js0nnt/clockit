import type { ClockMode } from './types'

export interface DigitGroups {
  /** one entry per group, each a string of digits */
  groups: string[]
  /** true while the underlying value is counting down / up rather than wall time */
  meridiem?: 'AM' | 'PM'
}

const pad = (n: number, len = 2) => Math.floor(Math.abs(n)).toString().padStart(len, '0')

export function wallClockGroups(
  now: Date,
  opts: { hour24: boolean; showSeconds: boolean },
): DigitGroups {
  const h24 = now.getHours()
  let h = h24
  if (!opts.hour24) {
    h = h24 % 12
    if (h === 0) h = 12
  }
  const groups = [pad(h), pad(now.getMinutes())]
  if (opts.showSeconds) groups.push(pad(now.getSeconds()))
  return { groups, meridiem: h24 < 12 ? 'AM' : 'PM' }
}

/** Elapsed / remaining milliseconds rendered as HH:MM:SS, dropping the hour group when it is zero. */
export function durationGroups(ms: number, showSeconds: boolean): DigitGroups {
  const total = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) return { groups: [pad(hours), pad(minutes), pad(seconds)] }
  return showSeconds ? { groups: [pad(minutes), pad(seconds)] } : { groups: [pad(minutes)] }
}

export function groupsFor(
  mode: ClockMode,
  now: Date,
  elapsedMs: number,
  opts: { hour24: boolean; showSeconds: boolean },
): DigitGroups {
  if (mode === 'clock') return wallClockGroups(now, opts)
  return durationGroups(elapsedMs, true)
}

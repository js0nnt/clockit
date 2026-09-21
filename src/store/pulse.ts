/**
 * A one-way channel from the clock to whatever is drawing behind it. The clock calls
 * `emitPulse` when its digits change; backdrops subscribe. Deliberately not a React
 * store — subscribers are animation loops, and a re-render per second would be waste.
 */
export interface Pulse {
  /** how many digit positions changed on this tick, 1 for a plain second */
  magnitude: number
  at: number
}

type Listener = (pulse: Pulse) => void

const listeners = new Set<Listener>()

export function emitPulse(magnitude: number) {
  const pulse: Pulse = { magnitude, at: performance.now() }
  listeners.forEach((l) => l(pulse))
}

export function onPulse(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** How many characters differ between two digit strings of the same length. */
export function changedDigits(a: string, b: string): number {
  if (a.length !== b.length) return Math.max(a.length, b.length)
  let n = 0
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++
  return n
}

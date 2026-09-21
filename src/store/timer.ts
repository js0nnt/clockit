import { create } from 'zustand'

export type PomodoroPhase = 'focus' | 'break' | 'longBreak'

interface TimerState {
  running: boolean
  /** ms accumulated before the current run */
  accumulated: number
  /** performance.now() at the moment the current run started */
  startedAt: number | null
  phase: PomodoroPhase
  completedRounds: number

  start: () => void
  pause: () => void
  toggle: () => void
  reset: () => void
  setPhase: (phase: PomodoroPhase) => void
  completeRound: () => void
}

export const useTimer = create<TimerState>((set, get) => ({
  running: false,
  accumulated: 0,
  startedAt: null,
  phase: 'focus',
  completedRounds: 0,

  start: () => {
    if (get().running) return
    set({ running: true, startedAt: performance.now() })
  },
  pause: () => {
    const { running, startedAt, accumulated } = get()
    if (!running || startedAt === null) return
    set({ running: false, startedAt: null, accumulated: accumulated + (performance.now() - startedAt) })
  },
  toggle: () => (get().running ? get().pause() : get().start()),
  reset: () => set({ running: false, accumulated: 0, startedAt: null }),
  setPhase: (phase) => set({ phase, running: false, accumulated: 0, startedAt: null }),
  completeRound: () => set((s) => ({ completedRounds: s.completedRounds + 1 })),
}))

export function elapsedOf(s: Pick<TimerState, 'running' | 'accumulated' | 'startedAt'>): number {
  return s.accumulated + (s.running && s.startedAt !== null ? performance.now() - s.startedAt : 0)
}

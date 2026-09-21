import { Pause, Play, RotateCcw } from 'lucide-react'
import { Slider } from './ui/controls'
import { usePointerActive } from '@/lib/hooks'
import { useSettings } from '@/store/settings'
import { useTimer, type PomodoroPhase } from '@/store/timer'

const PHASES: { id: PomodoroPhase; label: string }[] = [
  { id: 'focus', label: 'Focus' },
  { id: 'break', label: 'Break' },
  { id: 'longBreak', label: 'Long break' },
]

export function TimerControls() {
  const mode = useSettings((s) => s.mode)
  const pomodoro = useSettings((s) => s.pomodoro)
  const setPomodoro = useSettings((s) => s.setPomodoro)
  const timer = useTimer()
  const visible = usePointerActive()

  if (mode === 'clock') return null

  return (
    // Below `lg` the centred position would collide with the icon menu in the
    // bottom-left corner, so the controls tuck into the opposite corner instead.
    <div
      className={`fixed bottom-7 right-6 z-20 flex flex-col items-center gap-2 transition-opacity duration-300 lg:right-auto lg:left-1/2 lg:-translate-x-1/2 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {mode === 'pomodoro' && (
        <>
          <div className="glass-panel flex w-[300px] flex-col gap-2 rounded-2xl p-3">
            <div className="flex gap-1 rounded-xl bg-white/10 p-1">
              {PHASES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => timer.setPhase(p.id)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
                    timer.phase === p.id ? 'bg-white/85 text-black' : 'text-white/75 hover:bg-white/10'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Slider
              label="Focus"
              min={1}
              max={90}
              value={pomodoro.focus}
              format={(v) => `${v}m`}
              onChange={(v) => setPomodoro('focus', v)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Slider
                label="Break"
                min={1}
                max={30}
                value={pomodoro.break}
                format={(v) => `${v}m`}
                onChange={(v) => setPomodoro('break', v)}
              />
              <Slider
                label="Long"
                min={5}
                max={60}
                value={pomodoro.longBreak}
                format={(v) => `${v}m`}
                onChange={(v) => setPomodoro('longBreak', v)}
              />
            </div>
          </div>
          <span className="text-[10px] text-white/50">
            Round {(timer.completedRounds % pomodoro.rounds) + 1} of {pomodoro.rounds}
          </span>
        </>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={timer.toggle}
          className="glass-panel flex h-11 items-center gap-2 rounded-full px-5 text-xs font-semibold text-white"
        >
          {timer.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {timer.running ? 'Pause' : 'Start'}
        </button>
        <button
          type="button"
          onClick={timer.reset}
          aria-label="Reset"
          className="glass-panel flex h-11 w-11 items-center justify-center rounded-full text-white"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

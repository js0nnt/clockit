import { useEffect, useMemo, useRef } from 'react'
import { FlipTile } from './FlipTile'
import { FONT_BY_ID } from '@/lib/fonts'
import { toCss } from '@/lib/paint'
import { playFlip } from '@/lib/sound'
import { groupsFor } from '@/lib/time'
import { useTick, useWindowSize } from '@/lib/hooks'
import type { LayoutSettings } from '@/lib/types'
import { useActiveTheme, useColors, useSettings } from '@/store/settings'
import { changedDigits, emitPulse } from '@/store/pulse'
import { elapsedOf, useTimer } from '@/store/timer'

/** The space the clock may fill. Defaults to the viewport when it is not boxed in. */
export interface Budget {
  width: number
  height: number
}

export function FlipClock({ budget }: { budget?: Budget }) {
  const s = useSettings()
  const colors = useColors()
  const theme = useActiveTheme()
  const timer = useTimer()
  const { width, height } = useWindowSize()

  useTick()

  const elapsed = elapsedOf(timer)
  const remaining = useRemaining(elapsed)
  const { groups } = groupsFor(s.mode, new Date(), s.mode === 'pomodoro' ? remaining : elapsed, {
    hour24: s.hour24,
    showSeconds: s.showSeconds,
  })

  const digits = groups.join('')
  const lastDigits = useRef(digits)
  useEffect(() => {
    if (lastDigits.current === digits) return
    const magnitude = changedDigits(lastDigits.current, digits)
    lastDigits.current = digits
    playFlip(s.flipSound, s.volume)
    emitPulse(magnitude)
  }, [digits, s.flipSound, s.volume])

  const space = budget ?? { width: width * 0.94, height: height * 0.8 }
  const metrics = useMemo(
    () => measure(groups, s.layout, space.width, space.height),
    [groups, s.layout, space.width, space.height],
  )

  const font = FONT_BY_ID.get(s.font)!
  const { tileW, tileH } = metrics

  const style = {
    '--tile-w': `${tileW}px`,
    '--tile-h': `${tileH}px`,
    '--radius-edge': `${s.layout.edgeRounding * tileW}px`,
    '--radius-centre': `${s.layout.centreRounding * tileW}px`,
    '--flap-gap': `${s.layout.flapGap * tileH}px`,
    '--text-size': `${s.layout.textSize * tileH}px`,
    '--text-offset': `${s.layout.textOffset * tileH}px`,
    '--font-stack': font.stack,
    '--font-weight': font.weight ?? s.layout.fontThickness,
    '--flap-paint': toCss(colors.flap),
    '--digit-paint': toCss(colors.digits),
    '--perspective': `${s.animation.perspective}px`,
    // Continuous stretches each flip across the whole second, so a flap is always
    // in motion instead of snapping and resting.
    '--fold-duration': `${(s.continuous ? 1000 : s.animation.delay) / 2}ms`,
    '--depth': s.animation.depth,
    '--bounce-deg': s.animation.bounce * 14,
  } as React.CSSProperties

  return (
    <div
      className={`clock flex flex-wrap items-center justify-center ${theme.glass ? 'glass' : ''}`}
      style={{
        ...style,
        gap: `${s.layout.groupSpacing * tileW}px`,
        // Force the wrap point so the seconds group drops to its own row rather
        // than wherever the browser happens to break.
        maxWidth: metrics.wrap
          ? `${tileW * (4 + 2 * s.layout.digitGap + s.layout.groupSpacing)}px`
          : undefined,
      }}
    >
      {groups.map((group, gi) => (
        <div key={gi} className="flex" style={{ gap: `${s.layout.digitGap * tileW}px` }}>
          {group.split('').map((digit, di) => (
            <FlipTile key={di} value={digit} single={s.layout.singleFlap} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Pomodoro counts down from the current phase's length. */
function useRemaining(elapsed: number): number {
  const { phase, completeRound, setPhase, completedRounds } = useTimer()
  const pomodoro = useSettings((s) => s.pomodoro)
  const minutes =
    phase === 'focus' ? pomodoro.focus : phase === 'break' ? pomodoro.break : pomodoro.longBreak
  const total = minutes * 60_000
  const remaining = Math.max(0, total - elapsed)

  const fired = useRef(false)
  useEffect(() => {
    if (remaining > 0) {
      fired.current = false
      return
    }
    if (fired.current) return
    fired.current = true
    if (phase === 'focus') {
      completeRound()
      setPhase((completedRounds + 1) % pomodoro.rounds === 0 ? 'longBreak' : 'break')
    } else {
      setPhase('focus')
    }
  }, [remaining, phase, completeRound, setPhase, completedRounds, pomodoro.rounds])

  return remaining
}

interface Metrics {
  tileW: number
  tileH: number
  /** three groups laid out as two rows, for phones and other narrow windows */
  wrap: boolean
}

type MeasureLayout = Pick<
  LayoutSettings,
  'tileWidth' | 'digitGap' | 'groupSpacing' | 'clockScale'
>

/** Largest tile that fits the given space for the current group layout, times Clock Scale. */
function measure(
  groups: string[],
  layout: MeasureLayout,
  width: number,
  height: number,
): Metrics {
  const single = fit(groups, layout, width, height, 1)
  // Where three groups on one line would leave the digits tiny — a phone, or a
  // narrow bento box — two rows of two groups read far better.
  if (groups.length < 3 || width > 620) return { ...single, wrap: false }

  const wrapped = fit([groups[0], groups[1]], layout, width, height, 2)
  return wrapped.tileH > single.tileH ? { ...wrapped, wrap: true } : { ...single, wrap: false }
}

function fit(
  rowGroups: string[],
  layout: MeasureLayout,
  width: number,
  height: number,
  rows: number,
): { tileW: number; tileH: number } {
  const digitCount = rowGroups.reduce((n, g) => n + g.length, 0)
  const innerGaps = digitCount - rowGroups.length
  const widthUnits =
    digitCount + innerGaps * layout.digitGap + (rowGroups.length - 1) * layout.groupSpacing

  const availableH = height / rows - (rows > 1 ? 12 : 0)
  const tileWFromWidth = width / Math.max(widthUnits, 1)
  const tileH = Math.max(
    8,
    Math.min(tileWFromWidth / layout.tileWidth, availableH) * layout.clockScale,
  )
  return { tileW: tileH * layout.tileWidth, tileH }
}

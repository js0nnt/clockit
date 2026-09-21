import { useEffect, type ReactNode } from 'react'
import { Backdrop } from './backdrops/Backdrop'
import { toCss } from '@/lib/paint'
import { useColors, useSettings } from '@/store/settings'

const DRIFT = { off: 0, low: 10, high: 34, dvd: 0 } as const

/**
 * Painted background plus burn-in protection. `low`/`high` publish a slow Lissajous
 * offset as `--drift-x` / `--drift-y`, which every widget composes into its own
 * transform. `dvd` is left to the clock widget: a clock ricocheting off the edges is
 * a novelty, a control bar or a bento grid doing it is not.
 */
export function Stage({ children }: { children: ReactNode }) {
  const colors = useColors()
  const protect = useSettings((s) => s.screenProtect)

  useEffect(() => {
    const root = document.documentElement

    const publish = (x: number, y: number) => {
      root.style.setProperty('--drift-x', `${x.toFixed(2)}px`)
      root.style.setProperty('--drift-y', `${y.toFixed(2)}px`)
    }
    // `dvd` moves the clock on its own, from the clock widget.
    if (protect === 'off' || protect === 'dvd') {
      publish(0, 0)
      return
    }

    let raf = 0
    const amplitude = DRIFT[protect]
    const frame = (now: number) => {
      const t = now / 1000
      publish(Math.sin(t / 47) * amplitude, Math.cos(t / 31) * amplitude * 0.6)
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      publish(0, 0)
    }
  }, [protect])

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ backgroundImage: toCss(colors.background) }}
    >
      <Backdrop />
      <div className="relative h-full w-full">{children}</div>
    </div>
  )
}

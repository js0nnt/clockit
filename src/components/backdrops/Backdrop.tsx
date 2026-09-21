import { useEffect, useRef } from 'react'
import { SIMS, type SimContext, type SimId } from './sims'
import { useBackdropPalette, type BackdropPalette } from './palette'
import { readAudio, setCssReactivity } from '@/features/audio/engine'
import { useSettings } from '@/store/settings'
import type { BackdropId } from '@/lib/types'

export function Backdrop() {
  const backdrop = useSettings((s) => s.backdrop)
  const palette = useBackdropPalette()

  useEffect(() => {
    setCssReactivity(backdrop.reactivity)
  }, [backdrop.reactivity])

  if (backdrop.id === 'none') return null

  const style = {
    '--bd-accent1': palette.accent1,
    '--bd-accent2': palette.accent2,
    '--bd-speed': backdrop.speed,
    '--bd-intensity': backdrop.intensity,
  } as React.CSSProperties

  // Canvas sims apply intensity per-pixel, so they skip the wrapper's opacity.
  if (isSim(backdrop.id)) {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <CanvasBackdrop
          sim={backdrop.id}
          palette={palette}
          speed={backdrop.speed}
          intensity={backdrop.intensity}
          reactivity={backdrop.reactivity}
        />
      </div>
    )
  }

  return (
    <div className="backdrop" style={style}>
      {cssLayers(backdrop.id)}
    </div>
  )
}

const isSim = (id: BackdropId): id is SimId => id in SIMS

function cssLayers(id: BackdropId) {
  switch (id) {
    case 'aurora':
      return (
        <>
          <span className="bd-blob" />
          <span className="bd-blob" />
          <span className="bd-blob" />
          <span className="bd-blob" />
        </>
      )
    case 'rays':
      return (
        <>
          <span className="bd-rays" />
          <span className="bd-rays" />
        </>
      )
    case 'tide':
      return (
        <>
          <span className="bd-crest" />
          <span className="bd-crest" />
          <span className="bd-crest" />
        </>
      )
    case 'grid':
      return (
        <>
          <span className="bd-horizon" />
          <span className="bd-grid" />
        </>
      )
    default:
      return null
  }
}

function CanvasBackdrop({
  sim,
  palette,
  speed,
  intensity,
  reactivity,
}: {
  sim: SimId
  palette: BackdropPalette
  speed: number
  intensity: number
  reactivity: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  // Live values the loop reads each frame, so changing a slider does not restart it.
  const live = useRef({ palette, speed, intensity, reactivity })
  useEffect(() => {
    live.current = { palette, speed, intensity, reactivity }
  })

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const instance = SIMS[sim]()
    const state: SimContext = {
      ctx,
      width: 0,
      height: 0,
      audio: readAudio(),
      ...live.current,
    }

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      state.width = canvas.clientWidth
      state.height = canvas.clientHeight
      canvas.width = Math.round(state.width * dpr)
      canvas.height = Math.round(state.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      instance.reset(state)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    const unsubscribe = instance.subscribe?.(state)

    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      // Clamp so a backgrounded tab does not resume with one enormous step.
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      Object.assign(state, live.current)
      state.audio = readAudio()
      ctx.clearRect(0, 0, state.width, state.height)
      instance.frame(state, dt)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      unsubscribe?.()
    }
  }, [sim])

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />
}

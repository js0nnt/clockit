import { onPulse } from '@/store/pulse'
import type { AudioLevels } from '@/features/audio/engine'
import { rgba, type BackdropPalette } from './palette'

export interface SimContext {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  palette: BackdropPalette
  speed: number
  intensity: number
  /** live analysis of whatever is playing; `active` is false when nothing is */
  audio: AudioLevels
  /** how much the audio is allowed to move things, 0 - 1 */
  reactivity: number
}

/** The audio's contribution to a value, scaled by the reactivity setting. */
export function drive(c: SimContext, value: number, amount: number): number {
  return c.audio.active ? value * amount * c.reactivity : 0
}

export interface Sim {
  /** (re)build state for the current size — called on mount and on every resize */
  reset: (c: SimContext) => void
  /** draw one frame; `dt` is seconds since the last frame, clamped */
  frame: (c: SimContext, dt: number) => void
  /** optional hook into the clock's flip pulses */
  subscribe?: (c: SimContext) => () => void
}

// ------------------------------------------------------------------ starfield

interface Star {
  x: number
  y: number
  z: number
}

export function createStarfield(): Sim {
  let stars: Star[] = []
  // Field depth and focal length are both tied to width, so the spread of the
  // field looks the same whatever the window size.
  let depth = 1
  let focal = 1

  const place = (star: Star, c: SimContext, far: boolean) => {
    star.x = (Math.random() - 0.5) * c.width
    star.y = (Math.random() - 0.5) * c.height
    star.z = far ? depth : Math.random() * depth
  }

  return {
    reset(c) {
      depth = Math.max(1, c.width)
      focal = c.width * 0.55
      const count = Math.round((c.width * c.height) / 1800)
      stars = Array.from({ length: Math.min(1600, Math.max(240, count)) }, () => {
        const star: Star = { x: 0, y: 0, z: 0 }
        place(star, c, false)
        return star
      })
    },
    frame(c, dt) {
      const { ctx, width, height, palette, speed, intensity } = c
      const cx = width / 2
      const cy = height / 2
      // Bass drives how fast the field rushes past; a beat gives it a shove.
      const push = 1 + drive(c, c.audio.bass, 2.6) + drive(c, c.audio.beat, 1.8)
      const travel = depth * 0.16 * speed * push
      const flare = 1 + drive(c, c.audio.beat, 0.9)

      ctx.lineCap = 'round'

      for (const star of stars) {
        const prevZ = star.z
        star.z -= travel * dt
        if (star.z <= 1) {
          place(star, c, true)
          continue
        }

        const k = focal / star.z
        const x = cx + star.x * k
        const y = cy + star.y * k
        if (x < -60 || x > width + 60 || y < -60 || y > height + 60) {
          place(star, c, true)
          continue
        }

        const pk = focal / prevZ
        const depthT = 1 - star.z / depth
        // Nearer stars are fatter, brighter and leave a longer streak.
        const tint = depthT > 0.45 ? palette.rgb1 : palette.rgb2

        ctx.strokeStyle = rgba(tint, Math.min(1, (0.35 + depthT * 1.5) * flare) * intensity)
        ctx.lineWidth = Math.max(0.7, depthT * 3.2 * flare)
        ctx.beginPath()
        ctx.moveTo(cx + star.x * pk, cy + star.y * pk)
        ctx.lineTo(x, y)
        ctx.stroke()
      }
    },
  }
}

// ---------------------------------------------------------------------- bokeh

interface Orb {
  x: number
  y: number
  r: number
  rise: number
  drift: number
  phase: number
  warm: boolean
}

export function createBokeh(): Sim {
  let orbs: Orb[] = []

  const spawn = (c: SimContext, atBottom: boolean): Orb => ({
    x: Math.random() * c.width,
    y: atBottom ? c.height + Math.random() * 120 : Math.random() * c.height,
    r: (0.02 + Math.random() * 0.07) * Math.min(c.width, c.height),
    rise: 8 + Math.random() * 26,
    drift: (Math.random() - 0.5) * 14,
    phase: Math.random() * Math.PI * 2,
    warm: Math.random() > 0.5,
  })

  return {
    reset(c) {
      const count = Math.round((c.width * c.height) / 42000)
      orbs = Array.from({ length: Math.min(46, Math.max(10, count)) }, () => spawn(c, false))
    },
    frame(c, dt) {
      const { ctx, width, height, palette, speed, intensity } = c

      // Orbs swell on loud passages and lift faster through busy mid-range.
      const swell = 1 + drive(c, c.audio.level, 0.5) + drive(c, c.audio.beat, 0.35)
      const lift = 1 + drive(c, c.audio.mid, 1.6)

      for (const orb of orbs) {
        orb.y -= orb.rise * speed * lift * dt
        orb.phase += dt * speed * 0.7
        orb.x += (orb.drift + Math.sin(orb.phase) * 10) * speed * dt
        if (orb.y + orb.r < -20) Object.assign(orb, spawn(c, true))

        const radius = orb.r * swell
        const tint = orb.warm ? palette.rgb1 : palette.rgb2
        // A soft edge plus a brighter rim reads as a defocused highlight.
        const gradient = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, radius)
        gradient.addColorStop(0, rgba(tint, 0.1 * intensity))
        gradient.addColorStop(0.72, rgba(tint, 0.16 * intensity))
        gradient.addColorStop(0.92, rgba(tint, 0.34 * intensity))
        gradient.addColorStop(1, rgba(tint, 0))

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(orb.x, orb.y, radius, 0, Math.PI * 2)
        ctx.fill()

        if (orb.x - orb.r > width) orb.x = -orb.r
        if (orb.x + orb.r < 0) orb.x = width + orb.r
        if (orb.y - orb.r > height + 200) orb.y = height + orb.r
      }
    },
  }
}

// --------------------------------------------------------------------- ripple

interface Ring {
  born: number
  strength: number
}

export function createRipple(): Sim {
  let rings: Ring[] = []
  let now = 0
  let beatWasHigh = false

  return {
    reset() {
      rings = []
      beatWasHigh = false
    },
    subscribe() {
      return onPulse((pulse) => {
        // A minute or hour rollover changes more digits, so it lands harder.
        rings.push({ born: now, strength: Math.min(1, 0.45 + pulse.magnitude * 0.22) })
        if (rings.length > 24) rings.shift()
      })
    },
    frame(c, dt) {
      const { ctx, width, height, palette, speed, intensity } = c
      now += dt

      // Ring on every beat, on the rising edge of the envelope so one beat makes
      // one ring rather than one per frame while it decays.
      if (c.audio.active && c.reactivity > 0) {
        const high = c.audio.beat > 0.55
        if (high && !beatWasHigh) {
          rings.push({ born: now, strength: Math.min(1, 0.5 + c.audio.level * 0.8) })
          if (rings.length > 24) rings.shift()
        }
        beatWasHigh = high
      }

      const cx = width / 2
      const cy = height / 2
      const maxR = Math.hypot(width, height) / 2
      const life = 4.5 / speed

      rings = rings.filter((ring) => now - ring.born < life)

      for (const ring of rings) {
        const t = (now - ring.born) / life
        // Ease out so the ring leaps away then coasts to the edge.
        const radius = maxR * (1 - Math.pow(1 - t, 2.4))
        const alpha = (1 - t) * ring.strength * intensity
        if (alpha <= 0.002) continue

        ctx.strokeStyle = rgba(palette.rgb1, alpha * 0.9)
        ctx.lineWidth = 1 + ring.strength * 6 * (1 - t)
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.stroke()

        ctx.strokeStyle = rgba(palette.rgb2, alpha * 0.4)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(cx, cy, radius * 0.94, 0, Math.PI * 2)
        ctx.stroke()
      }
    },
  }
}

export const SIMS = {
  starfield: createStarfield,
  bokeh: createBokeh,
  ripple: createRipple,
} as const

export type SimId = keyof typeof SIMS

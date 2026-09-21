import { useEffect, useRef, useState } from 'react'

/**
 * Re-renders often enough to catch a second boundary promptly. Everything on screen
 * has second resolution, so a short interval beats an animation frame loop here.
 */
export function useTick(period = 50) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), period)
    return () => clearInterval(id)
  }, [period])
}

export function useWindowSize() {
  const [size, setSize] = useState(() => ({
    width: typeof window === 'undefined' ? 1280 : window.innerWidth,
    height: typeof window === 'undefined' ? 720 : window.innerHeight,
  }))
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    screen.orientation?.addEventListener?.('change', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      screen.orientation?.removeEventListener?.('change', onResize)
    }
  }, [])
  return size
}

/** True while the pointer has moved recently; drives the auto-hiding menu. */
export function usePointerActive(timeout = 3200) {
  const [active, setActive] = useState(true)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    const wake = () => {
      setActive(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setActive(false), timeout)
    }
    wake()
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }))
    return () => {
      window.clearTimeout(timer.current)
      events.forEach((e) => window.removeEventListener(e, wake))
    }
  }, [timeout])
  return active
}

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  }
  return { isFullscreen, toggle }
}

/** Closes a panel when the pointer goes down anywhere outside it. */
export function useDismiss(onDismiss: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!enabled) return
    const onDown = (e: PointerEvent) => {
      const node = ref.current
      if (node && !node.contains(e.target as Node)) onDismiss()
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [enabled, onDismiss])
  return ref
}

/** Tracks an element's content box. Returns zeroes until the first observation. */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect
      setSize({ width: box.width, height: box.height })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return { ref, size }
}

/**
 * The "DVD logo" bounce: travels in a straight line and reflects off the viewport
 * edges, measured on the element itself so it always has room to move.
 */
export function useDvdBounce<T extends HTMLElement>(enabled: boolean) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (!enabled) {
      node.style.setProperty('--dvd-x', '0px')
      node.style.setProperty('--dvd-y', '0px')
      return
    }

    let raf = 0
    let last = performance.now()
    let x = 0
    let y = 0
    let vx = 22 / 1000 // px per ms
    let vy = 15 / 1000

    const frame = (now: number) => {
      const dt = now - last
      last = now
      const box = node.getBoundingClientRect()
      const limitX = Math.max(0, (window.innerWidth - box.width) / 2)
      const limitY = Math.max(0, (window.innerHeight - box.height) / 2)

      x += vx * dt
      y += vy * dt
      if (x > limitX || x < -limitX) {
        vx = -vx
        x = Math.max(-limitX, Math.min(limitX, x))
      }
      if (y > limitY || y < -limitY) {
        vy = -vy
        y = Math.max(-limitY, Math.min(limitY, y))
      }

      node.style.setProperty('--dvd-x', `${x.toFixed(2)}px`)
      node.style.setProperty('--dvd-y', `${y.toFixed(2)}px`)
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      node.style.setProperty('--dvd-x', '0px')
      node.style.setProperty('--dvd-y', '0px')
    }
  }, [enabled])

  return ref
}

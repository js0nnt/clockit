import { useCallback, useEffect, useRef, useState } from 'react'
import { averageColor } from './paint'
import { groupsFor } from './time'
import { useSettings } from '@/store/settings'
import { useColors } from '@/store/settings'
import { elapsedOf, useTimer } from '@/store/timer'
import { FONT_BY_ID } from './fonts'

const W = 480
const H = 240

/**
 * Picture-in-Picture needs a video element, so the clock is redrawn on a canvas and
 * that canvas is captured as a stream. The PiP view is a flat, non-animated copy.
 */
export function usePictureInPicture() {
  const [active, setActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef(0)

  const settings = useSettings()
  const colors = useColors()
  const timer = useTimer()

  // Keep the drawing loop reading fresh state without restarting on every change.
  const latest = useRef({ settings, colors, timer })
  useEffect(() => {
    latest.current = { settings, colors, timer }
  })

  const supported =
    typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled

  const draw = useCallback(function draw() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const { settings: s, colors: c, timer: t } = latest.current

    ctx.fillStyle = averageColor(c.background)
    ctx.fillRect(0, 0, W, H)

    const { groups } = groupsFor(s.mode, new Date(), elapsedOf(t), {
      hour24: s.hour24,
      showSeconds: s.showSeconds,
    })

    const digits = groups.reduce((n, g) => n + g.length, 0)
    const gap = 8
    const groupGap = 22
    const tileW = (W - 40 - gap * (digits - groups.length) - groupGap * (groups.length - 1)) / digits
    const tileH = Math.min(H - 48, tileW / s.layout.tileWidth)
    const totalW =
      tileW * digits + gap * (digits - groups.length) + groupGap * (groups.length - 1)

    const font = FONT_BY_ID.get(s.font)!
    ctx.font = `${font.weight ?? s.layout.fontThickness} ${tileH * s.layout.textSize}px ${font.stack}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    let x = (W - totalW) / 2
    const y = (H - tileH) / 2
    for (const group of groups) {
      for (const digit of group) {
        ctx.fillStyle = averageColor(c.flap)
        roundRect(ctx, x, y, tileW, tileH, tileW * s.layout.edgeRounding)
        ctx.fill()
        ctx.fillStyle = averageColor(c.digits)
        ctx.fillText(digit, x + tileW / 2, y + tileH / 2)
        x += tileW + gap
      }
      x += groupGap - gap
    }

    rafRef.current = requestAnimationFrame(draw)
  }, [])

  const toggle = useCallback(async () => {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture().catch(() => {})
      return
    }
    const canvas = canvasRef.current ?? Object.assign(document.createElement('canvas'), { width: W, height: H })
    canvasRef.current = canvas

    let video = videoRef.current
    if (!video) {
      video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.srcObject = canvas.captureStream(30)
      video.addEventListener('enterpictureinpicture', () => setActive(true))
      video.addEventListener('leavepictureinpicture', () => {
        setActive(false)
        cancelAnimationFrame(rafRef.current)
      })
      videoRef.current = video
    }

    cancelAnimationFrame(rafRef.current)
    draw()
    try {
      await video.play()
      await video.requestPictureInPicture()
    } catch {
      cancelAnimationFrame(rafRef.current)
    }
  }, [draw])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  return { supported, active, toggle }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, radius)
}

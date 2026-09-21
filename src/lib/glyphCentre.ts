import { useEffect, useMemo, useState } from 'react'

/**
 * How far a font's digits sit from the true centre of their line, as a fraction of
 * the font size. Positive means the ink sits low.
 *
 * `.glyph` centres the *line box*, but every font places its figures differently
 * inside that box — Playfair's sit 13% of the tile low, Baskerville's 6% high —
 * so centring the line is not the same as centring the digits. This measures the
 * actual ink of 0–9 and the font's own ascent/descent, which is all that decides
 * where the digits land in a `line-height: 1` box.
 */
export function measureDigitOffset(stack: string, weight: number): number {
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return 0

  // Canvas reports these metrics in whole pixels, so measure large: at 1000px the
  // rounding is a twentieth of a percent of the font size.
  const size = 1000
  ctx.font = `${weight} ${size}px ${stack}`
  ctx.textBaseline = 'alphabetic'

  let inkTop = Infinity
  let inkBottom = -Infinity
  for (const digit of '0123456789') {
    const m = ctx.measureText(digit)
    inkTop = Math.min(inkTop, -m.actualBoundingBoxAscent)
    inkBottom = Math.max(inkBottom, m.actualBoundingBoxDescent)
  }

  // `.glyph` asks for lining figures, but a canvas cannot switch OpenType features
  // on, so it measures the font's *default* figures. For most fonts those are lining
  // anyway and the measurement is exact. A font whose defaults are old-style figures
  // — digits dropping well below the baseline, as Playfair's do — is shown with
  // different digits than were measured, so use the band lining figures are drawn
  // to instead: cap height, sitting on the baseline.
  const oldStyleDefaults = inkBottom > size * 0.05
  if (oldStyleDefaults) {
    inkTop = -ctx.measureText('H').actualBoundingBoxAscent
    inkBottom = 0
  }

  const metrics = ctx.measureText('0')
  const ascent = metrics.fontBoundingBoxAscent
  const descent = metrics.fontBoundingBoxDescent
  // Older engines without font-box metrics: assume the line centres itself.
  if (!Number.isFinite(ascent) || !Number.isFinite(descent)) return 0

  // In a line box one em tall, the font's content area is centred, which puts the
  // baseline here — and the ink straddles it by the measured amounts.
  const baseline = (size - (ascent + descent)) / 2 + ascent
  const inkCentre = baseline + (inkTop + inkBottom) / 2
  return (inkCentre - size / 2) / size
}

/**
 * The digit offset for a font, re-measured once the face has actually loaded —
 * measuring the fallback font first would correct for the wrong shapes.
 */
export function useDigitOffset(stack: string, weight: number): number {
  // Bumped whenever a face finishes loading, so the measurement is redone against
  // the real font rather than whatever fallback was showing a moment earlier.
  const [fontsLoaded, setFontsLoaded] = useState(0)

  useEffect(() => {
    let cancelled = false
    const bump = () => {
      if (!cancelled) setFontsLoaded((n) => n + 1)
    }
    document.fonts.load(`${weight} 100px ${stack}`, '0123456789').then(bump, bump)
    document.fonts.addEventListener('loadingdone', bump)
    return () => {
      cancelled = true
      document.fonts.removeEventListener('loadingdone', bump)
    }
  }, [stack, weight])

  // Measuring is a handful of canvas calls, cheap enough to redo on each change.
  return useMemo(() => {
    void fontsLoaded // read so a newly loaded face triggers a fresh measurement
    return measureDigitOffset(stack, weight)
  }, [stack, weight, fontsLoaded])
}

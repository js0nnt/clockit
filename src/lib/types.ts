export type GradientKind = 'solid' | 'linear' | 'radial'

/** A paint: either a flat colour or a two-stop gradient with placement controls. */
export interface ColorSpec {
  a: string
  b: string
  kind: GradientKind
  /** degrees, linear gradients only */
  rotation: number
  /** 0-100, radial centre */
  x: number
  y: number
}

export interface Theme {
  id: string
  name: string
  group: 'signature' | 'glass'
  flap: ColorSpec
  digits: ColorSpec
  background: ColorSpec
  /** glass themes render translucent flaps over the background */
  glass?: boolean
}

export type ClockMode = 'clock' | 'pomodoro' | 'stopwatch'
export type FontId = 'inter' | 'mono' | 'playfair' | 'interBold' | 'baskerville' | 'saira'
export type ScreenProtect = 'off' | 'low' | 'high' | 'dvd'
export type FlipSound = 'off' | 'classic' | 'mechanical' | 'electronic' | 'soft'
export type ColorTarget = 'flap' | 'digits' | 'background'

export interface LayoutSettings {
  /** overall size multiplier, 0.3 - 1.6 */
  clockScale: number
  /** one uninterrupted tile instead of a top/bottom split */
  singleFlap: boolean
  /** tile width as a ratio of tile height, 0.3 - 1 */
  tileWidth: number
  /** digit size as a ratio of tile height, 0.4 - 1.1 */
  textSize: number
  /** vertical nudge of the digit, -0.2 - 0.2 of tile height */
  textOffset: number
  /** font weight, 100 - 900 */
  fontThickness: number
  /** outer corner radius, 0 - 0.35 of tile width */
  edgeRounding: number
  /** radius either side of the seam, 0 - 0.2 of tile width */
  centreRounding: number
  /** gap between the hour / minute / second groups, 0 - 2 of tile width */
  groupSpacing: number
  /** gap across the seam, 0 - 0.06 of tile height */
  flapGap: number
  /** gap between the two digits of a group, 0 - 0.6 of tile width */
  digitGap: number
}

export interface AnimationSettings {
  /** css perspective in px, 200 - 3000 */
  perspective: number
  /** shading strength of the folding leaf, 0 - 1 */
  depth: number
  /** overshoot at the end of the fold, 0 - 1 */
  bounce: number
  /** flip duration in ms, 120 - 1400 */
  delay: number
}

export type BackdropId =
  | 'none'
  | 'aurora'
  | 'rays'
  | 'tide'
  | 'grid'
  | 'starfield'
  | 'bokeh'
  | 'ripple'

export interface BackdropSettings {
  id: BackdropId
  /** animation rate multiplier, 0.25 - 2.5 */
  speed: number
  /** how strongly the effect reads over the base gradient, 0 - 1 */
  intensity: number
  /** tint the effect with the flap and digit colours instead of the background's */
  accent: boolean
  /** how strongly live audio drives the effect, 0 - 1 */
  reactivity: number
}

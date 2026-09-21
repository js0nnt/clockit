/**
 * Live audio analysis for the reactive backdrops.
 *
 * Spotify cannot supply this. Playback happens in the Spotify app or on another
 * device, so there is no audio stream in this page to analyse, and the Web API's
 * `audio-analysis` / `audio-features` endpoints (beat grid, BPM, energy) were
 * deprecated for newly created apps in November 2024 — a Client ID registered today
 * gets 403 from them. So instead of asking Spotify what the music is doing, we
 * listen to it: the browser captures real audio and we run our own FFT over it.
 */

export type AudioSource = 'off' | 'system' | 'mic'

export interface AudioLevels {
  /** overall loudness, 0-1, auto-gained so quiet sources still drive the visuals */
  level: number
  bass: number
  mid: number
  treble: number
  /** decaying envelope, 1 at the instant of a beat */
  beat: number
  /** true while a source is connected and delivering signal */
  active: boolean
}

const SILENT: AudioLevels = {
  level: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  beat: 0,
  active: false,
}

/**
 * Animation loops read this every frame, so it is a plain mutable object rather
 * than React state — a re-render per frame would be pure waste.
 */
let levels: AudioLevels = { ...SILENT }

export function readAudio(): AudioLevels {
  return levels
}

/**
 * How much the published CSS variables lean away from neutral. The raw `levels`
 * stay untouched, because the canvas sims apply their own reactivity — scaling
 * here as well would square it.
 */
let cssReactivity = 1

export function setCssReactivity(value: number) {
  cssReactivity = Math.max(0, Math.min(1, value))
  publish(levels)
}

interface Session {
  context: AudioContext
  stream: MediaStream
  analyser: AnalyserNode
  raf: number
}

let session: Session | null = null

/** Frequency band edges in Hz. */
const BANDS = {
  bass: [20, 200],
  mid: [200, 2000],
  treble: [2000, 8000],
} as const

/** Onset detection: how far above the recent average a bass spike must be. */
const BEAT_THRESHOLD = 1.35
const BEAT_MIN_GAP_MS = 180
const HISTORY = 43

/**
 * Energy-based onset detection: a beat is bass energy jumping clear of its own
 * recent average, rate-limited so one kick cannot register twice. Split out from
 * the analyser loop so it can be exercised without an AudioContext.
 */
export function createBeatDetector() {
  const history: number[] = []
  let lastBeat = -Infinity

  return {
    push(bass: number, nowMs: number): boolean {
      history.push(bass)
      if (history.length > HISTORY) history.shift()
      if (history.length < HISTORY) return false

      const average = history.reduce((a, b) => a + b, 0) / history.length
      const isBeat =
        bass > average * BEAT_THRESHOLD && bass > 0.04 && nowMs - lastBeat > BEAT_MIN_GAP_MS
      if (isBeat) lastBeat = nowMs
      return isBeat
    },
  }
}

export async function startAudio(source: Exclude<AudioSource, 'off'>): Promise<void> {
  stopAudio()

  const stream =
    source === 'mic'
      ? await navigator.mediaDevices.getUserMedia({
          audio: {
            // Every one of these would fight the music: AGC pumps the level,
            // noise suppression eats sustained tones, echo cancellation ducks it.
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        })
      : await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        })

  if (!stream.getAudioTracks().length) {
    stream.getTracks().forEach((t) => t.stop())
    throw new Error(
      'That capture has no audio track — pick a tab or window and tick "Share audio".',
    )
  }
  // The video track is only there because getDisplayMedia demands one.
  stream.getVideoTracks().forEach((track) => track.stop())

  const context = new AudioContext()
  await context.resume()
  const analyser = context.createAnalyser()
  analyser.fftSize = 2048
  analyser.smoothingTimeConstant = 0.72
  context.createMediaStreamSource(stream).connect(analyser)
  // Deliberately not connected to the destination: this is for analysis only,
  // and routing system audio back out would feed straight back in.

  session = { context, stream, analyser, raf: 0 }
  run(session)
}

export function stopAudio(): void {
  if (!session) return
  cancelAnimationFrame(session.raf)
  session.stream.getTracks().forEach((track) => track.stop())
  void session.context.close().catch(() => {})
  session = null
  levels = { ...SILENT }
  publish(levels)
}

/** Resolves when the capture ends on its own — the user hits "Stop sharing". */
export function onSourceEnded(callback: () => void): () => void {
  const track = session?.stream.getAudioTracks()[0]
  if (!track) return () => {}
  track.addEventListener('ended', callback)
  return () => track.removeEventListener('ended', callback)
}

function run(active: Session) {
  const { analyser, context } = active
  const bins = new Uint8Array(analyser.frequencyBinCount)
  const hzPerBin = context.sampleRate / 2 / analyser.frequencyBinCount

  const beats = createBeatDetector()
  let peak = 0.12
  let beatEnvelope = 0
  let last = performance.now()

  const bandAverage = (from: number, to: number) => {
    const start = Math.max(1, Math.floor(from / hzPerBin))
    const end = Math.min(bins.length - 1, Math.ceil(to / hzPerBin))
    let sum = 0
    for (let i = start; i <= end; i++) sum += bins[i]
    return sum / Math.max(1, end - start + 1) / 255
  }

  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    analyser.getByteFrequencyData(bins)

    const bass = bandAverage(...BANDS.bass)
    const mid = bandAverage(...BANDS.mid)
    const treble = bandAverage(...BANDS.treble)
    const raw = bass * 0.5 + mid * 0.35 + treble * 0.15

    // Auto-gain: track the loudest recent moment and normalise against it, so a
    // quiet stream still fills the range instead of barely moving the visuals.
    peak = Math.max(raw, peak * 0.9995, 0.05)
    const level = Math.min(1, raw / peak)

    if (beats.push(bass, now)) beatEnvelope = 1
    beatEnvelope = Math.max(0, beatEnvelope - dt * 3.6)

    levels = {
      level,
      bass: Math.min(1, bass / peak),
      mid: Math.min(1, mid / peak),
      treble: Math.min(1, treble / peak),
      beat: beatEnvelope,
      active: true,
    }
    publish(levels)

    active.raf = requestAnimationFrame(frame)
  }

  active.raf = requestAnimationFrame(frame)
}

/**
 * CSS backdrops read these. They sit at their neutral values — boost 1, the rest 0
 * — whenever nothing is playing or reactivity is off, so the page looks exactly as
 * it did before the feature existed.
 */
function publish(current: AudioLevels) {
  const root = document.documentElement
  const mix = current.active ? cssReactivity : 0
  const towards = (value: number, neutral: number) => neutral + (value - neutral) * mix

  root.style.setProperty('--audio-boost', towards(0.55 + current.level * 0.75, 1).toFixed(3))
  root.style.setProperty('--audio-beat', towards(current.beat, 0).toFixed(3))
  root.style.setProperty('--audio-bass', towards(current.bass, 0).toFixed(3))
  root.style.setProperty('--audio-level', towards(current.level, 0).toFixed(3))
}

/** True when the mic was already allowed, so it can resume without a click. */
export async function micAlreadyGranted(): Promise<boolean> {
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    return status.state === 'granted'
  } catch {
    return false
  }
}

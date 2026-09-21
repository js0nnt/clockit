import type { FlipSound } from './types'

/**
 * Flip clicks are synthesised rather than sampled, so the app ships with no audio
 * assets and the four voices are just different noise/tone envelopes.
 */
let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(c.sampleRate * seconds)
  const buffer = c.createBuffer(1, length, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

interface Voice {
  decay: number
  filter: number
  q: number
  tone?: number
  gain: number
}

const VOICES: Record<Exclude<FlipSound, 'off'>, Voice> = {
  classic: { decay: 0.06, filter: 2400, q: 1.2, gain: 1 },
  mechanical: { decay: 0.1, filter: 1100, q: 3.5, tone: 180, gain: 1.1 },
  electronic: { decay: 0.05, filter: 5200, q: 0.8, tone: 880, gain: 0.7 },
  soft: { decay: 0.12, filter: 700, q: 0.7, gain: 0.8 },
}

export function playFlip(kind: FlipSound, volume: number) {
  if (kind === 'off' || volume <= 0) return
  const c = audio()
  if (!c) return
  const voice = VOICES[kind]
  const now = c.currentTime

  const master = c.createGain()
  master.gain.value = volume * voice.gain * 0.35
  master.connect(c.destination)

  const source = c.createBufferSource()
  source.buffer = noiseBuffer(c, voice.decay)
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = voice.filter
  filter.Q.value = voice.q
  const env = c.createGain()
  env.gain.setValueAtTime(1, now)
  env.gain.exponentialRampToValueAtTime(0.001, now + voice.decay)
  source.connect(filter).connect(env).connect(master)
  source.start(now)
  source.stop(now + voice.decay)

  if (voice.tone) {
    const osc = c.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(voice.tone, now)
    osc.frequency.exponentialRampToValueAtTime(voice.tone * 0.5, now + voice.decay)
    const toneEnv = c.createGain()
    toneEnv.gain.setValueAtTime(0.4, now)
    toneEnv.gain.exponentialRampToValueAtTime(0.001, now + voice.decay)
    osc.connect(toneEnv).connect(master)
    osc.start(now)
    osc.stop(now + voice.decay)
  }
}

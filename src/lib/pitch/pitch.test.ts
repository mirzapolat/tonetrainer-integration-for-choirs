import { describe, expect, it } from 'vitest'
import { McLeodDetector } from './mpm'
import { PitchTracker, freqToMidi } from './tracker'

const SR = 48000
const N = 2048

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 32 - 0.5
  }
}

/** Voice-like tone: harmonic series with adjustable fundamental strength, optional noise and vibrato. */
function tone(freq: number, opts: { fundamental?: number; harmonics?: number; noise?: number; vibrato?: number; offset?: number } = {}) {
  const { fundamental = 1, harmonics = 1, noise = 0, vibrato = 0, offset = 0 } = opts
  const rand = rng(Math.round(freq * 1000))
  const out = new Float32Array(N)
  let phase = 0
  for (let i = 0; i < N; i++) {
    const t = (i + offset) / SR
    const f = freq * 2 ** ((vibrato * Math.sin(2 * Math.PI * 5.5 * t)) / 1200)
    phase += (2 * Math.PI * f) / SR
    let s = fundamental * Math.sin(phase)
    for (let k = 2; k <= harmonics; k++) s += Math.sin(k * phase) / k
    out[i] = 0.2 * s + noise * rand()
  }
  return out
}

const cents = (a: number, b: number) => 1200 * Math.log2(a / b)

describe('McLeodDetector', () => {
  const det = new McLeodDetector({ sampleRate: SR, bufferSize: N })

  it.each([65.41, 82.41, 110, 196, 220, 261.63, 440, 659.26, 880, 1046.5])('finds %f Hz within 2 cents', (f) => {
    const est = det.detect(tone(f))!
    expect(est).not.toBeNull()
    expect(Math.abs(cents(est.freq, f))).toBeLessThan(2)
    expect(est.clarity).toBeGreaterThan(0.95)
  })

  it.each([98, 146.83, 220, 392])('stays in the right octave when the fundamental is weak (%f Hz)', (f) => {
    const est = det.detect(tone(f, { fundamental: 0.15, harmonics: 10 }))!
    expect(Math.abs(cents(est.freq, f))).toBeLessThan(5)
  })

  it('tolerates background noise', () => {
    const est = det.detect(tone(293.66, { harmonics: 6, noise: 0.08 }))!
    expect(Math.abs(cents(est.freq, 293.66))).toBeLessThan(8)
  })

  it('reports low clarity for white noise', () => {
    const rand = rng(7)
    const noise = Float32Array.from({ length: N }, () => rand() * 0.3)
    const est = det.detect(noise)
    expect(est === null || est.clarity < 0.6).toBe(true)
  })
})

describe('PitchTracker', () => {
  it('ignores silence', () => {
    const tr = new PitchTracker({ sampleRate: SR, bufferSize: N })
    expect(tr.process(new Float32Array(N)).midi).toBeNull()
  })

  it('suppresses a single-frame octave glitch', () => {
    const tr = new PitchTracker({ sampleRate: SR, bufferSize: N })
    const outs: number[] = []
    for (let i = 0; i < 12; i++) {
      const f = i === 6 ? 440 : 220
      const r = tr.process(tone(f, { harmonics: 5, offset: i * 800 }))
      if (r.midi !== null) outs.push(r.midi)
    }
    for (const m of outs) expect(Math.abs(m - freqToMidi(220))).toBeLessThan(0.1)
  })

  it('follows a real note change quickly', () => {
    const tr = new PitchTracker({ sampleRate: SR, bufferSize: N })
    for (let i = 0; i < 8; i++) tr.process(tone(220, { harmonics: 5, offset: i * 800 }))
    let frames = 0
    let m: number | null = null
    do {
      m = tr.process(tone(246.94, { harmonics: 5, offset: frames * 800 })).midi
      frames++
    } while (frames < 10 && (m === null || Math.abs(m - freqToMidi(246.94)) > 0.2))
    expect(frames).toBeLessThanOrEqual(3)
  })

  it('tracks vibrato around the centre pitch', () => {
    const tr = new PitchTracker({ sampleRate: SR, bufferSize: N })
    const vals: number[] = []
    for (let i = 0; i < 40; i++) {
      const r = tr.process(tone(330, { harmonics: 6, vibrato: 40, offset: i * 800 }))
      if (r.midi !== null) vals.push(r.midi)
    }
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    expect(Math.abs(mean - freqToMidi(330)) * 100).toBeLessThan(15)
  })
})

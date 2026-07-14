// Clean, minimal SFX synthesised with the Web Audio API — no asset files to
// source or bundle, and every cue is a short tactile blip in keeping with the
// anti-casino aesthetic. The `play(cue)` interface is deliberately generic so
// real samples (via Howler) can be swapped in later without touching callers.

'use client'

export type Cue =
  | 'deal'
  | 'check'
  | 'call'
  | 'bet'
  | 'raise'
  | 'fold'
  | 'allin'
  | 'win'
  | 'lose'
  | 'tap'
  | 'turn'

interface Voice {
  freq: number
  type: OscillatorType
  duration: number
  gain: number
  /** Optional pitch glide target. */
  sweepTo?: number
}

const VOICES: Record<Cue, Voice> = {
  deal: { freq: 320, type: 'triangle', duration: 0.07, gain: 0.12, sweepTo: 200 },
  check: { freq: 440, type: 'sine', duration: 0.06, gain: 0.14 },
  call: { freq: 523, type: 'sine', duration: 0.08, gain: 0.16 },
  bet: { freq: 620, type: 'triangle', duration: 0.1, gain: 0.18, sweepTo: 740 },
  raise: { freq: 660, type: 'triangle', duration: 0.12, gain: 0.2, sweepTo: 880 },
  fold: { freq: 240, type: 'sine', duration: 0.12, gain: 0.14, sweepTo: 160 },
  allin: { freq: 300, type: 'sawtooth', duration: 0.28, gain: 0.2, sweepTo: 900 },
  win: { freq: 660, type: 'sine', duration: 0.35, gain: 0.22, sweepTo: 990 },
  lose: { freq: 300, type: 'sine', duration: 0.3, gain: 0.16, sweepTo: 180 },
  tap: { freq: 520, type: 'sine', duration: 0.035, gain: 0.1 },
  turn: { freq: 720, type: 'sine', duration: 0.09, gain: 0.14, sweepTo: 760 },
}

class SoundEngine {
  private ctx: AudioContext | null = null
  private muted = false
  private volume = 0.7
  private lastPlayed: Partial<Record<Cue, number>> = {}

  setMuted(muted: boolean) {
    this.muted = muted
  }
  isMuted() {
    return this.muted
  }
  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v))
  }

  private context(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!Ctor) return null
      this.ctx = new Ctor()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  play(cue: Cue) {
    if (this.muted) return
    const ctx = this.context()
    if (!ctx) return

    // Debounce identical cues fired in the same animation frame.
    const now = ctx.currentTime
    if (this.lastPlayed[cue] && now - this.lastPlayed[cue]! < 0.03) return
    this.lastPlayed[cue] = now

    const v = VOICES[cue]
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = v.type
    osc.frequency.setValueAtTime(v.freq, now)
    if (v.sweepTo) osc.frequency.exponentialRampToValueAtTime(v.sweepTo, now + v.duration)

    const peak = v.gain * this.volume
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + v.duration)

    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + v.duration + 0.02)
  }
}

export const sound = new SoundEngine()

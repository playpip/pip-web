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
  | 'draw'
  | 'flip'

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
  // Cards going away and coming back: `deal`'s shape, a touch shorter, so a
  // draw round of five players does not turn into a drum solo.
  draw: { freq: 340, type: 'triangle', duration: 0.06, gain: 0.11, sweepTo: 240 },
  // Mystery Card turning over on the river: `deal` played upwards and held a
  // little longer, so it reads as a card being lifted rather than landing.
  flip: { freq: 380, type: 'triangle', duration: 0.22, gain: 0.16, sweepTo: 780 },
}

/**
 * A sound pack, as a transform of the voices above rather than a second
 * copy of them.
 *
 * **The cues were tuned against each other** — `fold` sits under `check`, `win`
 * answers `lose`, `draw` is `deal` shortened so a five-player draw round is not
 * a drum solo — and a pack that re-authored every one would let one of those
 * relationships drift on an afternoon nobody was listening carefully. Scaling
 * the whole set preserves the shape by construction, and it means a pack is
 * four numbers, which is the reason there can be six of them.
 *
 * Structural rather than imported from config/cosmetics: this file is the
 * lowest thing in the stack and does not need to know that packs are something
 * you buy.
 */
export interface SoundShape {
  /** Multiplies every cue's frequency, and its glide target with it. */
  pitch: number
  /** Multiplies every cue's peak gain. */
  gain: number
  /** Multiplies every cue's duration. */
  length: number
  /** Replaces every cue's oscillator. Absent keeps each cue's own. */
  timbre?: OscillatorType
}

const HOUSE: SoundShape = { pitch: 1, gain: 1, length: 1 }

class SoundEngine {
  private ctx: AudioContext | null = null
  private muted = false
  private volume = 0.7
  private pack: SoundShape = HOUSE
  private lastPlayed: Partial<Record<Cue, number>> = {}
  private listener: ((cue: Cue) => void) | null = null
  private watching = false

  setMuted(muted: boolean) {
    this.muted = muted
  }
  isMuted() {
    return this.muted
  }
  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v))
  }
  /**
   * Swap the pack. Takes effect on the next cue and never on a playing one:
   * every `play` builds its own oscillator and reads this as it goes, so
   * changing packs mid-hand cannot cut a sound off halfway.
   */
  setPack(pack: SoundShape) {
    this.pack = pack
  }

  private context(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      this.ctx = new Ctor()
      this.watch()
    }
    // Not only 'suspended': iOS also leaves a context 'interrupted' after the
    // app has been in the background or the mic has been on, and one left
    // there plays every later cue into silence.
    if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => {})
    return this.ctx
  }

  /**
   * Get the sound back after the app has been away. iOS only lets a context
   * start again inside a tap, and one that has been interrupted sometimes will
   * not resume at all, so the first tap after it stops replaces it with a new
   * one, which always starts. Cues build their own nodes each time, so nothing
   * is lost with the old context.
   */
  private watch() {
    if (this.watching) return
    this.watching = true
    const revive = () => {
      const ctx = this.ctx
      if (!ctx || ctx.state === 'running') return
      void ctx.close().catch(() => {})
      this.ctx = null
      this.lastPlayed = {}
      // Created inside the tap, so iOS lets it run.
      void this.context()
        ?.resume()
        .catch(() => {})
    }
    for (const type of ['pointerdown', 'touchend', 'keydown'] as const) {
      window.addEventListener(type, revive, { capture: true, passive: true })
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.ctx?.state !== 'running') {
        void this.ctx?.resume().catch(() => {})
      }
    })
  }

  /**
   * Called with every cue, before mute or a missing AudioContext can stop it.
   * This is how haptics follow sound (AppBoot joins the two): every sound gets
   * its matching vibration, and muting the sound doesn't take the feel away.
   */
  onPlay(listener: ((cue: Cue) => void) | null) {
    this.listener = listener
  }

  play(cue: Cue) {
    this.listener?.(cue)
    if (this.muted) return
    const ctx = this.context()
    if (!ctx) return

    // Debounce identical cues fired in the same animation frame.
    const now = ctx.currentTime
    if (this.lastPlayed[cue] && now - this.lastPlayed[cue]! < 0.03) return
    this.lastPlayed[cue] = now

    const v = VOICES[cue]
    const pack = this.pack
    // The pack's three multipliers, applied once here so that every cue and
    // every future cue gets them without remembering to.
    const duration = v.duration * pack.length
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = pack.timbre ?? v.type
    osc.frequency.setValueAtTime(v.freq * pack.pitch, now)
    if (v.sweepTo)
      osc.frequency.exponentialRampToValueAtTime(v.sweepTo * pack.pitch, now + duration)

    const peak = v.gain * pack.gain * this.volume
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + duration + 0.02)
  }
}

export const sound = new SoundEngine()

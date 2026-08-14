/**
 * Short, restrained vibration on the physical moments: cards arriving, chips
 * going in, a pot won, a tournament ending.
 *
 * Mirrors `lib/sound.ts` on purpose. Same shape of problem (one module, feature
 * detects, no-ops when unsupported or switched off), so it gets the same shape
 * of answer and callers do not have to know which of the two is available.
 *
 * **This is an Android and desktop-Chrome feature and it degrades to nothing
 * elsewhere.** `navigator.vibrate` is not implemented in Safari at all, on any
 * platform, and there is no Web Vibration support coming. The switch-element
 * tricks that coax a haptic out of iOS depend on a specific control being
 * rendered and break at a Safari release, so we do not ship one. **Never
 * describe this publicly as if an iPhone gets it.** If Pip is ever wrapped for
 * iOS, native haptics come from the wrapper, not from this layer.
 *
 * **Off by default, unlike sound.** Vibration without consent is the kind of
 * thing Pip does not do: an unexpected buzz in a calm app reads as a casino
 * tell. `tableTalk` is the precedent for an opt-in feel toggle, except that one
 * defaults on because a line of dialogue cannot startle anybody.
 *
 * **Reduced motion wins over the setting.** Vibration is motion. If the OS asks
 * for less of it we do not buzz, whatever the toggle says, and the toggle is
 * deliberately not updated to match: the player's choice is still theirs if
 * they turn the OS preference off again.
 */

'use client'

export type Buzz = 'deal' | 'commit' | 'win' | 'finish' | 'bust'

/**
 * Milliseconds, and they are meant to look small. The brief is tens of
 * milliseconds: if a pattern is noticeable as *buzzing* rather than as a tap,
 * it is wrong. Arrays alternate vibrate and pause, which is the Web Vibration
 * API's own shape.
 */
export const PATTERNS: Record<Buzz, number | number[]> = {
  /** Cards arriving. The lightest thing here; it fires every hand. */
  deal: 8,
  /** Your chips going in. Never an opponent's, or a nine-handed table hums. */
  commit: 12,
  /** A pot to you. Two taps, so it reads as different from a commit. */
  win: [12, 40, 18],
  /** Tournament won. A short cadence, and the only celebratory one. */
  finish: [10, 50, 10, 50, 24],
  /** Out. One soft thud, not a buzzer. Losing does not get a fanfare. */
  bust: 24,
}

/** The end of a tournament, either way. Never suppressed by the debounce. */
const TERMINAL: ReadonlySet<Buzz> = new Set<Buzz>(['finish', 'bust'])

class HapticEngine {
  private lastFired = 0

  /** Whether this browser could vibrate at all, ignoring the setting. */
  supported() {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  }

  /**
   * The OS asking for less motion. Read live rather than cached at startup:
   * it can be toggled mid-session, it is cheap to query, and the failure it
   * prevents (buzzing someone who asked us not to) is worse than the read.
   */
  private reducedMotion() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  /**
   * **The caller owns the on/off check, and that is deliberate.** The setting
   * lives on the persisted profile, so an `enabled` flag in here would be a
   * second copy of it that has to be kept in step, and the failure mode of
   * that going stale is buzzing somebody who switched it off. The game store
   * gates every call on `profile.haptics`; Settings calls this directly, on
   * purpose, so you feel the thing you just turned on.
   *
   * Support and reduced motion *are* checked here, because those are facts
   * about the device rather than choices on the profile.
   */
  fire(buzz: Buzz) {
    if (!this.supported()) return
    if (this.reducedMotion()) return

    // One buzz per 60ms. Two haptics landing together do not read as two
    // events, they read as one longer buzz, which is what the patterns above
    // are shaped to avoid.
    //
    // **The two terminal cues are exempt, and that is not a special case for
    // its own sake.** The hand that wins the tournament also wins a pot, so
    // `win` and `finish` fire microseconds apart, and a plain debounce would
    // keep the smaller one. `navigator.vibrate` replaces the running pattern
    // rather than queueing behind it, so letting the terminal cue through
    // means it overrides the pot buzz, which is the right way round.
    const now = Date.now()
    if (!TERMINAL.has(buzz) && now - this.lastFired < 60) return
    this.lastFired = now

    // Chrome refuses (and warns) if the document has never been tapped, and a
    // throw here would take a hand's state transition down with it.
    try {
      navigator.vibrate(PATTERNS[buzz])
    } catch {
      // Nothing to do and nothing worth telling the player. It is an enhancement.
    }
  }
}

export const haptics = new HapticEngine()

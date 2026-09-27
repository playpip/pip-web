'use client'

// Playing a finished hand back, one beat at a time.
//
// Lifted out of the /hand permalink, which had the only replay in the app and
// now has one of two: the session review plays hands back as well, and a second
// implementation of "which board is showing at step 7" is a second thing to get
// wrong. The two screens still own their own layout — a shared hand is a
// highlight reel with a headline and an invitation, a reviewed hand is a
// working surface with the arithmetic beside it — so what is shared is the
// state machine and the narration, not the page.

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { Card } from '@/lib/poker/cards'
import type { HandEvent, HandRecord } from '@/store/game'
import { sound } from '@/lib/sound'

/** How long each beat holds. Board deals linger so the cards can be admired. */
const BEAT_MS = 640
const BOARD_BEAT_MS = 1000

export interface Replay {
  /** How many events have been revealed. */
  step: number
  total: number
  playing: boolean
  finished: boolean
  /** The board as of this step. */
  community: Card[]
  /** The beat just revealed, if any. */
  current: HandEvent | undefined
  /** The player's reduced-motion setting, resolved once for the whole replay. */
  reduce: boolean
  toggle: () => void
  seek: (step: number) => void
  restart: () => void
}

/**
 * @param opens Where an untouched replay sits. `'start'` is the highlight reel:
 *   nothing has happened yet and it plays in. `'end'` is the study position —
 *   the whole hand at rest, ready to be walked backwards — which is what the
 *   review wants, because somebody who just clicked hand 14 wants to see hand
 *   14, not watch it arrive.
 */
export function useReplay(
  record: HandRecord,
  opts: { autoplay?: boolean; opens?: 'start' | 'end' } = {},
): Replay {
  const reduce = useReducedMotion() ?? false
  const total = record.events.length
  const atEnd = opts.opens === 'end' || reduce || total === 0
  const [step, setStep] = useState(atEnd ? total : 0)
  const [playing, setPlaying] = useState(Boolean(opts.autoplay) && !atEnd)
  const finished = step >= total

  // Autoplay: advance a beat at a time. The sound plays inside the timer — a
  // real user gesture unlocks audio; before that it is a silent no-op, never an
  // error.
  useEffect(() => {
    if (!playing || step >= total) return
    const next = record.events[step]
    const t = setTimeout(
      () => {
        if (next) sound.play(cueFor(next))
        setStep((s) => s + 1)
      },
      next?.kind === 'board' ? BOARD_BEAT_MS : BEAT_MS,
    )
    return () => clearTimeout(t)
  }, [playing, step, total, record])

  const restart = () => {
    setStep(0)
    setPlaying(true)
    sound.play('tap')
  }

  return {
    step,
    total,
    playing,
    finished,
    reduce,
    // The latest board event already shown is cumulative, so the last one wins.
    community:
      record.events
        .slice(0, step)
        .reverse()
        .find((e) => e.kind === 'board')?.cards ?? [],
    current: record.events.slice(0, step).at(-1),
    toggle: () => {
      sound.play('tap')
      if (finished) return restart()
      setPlaying((p) => !p)
    },
    seek: (n: number) => {
      setPlaying(false)
      setStep(Math.max(0, Math.min(total, n)))
      sound.play('tap')
    },
    restart,
  }
}

/** Fire the payoff chime once, when a replay lands on its result. */
export function useFinishChime(finished: boolean, total: number) {
  const chimed = useRef(false)
  useEffect(() => {
    if (finished && total > 0 && !chimed.current) {
      chimed.current = true
      sound.play('win')
    }
  }, [finished, total])
}

/** The sound cue for the beat about to be revealed. */
export function cueFor(ev: HandEvent) {
  if (ev.kind === 'board') return 'deal' as const
  return ev.type
}

/** One line of commentary for the current beat. */
export function narrate(ev: HandEvent | undefined, money: (n: number) => string): string {
  if (!ev) return 'Watch it back, move by move.'
  if (ev.kind === 'board') return `The ${ev.label}`
  switch (ev.type) {
    case 'fold':
      return `${ev.playerName} folds`
    case 'check':
      return `${ev.playerName} checks`
    case 'call':
      return `${ev.playerName} calls ${money(ev.amount ?? 0)}`
    case 'bet':
      return `${ev.playerName} bets ${money(ev.amount ?? 0)}`
    case 'draw':
      return `${ev.playerName} draws`
    default:
      return `${ev.playerName} raises to ${money(ev.amount ?? 0)}`
  }
}

export type Outcome =
  | { kind: 'win'; winner: string; amount: number; detail?: string }
  | { kind: 'text'; text: string }

/** Split the store's summary ("Alex wins 1,240 with a flush") for a headline. */
export function parseOutcome(summary: string): Outcome | null {
  if (!summary) return null
  const m = /^(.+?) wins ([\d,]+)(?: with (.+))?$/.exec(summary)
  if (!m) return { kind: 'text', text: summary }
  return { kind: 'win', winner: m[1], amount: Number(m[2].replace(/,/g, '')), detail: m[3] }
}

'use client'

// The tour's eight pages — one idea, one animation, two or three sentences
// each (see docs/brand.md for the voice). Config-driven so pages are easy to
// reorder or add, and every visual is built from the real product primitives —
// PlayingCard, DealtCard, CardBack, CountUp, VenueArt — so the tutorial IS the
// game, just narrated. No dealing logic, no stores mutated: static example
// cards on timers, all presentation layer.

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { DealtCard, PlayingCard } from '@/components/PlayingCard'
import { CardBack } from '@/components/CardBack'
import { CountUp } from '@/components/CountUp'
import { VenueArt } from '@/components/menu/VenueArt'
import { HandsHelpDialog } from '@/components/table/HandsHelpDialog'
import { cardBackById } from '@/config/cardBacks'
import { VENUES } from '@/config/venues'
import { cardFromString, type Card } from '@/lib/poker/cards'
import { useProfile } from '@/store/profile'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

export interface Lesson {
  id: string
  title: string
  body: React.ReactNode
  Visual: React.ComponentType
}

const cards = (...ids: string[]): Card[] => ids.map(cardFromString)

const spring = { type: 'spring', stiffness: 260, damping: 24 } as const

// Visuals fire deal blips from timers, not clicks — before the visitor's first
// interaction the browser would block (and warn about) the AudioContext, so a
// cold landing on /learn stays silent until they've touched the page.
const playDeal = () => {
  if (typeof navigator !== 'undefined' && navigator.userActivation?.hasBeenActive)
    sound.play('deal')
}

/* ------------------------------- tiny hooks ------------------------------- */

/** One-shot beats: 0 on mount, then i+1 as each delay (ms from mount) passes. */
function useBeats(delays: readonly number[]): number {
  const [beat, setBeat] = useState(0)
  useEffect(() => {
    const timers = delays.map((d, i) => setTimeout(() => setBeat(i + 1), d))
    return () => timers.forEach(clearTimeout)
  }, [delays])
  return beat
}

/** A looping metronome: the current beat 0..count-1, advancing every `ms`. */
function useLoop(count: number, ms: number): number {
  const [beat, setBeat] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setBeat((b) => (b + 1) % count), ms)
    return () => clearInterval(id)
  }, [count, ms])
  return beat
}

/** The player's chosen card back (falls back to the default pre-profile). */
function useCardBack() {
  return cardBackById(useProfile((s) => s.cardBack))
}

/* ------------------------------- shared bits ------------------------------ */

/** The Pip chip in currentColor — a pot that isn't a pile of casino clipart. */
function ChipGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="15" fill="currentColor" opacity="0.2" />
      <circle
        cx="16"
        cy="16"
        r="12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeDasharray="3.3 6.517"
        strokeDashoffset="1.65"
      />
      <circle cx="16" cy="16" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function PotPill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.03] px-4 py-2',
        className,
      )}
    >
      <ChipGlyph className="size-4 text-pip" />
      <span className="text-sm font-medium tabular-nums">{children}</span>
    </div>
  )
}

/** A card that flips between the player's back and its face (3D, springy). */
function FlipCard({ card, up }: { card: Card; up: boolean }) {
  const design = useCardBack()
  return (
    <div style={{ perspective: 600 }}>
      <motion.div
        animate={{ rotateY: up ? 0 : 180 }}
        initial={false}
        transition={spring}
        className="relative"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div style={{ backfaceVisibility: 'hidden' }}>
          <PlayingCard card={card} size="sm" />
        </div>
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <CardBack design={design} size="sm" />
        </div>
      </motion.div>
    </div>
  )
}

/* ----------------------------- 1 · the goal ------------------------------- */

const GOAL_HOLE = cards('Ks', 'Kh')

function GoalVisual() {
  useEffect(() => {
    playDeal()
  }, [])
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-5">
      <div className="flex gap-2">
        {GOAL_HOLE.map((card, i) => (
          <DealtCard key={i} card={card} index={i} size="md" />
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, x: 32 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ ...spring, delay: 0.5 }}
      >
        <PotPill>the pot · 240 chips</PotPill>
      </motion.div>
    </div>
  )
}

/* --------------------------- 2 · your two cards --------------------------- */

// The same fan as the landing hero — pivoting from a shared bottom edge.
const FAN_HOLE = cards('As', 'Ah')

function HoleCardsVisual() {
  const design = useCardBack()
  return (
    <div className="flex flex-col items-center gap-7">
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex gap-1.5">
          {[0, 1].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: i * 0.08 }}
            >
              <CardBack design={design} size="sm" />
            </motion.div>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground/70">everyone else</span>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <div className="relative h-24 w-16">
          <motion.div
            className="absolute inset-0 origin-bottom"
            initial={{ rotate: 0, x: 0, y: 12, opacity: 0 }}
            animate={{ rotate: -12, x: -13, y: 0, opacity: 1 }}
            transition={{ ...spring, delay: 0.25 }}
          >
            <PlayingCard card={FAN_HOLE[0]} size="md" />
          </motion.div>
          <motion.div
            className="absolute inset-0 origin-bottom"
            initial={{ rotate: 0, x: 0, y: 12, opacity: 0 }}
            animate={{ rotate: 12, x: 13, y: 0, opacity: 1 }}
            transition={{ ...spring, delay: 0.38 }}
          >
            <PlayingCard card={FAN_HOLE[1]} size="md" />
          </motion.div>
        </div>
        <span className="text-[11px] text-muted-foreground/70">you</span>
      </div>
    </div>
  )
}

/* ------------------------------ 3 · the board ----------------------------- */

const BOARD = cards('As', 'Td', '7c', '2h', 'Jd')
const BOARD_BEATS = [400, 1600, 2800] as const
const STREETS = ['The flop', 'The turn', 'The river'] as const

function BoardVisual() {
  const beat = useBeats(BOARD_BEATS)
  const shown = [0, 3, 4, 5][beat]
  useEffect(() => {
    if (beat > 0) playDeal()
  }, [beat])
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex gap-1.5 sm:gap-2">
        {BOARD.map((card, i) =>
          i < shown ? (
            <DealtCard key={i} card={card} index={i < 3 ? i : 0} size="sm" />
          ) : (
            <PlayingCard key={i} size="sm" />
          ),
        )}
      </div>
      <div className="h-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <AnimatePresence mode="wait">
          {beat > 0 && (
            <motion.span
              key={beat}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {STREETS[beat - 1]}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* --------------------------- 4 · making a hand ---------------------------- */

// Seven cards (two yours + the board); `keep` marks the best five by index.
const FIVE_EXAMPLES: { label: string; cards: Card[]; keep: number[] }[] = [
  {
    label: 'A pair of aces',
    cards: cards('Ah', 'Ac', '4d', 'Jd', '7s', '9h', '2c'),
    keep: [0, 1, 3, 4, 5],
  },
  {
    label: 'A flush — five hearts',
    cards: cards('Ah', '9h', 'Kh', 'Jc', '6h', '2h', '8s'),
    keep: [0, 1, 2, 4, 5],
  },
]

function BestFiveVisual() {
  // Four beats: example A flat → lifted, example B flat → lifted, repeat.
  const beat = useLoop(4, 2100)
  const example = FIVE_EXAMPLES[beat < 2 ? 0 : 1]
  const lifted = beat % 2 === 1
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex gap-1 sm:gap-1.5">
        {example.cards.map((card, i) => {
          const keep = example.keep.includes(i)
          return (
            <motion.div
              key={`${example.label}-${i}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{
                opacity: lifted && !keep ? 0.35 : 1,
                y: lifted && keep ? -8 : 0,
              }}
              transition={spring}
            >
              <PlayingCard
                card={card}
                size="sm"
                className={cn('transition-shadow', lifted && keep && 'ring-2 ring-pip')}
              />
            </motion.div>
          )
        })}
      </div>
      <div className="h-5 text-sm font-medium">
        <AnimatePresence mode="wait">
          {lifted && (
            <motion.span
              key={example.label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="block"
            >
              {example.label}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ------------------------- 5 · the ladder of hands ------------------------ */

// Four key rungs, weakest at the bottom — the in-game help dialog owns the
// full list of ten; the tour only teaches the shape of the idea.
const RUNGS = [
  { name: 'High card', cards: cards('Ah', 'Qd', '9s', '6c', '2d') },
  { name: 'One pair', cards: cards('Th', 'Td', 'Ks', '6c', '3d') },
  { name: 'A straight', cards: cards('9c', '8d', '7h', '6s', '5c') },
  { name: 'A flush', cards: cards('Kd', 'Td', '8d', '5d', '2d') },
] as const

function LadderVisual() {
  const active = useLoop(RUNGS.length, 1700)
  return (
    <div className="flex w-full max-w-xs flex-col-reverse gap-1.5">
      {RUNGS.map((rung, i) => (
        <div key={rung.name} className="relative">
          {i === active && (
            <motion.div
              layoutId="rung-glow"
              transition={spring}
              className="absolute inset-0 rounded-xl bg-foreground/[0.06] ring-1 ring-foreground/10"
            />
          )}
          <motion.div
            animate={{ opacity: i === active ? 1 : 0.45 }}
            className="relative flex items-center justify-between gap-3 p-2.5"
          >
            <span className="text-sm font-medium">{rung.name}</span>
            <div className="flex gap-0.5">
              {rung.cards.map((card, j) => (
                <PlayingCard key={j} card={card} size="xs" />
              ))}
            </div>
          </motion.div>
        </div>
      ))}
    </div>
  )
}

/** Page 5's body carries the link to the real in-game reference. */
function LadderBody() {
  const [open, setOpen] = useState(false)
  return (
    <>
      Some hands outrank others: a pair beats a high card, a flush beats a straight. You&rsquo;ll
      learn the rest by losing with them —{' '}
      <button
        onClick={() => {
          sound.play('tap')
          setOpen(true)
        }}
        className="underline underline-offset-2 transition hover:text-foreground"
      >
        the full list
      </button>{' '}
      lives at the table too.
      <HandsHelpDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

/* ----------------------------- 6 · the betting ---------------------------- */

// The five words, in the order a hand meets them, each pointing at its pill.
const WORDS = [
  { word: 'Check', gloss: 'nothing to match — pass, and stay in for free.', slot: 1 },
  { word: 'Bet', gloss: 'put chips in. Now everyone else has a decision.', slot: 2 },
  { word: 'Call', gloss: 'match their bet and stay in the hand.', slot: 1 },
  { word: 'Raise', gloss: 'match it, then bet more on top.', slot: 2 },
  { word: 'Fold', gloss: 'let the hand go. It costs nothing more.', slot: 0 },
] as const

function BettingVisual() {
  const active = useLoop(WORDS.length, 2400)
  const w = WORDS[active]
  // The middle and right pills read like the real ActionBar in each moment.
  const labels = [
    'Fold',
    w.word === 'Call' ? 'Call 50' : 'Check',
    w.word === 'Raise' ? 'Raise' : 'Bet',
  ]
  const tones = [
    'bg-foreground/[0.03] text-muted-foreground',
    'bg-foreground/[0.08] text-foreground',
    'bg-primary text-primary-foreground',
  ]
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6 px-2">
      <div className="flex w-full gap-2">
        {labels.map((label, i) => (
          <motion.div
            key={i}
            animate={{ scale: i === w.slot ? 1.05 : 1, opacity: i === w.slot ? 1 : 0.5 }}
            transition={spring}
            className={cn(
              'flex-1 rounded-2xl py-3.5 text-center text-base font-semibold',
              tones[i],
              i === w.slot && 'ring-2 ring-pip',
            )}
          >
            {label}
          </motion.div>
        ))}
      </div>
      <div className="h-10 max-w-xs text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={w.word}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-sm leading-snug text-muted-foreground"
          >
            <span className="font-semibold text-foreground">{w.word}</span> — {w.gloss}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ---------------------- 7 · the showdown (and the bluff) ------------------ */

const THEIR_HAND = cards('9c', '9d')
const YOUR_HAND = cards('Kh', 'Kd')

function ShowdownVisual() {
  const design = useCardBack()
  // Six beats: showdown (deal → reveal → pot slides) then the bluff replay
  // (deal → they fold → pot slides, cards still hidden. Smugly.)
  const beat = useLoop(6, 1500)
  const bluff = beat >= 3
  const step = beat % 3

  useEffect(() => {
    if (!bluff && step === 1) playDeal()
  }, [bluff, step])

  const theirLabel = step >= 1 ? (bluff ? 'fold' : 'a pair of nines') : ''
  const yourLabel = bluff
    ? step >= 1
      ? 'still your secret'
      : 'you bet 400'
    : step >= 1
      ? 'a pair of kings — yours'
      : ''

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="flex flex-col items-center gap-1.5">
        <motion.div
          animate={{ opacity: bluff && step >= 1 ? 0.3 : 1, y: bluff && step >= 1 ? -6 : 0 }}
          transition={spring}
          className="flex gap-1.5"
        >
          {THEIR_HAND.map((card, i) =>
            bluff ? (
              <CardBack key={i} design={design} size="sm" />
            ) : (
              <FlipCard key={i} card={card} up={step >= 1} />
            ),
          )}
        </motion.div>
        <span className="h-4 text-[11px] text-muted-foreground/70">{theirLabel}</span>
      </div>

      <motion.div animate={{ y: step >= 2 ? 26 : 0 }} transition={spring}>
        <PotPill>the pot · 900</PotPill>
      </motion.div>

      <div className="flex flex-col items-center gap-1.5 pt-4">
        <div className="flex gap-1.5">
          {YOUR_HAND.map((card, i) =>
            bluff ? (
              <CardBack key={i} design={design} size="sm" />
            ) : (
              <FlipCard key={i} card={card} up={step >= 1} />
            ),
          )}
        </div>
        <span className="h-4 text-[11px] text-muted-foreground/70">{yourLabel}</span>
      </div>
    </div>
  )
}

/* ------------------------------ 8 · your Roll ----------------------------- */

function RollVisual() {
  const garage = VENUES[0]
  // Sit down with 200, win the Garage: −100 buy-in, +400 prize.
  const [won, setWon] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setWon(true), 1100)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="flex flex-col items-center gap-5">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="w-44 overflow-hidden rounded-2xl border border-foreground/10"
      >
        <VenueArt id={garage.id} accent={garage.accent} className="aspect-[4/3]" />
      </motion.div>
      <div className="text-center">
        <div className="flex items-baseline justify-center gap-1.5">
          <CountUp
            value={won ? 500 : 200}
            duration={1.1}
            className="text-3xl font-semibold tracking-tight tabular-nums"
          />
          <span className="text-sm font-medium text-muted-foreground">chips</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground/70 tabular-nums">
          buy in 100 · take the table down · win 400
        </p>
      </div>
    </div>
  )
}

/* ------------------------------- the pages -------------------------------- */

export const LESSONS: Lesson[] = [
  {
    id: 'goal',
    title: 'The goal',
    body: (
      <>
        Poker is a contest for the pot — the chips everyone has bet. Win it by holding the best hand
        at the end, or by being the last one still in.
      </>
    ),
    Visual: GoalVisual,
  },
  {
    id: 'hole',
    title: 'Your two cards',
    body: (
      <>
        You&rsquo;re dealt two cards, face down. Only you can see them. Everyone else is guessing —
        that&rsquo;s the game.
      </>
    ),
    Visual: HoleCardsVisual,
  },
  {
    id: 'board',
    title: 'The board',
    body: (
      <>
        Five shared cards land in the middle, in three beats: the flop, the turn, the river. They
        belong to everyone.
      </>
    ),
    Visual: BoardVisual,
  },
  {
    id: 'bestfive',
    title: 'Making a hand',
    body: (
      <>
        Your two cards plus the board make seven. Your hand is the best five of them — the spare two
        don&rsquo;t count.
      </>
    ),
    Visual: BestFiveVisual,
  },
  {
    id: 'ladder',
    title: 'The ladder of hands',
    body: <LadderBody />,
    Visual: LadderVisual,
  },
  {
    id: 'betting',
    title: 'The betting',
    body: (
      <>
        Poker&rsquo;s whole vocabulary is five words: check, bet, call, raise, fold. Two players
        start each hand with small forced bets — the blinds — so there&rsquo;s always something to
        win.
      </>
    ),
    Visual: BettingVisual,
  },
  {
    id: 'showdown',
    title: 'The showdown',
    body: (
      <>
        Reach the end together and it&rsquo;s a showdown — cards up, best hand takes the pot. Or bet
        everyone out, and no one ever sees yours. (You had nothing.)
      </>
    ),
    Visual: ShowdownVisual,
  },
  {
    id: 'roll',
    title: 'Your Roll',
    body: (
      <>
        Your chips are your Roll. Venues are tournaments: the buy-in is your stack, bust and
        you&rsquo;re out, outlast the table and the prize is yours. Start at the Garage — everyone
        does.
      </>
    ),
    Visual: RollVisual,
  },
]

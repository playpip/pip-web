'use client'

// A shared hand, replayed from the URL fragment alone — no server, no account.
// Someone's bad beat (or hero call) arrives as a link and Pip plays it back like
// a highlight reel: the board deals in street by street, the action narrates
// itself, and the outcome lands with a count-up. Every shared hand is the app's
// best advert, so this page is built to convert a non-player — it autoplays,
// pays off, and invites. Works with no profile at all.

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import { DealtCard, PlayingCard } from '@/components/PlayingCard'
import { HandTimeline } from '@/components/HandTimeline'
import { CountUp } from '@/components/CountUp'
import { Splash } from '@/components/Splash'
import { ThemeToggle } from '@/components/ThemeToggle'
import { decodeHand } from '@/lib/handLink'
import { nicknameFor } from '@/config/handNames'
import { useHydrated } from '@/lib/useHydrated'
import { formatChips, useMoney } from '@/lib/useMoney'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import type { HandEvent, HandRecord } from '@/store/game'
import type { Card } from '@/lib/poker/cards'

export default function HandPage() {
  const hydrated = useHydrated()
  // The fragment never reaches the server — decode is client-only by nature.
  const record = useMemo(
    () => (hydrated ? decodeHand(window.location.hash.slice(1)) : null),
    [hydrated],
  )

  if (!hydrated) return <Splash />
  if (!record) return <InvalidLink />
  return <Replay record={record} />
}

/** The cinematic replay: board, hero cards, narration, transport, outcome. */
function Replay({ record }: { record: HandRecord }) {
  const money = useMoney()
  const reduce = useReducedMotion() ?? false
  const total = record.events.length

  // Reduced motion (or an empty hand) shows the whole thing at rest.
  const [step, setStep] = useState(reduce ? total : 0)
  const [playing, setPlaying] = useState(!reduce && total > 0)
  const finished = step >= total
  const chimed = useRef(false)

  // Autoplay: advance a beat at a time, board deals lingering a touch longer so
  // the cards can be admired. The sound plays inside the timer (a real user
  // gesture unlocks audio; before that it's a silent no-op, never an error).
  useEffect(() => {
    if (!playing || step >= total) return
    const next = record.events[step]
    const delay = next?.kind === 'board' ? 1000 : 640
    const t = setTimeout(() => {
      if (next) sound.play(cueFor(next))
      setStep((s) => s + 1)
    }, delay)
    return () => clearTimeout(t)
  }, [playing, step, total, record])

  // The payoff chime — once, when the replay lands on the result.
  useEffect(() => {
    if (finished && total > 0 && !chimed.current) {
      chimed.current = true
      sound.play('win')
    }
  }, [finished, total])

  const restart = () => {
    chimed.current = false
    setStep(0)
    setPlaying(true)
    sound.play('tap')
  }
  const toggle = () => {
    sound.play('tap')
    if (finished) return restart()
    setPlaying((p) => !p)
  }
  const seek = (n: number) => {
    setPlaying(false)
    if (n < total) chimed.current = false
    setStep(n)
    sound.play('tap')
  }

  // The board as of this step: the latest board event already shown is cumulative.
  const shown = record.events.slice(0, step)
  const community = [...shown].reverse().find((e) => e.kind === 'board')?.cards ?? []
  const current = shown[shown.length - 1]

  // The sharer's cards, kept on the felt so the receiver can follow the decisions.
  const heroReveal = record.reveals.find((r) => r.playerId === 'hero')
  const nickname = heroReveal ? nicknameFor(heroReveal.cards) : null
  const outcome = useMemo(() => parseOutcome(record.summary), [record.summary])
  const CardTag = reduce ? PlayingCard : DealtCard

  return (
    <Shell>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <p className="text-center text-[11px] uppercase tracking-[0.25em] text-muted-foreground/60 tabular-nums">
          Hand #{record.handNo} · Blinds {money(record.smallBlind)}/{money(record.bigBlind)}
        </p>

        <OutcomeHeadline outcome={outcome} finished={finished} />

        {/* the board — deals in street by street */}
        <div className="mt-5 flex min-h-[4.75rem] items-center justify-center gap-1.5">
          {community.length > 0 ? (
            community.map((card, i) => <CardTag key={i} index={i} card={card} size="sm" />)
          ) : (
            <span className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground/40">
              Pre-flop
            </span>
          )}
        </div>

        {/* the sharer's hand */}
        {heroReveal && (
          <div className="mt-4 flex flex-col items-center gap-1.5">
            <div className="flex gap-1.5">
              {heroReveal.cards.map((card: Card, i: number) => (
                <PlayingCard key={i} card={card} size="sm" />
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground/70">
              {heroReveal.playerName}
              {nickname && ` · ${nickname}`}
            </span>
          </div>
        )}

        {/* live narration — one line, changes with each beat */}
        <div className="mt-5 flex min-h-6 items-center justify-center px-4 text-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={step}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="text-sm font-medium tabular-nums"
            >
              {narrate(current, formatChips)}
            </motion.p>
          </AnimatePresence>
        </div>

        <Transport
          playing={playing}
          finished={finished}
          step={step}
          total={total}
          onToggle={toggle}
          onSeek={seek}
        />

        {/* the curious can read the whole thing */}
        {total > 0 && (
          <details className="group mt-6 rounded-2xl bg-foreground/[0.03]">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70 transition hover:text-foreground">
              Play-by-play
              <ChevronRight className="size-4 transition group-open:rotate-90" />
            </summary>
            <div className="px-4 pb-4">
              <HandTimeline record={record} />
            </div>
          </details>
        )}
      </div>

      <StickyCta eyebrow="Think you'd have played it differently?" />
    </Shell>
  )
}

/** Big winner + count-up, revealed as the replay lands. */
function OutcomeHeadline({ outcome, finished }: { outcome: Outcome | null; finished: boolean }) {
  return (
    <div className="mt-3 flex min-h-[3.75rem] flex-col items-center justify-center text-center">
      <AnimatePresence mode="wait">
        {finished && outcome ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            {outcome.kind === 'win' ? (
              <>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {outcome.winner} wins{' '}
                  <CountUp
                    value={outcome.amount}
                    duration={0.9}
                    format={formatChips}
                    className="text-pip"
                  />
                </h1>
                {outcome.detail && (
                  <p className="mt-1 text-sm text-muted-foreground">with {outcome.detail}</p>
                )}
              </>
            ) : (
              <h1 className="text-xl font-semibold tracking-tight">{outcome.text}</h1>
            )}
          </motion.div>
        ) : (
          <motion.span
            key="eyebrow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground/50"
          >
            Shared hand
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Play/pause + a seekable segmented track + step nudges. */
function Transport({
  playing,
  finished,
  step,
  total,
  onToggle,
  onSeek,
}: {
  playing: boolean
  finished: boolean
  step: number
  total: number
  onToggle: () => void
  onSeek: (n: number) => void
}) {
  if (total === 0) return null
  return (
    <div className="mt-6 flex flex-col items-center gap-4">
      <div className="flex w-full max-w-xs items-center gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Jump to move ${i + 1}`}
            onClick={() => onSeek(i + 1)}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i < step ? 'bg-pip' : 'bg-foreground/10 hover:bg-foreground/25',
            )}
          />
        ))}
      </div>

      <div className="flex items-center gap-2.5">
        <StepButton
          onClick={() => onSeek(Math.max(0, step - 1))}
          disabled={step === 0}
          aria-label="Back"
        >
          <ChevronLeft className="size-4" />
        </StepButton>

        <button
          type="button"
          onClick={onToggle}
          aria-label={finished ? 'Replay' : playing ? 'Pause' : 'Play'}
          className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/10 transition hover:bg-primary/90 active:scale-95 dark:shadow-black/40"
        >
          {finished ? (
            <RotateCcw className="size-5" />
          ) : playing ? (
            <Pause className="size-5 fill-current" />
          ) : (
            <Play className="size-5 fill-current" />
          )}
        </button>

        <StepButton
          onClick={() => onSeek(Math.min(total, step + 1))}
          disabled={finished}
          aria-label="Next"
        >
          <ChevronRight className="size-4" />
        </StepButton>
      </div>
    </div>
  )
}

/** The invite — always in view, pinned to the bottom over a soft fade. */
function StickyCta({ eyebrow }: { eyebrow: string }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-6 mt-8 bg-gradient-to-t from-background via-background to-transparent px-6 pb-6 pt-10">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-2.5 text-center">
        <p className="text-sm text-muted-foreground">{eyebrow}</p>
        <Link
          href="/"
          onClick={() => sound.play('tap')}
          className="w-full rounded-2xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/10 transition hover:bg-primary/90 active:scale-[0.99] dark:shadow-black/40"
        >
          Play your first hand — free
        </Link>
        <p className="text-[11px] text-muted-foreground/70">
          No account · Runs in your browser · Open source
        </p>
      </div>
    </div>
  )
}

function InvalidLink() {
  return (
    <Shell>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-medium">This link doesn’t hold a hand.</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Hands are shared straight from the table — ask for a fresh link, or deal your own.
        </p>
        <Link
          href="/"
          onClick={() => sound.play('tap')}
          className="mt-1 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
        >
          Play Pip — free, in your browser
        </Link>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-dvh w-full">
      {/* the single accent — a soft pip glow across the top of the page */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(60%_60%_at_50%_-5%,color-mix(in_oklch,var(--color-pip)_26%,transparent),transparent_72%)]" />
      <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 py-6">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-semibold lowercase tracking-tight text-muted-foreground transition hover:text-foreground"
          >
            pip
          </Link>
          <ThemeToggle />
        </div>
        {children}
      </div>
    </div>
  )
}

function StepButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'flex size-10 items-center justify-center rounded-full border border-foreground/10 bg-foreground/[0.03] text-muted-foreground transition hover:bg-foreground/10 active:scale-95 disabled:pointer-events-none disabled:opacity-30',
        className,
      )}
    />
  )
}

// --- narration + outcome parsing ---------------------------------------------

/** The sound cue for the beat about to be revealed. */
function cueFor(ev: HandEvent) {
  if (ev.kind === 'board') return 'deal' as const
  return ev.type
}

/** One line of commentary for the current beat. */
function narrate(ev: HandEvent | undefined, money: (n: number) => string): string {
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
    default:
      return `${ev.playerName} raises to ${money(ev.amount ?? 0)}`
  }
}

type Outcome =
  | { kind: 'win'; winner: string; amount: number; detail?: string }
  | { kind: 'text'; text: string }

/** Split the store's summary ("Alex wins 1,240 with a flush") for the headline. */
function parseOutcome(summary: string): Outcome | null {
  if (!summary) return null
  const m = /^(.+?) wins ([\d,]+)(?: with (.+))?$/.exec(summary)
  if (!m) return { kind: 'text', text: summary }
  return {
    kind: 'win',
    winner: m[1],
    amount: Number(m[2].replace(/,/g, '')),
    detail: m[3],
  }
}

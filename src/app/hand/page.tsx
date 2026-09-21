'use client'

// A shared hand, replayed from the URL fragment alone — no server, no account.
// Someone's bad beat (or hero call) arrives as a link and Pip plays it back like
// a highlight reel: the board deals in street by street, the action narrates
// itself, and the outcome lands with a count-up. Every shared hand is the app's
// best advert, so this page is built to convert a non-player — it autoplays,
// pays off, and invites. Works with no profile at all.

import { useMemo } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { DealtCard, PlayingCard } from '@/components/PlayingCard'
import { HandTimeline } from '@/components/HandTimeline'
import { CountUp } from '@/components/CountUp'
import { Splash } from '@/components/Splash'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Transport } from '@/components/replay/Transport'
import {
  narrate,
  parseOutcome,
  useFinishChime,
  useReplay,
  type Outcome,
} from '@/components/replay/useReplay'
import { decodeHand } from '@/lib/handLink'
import { nicknameFor } from '@/config/handNames'
import { useHydrated } from '@/lib/useHydrated'
import { formatChips, useMoney } from '@/lib/useMoney'
import { sound } from '@/lib/sound'
import type { HandRecord } from '@/store/game'
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
  // A shared hand is a highlight reel: it opens at the top of the hand and
  // plays itself in. The session review opens the same machinery at the end of
  // the hand instead, because somebody who clicked hand 14 wants to see hand 14
  // rather than watch it arrive.
  const replay = useReplay(record, { autoplay: true, opens: 'start' })
  const { step, total, finished, community, current, reduce } = replay
  useFinishChime(finished, total)

  // The sharer's cards, kept on the felt so the receiver can follow the decisions.
  const heroReveal = record.reveals.find((r) => r.playerId === 'hero')
  const nickname = heroReveal ? nicknameFor(heroReveal.cards) : null
  const outcome = useMemo(() => parseOutcome(record.summary), [record.summary])
  const CardTag = reduce ? PlayingCard : DealtCard

  return (
    <Shell>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <p className="text-center text-2xs uppercase tracking-[0.25em] text-muted-foreground/60 tabular-nums">
          Hand #{record.handNo} · Blinds {money(record.smallBlind)}/{money(record.bigBlind)}
        </p>

        <OutcomeHeadline outcome={outcome} finished={finished} />

        {/* the board — deals in street by street */}
        <div className="mt-5 flex min-h-[4.75rem] items-center justify-center gap-1.5">
          {community.length > 0 ? (
            community.map((card, i) => <CardTag key={i} index={i} card={card} size="sm" />)
          ) : (
            <span className="text-2xs uppercase tracking-[0.3em] text-muted-foreground/40">
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
            <span className="text-2xs text-muted-foreground/70">
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

        <Transport replay={replay} className="mt-6" />

        {/* the curious can read the whole thing */}
        {total > 0 && (
          <details className="group mt-6 rounded-2xl bg-foreground/[0.03]">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-2xs uppercase tracking-[0.2em] text-muted-foreground/70 transition hover:text-foreground">
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
            className="text-2xs uppercase tracking-[0.3em] text-muted-foreground/50"
          >
            Shared hand
          </motion.span>
        )}
      </AnimatePresence>
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
        <p className="text-2xs text-muted-foreground/70">
          Free · Runs in your browser · Open source
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

'use client'

// A shared hand, replayed from the URL fragment alone — no server, no account.
// Someone's bad beat arrives as a link; Pip plays it back. Every shared hand
// is a quiet demo of the app, so the page works with no profile at all.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PlayingCard } from '@/components/PlayingCard'
import { HandTimeline } from '@/components/HandTimeline'
import { Splash } from '@/components/Splash'
import { ThemeToggle } from '@/components/ThemeToggle'
import { decodeHand } from '@/lib/handLink'
import { nicknameFor } from '@/config/handNames'
import { useHydrated } from '@/lib/useHydrated'
import { useMoney } from '@/lib/useMoney'
import { cn } from '@/lib/utils'
import type { Card } from '@/lib/poker/cards'

export default function HandPage() {
  const hydrated = useHydrated()
  // The fragment never reaches the server — decode is client-only by nature.
  const record = useMemo(
    () => (hydrated ? decodeHand(window.location.hash.slice(1)) : null),
    [hydrated],
  )
  const [step, setStep] = useState(0)
  const money = useMoney()

  if (!hydrated) return <Splash />

  if (!record) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-lg font-medium">This link doesn’t hold a hand.</p>
          <p className="text-sm text-muted-foreground">
            Hands are shared straight from the table — ask for a fresh link.
          </p>
          <PlayCta />
        </div>
      </Shell>
    )
  }

  const total = record.events.length
  const done = step >= total

  // The board as of this step: the latest board event already shown.
  const shown = record.events.slice(0, step)
  const community = [...shown].reverse().find((e) => e.kind === 'board')?.cards ?? []

  // The sharer's cards are known from the reveals — keep them on the felt so
  // the receiver can follow the decisions.
  const heroReveal = record.reveals.find((r) => r.playerId === 'hero')
  const nickname = heroReveal ? nicknameFor(heroReveal.cards) : null

  return (
    <Shell>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 pb-8">
        <div className="text-center">
          <h1 className="text-lg font-semibold">Shared hand</h1>
          <p className="text-xs text-muted-foreground tabular-nums">
            Hand #{record.handNo} · Blinds {money(record.smallBlind)}/{money(record.bigBlind)}
          </p>
        </div>

        {/* the board */}
        <div className="flex min-h-20 items-center justify-center gap-2">
          {community.length > 0 ? (
            community.map((card, i) => <PlayingCard key={i} card={card} size="sm" />)
          ) : (
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/60">
              Preflop
            </span>
          )}
        </div>

        {/* the sharer's hand */}
        {heroReveal && (
          <div className="flex flex-col items-center gap-1">
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

        {/* the story so far */}
        <div className="flex min-h-40 flex-1 flex-col gap-1 rounded-2xl bg-foreground/[0.03] p-4">
          {step === 0 ? (
            <p className="m-auto text-sm text-muted-foreground">
              Step through the hand as it was played.
            </p>
          ) : (
            <HandTimeline record={record} limit={step} />
          )}
        </div>

        {/* controls */}
        <div className="flex items-center justify-center gap-3">
          <StepButton
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            aria-label="Back"
          >
            <ChevronLeft className="size-4" />
          </StepButton>
          <span className="w-16 text-center text-xs text-muted-foreground tabular-nums">
            {Math.min(step, total)} / {total}
          </span>
          <StepButton
            disabled={done}
            onClick={() => setStep((s) => Math.min(total, s + 1))}
            aria-label="Next"
            primary
          >
            <ChevronRight className="size-4" />
          </StepButton>
        </div>

        <div className="flex justify-center pt-2">
          <PlayCta />
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
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
  )
}

function PlayCta() {
  return (
    <Link
      href="/"
      className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
    >
      Play Pip — free, in your browser
    </Link>
  )
}

function StepButton({
  primary = false,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      {...props}
      className={cn(
        'flex size-10 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-30',
        primary
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'border border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:bg-foreground/10',
        className,
      )}
    />
  )
}

'use client'

// The Pip Rating sheet (docs/rating.md), opened from the line under the Roll.
// Everyone: the rating, peak, band, how it works, and the leaderboard. Signed
// in: "Hide me from the leaderboard". Members: the graph and what is moving it.
// Free players: one quiet line to the membership.

import { useEffect } from 'react'
import Link from 'next/link'
import { ChevronRight, Trophy } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { ToggleRow } from '@/components/settings/ToggleRow'
import { membershipFor } from '@/config/membership'
import { trackOnce } from '@/lib/analytics'
import { devMember, devSignedIn } from '@/lib/multiplayer/client'
import {
  bandFor,
  EXPERIENCE_CAPS,
  isCapped,
  isProvisional,
  kindCosts,
  PROVISIONAL_DECISIONS,
  type RatingKind,
  ratingOf,
} from '@/lib/rating'
import { sendRating } from '@/lib/rating/rate'
import { sound } from '@/lib/sound'
import { useEntitlement } from '@/store/entitlement'
import { useProfile } from '@/store/profile'
import { useSync } from '@/store/sync'
import { RatingHistory } from './RatingHistory'

const KIND_LABELS: Record<RatingKind, string> = {
  'preflop-call': 'Calls before the flop',
  'preflop-fold': 'Folds before the flop',
  'flop-call': 'Calls on the flop',
  'flop-fold': 'Folds on the flop',
  'turn-call': 'Calls on the turn',
  'turn-fold': 'Folds on the turn',
  'river-call': 'Calls on the river',
  'river-fold': 'Folds on the river',
  'preflop-open': 'Opening when it folds to you',
  'preflop-shove': 'Short-stack shoves and folds',
}

export function RatingSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent onClose={() => onOpenChange(false)} title="Pip Rating">
        <Body />
      </SheetContent>
    </Sheet>
  )
}

function Body() {
  // `devMember` is local development only, as on the multiplayer hub.
  const member = useEntitlement() || devMember()
  const rating = useProfile((s) => s.rating)
  const setRating = useProfile((s) => s.setRating)
  const signedIn = useSync((s) => s.status === 'signed-in') || devSignedIn()
  const ready = useSync((s) => s.ready) || devSignedIn()

  useEffect(() => trackOnce('rating-sheet-opened'), [])

  const value = ratingOf(rating.core)
  const decisions = rating.core.decisions
  const provisional = isProvisional(decisions)
  const left = PROVISIONAL_DECISIONS - decisions
  const costs = kindCosts(rating.core).slice(0, 4)
  // Held under a band until enough decisions are in (EXPERIENCE_CAPS).
  const nextCap = isCapped(rating.core)
    ? EXPERIENCE_CAPS.find((c) => decisions < c.before)
    : undefined

  return (
    <div className="flex flex-col gap-5 pb-1">
      <div className="relative flex flex-col items-center pt-1 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-32"
          style={{
            background:
              'radial-gradient(45% 40% at 50% 45%, color-mix(in oklab, var(--color-pip) 22%, transparent), transparent 75%)',
          }}
        />
        <p className="relative text-6xl font-semibold tracking-tight tabular-nums">
          {value.toLocaleString('en-GB')}
        </p>
        <p className="relative mt-1 text-sm font-medium">{bandFor(value)}</p>
        <p className="relative mt-1 text-sm text-muted-foreground">
          {provisional
            ? `Provisional. Rated after ${left} more ${left === 1 ? 'hand' : 'hands'}.`
            : nextCap
              ? `Your play is past ${bandFor(value)}. ${bandFor(nextCap.cap + 1)} opens after ${(nextCap.before - decisions).toLocaleString('en-GB')} more decisions.`
              : rating.peak
                ? `Peak ${rating.peak.toLocaleString('en-GB')} · ${decisions.toLocaleString('en-GB')} decisions`
                : `${decisions.toLocaleString('en-GB')} decisions`}
        </p>
      </div>

      <div className="rounded-2xl bg-foreground/[0.03] p-4 text-sm leading-relaxed text-muted-foreground">
        Your rating comes from your decisions at a Hold’em table: every call and fold facing a bet,
        and your first move when it folds to you, checked against the opening and short-stack
        charts. Each is marked by how much it gave away against the best choice, from the cards you
        could see. Winning or losing the hand does not change it. Recent hands count most, and the
        top bands open only after enough decisions.
      </div>

      {member ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Your rating by day</h3>
          <RatingHistory points={rating.history} />
          <h3 className="mt-1 text-sm font-semibold">What is moving it</h3>
          {costs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing is costing you points yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-foreground/[0.06] rounded-2xl bg-foreground/[0.03]">
              {costs.map((c) => (
                <li key={c.kind} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>{KIND_LABELS[c.kind]}</span>
                  <span className="font-medium tabular-nums text-suit-red">−{c.points}</span>
                </li>
              ))}
            </ul>
          )}
          {costs.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Points you would gain if those decisions gave nothing away.
            </p>
          )}
        </section>
      ) : (
        <Link
          href={membershipFor('rating')}
          onClick={() => sound.play('tap')}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Members see their rating by day and what is moving it.
        </Link>
      )}

      {ready && signedIn && (
        <div className="rounded-2xl bg-foreground/[0.03] p-4">
          <ToggleRow
            label="Hide me from the leaderboard"
            hint="Your rating still counts. Nobody else sees it."
            checked={rating.hidden}
            onChange={() => {
              sound.play('tap')
              setRating({ ...rating, hidden: !rating.hidden })
              void sendRating()
            }}
          />
        </div>
      )}

      <Link
        href="/game/leaderboard"
        onClick={() => sound.play('tap')}
        className="flex min-h-12 items-center gap-3 rounded-2xl border border-foreground/10 px-4 text-sm font-medium transition hover:bg-foreground/[0.05] active:scale-[0.99]"
      >
        <Trophy className="size-4 text-muted-foreground" aria-hidden />
        <span className="flex-1">Leaderboard</span>
        <ChevronRight className="size-4 text-muted-foreground/70" aria-hidden />
      </Link>
      {ready && !signedIn && (
        <p className="-mt-2 text-center text-xs text-muted-foreground">
          <Link href="/game?account=new" className="underline underline-offset-4">
            Make an account to join the leaderboard
          </Link>
        </p>
      )}
    </div>
  )
}

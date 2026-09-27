'use client'

/**
 * The route around the session review: who it is for, and what it says when
 * there is nothing to show.
 *
 * Three states, and the two that are not the review matter more than they look:
 *
 * - **Not a member.** The page still exists and still explains itself, with a
 *   padlock and one text link — the same shape `CoachReport` uses, and the same
 *   reason: you cannot buy what you cannot see, and an app that silently
 *   rearranges itself the day somebody joins is worse product.
 * - **Nothing to review.** Says so, and says what to do about it. A paid screen
 *   that renders nothing is the worst thing on the list and the easiest one to
 *   ship by accident.
 *
 * The entitlement check lives here rather than at the table, where asking would
 * break the rule that nothing in the game loop knows about money
 * (`tests/membershipSurfaces.test.ts`). The table is told at sit-down whether
 * to offer the button; this page is what answers for the link.
 */

import { useMemo } from 'react'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { SectionScreen } from '@/components/menu/SectionScreen'
import { useRequireProfile } from '@/components/menu/useRequireProfile'
import { Splash } from '@/components/Splash'
import { ReviewTable } from './ReviewTable'
import { useEntitlement, useMembership } from '@/store/entitlement'
import { loadReview } from '@/lib/review/session'

export function ReviewScreen() {
  const ready = useRequireProfile()
  const member = useEntitlement()
  // Whether a real answer about the membership has come back yet. For anybody
  // signed out that is immediate; for anybody with an account it is a network
  // round-trip, and against the current build a round-trip to a table that has
  // not been created — so it can take seconds.
  const settled = useMembership((state) => state.checked)
  // The session is finished by the time anybody is looking at it, so there is
  // nothing to subscribe to — one read, once the browser is there.
  const session = useMemo(() => (ready ? loadReview() : null), [ready])

  // The only thing worth a blank screen is the profile, which comes out of
  // localStorage and is there in the same frame.
  //
  // **The membership is not.** This used to hold the whole screen on the boot
  // splash until `checked` landed, which meant standing up from a table and
  // watching a spinner for as long as Supabase took to answer (Will,
  // 2026-09-21). The page draws immediately now and only the part that depends
  // on the answer waits for it.
  if (!ready) return <Splash />

  if (!member) {
    return (
      <SectionScreen
        title="Session review"
        subtitle="Every hand of the session you just played, back on the felt, with what the price says about the calls you made."
      >
        <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5">
          {settled ? (
            <>
              <p className="flex items-center gap-2 font-medium">
                <Lock className="size-4" /> Session review comes with the membership.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                The read on each hand as you finish it stays free and always will — this is the same
                arithmetic, kept for the whole session and laid out hand by hand.{' '}
                <Link
                  href="/membership"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  What the membership is
                </Link>
                .
              </p>
            </>
          ) : (
            // Only ever seen by somebody with an account, for as long as their
            // row takes. A member must not be told this is not theirs before
            // anybody has asked, so the sentence claims nothing either way.
            <p className="text-sm text-muted-foreground">Checking your membership…</p>
          )}
        </div>
      </SectionScreen>
    )
  }

  if (!session || session.hands.length === 0) {
    return (
      <SectionScreen
        title="Session review"
        subtitle="Every hand of the session you just played, back on the felt."
      >
        <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5">
          <p className="font-medium">Nothing to review yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Play a few hands on the ladder, at the Rail or in the Daily, and this fills up. One
            session is kept at a time — the next table you sit down at replaces it.
          </p>
          <Link
            href="/game"
            className="mt-3 inline-block text-sm underline underline-offset-4 hover:text-foreground"
          >
            Find a table
          </Link>
        </div>
      </SectionScreen>
    )
  }

  return <ReviewTable session={session} />
}

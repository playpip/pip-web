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

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { SectionScreen } from '@/components/menu/SectionScreen'
import { useRequireProfile } from '@/components/menu/useRequireProfile'
import { Splash } from '@/components/Splash'
import { ReviewTable } from './ReviewTable'
import { useEntitlement, useMembership } from '@/store/entitlement'
import { loadReview } from '@/lib/review/session'
import { captureRoomView, loadRoomReview } from '@/lib/multiplayer/review'
import { devMember } from '@/lib/multiplayer/client'
import { membershipFor } from '@/config/membership'
import { useRoom } from '@/store/room'
import { useSlowGames, useSlowGamesLive } from '@/store/slowGames'

export function ReviewScreen() {
  const ready = useRequireProfile()
  // A dev token's member flag counts locally, as it does at the tables.
  const member = useEntitlement() || devMember()
  // Whether a real answer about the membership has come back yet. For anybody
  // signed out that is immediate; for anybody with an account it is a network
  // round-trip, and against the current build a round-trip to a table that has
  // not been created — so it can take seconds.
  const settled = useMembership((state) => state.checked)
  // `?room=CODE` is a multiplayer game's review (lib/multiplayer/review);
  // without it, the last solo session. A query string, read off `location`
  // rather than `useSearchParams`, so the page needs no Suspense boundary.
  const room = useMemo(
    () => (ready ? new URLSearchParams(window.location.search).get('room') : null),
    [ready],
  )
  // A slow game you are in can still have hands this device never kept (a
  // game opened only now and then). Its room still holds the last few, so
  // the review sits down at it, as opening the table would, to fetch them.
  // Asked for here too: a review opened from a link or the stats page has not
  // been through Home, where the list is usually fetched.
  useSlowGamesLive(Boolean(room) && member)
  const slowGame = useSlowGames((s) => (room ? s.games.some((g) => g.code === room) : false))
  const listFresh = useSlowGames((s) => s.fresh)
  const roomView = useRoom((s) => (room && s.view?.code === room ? s.view : null))
  useEffect(() => {
    if (!room || !slowGame || !member) return
    const already = useRoom.getState().code === room
    if (!already) useRoom.getState().enter(room)
    return () => {
      if (!already) useRoom.getState().exit()
    }
  }, [room, slowGame, member])
  // A solo session is finished by the time anybody is looking at it, so there
  // is nothing to subscribe to — one read, once the browser is there. A room
  // is read again as its views arrive; keeping them first is idempotent.
  const session = useMemo(() => {
    if (!ready) return null
    if (!room) return loadReview()
    if (roomView) captureRoomView(roomView)
    return loadRoomReview(room)
  }, [ready, room, roomView])

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
                  href={membershipFor('review')}
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
          <p className="font-medium">
            {room && ((slowGame && !roomView) || (!slowGame && !listFresh))
              ? 'Fetching the hands…'
              : 'Nothing to review yet'}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {room
              ? 'Hands from a multiplayer game are kept on this device as they finish. Once one has been played to the end here, it shows up.'
              : 'Play a few hands on the ladder, at the Rail or in the Daily, and this fills up. One session is kept at a time — the next table you sit down at replaces it.'}
          </p>
          <Link
            href={room ? '/game/multiplayer' : '/game'}
            className="mt-3 inline-block text-sm underline underline-offset-4 hover:text-foreground"
          >
            {room ? 'Back to multiplayer' : 'Find a table'}
          </Link>
        </div>
      </SectionScreen>
    )
  }

  return <ReviewTable session={session} />
}

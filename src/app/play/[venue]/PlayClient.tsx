'use client'

import { useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Table } from '@/components/table/Table'
import { Splash } from '@/components/Splash'
import { useProfile } from '@/store/profile'
import { useGame, loadTableSnapshot } from '@/store/game'
import { featureForVenue, venueById } from '@/config/venues'
import { membershipFor } from '@/config/membership'
import { CUSTOM_VENUE_ID, customVenue, refuseCustomTable } from '@/config/customTable'
import { refuseSitDown } from '@/lib/sitDown'
import { deviceId } from '@/lib/sync/client'
import { dailyDateKey } from '@/lib/daily'
import { useMembership } from '@/store/entitlement'
import { ensurePlayer } from '@/components/onboarding/firstSeat'

export function PlayClient() {
  const { venue: venueId } = useParams<{ venue: string }>()
  const router = useRouter()
  // Keyed by venue id: navigating table → table (e.g. busted → freeroll) reuses
  // this component, so a plain boolean would block the second sit-down.
  const started = useRef<string | null>(null)
  // Readiness is derived from the game store (external), so no in-effect setState.
  const activeVenue = useGame((s) => s.venue)
  // Both, not just `member`: `checked` is what says a real answer arrived, from
  // the server or from this device's cache. Reading `member` alone would have
  // this component decide "no" during the frame before the row lands, which is
  // a member being turned away from the table they pay for every time their
  // connection is slow.
  const member = useMembership((s) => s.member)
  const memberChecked = useMembership((s) => s.checked)

  useEffect(() => {
    // Nothing about a member room can be decided yet, so decide nothing — and
    // in particular do not mark this venue started, or the re-run that arrives
    // with the answer will return before it can seat anybody. Every other table
    // is unaffected and still resolves on the first pass.
    if ((venueById(venueId)?.membersOnly || venueId === CUSTOM_VENUE_ID) && !memberChecked) return

    if (started.current === venueId) return
    started.current = venueId

    // A first visit arrives here with no player: make one and deal them in
    // (onboarding/firstSeat). Anything this table refuses below still sends
    // them on, with the player made.
    ensurePlayer()
    const profile = useProfile.getState()
    // `/play/custom` is one generated route standing in for every table a
    // player can build, so the real venue is resolved here from the spec on
    // their profile. The spec is client-written and re-checked on the way in:
    // a hand-edited blob is a trip back to the builder, not a 40-seat table.
    const venue =
      venueId === CUSTOM_VENUE_ID
        ? profile.customTable && !refuseCustomTable(profile.customTable)
          ? customVenue(profile.customTable)
          : undefined
        : venueById(venueId)

    if (!venue || !profile.avatar) {
      router.replace(venueId === CUSTOM_VENUE_ID ? '/game/custom' : '/')
      return
    }

    // An interrupted table (hard refresh) resumes — the buy-in was already paid.
    const snapshot = loadTableSnapshot()
    if (snapshot && snapshot.venueId === venueId) {
      useGame.getState().resumeTable(venue, snapshot, member)
      return
    }

    // The Daily is once a day — played (or abandoned) means done till tomorrow.
    if (venue.daily && profile.daily?.date === dailyDateKey()) {
      router.replace('/game')
      return
    }

    // The same question the card on the lobby answered, asked of the same
    // function, so a table the app offered is a table the route seats you at
    // (lib/sitDown). A challenge goes back to the Rail it was offered on; a
    // member table goes to `/membership` opened on that game, the same answer
    // its tile on the shelf gives (the side tables if it maps to nothing);
    // everything else to the home screen, which is where the Roll is.
    const refusal = refuseSitDown(venue, profile, deviceId(), member)
    if (refusal) {
      const feature = featureForVenue(venue)
      const back =
        refusal === 'not-your-challenge'
          ? '/game'
          : refusal === 'members-only'
            ? feature
              ? membershipFor(feature)
              : '/game/side'
            : '/'
      router.replace(back)
      return
    }

    // Membership is handed to the table here rather than read inside it: the
    // game loop deliberately knows nothing about entitlement (see store/game).
    useGame.getState().sitDown(venue, {
      name: profile.name,
      avatar: profile.avatar,
      member,
    })
  }, [venueId, router, member, memberChecked])

  if (activeVenue?.id !== venueId) return <Splash />
  return <Table />
}

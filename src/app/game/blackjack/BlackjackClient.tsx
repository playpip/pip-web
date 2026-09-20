'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Splash } from '@/components/Splash'
import { BlackjackTable } from '@/components/blackjack/BlackjackTable'
import { HOUSE_RULES, type HouseRules } from '@/lib/blackjack/rules'
import { isOfferedStack, resumeBlackjack } from '@/lib/blackjack/session'
import { useProfile } from '@/store/profile'
import { useMembership } from '@/store/entitlement'

/**
 * Sitting down at blackjack, and picking up a session that was interrupted.
 *
 * **Its own route rather than `/play/[venue]`.** That route drives the poker
 * game store — seats, blinds, a button that moves — and blackjack has none of
 * it. Registering a blackjack table as a `Venue` would have put a game with no
 * opponents through `ALL_VENUES`, the AI banding tests and the winner-take-all
 * prize formula, and every one of those would have needed an exception saying
 * "except this one". Two doors is cheaper than one door with a hole in it.
 *
 * **The buy-in leaves the Roll here and comes back at the table's cash-out**,
 * one to one. The session is written to the profile before the chips move, so
 * a refresh between the two finds a table rather than a hole where the chips
 * were.
 */
export function BlackjackClient() {
  const router = useRouter()
  const params = useSearchParams()
  const [seated, setSeated] = useState<{
    rules: HouseRules
    boughtIn: number
    stack: number
  } | null>(null)
  // Sitting down spends chips, so it happens exactly once per mount no matter
  // how many times this effect re-runs.
  const paid = useRef(false)
  const member = useMembership((s) => s.member)
  const memberChecked = useMembership((s) => s.checked)

  useEffect(() => {
    // Nothing can be decided until the entitlement row lands, and deciding "no"
    // in the meantime turns a member away from the table they pay for.
    if (!memberChecked) return
    if (paid.current) return

    const profile = useProfile.getState()
    if (!profile.created) {
      router.replace('/')
      return
    }

    // An interrupted session resumes, and it resumes before the membership is
    // checked against, because those chips are already the player's — standing
    // them up is the only honest thing to do with a stack you are holding.
    const open = resumeBlackjack(profile.blackjack)
    if (open) {
      paid.current = true
      setSeated({ rules: open.rules, boughtIn: open.boughtIn, stack: open.stack })
      return
    }

    if (!member) {
      router.replace('/game/side')
      return
    }

    const rules = HOUSE_RULES.find((r) => r.id === params.get('table'))
    const stack = Number(params.get('stack'))
    // Both come off a link, so both are re-checked: a hand-typed URL is a trip
    // back to the shelf rather than a table of its own invention.
    if (!rules || !isOfferedStack(stack) || profile.roll < stack) {
      router.replace('/game/side')
      return
    }

    paid.current = true
    // The session is recorded first. If the write and the debit could happen
    // in the other order, the gap between them is a refresh that has taken the
    // chips and left no table.
    profile.setBlackjack({ table: rules.id, stack, boughtIn: stack })
    profile.adjustRoll(-stack)
    setSeated({ rules, boughtIn: stack, stack })
  }, [params, router, member, memberChecked])

  if (!seated) return <Splash />
  return (
    <BlackjackTable rules={seated.rules} boughtIn={seated.boughtIn} initialStack={seated.stack} />
  )
}

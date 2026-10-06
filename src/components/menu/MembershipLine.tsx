'use client'

// The membership, named once on the lobby (Will, cto#138: "we don't make it
// obvious enough there is a membership"). Before this the lobby never said it
// existed: a player met it only by tapping a padlock, or two taps into
// Settings.
//
// Furniture under the room shelf, on the same terms as the account offer
// (docs/membership.md, invited versus uninvited): on the screen the player is
// already on, never over anything, no dismissal because there is nothing to
// dismiss, and counting nothing. A text link, not a button: the loudest thing
// on the lobby stays a table you could sit at.
//
// Renders nothing until the membership store has a real answer, so a member
// never watches it flash past on load, and nothing in a build that cannot sell.

import Link from 'next/link'
import { checkoutReady } from '@/config/membership'
import { useMembership } from '@/store/entitlement'
import { sound } from '@/lib/sound'

export function MembershipLine() {
  const show = useMembership((s) => s.checked && !s.member)
  if (!checkoutReady() || !show) return null

  return (
    <p className="px-1 text-center text-xs leading-relaxed text-muted-foreground md:text-sm">
      Pip has a membership. It adds the side tables, the other games, the drills that price a hand
      and the lessons past Level 1. The ladder stays free either way.{' '}
      <Link
        href="/membership"
        onClick={() => sound.play('tap')}
        className="font-medium text-foreground underline underline-offset-2"
      >
        What it adds
      </Link>
    </p>
  )
}

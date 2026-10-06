'use client'

// The membership, named once on the lobby (Will, cto#138: "we don't make it
// obvious enough there is a membership"). Before this the lobby never said it
// existed: a player met it only by tapping a padlock, or two taps into
// Settings.
//
// A card under the Ladder, the same weight as the account offer under the Roll
// (Will, pip-web#193), with a small fan of the members' backs borrowed from the
// membership page's hero so the two read as the same thing. Furniture on the
// same terms as that offer (docs/membership.md, invited versus uninvited): on
// the screen the player is already on, never over anything, no dismissal
// because there is nothing to dismiss, and counting nothing. Outlined, never
// filled: the loudest thing on the lobby stays a table you could sit at.
//
// Renders nothing until the membership store has a real answer, so a member
// never watches it flash past on load, and nothing in a build that cannot sell.

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Star } from 'lucide-react'
import { CardBack } from '@/components/CardBack'
import { MEMBER_BACKS, MEMBER_SHOP_BACKS } from '@/config/cardBacks'
import { checkoutReady } from '@/config/membership'
import { useMembership } from '@/store/entitlement'
import { sound } from '@/lib/sound'

/** Three of the page hero's five, so the card and the page look related. */
const FAN = [MEMBER_SHOP_BACKS[0], MEMBER_BACKS[0], MEMBER_SHOP_BACKS[1]]

export function MembershipCard({ delay = 0 }: { delay?: number }) {
  const show = useMembership((s) => s.checked && !s.member)
  if (!checkoutReady() || !show) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
      className="w-full"
    >
      <Link
        href="/membership"
        onClick={() => sound.play('tap')}
        className="group relative isolate flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4 transition hover:border-foreground/25 hover:bg-foreground/[0.05] active:scale-[0.99] md:gap-6 md:p-5"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 top-1/2 -z-10 size-64 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--color-pip)_18%,transparent),transparent_65%)] blur-2xl"
        />
        <div aria-hidden className="relative h-16 w-20 shrink-0 md:h-20 md:w-24">
          {FAN.map((design, i) => {
            const offset = i - 1
            return (
              <div
                key={design.id}
                className="absolute bottom-0 left-1/2 origin-bottom"
                style={{
                  zIndex: 10 - Math.abs(offset),
                  transform: `translateX(calc(-50% + ${offset * 1.1}rem)) translateY(${Math.abs(offset) * 3}px) rotate(${offset * 10}deg)`,
                }}
              >
                <CardBack design={design} size="sm" className="shadow-lg shadow-black/30" />
              </div>
            )
          })}
        </div>

        <div className="min-w-0 flex-1 text-left">
          <span className="inline-flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
            <Star className="size-3 fill-pip text-pip" />
            Pip Membership
          </span>
          <p className="mt-1 text-sm leading-relaxed">
            The side tables, the other games, the drills that price a hand and the lessons past
            Level 1. The ladder stays free either way.
          </p>
          <span className="mt-2 inline-block text-sm font-medium underline-offset-2 group-hover:underline">
            What it adds
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

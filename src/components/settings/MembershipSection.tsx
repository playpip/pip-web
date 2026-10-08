'use client'

// Settings → Membership. The row `HOW_TO_CANCEL` names on /membership, so it has
// to exist wherever that sentence is true: Manage, then Stripe's portal, then
// cancel.
//
// A member gets the portal. A payment that failed gets the portal with the
// reason said plainly. Anybody else gets one quiet link to the page that
// explains the membership — and not even that at a table, because Settings
// opens over a hand in progress and a line about money there is the thing
// docs/membership.md promises never happens.

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { checkoutReady } from '@/config/membership'
import { type BillingError, openPortal } from '@/lib/membership/billing'
import { isTableRoute } from '@/lib/textScale'
import { useMembership } from '@/store/entitlement'
import { useInApp } from '@/lib/useInApp'
import { useSync } from '@/store/sync'
import { sound } from '@/lib/sound'

const button =
  'flex min-h-11 w-full items-center justify-center rounded-xl bg-foreground/[0.06] py-3 text-sm font-medium transition hover:bg-foreground/[0.12] disabled:opacity-60'

function endsOn(periodEnd: number | null): string {
  if (!periodEnd) return 'the end of the period'
  return new Date(periodEnd).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function MembershipSection() {
  const pathname = usePathname()
  const signedIn = useSync((s) => s.status === 'signed-in')
  const syncOff = useSync((s) => s.status === 'off')
  const { member, status, periodEnd, cancelAtPeriodEnd } = useMembership()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<BillingError | null>(null)
  const app = useInApp()

  if (!checkoutReady() || syncOff) return null
  const failed = status === 'past_due' || status === 'unpaid'
  const hasBilling = signedIn && (member || failed)
  if (!hasBilling && isTableRoute(pathname)) return null

  const manage = async () => {
    sound.play('tap')
    setBusy(true)
    setError(null)
    const result = await openPortal()
    if (!result.ok) {
      setBusy(false)
      setError(result.error)
    }
  }

  return (
    <div>
      <p className="mb-2.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">Membership</p>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        {member
          ? cancelAtPeriodEnd
            ? `Cancelled. You stay a member until ${endsOn(periodEnd)}, and nothing more is charged.`
            : `You’re a member. It renews on ${endsOn(periodEnd)}.`
          : failed
            ? 'Your last payment didn’t go through, so the membership is paused until it does.'
            : 'The side tables, the other games, the drills that price a hand and the lessons past Level 1.'}
      </p>

      {/* No Manage in the store apps: the portal is Stripe's, and the stores
          reject a link out to other billing (see Join in MembershipScreen). */}
      {hasBilling && app ? null : hasBilling ? (
        <button disabled={busy} onClick={() => void manage()} className={button}>
          {failed ? 'Update payment details' : 'Manage'}
        </button>
      ) : (
        <Link href="/membership" onClick={() => sound.play('tap')} className={button}>
          What the membership is
        </Link>
      )}

      {error && (
        <p className="mt-2 text-xs leading-relaxed text-suit-red">
          {error === 'unavailable'
            ? 'Couldn’t reach Stripe just now. Try again in a moment.'
            : 'Couldn’t open the portal. Sign out and back in, then try again.'}
        </p>
      )}
    </div>
  )
}

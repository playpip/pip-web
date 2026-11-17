'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Star } from 'lucide-react'
import { tappedFeature } from '@/config/membership'
import { trackOnce } from '@/lib/analytics'
import { awaitMembership } from '@/lib/membership/billing'
import { FIRST_CHECKS, LATE_CHECKS } from '@/lib/membership/pollRow'
import { sound } from '@/lib/sound'
import { useHydrated } from '@/lib/useHydrated'
import { cn } from '@/lib/utils'
import { useEntitlement } from '@/store/entitlement'
import { useSync } from '@/store/sync'

const primaryButton =
  'flex h-14 w-full items-center justify-center gap-1.5 rounded-2xl bg-primary text-base font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]'
const quietButton =
  'flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-foreground/[0.07] text-sm font-semibold transition hover:bg-foreground/[0.12]'

/**
 * Back from Stripe. Nothing here grants anything: arriving only changes what
 * the page says while the membership row is fetched, and `member` still comes
 * from the table the client cannot write.
 */
export function MemberWelcome() {
  const hydrated = useHydrated()
  const ready = useSync((s) => s.ready)
  const signedIn = useSync((s) => s.status === 'signed-in')
  const member = useEntitlement()
  const [slow, setSlow] = useState(false)
  // What was tapped before checkout, if anything, so the welcome can point at it.
  const tapped = hydrated ? tappedFeature(window.location.search) : null

  useEffect(() => {
    // Stripe only sends a player here after the payment went through, so this
    // counts completed checkouts, and the next one counts the row arriving.
    trackOnce('checkout-completed')
    let live = true
    const stillHere = () => live
    void (async () => {
      let ok = await awaitMembership(FIRST_CHECKS, stillHere)
      if (!ok && live) {
        // A slow webhook still lands: keep asking, so the page turns to
        // "You're a member" by itself and the funnel counts it.
        setSlow(true)
        ok = await awaitMembership(LATE_CHECKS, stillHere)
      }
      if (ok) trackOnce('membership-active')
    })()
    return () => {
      live = false
    }
  }, [])

  let status: React.ReactNode
  if (!ready) {
    status = (
      <div aria-busy className="h-14 w-full animate-pulse rounded-2xl bg-foreground/[0.05]" />
    )
  } else if (member) {
    status = (
      <div className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[color-mix(in_oklch,var(--color-pip)_14%,transparent)] text-base font-semibold">
        <Star className="size-4 fill-pip text-pip" />
        You’re a member
      </div>
    )
  } else if (signedIn) {
    status = (
      <>
        <div className="flex h-14 w-full items-center justify-center rounded-2xl bg-foreground/[0.07] text-base font-semibold text-muted-foreground">
          {slow ? 'Still confirming with Stripe' : 'Confirming your payment…'}
        </div>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {slow
            ? 'Stripe has your payment and is still telling us. It usually lands within a minute, and this page will change when it does. If it hasn’t after a few minutes, write to hello@playpip.io and we will sort it out.'
            : 'Stripe is telling us it went through. This takes a few seconds.'}
        </p>
      </>
    )
  } else {
    status = (
      <p className="text-center text-sm text-muted-foreground">
        Sign in with the account you joined with to use your membership.
      </p>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-14">
      <h1 className="text-center text-3xl font-semibold tracking-tight">Welcome in</h1>
      <p className="mt-2 text-center text-muted-foreground">Thanks for joining Pip.</p>
      <div className="mt-8">{status}</div>
      <div className="mt-6 flex flex-col gap-3">
        {tapped?.place && (
          <Link
            href={tapped.place.href}
            onClick={() => sound.play('tap')}
            className={primaryButton}
          >
            Go to {tapped.place.name}
            <ChevronRight className="size-4" />
          </Link>
        )}
        <Link
          href="/game"
          onClick={() => sound.play('tap')}
          className={cn(tapped?.place ? quietButton : primaryButton)}
        >
          Continue to the lobby
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </main>
  )
}

'use client'

// The membership, in a sheet over the welcome flow's last step (2026-11-04).
// "See membership plans" used to go to `/membership`, which took a player out
// of onboarding for good: in the week to 1 November 2 of 69 tapped it. The
// sheet has the plans, the two pillars and the same till as the page
// (`Join.tsx`), so joining from here is joining from there, account first and
// then straight on to checkout. Closing it leaves the step as it was.

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Sparkles, TrendingUp, Users } from 'lucide-react'
import { PAYING_LINES, type Plan, PlanPicker, Till } from '@/components/membership/Join'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { type CurrencyCode, MEMBERSHIP_PILLARS, sellableFeatures } from '@/config/membership'
import type { ShownPrice } from '@/lib/membership/store'
import { sound } from '@/lib/sound'
import { useInApp } from '@/lib/useInApp'

const PILLAR_ICONS: Record<(typeof MEMBERSHIP_PILLARS)[number]['id'], typeof Users> = {
  better: TrendingUp,
  multiplayer: Users,
}
const PILLAR_TINTS: Record<(typeof MEMBERSHIP_PILLARS)[number]['id'], string> = {
  better: '#4FB477',
  multiplayer: '#F0B44C',
}

export function MembershipSheet({
  open,
  onOpenChange,
  price,
  currency,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  price: ShownPrice
  currency: CurrencyCode
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        onClose={() => onOpenChange(false)}
        title={
          <>
            <Sparkles className="size-5 text-pip" />
            Pip membership
          </>
        }
      >
        <Body price={price} currency={currency} />
      </SheetContent>
    </Sheet>
  )
}

/** Mounted while open, so each opening starts on Yearly, as the page does. */
function Body({ price, currency }: { price: ShownPrice; currency: CurrencyCode }) {
  const [plan, setPlan] = useState<Plan>('annual')
  const app = useInApp()
  const sellable = new Set(sellableFeatures().map((f) => f.id))
  // A pillar shows if anything in it is for sale, as on the page.
  const pillars = MEMBERSHIP_PILLARS.filter((p) => p.ids.some((id) => sellable.has(id)))

  return (
    <>
      <ul className="flex flex-col gap-2.5">
        {pillars.map((pillar) => {
          const Icon = PILLAR_ICONS[pillar.id]
          return (
            <li
              key={pillar.id}
              className="flex items-start gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-3.5"
            >
              <span
                aria-hidden
                className="grid size-10 shrink-0 place-items-center rounded-xl text-white shadow-sm"
                style={{ backgroundColor: PILLAR_TINTS[pillar.id] }}
              >
                <Icon className="size-5" strokeWidth={2.25} />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{pillar.title}</span>
                <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                  {pillar.lede}
                </span>
              </span>
            </li>
          )
        })}
      </ul>

      <div className="mt-5">
        <PlanPicker price={price} plan={plan} onPlan={setPlan} />
      </div>
      <Till plan={plan} price={price} currency={currency} className="mt-2" />

      <ul className="mt-4 flex flex-col gap-1.5 border-t border-foreground/[0.07] px-1 pt-4 text-xs leading-relaxed text-muted-foreground">
        {PAYING_LINES[app ? 'app' : 'web'].map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <Link
        href="/membership?from=welcome"
        onClick={() => sound.play('tap')}
        className="mt-3 flex min-h-11 items-center justify-center gap-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        Everything in the membership
        <ChevronRight className="size-4" />
      </Link>
    </>
  )
}

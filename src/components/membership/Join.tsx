'use client'

// Joining, shared by the membership page and the welcome flow's plans sheet
// (2026-11-04): the plan picker, and the till that turns a pick into a
// membership. One copy, so the page and the sheet cannot drift on what joining
// asks, says or counts.
//
// The till is the page's, unchanged: signed out it offers an account first and
// carries straight on to checkout once there is one; signed in it is Stripe; a
// member gets the portal; in the store app it is the store. Its funnel events
// are counted here, so a join from the sheet counts as one from the page
// (docs/membership.md, Counting the funnel).

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import { Check, ChevronRight, Lock, Star } from 'lucide-react'
import {
  type CurrencyCode,
  MEMBERSHIP_PRICE_IDS,
  SELLER,
  checkoutReady,
  tappedFeature,
} from '@/config/membership'
import { AccountDialog, type AccountMode } from '@/components/settings/AccountDialog'
import { trackOnce } from '@/lib/analytics'
import { type BillingError, openPortal, startCheckout } from '@/lib/membership/billing'
import { useEntitlement, useMembership } from '@/store/entitlement'
import { useSync } from '@/store/sync'
import { useHydrated } from '@/lib/useHydrated'
import { useInApp } from '@/lib/useInApp'
import { appPlatform, appSupports } from '@/lib/nativeApp'
import {
  buyInStore,
  MANAGE_IN_STORE,
  restoreFromStore,
  type StoreResult,
  useMembershipSource,
  type ShownPrice,
  useStorePrices,
} from '@/lib/membership/store'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

const SPRING = { type: 'spring', stiffness: 420, damping: 30 } as const

/** In the store app, before the store's prices arrive. */
export const STORE_LOADING: ShownPrice = {
  monthly: '…',
  annual: '…',
  monthlyMinor: 0,
  annualMinor: 0,
}

/** The price every till shows: the store's in the app, else the website's in `currency`. */
export function useTillPrice(website: ShownPrice): ShownPrice {
  const storeSells = useInApp() && appSupports('purchase')
  const store = useStorePrices(storeSells)
  return storeSells ? (store ?? STORE_LOADING) : website
}

/** How the price is paid and how it stops, on the web and in the store app. */
export const PAYING_LINES = {
  web: [
    'Tax is inside the price, and the price is fixed in your currency: the number here is the number that leaves your bank.',
    'Renews until you stop it. Cancel any time, from Settings, in two clicks.',
  ],
  app: [
    'Paid through the store, in your own currency, with tax included.',
    'Renews until you stop it. Cancel any time in your store’s subscription settings.',
  ],
} as const

// --- plans ----------------------------------------------------------------------

export type Plan = 'annual' | 'monthly'

export const PLAN_ORDER: readonly Plan[] = ['annual', 'monthly']

/** The two plans in one currency. The sums come from minor units, never the display strings. */
export function plansIn(
  price: ShownPrice,
): Record<Plan, { name: string; price: string; per: string; note: string }> {
  const saving = price.monthlyMinor * 12 - price.annualMinor
  const perMonth = Math.round(price.annualMinor / 12)
  const { format } = price
  return {
    annual: {
      name: 'Yearly',
      price: price.annual,
      per: 'a year',
      // Left out when the numbers aren't known (an older app build sends only
      // the store's price labels), rather than worked out from a string.
      note:
        format && saving > 0
          ? `${format(perMonth)} a month, near enough: ${format(saving)} less than paying monthly for twelve months.`
          : 'One payment a year.',
    },
    monthly: {
      name: 'Monthly',
      price: price.monthly,
      per: 'a month',
      note: 'Pay as you go. Stop whenever you like and it runs to the end of the month.',
    },
  }
}

/** Yearly or monthly, as two cards; the selection is a ring and a tick. */
export function PlanPicker({
  price,
  plan,
  onPlan,
}: {
  price: ShownPrice
  plan: Plan
  onPlan: (next: Plan) => void
}) {
  const PLANS = plansIn(price)
  const pick = (next: Plan) => {
    if (next === plan) return
    sound.play('tap')
    onPlan(next)
  }
  return (
    <>
      <div role="radiogroup" aria-label="Billing" className="grid grid-cols-2 gap-2.5">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id]
          const on = plan === id
          return (
            <motion.button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(id)}
              whileTap={{ scale: 0.97 }}
              transition={SPRING}
              className={cn(
                'relative flex flex-col rounded-2xl border p-4 text-left transition-colors',
                on
                  ? 'border-foreground/60 bg-foreground/[0.07] ring-1 ring-foreground/60'
                  : 'border-foreground/10 bg-foreground/[0.03] hover:border-foreground/25',
              )}
            >
              <span className="flex items-center justify-between">
                <span className="font-semibold">{p.name}</span>
                <span
                  className={cn(
                    'grid size-6 place-items-center rounded-full border transition-colors',
                    on
                      ? 'border-transparent bg-primary text-primary-foreground'
                      : 'border-foreground/20',
                  )}
                >
                  {on && (
                    <motion.span
                      initial={{ scale: 0.4 }}
                      animate={{ scale: 1 }}
                      transition={SPRING}
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </motion.span>
                  )}
                </span>
              </span>
              {/* In the app the store's prices replace "…" after the first
                  paint, and iOS WebKit repainted only the old, narrower
                  number: a new price is a new element, painted whole. */}
              <span key={p.price} className="mt-3 flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-3xl font-semibold tabular-nums tracking-tight">
                  {p.price}
                </span>
                <span className="text-sm text-muted-foreground">{p.per}</span>
              </span>
            </motion.button>
          )
        })}
      </div>
      <p className="mt-3 min-h-10 px-1 text-center text-sm leading-relaxed text-balance text-muted-foreground">
        {PLANS[plan].note}
      </p>
    </>
  )
}

/**
 * The box with the Join button, or the closed till in a build without
 * checkout. `membership-join-seen` is half of it in view.
 */
export function Till({
  plan,
  price,
  currency,
  className,
}: {
  plan: Plan
  price: ShownPrice
  currency: CurrencyCode
  className?: string
}) {
  const ready = checkoutReady()
  // Between the page view and checkout the funnel was blind: a tab that never
  // scrolled this far and one that read the till and left counted the same.
  const till = useRef<HTMLDivElement>(null)
  const tillSeen = useInView(till, { once: true, amount: 0.5 })
  useEffect(() => {
    if (tillSeen) trackOnce('membership-join-seen')
  }, [tillSeen])
  return (
    <div ref={till} className={className}>
      {ready ? (
        <Join plan={plan} planName={plansIn(price)[plan].name} currency={currency} />
      ) : (
        <>
          <div
            aria-disabled
            className="flex h-14 w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-foreground/[0.07] text-base font-semibold text-muted-foreground"
          >
            <Lock className="size-4" />
            Checkout isn’t open yet
          </div>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            <strong className="font-medium text-foreground">Nobody has paid us anything.</strong>{' '}
            Everything in the membership is built and behind the membership check. The till is not:
            there is no card form and no way to give us money yet.
          </p>
        </>
      )}
    </div>
  )
}

// --- joining ------------------------------------------------------------------

const joinButton =
  'flex h-14 w-full items-center justify-center gap-1.5 rounded-2xl bg-primary text-base font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60'
const quietButton =
  'flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-foreground/[0.07] text-sm font-semibold transition hover:bg-foreground/[0.12] disabled:opacity-60'

const BILLING_ERRORS: Record<BillingError, string> = {
  'signed-out': 'Your session ran out. Sign in again and it will pick up from here.',
  'already-a-member':
    'This account already has a membership. Manage it below rather than starting a second one.',
  'no-membership': 'There is no membership on this account to manage.',
  unavailable: 'Couldn’t reach the till just now. Nothing was charged, so try again in a moment.',
}

function endsOn(periodEnd: number | null): string {
  if (!periodEnd) return ''
  return new Date(periodEnd).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * The till. Three states, in the order a player meets them: signed out (an
 * account first — a membership has to belong to somebody), signed in (off to
 * Stripe), and a member (the portal). Back from Stripe is /membership/welcome
 * (see the redirect in `MembershipScreen`).
 */
export function Join({
  plan,
  planName,
  currency,
}: {
  plan: Plan
  planName: string
  currency: CurrencyCode
}) {
  const hydrated = useHydrated()
  const ready = useSync((s) => s.ready)
  const signedIn = useSync((s) => s.status === 'signed-in')
  const signedOut = useSync((s) => s.status === 'signed-out')
  const member = useEntitlement()
  const checked = useMembership((s) => s.checked)
  const memberStatus = useMembership((s) => s.status)
  const periodEnd = useMembership((s) => s.periodEnd)
  const leaving = useMembership((s) => s.cancelAtPeriodEnd)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<BillingError | null>(null)
  const [account, setAccount] = useState<AccountMode | null>(null)
  // Set when the player opened the account form from here: they came to join,
  // so once they are signed in the checkout opens without a second tap.
  const [joinAfterAccount, setJoinAfterAccount] = useState(false)
  const app = useInApp()
  const source = useMembershipSource()

  // Read after hydration only: the static page has no query string to read.
  const joined = hydrated && new URLSearchParams(window.location.search).has('joined')
  // What was tapped to get here, if anything: sent to checkout.
  const tapped = hydrated ? tappedFeature(window.location.search) : null

  // A signed-out tab meets the account form before it can reach checkout, so
  // without these "did not want it" and "stopped at the account step" read the
  // same. Counts only; `ready` keeps the placeholder signed-out from firing it.
  useEffect(() => {
    if (ready && signedOut && !joined) trackOnce('membership-viewed-signed-out')
  }, [ready, signedOut, joined])

  const run = async (action: () => Promise<{ ok: true } | { ok: false; error: BillingError }>) => {
    sound.play('tap')
    setBusy(true)
    setError(null)
    const result = await action()
    // On success the page is navigating away; leave the button busy so it
    // cannot be pressed twice on the way out.
    if (!result.ok) {
      setBusy(false)
      setError(result.error)
    }
  }

  const pay = () => {
    // Pressed-join minus checkout-opened is the tabs the till stopped.
    trackOnce('membership-join-tapped')
    const priceId = MEMBERSHIP_PRICE_IDS[plan]
    if (priceId) void run(() => startCheckout(priceId, currency, tapped?.id))
  }

  // Back from the account form signed in, and not already a member: on to the
  // checkout they set out for. Waits for the membership row (`checked`) so a
  // returning member who signed in is shown the portal instead.
  useEffect(() => {
    if (!joinAfterAccount || !signedIn || !checked || app) return
    setJoinAfterAccount(false)
    setAccount(null)
    if (!member) pay()
  })

  let body: React.ReactNode
  // Nothing until the answer is real. Before the stored session is restored,
  // `status` reads signed-out as a placeholder, so a player back from paying
  // would be offered "Create a free account", and a member would be offered
  // Join for the frame before their row arrives. A quiet box instead.
  if (!ready || (signedIn && !checked && !member)) {
    body = <div aria-busy className="h-14 w-full animate-pulse rounded-2xl bg-foreground/[0.05]" />
  } else if (app && (member || memberStatus === 'past_due' || memberStatus === 'unpaid')) {
    // In the store app nothing leads to Stripe: Apple and Google reject a link
    // out to other billing. A membership bought in the app is managed in the
    // store; one bought on the web is shown, and managed on the web.
    const manage = source ? MANAGE_IN_STORE[source] : undefined
    body = (
      <>
        {member ? (
          <>
            <div className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[color-mix(in_oklch,var(--color-pip)_14%,transparent)] text-base font-semibold">
              <Star className="size-4 fill-pip text-pip" />
              You’re a member
            </div>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              {leaving
                ? `Cancelled. You stay a member until ${endsOn(periodEnd)}.`
                : `Renews on ${endsOn(periodEnd)}.`}
            </p>
          </>
        ) : (
          <p className="text-center text-sm">
            <strong className="font-medium">Your last payment didn’t go through.</strong> The
            membership is paused until it does.
          </p>
        )}
        {manage && (
          <a href={manage.href} className={cn(quietButton, 'mt-3')}>
            {manage.label}
          </a>
        )}
      </>
    )
  } else if (app && !appSupports('purchase')) {
    // An app build without the store set up, or an older one.
    body = (
      <div className="flex h-14 w-full items-center justify-center rounded-2xl bg-foreground/[0.07] text-base font-semibold text-muted-foreground">
        Joining in the app is coming soon
      </div>
    )
  } else if (app && signedIn) {
    body = <StoreJoin plan={plan} planName={planName} />
  } else if (member) {
    body = (
      <>
        <div className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[color-mix(in_oklch,var(--color-pip)_14%,transparent)] text-base font-semibold">
          <Star className="size-4 fill-pip text-pip" />
          You’re a member
        </div>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {leaving
            ? `Cancelled. You stay a member until ${endsOn(periodEnd)}, and nothing more is charged.`
            : `Renews on ${endsOn(periodEnd)}. Cancel, change card or get an invoice from the portal.`}
        </p>
        <button
          disabled={busy}
          onClick={() => void run(openPortal)}
          className={cn(quietButton, 'mt-3')}
        >
          Manage membership
        </button>
      </>
    )
  } else if (memberStatus === 'past_due' || memberStatus === 'unpaid') {
    body = (
      <>
        <p className="mb-3 text-center text-sm">
          <strong className="font-medium">Your last payment didn’t go through.</strong> The
          membership is paused until it does. Nothing else about your profile has changed.
        </p>
        <button disabled={busy} onClick={() => void run(openPortal)} className={joinButton}>
          Update payment details
        </button>
      </>
    )
  } else if (signedIn) {
    body = (
      <>
        <button disabled={busy} onClick={pay} className={joinButton}>
          {busy ? 'Opening checkout…' : `Join ${planName.toLowerCase()}`}
          {!busy && <ChevronRight className="size-4" />}
        </button>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Changed your mind within 14 days? Email us for a full refund. Joining means you agree to
          the{' '}
          {/* Said here, not on Stripe's page: Checkout's own terms consent
              points at the shared account's terms, which are Ava's, not Pip's. */}
          <Link
            href="/terms"
            className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
          >
            terms
          </Link>
          .
        </p>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Payment is taken by Stripe on their own page, and we never see your card. You are buying
          from {SELLER.name}, who make Pip; it shows on your statement as{' '}
          <span className="whitespace-nowrap font-medium text-foreground">{SELLER.statement}</span>.
        </p>
      </>
    )
  } else {
    body = (
      <>
        <button
          onClick={() => {
            sound.play('tap')
            trackOnce('membership-signup-tapped')
            setJoinAfterAccount(true)
            setAccount('signup')
          }}
          className={joinButton}
        >
          Create a free account to join
          <ChevronRight className="size-4" />
        </button>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          A membership has to belong to someone. Already have an account?{' '}
          <button
            onClick={() => {
              sound.play('tap')
              setJoinAfterAccount(true)
              setAccount('signin')
            }}
            className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
          >
            Sign in
          </button>
          .
        </p>
      </>
    )
  }

  return (
    <>
      {body}
      {error && <p className="mt-3 text-center text-sm text-suit-red">{BILLING_ERRORS[error]}</p>}
      <AccountDialog
        open={account !== null}
        mode={account ?? 'signup'}
        onOpenChange={(o) => {
          if (o) return
          setAccount(null)
          // Closed without signing in: they backed out, so no checkout later.
          if (!signedIn) setJoinAfterAccount(false)
        }}
      />
    </>
  )
}

/**
 * Joining in the store app: the store's own price and sheet, then the same
 * wait for the row a returning Stripe checkout does. Apple asks for the plan,
 * its length, its price, how it renews and links to the terms and the privacy
 * policy on this screen, so all of it is here.
 */
function StoreJoin({ plan, planName }: { plan: Plan; planName: string }) {
  const prices = useStorePrices(true)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const store = appPlatform() === 'android' ? 'Google Play' : 'the App Store'
  const price = prices ? (plan === 'annual' ? prices.annual : prices.monthly) : null

  const act = async (action: () => Promise<StoreResult>, pending: string) => {
    sound.play('tap')
    setBusy(true)
    setNote(null)
    const result = await action()
    setBusy(false)
    if (result.ok && !result.member) setNote(pending)
    if (!result.ok && 'error' in result) setNote(result.error)
  }

  return (
    <>
      <button
        disabled={busy || !price}
        onClick={() => {
          // The same count as the web's Join, so an app sale is not a checkout
          // that nobody tapped.
          trackOnce('membership-join-tapped')
          void act(
            () => buyInStore(plan),
            `${store === 'Google Play' ? 'Google Play' : 'The App Store'} has your payment. It can take a minute to show here.`,
          )
        }}
        className={joinButton}
      >
        {busy
          ? 'Waiting for the store…'
          : price
            ? `Join ${planName.toLowerCase()} · ${price}`
            : 'Loading the store’s prices…'}
        {!busy && price && <ChevronRight className="size-4" />}
      </button>
      {note && <p className="mt-3 text-center text-sm text-muted-foreground">{note}</p>}
      <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
        {plan === 'annual' ? 'Billed yearly' : 'Billed monthly'} through {store}. It renews
        automatically until you cancel in your{' '}
        {store === 'Google Play' ? 'Google Play' : 'App Store'} settings, at least a day before the
        period ends.{' '}
        <Link href="/terms" className="underline underline-offset-2">
          Terms
        </Link>{' '}
        ·{' '}
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy
        </Link>
      </p>
      <button
        disabled={busy}
        onClick={() => void act(restoreFromStore, 'Nothing to restore on this account.')}
        className={cn(quietButton, 'mt-3')}
      >
        Restore purchases
      </button>
    </>
  )
}

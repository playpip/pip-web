'use client'

// The membership page, as a screen rather than a document.
//
// **Every claim here still comes out of `config/membership.ts`.** The page used
// to be prose on `LegalPage` and the reason it was careful survives the
// redesign: a sales page listing a thing that does not exist is the failure the
// `shipped` flag is there to stop, so the features are rendered from
// `sellableFeatures()` and the unbuilt ones from the same list, never typed out
// here. What this file adds is only *how* each one looks — a painting, an icon
// — keyed by feature id. A feature with no visual still renders (as a plain
// row), so shipping one never needs this file to notice.
//
// **The shape (Will, 2026-11-02).** In the week to 1 November 28 tabs opened
// this page, 2 scrolled as far as Join and none pressed it. It listed seventeen
// things over twelve sections with no headline. Now: the headline with the
// price and Join beside it; what was tapped, if anything; two pillars,
// `MEMBERSHIP_PILLARS` ("Get better", "Play with friends, no limits"); every
// other feature as one compact list; free against member, row by row; then the
// questions. Each feature is said once.
//
// **The art is `data-mirror="skip"`.** The markdown mirror
// (scripts/gen-llms.mjs) reads `<main>`, and a painting is nothing to a reader
// that cannot see it. Every sentence stays outside them.
//
// **No `<table>`**: the mirror's Turndown pass has shipped a broken one before.
// The free-versus-member comparison is a grid of rows.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MotionConfig, motion, useInView } from 'framer-motion'
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChartSpline,
  Eye,
  Flame,
  GraduationCap,
  Hand,
  Lock,
  History,
  Minus,
  Palette,
  ShieldCheck,
  Smile,
  Spade,
  Sparkles,
  Star,
  Target,
  TrendingUp,
} from 'lucide-react'
import { Reveal } from '@/components/Reveal'
import { CategoryArt } from '@/components/menu/CategoryArt'
import { VenueArt } from '@/components/menu/VenueArt'
import { TappedFor } from '@/components/membership/TappedFor'
import { MultiplayerSpotlight } from '@/components/membership/MultiplayerSpotlight'
import {
  CURRENCIES,
  type CurrencyCode,
  DAILY_FREE_GAME,
  HOW_TO_CANCEL,
  MEMBERSHIP_FEATURES,
  MEMBERSHIP_PILLARS,
  MEMBERSHIP_PRICE_IDS,
  MEMBERSHIP_PRICES,
  MEMBERSHIP_PROMISES,
  SELLER,
  type MembershipFeature,
  checkoutReady,
  formatPrice,
  sellableFeatures,
  tappedFeature,
} from '@/config/membership'
import { AccountDialog, type AccountMode } from '@/components/settings/AccountDialog'
import { trackOnce } from '@/lib/analytics'
import { type BillingError, openPortal, startCheckout } from '@/lib/membership/billing'
import { comparisonRows } from '@/lib/membership/compare'
import { detectCurrency } from '@/lib/membership/currency'
import { FREE_REPORT_COPY } from '@/lib/membership/freeReport'
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

// --- how each feature looks -----------------------------------------------------

/** A painting for the things you sit down at. The paintings are the venues' own. */
const ART: Record<string, { art: string; accent: string; category?: boolean }> = {
  'side-tables': { art: 'redeye', accent: '#E06D8C' },
  rooms: { art: 'deepstack-750', accent: '#B5835A' },
  omaha: { art: 'bigpot', accent: '#5B7FC7' },
  shortdeck: { art: 'chopshop', accent: '#D95F43' },
  hilo: { art: 'vault', accent: '#4FB477' },
  draw: { art: 'allnighter', accent: '#8F6FE8' },
  blackjack: { art: 'casino', accent: '#C9873D' },
  'custom-tables': { art: 'custom', accent: '#8A8F98', category: true },
}

/** An iOS settings-row icon for everything else. */
const ICONS: Record<string, { icon: typeof Target; tint: string }> = {
  'daily-reward': { icon: Flame, tint: '#FF8A3D' },
  lessons: { icon: GraduationCap, tint: '#3FA7B8' },
  drills: { icon: Target, tint: '#5B7FC7' },
  river: { icon: Spade, tint: '#C9873D' },
  progress: { icon: ChartSpline, tint: '#E06D8C' },
  coaching: { icon: TrendingUp, tint: '#4FB477' },
  review: { icon: History, tint: '#D95F43' },
  'god-view': { icon: Eye, tint: '#8F6FE8' },
  avatar: { icon: Smile, tint: '#E0A23D' },
  cosmetics: { icon: Palette, tint: '#9A7FD1' },
}

const MULTIPLAYER_ID = 'multiplayer'

const iconFor = (id: string) => ICONS[id] ?? { icon: Sparkles, tint: '#7C8CF0' }

const SPRING = { type: 'spring', stiffness: 420, damping: 30 } as const

/**
 * The currency the page shows prices in.
 *
 * Pounds until hydration — the static HTML and the markdown mirror are the
 * same page for everybody — then the browser's best guess, until the picker
 * says otherwise. Derived rather than set in an effect (docs/development.md).
 */
function useCurrency() {
  const hydrated = useHydrated()
  const [picked, setPicked] = useState<CurrencyCode | null>(null)
  const detected: CurrencyCode = hydrated
    ? detectCurrency(
        navigator.languages?.length ? navigator.languages : [navigator.language],
        Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
      )
    : 'GBP'
  return [picked ?? detected, setPicked] as const
}

/** In the store app, before the store's prices arrive. */
const STORE_LOADING: ShownPrice = { monthly: '…', annual: '…', monthlyMinor: 0, annualMinor: 0 }

// --- the screen -----------------------------------------------------------------

export function MembershipScreen() {
  const router = useRouter()
  // Stripe's success URL is `?joined=1`. Pass it on to the welcome, replacing
  // this entry so neither back control leads to Checkout again.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('joined')) {
      router.replace(`/membership/welcome${window.location.search}`)
    }
  }, [router])
  const sellable = sellableFeatures()
  const pillars = MEMBERSHIP_PILLARS.map((pillar) => ({
    ...pillar,
    features: pillar.ids
      .map((id) => sellable.find((f) => f.id === id))
      .filter((f): f is MembershipFeature => Boolean(f)),
  })).filter((pillar) => pillar.features.length > 0)
  const inPillar = new Set<string>(MEMBERSHIP_PILLARS.flatMap((p) => p.ids))
  // Anything shipped and not in a pillar lands in the list below them, so a
  // new feature is on the page the moment it is marked shipped.
  const rest = sellable.filter((f) => !inPillar.has(f.id))
  const multiplayer = sellable.some((f) => f.id === MULTIPLAYER_ID)
  const coming = MEMBERSHIP_FEATURES.filter((f) => !f.shipped)
  const [currency, setCurrency] = useCurrency()
  // In the store app with purchases on, every price on the page is the store's,
  // in the player's own App Store currency, and there is no currency picker:
  // the store decides. Everywhere else it is the website's price in the picked
  // currency, exactly as before.
  const app = useInApp()
  const storeSells = app && appSupports('purchase')
  const store = useStorePrices(storeSells)
  const price: ShownPrice = storeSells
    ? (store ?? STORE_LOADING)
    : { ...MEMBERSHIP_PRICES[currency], format: (minor) => formatPrice(minor, currency) }

  // First step of the funnel. The page view is counted anyway; this one is
  // once per tab, so it lines up with the three steps after it.
  useEffect(() => trackOnce('membership-viewed'), [])

  // A link to a section (`/membership#plans` from the welcome flow) opens on
  // it, at once: the page scrolls smoothly, and a smooth scroll on arrival can
  // be cut short as the page settles.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <main className="flex-1 overflow-x-clip">
        <Hero multiplayer={multiplayer}>
          <Plans
            price={price}
            currency={currency}
            onCurrency={storeSells ? undefined : setCurrency}
          />
        </Hero>

        <TappedFor price={price} />

        <div className="mx-auto w-full max-w-6xl px-4 md:px-10">
          {pillars.map((pillar) => (
            <Section key={pillar.id} id={pillar.id} title={pillar.title}>
              {pillar.id === 'multiplayer' ? (
                <MultiplayerSpotlight feature={pillar.features[0]} />
              ) : (
                <PillarGrid features={pillar.features} />
              )}
            </Section>
          ))}

          {rest.length > 0 && (
            <Section id="more" title="And the rest of it">
              <MoreList features={rest} />
            </Section>
          )}

          <Section id="free" title="Free or member">
            <Compare price={price} />
          </Section>

          <Section id="questions" title="Questions">
            <Questions coming={coming} />
          </Section>
        </div>
      </main>
    </MotionConfig>
  )
}

// --- hero -----------------------------------------------------------------------

/**
 * The headline, with the price and Join beside it (under it on a phone). The
 * price came up under the headline on 2 November 2026 (#283); now Join is on
 * the first screen too, because almost no tab scrolled down to it.
 */
function Hero({ multiplayer, children }: { multiplayer: boolean; children: React.ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/4 top-0 -z-10 size-[44rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--color-pip)_20%,transparent),transparent_65%)] blur-2xl"
      />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 pb-6 pt-8 md:grid-cols-[1fr_minmax(0,28rem)] md:gap-12 md:px-10 md:pb-12 md:pt-16">
        {/* CSS rather than Framer, so the headline is in the static HTML at
            full opacity and does not wait for hydration (globals.css). */}
        <div
          className="rise-in flex flex-col items-start"
          style={{ '--rise-delay': '0.05s' } as React.CSSProperties}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/[0.04] px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Star className="size-3 fill-pip text-pip" />
            Pip Membership
          </span>
          <h1 className="mt-4 text-balance text-[2.1rem] font-semibold leading-tight tracking-tight md:text-6xl">
            Get better at poker.{' '}
            <span className="block text-muted-foreground">
              {multiplayer ? 'Play with friends, no limits.' : 'Find out what is costing you.'}
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
            {MEMBERSHIP_PILLARS.filter((p) => multiplayer || p.id !== 'multiplayer')
              .map((p) => p.lede)
              .join(' ')}{' '}
            The core game stays free, for good.
          </p>
        </div>
        <div id="plans" className="scroll-mt-24">
          {children}
        </div>
      </div>
    </section>
  )
}

// --- a section ------------------------------------------------------------------

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 pt-14 md:pt-20">
      <Reveal>
        <h2 className="text-2xl font-semibold tracking-tight md:text-4xl">{title}</h2>
      </Reveal>
      <div className="mt-6 md:mt-8">{children}</div>
    </section>
  )
}

// --- the pillars ----------------------------------------------------------------

/** "Get better": one card each, the report first because it is the one tapped most. */
function PillarGrid({ features }: { features: MembershipFeature[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 md:gap-4">
      {features.map((feature, i) => {
        const { icon: Icon, tint } = iconFor(feature.id)
        return (
          <Reveal key={feature.id} delay={Math.min(i * 0.05, 0.15)}>
            <article className="relative h-full overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/[0.03] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(0,0,0,0.4)] md:p-6">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full opacity-25 blur-2xl"
                style={{ backgroundColor: tint }}
              />
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-sm"
                  style={{ backgroundColor: tint }}
                >
                  <Icon className="size-5" strokeWidth={2.25} />
                </span>
                <h3 className="text-lg font-semibold tracking-tight">{feature.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{feature.blurb}</p>
              {feature.id === 'coaching' && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-pip/[0.12] px-3 py-1 text-xs font-medium text-foreground">
                  <Sparkles className="size-3 text-pip" />
                  {FREE_REPORT_COPY.offer}
                </p>
              )}
            </article>
          </Reveal>
        )
      })}
    </div>
  )
}

// --- everything else ------------------------------------------------------------

/**
 * Every other feature, one row each: a picture and a name, and the blurb a tap
 * away. `<details>` so it opens without JavaScript and the mirror reads it.
 */
function MoreList({ features }: { features: MembershipFeature[] }) {
  return (
    <Reveal>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <li key={feature.id}>
            <details className="group h-full rounded-2xl border border-foreground/10 bg-foreground/[0.03] transition-colors open:bg-foreground/[0.05] hover:border-foreground/20">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-2.5 pr-4 [&::-webkit-details-marker]:hidden">
                <Thumb id={feature.id} />
                <span className="min-w-0 flex-1 text-sm font-semibold leading-snug">
                  {feature.title}
                </span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="px-4 pb-4 pt-1 text-sm leading-relaxed text-muted-foreground">
                {feature.blurb}
              </p>
            </details>
          </li>
        ))}
      </ul>
    </Reveal>
  )
}

function Thumb({ id }: { id: string }) {
  const art = ART[id]
  if (art) {
    return (
      <span
        data-mirror="skip"
        aria-hidden
        className="relative size-11 shrink-0 overflow-hidden rounded-xl shadow-sm ring-1 ring-foreground/10"
      >
        {art.category ? (
          <CategoryArt id={art.art} accent={art.accent} className="absolute inset-0 size-full" />
        ) : (
          <VenueArt id={art.art} accent={art.accent} className="absolute inset-0 size-full" />
        )}
      </span>
    )
  }
  const { icon: Icon, tint } = iconFor(id)
  return (
    <span
      aria-hidden
      className="grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-sm"
      style={{ backgroundColor: tint }}
    >
      <Icon className="size-5" strokeWidth={2.25} />
    </span>
  )
}

// --- free versus member ---------------------------------------------------------

function Mark({ value, member }: { value: string | boolean; member: boolean }) {
  if (value === true)
    return (
      <Check
        aria-label="Yes"
        className={cn('size-4', member ? 'text-pip' : 'text-muted-foreground')}
        strokeWidth={3}
      />
    )
  if (value === false) return <Minus aria-label="No" className="size-4 text-muted-foreground/50" />
  return <span className={cn(member && 'font-medium text-foreground')}>{value}</span>
}

function Compare({ price }: { price: ShownPrice }) {
  const rows = comparisonRows()
  const cols =
    'grid grid-cols-[minmax(0,1fr)_6.5rem_7rem] items-center gap-3 md:grid-cols-[minmax(0,1fr)_11rem_11rem]'
  return (
    <Reveal>
      <div className="overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/[0.03]">
        <div className={cn(cols, 'border-b border-foreground/[0.07] px-4 py-4 md:px-6')}>
          <span />
          <span className="text-sm font-semibold">Free</span>
          <span className="flex flex-col text-sm font-semibold">
            <span className="flex items-center gap-1.5">
              <Star className="size-3.5 fill-pip text-pip" />
              Member
            </span>
            <span className="text-xs font-normal tabular-nums text-muted-foreground">
              {price.monthly} a month
            </span>
          </span>
        </div>
        <ul className="divide-y divide-foreground/[0.07]">
          {rows.map((row) => (
            <li
              key={row.thing}
              className={cn(cols, 'px-4 py-3 text-sm text-muted-foreground md:px-6')}
            >
              <span className="text-foreground">{row.thing}</span>
              <Mark value={row.free} member={false} />
              <Mark value={row.member} member />
            </li>
          ))}
        </ul>
        <div className="grid gap-3 border-t border-foreground/[0.07] bg-foreground/[0.02] px-4 py-4 md:grid-cols-2 md:px-6">
          {MEMBERSHIP_PROMISES.map((promise, i) => {
            const Icon = i === 0 ? ShieldCheck : Hand
            return (
              <p key={promise} className="flex gap-2.5 text-sm text-muted-foreground">
                <Icon className="mt-0.5 size-4 shrink-0 text-foreground" />
                <span>{promise}</span>
              </p>
            )
          })}
        </div>
      </div>
    </Reveal>
  )
}

// --- plans ----------------------------------------------------------------------

type Plan = 'annual' | 'monthly'

const PLAN_ORDER: readonly Plan[] = ['annual', 'monthly']

/** The two plans in one currency. The sums come from minor units, never the display strings. */
function plansIn(
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

/** An iOS segmented control: the selection is a pill that slides between segments. */
function CurrencyPicker({
  currency,
  onCurrency,
}: {
  currency: CurrencyCode
  onCurrency: (next: CurrencyCode) => void
}) {
  return (
    <fieldset className="inline-flex rounded-full border border-foreground/10 bg-foreground/[0.05] p-1">
      <legend className="sr-only">Currency</legend>
      {CURRENCIES.map((code) => {
        const on = code === currency
        return (
          <button
            key={code}
            type="button"
            aria-pressed={on}
            onClick={() => {
              if (on) return
              sound.play('tap')
              onCurrency(code)
            }}
            className={cn(
              'relative h-9 rounded-full px-3.5 text-sm font-medium tabular-nums transition-colors active:scale-[0.96] sm:px-4',
              on ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {on && (
              <motion.span
                layoutId="currency-pill"
                transition={SPRING}
                className="absolute inset-0 rounded-full bg-primary shadow-sm"
              />
            )}
            <span className="relative">
              {MEMBERSHIP_PRICES[code].symbol} {code}
            </span>
          </button>
        )
      })}
    </fieldset>
  )
}

function Plans({
  price,
  currency,
  onCurrency,
}: {
  price: ShownPrice
  currency: CurrencyCode
  /** Absent in the store app, where the store picks the currency. */
  onCurrency?: (next: CurrencyCode) => void
}) {
  const [plan, setPlan] = useState<Plan>('annual')
  const ready = checkoutReady()
  const PLANS = plansIn(price)
  // In the store app it is paid and cancelled through the store, so the notes
  // about Stripe's checkout and cancelling from Settings don't apply.
  const app = useInApp()
  // Between the page view and checkout the funnel was blind: a tab that never
  // scrolled this far and one that read the till and left counted the same.
  const till = useRef<HTMLDivElement>(null)
  const tillSeen = useInView(till, { once: true, amount: 0.5 })
  useEffect(() => {
    if (tillSeen) trackOnce('membership-join-seen')
  }, [tillSeen])

  const pick = (next: Plan) => {
    if (next === plan) return
    sound.play('tap')
    setPlan(next)
  }

  return (
    <div className="rise-in rounded-[2rem] border border-foreground/10 bg-foreground/[0.04] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_30px_70px_-30px_rgba(0,0,0,0.55)] backdrop-blur md:p-5">
      {onCurrency && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">Prices in</p>
          <CurrencyPicker currency={currency} onCurrency={onCurrency} />
        </div>
      )}
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
      <p className="mt-3 min-h-10 px-1 text-sm leading-relaxed text-muted-foreground">
        {PLANS[plan].note}
      </p>

      <div ref={till} className="mt-3">
        {ready ? (
          <Join plan={plan} planName={PLANS[plan].name} currency={currency} />
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
              Everything on this page is built and behind the membership check. The till is not:
              there is no card form and no way to give us money yet.
            </p>
          </>
        )}
      </div>

      <ul className="mt-4 grid gap-y-2 border-t border-foreground/[0.07] px-1 pt-4 text-sm text-muted-foreground">
        {(app
          ? [
              'Paid through the store, in your own currency, with tax included.',
              'Renews until you stop it. Cancel any time in your store’s subscription settings.',
              'You need a free Pip account to join. You never need one to play.',
              FREE_REPORT_COPY.offer,
              DAILY_FREE_GAME,
            ]
          : [
              'Tax is inside the price, and the price is fixed in your currency: the number here is the number that leaves your bank.',
              'Renews until you stop it. Cancel any time, from Settings, in two clicks.',
              'You need a free Pip account to join. You never need one to play.',
              FREE_REPORT_COPY.offer,
              DAILY_FREE_GAME,
            ]
        ).map((line) => (
          <li key={line} className="flex gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-pip" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
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
function Join({
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
        onClick={() =>
          void act(
            () => buyInStore(plan),
            `${store === 'Google Play' ? 'Google Play' : 'The App Store'} has your payment. It can take a minute to show here.`,
          )
        }
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

// --- questions ------------------------------------------------------------------

/**
 * `<details>`, not a stateful accordion: it opens without JavaScript, the mirror
 * reads every answer, and find-in-page reaches a closed one.
 */
function Questions({ coming }: { coming: MembershipFeature[] }) {
  const ready = checkoutReady()
  const app = useInApp()
  return (
    <Reveal>
      <div className="max-w-4xl divide-y divide-foreground/[0.07] overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/[0.03]">
        <Question q="Can I join yet?" open>
          {app ? (
            <p>
              Yes. Pick monthly or yearly above and pay through the store. You will need a free Pip
              account first, and the button makes one if you have not.
            </p>
          ) : ready ? (
            <p>
              Yes. Pick monthly or yearly above and you go to Stripe’s checkout page to pay. You
              will need a free Pip account first, and the button makes one if you have not.
            </p>
          ) : (
            <p>
              Not yet, and nobody has paid us anything. There is no checkout wired up behind this
              page — no Stripe account, no card form, no way to give us money. Everything listed
              above is built and sitting behind the membership check. We built the thing before we
              built the till, on purpose. When that changes, this answer changes with it.
            </p>
          )}
        </Question>
        <Question q="Can I try it before I pay?">
          <p>{DAILY_FREE_GAME}</p>
          <p>
            The card on the shelf says <em>Free today</em> while it is there. It is the same table a
            member gets.
          </p>
          <p>
            {FREE_REPORT_COPY.offer} It is the same report a member reads, built from your own
            hands, and it stays open until midnight UTC.
          </p>
        </Question>
        <Question q="How do I cancel?">
          <p>
            {app
              ? 'In your store’s subscription settings: on an iPhone, Settings, your name, Subscriptions. The membership is listed there.'
              : HOW_TO_CANCEL}
          </p>
          <p>
            Cancelling stops the renewal and leaves you a member until the period you have already
            paid for runs out. A yearly membership cancelled in month two runs to the end of the
            year and is not refunded pro rata; that is the standard arrangement and we would rather
            you read it here than discover it.{' '}
            {app
              ? 'Refunds for a membership bought in the app are handled by Apple.'
              : 'If you change your mind within 14 days of joining, email hello@playpip.io and we refund the payment in full.'}{' '}
            See the{' '}
            <Link
              href="/terms"
              className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
            >
              terms
            </Link>
            .
          </p>
        </Question>
        {!app && (
          <Question q="What does it cost where I live?">
            <p>
              One membership, priced in four currencies. Each is the pound’s price converted and
              rounded, then fixed: you pay the number on this page, not a rate worked out at
              checkout. Tax is inside every one of them.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {CURRENCIES.map((code) => (
                <li
                  key={code}
                  className="rounded-xl bg-foreground/[0.04] px-3.5 py-2.5 tabular-nums"
                >
                  <strong className="font-medium text-foreground">{code}</strong>{' '}
                  {MEMBERSHIP_PRICES[code].monthly} a month, or {MEMBERSHIP_PRICES[code].annual} a
                  year
                </li>
              ))}
            </ul>
            <p>
              Anywhere else, the page shows dollars. The picker beside the prices changes the
              currency whenever you like.
            </p>
          </Question>
        )}
        <Question q="Do I need an account?">
          <p>
            To join, yes — a free Pip account, because a membership has to belong to someone. To
            play, never.
          </p>
        </Question>
        {sellableFeatures().some((f) => f.id === MULTIPLAYER_ID) && (
          <Question q="Do my friends need a membership to play with me?">
            <p>
              No. The host opens the room; everyone else joins with the code and a free Pip account.
              Their buy-in comes out of their own Roll and their winnings go back into it, exactly
              as on the ladder.
            </p>
            <p>
              Camera and mic are only ever on in a room a member opened for their friends, never at
              a quick-match table.
            </p>
          </Question>
        )}
        {sellableFeatures().some((f) => f.id === MULTIPLAYER_ID) && (
          <Question q="Can I host without a membership?">
            <p>
              Yes, a little. Anyone with a free Pip account can open one private room a day, up to
              four seats and without camera or voice, play one quick match a day, and host one slow
              game at a time. The membership opens as many of each as you like, up to eight seats,
              with camera and voice.
            </p>
          </Question>
        )}
        <Question q="Is this pay-to-win?">
          <p>
            The member tables are ordinary tables: same engine, same shuffle, same opponents, same
            prize-to-buy-in ratio. Winning at them moves your Roll like winning anywhere else does.
            Your rank comes from your Roll, so a member reaches a rank sooner for having more tables
            to win at.
          </p>
          <p>
            We do not think that is pay-to-win, and here is the reasoning so you can disagree with
            it. Pay-to-win means buying an advantage over another player. There is no leaderboard,
            and at a multiplayer table nobody can see anybody else’s Roll or rank, so there is
            nobody to overtake. Everyone at a table sits with the same stack, sees the same things
            and has the same clock; the membership does not change any of it. What we will not do,
            at any price, is sell you something that changes a hand. The{' '}
            <a
              href="https://github.com/playpip/pip-web/blob/main/ROADMAP.md"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
            >
              roadmap
            </a>{' '}
            logs this argument, including the afternoon we talked ourselves out of it and back into
            it.
          </p>
        </Question>
        {coming.length > 0 && (
          <Question q="What isn’t built yet?">
            <p>
              Listed so the rest of this page does not look bigger than it is. Do not join for any
              of it.
            </p>
            <ul className="space-y-2">
              {coming.map((f) => (
                <li key={f.id}>
                  <strong className="font-medium text-foreground">{f.title}.</strong> {f.blurb}
                </li>
              ))}
            </ul>
          </Question>
        )}
      </div>
    </Reveal>
  )
}

function Question({
  q,
  open = false,
  children,
}: {
  q: string
  open?: boolean
  children: React.ReactNode
}) {
  return (
    <details open={open} className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium transition hover:bg-foreground/[0.03] md:px-6 md:py-5 [&::-webkit-details-marker]:hidden">
        {q}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 px-5 pb-5 text-sm leading-relaxed text-muted-foreground md:px-6 md:pb-6 md:text-base">
        {children}
      </div>
    </details>
  )
}

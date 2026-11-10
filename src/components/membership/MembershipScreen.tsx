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

import { ratingEnabled } from '@/lib/rating/local'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MotionConfig, motion } from 'framer-motion'
import {
  Check,
  ChevronDown,
  ChartSpline,
  Eye,
  Flame,
  GraduationCap,
  Hand,
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
  MEMBERSHIP_PRICES,
  MEMBERSHIP_PROMISES,
  type MembershipFeature,
  checkoutReady,
  formatPrice,
  sellableFeatures,
} from '@/config/membership'
import {
  OPENING_PLAN,
  PAYING_LINES,
  type Plan,
  PlanPicker,
  Till,
  useTillPrice,
} from '@/components/membership/Join'
import { trackOnce } from '@/lib/analytics'
import { comparisonRows } from '@/lib/membership/compare'
import { detectCurrency } from '@/lib/membership/currency'
import { FREE_REPORT_COPY } from '@/lib/membership/freeReport'
import { useHydrated } from '@/lib/useHydrated'
import { useInApp } from '@/lib/useInApp'
import { appSupports } from '@/lib/nativeApp'
import type { ShownPrice } from '@/lib/membership/store'
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
  const storeSells = useInApp() && appSupports('purchase')
  const price = useTillPrice({
    ...MEMBERSHIP_PRICES[currency],
    format: (minor) => formatPrice(minor, currency),
  })

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
  // The two plan columns are fixed in rem, so a big text size leaves the
  // thing being compared no width at all. Under 20rem across (a phone at 125%
  // and up) each row puts the thing on its own line over the two marks.
  const cols =
    'grid grid-cols-2 items-center gap-x-3 gap-y-1.5 @[20rem]:grid-cols-[minmax(0,1fr)_6.5rem_7rem] @[20rem]:gap-y-3 @[42rem]:grid-cols-[minmax(0,1fr)_11rem_11rem]'
  const thing = 'col-span-2 @[20rem]:col-span-1'
  return (
    <Reveal>
      <div className="@container overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/[0.03]">
        <div className={cn(cols, 'border-b border-foreground/[0.07] px-4 py-4 md:px-6')}>
          <span className="hidden @[20rem]:block" />
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
              <span className={cn(thing, 'text-foreground')}>{row.thing}</span>
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
  const [plan, setPlan] = useState<Plan>(OPENING_PLAN)
  // In the store app it is paid and cancelled through the store, so the notes
  // about Stripe's checkout and cancelling from Settings don't apply.
  const app = useInApp()

  return (
    <div className="rise-in rounded-[2rem] border border-foreground/10 bg-foreground/[0.04] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_30px_70px_-30px_rgba(0,0,0,0.55)] backdrop-blur md:p-5">
      {onCurrency && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">Prices in</p>
          <CurrencyPicker currency={currency} onCurrency={onCurrency} />
        </div>
      )}
      <PlanPicker price={price} plan={plan} onPlan={setPlan} />
      <Till plan={plan} price={price} currency={currency} className="mt-3" />

      <ul className="mt-4 grid gap-y-2 border-t border-foreground/[0.07] px-1 pt-4 text-sm text-muted-foreground">
        {[
          ...PAYING_LINES[app ? 'app' : 'web'],
          'You need a free Pip account to join. You never need one to play.',
          FREE_REPORT_COPY.offer,
          DAILY_FREE_GAME,
        ].map((line) => (
          <li key={line} className="flex gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-pip" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
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
            it. Pay-to-win means buying an advantage over another player.{' '}
            {ratingEnabled()
              ? 'Nobody can see anybody else’s Roll or rank. The leaderboard is by Pip Rating, which comes from how well you decide, so more tables or chips cannot raise it.'
              : 'There is no leaderboard, and at a multiplayer table nobody can see anybody else’s Roll or rank, so there is nobody to overtake.'}{' '}
            Everyone at a table sits with the same stack, sees the same things and has the same
            clock; the membership does not change any of it. What we will not do, at any price, is
            sell you something that changes a hand. The{' '}
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

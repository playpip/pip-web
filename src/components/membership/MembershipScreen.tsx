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
// **The art and the fans are `data-mirror="skip"`.** The markdown mirror
// (scripts/gen-llms.mjs) reads `<main>`, and a card back or a painting is
// nothing to a reader that cannot see it. Every sentence stays outside them.
//
// **No `<table>`**: the mirror's Turndown pass has shipped a broken one before.
// The free-versus-member comparison is two lists side by side.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MotionConfig, motion } from 'framer-motion'
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChartSpline,
  Eye,
  GraduationCap,
  Hand,
  Lock,
  History,
  ShieldCheck,
  Spade,
  Sparkles,
  Star,
  Target,
  TrendingUp,
} from 'lucide-react'
import { CardBack } from '@/components/CardBack'
import { Reveal } from '@/components/Reveal'
import { CategoryArt } from '@/components/menu/CategoryArt'
import { VenueArt } from '@/components/menu/VenueArt'
import { TappedFor } from '@/components/membership/TappedFor'
import { MEMBER_BACKS, MEMBER_SHOP_BACKS } from '@/config/cardBacks'
import { DRILL_KINDS } from '@/config/drills'
import { LESSONS } from '@/config/lessons'
import {
  CURRENCIES,
  type CurrencyCode,
  DAILY_FREE_GAME,
  HOW_TO_CANCEL,
  type LocalPrice,
  MEMBERSHIP_FEATURES,
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
import {
  type BillingError,
  awaitMembership,
  openPortal,
  startCheckout,
} from '@/lib/membership/billing'
import { detectCurrency } from '@/lib/membership/currency'
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
  useStorePrices,
} from '@/lib/membership/store'
import { SHOP_ITEMS } from '@/config/shop'
import { DEEP_STACK_TABLES, SIDE_SHELF, SIDE_TABLES } from '@/config/venues'
import { formatChips } from '@/lib/useMoney'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

// --- the numbers, counted rather than written -----------------------------------

const STATS = [
  { value: DRILL_KINDS.filter((k) => k.membersOnly).length, label: 'more drills' },
  { value: SIDE_TABLES.length + DEEP_STACK_TABLES.length, label: 'side tables' },
  {
    value: SIDE_SHELF.filter((f) => f.section === 'games' && f.membersOnly).length,
    label: 'more kinds of poker',
  },
  { value: SHOP_ITEMS.filter((i) => i.membersOnly).length, label: 'for the members’ shelf' },
]

/** The hero's one number, counted from the course rather than typed. */
const HERO = { lessons: LESSONS.filter((l) => l.membersOnly).length }

// --- how each feature looks -----------------------------------------------------

type Visual =
  | { kind: 'art'; art: string; accent: string; tag: string }
  | { kind: 'category'; art: string; accent: string; tag: string }
  | { kind: 'collage'; arts: { art: string; accent: string }[]; tag: string }

/** The play shelf, in the order it reads best. Paintings are the venues' own. */
const PLAY: Record<string, Visual> = {
  'side-tables': {
    kind: 'collage',
    tag: 'Side tables',
    arts: [
      { art: 'redeye', accent: '#E06D8C' },
      { art: 'duel', accent: '#9A7FD1' },
      { art: 'docks', accent: '#C9873D' },
      { art: 'study', accent: '#B5835A' },
    ],
  },
  rooms: { kind: 'art', art: 'deepstack-750', accent: '#B5835A', tag: 'Deep' },
  omaha: { kind: 'art', art: 'bigpot', accent: '#5B7FC7', tag: 'Omaha' },
  shortdeck: { kind: 'art', art: 'chopshop', accent: '#D95F43', tag: 'Short Deck' },
  hilo: { kind: 'art', art: 'vault', accent: '#4FB477', tag: 'Hi-Lo' },
  draw: { kind: 'art', art: 'allnighter', accent: '#8F6FE8', tag: 'Draw' },
  blackjack: { kind: 'art', art: 'casino', accent: '#C9873D', tag: 'Not poker' },
  'custom-tables': { kind: 'category', art: 'custom', accent: '#8A8F98', tag: 'Yours' },
}

/** The tools beside the game: an iOS settings-row icon each. */
const TOOLS: Record<string, { icon: typeof Target; tint: string }> = {
  lessons: { icon: GraduationCap, tint: '#3FA7B8' },
  drills: { icon: Target, tint: '#5B7FC7' },
  river: { icon: Spade, tint: '#C9873D' },
  progress: { icon: ChartSpline, tint: '#E06D8C' },
  coaching: { icon: TrendingUp, tint: '#4FB477' },
  review: { icon: History, tint: '#D95F43' },
  'god-view': { icon: Eye, tint: '#8F6FE8' },
}

/** Has its own section rather than a card or a row. */
const SHELF_ID = 'cosmetics'

/** What stays free, said as a list. Rule 1 in docs/membership.md is the long form. */
const FREE_FOREVER = [
  'The ten-venue ladder, Garage to Main Event',
  'The Rail’s cash games and the challenge tables',
  'The Daily Deal and the Kitchen Table freeroll',
  'The Chip Shop, and everything chips buy in it',
  'The read on every hand as you finish it',
  '“What have you got?” and “Which hand wins?”',
  'Level 1 of Lessons with Webb, and every guide',
  'The odds calculator',
]

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
  const sellable = sellableFeatures()
  const play = Object.keys(PLAY)
    .map((id) => sellable.find((f) => f.id === id))
    .filter((f): f is MembershipFeature => Boolean(f))
  const shelf = sellable.find((f) => f.id === SHELF_ID)
  // Anything shipped that has no card lands in the tools list, so a new
  // feature is on the page the moment it is marked shipped.
  const tools = sellable.filter((f) => !PLAY[f.id] && f.id !== SHELF_ID)
  const coming = MEMBERSHIP_FEATURES.filter((f) => !f.shipped)
  const [currency, setCurrency] = useCurrency()
  const price = MEMBERSHIP_PRICES[currency]

  // First step of the funnel. The page view is counted anyway; this one is
  // once per tab, so it lines up with the three steps after it.
  useEffect(() => trackOnce('membership-viewed'), [])

  return (
    <MotionConfig reducedMotion="user">
      <main className="flex-1 overflow-x-clip">
        <TappedFor price={price} />
        <Hero price={price} />

        <div className="mx-auto w-full max-w-6xl px-4 md:px-10">
          <Stats />

          <Section
            id="tools"
            eyebrow="Get better"
            title="Find out what is costing you"
            lede="The free read tells you about one hand. These tell you about you: where your chips go, every session back on the felt, and the spots to practise until they stop going there."
          >
            <GroupedList>
              {tools.map((feature) => (
                <ToolRow key={feature.id} feature={feature} />
              ))}
            </GroupedList>
          </Section>

          <Section
            id="play"
            eyebrow="Play"
            title="And more to play it on"
            lede="The game you know with one screw turned, four games that are not Hold’em, and a table you build yourself."
          >
            <PlayShelf features={play} />
          </Section>

          {shelf && (
            <Section id="shelf" eyebrow="Make it yours" title={shelf.title}>
              <Shelf feature={shelf} />
            </Section>
          )}

          <Section
            id="plans"
            eyebrow="Price"
            title="One membership, two ways to pay"
            lede="The same membership either way. Pick how often you would rather be billed. One member game a day is free, so you can try a table or a lesson first."
          >
            <Plans price={price} currency={currency} onCurrency={setCurrency} />
          </Section>

          <Section id="free" eyebrow="Free, forever" title="What you already have">
            <FreeVersusMember price={price} />
          </Section>

          <Section id="promises" eyebrow="Our word" title="Two rules it can never break">
            <Promises />
          </Section>

          <Section id="questions" eyebrow="Questions" title="Before you ask">
            <Questions coming={coming} />
          </Section>
        </div>
      </main>
    </MotionConfig>
  )
}

// --- hero -----------------------------------------------------------------------

/** The backs that come with it and the ones it lets you buy, fanned like a hand. */
const FAN = [
  MEMBER_BACKS[0],
  MEMBER_SHOP_BACKS[0],
  MEMBER_SHOP_BACKS[2],
  MEMBER_SHOP_BACKS[1],
  MEMBER_BACKS[3],
]

function Hero({ price }: { price: LocalPrice }) {
  return (
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 size-[44rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--color-pip)_22%,transparent),transparent_65%)] blur-2xl"
      />
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-10 pt-12 text-center md:pb-16 md:pt-20">
        <CardFan />

        {/* CSS rather than Framer, so the headline is in the static HTML at
            full opacity and does not wait for hydration (globals.css). */}
        <div
          className="rise-in flex flex-col items-center"
          style={{ '--rise-delay': '0.25s' } as React.CSSProperties}
        >
          <span className="mt-8 inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/[0.04] px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Star className="size-3 fill-pip text-pip" />
            Pip Membership
          </span>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight md:text-6xl">
            Get better at poker.{' '}
            <span className="block text-muted-foreground">And see it working.</span>
          </h1>
          <p className="mt-5 max-w-xl text-balance text-base text-muted-foreground md:text-lg">
            {HERO.lessons} lessons with Webb, played on the felt. A report that reads every hand you
            have played and names what is costing you chips, in big blinds, with the hands it
            happened in. Every session back on the table, hand by hand. Plus the side tables, the
            games that are not Hold’em and the members’ shelf. The core game stays free, for good.
          </p>
          <p className="mt-5 text-sm tabular-nums text-muted-foreground">
            <span className="font-semibold text-foreground">{price.monthly}</span> a month{' '}
            <span className="px-1 text-foreground/25">·</span>{' '}
            <span className="font-semibold text-foreground">{price.annual}</span> a year
          </p>
          <div className="mt-6 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
            <PillLink href="#plans" primary>
              See the plans
            </PillLink>
            <PillLink href="#free">What stays free</PillLink>
          </div>
          <p className="mt-4 max-w-md text-balance text-sm text-muted-foreground">
            One member game a day is free without joining.{' '}
            <a href="#plans" className="underline underline-offset-2 hover:text-foreground">
              How it works
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}

function CardFan() {
  const mid = (FAN.length - 1) / 2
  return (
    <div data-mirror="skip" aria-hidden className="relative h-36 w-72 md:h-40 md:w-80">
      {FAN.map((design, i) => {
        const offset = i - mid
        return (
          <motion.div
            key={design.id}
            className="absolute bottom-0 left-1/2 origin-bottom"
            style={{ zIndex: 10 - Math.abs(offset) }}
            initial={{ opacity: 0, y: 40, x: '-50%', rotate: 0 }}
            animate={{
              opacity: 1,
              y: Math.abs(offset) * 6,
              x: `calc(-50% + ${offset * 2.6}rem)`,
              rotate: offset * 9,
            }}
            whileHover={{ y: Math.abs(offset) * 6 - 14 }}
            transition={{ ...SPRING, delay: 0.05 * i }}
          >
            <CardBack design={design} size="lg" className="shadow-xl shadow-black/30" />
          </motion.div>
        )
      })}
    </div>
  )
}

function PillLink({
  href,
  primary = false,
  children,
}: {
  href: string
  primary?: boolean
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      className={cn(
        'inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold transition active:scale-[0.97]',
        primary
          ? 'bg-primary text-primary-foreground shadow-lg shadow-black/10 hover:bg-primary/90'
          : 'border border-foreground/10 bg-foreground/[0.04] text-foreground hover:bg-foreground/[0.08]',
      )}
    >
      {children}
    </a>
  )
}

// --- the counts -----------------------------------------------------------------

function Stats() {
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
      {STATS.map((stat, i) => (
        <Reveal key={stat.label} delay={i * 0.05}>
          <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-4 py-4 md:px-5 md:py-5">
            <p className="text-3xl font-semibold tabular-nums tracking-tight md:text-4xl">
              {stat.value}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{stat.label}</p>
          </div>
        </Reveal>
      ))}
    </div>
  )
}

// --- a section ------------------------------------------------------------------

function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
}: {
  id: string
  eyebrow: string
  title: string
  lede?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 pt-16 md:pt-24">
      <Reveal>
        <p className="text-sm font-medium text-pip">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight md:text-4xl">{title}</h2>
        {lede && <p className="mt-2 max-w-2xl text-muted-foreground md:text-lg">{lede}</p>}
      </Reveal>
      <div className="mt-6 md:mt-8">{children}</div>
    </section>
  )
}

// --- play -----------------------------------------------------------------------

/**
 * A snap carousel on a phone, the way the App Store shelves a row, and a grid
 * from `md`. The first card is the widest thing on the page because it is the
 * most of what the membership is.
 */
function PlayShelf({ features }: { features: MembershipFeature[] }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-8 -mb-6 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden">
      {features.map((feature, i) => (
        <PlayCard
          key={feature.id}
          feature={feature}
          visual={PLAY[feature.id]}
          index={i}
          className={cn(
            feature.id === 'side-tables' && 'md:col-span-2',
            feature.id === 'custom-tables' && 'md:col-span-2 lg:col-span-1',
          )}
        />
      ))}
    </div>
  )
}

function PlayCard({
  feature,
  visual,
  index,
  className,
}: {
  feature: MembershipFeature
  visual: Visual
  index: number
  className?: string
}) {
  const wide = feature.id === 'side-tables'
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay: Math.min(index * 0.04, 0.2) }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.985 }}
      className={cn(
        'flex w-[82%] shrink-0 snap-start flex-col overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/[0.03] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-20px_rgba(0,0,0,0.35)] sm:w-[60%] md:w-auto',
        className,
      )}
    >
      <div
        data-mirror="skip"
        aria-hidden
        className={cn(
          'relative w-full overflow-hidden',
          wide ? 'aspect-[16/10] md:aspect-[21/9]' : 'aspect-[16/10]',
        )}
      >
        <CardArt visual={visual} />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-lg bg-black/45 px-2 py-1 text-2xs font-semibold text-white/90 backdrop-blur-sm">
          <Star className="size-3 fill-current text-pip" />
          {visual.tag}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4 md:p-5">
        <h3 className="text-lg font-semibold tracking-tight">{feature.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{feature.blurb}</p>
      </div>
    </motion.article>
  )
}

function CardArt({ visual }: { visual: Visual }) {
  if (visual.kind === 'collage') {
    return (
      <div className="grid size-full grid-cols-2 grid-rows-2 gap-px bg-black md:grid-cols-4 md:grid-rows-1">
        {visual.arts.map((a) => (
          <VenueArt key={a.art} id={a.art} accent={a.accent} className="size-full" />
        ))}
      </div>
    )
  }
  if (visual.kind === 'category') {
    return (
      <CategoryArt id={visual.art} accent={visual.accent} className="absolute inset-0 size-full" />
    )
  }
  return <VenueArt id={visual.art} accent={visual.accent} className="absolute inset-0 size-full" />
}

// --- tools ----------------------------------------------------------------------

/** An inset grouped list, the way iOS Settings draws one. */
function GroupedList({ children }: { children: React.ReactNode }) {
  return (
    <Reveal>
      <ul className="divide-y divide-foreground/[0.07] overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/[0.03]">
        {children}
      </ul>
    </Reveal>
  )
}

function ToolRow({ feature }: { feature: MembershipFeature }) {
  const tool = TOOLS[feature.id] ?? { icon: Sparkles, tint: '#7C8CF0' }
  const Icon = tool.icon
  return (
    <li className="flex gap-4 px-4 py-4 md:gap-5 md:px-6 md:py-5">
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-xl text-white shadow-sm md:size-11"
        style={{ backgroundColor: tool.tint }}
      >
        <Icon className="size-5" strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <h3 className="font-semibold tracking-tight md:text-lg">{feature.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{feature.blurb}</p>
      </div>
    </li>
  )
}

// --- the shelf ------------------------------------------------------------------

const SHELF_KIND_LABEL: Record<string, string> = {
  back: 'Card back',
  face: 'Deck',
  finish: 'Table finish',
  ring: 'Avatar ring',
  button: 'Dealer button',
  sound: 'Sound',
}

function Shelf({ feature }: { feature: MembershipFeature }) {
  const items = SHOP_ITEMS.filter((item) => item.membersOnly && item.kind !== 'back')
  const backs = [...MEMBER_BACKS, ...MEMBER_SHOP_BACKS]
  return (
    <Reveal>
      <div className="overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/[0.03]">
        <div
          data-mirror="skip"
          aria-hidden
          className="flex items-end justify-center gap-2 overflow-hidden bg-[#0A0A0A] px-4 pb-8 pt-10 md:gap-4 md:pb-12 md:pt-16 lg:gap-9"
        >
          {backs.map((design, i) => (
            <motion.div
              key={design.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: i % 2 === 0 ? 0 : -10 }}
              viewport={{ once: true, amount: 0.4 }}
              whileHover={{ y: -18, rotate: i % 2 === 0 ? -3 : 3 }}
              transition={{ ...SPRING, delay: i * 0.04 }}
              className={cn(i > 3 && 'hidden sm:block')}
            >
              <div className="lg:scale-[1.3]">
                <CardBack design={design} size="md" className="shadow-2xl shadow-black/60" />
              </div>
            </motion.div>
          ))}
        </div>
        <div className="p-5 md:p-7">
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">
            {feature.blurb}
          </p>
          <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ...backs.map((b) => ({
                id: b.id,
                name: b.name,
                kind: 'back',
                price: b.unlock?.price ?? 0,
              })),
              ...items,
            ].map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-foreground/[0.04] px-3.5 py-2.5 text-sm"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{item.name}</span>{' '}
                  <span className="text-muted-foreground">
                    · {SHELF_KIND_LABEL[item.kind] ?? item.kind}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {item.price > 0 ? `${formatChips(item.price)} chips` : 'Included'}
                </span>
              </li>
            ))}
          </ul>
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
  price: LocalPrice,
): Record<Plan, { name: string; price: string; per: string; note: string }> {
  const saving = price.monthlyMinor * 12 - price.annualMinor
  const perMonth = Math.round(price.annualMinor / 12)
  return {
    annual: {
      name: 'Yearly',
      price: price.annual,
      per: 'a year',
      note: `${formatPrice(perMonth, price.currency)} a month, near enough — ${formatPrice(saving, price.currency)} less than paying monthly for twelve months.`,
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
  price: LocalPrice
  currency: CurrencyCode
  onCurrency: (next: CurrencyCode) => void
}) {
  const [plan, setPlan] = useState<Plan>('annual')
  const ready = checkoutReady()
  const PLANS = plansIn(price)
  // In the store app it is paid and cancelled through the store, so the notes
  // about Stripe's checkout and cancelling from Settings don't apply.
  const app = useInApp()

  const pick = (next: Plan) => {
    if (next === plan) return
    sound.play('tap')
    setPlan(next)
  }

  return (
    <Reveal>
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Prices in</p>
          <CurrencyPicker currency={currency} onCurrency={onCurrency} />
        </div>
        <div role="radiogroup" aria-label="Billing" className="grid gap-3 sm:grid-cols-2">
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
                  'relative flex flex-col rounded-3xl border p-5 text-left transition-colors md:p-6',
                  on
                    ? 'border-foreground/60 bg-foreground/[0.06] ring-1 ring-foreground/60'
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
                <span className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-4xl font-semibold tabular-nums tracking-tight">
                    {p.price}
                  </span>
                  <span className="text-muted-foreground">{p.per}</span>
                </span>
                <span className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.note}</span>
              </motion.button>
            )
          })}
        </div>

        <div className="mt-5 rounded-3xl border border-foreground/10 bg-foreground/[0.03] p-5 md:p-6">
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
                <strong className="font-medium text-foreground">
                  Nobody has paid us anything.
                </strong>{' '}
                Everything on this page is built and behind the membership check. The till is not:
                there is no card form and no way to give us money yet.
              </p>
            </>
          )}

          <ul className="mt-5 grid gap-x-6 gap-y-2.5 border-t border-foreground/[0.07] pt-5 text-sm text-muted-foreground sm:grid-cols-2">
            {(app
              ? [
                  'Paid through the store, in your own currency, with tax included.',
                  'Renews until you stop it. Cancel any time in your store’s subscription settings.',
                  'You need a free Pip account to join. You never need one to play.',
                  DAILY_FREE_GAME,
                ]
              : [
                  'Tax is inside the price: the number here is the number that leaves your bank.',
                  'A fixed price in your currency, never converted at checkout, so no exchange fee is hidden in it.',
                  'Renews until you stop it. Cancel any time, from Settings, in two clicks.',
                  'You need a free Pip account to join. You never need one to play.',
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
      </div>
    </Reveal>
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
  consent: 'Tick the box above first — it is what lets the membership start straight away.',
  unavailable: 'Couldn’t reach the till just now. Nothing was charged — try again in a moment.',
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
 * The till. Four states, in the order a player meets them: signed out (an
 * account first — a membership has to belong to somebody), signed in (off to
 * Stripe), back from Stripe (waiting for the webhook), and a member (the portal).
 *
 * Nothing here grants anything. `?joined=1` only changes what this box *says*
 * while the row is fetched; `member` still comes from the table the client
 * cannot write.
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
  const [slow, setSlow] = useState(false)
  const [startNow, setStartNow] = useState(false)
  const app = useInApp()
  const source = useMembershipSource()

  // Read after hydration only: the static page has no query string to read.
  const joined = hydrated && new URLSearchParams(window.location.search).has('joined')
  // What was tapped to get here, if anything: sent to checkout, and handed back
  // with `?joined=1` so the welcome can point at it.
  const tapped = hydrated ? tappedFeature(window.location.search) : null

  useEffect(() => {
    if (!joined) return
    // Stripe only sends a player to `?joined=1` after the payment went
    // through, so this counts completed checkouts, and the next one counts
    // the row arriving. Neither grants anything; they are counts.
    trackOnce('checkout-completed')
    let live = true
    void awaitMembership().then((ok) => {
      if (ok) trackOnce('membership-active')
      if (live && !ok) setSlow(true)
    })
    return () => {
      live = false
    }
  }, [joined])

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
    const priceId = MEMBERSHIP_PRICE_IDS[plan]
    if (priceId) void run(() => startCheckout(priceId, currency, startNow, tapped?.id))
  }

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
                ? `Cancelled — you stay a member until ${endsOn(periodEnd)}.`
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
          {joined ? 'Welcome in. You’re a member.' : 'You’re a member'}
        </div>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {leaving
            ? `Cancelled — you stay a member until ${endsOn(periodEnd)}, and nothing more is charged.`
            : `Renews on ${endsOn(periodEnd)}. Cancel, change card or get an invoice from the portal.`}
        </p>
        {joined && tapped?.place && (
          <Link
            href={tapped.place.href}
            onClick={() => sound.play('tap')}
            className={cn(joinButton, 'mt-3')}
          >
            Go to {tapped.place.name}
            <ChevronRight className="size-4" />
          </Link>
        )}
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
  } else if (joined && signedIn) {
    body = (
      <>
        <div className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-foreground/[0.07] text-base font-semibold text-muted-foreground">
          {slow ? 'Still confirming with Stripe' : 'Confirming your payment…'}
        </div>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {slow
            ? 'Stripe has your payment and is still telling us. It usually lands within a minute — reload this page, and if it hasn’t after that, write to hello@playpip.io and we will sort it out.'
            : 'Stripe is telling us it went through. This takes a few seconds.'}
        </p>
      </>
    )
  } else if (signedIn) {
    body = (
      <>
        {/* Asked here, not on Stripe's page: Checkout's own terms consent
            points at the shared account's terms, which are Ava's, not Pip's. */}
        <label className="mb-4 flex cursor-pointer gap-3 text-left text-sm leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            checked={startNow}
            onChange={(e) => {
              sound.play('tap')
              setStartNow(e.target.checked)
              setError(null)
            }}
            className="mt-1 size-4 shrink-0 accent-[var(--color-primary)]"
          />
          <span>
            Start my membership straight away. I understand this ends my 14-day right to cancel for
            a refund, and that I agree to the{' '}
            <Link
              href="/terms"
              className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
            >
              terms
            </Link>
            .
          </span>
        </label>
        <button disabled={busy || !startNow} onClick={pay} className={joinButton}>
          {busy ? 'Opening checkout…' : `Join ${planName.toLowerCase()}`}
          {!busy && <ChevronRight className="size-4" />}
        </button>
        <p className="mt-3 text-center text-sm text-muted-foreground">
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
        onOpenChange={(o) => !o && setAccount(null)}
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
  const price = prices?.[plan]

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

// --- free versus member ---------------------------------------------------------

function FreeVersusMember({ price }: { price: LocalPrice }) {
  const member = sellableFeatures().map((f) => f.title)
  return (
    <div className="grid gap-3 md:grid-cols-2 md:gap-4">
      <Reveal>
        <div className="h-full rounded-3xl border border-foreground/10 bg-foreground/[0.03] p-5 md:p-7">
          <h3 className="flex items-center justify-between font-semibold">
            Free, for everyone
            <span className="rounded-full bg-foreground/[0.07] px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              Free
            </span>
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {FREE_FOREVER.map((line) => (
              <li key={line} className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
      <Reveal delay={0.06}>
        <div className="relative h-full overflow-hidden rounded-3xl border border-pip/40 bg-[color-mix(in_oklch,var(--color-pip)_7%,transparent)] p-5 md:p-7">
          <h3 className="flex items-center justify-between font-semibold">
            All of that, plus
            <span className="rounded-full bg-pip px-2.5 py-0.5 text-xs font-semibold text-white">
              {price.monthly}/mo
            </span>
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {member.map((line) => (
              <li key={line} className="flex gap-2.5">
                <Star className="mt-0.5 size-4 shrink-0 fill-pip text-pip" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </div>
  )
}

// --- the promises ---------------------------------------------------------------

function Promises() {
  const icons = [ShieldCheck, Hand]
  return (
    <div className="grid gap-3 md:grid-cols-2 md:gap-4">
      {MEMBERSHIP_PROMISES.map((promise, i) => {
        const Icon = icons[i] ?? ShieldCheck
        return (
          <Reveal key={promise} delay={i * 0.06}>
            <blockquote className="h-full rounded-3xl border border-foreground/10 bg-foreground/[0.03] p-5 md:p-7">
              <span className="grid size-10 place-items-center rounded-xl bg-foreground/[0.07]">
                <Icon className="size-5 text-foreground" />
              </span>
              <p className="mt-4 text-lg font-medium leading-snug tracking-tight md:text-xl">
                {promise}
              </p>
            </blockquote>
          </Reveal>
        )
      })}
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
            The card on the shelf says <em>Free today</em> while it is there. It is the same table
            or lesson a member gets.
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
            you read it here than discover it. See the{' '}
            <Link
              href="/terms"
              className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
            >
              terms
            </Link>
            .
          </p>
        </Question>
        <Question q="What does it cost where I live?">
          <p>
            One membership, priced in four currencies. Each is the pound’s price converted and
            rounded, then fixed: you pay the number on this page, not a rate worked out at checkout.
            Tax is inside every one of them.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {CURRENCIES.map((code) => (
              <li key={code} className="rounded-xl bg-foreground/[0.04] px-3.5 py-2.5 tabular-nums">
                <strong className="font-medium text-foreground">{code}</strong>{' '}
                {MEMBERSHIP_PRICES[code].monthly} a month, or {MEMBERSHIP_PRICES[code].annual} a
                year
              </li>
            ))}
          </ul>
          <p>
            Anywhere else, the page shows dollars. The picker beside the prices changes the currency
            whenever you like.
          </p>
        </Question>
        <Question q="Do I need an account?">
          <p>
            To join, yes — a free Pip account, because a membership has to belong to someone. To
            play, never.
          </p>
        </Question>
        <Question q="Is this pay-to-win?">
          <p>
            Member rooms are ordinary tables — same engine, same shuffle, same opponents, same
            prize-to-buy-in ratio — and winning in them moves your Roll like winning anywhere else
            does. Your rank comes from your Roll, so a member reaches a rank sooner for having more
            tables to win at.
          </p>
          <p>
            We do not think that is pay-to-win, and here is the reasoning so you can disagree with
            it. Pay-to-win means buying an advantage over another player. Pip is single-player:
            there is no leaderboard and nobody to overtake. What we will not do, at any price, is
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

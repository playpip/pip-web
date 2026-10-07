'use client'

// The marketing landing page ("/"). The app itself lives at "/game". Built from
// the real product primitives — VenueArt, CardBack, the cast — plus a recorded
// hand for the hero, so nothing here is a mock-up: what you see on the page is
// what you get at the table. That sentence was false for four months, in the
// four feature cards that draw product output, so anything here that pictures
// something the game emits either calls the game's own function or is a
// constant that a test recomputes (`src/config/landingMocks.ts`). Flat,
// black-first, one accent (pip). Dark only (see docs/design.md).

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Brain,
  CalendarDays,
  Check,
  Gauge,
  Link2,
  Palette,
  ShieldCheck,
  Spade,
  Sparkles,
  UserPlus,
  Volume2,
  WifiOff,
} from 'lucide-react'
import { FaGithub } from 'react-icons/fa'
import { CardBack } from '@/components/CardBack'
import { Reveal } from '@/components/Reveal'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { Wordmark } from './Wordmark'
import { Footer } from './Footer'
import { VenueArt } from '@/components/menu/VenueArt'
import { VENUES, SIDE_TABLES, FORMAT_LABELS, THE_DAILY, type Venue } from '@/config/venues'
import { ACCOUNT_OFFER } from '@/config/account'
import { oauthProviders, syncConfigured } from '@/lib/sync/client'
import { CARD_BACKS } from '@/config/cardBacks'
import { characterById, type Character } from '@/config/cast'
import { guideBySlug } from '@/config/learn'
import { EQUITY_SAMPLE, HAND_LINK_SAMPLE, HAND_LINK_VISIBLE_CHARS } from '@/config/landingMocks'
import { MEMBERSHIP_PRICE, MEMBERSHIP_PROMISES, sellableFeatures } from '@/config/membership'
import { useProfile } from '@/store/profile'
import { dailyShareText } from '@/lib/daily'
import { encodeHand } from '@/lib/handLink'
import { useHydrated } from '@/lib/useHydrated'
import { useMoney } from '@/lib/useMoney'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------------- */

export function Landing() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-background">
      <Header />
      <main className="flex-1">
        <Hero />
        <TrustStrip />
        <Venues />
        <Features />
        <Learn />
        <Membership />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}

/* ---------------------------------- header -------------------------------- */

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-foreground/5 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6 md:px-10">
        <Wordmark />
        {/* On a phone this bar is the wordmark, one wayfinding link and the CTA,
            and nothing else: six controls across 357px was the crowding Will
            reported. Blog, GitHub and the theme toggle are hidden below `sm`
            rather than removed, so they stay in the DOM for crawlers, and every
            one of them is in the footer of this same page. Learn is the one
            that stays because it is the content hub we send people to. */}
        <nav className="flex items-center gap-1">
          <a
            href="#features"
            className="hidden rounded-full px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground sm:block"
          >
            Features
          </a>
          <a
            href="#venues"
            className="hidden rounded-full px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground sm:block"
          >
            Venues
          </a>
          <Link
            href="/learn"
            className="rounded-full px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            Learn
          </Link>
          <a
            href="#membership"
            className="hidden rounded-full px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground sm:block"
          >
            Membership
          </a>
          <Link
            href="/blog"
            className="hidden rounded-full px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground sm:block"
          >
            Blog
          </Link>
          <a
            href="https://github.com/playpip/pip-web"
            target="_blank"
            rel="noreferrer"
            aria-label="Pip on GitHub"
            className="hidden rounded-full p-2 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground sm:block"
          >
            <FaGithub className="size-4" />
          </a>
          <PlayButton size="sm" className="ml-1" />
        </nav>
      </div>
    </header>
  )
}

/* ---------------------------------- hero ---------------------------------- */

/**
 * The hero's stagger, in CSS (`.rise-in` in globals.css). Everything above the
 * fold uses this rather than Framer: a Framer `initial` is baked into the static
 * HTML as `opacity:0` and waits for hydration, which left the headline and the
 * Play button invisible for seconds on a slow load.
 */
const riseDelay = (i: number) => ({ '--rise-delay': `${0.05 * i}s` }) as React.CSSProperties

function Hero() {
  return (
    <section className="relative">
      {/* soft pip glow — the single accent, low alpha so it reads calm not neon */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_50%_-10%,color-mix(in_oklch,var(--color-pip)_16%,transparent),transparent_70%)]"
      />
      <GhostSuits />

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-6 pt-14 pb-20 md:px-10 md:pt-20 md:pb-28 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        {/* copy */}
        <div className="max-w-xl">
          <div className="rise-in" style={riseDelay(0)}>
            <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.03] px-3 py-1 text-xs font-medium text-muted-foreground">
              <Spade className="size-3.5 fill-current text-pip" />
              Free · No signup · Plays in your browser
            </span>
          </div>

          <h1
            style={riseDelay(1)}
            className="rise-in mt-6 text-5xl font-semibold leading-[1.02] tracking-tight text-balance md:text-6xl lg:text-7xl"
          >
            Poker without
            <br />
            the casino.
          </h1>

          <p
            style={riseDelay(2)}
            className="rise-in mt-6 text-lg leading-relaxed text-muted-foreground text-pretty"
          >
            Texas Hold’em against a cast of AI regulars. Press Play and you’re dealt in. Learn as
            you go: your odds sit beside your cards, and Level 1 of Webb’s lessons is free.
          </p>

          <div style={riseDelay(3)} className="rise-in mt-9 flex flex-wrap items-center gap-3">
            <PlayButton size="lg" />
            <a
              href="#features"
              className="rounded-2xl px-5 py-3.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              See how it plays
            </a>
          </div>

          <p style={riseDelay(4)} className="rise-in mt-4 text-sm text-muted-foreground">
            Play money only. {ACCOUNT_OFFER}
          </p>
          <SignInLink />
        </div>

        {/* the table showpiece — a real hand, not a mock */}
        <HeroTable />
      </div>
    </section>
  )
}

/** Respect the user's reduced-motion setting — hydration-gated so SSR/client agree. */
function usePrefersReducedMotion() {
  const hydrated = useHydrated()
  if (!hydrated || typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** A few oversized suit glyphs, barely there — texture, not decoration. */
function GhostSuits() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <span className="absolute -left-6 top-24 text-[10rem] leading-none text-foreground/[0.03] select-none">
        ♠
      </span>
      <span className="absolute right-8 top-8 text-[7rem] leading-none text-foreground/[0.03] select-none">
        ♥
      </span>
      <span className="absolute right-1/3 bottom-4 text-[9rem] leading-none text-foreground/[0.02] select-none">
        ♦
      </span>
    </div>
  )
}

/**
 * The hero showpiece: a real recorded hand at the Garage — flop a full house,
 * value-bet three streets, win at showdown. Answers a cold visitor's #1 question
 * ("what's it actually like to play?") with the game itself, not a mock-up.
 *
 * The capture is cropped to the table (960×880, from a 1350×1080 recording of
 * the whole window): the uncropped frame spent most of its pixels on the app
 * bar and empty canvas, and at hero size the cards were too small to read.
 * WebM first, MP4 for Safari, and the poster is the final frame, so it is also
 * the LCP image and the still a reduced-motion visitor gets.
 */
function HeroTable() {
  const reducedMotion = usePrefersReducedMotion()
  return (
    <div style={riseDelay(2)} className="rise-in relative flex items-center justify-center">
      {/* soft focus glow behind the frame */}
      <div
        aria-hidden
        className="pointer-events-none absolute size-[36rem] max-w-full rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--color-pip)_20%,transparent),transparent_70%)] blur-3xl"
      />
      <figure className="relative w-full overflow-hidden rounded-3xl border border-foreground/10 bg-black shadow-2xl shadow-black/60 ring-1 ring-white/5">
        {/* a quiet title bar, so the frame reads as the app rather than a clip */}
        <figcaption className="flex items-center justify-between border-b border-foreground/10 px-4 py-2.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">Friends’ Garage</span>
          <span className="tabular-nums">A real hand, recorded</span>
        </figcaption>
        <div className="relative aspect-[12/11] w-full">
          {reducedMotion ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/hero-poster.jpg"
              alt="A hand at the Garage: a full house wins 136 at showdown"
              width={960}
              height={880}
              fetchPriority="high"
              className="size-full object-cover"
            />
          ) : (
            <video
              className="size-full object-cover"
              poster="/hero-poster.jpg"
              width={960}
              height={880}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-label="Gameplay: a full house wins at showdown at the Garage"
            >
              <source src="/hero.webm" type="video/webm" />
              <source src="/hero.mp4" type="video/mp4" />
            </video>
          )}
        </div>
      </figure>
    </div>
  )
}

/* --------------------------------- trust ---------------------------------- */

const TRUST: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }[] =
  [
    {
      icon: ShieldCheck,
      title: 'No real money',
      body: 'Play-money chips only. Chips are never for sale.',
    },
    {
      // Led with the negative for months, which is us arguing against our own
      // free account in the one place a visitor decides. The promise is
      // unchanged; the offer goes first (#97).
      icon: UserPlus,
      title: 'Free account, nothing to confirm',
      // Names Google and Apple only in a build that offers them, as the signup
      // dialog does.
      body: `${oauthProviders().length > 0 ? 'Google, Apple, or an email and a password' : 'An email and a password'}. Your Roll follows you to every device. Or play without one.`,
    },
    {
      icon: Sparkles,
      title: 'No dark patterns',
      // Briefly replaced when member rooms were ruled ranked, on the reasoning
      // that a member reaching a rank sooner made "pay-to-win" false at the
      // edges. Restored (Will, 2026-09-16): pay-to-win means buying an
      // advantage over other players, and there is no leaderboard and nobody to
      // overtake, so there is no contest for a member to win. **This becomes a
      // live question the day multiplayer ships** — see cto/build-multiplayer.
      body: 'No forced pop-ups, no pay-to-win, no nagging. Ever.',
    },
    {
      icon: FaGithub,
      title: 'Open source',
      body: 'The engine and the shuffle are public on GitHub.',
    },
  ]

function TrustStrip() {
  return (
    <section className="border-y border-foreground/5 bg-foreground/[0.015]">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-px overflow-hidden px-6 py-2 sm:grid-cols-2 lg:grid-cols-4 md:px-10">
        {TRUST.map(({ icon: Icon, title, body }, i) => (
          <Reveal key={title} className="flex items-start gap-3 px-2 py-6 sm:px-6" delay={i * 0.05}>
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.05] text-foreground/70">
              <Icon className="size-4.5" />
            </span>
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-sm leading-snug text-muted-foreground">{body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* --------------------------------- venues --------------------------------- */

function Venues() {
  // A representative climb: bottom rung, a couple of mid stops, the boss.
  const ladder = [VENUES[0], VENUES[2], VENUES[4], VENUES[6], VENUES[8], VENUES[VENUES.length - 1]]

  return (
    <section
      id="venues"
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-24 md:px-10 md:py-28"
    >
      <SectionHeading
        eyebrow="Where you'll play"
        title="A ladder to climb. Side tables to raid."
        body="Ten winner-take-all tournaments, from Friends’ Garage up to The Main Event. A bigger Roll opens bigger tables."
      />

      <div className="mt-12">
        <RailHeader
          title="The ladder"
          hint="Ten rungs · the buy-in is your stack · winner takes all"
        />
        <VenueRail venues={ladder} badge={tierBadge} />
      </div>

      <div className="mt-14">
        {/* Says what it costs, on the page that shows it off. These shipped
            free and moved behind the membership on 2026-09-20, so a rail that
            advertised them without saying so would be selling the free tour on
            tables the tour no longer includes (docs/membership.md). */}
        <RailHeader
          title="Side tables"
          hint="Turbo, heads-up, bounty and deep stacks · with the membership"
        />
        <VenueRail venues={SIDE_TABLES} badge={formatBadge} />
      </div>
    </section>
  )
}

function RailHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-1">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </p>
      {hint && <p className="hidden text-sm text-muted-foreground sm:block">{hint}</p>}
    </div>
  )
}

/** Corner badge: the ladder rung number. */
const tierBadge = (v: Venue) => (
  <span
    className="flex size-6 items-center justify-center rounded-md bg-black/45 text-xs font-semibold backdrop-blur-sm"
    style={{ color: v.accent }}
  >
    {VENUES.indexOf(v) + 1}
  </span>
)

/** Corner badge: the side-table format tag (Turbo, Deep, Heads-up, …). */
const formatBadge = (v: Venue) =>
  v.format ? (
    <span
      className="rounded-md bg-black/45 px-2 py-1 text-2xs font-semibold backdrop-blur-sm"
      style={{ color: v.accent }}
    >
      {FORMAT_LABELS[v.format]}
    </span>
  ) : null

/** Edge-masked, horizontally-scrolling rail of the real venue art. */
function VenueRail({
  venues,
  badge,
}: {
  venues: readonly Venue[]
  badge: (v: Venue) => React.ReactNode
}) {
  const money = useMoney()
  return (
    <div className="relative mt-4">
      <div className="flex gap-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {venues.map((v, i) => (
          <Reveal
            key={v.id}
            className="w-56 shrink-0 overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02]"
            delay={i * 0.05}
          >
            <div className="relative aspect-[4/3]">
              <VenueArt id={v.id} accent={v.accent} className="size-full" />
              <div className="absolute left-2.5 top-2.5">{badge(v)}</div>
            </div>
            <div className="p-3.5">
              <p className="truncate font-semibold">{v.name}</p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{v.tagline}</p>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-sm font-medium tabular-nums">{money(v.buyIn)} chips</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  win {money(v.prize)}
                </span>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      {/* fade the right edge to imply the rest of the rail */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent" />
    </div>
  )
}

/* -------------------------------- features -------------------------------- */

// The real cast (config/cast.ts) — the very characters you'll sit with in the
// game, faces and bios included. Nothing on this page is a mock-up.
const REGULARS = ['doris', 'frank', 'priya', 'sal']
  .map((id) => characterById(id))
  .filter((ch): ch is Character => ch !== undefined)

function Features() {
  return (
    <section
      id="features"
      className="scroll-mt-16 border-t border-foreground/5 bg-foreground/[0.015]"
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-24 md:px-10 md:py-28">
        <SectionHeading
          eyebrow="Features"
          title="What you get at the table"
          body="AI opponents with real styles, your odds on screen, and a few things to keep."
        />

        {/* ── AI: the star feature, given a full alternating band ───────────── */}
        <div className="mt-16 grid items-center gap-10 lg:mt-20 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <FeatureIcon icon={Brain} />
            <h3 className="mt-5 text-3xl font-semibold tracking-tight text-balance">
              A cast you’ll get to know
            </h3>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground text-pretty">
              The same regulars every time, each with their own style. They value-bet, bluff and
              fold good hands, and the reads you build on them carry over between sessions.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Value-bets thin', 'Semi-bluffs', 'Sets traps', 'Career-long reads'].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-foreground/10 bg-foreground/[0.03] px-3 py-1 text-xs font-medium text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </Reveal>

          {/* the regulars — the actual cast, faces and bios straight from the game */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {REGULARS.map((r, i) => (
              <Reveal
                key={r.id}
                className="flex min-w-0 items-center gap-3 rounded-2xl border border-foreground/10 bg-background p-4"
                delay={i * 0.05}
              >
                <PlayerAvatar spec={r.avatar} size={48} className="shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.bio}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* ── Balanced feature cards, each with a contained visual ──────────── */}
        <div className="mt-6 grid gap-4 md:mt-8 md:grid-cols-2">
          <FeatureCard
            icon={CalendarDays}
            title="The Daily Deal"
            body="One tournament a day. Everyone plays the same cards against the same opponents."
          >
            <DailyShareMock />
          </FeatureCard>

          <FeatureCard
            icon={Link2}
            title="Bad beats travel"
            body="Share any hand as a link. Whoever opens it watches the replay, action by action."
          >
            <HandLinkMock />
          </FeatureCard>

          <FeatureCard
            icon={Gauge}
            title="Your odds on screen"
            body="Your win chance and hand strength sit beside your cards. Lifetime stats and a graph of your Roll are one tap away."
          >
            <EquityReadout />
          </FeatureCard>

          <FeatureCard
            icon={Palette}
            title="Make it yours"
            body="Pick an avatar and a card back, and spend winnings at the Chip Shop on decks, table finishes and souvenirs. Nothing in it changes a hand."
          >
            <CustomizeStrip />
          </FeatureCard>
        </div>

        {/* ── The quiet essentials ─────────────────────────────────────────── */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MiniFeature icon={Volume2} title="Quiet sound">
            Soft clicks for cards and chips. No jingles.
          </MiniFeature>
          <MiniFeature icon={WifiOff} title="Works offline">
            Install it and keep playing without a connection.
          </MiniFeature>
          <MiniFeature icon={Sparkles} title="Award chips">
            Win a chip for a big hand, and buy a souvenir from every venue you win.
          </MiniFeature>
        </div>
      </div>
    </section>
  )
}

function FeatureCard({
  icon,
  title,
  body,
  children,
}: {
  icon: typeof Brain
  title: string
  body: string
  children: React.ReactNode
}) {
  return (
    <Reveal
      // min-w-0: grid items refuse to shrink below their content's min-content
      // width — without it the nowrap mock lines push the whole card grid past
      // the edge of a phone screen.
      className="flex min-w-0 flex-col rounded-3xl border border-foreground/10 bg-background p-7 transition hover:border-foreground/20"
    >
      <FeatureIcon icon={icon} />
      <h3 className="mt-5 text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-2.5 text-md leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-auto pt-7">{children}</div>
    </Reveal>
  )
}

/**
 * The in-game ambient equity read, for a spot named in `landingMocks.ts`.
 *
 * Label, number and the word under it are the three things the table shows, in
 * that order. The label is flat on purpose: `evaluateHand` calls top pair top
 * kicker "Pair", and the card used to say "Top pair, good kicker" over a
 * percentage that disagreed with the sentence beneath it.
 */
function EquityReadout() {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">
          {EQUITY_SAMPLE.label}
        </span>
        <span className="text-2xl font-semibold tabular-nums leading-none text-pip">
          {EQUITY_SAMPLE.winPct}% <span className="text-2xs font-medium">win</span>
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/10">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${EQUITY_SAMPLE.winPct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="h-full rounded-full bg-pip"
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Ace-king, three players still in.</p>
    </div>
  )
}

/** A face and a fan of card backs — the two most visible personal touches. */
function CustomizeStrip() {
  return (
    <div className="flex items-center justify-center gap-6 rounded-2xl border border-foreground/10 bg-foreground/[0.02] py-6">
      {REGULARS[2] && <PlayerAvatar spec={REGULARS[2].avatar} size={56} />}
      <div className="flex -space-x-4">
        {[CARD_BACKS[0], CARD_BACKS[2], CARD_BACKS[4]].map((d, i) => (
          <div
            key={d.id}
            className={cn(
              'origin-bottom',
              i === 0 && '-rotate-[12deg]',
              i === 2 && 'rotate-[12deg]',
            )}
          >
            <CardBack design={d} size="sm" className="ring-1 ring-black/5 dark:ring-white/10" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * The Daily's copyable result line, as it comes out of the app.
 *
 * Rendered by the function the app shares with, not typed out beside it. The
 * hand-written version sat here for the month after `dailyShareText` started
 * appending `playpip.io/daily`, so the page advertising the loop was showing
 * the one part of the line that makes it a loop as absent.
 *
 * It wraps rather than truncates: the address is the last thing on the line,
 * which is exactly what `truncate` eats first on a phone.
 */
function DailyShareMock() {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 break-words font-mono text-sm text-muted-foreground">
          {dailyShareText(142, 2, THE_DAILY.seats, 34)}
        </span>
        <span className="shrink-0 rounded-lg bg-foreground/[0.06] px-2.5 py-1 text-xs font-medium">
          Copied
        </span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        <Link href="/daily" className="font-medium text-foreground transition hover:text-pip">
          How the Daily works
        </Link>
      </p>
    </div>
  )
}

/**
 * A hand permalink: the hand itself, folded into a URL.
 *
 * Encoded here by the function the game shares with, not typed out beside it.
 * The hand-written version carried six characters of token: the shape of a link
 * that points at a row in somebody's database, on the one card whose claim is
 * that there is no database. The real thing is
 * hundreds of characters, and the count under it is the length of the token
 * above it rather than a number anyone typed.
 */
function HandLinkMock() {
  const token = encodeHand(HAND_LINK_SAMPLE)
  return (
    <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5">
      <div className="flex items-center gap-2.5">
        <Link2 className="size-4 shrink-0 text-pip" />
        <span className="min-w-0 truncate font-mono text-sm text-muted-foreground">
          playpip.io/hand#{token.slice(0, HAND_LINK_VISIBLE_CHARS)}…
        </span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Quads on the river, in {token.length} characters. No server holds it.
      </p>
    </div>
  )
}

function FeatureIcon({ icon: Icon }: { icon: typeof Brain }) {
  return (
    <span className="flex size-11 items-center justify-center rounded-2xl bg-pip/15 text-pip">
      <Icon className="size-5.5" />
    </span>
  )
}

function MiniFeature({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Brain
  title: string
  children: React.ReactNode
}) {
  return (
    <Reveal className="rounded-3xl border border-foreground/10 bg-background p-6">
      <div className="flex items-center gap-2.5">
        <Icon className="size-4.5 text-foreground/60" />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </Reveal>
  )
}

/* --------------------------------- learn ---------------------------------- */

function Learn() {
  // Webb keeps the Learn section the way Pearl keeps the shop, and his own bio
  // is the line: no new character copy invented for the landing page.
  const webb = characterById('webb')
  return (
    <section id="learn" className="border-t border-foreground/5">
      {/* The hero's split, not a full-width band: a 6xl-wide paragraph is an
          unreadable measure, and the buttons left a quarter of it empty. */}
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-14 px-6 py-24 md:px-10 md:py-32 lg:grid-cols-[1.05fr_1fr]">
        <div className="max-w-xl">
          <SectionHeading
            eyebrow="Learn"
            title="Never played a hand? Start here."
            body="Level 1 is a three-minute tour of the basics. After that Webb teaches at the table: he deals a hand, asks what you would do, and you answer with the real buttons. Level 1 and every written guide are free."
          />
          <Reveal className="mt-9 flex flex-wrap items-center gap-3" delay={0.1}>
            <Link
              href="/tutorial"
              onClick={() => sound.play('tap')}
              className="rounded-2xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
            >
              Take the tour
            </Link>
            <Link
              href="/learn"
              onClick={() => sound.play('tap')}
              className="inline-flex items-center gap-1.5 rounded-2xl px-5 py-3.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Read the guides
              <ArrowRight className="size-3.5" />
            </Link>
          </Reveal>
        </div>

        <GuideShowpiece webb={webb} />
      </div>
    </section>
  )
}

/**
 * The top of the rankings guide, rendered as the guide itself rather than
 * described. Same principle as the hero table: show the real thing. The full
 * ten hands, and the wording, live at /learn/hand-rankings — this is the first
 * five, and that page stays the source of truth.
 */
const RANKING_ROWS = [
  { hand: 'Royal flush', cards: ['A♠', 'K♠', 'Q♠', 'J♠', '10♠'] },
  { hand: 'Straight flush', cards: ['9♥', '8♥', '7♥', '6♥', '5♥'] },
  { hand: 'Four of a kind', cards: ['Q♣', 'Q♦', 'Q♥', 'Q♠', '4♦'] },
  { hand: 'Full house', cards: ['7♠', '7♦', '7♣', 'K♥', 'K♠'] },
  { hand: 'Flush', cards: ['A♦', 'J♦', '8♦', '5♦', '2♦'] },
] as const

function GuideShowpiece({ webb }: { webb?: Character }) {
  const guide = guideBySlug('hand-rankings')
  if (!guide) return null

  return (
    <Reveal delay={0.05}>
      <Link
        href={`/learn/${guide.slug}`}
        onClick={() => sound.play('tap')}
        className="group block overflow-hidden rounded-3xl border border-foreground/10 bg-background shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.12)] transition hover:border-foreground/20"
      >
        {/* byline — Webb as the author, which is what he is here */}
        <div className="flex items-center gap-3 border-b border-foreground/5 px-6 py-4">
          {webb && <PlayerAvatar spec={webb.avatar} size={32} />}
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Webb</span> · Learn
          </p>
        </div>

        <div className="px-6 pt-5 pb-6">
          <h3 className="text-lg font-semibold tracking-tight">{guide.title}</h3>

          <ul className="mt-4 space-y-2">
            {RANKING_ROWS.map((row, i) => (
              <li key={row.hand} className="flex items-center gap-3">
                <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground/60">
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-sm font-medium">{row.hand}</span>
                <span className="flex shrink-0 gap-1">
                  {row.cards.map((card) => (
                    <span
                      key={card}
                      // Fixed size, not padded to fit: "10♠" is wider than "A♠",
                      // so content-sized tiles put every row's columns in a
                      // different place.
                      className={cn(
                        'inline-flex h-6 w-9 items-center justify-center rounded border border-foreground/10 bg-foreground/[0.02] text-2xs leading-none font-medium tabular-nums',
                        card.includes('♥') || card.includes('♦')
                          ? 'text-suit-red'
                          : 'text-foreground',
                      )}
                    >
                      {card}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>

          {/* the page carries on past the fold, so the card says so */}
          <div className="relative mt-2 h-10">
            <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-transparent to-background" />
            <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition group-hover:text-foreground">
              Read the guide
              <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </Link>
    </Reveal>
  )
}

/* ------------------------------- membership ------------------------------- */

// The one place on the landing page that says what is paid, next to what is
// not, so nobody has to find the fence by walking into it. The free column is
// the core game from docs/membership.md; the member column is generated from
// `sellableFeatures()`, the same list /membership renders, so this page cannot
// advertise anything unbuilt. The price comes from config/membership.ts.
const FREE_FOREVER = [
  'The ten-venue ladder',
  'The Rail’s cash games',
  'The Daily Deal',
  'The Kitchen Table freeroll',
  'The Chip Shop',
  'The read on every hand',
  'Two drills',
  'Level 1 of Lessons with Webb',
  'Every written guide',
  'The odds calculator',
  'Your Roll on every device',
]

function Membership() {
  const features = sellableFeatures()
  return (
    <section
      id="membership"
      className="scroll-mt-16 border-t border-foreground/5 bg-foreground/[0.015]"
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-24 md:px-10 md:py-28">
        <SectionHeading
          eyebrow="Free, and the membership"
          title="The game is free. The membership adds to it."
          body="The ladder, the Rail, the Daily and the freeroll are free for good. The membership adds the side tables, other games, the rest of Webb’s lessons and drills, and reports on your play."
        />

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <Reveal className="flex min-w-0 flex-col rounded-3xl border border-foreground/10 bg-background p-7">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Free, for good
            </p>
            <p className="mt-3 text-2xl font-semibold tracking-tight">Nothing to pay</p>
            <ul className="mt-6 space-y-2.5">
              {FREE_FOREVER.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-foreground/50" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-8">
              <PlayButton size="lg" />
            </div>
          </Reveal>

          <Reveal
            className="flex min-w-0 flex-col rounded-3xl border border-pip/30 bg-background p-7"
            delay={0.05}
          >
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-pip">
              The membership
            </p>
            <p className="mt-3 text-2xl font-semibold tracking-tight">
              {MEMBERSHIP_PRICE.monthly}
              <span className="text-base font-normal text-muted-foreground">
                {' '}
                a month, or {MEMBERSHIP_PRICE.annual} a year
              </span>
            </p>
            <ul className="mt-6 space-y-2.5">
              {features.map((feature) => (
                <li key={feature.id} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-pip" />
                  {feature.title}
                </li>
              ))}
            </ul>
            <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-8">
              <Link
                href="/membership"
                onClick={() => sound.play('tap')}
                className="group inline-flex items-center gap-2 rounded-2xl bg-foreground/[0.06] px-6 py-3.5 text-base font-semibold transition hover:bg-foreground/10 active:scale-[0.98]"
              >
                See the membership
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </Link>
              <span className="text-sm text-muted-foreground">Cancel any time.</span>
            </div>
          </Reveal>
        </div>

        <p className="mt-6 max-w-2xl text-sm text-muted-foreground text-pretty">
          {MEMBERSHIP_PROMISES[1]} Nothing at the table ever mentions it.
        </p>
      </div>
    </section>
  )
}

/* -------------------------------- final CTA ------------------------------- */

function FinalCta() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(50%_80%_at_50%_100%,color-mix(in_oklch,var(--color-pip)_14%,transparent),transparent_70%)]"
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 py-28 text-center md:px-10 md:py-36">
        <Reveal>
          <h2 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
            Pull up a chair.
          </h2>
        </Reveal>
        <Reveal delay={0.05}>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground text-pretty">
            Press Play and you’re dealt in at Friends’ Garage. The whole ladder is free.
          </p>
        </Reveal>
        <Reveal className="mt-9 flex flex-wrap items-center justify-center gap-3" delay={0.1}>
          <PlayButton size="lg" />
          {/* The quiet second door. The app has no signup route (the account
              is a dialog), so this lands on the lobby and asks it to open the
              form, which is where the same button in the app opens it too. */}
          <Link
            href="/game?account=new"
            onClick={() => sound.play('tap')}
            className="rounded-2xl px-5 py-3.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Create a free account
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

/* --------------------------------- footer --------------------------------- */

/* ------------------------------- play button ------------------------------ */

/**
 * The primary CTA. Reads the local profile (hydration-gated) so returning
 * players see “Continue” with their Roll, while newcomers see “Play free.”
 */
function PlayButton({ size = 'lg', className }: { size?: 'sm' | 'lg'; className?: string }) {
  const hydrated = useHydrated()
  const created = useProfile((s) => s.created)
  const roll = useProfile((s) => s.roll)
  const money = useMoney()

  const returning = hydrated && created
  const label = returning ? 'Continue' : 'Play free'

  if (size === 'sm') {
    return (
      <Link
        href="/game"
        onClick={() => sound.play('tap')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.97]',
          className,
        )}
      >
        {label}
      </Link>
    )
  }

  return (
    <Link
      href="/game"
      onClick={() => sound.play('call')}
      className={cn(
        'group inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]',
        className,
      )}
    >
      {label}
      {returning && (
        <span className="tabular-nums text-primary-foreground/60">· {money(roll)} chips</span>
      )}
      <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
    </Link>
  )
}

/**
 * The way back for a returning player on a new device. Play would deal them in
 * as somebody new; this opens sign-in on the lobby instead, and the blank player
 * made there is replaced by theirs (lib/sync/plan: a pristine device restores).
 * Gone once this browser has a player, who has the AppBar's account button.
 */
function SignInLink() {
  const hydrated = useHydrated()
  const created = useProfile((s) => s.created)
  // A build with no accounts behind it has nothing to sign in to.
  if (!syncConfigured() || (hydrated && created)) return null
  return (
    <p style={riseDelay(4)} className="rise-in mt-2 text-sm text-muted-foreground">
      Already have an account?{' '}
      <Link
        href="/game?account=signin"
        onClick={() => sound.play('tap')}
        className="font-medium text-foreground underline-offset-2 transition hover:text-pip hover:underline"
      >
        Sign in
      </Link>
    </p>
  )
}

/* -------------------------------- shared bits ----------------------------- */

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string
  title: string
  body: string
}) {
  return (
    <Reveal className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-pip">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance md:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-pretty">{body}</p>
    </Reveal>
  )
}

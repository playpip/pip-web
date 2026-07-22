'use client'

// The marketing landing page ("/"). The app itself lives at "/game". Built from
// the real product primitives — VenueArt, CardBack, the cast — plus a recorded
// hand for the hero, so nothing here is a mock-up: what you see on the page is
// what you get at the table. Flat,
// black-first, one accent (pip). Works in both light and dark (see docs/design.md).

import Link from 'next/link'
import { motion, type Variants } from 'framer-motion'
import {
  ArrowRight,
  Brain,
  CalendarDays,
  Gauge,
  Link2,
  Palette,
  ShieldCheck,
  Spade,
  Sparkles,
  Volume2,
  WifiOff,
} from 'lucide-react'
import { FaGithub } from 'react-icons/fa'
import { CardBack } from '@/components/CardBack'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Wordmark } from './Wordmark'
import { VenueArt } from '@/components/menu/VenueArt'
import { VENUES, SIDE_TABLES, FORMAT_LABELS, type Venue } from '@/config/venues'
import { CARD_BACKS } from '@/config/cardBacks'
import { characterById, type Character } from '@/config/cast'
import { useProfile } from '@/store/profile'
import { useHydrated } from '@/lib/useHydrated'
import { useMoney } from '@/lib/useMoney'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------------- */

export function Landing() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <Header />
      <main className="flex-1">
        <Hero />
        <TrustStrip />
        <Venues />
        <Features />
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
          <a
            href="https://github.com/playpip/pip-web"
            target="_blank"
            rel="noreferrer"
            aria-label="Pip on GitHub"
            className="rounded-full p-2 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
          >
            <FaGithub className="size-4" />
          </a>
          <ThemeToggle />
          <PlayButton size="sm" className="ml-1" />
        </nav>
      </div>
    </header>
  )
}

/* ---------------------------------- hero ---------------------------------- */

const rise: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.05 * i, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
}

function Hero() {
  return (
    <section className="relative">
      {/* soft pip glow — the single accent, low alpha so it reads calm not neon */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_50%_-10%,color-mix(in_oklch,var(--color-pip)_16%,transparent),transparent_70%)]"
      />
      <GhostSuits />

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-14 px-6 pt-16 pb-20 md:px-10 md:pt-24 md:pb-28 lg:grid-cols-[1.05fr_1fr]">
        {/* copy */}
        <div className="max-w-xl">
          <motion.div variants={rise} initial="hidden" animate="show" custom={0}>
            <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.03] px-3 py-1 text-xs font-medium text-muted-foreground">
              <Spade className="size-3.5 fill-current text-pip" />
              Single-player Texas Hold&rsquo;em, redesigned
            </span>
          </motion.div>

          <motion.h1
            variants={rise}
            initial="hidden"
            animate="show"
            custom={1}
            className="mt-6 text-5xl font-semibold leading-[1.02] tracking-tight text-balance md:text-6xl lg:text-7xl"
          >
            Poker without
            <br />
            the casino.
          </motion.h1>

          <motion.p
            variants={rise}
            initial="hidden"
            animate="show"
            custom={2}
            className="mt-6 text-lg leading-relaxed text-muted-foreground text-pretty"
          >
            Real Hold&rsquo;em against AI that plays a proper game &mdash; wrapped in a calm, modern
            app. No fake felt, no neon, no pop-ups. Just the table, your Roll, and the next hand.
          </motion.p>

          <motion.div
            variants={rise}
            initial="hidden"
            animate="show"
            custom={3}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <PlayButton size="lg" />
            <a
              href="#features"
              className="rounded-2xl px-5 py-3.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              See how it plays
            </a>
          </motion.div>

          <motion.p
            variants={rise}
            initial="hidden"
            animate="show"
            custom={4}
            className="mt-4 text-sm text-muted-foreground"
          >
            Plays in your browser &mdash; no download, no sign-up. Loads in a second.
          </motion.p>

          <motion.p
            variants={rise}
            initial="hidden"
            animate="show"
            custom={5}
            className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground"
          >
            <span>No account</span>
            <Dot />
            <span>Open source</span>
            <Dot />
            <span>Play money, always</span>
          </motion.p>
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

function Dot() {
  return <span className="text-foreground/25">&middot;</span>
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
 * Muted autoplay loop; falls back to a static poster for reduced-motion users
 * (the brand is calm — never flashing for attention). 5:4 to match the capture.
 */
function HeroTable() {
  const reducedMotion = usePrefersReducedMotion()
  return (
    <motion.div
      variants={rise}
      initial="hidden"
      animate="show"
      custom={2}
      className="relative flex items-center justify-center"
    >
      {/* soft focus glow behind the frame */}
      <div
        aria-hidden
        className="pointer-events-none absolute size-[32rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--color-pip)_20%,transparent),transparent_70%)] blur-3xl"
      />
      <div className="relative aspect-[5/4] w-full overflow-hidden rounded-3xl border border-foreground/10 bg-background shadow-2xl shadow-black/30 ring-1 ring-black/5 dark:shadow-black/60 dark:ring-white/5">
        {reducedMotion ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/hero-poster.jpg"
            alt="A hand at the Garage — a full house wins 136 at showdown"
            className="size-full object-cover"
          />
        ) : (
          <video
            className="size-full object-cover"
            poster="/hero-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-label="Gameplay: a full house wins at showdown at the Garage"
          >
            <source src="/hero.mp4" type="video/mp4" />
          </video>
        )}
      </div>
    </motion.div>
  )
}

/* --------------------------------- trust ---------------------------------- */

const TRUST: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }[] =
  [
    {
      icon: ShieldCheck,
      title: 'No real money',
      body: 'Play-money chips only. No wallet, no losses, no “buy more.”',
    },
    {
      icon: WifiOff,
      title: 'No account',
      body: 'Nothing to sign up for, nothing to verify. Your progress lives on your device, not ours.',
    },
    {
      icon: Sparkles,
      title: 'No dark patterns',
      body: 'No forced pop-ups, no pay-to-win, no nagging. Ever.',
    },
    {
      icon: FaGithub,
      title: 'Open source',
      body: 'Every hand, shuffle, and line of the engine is public. Read it, fork it, self-host it.',
    },
  ]

function TrustStrip() {
  return (
    <section className="border-y border-foreground/5 bg-foreground/[0.015]">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-px overflow-hidden px-6 py-2 sm:grid-cols-2 lg:grid-cols-4 md:px-10">
        {TRUST.map(({ icon: Icon, title, body }, i) => (
          <motion.div
            key={title}
            variants={rise}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            custom={i}
            className="flex items-start gap-3 px-2 py-6 sm:px-6"
          >
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.05] text-foreground/70">
              <Icon className="size-4.5" />
            </span>
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-sm leading-snug text-muted-foreground">{body}</p>
            </div>
          </motion.div>
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
        body="Ten winner-take-all venues, Friends’ Garage up to The Main Event, plus side tables that bend the format. Same clean game throughout — the Garage forgives, the Main Event doesn’t."
      />

      <div className="mt-12">
        <RailHeader
          title="The ladder"
          hint="Ten rungs · the buy-in is your stack · winner takes all"
        />
        <VenueRail venues={ladder} badge={tierBadge} />
      </div>

      <div className="mt-14">
        <RailHeader
          title="Side tables"
          hint="Same game, different pressure — none of them gate your climb"
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
      className="rounded-md bg-black/45 px-2 py-1 text-[11px] font-semibold backdrop-blur-sm"
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
          <motion.div
            key={v.id}
            variants={rise}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            custom={i}
            className="w-56 shrink-0 overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02]"
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
          </motion.div>
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
          eyebrow="Built to respect you"
          title="Everything the game needs. Nothing it doesn’t."
          body="A pure, deterministic poker engine under a quiet, tactile interface. The sharp stuff runs deep; the surface stays calm."
        />

        {/* ── AI: the star feature, given a full alternating band ───────────── */}
        <div className="mt-16 grid items-center gap-10 lg:mt-20 lg:grid-cols-2 lg:gap-16">
          <motion.div
            variants={rise}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
          >
            <FeatureIcon icon={Brain} />
            <h3 className="mt-5 text-3xl font-semibold tracking-tight text-balance">
              A cast you&rsquo;ll get to know
            </h3>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground text-pretty">
              Pip seats a fixed troupe of regulars, not random bots. Each weighs Monte-Carlo equity
              against pot odds through a personality of their own — they value-bet thin, float,
              barrel, and lay hands down. And they remember you: your reads on them build across
              sessions, like a real home game.
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
          </motion.div>

          {/* the regulars — the actual cast, faces and bios straight from the game */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {REGULARS.map((r, i) => (
              <motion.div
                key={r.id}
                variants={rise}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-60px' }}
                custom={i}
                className="flex min-w-0 items-center gap-3 rounded-2xl border border-foreground/10 bg-background p-4"
              >
                <PlayerAvatar spec={r.avatar} size={48} className="shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.bio}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Balanced feature cards, each with a contained visual ──────────── */}
        <div className="mt-6 grid gap-4 md:mt-8 md:grid-cols-2">
          <FeatureCard
            icon={CalendarDays}
            title="The Daily Deal"
            body="One seeded tournament a day — everyone in the world plays the identical shuffle, and because the engine is open source, that's provable. Same cards, same opponents; your play makes the difference."
          >
            <DailyShareMock />
          </FeatureCard>

          <FeatureCard
            icon={Link2}
            title="Bad beats travel"
            body="Share any hand as a link — the whole hand lives in the URL, no server, no account. Whoever opens it watches the replay, action by action, cards and all."
          >
            <HandLinkMock />
          </FeatureCard>

          <FeatureCard
            icon={Gauge}
            title="Calm information"
            body="Live win-% and hand strength sit quietly at the table — there when you want them, never flashing for attention. Lifetime stats and your Roll-over-time graph are one tap away."
          >
            <EquityReadout />
          </FeatureCard>

          <FeatureCard
            icon={Palette}
            title="Make it yours"
            body="Build an avatar, pick a card back, and spend winnings at the Chip Shop — decks, table finishes, souvenirs. Style and story, never edge: nothing for sale touches the odds."
          >
            <CustomizeStrip />
          </FeatureCard>
        </div>

        {/* ── The quiet essentials ─────────────────────────────────────────── */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MiniFeature icon={Volume2} title="Tactile, not casino">
            Clean SFX synthesised in the browser — quiet blips, no coin-clatter or jingles.
          </MiniFeature>
          <MiniFeature icon={WifiOff} title="Yours & offline">
            Fully local. Install it, pull the plug, keep playing — your profile never leaves your
            device.
          </MiniFeature>
          <MiniFeature icon={Sparkles} title="A shelf worth filling">
            Earn one-off award chips for heroic hands — and buy souvenir chips of every venue you
            conquer. The gaps are the goal list.
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
    <motion.div
      variants={rise}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      // min-w-0: grid items refuse to shrink below their content's min-content
      // width — without it the nowrap mock lines push the whole card grid past
      // the edge of a phone screen.
      className="flex min-w-0 flex-col rounded-3xl border border-foreground/10 bg-background p-7 transition hover:border-foreground/20"
    >
      <FeatureIcon icon={icon} />
      <h3 className="mt-5 text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-auto pt-7">{children}</div>
    </motion.div>
  )
}

/** A calm, contained mock of the in-game ambient equity read. */
function EquityReadout() {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Your equity
        </span>
        <span className="text-2xl font-semibold tabular-nums leading-none text-pip">72%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/10">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: '72%' }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="h-full rounded-full bg-pip"
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Top pair, good kicker · ahead of 4 in 5 hands
      </p>
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

/** The Daily's copyable result line, as it comes out of the app. */
function DailyShareMock() {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5">
      <div className="flex items-center justify-between gap-3">
        {/* min-w-0: without it the nowrap line sets the card's min-content and
            the whole feature grid overflows the phone screen */}
        <span className="min-w-0 truncate font-mono text-sm text-muted-foreground">
          pip daily #142 · 2nd of 5 · 34 hands
        </span>
        <span className="shrink-0 rounded-lg bg-foreground/[0.06] px-2.5 py-1 text-xs font-medium">
          Copied
        </span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        No streaks, no countdowns — tomorrow is simply another deal.
      </p>
    </div>
  )
}

/** A hand permalink — the hand itself, folded into a URL. */
function HandLinkMock() {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5">
      <div className="flex items-center gap-2.5">
        <Link2 className="size-4 shrink-0 text-pip" />
        <span className="min-w-0 truncate font-mono text-sm text-muted-foreground">
          playpip.io/hand#kQyJ3v…
        </span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Kings full, rivered by quads. They have to see it to believe it.
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
    <motion.div
      variants={rise}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      className="rounded-3xl border border-foreground/10 bg-background p-6"
    >
      <div className="flex items-center gap-2.5">
        <Icon className="size-4.5 text-foreground/60" />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </motion.div>
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
        <motion.h2
          variants={rise}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="max-w-2xl text-4xl font-semibold tracking-tight text-balance md:text-6xl"
        >
          Pull up a chair.
        </motion.h2>
        <motion.p
          variants={rise}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          custom={1}
          className="mt-5 max-w-lg text-lg text-muted-foreground text-pretty"
        >
          Make a player, take a seat at the Garage, and see how far your Roll climbs. It&rsquo;s
          free — and with nothing to sell you, it stays that way.
        </motion.p>
        <motion.div
          variants={rise}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          custom={2}
          className="mt-9"
        >
          <PlayButton size="lg" />
        </motion.div>
      </div>
    </section>
  )
}

/* --------------------------------- footer --------------------------------- */

function Footer() {
  return (
    <footer className="border-t border-foreground/5">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center md:px-10">
        <div>
          <Wordmark />
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            Casual Texas Hold&rsquo;em, redesigned. Free, open source, and play money — never real
            gambling.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <a href="#features" className="transition hover:text-foreground">
            Features
          </a>
          <a href="#venues" className="transition hover:text-foreground">
            Venues
          </a>
          <Link href="/privacy" className="transition hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="transition hover:text-foreground">
            Terms
          </Link>
          <Link href="/credits" className="transition hover:text-foreground">
            Credits
          </Link>
          <a
            href="https://github.com/playpip/pip-web"
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-foreground"
          >
            GitHub
          </a>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  )
}

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
        <span className="tabular-nums text-primary-foreground/60">
          &middot; {money(roll)} chips
        </span>
      )}
      <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
    </Link>
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
    <motion.div
      variants={rise}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      className="max-w-2xl"
    >
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-pip">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance md:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-pretty">{body}</p>
    </motion.div>
  )
}

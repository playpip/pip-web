import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Calculator, Target } from 'lucide-react'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { LegalPage } from '@/components/marketing/LegalPage'
import { characterById } from '@/config/cast'
import { ANSWER_PAGES, type LearnGuide, PILLAR_GUIDES } from '@/config/learn'
import { contentAlternates, contentSocial } from '@/config/site'

// The Learn hub: the three-minute tour and every written guide, in one place.
//
// This route was the tour itself until 2026-08-05. The tour moved to /tutorial
// and this became the index, so that the URL people arrive at from a search is
// a page that lists what we have rather than a pager they have to sit through.
//
// It is a shelf, not a document, and until 2026-09-09 it was laid out as one:
// a prose column, four headings each with its own paragraph, and every guide a
// bordered rectangle of grey text. Every pillar guide already owns artwork cut
// from the product's own card faces and this was the one page that showed none
// of it (#102). So: the wide column, the art, and one heading per section
// rather than a heading and a blurb.

const DESCRIPTION =
  'Learn Texas Hold’em properly: a three-minute interactive tour, plus written guides on hand rankings and the rest. Free, no signup, nothing to install.'

export const metadata: Metadata = {
  title: 'Learn poker · Pip',
  description: DESCRIPTION,
  alternates: contentAlternates('/learn'),
  ...contentSocial({
    path: '/learn',
    title: 'Learn poker',
    description: DESCRIPTION,
    type: 'website',
  }),
}

/** A section heading. The blurb under each one said what the links say. */
function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-14 text-lg font-semibold tracking-tight">{children}</h2>
}

/**
 * A pillar guide, led by its picture.
 *
 * `alt=""` on purpose: the heading below the image is the link's accessible
 * name and says the same thing, so the registry's descriptive alt would read
 * out twice. The guide's own page still renders it with the full text, where
 * the picture is the content rather than the label.
 *
 * The description is clamped rather than shortened, because it is the guide's
 * search description and belongs to the sitemap and the mirrors too. Two lines
 * is the shelf's job: say what the guide covers, then get out of the way.
 */
function GuideCard({ guide, eager }: { guide: LearnGuide; eager: boolean }) {
  return (
    <Link
      href={`/learn/${guide.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-foreground/10 transition hover:border-foreground/20 hover:bg-foreground/[0.02]"
    >
      {guide.hero && (
        // A plain <img> for the same reason the guides use one: a static export
        // has no optimiser, and the registry's real dimensions reserve the
        // space so the grid does not jump as the files land.
        <img
          src={guide.hero.src}
          alt=""
          width={guide.hero.width}
          height={guide.hero.height}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className="h-auto w-full border-b border-foreground/10"
        />
      )}
      <div className="p-5">
        <h3 className="flex items-center gap-1.5 text-[1.0625rem] font-semibold tracking-tight">
          {guide.title}
          <ArrowRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
        </h3>
        <p className="mt-1.5 line-clamp-2 text-md leading-relaxed text-muted-foreground">
          {guide.description}
        </p>
      </div>
    </Link>
  )
}

/**
 * An answer page: one question, one number. A row rather than a card, because
 * they have no artwork and a card without a picture next to six that have one
 * looks like a picture that failed to load. The shape is also the promise: a
 * guide is a sitting-down read, this is a line you glance at.
 */
function AnswerRow({ page }: { page: LearnGuide }) {
  return (
    <li>
      <Link
        href={`/learn/${page.slug}`}
        className="group flex items-center gap-4 p-5 transition hover:bg-foreground/[0.02]"
      >
        {/* Real block elements, not styled spans: gen-llms.mjs turns this page
            into Markdown, and two spans come out as one run-on sentence with
            the title welded to the description. */}
        <div className="min-w-0">
          <h3 className="font-semibold tracking-tight">{page.title}</h3>
          <p className="mt-1 line-clamp-1 text-md leading-relaxed text-muted-foreground">
            {page.description}
          </p>
        </div>
        <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
      </Link>
    </li>
  )
}

/** A destination in the app rather than a page to read. */
function DoCard({
  href,
  icon: Icon,
  title,
  children,
}: {
  href: string
  icon: typeof Calculator
  title: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-foreground/10 p-5 transition hover:border-foreground/20 hover:bg-foreground/[0.02]"
    >
      <Icon className="size-5 text-muted-foreground transition group-hover:text-foreground" />
      <h3 className="mt-3 flex items-center gap-1.5 text-[1.0625rem] font-semibold tracking-tight">
        {title}
        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
      </h3>
      <p className="mt-1.5 text-md leading-relaxed text-muted-foreground">{children}</p>
    </Link>
  )
}

export default function LearnPage() {
  const webb = characterById('webb')
  return (
    <LegalPage title="Learn poker" subtitle="Guides, a tour and drills. All free, no signup." wide>
      {/* Webb keeps this section the way Pearl keeps the shop. He is on the
          page, not in the guides: the guides are teaching prose, and the dry
          register belongs to the chrome around them. His line is the page's
          byline, which is why it survived the cut that took the four section
          blurbs: it is the one bit of the chrome that is not a description of
          the links underneath it. */}
      {webb && (
        <div className="mb-8 flex items-center gap-4">
          <PlayerAvatar spec={webb.avatar} size={56} />
          <div className="min-w-0">
            <p className="font-medium">Webb</p>
            <p className="text-md leading-relaxed text-muted-foreground">
              Wrote the book. This is the shelf.
            </p>
          </div>
        </div>
      )}

      <Link
        href="/tutorial"
        className="group block rounded-3xl border border-foreground/10 bg-foreground/[0.03] p-6 transition hover:border-foreground/20 sm:p-8"
      >
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Start here
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
          Learn poker in three minutes
        </h2>
        <p className="mt-2 max-w-xl text-md leading-relaxed text-muted-foreground">
          An interactive tour of the basics in eight short pages, built from the real game. No quiz,
          nothing to sign up for, and you can skip out at any point.
        </p>
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
          Take the tour
          <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </Link>

      {PILLAR_GUIDES.length > 0 && (
        <section>
          <Heading>Written guides</Heading>
          {/* The first two are what a reader sees without scrolling, so they
              load eagerly and the rest wait. Six heroes is most of this page's
              weight and none of it is worth blocking the fold for. */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {PILLAR_GUIDES.map((guide, index) => (
              <GuideCard key={guide.slug} guide={guide} eager={index < 2} />
            ))}
          </div>
        </section>
      )}

      {/* Separate section rather than more cards in the grid above, because
          they are a different promise: a guide is a sitting-down read, an
          answer page is one number and the working behind it. */}
      {ANSWER_PAGES.length > 0 && (
        <section>
          <Heading>Quick answers</Heading>
          <ul className="mt-6 divide-y divide-foreground/10 overflow-hidden rounded-2xl border border-foreground/10">
            {ANSWER_PAGES.map((page) => (
              <AnswerRow key={page.slug} page={page} />
            ))}
          </ul>
        </section>
      )}

      {/* The doing half, which is in the app rather than on this side of the
          wall: reading and doing are different things, and doing one is closer
          to sitting at a table than it is to reading a guide. Out of the guide
          grid rather than another card in it, because that grid is what a
          search brought most people here for, and one section rather than the
          two they used to have: two headings and two blurbs for two links was
          more chrome than content. The calculator had no internal link from
          anywhere on the site until 2026-09-03 while out-earning every guide on
          this page in Google impressions, so the reason it is here is
          discoverability rather than tidiness. */}
      <section>
        <Heading>Then try it</Heading>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <DoCard href="/game/drills" icon={Target} title="Drills">
            One question at a time, dealt fresh and marked by the engine, with the arithmetic
            underneath it. Free, unlimited, no signup.
          </DoCard>
          <DoCard href="/poker-odds-calculator" icon={Calculator} title="Poker odds calculator">
            Your two cards, the board if there is one, and how many people you are against. It deals
            the hand out and counts who wins.
          </DoCard>
        </div>
      </section>
    </LegalPage>
  )
}

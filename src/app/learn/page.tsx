import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Calculator, Target } from 'lucide-react'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { CourseShelf } from '@/components/learn/CourseShelf'
import { LegalPage } from '@/components/marketing/LegalPage'
import { characterById } from '@/config/cast'
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
    <LegalPage
      title="Learn poker"
      subtitle="Lessons at the table, a tour, guides and drills. Level 1 and every guide are free, no signup."
      wide
    >
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

      {/* Webb's shelf, reading and doing on one timeline: five levels, each
          its guides (always free), then its lesson and practice at the table.
          The guides used to have a grid of their own below this and the quick
          answers a list, and the tour a "Start here" card above it — the same
          things offered twice, in three shapes (Will, 2026-09-23: "I love the
          timeline effect"). Every guide is on the timeline exactly once, which
          tests/learn.test.ts holds, because this is the only link to them.
          See components/learn/CourseShelf.tsx. */}
      <CourseShelf />

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
            underneath it. Two are free for everyone, the rest come with the membership, and none of
            them is ever metered.
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

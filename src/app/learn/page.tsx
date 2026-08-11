import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { LegalPage } from '@/components/marketing/LegalPage'
import { characterById } from '@/config/cast'
import { LEARN_GUIDES } from '@/config/learn'
import { contentAlternates, contentSocial } from '@/config/site'

// The Learn hub: the three-minute tour and every written guide, in one place.
//
// This route was the tour itself until 2026-08-05. The tour moved to /tutorial
// and this became the index, so that the URL people arrive at from a search is
// a page that lists what we have rather than a pager they have to sit through.

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

export default function LearnPage() {
  const webb = characterById('webb')
  return (
    <LegalPage
      title="Learn poker"
      subtitle="A three-minute tour to get you playing, and written guides for when you want the detail. All free, no signup."
    >
      {/* Webb keeps this section the way Pearl keeps the shop. He is on the
          page, not in the guides: the guides are teaching prose, and the dry
          register belongs to the chrome around them. */}
      {webb && (
        <div className="mb-10 flex items-center gap-4">
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
        className="group block rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-6 transition hover:border-foreground/20"
      >
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Start here
        </p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight">Learn poker in three minutes</h2>
        <p className="mt-1.5 text-md leading-relaxed text-muted-foreground">
          An interactive tour of the basics in eight short pages, built from the real game. No quiz,
          nothing to sign up for, and you can skip out at any point.
        </p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
          Take the tour
          <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </Link>

      {LEARN_GUIDES.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight">Written guides</h2>
          <p className="mt-2 text-md leading-relaxed text-muted-foreground">
            One topic each, in plain English. Read them in any order.
          </p>
          {/* Cards, not bare headings: a guide sitting under the section's own
              heading-and-paragraph looked like more prose, and nothing said it
              could be clicked. */}
          <ul className="mt-6 space-y-3">
            {LEARN_GUIDES.map((guide) => (
              <li key={guide.slug}>
                <Link
                  href={`/learn/${guide.slug}`}
                  className="group block rounded-2xl border border-foreground/10 p-5 transition hover:border-foreground/20 hover:bg-foreground/[0.02]"
                >
                  <h3 className="flex items-center gap-1.5 text-[1.0625rem] font-semibold tracking-tight">
                    {guide.title}
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </h3>
                  <p className="mt-1.5 text-md leading-relaxed text-muted-foreground">
                    {guide.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </LegalPage>
  )
}

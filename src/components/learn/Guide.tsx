// The frame for a written guide under /learn/<slug>. Prose pages, so they use
// the same narrow marketing column as the blog and the legal pages rather than
// anything new — the only additions are a table that survives a phone, and the
// structured data that gets a rankings table pulled into a rich result.

import Link from 'next/link'
import { LegalPage } from '@/components/marketing/LegalPage'
import { PlayCta } from '@/components/marketing/PlayCta'
import { type GuideArt, guideArtUrl, guideBySlug, relatedGuides } from '@/config/learn'

const SITE = 'https://playpip.io'

/**
 * Guide artwork. A plain <img> rather than next/image: the app is a static
 * export with no optimiser, and these are pre-sized PNGs from the capture
 * harness. width/height come from the registry so the space is reserved
 * before the file lands and the prose doesn't jump.
 */
function Art({
  art,
  eager = false,
  className = '',
}: {
  art: GuideArt
  /** True for the hero, which is the largest thing above the fold. */
  eager?: boolean
  className?: string
}) {
  return (
    <img
      src={art.src}
      alt={art.alt}
      width={art.width}
      height={art.height}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={`h-auto w-full rounded-2xl border border-foreground/10 ${className}`}
    />
  )
}

/**
 * A guide's in-body chart, placed by the page rather than by this frame,
 * because only the page knows which passage it illustrates.
 */
export function GuideChart({ slug }: { slug: string }) {
  const art = guideBySlug(slug)?.chart
  if (!art) return null
  return (
    <figure className="mt-6">
      <Art art={art} />
    </figure>
  )
}

/**
 * A guide's page chrome: the marketing column, the Article structured data,
 * and the sibling links at the foot. Siblings that haven't been written yet
 * are dropped by relatedGuides(), so the block simply gets shorter.
 */
export function GuidePage({ slug, children }: { slug: string; children: React.ReactNode }) {
  const guide = guideBySlug(slug)
  if (!guide) throw new Error(`No registry entry for /learn/${slug} — add one to config/learn.ts`)
  const siblings = relatedGuides(slug)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.metaTitle,
    description: guide.description,
    datePublished: guide.date,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE}/learn/${guide.slug}` },
    author: { '@type': 'Organization', name: 'Pip', url: SITE },
    publisher: { '@type': 'Organization', name: 'Pip', url: SITE },
    isAccessibleForFree: true,
    // Both, where they exist: Google's Article rich result wants an image, and
    // the chart is the one worth showing next to a rankings query.
    ...(guide.hero || guide.chart
      ? { image: [guide.hero, guide.chart].filter((art) => art !== undefined).map(guideArtUrl) }
      : {}),
  }

  return (
    <LegalPage title={guide.title} back={{ href: '/learn', label: 'Learn poker' }}>
      {/* Stripped from the Markdown mirrors by gen-llms.mjs, which drops <script>. */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: a build-time constant, no user input
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {guide.hero && <Art art={guide.hero} eager className="mb-8" />}

      {children}

      {siblings.length > 0 && (
        <section className="mt-12 border-t border-foreground/10 pt-6">
          <h2 className="text-sm font-medium text-foreground">Keep going</h2>
          <ul className="mt-3 space-y-2">
            {siblings.map((sibling) => (
              <li key={sibling.slug}>
                <Link
                  href={`/learn/${sibling.slug}`}
                  className="text-[15px] text-muted-foreground underline decoration-foreground/20 underline-offset-2 transition hover:text-foreground hover:decoration-foreground"
                >
                  {sibling.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </LegalPage>
  )
}

/**
 * An inline link to a sibling guide, by slug. A guide that isn't written yet
 * renders as plain text instead of a dead link. It is the same rule relatedGuides()
 * applies to the "Keep going" block, so a page can be written against the whole
 * planned set and the links simply switch on as the guides land.
 */
export function GuideLink({ slug, children }: { slug: string; children: React.ReactNode }) {
  if (!guideBySlug(slug)) return <>{children}</>
  return (
    <Link
      href={`/learn/${slug}`}
      className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground"
    >
      {children}
    </Link>
  )
}

/**
 * The direct answer, before any preamble. Set a step up from body copy because
 * it is the part someone who opened the page mid-hand actually needs.
 */
export function Lead({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3 text-base leading-relaxed text-foreground/90">{children}</div>
}

/**
 * A guide's table. Scrolls inside its own box rather than pushing the page
 * sideways, which is the whole difficulty on a phone. Cell styling is applied
 * from here so the pages stay plain markup.
 */
export function GuideTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-6 mt-5 overflow-x-auto px-6 md:mx-0 md:px-0">
      <table className="w-full min-w-md border-collapse text-left text-[15px] [&_td]:border-t [&_td]:border-foreground/10 [&_td]:py-2.5 [&_td]:pr-4 [&_td]:align-top [&_th]:pb-2 [&_th]:pr-4 [&_th]:font-medium [&_th]:text-foreground">
        {children}
      </table>
    </div>
  )
}

/** The one "now go and try it" block. Once per page, quiet, and a real link. */
export function TryIt({ children }: { children: React.ReactNode }) {
  return (
    <section className="mt-12 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-6">
      <div className="space-y-3 text-[15px] leading-relaxed text-muted-foreground">{children}</div>
      <div className="mt-5">
        <PlayCta />
      </div>
    </section>
  )
}

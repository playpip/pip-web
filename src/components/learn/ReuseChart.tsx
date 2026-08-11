// The offer to repost a guide's chart, and the credit snippet that makes
// taking it a copy-paste rather than a decision.
//
// Why this exists at all: a starting-hand grid is the most reposted format in
// beginner poker content, every competing one sits on a page whose real job is
// a casino referral, and none of them would ever say "take this". Ours is
// generated from the product's own card faces, so a repost carries Pip's cards
// whether or not it carries a link. Asking costs a paragraph.
//
// Deliberately not a widget: no script, no badge, no tracking pixel, no embed
// builder. Those are the version of this that becomes a maintenance tail.

import { type GuideArt, guideArtUrl, guideBySlug } from '@/config/learn'

const SITE = 'https://playpip.io'

/**
 * The snippet, built from the registry rather than typed out, so a regenerated
 * file with new dimensions cannot leave a stale width and height on somebody
 * else's page.
 */
function creditSnippet(art: GuideArt, href: string, title: string): string {
  return [
    `<a href="${href}">`,
    `  <img src="${guideArtUrl(art)}"`,
    `       alt="${art.alt}"`,
    `       width="${art.width}" height="${art.height}">`,
    '</a>',
    `<p>Chart from <a href="${href}">${title}</a> by <a href="${SITE}">Pip</a></p>`,
  ].join('\n')
}

export function ReuseChart({ slug }: { slug: string }) {
  const guide = guideBySlug(slug)
  const art = guide?.reusable
  if (!guide || !art) return null

  const href = `${SITE}/learn/${guide.slug}`
  const url = guideArtUrl(art)

  return (
    <section className="mt-8 border-foreground/10 border-t pt-6">
      <h2 className="font-medium text-foreground text-sm">Take this chart</h2>
      <div className="mt-3 space-y-3 text-muted-foreground text-sm leading-relaxed">
        <p>
          The chart on this page is free to use anywhere. Repost it, print it, put it in an article,
          hand it round at a home game. Commercial sites included, no permission needed and nobody
          to ask.
        </p>
        <p>
          The whole grid as one picture:{' '}
          <a
            href={art.src}
            className="text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground"
          >
            {url.replace('https://', '')}
          </a>
          . It is drawn from the same list of hands as the chart above, so the two cannot disagree
          with each other. Hotlink it or keep your own copy, whichever suits you.
        </p>
        <p>A credit is welcome and not required. If you want to leave one, this is all of it:</p>
      </div>
      <pre className="-mx-6 mt-4 overflow-x-auto px-6 md:mx-0 md:rounded-2xl md:border md:border-foreground/10 md:bg-foreground/[0.03] md:px-4 md:py-3">
        <code className="text-muted-foreground text-xs leading-relaxed">
          {creditSnippet(art, href, guide.title)}
        </code>
      </pre>
    </section>
  )
}

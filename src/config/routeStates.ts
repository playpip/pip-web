// Every route on this site is in exactly one of three states, and this file is
// the list. tests/canonical.test.ts enforces it and
// /blog/sitemap-is-not-noindex explains why it exists.
//
// The state a route is in is not the same question as whether it appears in the
// sitemap. Leaving a URL out of the sitemap instructs nobody: /game was absent
// from it from day one, got crawled through the Play button on the home page,
// and was indexed wearing the root layout's title and description. The fix for
// that named `src/app/game` and therefore protected `src/app/game`, while
// thirty-two other URLs went on shipping the same way.
//
// So the three states are written down rather than inferred:
//
//   1. in the sitemap        -> published, and it needs a canonical
//   2. under a noindex tree  -> app, and the layout says so out loud
//   3. neither               -> allowed, but somebody has to write the reason
//
// A new route that lands in none of them fails the build.

/**
 * Subtrees that are app rather than content. The layout sets
 * `robots: { index: false, follow: true }` and nothing underneath is in the
 * sitemap.
 *
 * `follow` stays on everywhere: a table links back to the pages we do want
 * read, and there is no reason to throw that away.
 */
export const NOINDEX_SUBTREES = [
  {
    dir: 'src/app/game',
    why: 'the table itself, which is the product rather than a page about it',
  },
  {
    dir: 'src/app/play',
    why: 'one prerendered file per venue, all of them the same screen with different chips',
  },
  { dir: 'src/app/stats', why: 'your own lifetime numbers, read out of your own browser' },
  {
    dir: 'src/app/hand',
    why: 'a shared hand lives in the URL fragment, which no crawler sends, so every link indexes as the same empty shell',
  },
  {
    dir: 'src/app/reset-password',
    why: 'a step in a flow, reachable only with a token from an email',
  },
] as const

/** '/game' for 'src/app/game'. */
export function routeOf(subtree: (typeof NOINDEX_SUBTREES)[number]['dir']): string {
  return subtree.replace('src/app', '')
}

/**
 * Routes in neither state: not in the sitemap, not under a noindex subtree, and
 * allowed to sit in the gap because somebody argued for it here.
 *
 * An inventory rather than a ban. The point is that adding one makes a person
 * write the reason down, and that the list is short enough to read.
 */
export const NEITHER_LISTED_NOR_NOINDEX: Record<string, string> = {
  '/tutorial':
    'prose-shaped, and out of the sitemap since #116 because it renders the tour client-side and serves 51 words to a crawler. Still crawlable, which nobody has argued for either way: it is linked from /learn and the landing page and is a tour for people rather than a page we want ranked.',
}

/**
 * The day the noindex went on the thirty-two URLs the /game fix had missed, in
 * v1.20.0. Merge date, because that is when the world could see it.
 */
export const NOINDEX_FIXED_ON = '2026-09-10'

/**
 * URLs the second fix covered: twenty-nine venues under /play as at that date,
 * plus /stats, /hand and /reset-password.
 *
 * Dated on purpose. Venues get added, and re-counting under a past date stamp
 * would back-date a number that was not true on the day. What holds the claim
 * up is not this figure but the state list above, which the build checks.
 */
export const NOINDEX_FIXED_URLS = 32

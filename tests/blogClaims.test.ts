import { readFileSync, readdirSync } from 'node:fs'
import test from 'ava'
import { BLOG_POSTS } from '@/config/blog'

// A blog post is a snapshot with a date printed under the title, so when the
// product moves underneath one we do not quietly edit the old sentence. We add a
// <Correction>. That makes the correction the load-bearing part and an
// uncorrected post the failure, which is what this file checks.
//
// It exists because this rot is silent in a way a wrong number is not. Every
// sentence corrected on 19 August was true on the day it published, nothing in
// the repo referenced it, and the whole gate was green for the twenty-four days
// each one was false. Two of the three were the same fact as the three pages
// fixed for sync — a claim about accounts, found by grepping for the phrasing
// that had already been noticed rather than for the fact that had changed.

const sourceOf = (slug: string) =>
  readFileSync(new URL(`../src/app/blog/${slug}/page.tsx`, import.meta.url), 'utf-8')

const SOURCES = new Map(BLOG_POSTS.map((post) => [post.slug, sourceOf(post.slug)]))

// Sync shipped 2026-08-03 — see the two-devices-two-chip-counts post. Before
// that, "no account" was true of the whole product. After it, it is true only of
// the way in, which is a narrower claim than any of these posts made.
const SYNC_SHIPPED = '2026-08-03'
const ACCOUNT_ABSENCE = /no accounts|still no account|behind any of it/i

test('a post predating sync that says there is no account carries a correction', (t) => {
  for (const post of BLOG_POSTS) {
    if (post.date >= SYNC_SHIPPED) continue
    if (!ACCOUNT_ABSENCE.test(SOURCES.get(post.slug) ?? '')) continue
    t.true(
      SOURCES.get(post.slug)?.includes('<Correction'),
      `/blog/${post.slug} predates sync (${post.date}) and claims there is no account, with no <Correction>`,
    )
  }
})

// The agent-readable post counts the routes that serve a Markdown mirror, and a
// count in prose is a claim with a decay date. It said six for twenty-four days
// while the real number reached ten, and the post also named the learn pages as
// the half with no mirror, by then the largest set of mirrors on the site. The
// correction fixed that by counting again, so it went stale the next time a
// content route shipped, and the tempting repair is worse than the staleness:
// editing "ten" to "eleven" under a 19 August date stamp back-dates a figure
// that was not true on the day the note claims it.
//
// So the correction names the rule instead of counting, and this test holds the
// number out rather than pinning it. What makes that safe is that
// contentRoutes.test.ts already fails the build when a route in the sitemap
// ships with no Pages Function, so the rule cannot quietly go false.
test('the agent-readable correction claims the rule, not a count', (t) => {
  const correction = (SOURCES.get('agent-readable') ?? '')
    .match(/<Correction[\s\S]*?<\/Correction>/)?.[0]
    ?.replace(/\s+/g, ' ')
  t.truthy(correction, 'the correction block on the agent-readable post is gone')

  t.notRegex(
    correction as string,
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+) content routes\b/i,
    'the correction counts content routes again, and that count goes stale on the next one',
  )
  t.regex(
    correction as string,
    /every route[^.]{0,60}serves prose/i,
    'the correction no longer states the rule that replaced the count',
  )

  const routes = readdirSync(new URL('../functions/', import.meta.url), { recursive: true })
    .map(String)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('_shared.ts'))
  t.true(
    routes.some((file) => file.includes('learn')),
    'the learn routes are the correction’s example; it is wrong if they stop having mirrors',
  )
})

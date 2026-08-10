import { existsSync, readFileSync } from 'node:fs'
import test from 'ava'
import sitemap from '@/app/sitemap'
import { SITE_URL } from '@/config/site'

// A content route is registered in three places, not one: the sitemap, a
// Cloudflare Pages Function (so `Accept: text/markdown` gets the mirror and the
// Link headers advertise it), and gen-llms.mjs (so it has a mirror to serve and
// an entry in llms.txt).
//
// Every one of those omissions is silent. The page builds, deploys and renders
// perfectly while quietly being the one route agents cannot read, and nothing
// in the gate noticed until someone thought to curl it. The sitemap is the list
// that cannot be forgotten — a page nobody puts there is not being published —
// so it is the list the other two are checked against.

/** '' for the home page, '/blog/launch-week' for a post. */
function pathOf(url: string): string {
  return url.slice(SITE_URL.length)
}

// The tour is an app, not prose: it has no Markdown mirror to serve, so it has
// no function and no gen-llms entry on purpose. It is in the sitemap because it
// is a page we want indexed, which is a different question.
const APP_ROUTES = new Set(['/tutorial'])

/** Where a route's Pages Function could live, in `functions/`. */
function functionCandidates(path: string): string[] {
  if (path === '') return ['index.ts']
  const route = path.slice(1)
  const parent = route.split('/').slice(0, -1).join('/')
  return [`${route}.ts`, `${route}/index.ts`, parent ? `${parent}/[slug].ts` : '[slug].ts']
}

test('every indexable content route has a Pages Function serving it', (t) => {
  for (const { url } of sitemap()) {
    const path = pathOf(url)
    if (APP_ROUTES.has(path)) continue
    const candidates = functionCandidates(path)
    const found = candidates.some((file) =>
      existsSync(new URL(`../functions/${file}`, import.meta.url)),
    )
    t.true(found, `${url} — expected one of: ${candidates.map((c) => `functions/${c}`).join(', ')}`)
  }
})

// Blog posts and Learn guides are discovered from the built output, so they
// need no entry. Everything else is a hand-written line in that file, and a
// route that misses it gets no .md mirror written at all.
const AUTO_DISCOVERED = /^\/(blog|learn)\/.+/

test('every hand-registered content route is in gen-llms PAGES', (t) => {
  const source = readFileSync(new URL('../scripts/gen-llms.mjs', import.meta.url), 'utf-8')
  const registered = new Set(
    [...source.matchAll(/route:\s*'([^']+)'/g)].map((m) => (m[1] === '/' ? '' : m[1])),
  )
  for (const { url } of sitemap()) {
    const path = pathOf(url)
    if (APP_ROUTES.has(path) || AUTO_DISCOVERED.test(path)) continue
    t.true(registered.has(path), `${url} is not in PAGES in scripts/gen-llms.mjs`)
  }
})

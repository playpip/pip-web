import { existsSync, readdirSync, readFileSync } from 'node:fs'
import test from 'ava'
import { DRILL_KINDS } from '@/config/drills'
import {
  featureForDrill,
  featureForFamily,
  membershipFor,
  sellableFeatures,
  tappedFeature,
} from '@/config/membership'
import { SIDE_SHELF } from '@/config/venues'

// A locked tap opens `/membership` on the thing that was tapped.
//
// The failure this guards is quiet: a `?for=` naming an id that is not a
// shipped feature renders the plain page, which looks fine and answers the tap
// with nothing in particular. So every id a call site can send is checked
// against `sellableFeatures()`, and the component tree is walked for a bare
// `/membership` link, because a guard that lists the surfaces it knows about
// protects those surfaces and nothing added after them.

const SHIPPED = new Set(sellableFeatures().map((f) => f.id))

/** Every `.ts`/`.tsx` under a directory, comments stripped: a note is not a link. */
function sources(dir: string): { path: string; code: string }[] {
  const out: { path: string; code: string }[] = []
  for (const entry of readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) out.push(...sources(path))
    else if (/\.tsx?$/.test(entry.name)) {
      out.push({
        path,
        code: readFileSync(new URL(`../${path}`, import.meta.url), 'utf-8')
          .replace(/\/\*[\s\S]*?\*\//g, ' ')
          .replace(/^\s*\/\/.*$/gm, ' '),
      })
    }
  }
  return out
}

// Links to the page that are not answering a locked tap: the settings row, the
// landing page, and the page itself.
const NOT_A_TAP = new Set([
  'src/components/settings/MembershipSection.tsx',
  'src/components/marketing/Landing.tsx',
  'src/components/marketing/LegalPage.tsx',
  'src/components/membership/MembershipScreen.tsx',
])

test('every locked surface says what was tapped', (t) => {
  const files = sources('src/components')
  t.true(files.length > 50, `scanned ${files.length} files, which is too few to mean anything`)
  for (const { path, code } of files) {
    if (NOT_A_TAP.has(path)) continue
    t.notRegex(
      code,
      /['"`]\/membership['"`?]/,
      `${path} sends a tap to the plain /membership; use membershipFor() so the page opens on it`,
    )
  }
})

test('every literal id a call site sends is a shipped feature', (t) => {
  let seen = 0
  for (const { path, code } of sources('src/components')) {
    for (const [, id] of code.matchAll(/membershipFor\(\s*'([^']+)'\s*\)/g)) {
      seen++
      t.true(SHIPPED.has(id), `${path} sends ?for=${id}, which is not a shipped feature`)
    }
  }
  t.true(seen >= 5, `found ${seen} literal ids, fewer than the call sites that exist`)
})

test('every paid drill kind maps to a shipped feature', (t) => {
  const paid = DRILL_KINDS.filter((kind) => kind.membersOnly)
  t.true(paid.length > 0)
  for (const kind of paid) {
    t.true(SHIPPED.has(featureForDrill(kind.id)), `${kind.id} maps to nothing on the page`)
  }
  t.is(featureForDrill('calling-the-river'), 'river')
})

test('every side-table family maps to a shipped feature', (t) => {
  for (const family of SIDE_SHELF) {
    t.true(SHIPPED.has(featureForFamily(family)), `${family.id} maps to nothing on the page`)
  }
})

test('the page reads back what the tap sent, and nothing else', (t) => {
  const search = (href: string) => new URL(href, 'https://playpip.io').search
  t.is(tappedFeature(search(membershipFor('omaha')))?.id, 'omaha')
  t.is(tappedFeature(search(membershipFor('lessons')))?.title, 'Lessons with Webb')
  t.is(tappedFeature(''), null)
  t.is(tappedFeature('?for=nonsense'), null)
  // Not shipped, so never advertised, even by somebody typing the URL.
  t.is(tappedFeature('?for=multiplayer'), null)
})

// Back from checkout, a new member gets a link to the place they tapped. A
// place that is not a page is a 404 in the first minute of a membership.
test('every place a feature links to is a page', (t) => {
  const drills = new Set<string>(DRILL_KINDS.map((kind) => kind.id))
  let seen = 0
  for (const feature of sellableFeatures()) {
    if (!feature.place) continue
    seen++
    const drill = feature.place.href.match(/^\/game\/drills\/([^/]+)$/)
    if (drill) {
      t.true(drills.has(drill[1]), `${feature.id} links to a drill that does not exist`)
      continue
    }
    const page = new URL(`../src/app${feature.place.href}/page.tsx`, import.meta.url)
    t.true(existsSync(page), `${feature.id} links to ${feature.place.href}, which has no page`)
  }
  t.true(seen >= 10, `only ${seen} features have a place`)
})

test('checkout hands the tap back, and only a feature id’s shape', (t) => {
  const checkout = readFileSync(
    new URL('../supabase/functions/checkout/index.ts', import.meta.url),
    'utf-8',
  )
  t.regex(checkout, /\/\^\[a-z-\]\{1,40\}\$\/\.test\(body\.for\)/)
  t.regex(
    checkout,
    /success_url: `\$\{SITE_URL\}\/membership\?joined=1\$\{tapped \? `&for=\$\{tapped\}` : ''\}#plans`/,
  )
})

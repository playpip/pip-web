import { existsSync, readdirSync, readFileSync } from 'node:fs'
import test from 'ava'
import { DRILL_KINDS, SAMPLED_DRILLS, membershipForDrill, tappedDrill } from '@/config/drills'
import {
  featureForDrill,
  featureForFamily,
  membershipFor,
  sellableFeatures,
  tappedFeature,
} from '@/config/membership'
import {
  ALL_VENUES,
  DEEP_STACK_TABLES,
  SIDE_SHELF,
  VENUES,
  featureForVenue,
  venueById,
} from '@/config/venues'
import { kindFloor } from '@/lib/drills/standing'
import { nextDrill } from '@/lib/drills'
import { drillSample } from '@/lib/drills/sample'

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

// "Every drill" lists nine kinds, so a tap on one of them names which. A drill
// call site that builds its own link would drop the name without failing
// anything, so the shortcut is banned outright.
test('a tap on a paid drill names its kind, and the page reads it back', (t) => {
  const search = (href: string) => new URL(href, 'https://playpip.io').search
  const paid = DRILL_KINDS.filter((kind) => kind.membersOnly && kind.id !== 'calling-the-river')
  t.true(paid.length >= 7, `only ${paid.length} paid drills under "Every drill"`)
  for (const kind of paid) {
    const href = membershipForDrill(kind.id)
    t.is(tappedFeature(search(href))?.id, 'drills', kind.id)
    t.is(tappedDrill(search(href))?.id, kind.id, kind.id)
  }
  t.is(membershipForDrill('calling-the-river'), membershipFor('river'))
  t.is(tappedDrill('?for=drills&drill=which-hand-wins'), null, 'a free kind is not sold')
  t.is(tappedDrill('?for=drills&drill=calling-the-river'), null, 'the river has its own entry')
  t.is(tappedDrill('?for=omaha&drill=pot-odds'), null)
  t.is(tappedDrill('?for=drills&drill=nonsense'), null)
  t.is(tappedDrill('?for=drills'), null)
  for (const { path, code } of sources('src/components')) {
    t.notRegex(
      code,
      /featureForDrill/,
      `${path} builds a drill's link itself; use membershipForDrill()`,
    )
  }
})

// The spot dealt under a tapped drill is the drill's own, the same on every
// visit, and has what the felt draws: a board of the kind's size and a holding.
test('a sampled drill deals one fixed spot from its own generator', (t) => {
  t.true(SAMPLED_DRILLS.length >= 4)
  for (const id of SAMPLED_DRILLS) {
    const kind = DRILL_KINDS.find((entry) => entry.id === id)
    t.true(kind?.membersOnly === true, `${id} is not a paid kind`)
    const spot = drillSample(id)
    t.deepEqual(drillSample(id), spot, `${id}: a fixed seed dealt two different spots`)
    t.is(spot.kind, id)
    t.deepEqual(spot, nextDrill(id, spot.seed, kindFloor(id)), `${id}: not what the drill deals`)
    t.is(spot.board.length, kind?.boardCards, `${id}: board`)
    const holdings =
      (spot.hands?.length ?? 0) + spot.choices.filter((c) => c.cards.length > 1).length
    t.true(holdings > 0, `${id}: nothing for the felt to draw`)
  }
})

test('every side-table family maps to a shipped feature', (t) => {
  for (const family of SIDE_SHELF) {
    t.true(SHIPPED.has(featureForFamily(family)), `${family.id} maps to nothing on the page`)
  }
})

// A member table reached by its URL rather than its tile. It used to bounce to
// the side tables and say nothing, so the question the link asked went
// unanswered by the one page that answers it.
test('every gated table maps to a shipped feature, and a free one to nothing', (t) => {
  const gated = ALL_VENUES.filter((venue) => venue.membersOnly)
  t.true(gated.length >= 15, `only ${gated.length} gated tables`)
  for (const venue of gated) {
    const feature = featureForVenue(venue)
    t.true(feature !== null && SHIPPED.has(feature), `${venue.id} maps to ${feature}`)
  }
  for (const venue of VENUES) t.is(featureForVenue(venue), null, venue.id)
})

test('a table maps to the entry that names it, not just its shelf', (t) => {
  for (const room of DEEP_STACK_TABLES) t.is(featureForVenue(room), 'rooms', room.id)
  const study = venueById('study')
  t.truthy(study)
  if (study) t.is(featureForVenue(study), 'side-tables')
  const custom = venueById('custom')
  t.truthy(custom)
  if (custom) t.is(featureForVenue(custom), 'custom-tables')
  for (const family of SIDE_SHELF.filter((f) => f.section === 'games')) {
    for (const room of family.rooms) t.is(featureForVenue(room), family.id, room.id)
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

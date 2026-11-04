import { existsSync, readFileSync } from 'node:fs'
import test from 'ava'
import { MEMBERSHIP_FEATURES } from '@/config/membership'
import { QUICK_GAMES, QUICK_GAMES_FEATURE } from '@/config/quickGames'
import { QUICK_EVENTS } from '@/lib/quick/events'

// Quick games (config/quickGames): what adding one has to bring with it.
//
// Each is the membership's with one free round a day, so the same disclosures
// that hold for a paid drill hold here: the roadmap names it, the page's entry
// names it, and nothing is sold before it exists. And each one is counted the
// same way, so a funnel over them is one report rather than a guess.

const flat = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf-8').replace(/\s+/g, ' ')
const ROADMAP = flat('../ROADMAP.md')
const ART = readFileSync(
  new URL('../src/components/menu/CategoryArt.tsx', import.meta.url),
  'utf-8',
)
const feature = MEMBERSHIP_FEATURES.find((f) => f.id === QUICK_GAMES_FEATURE)

test('the page sells quick games exactly when there are some', (t) => {
  t.truthy(feature, 'no quick-games entry in MEMBERSHIP_FEATURES')
  t.is(feature?.shipped, QUICK_GAMES.length > 0)
})

test('every quick game is the membership’s, and says so where a reader checks', (t) => {
  t.pass()
  for (const game of QUICK_GAMES) {
    t.true(game.membersOnly === true, `${game.id} ships free by accident`)
    t.true(ROADMAP.includes(game.title), `ROADMAP.md does not name ${game.title}`)
    t.true(
      feature?.blurb.includes(game.title) ?? false,
      `the page's entry does not name ${game.title}`,
    )
  }
  if (QUICK_GAMES.length > 0) {
    t.true(
      ROADMAP.includes('one free round of each a day'),
      'the roadmap does not give the free round',
    )
  }
})

test('every quick game has art, a page and its two events', (t) => {
  t.pass()
  const ids = new Set<string>()
  for (const game of QUICK_GAMES) {
    t.false(ids.has(game.id), `${game.id} twice`)
    ids.add(game.id)
    t.regex(game.id, /^[a-z][a-z0-9-]{0,39}$/)
    t.true(
      ART.includes(`'${game.id}': (c)`) || ART.includes(`  ${game.id}: (c)`),
      `${game.id} has no scene in CategoryArt, so its card would be the fallback`,
    )
    const page = new URL(`../src/app${game.href}/page.tsx`, import.meta.url)
    t.true(existsSync(page), `${game.id} links to ${game.href}, which has no page`)
    t.truthy(QUICK_EVENTS[game.id], `${game.id} sends no started/finished events`)
  }
  for (const id of Object.keys(QUICK_EVENTS)) t.true(ids.has(id), `${id} has events and no game`)
})

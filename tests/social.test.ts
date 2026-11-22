import { readFileSync } from 'node:fs'
import test from 'ava'
import { emptySeatStats } from '@/lib/reads'
import { cardOf, parseCard, parseShown, SHOWABLE, type CardSource } from '@/lib/social/card'
import {
  BAD_STEMS,
  BAD_WORDS,
  bioHasLink,
  handleShapeOk,
  INNOCENT,
  normaliseHandle,
  suggestHandle,
  textOk,
} from '@/lib/social/clean'

// Friends, public profiles and the inbox (docs/social.md).

const migration = readFileSync(
  new URL('../supabase/migrations/20261122180000_social.sql', import.meta.url),
  'utf-8',
)
const sql = migration.replace(/^\s*--.*$/gm, ' ')

/** A `name constant text[] := array[...]` list from the migration. */
function sqlList(name: string): string[] {
  const m = sql.match(new RegExp(`${name} constant text\\[\\] := array\\[([^\\]]*)\\]`))
  if (!m) throw new Error(`no ${name} in the migration`)
  return [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1])
}

// --- the word filter ----------------------------------------------------------

test('the form checks the same words the database does', (t) => {
  t.deepEqual([...BAD_WORDS], sqlList('words'))
  t.deepEqual([...BAD_STEMS], sqlList('stems'))
  t.deepEqual([...INNOCENT], sqlList('innocent'))
})

test('the form maps look-alike characters as the database does', (t) => {
  t.true(sql.includes(`translate(lower(t), '0134578@$!|', 'oieastbasil')`))
})

test('ordinary names, handles and bios pass', (t) => {
  for (const ok of [
    'Will',
    'Dick Smith',
    'Scunthorpe United',
    'sniggering at the river',
    'cocktail hour',
    'I fold too much. Working on it.',
    'ace_high_99',
    'Pass the cheese',
  ]) {
    t.true(textOk(ok), ok)
  }
})

test('slurs and obscenities fail, spaced out or spelt with numbers', (t) => {
  for (const bad of ['f u c k', 'FuCk off', 'n1gger', 'shit', 'motherf_ucker', 'h1tl3r', 'cunt']) {
    t.false(textOk(bad), bad)
  }
})

// --- handles and bios ---------------------------------------------------------

test('a handle is 3 to 20 lower-case letters, numbers or underscores', (t) => {
  t.is(normaliseHandle(' @Will_L '), 'will_l')
  t.true(handleShapeOk('abc'))
  t.true(handleShapeOk('a_b_c_123'))
  t.false(handleShapeOk('ab'))
  t.false(handleShapeOk('a'.repeat(21)))
  t.false(handleShapeOk('will.l'))
  t.false(handleShapeOk('Will'))
})

test('the database holds handles to the same shape', (t) => {
  t.true(sql.includes(`check (handle ~ '^[a-z0-9_]{3,20}$')`))
})

test('a first handle comes from the name', (t) => {
  t.is(suggestHandle('Will L.'), 'will_l')
  t.is(suggestHandle('Zoë'), 'zoe')
  t.is(suggestHandle('Al'), 'al_pip')
  t.is(suggestHandle('!!!'), 'player')
  t.true(handleShapeOk(suggestHandle('A really very long name for a handle')))
})

test('links are refused in a bio', (t) => {
  t.true(bioHasLink('see https://x.y'))
  t.true(bioHasLink('www.example'))
  t.true(bioHasLink('join spam.gg'))
  t.false(bioHasLink('I play at night. Mostly.'))
  t.false(bioHasLink('3.5 bets'))
})

// --- what a profile shows -----------------------------------------------------

const source = (): CardSource => ({
  roll: 12_345.6,
  peakRoll: 15_000,
  stats: { handsPlayed: 812, tournamentsWon: 9 },
  tendencies: { ...emptySeatStats(), handsDealt: 100, vpipHands: 20, raises: 30, calls: 10 },
  streak: { current: 2, best: 11, lastDate: '2026-11-21' },
  awards: { a: 1, b: 2 },
})

test('only what is shown leaves the device', (t) => {
  t.deepEqual(cardOf(source(), []), {})
  t.deepEqual(cardOf(source(), ['rating']), {})
  t.deepEqual(cardOf(source(), ['roll', 'rank']), { roll: 12_346, rank: 'Shark' })
  t.deepEqual(cardOf(source(), ['style', 'hands', 'wins', 'streak', 'awards']), {
    style: 'shark',
    hands: 812,
    wins: 9,
    streak: 11,
    awards: 2,
  })
})

test('no player type until there are enough hands to name one', (t) => {
  const few = { ...source(), tendencies: emptySeatStats() }
  t.deepEqual(cardOf(few, ['style']), {})
})

test('a profile read back keeps only what Pip knows', (t) => {
  t.deepEqual(parseShown(['roll', 'nonsense', 'rating']), ['rating', 'roll'])
  t.deepEqual(parseShown('rating'), [])
  t.deepEqual(parseCard({ roll: -5, rank: 'Shark', style: 'wizard', hands: 3.4, extra: 1 }), {
    rank: 'Shark',
    hands: 3,
  })
  t.deepEqual(parseCard(null), {})
})

test('a new profile shows the rating and nothing else', (t) => {
  t.true(sql.includes(`shown text[] not null default '{rating}'`))
  t.is(SHOWABLE[0].key, 'rating')
})

// --- who may do what ----------------------------------------------------------

test('no client can write a social table directly', (t) => {
  for (const table of ['player_profiles', 'friendships', 'notifications']) {
    t.notRegex(sql, new RegExp(`on public\\.${table} for (insert|update|delete|all)`, 'i'))
  }
})

test('every function a client calls is for signed-in players only', (t) => {
  const granted = [...sql.matchAll(/^\s+'([a-z_]+)\(/gm)].map((m) => m[1])
  const definers = [
    ...sql.matchAll(/create or replace function public\.([a-z_]+)\([^)]*\)[^$]*?security definer/g),
  ].map((m) => m[1])
  const helpers = ['social_blocked', 'social_target', 'social_notify', 'social_relation']
  t.true(granted.length >= 10)
  for (const fn of definers) {
    t.true(granted.includes(fn) || helpers.includes(fn), `${fn} is neither granted nor a helper`)
  }
  for (const fn of helpers) {
    t.true(sql.includes(`revoke all on function public.${fn}(`), `${fn} is callable`)
  }
  t.true(sql.includes(`execute format('revoke all on function public.%s from public, anon', f)`))
})

test('every security definer function pins its search path', (t) => {
  const bodies = sql.split(/create or replace function /).slice(1)
  for (const body of bodies) {
    const head = body.slice(0, body.indexOf('$$'))
    if (head.includes('security definer')) t.true(head.includes(`set search_path = ''`), head)
  }
})

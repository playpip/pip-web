import { readFileSync, readdirSync } from 'node:fs'
import test from 'ava'

// Two claims about the free account, both of which have already gone wrong
// once in the week since the account went prominent (#97, technology#97).
//
// **One.** The site described the same account three different ways: the hero
// said one thing, the trust card another, the signup dialog a third, and the
// eight search pages a stranger actually lands on said it did not exist. The
// fix is `ACCOUNT_OFFER` in src/config/account.ts. This file is what stops the
// next page writing a ninth version of it by hand.
//
// **Two.** "Nothing to confirm" is the only copy on the site whose truth lives
// outside the repository: it holds while Supabase production runs
// `mailer_autoconfirm`, and turning that off makes three surfaces false at once
// with a green gate and no deploy (docs/sync.md). No test can read a dashboard
// setting, so this one does the only useful thing available: it pins the list
// of places that would have to change, so the person who flips the setting and
// greps for it finds all of them rather than the first two.

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf-8')

/** Every `.ts`/`.tsx` under `src/`, so a new surface is caught the day it lands. */
const allSources = (): string[] => {
  const found: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(new URL(`../${dir}`, import.meta.url), {
      withFileTypes: true,
    })) {
      const path = `${dir}/${entry.name}`
      if (entry.isDirectory()) walk(path)
      else if (/\.tsx?$/.test(entry.name)) found.push(path)
    }
  }
  walk('src')
  return found
}

/**
 * The pages that render the shared sentence, each because a stranger can arrive
 * on it from search and leave without ever hearing the account exists. `Guide`
 * covers all eight `/learn` guides at once.
 */
const OFFER_SURFACES = [
  'src/components/learn/Guide.tsx',
  'src/components/marketing/Landing.tsx',
  'src/app/play-poker-free-no-signup/page.tsx',
]

test('the account is described in one sentence, in one place', (t) => {
  const source = read('src/config/account.ts')
  const sentence = source.match(/export const ACCOUNT_OFFER =\s*\n?\s*'([^']+)'/)?.[1]
  t.truthy(sentence, 'ACCOUNT_OFFER is gone or no longer a plain single-quoted string')

  // Second clause, non-negotiable: the offer reaches every guide and the
  // landing page, and Landing.tsx promises "no nagging. Ever." An offer that
  // does not say it is optional is the first step out of that promise.
  t.regex(
    sentence as string,
    /never need one|without one|optional/i,
    'ACCOUNT_OFFER no longer says the account is optional; read it next to the promise card first',
  )

  const rendering = allSources().filter(
    (path) => path !== 'src/config/account.ts' && /\bACCOUNT_OFFER\b/.test(read(path)),
  )
  t.deepEqual(
    rendering.sort(),
    [...OFFER_SURFACES].sort(),
    'a new page renders the account offer: fine, add it here, but check it is not a page nobody asked the question on',
  )
})

/**
 * Every file that tells a reader they do not need an account, and why each one
 * is allowed to say it in its own words rather than deferring to
 * `ACCOUNT_OFFER`. This is an inventory, not a ban: the eight guides drifted
 * precisely because nobody could see the whole list at once, and the value here
 * is that adding a ninth makes you write the reason down.
 */
const NO_ACCOUNT_PHRASING: Record<string, string> = {
  // Search surfaces. The phrase is the query, the title and, on the SEO page,
  // the URL. Rewriting these to be tidier costs a ranking and buys nothing.
  'src/app/play-poker-free-no-signup/page.tsx': 'the phrase is its title, its URL and its query',
  'src/app/learn/page.tsx':
    'the hub subtitle is its description; the drills line is about the drill',
  'src/app/tutorial/page.tsx': 'description only',
  'src/app/poker-odds-calculator/page.tsx': 'description only',
  'src/app/layout.tsx': 'the site-wide description and share card',
  'src/app/manifest.ts': 'the install prompt',
  'src/app/opengraph-image.tsx': 'the share card',
  'src/app/hand/opengraph-image.tsx': 'the share card',
  'src/config/learn.ts': 'the guides’ search descriptions',
  'src/config/blog.ts': 'a published post’s description',

  // The one place both halves belong in the same breath: the trust card leads
  // with the offer (#97) and closes with the reassurance, which is the shape
  // ACCOUNT_OFFER copies.
  'src/components/marketing/Landing.tsx':
    'the trust card, where the offer and the reassurance sit together',

  // Not marketing copy.
  'src/app/privacy/page.tsx': 'the legal statement, where it is the correct claim to make',
  'src/components/marketing/Footer.tsx': 'anchor text, which is the target page’s title',
  'src/components/settings/TransferDialog.tsx':
    'describes the manual-transfer feature you are looking at, not the account',

  // Dated records. A post says what was true the day it went up; it gets a
  // correction note rather than a quiet edit (src/config/corrections.ts).
  'src/app/blog/pip-is-live/page.tsx': 'published 2026-07-25',
  'src/app/blog/two-devices-two-chip-counts/page.tsx': 'published 2026-08-12',
  'src/app/blog/august-what-shipped/page.tsx': 'published 2026-09-02',
}

test('every page that says you need no account is written down', (t) => {
  // Four phrasings, not one. The last is here because a sweep for "no account"
  // missed two live pages that said the same thing in different words, which is
  // the mistake this file exists to stop repeating.
  const HANDWRITTEN = /no account needed|no signup|no sign-up|everything without one/i

  // Comments out first. Four engineering files describe what the app does
  // without an account, correctly, in prose no reader ever sees; the rule is
  // about copy, not vocabulary. Same call as tests/accountOffer.test.ts.
  const copy = (path: string) =>
    read(path)
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')

  const saying = allSources().filter((path) => HANDWRITTEN.test(copy(path)))
  t.deepEqual(
    saying.sort(),
    Object.keys(NO_ACCOUNT_PHRASING).sort(),
    'a page describes the account in its own words: either use ACCOUNT_OFFER from src/config/account.ts, or add it above with the reason it has to say its own thing',
  )
})

test('every place that says "nothing to confirm" is written down', (t) => {
  // Sorted, and the count is the point: if you have turned off
  // mailer_autoconfirm in Supabase, these are the files that just went false.
  const CONFIRM_CLAIM = [
    'src/components/marketing/Landing.tsx',
    'src/components/settings/AccountDialog.tsx',
  ]

  const saying = allSources().filter((path) => /nothing to confirm/i.test(read(path)))
  t.deepEqual(
    saying.sort(),
    [...CONFIRM_CLAIM].sort(),
    'a new "nothing to confirm": true only while Supabase runs mailer_autoconfirm (docs/sync.md), so add it here or the next person turning that off will miss it',
  )
})

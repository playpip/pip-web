// Every factual claim Pip has published and then got wrong.
//
// This is a registry rather than prose in a page for the same reason the
// starting-hand figures are: a list of our own errors that is maintained by
// hand is a list that stops being maintained, and a corrections list that
// stops being updated is worse than none, because it then implies we stopped
// making errors.
//
// The rule for adding a row: it goes here when a claim that *served to a
// visitor* turned out to be false. Not a typo, not a rewording, not something
// caught in review before it shipped. `liveFrom` is the day the false version
// first served and `fixedOn` is the day the correction served, both of which
// are merge dates, because on this repository a merge is the deploy. The gap
// between writing a fix and shipping it is part of what this page is admitting
// to, so neither date is the day somebody noticed.
//
// `gone` is the load-bearing field. It is a fragment of the false sentence
// chosen so that it appears nowhere we publish any more, and corrections.test.ts
// fails if it comes back. Pick it from the part that was actually wrong: the
// rarity claim, for instance, still contains "holds exactly, all the way down
// the list" in its corrected form, and what was wrong was saying it without
// "on five cards" in front.
//
// Not everything we publish is a route. ROADMAP.md is linked from the blog and
// from the launch copy, and a false claim in it is as readable as a false claim
// on /privacy. So `where` takes a document as well as a page, the walk that
// enforces `gone` covers those documents too, and this page stops being a list
// of the errors our tooling happened to be able to see.
//
// Two rows do not work that way, and both are marked rather than excused.
// A blog post is a dated record, so a wrong one keeps its sentence and gains a
// correction note. And a row can be `fixedInProduct`, meaning the words were
// right and the thing they described was missing: the fix was a deploy, the
// sentence is the one we want to keep saying, and banning a fragment of it
// would ban the correction. Both carry `gone: null` on purpose, and the test
// knows the difference between that and a row nobody finished.

export interface Correction {
  /** Stable handle. Used as the anchor and the test's failure message. */
  id: string
  /**
   * Where it served: a path on the site, or a GitHub blob URL pinned to the
   * commit that carried the wrong words. See `resolveWhere` for why a document
   * gets a URL and a page does not.
   */
  where: readonly string[]
  /** The claim, quoted. */
  said: string
  /** Why it was false, in one sentence. */
  wrong: string
  /** ISO date the false version first served. */
  liveFrom: string
  /** Set when `liveFrom` is an estimate rather than a merge we can point at. */
  liveFromNote?: string
  /** ISO date the correction served. Null while it is still wrong. */
  fixedOn: string | null
  /** How it was found. Never "a test", because no test has ever found one. */
  caught: string
  /**
   * Set when the sentence was right and the product was not, so the fix was a
   * deploy rather than an edit. Such a row keeps `gone` null: the words this
   * row is about are the ones we now want to go on saying.
   */
  fixedInProduct?: true
  /**
   * A fragment of the false sentence that must not appear in the site's source
   * again. Null only while the claim is still live.
   */
  gone: string | null
  /** The test that fails if it comes back, as a path in this repository. */
  guard: string | null
  /**
   * Why a fixed row has no guard, in one sentence, for the page to print. A
   * fixed row names a guard or says why it has none; "we did not get round to
   * it" is an answer, and a silent null is not.
   */
  guardNote?: string
}

/** Open first, then fixed, newest correction first. Pinned by the test. */
export const CORRECTIONS: readonly Correction[] = [
  {
    id: 'corrections-post-open-row',
    where: ['/blog/what-we-got-wrong'],
    said: 'One of them is still wrong as this goes up.',
    wrong:
      'It was not. This post was written on the morning of 24 August, when the row below it was open. The site was republished with its database configuration at 17:44 that afternoon and the post did not go live until 01:03 the next morning, so the page listing our false claims opened with one, seven hours stale. The sentence was typed rather than read off this list, which is the only way it could have been.',
    liveFrom: '2026-08-25',
    fixedOn: null,
    caught:
      'Checking the live site against the row below, the next morning. The post was the thing doing the checking and it turned out to be the thing that was wrong.',
    gone: null,
    guard: null,
  },
  {
    id: 'privacy-account-section',
    where: ['/privacy'],
    said: 'Sync is "off unless you turn it on, in Settings, under Account".',
    wrong:
      'The site was serving a build made without its database configuration, so the app decided at load time that accounts were unavailable and removed every account surface from itself. There was no Account section in Settings to turn anything on with, and nobody could sign in.',
    liveFrom: '2026-08-23',
    liveFromNote:
      'This row said 3 August when it went up, on the reasoning that we could not see from outside which earlier builds carried the configuration. We could, and we should have looked before writing a date down: every deployment this repository has ever published keeps a permanent address, and the ones from 9, 14 and 15 August all carry it. What actually happened is narrower, and it now has a name. Two different things were publishing this site: our own deploy, which runs the test suite first and supplies the configuration, and a hosting-side integration nobody had accounted for, which builds every push by itself and does neither. On 23 August our deploy stopped at its security-audit step at 16:51:03, the other one finished at 16:51:57, and its build is the one that served playpip.io for the next day.',
    fixedOn: '2026-08-24',
    caught:
      'A check that downloads the JavaScript playpip.io actually serves and reads the configuration out of it. Every test passed and every build was green throughout, and both were telling the truth: the build this repository makes was correct and it was not the one being served.',
    fixedInProduct: true,
    gone: null,
    guard: null,
    guardNote:
      'None. The check that reads the configuration out of a bundle is scripts/assert-sync-config.mjs, and it can only inspect a build made by the deploy it is attached to, which is not the deploy that went wrong. The fix that would actually hold is for one thing to publish this site rather than two, and that is a setting in the hosting account rather than a line in this repository.',
  },
  {
    id: 'data-never-leaves',
    where: ['/', '/terms', '/play-poker-free-no-signup'],
    said: 'Fully local. Install it, pull the plug, keep playing - your profile never leaves your device.',
    wrong:
      'Optional accounts shipped on 3 August. From that morning the sentence was true only of somebody who had never switched sync on, and it was written in the absolute on the same page that offers to back your progress up to every device, four sections further down.',
    liveFrom: '2026-08-03',
    fixedOn: '2026-08-23',
    caught: 'Reading the landing page from top to bottom against the product.',
    gone: 'your profile never leaves your',
    guard: 'tests/dataClaims.test.ts',
  },
  {
    id: 'blog-no-accounts',
    where: ['/blog/pip-is-live', '/blog/launch-week'],
    said: 'Both posts said Pip has no accounts and nothing behind them.',
    wrong:
      'True on 25 July and false from 3 August. A blog post is a dated record, so these were not rewritten: each now carries a correction note under the title saying what changed and when.',
    liveFrom: '2026-08-03',
    fixedOn: '2026-08-23',
    caught:
      'Sweeping the blog for the same fact after the three pages above were found. The sweep that found those had only looked at the pages, not the posts.',
    gone: null,
    guard: 'tests/blogClaims.test.ts',
  },
  {
    id: 'blog-markdown-mirror-count',
    where: ['/blog/agent-readable'],
    said: 'Six content pages serve a plain-text version, and the learn guides are among those that do not.',
    wrong:
      'Six was right on 26 July and wrong from 5 August, when the learn guides got mirrors of their own. By the time anyone read it the count was ten and the guides were the largest set of mirrors on the site, which is the opposite of what the sentence said.',
    liveFrom: '2026-08-05',
    fixedOn: '2026-08-23',
    caught: 'The same blog sweep. Counted the directory rather than trusting the sentence.',
    gone: null,
    guard: 'tests/blogClaims.test.ts',
  },
  {
    id: 'bet-sizing-columns',
    where: ['/learn/bet-sizing'],
    said: 'The two columns move in opposite directions and that is the whole trade.',
    wrong:
      'They climb together. Bet bigger and the price your opponent is getting gets worse and the equity they need goes up: both numbers rise. The trade is real, but it is about who each column costs, not about them pulling apart.',
    liveFrom: '2026-08-11',
    fixedOn: '2026-08-14',
    caught:
      'Reading the sentence against the table directly beneath it. Every number in that table was correct, and had been all along.',
    gone: 'move in opposite directions',
    guard: 'tests/guideClaims.test.ts',
  },
  {
    id: 'rarity-holds-all-the-way',
    where: ['/learn/hand-rankings'],
    said: 'Every hand beats the one below it because it is rarer than the one below it, and that holds exactly, all the way down the list.',
    wrong:
      'It holds on five cards. Deal seven and it breaks in exactly one place, at the bottom: across seven cards, missing every pair is harder than hitting one, so high card is rarer than one pair. The page had a table of seven-card frequencies showing exactly that, immediately below the sentence.',
    liveFrom: '2026-08-05',
    fixedOn: '2026-08-14',
    caught: 'Reading the sentence against the table directly beneath it.',
    gone: ', and that holds exactly',
    guard: 'tests/guideClaims.test.ts',
  },
  {
    id: 'suitedness-one-band',
    where: ['/learn/starting-hands'],
    said: 'Being suited is enough to move a hand one band on the chart, which is exactly what it does: KTs is playable from anywhere and KTo waits for the button.',
    wrong:
      'The example moved two bands, not one. On our own chart KTs opens from any seat and KTo is a late-position hand, with the middle band in between. ATs and ATo are the pair that move exactly one, and suitedness is usually rather than always worth a band.',
    liveFrom: '2026-08-09',
    fixedOn: '2026-08-10',
    caught: 'Checking the example against the chart on the same page.',
    gone: 'KTs is playable from anywhere',
    guard: 'tests/guideClaims.test.ts',
  },
]

/**
 * A blob URL on this repository, pinned to a full commit SHA. A branch name is
 * deliberately not accepted: `blob/main/ROADMAP.md` shows whatever the file says
 * today, which after a fix is the corrected text, so it would be a link that
 * disproves the row it is filed under.
 */
const PINNED_BLOB =
  /^https:\/\/github\.com\/playpip\/pip-web\/blob\/[0-9a-f]{40}\/([^#?\s]+)(?:#L\d+(?:-L\d+)?)?$/

/**
 * Where a claim served, resolved to the file in this repository that carried it
 * and a short label to print. `null` if the entry is neither form, which the
 * test turns into a failure rather than a quiet skip.
 *
 * A page gets a site path, because the path is the address and the file behind
 * it is the page's own source. A document gets a pinned blob URL instead, and
 * that asymmetry is the point: for a page, "what it used to say" is recoverable
 * from this registry, but for a document the honest evidence is the file at the
 * commit that carried the wrong text, which anybody can read forever and which
 * we cannot quietly change. A repo-relative path would be a thing only we can
 * resolve; a pinned URL is checkable from outside.
 */
export function resolveWhere(entry: string): { file: string; label: string } | null {
  if (entry.startsWith('/')) {
    return { file: entry === '/' ? 'src/app/page.tsx' : `src/app${entry}/page.tsx`, label: entry }
  }
  const file = PINNED_BLOB.exec(entry)?.[1]
  return file ? { file, label: file } : null
}

/** Whole days a claim served, `null` while it is still serving. */
export function daysLive(correction: Correction): number | null {
  if (!correction.fixedOn) return null
  const from = Date.parse(`${correction.liveFrom}T00:00:00Z`)
  const to = Date.parse(`${correction.fixedOn}T00:00:00Z`)
  return Math.round((to - from) / 86_400_000)
}

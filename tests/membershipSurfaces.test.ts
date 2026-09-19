import { readFileSync, readdirSync } from 'node:fs'
import test from 'ava'

// Where the membership is allowed to be mentioned, enforced rather than agreed.
//
// The rule is one sentence: **nothing about buying appears in the game loop.**
// A player at a table is mid-hand, and a table is the one screen where a line
// about money would be the thing the landing page promises never happens. The
// spec for this was written down, and this repo's own lesson — fourth time of
// asking — is that a document is not a gate. `tests/accountOffer.test.ts` is
// the precedent: a test that encodes a rule rather than checking code.
//
// What it cannot cover: whether the locked tile *looks* like a prompt. No
// browser here. That still needs somebody to open the drills room signed out.

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

// The table and the store that drives it. Everything a player sees between
// sitting down and standing up comes out of these.
const GAME_LOOP = ['src/components/table', 'src/store/game.ts']

test('nothing in the game loop mentions the membership or links to it', (t) => {
  let checked = 0
  for (const dir of GAME_LOOP) {
    const files = dir.endsWith('.ts')
      ? [{ path: dir, code: readFileSync(new URL(`../${dir}`, import.meta.url), 'utf-8') }]
      : sources(dir)
    for (const { path, code } of files) {
      checked++
      const stripped = code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
      t.notRegex(stripped, /\/membership/, `${path} links to /membership from inside a hand`)
      t.notRegex(
        stripped,
        /config\/membership/,
        `${path} imports the membership config — a table does not need a price`,
      )
      t.notRegex(
        stripped,
        /useEntitlement|useMembership/,
        `${path} asks whether the player is a member, which a table has no reason to know`,
      )
    }
  }
  t.true(checked > 3, `scanned ${checked} files, which is too few to mean anything`)
})

// The other half: the surfaces that *are* allowed to mention it must point at a
// page that exists. A dead link on the one page that asks for money is worse
// than no link.
test('every membership link points at the page we actually built', (t) => {
  const page = sources('src/app/membership')
  t.true(page.length > 0, 'src/app/membership/page.tsx does not exist')

  const linkers: string[] = []
  for (const { path, code } of sources('src')) {
    if (path.startsWith('src/app/membership')) continue
    if (/["'`]\/membership["'`]/.test(code)) linkers.push(path)
  }
  // Not an exhaustive list, a floor: if every link disappears, the page is
  // unreachable and somebody has quietly hidden the thing again.
  t.true(linkers.length > 0, 'nothing in the app links to /membership')
})

// The page is a content route, so it owes the same three things every other one
// does. `tests/canonical.test.ts` reads the sitemap and would catch the missing
// canonical; this catches the two it cannot see.
test('the membership route is wired up like every other content route', (t) => {
  const sitemap = readFileSync(new URL('../src/app/sitemap.ts', import.meta.url), 'utf-8')
  t.regex(sitemap, /'\/membership'/, 'the page is not in the sitemap')

  const fn = readFileSync(new URL('../functions/membership.ts', import.meta.url), 'utf-8')
  t.regex(fn, /serveContentPage/, 'the markdown mirror has no function to serve it')

  const page = readFileSync(new URL('../src/app/membership/page.tsx', import.meta.url), 'utf-8')
  t.regex(page, /contentAlternates\('\/membership'\)/, 'no canonical')
  t.regex(page, /contentSocial\(/, 'no OG block, so it shares as the home page')
})

// Terms had "Pip is free and provided as-is" in it, which was true and would
// have become false and consumer-relied-upon on the day a payment landed. The
// billing section went in before checkout did; this is what stops it coming
// back out.
test('terms carries the billing section, and says the thing that is easy to leave out', (t) => {
  const terms = readFileSync(new URL('../src/app/terms/page.tsx', import.meta.url), 'utf-8')
  t.regex(terms, /renews automatically/i, 'terms does not say the membership renews')
  t.regex(terms, /not refunded/i, 'terms does not say the annual case is not refunded')
  t.regex(terms, /cancel/i)
  t.notRegex(
    terms.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' '),
    /Pip is free and provided as-is/,
    'the sentence that a paid membership falsifies is back in terms',
  )

  const privacy = readFileSync(new URL('../src/app/privacy/page.tsx', import.meta.url), 'utf-8')
  t.regex(privacy, /stripe\.com/, 'privacy does not name Stripe as a recipient')
  t.regex(privacy, /card number/i, 'privacy does not say we never see the card')
})

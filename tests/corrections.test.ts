import { existsSync, readFileSync, readdirSync } from 'node:fs'
import test from 'ava'
import { BLOG_POSTS } from '@/config/blog'
import { CORRECTIONS, daysLive, resolveWhere } from '@/config/corrections'
import { BAND_ORDER, HAND_BANDS } from '@/config/startingHands'

// The corrections list is the one page on the site whose subject is our own
// mistakes, which makes getting it wrong the single funniest failure available
// to us. So it gets more checking than anything it lists.
//
// The load-bearing test is the last one: a fixed row names a fragment of what it
// used to say, and that fragment must appear nowhere we publish but the registry
// and the post itself. That turns every row into a live guard rather than a
// memory of one. "Publish" means the site's source and the documents at the root,
// not just the site's source, because ROADMAP.md is read by people too.

const ISO = /^\d{4}-\d{2}-\d{2}$/

const repoFile = (path: string) => new URL(`../${path}`, import.meta.url)

test('every row is filled in', (t) => {
  t.true(CORRECTIONS.length > 0)
  for (const c of CORRECTIONS) {
    t.true(c.id.length > 0, 'id')
    t.true(c.where.length > 0, `${c.id}: where`)
    t.true(c.said.length > 0, `${c.id}: said`)
    t.true(c.wrong.length > 0, `${c.id}: wrong`)
    t.true(c.caught.length > 0, `${c.id}: caught`)
  }
})

test('ids are unique', (t) => {
  const ids = CORRECTIONS.map((c) => c.id)
  t.is(new Set(ids).size, ids.length)
})

test('dates are ISO, and a fix never precedes the claim', (t) => {
  for (const c of CORRECTIONS) {
    t.regex(c.liveFrom, ISO, `${c.id}: liveFrom`)
    if (c.fixedOn === null) continue
    t.regex(c.fixedOn, ISO, `${c.id}: fixedOn`)
    t.true(c.fixedOn >= c.liveFrom, `${c.id}: fixed before it was live`)
    t.true((daysLive(c) ?? -1) >= 0, `${c.id}: negative days`)
  }
})

/**
 * A post is a dated record of what was true that morning, so a wrong one is not
 * edited: it keeps its sentence and gains a correction note under the title.
 * That is why the blog rows carry no `gone` fragment. Their guard is that the
 * note exists, which blogClaims.test.ts enforces and which is checked below too.
 */
const isPost = (c: (typeof CORRECTIONS)[number]) => c.where.every((p) => p.startsWith('/blog/'))

test('an open row has no fix date and no guard, a fixed row accounts for both', (t) => {
  for (const c of CORRECTIONS) {
    if (c.fixedOn === null) {
      t.is(c.guard, null, `${c.id}: open rows cannot claim a guard that has not shipped`)
      t.is(c.gone, null, `${c.id}: open rows are still saying it`)
      t.falsy(c.guardNote, `${c.id}: an open row explains itself in "wrong", not in "guardNote"`)
      t.is(daysLive(c), null, `${c.id}: an open row has no duration`)
      continue
    }
    t.truthy(
      c.guard ?? c.guardNote,
      `${c.id}: a fixed row names the test that stops it recurring, or says why there is none`,
    )
    t.false(
      Boolean(c.guard && c.guardNote),
      `${c.id}: a row with a guard does not also explain its absence`,
    )
    if (isPost(c) || c.fixedInProduct) {
      t.is(
        c.gone,
        null,
        `${c.id}: the sentence was kept, so nothing about it is banned from the source`,
      )
    } else {
      t.truthy(c.gone, `${c.id}: a fixed row names the words that must not come back`)
    }
  }
})

/**
 * The account row is the only one where the words were right and the product
 * was missing, and it is the only one with no guard. Both are deliberate and
 * both are the kind of thing a later tidy-up quietly "fixes" by inventing a
 * guard that does not run. Pinned so that has to be an argument.
 */
test('the account row is fixed in the product and admits it has no guard', (t) => {
  const account = CORRECTIONS.find((c) => c.id === 'privacy-account-section')
  t.truthy(account, 'the account row has been dropped from the registry')
  if (!account) return
  t.true(account.fixedInProduct === true)
  t.is(account.gone, null)
  t.is(account.guard, null)
  t.truthy(account.guardNote)
  t.is(daysLive(account), 1)
  // The note names a file. Naming one that does not exist is exactly the shape
  // of claim this page is about.
  t.true(
    existsSync(repoFile('scripts/assert-sync-config.mjs')),
    'the note names a script that is not in the repository',
  )
  t.true((account.guardNote ?? '').includes('scripts/assert-sync-config.mjs'))
})

test('a corrected post carries its correction note', (t) => {
  for (const c of CORRECTIONS) {
    if (!isPost(c) || c.fixedOn === null) continue
    for (const path of c.where) {
      const source = readFileSync(repoFile(`src/app${path}/page.tsx`), 'utf-8')
      t.true(source.includes('<Correction'), `${c.id}: ${path} has no correction note`)
    }
  }
})

test('every guard names a test file that exists', (t) => {
  for (const c of CORRECTIONS) {
    if (!c.guard) continue
    t.true(existsSync(repoFile(c.guard)), `${c.id}: ${c.guard} is not in the repository`)
  }
})

test('every row points at something that exists', (t) => {
  for (const c of CORRECTIONS) {
    for (const entry of c.where) {
      const resolved = resolveWhere(entry)
      if (!resolved) {
        t.fail(
          entry.startsWith('https://github.com/')
            ? `${c.id}: ${entry} is not a blob URL on this repository pinned to a commit SHA, so it would show the corrected text`
            : `${c.id}: ${entry} is neither a site path nor a pinned blob URL`,
        )
        continue
      }
      t.true(
        existsSync(repoFile(resolved.file)),
        `${c.id}: ${entry} has no file at ${resolved.file}`,
      )
    }
  }
})

/**
 * No row uses the document form yet, so without this the branch that handles it
 * is untested code waiting for the first person to need it. The pinning rule is
 * the part worth holding: a branch link renders the file as it is today, which
 * for a fixed row is the correction, so it would quietly become evidence against
 * the row it sits under.
 */
test('where takes a site path, and a blob URL only when it is pinned to a commit', (t) => {
  t.is(resolveWhere('/')?.file, 'src/app/page.tsx')
  t.is(resolveWhere('/privacy')?.file, 'src/app/privacy/page.tsx')
  t.is(resolveWhere('/privacy')?.label, '/privacy')

  const sha = '0'.repeat(40)
  const pinned = resolveWhere(`https://github.com/playpip/pip-web/blob/${sha}/ROADMAP.md#L42-L48`)
  t.is(pinned?.file, 'ROADMAP.md')
  t.is(pinned?.label, 'ROADMAP.md')
  t.is(
    resolveWhere(`https://github.com/playpip/pip-web/blob/${sha}/docs/brand.md`)?.file,
    'docs/brand.md',
  )

  t.is(resolveWhere('https://github.com/playpip/pip-web/blob/main/ROADMAP.md'), null)
  t.is(resolveWhere(`https://github.com/playpip/pip-web/blob/${sha.slice(0, 7)}/ROADMAP.md`), null)
  t.is(resolveWhere(`https://github.com/playpip/marketing/blob/${sha}/ROADMAP.md`), null)
  t.is(resolveWhere('ROADMAP.md'), null)
})

test('open rows come first, then fixed rows newest first', (t) => {
  const fixed = CORRECTIONS.map((c) => c.fixedOn)
  const firstFixed = fixed.findIndex((d) => d !== null)
  t.true(
    fixed.slice(firstFixed).every((d) => d !== null),
    'an open row is buried below a fixed one',
  )
  const dates = fixed.slice(firstFixed) as string[]
  for (let i = 1; i < dates.length; i++) {
    t.true(dates[i] <= dates[i - 1], `out of order at ${CORRECTIONS[firstFixed + i].id}`)
  }
})

// The suitedness row explains itself with a claim about our own chart: that the
// old example spanned two bands where the rule it illustrated says one. That is
// exactly the kind of sentence this whole page exists because of, so it does not
// get to sit in prose unchecked.
test('the suitedness row: KT spans two bands and AT spans one', (t) => {
  const gap = (suited: string, offsuit: string) =>
    BAND_ORDER.indexOf(HAND_BANDS[offsuit]) - BAND_ORDER.indexOf(HAND_BANDS[suited])
  t.is(HAND_BANDS.KTs, 'any')
  t.is(HAND_BANDS.KTo, 'late')
  t.is(gap('KTs', 'KTo'), 2)
  t.is(HAND_BANDS.ATs, 'any')
  t.is(HAND_BANDS.ATo, 'middle')
  t.is(gap('ATs', 'ATo'), 1)
})

test('the post is registered on the blog', (t) => {
  t.truthy(BLOG_POSTS.find((p) => p.slug === 'what-we-got-wrong'))
})

/**
 * The post went live with a typed claim about how many of its own rows were
 * open, and it was false by seven hours: the thing it was about had been fixed
 * that afternoon and the post did not publish until after midnight. The claim
 * is now read off the registry at build time. That is the whole fix, so it is
 * pinned rather than left as a habit somebody tidies away.
 */
test('the post never types its own live state', (t) => {
  const source = readFileSync(repoFile('src/app/blog/what-we-got-wrong/page.tsx'), 'utf-8')
  t.true(
    source.includes('open.length'),
    'the open-row count is no longer derived from the registry',
  )
  t.false(source.includes('as this goes up'), 'the publication-day tense is back in the post')
})

// Everything below walks what we publish. The registry quotes the false
// sentences and the post prints them, so those two are the only places they are
// allowed to be.
//
// It covers the documents at the root as well as src, because both are published.
// ROADMAP.md in particular is linked from the blog and from the launch copy, and
// a claim in it reaches a reader exactly the way a claim on a route does. Walking
// only src would have made `gone` a rule about which files our tooling could
// reach rather than about which words we are still saying.
const EXEMPT = new Set(['src/config/corrections.ts', 'src/app/blog/what-we-got-wrong/page.tsx'])
const ROOT_DOCS = ['ROADMAP.md', 'README.md']

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(repoFile(dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) sources(path, out)
    else if (/\.tsx?$/.test(entry.name) && !EXEMPT.has(path)) out.push(path)
  }
  return out
}

// A renamed document would drop out of the walk above without failing anything,
// which is the quiet way a guard stops guarding. Pinned so it has to be noticed.
test('the documents the walk covers are still where it looks for them', (t) => {
  for (const path of ROOT_DOCS) {
    t.true(existsSync(repoFile(path)), `${path} has moved, so the walk below no longer reads it`)
  }
})

test('nothing we corrected is still being said', (t) => {
  const files = [...sources('src'), ...ROOT_DOCS].map(
    (path) => [path, readFileSync(repoFile(path), 'utf-8')] as const,
  )
  for (const c of CORRECTIONS) {
    if (!c.gone) continue
    for (const [path, source] of files) {
      t.false(source.includes(c.gone), `${c.id}: "${c.gone}" is back, in ${path}`)
    }
  }
})

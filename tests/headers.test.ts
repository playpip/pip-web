import test from 'ava'
import { readFileSync } from 'node:fs'

// `public/_headers` is the one file in this repo that can take the whole site
// out of Google in a single line, and nothing was reading it.
//
// The rule added for the `pages.dev` duplicate is host-scoped
// (`https://pip-web-9oj.pages.dev/*`). Drop the host in a later edit and the
// same `noindex` applies to every path on playpip.io, the deploy is green, the
// site looks perfect to anybody who opens it, and we quietly disappear from
// search. There is no gate anywhere else that can see that, because it is a
// static file Cloudflare interprets after we have shipped.
//
// So: parse the file the way Pages does, and hold the one invariant that
// matters. Cheap, and it is the class of fault the corrections registry exists
// to record.

const SOURCE = readFileSync(new URL('../public/_headers', import.meta.url), 'utf-8')

/** One rule: the URL pattern it matches, and the headers it sets. */
interface Rule {
  pattern: string
  headers: string[]
}

/**
 * Parse `_headers`: comments start with `#`, an unindented line is a pattern,
 * and the indented lines under it are that pattern's headers.
 */
function rules(source: string): Rule[] {
  const out: Rule[] = []
  for (const line of source.split('\n')) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue
    if (/^\s/.test(line)) out.at(-1)?.headers.push(line.trim())
    else out.push({ pattern: line.trim(), headers: [] })
  }
  return out
}

const PARSED = rules(SOURCE)

test('every rule has a pattern Cloudflare will match and at least one header', (t) => {
  t.true(PARSED.length > 0, 'the file parsed to nothing, so the parser or the file is wrong')
  for (const rule of PARSED) {
    t.true(
      rule.pattern.startsWith('/') || rule.pattern.startsWith('https://'),
      `"${rule.pattern}" is neither a path nor an absolute URL`,
    )
    t.true(rule.headers.length > 0, `"${rule.pattern}" sets no headers`)
  }
})

test('nothing noindexes playpip.io', (t) => {
  // The failure: `https://pip-web-9oj.pages.dev/*` edited down to `/*`, which
  // is a one-character-looking change that deindexes the product.
  // Collected rather than asserted rule by rule, so this still runs an
  // assertion when there is no noindex anywhere in the file. A test that can
  // pass by finding nothing to check is the other way to be green and wrong.
  const reaches = PARSED.filter(
    (rule) =>
      rule.headers.some((h) => /^x-robots-tag:/i.test(h) && /noindex/i.test(h)) &&
      (!rule.pattern.startsWith('https://') || rule.pattern.includes('playpip.io')),
  ).map((rule) => rule.pattern)

  t.deepEqual(reaches, [], 'these noindex rules reach the site itself, not just an alias')
})

test('the pages.dev duplicate of the site is noindexed', (t) => {
  // Verified from outside on 2026-08-26: https://pip-web-9oj.pages.dev/
  // returned 200 with the current production build and no x-robots-tag at all.
  // Cloudflare adds noindex to preview deployments only; the production alias
  // does not get one.
  const rule = PARSED.find((r) => r.pattern === 'https://pip-web-9oj.pages.dev/*')
  t.truthy(rule, 'the production pages.dev alias has no rule, so it is indexable')
  t.true(
    (rule?.headers ?? []).some((h) => /^x-robots-tag:\s*noindex$/i.test(h)),
    'the alias rule no longer sets noindex',
  )
})

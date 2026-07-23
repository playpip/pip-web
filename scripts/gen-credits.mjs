// Build-time: generate the public contributor credits from the GitHub
// contributors API into src/data/contributors.json, which the /credits page
// imports. Runs before `next build` (see package.json).
//
// Two deliberate rules:
//   1. Filter automation — bots never get credited as people.
//   2. Belt-and-braces, filter anything that looks like an AI co-author. Pip's
//      commits carry a Co-Authored-By trailer that is kept private; it must not
//      surface as a public contributor. (The REST contributors endpoint counts
//      commit authors, not trailer co-authors, so this is just insurance.)
//
// Fully graceful: if GitHub is unreachable (offline dev, rate limit), the
// previously committed JSON is left exactly as-is, so the build never breaks
// and the page always has real data to show.

import { readFileSync, writeFileSync } from 'node:fs'

const OUT = new URL('../src/data/contributors.json', import.meta.url)
const REPO = 'playpip/pip-web'
const API = `https://api.github.com/repos/${REPO}/contributors?per_page=100`

// Bots, automation, and — as insurance — the private AI co-author.
const DENY = /(\[bot\]$)|^(dependabot|github-actions|renovate)|claude|anthropic/i

async function main() {
  const headers = { 'user-agent': 'pip-credits', accept: 'application/vnd.github+json' }
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`

  let people
  try {
    const res = await fetch(API, { headers, signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`GitHub API ${res.status}`)
    const raw = await res.json()
    people = raw
      .filter((c) => c.type === 'User' && !DENY.test(c.login))
      .sort((a, b) => b.contributions - a.contributions)
      .map((c) => ({
        login: c.login,
        avatar: c.avatar_url,
        url: c.html_url,
        contributions: c.contributions,
      }))
  } catch (err) {
    console.warn(`gen-credits: keeping committed list (${err.message})`)
    return
  }

  if (!people.length) {
    console.warn('gen-credits: API returned no eligible people — keeping committed list.')
    return
  }

  const next = `${JSON.stringify(people, null, 2)}\n`
  let prev = ''
  try {
    prev = readFileSync(OUT, 'utf8')
  } catch {
    // First run — no file yet.
  }
  if (next === prev) {
    console.log(`gen-credits: ${people.length} contributor(s), unchanged.`)
    return
  }
  writeFileSync(OUT, next)
  console.log(`gen-credits: wrote ${people.length} contributor(s).`)
}

main()

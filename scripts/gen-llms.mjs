/**
 * Post-build script that emits LLM-friendly content alongside the static
 * export, following https://llmstxt.org/:
 *
 *   1. For each content page, write a raw Markdown mirror at the page's URL
 *      plus `.md` (e.g. /privacy -> /privacy.md), produced by extracting the
 *      built page's main content and converting it to Markdown. Blog posts and
 *      the written /learn guides are discovered automatically from out/blog/
 *      and out/learn/, so a new post or guide needs no change here.
 *   2. Emit /llms.txt at the site root: the hand-written summary of what Pip
 *      is, then an index of every page linking to its raw Markdown.
 *
 * Runs after `next build` (see the build script in package.json) and writes
 * into the static `out/` export. The app pages (/play, /game, /stats and
 * /tutorial, which is the interactive tour) are interactive, not content, so
 * they get no mirror. The Learn hub and the guides under it are prose, and do.
 */

import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import TurndownService from 'turndown'
import { withFullText } from './feed-full-text.mjs'

const SITE = 'https://playpip.io'
const OUT = join(process.cwd(), 'out')

// The hand-written head of llms.txt — what Pip is, in prose. The generated
// page index follows it.
const PREAMBLE = `# Pip

> Texas Hold'em against AI and with friends — no account needed to play, no real
> money, open source. A calm, anti-casino poker game: play money only, no ads, no
> pop-ups, no dark patterns. Play in the browser at https://playpip.io, or in the
> iPhone app at https://apps.apple.com/app/pip-poker/id6819732662.

Single-player Pip runs in your browser, and your profile lives on your device. The
poker engine is a pure, deterministic, unit-tested TypeScript module, so you can read
exactly how every hand is shuffled and dealt rather than take our word for it. An
ordinary hand shuffles with Math.random; the Daily Deal passes a date-derived seed,
which is what makes one tournament a day identical for everyone in the world and
checkable against the source.

Multiplayer tables are dealt by our server instead, which sends each player only the
cards they may see, so nobody can read another player's hand from their browser.

The account is optional. It carries your progress to another device, it is what a
membership belongs to, and it is what you need to play multiplayer or appear on the
Pip Rating leaderboard. Without one, the only thing Pip sends us is an anonymous count
of hands played: it holds no identity for you and stores no row with your name on it.

Privacy: no cookies, no cross-site tracking. An account stores your email and a copy
of the profile that was already on your device; signing in with Google or Apple adds
what they send, and a membership adds a record that it is live. The only analytics are
anonymous and cookieless (Umami); the privacy page lists exactly what is counted.

Membership: £5.99 a month or £49 a year (also $7.99, €6.99 or ¥58 a month), for
hosting as many multiplayer games as you like, the lessons, every drill, the other
games and side tables, coaching reports and more. The ladder, the Rail, the Daily and
the freeroll stay free, and so does joining a friend's room. Chips are never for sale,
and nothing bought changes what happens once the cards are dealt.

Every link under Pages, Guides and Blog points to the page's raw Markdown mirror, so the
content can be fetched and parsed directly without HTML rendering.`

const FOOTER = `## Project

- [Source code](https://github.com/playpip/pip-web): The full open-source repo (MIT).
- [Roadmap](https://github.com/playpip/pip-web/blob/main/ROADMAP.md): Where Pip is going, in the open.
- [Contributing](https://github.com/playpip/pip-web/blob/main/CONTRIBUTING.md): How to get involved — code or not.

## What it is

- Texas Hold'em against a fixed cast of AI opponents with faces and personalities.
- A ladder of ten winner-take-all tournaments, from Friends' Garage to The Main Event, plus the Rail (cash tables that never end) and the Daily Deal.
- Multiplayer with friends: open a private room and send the code, with camera and voice if you want them, or a slow game with an hour to a day for each move. Or quick match at any ladder stake, with AI players in empty seats. With a free account you can join any friend's room, and host one room a day (up to four seats, no camera or voice), one quick match a day and one slow game at a time; members host as many as they like.
- More games for members: Pot-Limit Omaha, Omaha Hi-Lo, Short Deck and Five-Card Draw, plus side tables (Fast, Heads-Up, Bounty, Deep Stack) and Blackjack.
- The Pip Rating: a public rating of your decisions at a Hold'em table, not your results, with a live leaderboard. Needs an account to appear on it, and you can hide yourself.
- Learn poker: a three-minute interactive tour at https://playpip.io/tutorial (app, not prose, so no Markdown mirror), lessons with Webb on a real table (Level 1 free), drills graded by the engine, and the written guides listed above. https://playpip.io/learn indexes them.
- Daily rewards: chips counted in buy-ins at your table for coming back each day.
- Play money only. Chips are never for sale, and cosmetics are style, never edge (no pay-to-win).
- Hand permalinks: share any hand as a URL that replays step by step, with no server or account.
- Ambient help: live win-% equity, hand strength, plain-English opponent reads.
- Installable PWA and an iPhone app; light and dark themes; single-player works offline once loaded.`

// Content pages with a Markdown mirror. Blog posts are appended automatically.
const PAGES = [
  { route: '/', file: 'index.html' },
  { route: '/learn', file: 'learn.html' },
  { route: '/daily', file: 'daily.html' },
  { route: '/play-poker-free-no-signup', file: 'play-poker-free-no-signup.html' },
  { route: '/poker-odds-calculator', file: 'poker-odds-calculator.html' },
  { route: '/blog', file: 'blog.html' },
  { route: '/credits', file: 'credits.html' },
  { route: '/membership', file: 'membership.html' },
  { route: '/privacy', file: 'privacy.html' },
  { route: '/terms', file: 'terms.html' },
  { route: '/support', file: 'support.html' },
]

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
})
// Decorative/interactive-only elements carry no meaning in Markdown.
turndown.remove(['script', 'style', 'svg', 'noscript'])
// The guides' interactive examples are app, not prose. Rendered into a mirror
// they arrive as a column of loose card glyphs, which is worse than silence:
// the prose around them already says what they demonstrate. Components opt out
// with data-mirror="skip".
turndown.remove((node) => node.getAttribute?.('data-mirror') === 'skip')
// Icon-only links (their SVG stripped) would render as empty `[](url)` noise.
turndown.addRule('stripEmptyLinks', {
  filter: (node) => node.nodeName === 'A' && !node.textContent.trim(),
  replacement: () => '',
})
/**
 * Every descendant element with one of the given tag names, in document order,
 * not descending into a match. Turndown's DOM is domino, whose nodes have no
 * usable querySelectorAll, so childNodes is the portable way down.
 */
function collect(node, names) {
  const found = []
  for (const child of Array.from(node.childNodes ?? [])) {
    if (child.nodeType !== 1) continue
    if (names.includes(child.nodeName)) found.push(child)
    else found.push(...collect(child, names))
  }
  return found
}

/**
 * A cell's text, minus anything marked data-mirror="skip".
 *
 * textContent alone would be simpler and is wrong: Turndown's remove() filters
 * never run inside this rule, because the rule reads the DOM directly. So a
 * skip marker inside a table was silently ignored, and the starting-hands grid
 * repeated its screen-reader band label in all 169 cells.
 */
function cellText(node) {
  if (node.nodeType === 3) return node.data ?? ''
  if (node.nodeType !== 1) return ''
  if (node.getAttribute?.('data-mirror') === 'skip') return ''
  return Array.from(node.childNodes ?? [])
    .map(cellText)
    .join('')
}

// Tables are a GFM extension that Turndown core doesn't implement, so without
// this a rankings table flattens into a column of loose lines with no way to
// tell which cell belonged to which column. That is the opposite of the job
// these mirrors exist to do. Cells are emitted as their text: the guides' only
// in-cell markup is emphasis, which carries no meaning to a reader that can't
// see it. A cell containing a link would lose the link, and none does.
turndown.addRule('gfmTable', {
  filter: 'table',
  replacement: (_content, node) => {
    const rows = collect(node, ['TR']).map((tr) =>
      collect(tr, ['TH', 'TD']).map((cell) =>
        cellText(cell).replace(/\s+/g, ' ').replaceAll('|', '\\|').trim(),
      ),
    )
    if (rows.length === 0) return ''
    const width = Math.max(...rows.map((row) => row.length))
    const render = (row) => `| ${[...row, ...Array(width - row.length).fill('')].join(' | ')} |`
    const [head, ...body] = rows
    const divider = `| ${Array(width).fill('---').join(' | ')} |`
    return `\n\n${[render(head), divider, ...body.map(render)].join('\n')}\n\n`
  },
})

// Cast avatars are inline data-URI SVGs, tens of kilobytes each. Rendered into
// a mirror they are pure noise: a reader that cannot see them gains nothing,
// and one avatar outweighs the page it sits on.
turndown.addRule('stripDataImages', {
  filter: (node) => node.nodeName === 'IMG' && (node.getAttribute('src') ?? '').startsWith('data:'),
  replacement: () => '',
})

const HEADINGS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6']

// The index pages (/learn, /blog) make each entry one card-shaped link wrapping
// a heading and a paragraph. Turndown renders that literally, as a single link
// whose label spans block content: `[\n\n## Title\n\ntext](url)`, which is not
// valid Markdown and reads as noise. Emit the heading as the link instead and
// let the rest follow as prose under it.
turndown.addRule('cardLink', {
  filter: (node) => node.nodeName === 'A' && collect(node, HEADINGS).length > 0,
  replacement: (_content, node) => {
    const [heading] = collect(node, HEADINGS)
    const label = heading.textContent.replace(/\s+/g, ' ').trim()
    const href = node.getAttribute('href') ?? ''
    const body = collect(node, ['P'])
      .map((p) => p.textContent.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    const hashes = '#'.repeat(Number(heading.nodeName[1]))
    return `\n\n${hashes} [${label}](${href})\n\n${body.join('\n\n')}\n\n`
  },
})

/** Decode the handful of HTML entities Next emits into meta content. */
function decodeEntities(text) {
  return text
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/** The page's <title> without the site suffix, and its meta description. */
function readMeta(html) {
  const title = decodeEntities(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '')
    // Pages separate the site name with ·, an em dash or a pipe, depending on
    // whether the title is prose or a search-result headline.
    .replace(/\s*[·—|-]\s*Pip\s*$/u, '')
    .trim()
  const description = decodeEntities(
    html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '',
  )
  return { title: title || 'Pip', description }
}

/**
 * Isolate a page's readable content: prefer <main>, otherwise fall back to
 * <body>, and strip the shared header/footer chrome either way.
 */
function extractContentHtml(html) {
  const region =
    html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ??
    html
  return region
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
}

/** Write `<route>.md` for a built page and return its index entry. */
function writeMirror(page) {
  const html = readFileSync(join(OUT, page.file), 'utf-8')
  const { title, description } = readMeta(html)
  const markdown = turndown
    .turndown(extractContentHtml(html))
    .replace(/\n{3,}/g, '\n\n')
    // Site-relative links work in a browser but not in a fetched .md file.
    .replace(/\]\(\//g, `](${SITE}/`)
    .trim()
    // A leading standalone link is chrome (e.g. a post's back-link), not content.
    .replace(/^\[[^\]]+\]\([^)]*\)\s*/, '')
  const relative = page.route === '/' ? 'index' : page.route.replace(/^\//, '')
  // Pages render their own <h1>; only add one when the content lacks it.
  const body = markdown.startsWith('# ') ? markdown : `# ${title}\n\n${markdown}`
  writeFileSync(join(OUT, `${relative}.md`), `${body}\n`)
  return { route: `/${relative}.md`, title, description }
}

/** Every built blog post, newest first (dated in the sitemap). */
function blogPages() {
  const lastmod = new Map()
  const sitemap = readFileSync(join(OUT, 'sitemap.xml'), 'utf-8')
  for (const m of sitemap.matchAll(
    /<loc>([^<]*\/blog\/[^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g,
  )) {
    lastmod.set(new URL(m[1]).pathname, m[2])
  }
  return readdirSync(join(OUT, 'blog'))
    .filter((f) => f.endsWith('.html'))
    .map((f) => ({ route: `/blog/${f.replace(/\.html$/, '')}`, file: `blog/${f}` }))
    .sort((a, b) => (lastmod.get(b.route) ?? '').localeCompare(lastmod.get(a.route) ?? ''))
}

/**
 * Every built /learn guide, in the order the sitemap lists them, which is the
 * registry's ranked order rather than a date. /learn itself is the interactive
 * tour and builds to out/learn.html, not into out/learn/, so it never appears
 * here and needs no excluding.
 */
function learnPages() {
  const dir = join(OUT, 'learn')
  if (!existsSync(dir)) return []
  const sitemap = readFileSync(join(OUT, 'sitemap.xml'), 'utf-8')
  const ranked = [...sitemap.matchAll(/<loc>([^<]*\/learn\/[^<]+)<\/loc>/g)].map(
    (m) => new URL(m[1]).pathname,
  )
  const rank = (page) => {
    const i = ranked.indexOf(page.route)
    return i === -1 ? ranked.length : i
  }
  return readdirSync(dir)
    .filter((f) => f.endsWith('.html'))
    .map((f) => ({ route: `/learn/${f.replace(/\.html$/, '')}`, file: `learn/${f}` }))
    .sort((a, b) => rank(a) - rank(b))
}

const line = (e) => `- [${e.title}](${SITE}${e.route})${e.description ? `: ${e.description}` : ''}`

const pageEntries = PAGES.map(writeMirror)
const learnEntries = learnPages().map(writeMirror)
const blogEntries = blogPages().map(writeMirror)

const sections = [PREAMBLE, '## Pages', pageEntries.map(line).join('\n')]
if (learnEntries.length > 0) sections.push('## Guides', learnEntries.map(line).join('\n'))
if (blogEntries.length > 0) sections.push('## Blog', blogEntries.map(line).join('\n'))
sections.push(FOOTER)

const written = pageEntries.length + learnEntries.length + blogEntries.length
writeFileSync(join(OUT, 'llms.txt'), `${sections.join('\n\n')}\n`)

// Each mirror is a full-text duplicate of an indexable page, and llms.txt
// links every one, so each says which page it copies. The static ones get the
// header here; functions/_shared.ts serves the /blog and /learn mirrors and
// adds it only if this one did not reach the asset it copies.
const canonicals = [...pageEntries, ...learnEntries, ...blogEntries]
  .map((e) => {
    const page = e.route === '/index.md' ? SITE : `${SITE}${e.route.replace(/\.md$/, '')}`
    return `${e.route}\n  Link: <${page}>; rel="canonical"`
  })
  .join('\n')
appendFileSync(
  join(OUT, '_headers'),
  `\n# Markdown mirrors point back at their pages (scripts/gen-llms.mjs).\n${canonicals}\n`,
)

// The feed carries each post in full, so a reader importing from it gets the
// post rather than its summary (scripts/feed-full-text.mjs).
const rss = join(OUT, 'rss.xml')
const postFile = (slug) => join(OUT, 'blog', `${slug}.html`)
writeFileSync(
  rss,
  withFullText(readFileSync(rss, 'utf-8'), SITE, (slug) =>
    existsSync(postFile(slug)) ? readFileSync(postFile(slug), 'utf-8') : null,
  ),
)
console.log(`gen-llms: wrote llms.txt + ${written} markdown mirror(s).`)

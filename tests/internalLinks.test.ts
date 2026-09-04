import { readFileSync, readdirSync } from 'node:fs'
import test from 'ava'
import sitemap from '@/app/sitemap'
import { SITE_URL } from '@/config/site'

// `/poker-odds-calculator` shipped with no internal link from anywhere on the
// site and stayed that way. In August it took 62 of the site's 202 Google
// impressions, more than every guide combined, across eleven separate
// calculator queries, which made it the best-performing page we had and one
// that could only be reached by already knowing the URL.
//
// The footer already carried the rule, in a comment next to
// `/play-poker-free-no-signup`: "a page nothing links to is a page a crawler
// reaches only through the sitemap". It was written for one page rather than
// applied to the list, and the next page in the list broke it. So it is a test
// now.
//
// It checks reachability from the source, not link equity. One link passes.
// The failure it exists to catch is zero.
//
// Blog posts do not count as a link. Written first with them counting, this
// test passed on the exact state it was written to catch, because the August
// roundup happened to mention the calculator in a sentence. A dated post is an
// archive entry rather than a way around the site: nobody reaches a tool by
// reading last month's release notes, and a link that lives in one is not a
// thing anyone maintains. Navigation is the footer and the index pages.

/** '' for the home page, '/credits' for a prose page. */
function pathOf(url: string): string {
  return url.slice(SITE_URL.length)
}

// Blog posts and Learn guides are linked from their index pages by a registry
// that builds the href from a slug, so the literal path never appears in the
// source and there is nothing to grep for. They also cannot be forgotten: an
// entry in the registry *is* the link. The hand-written routes below are the
// ones where the sitemap entry and the link are two separate acts, which is
// what makes one of them skippable.
const REGISTRY_LINKED = /^\/(blog|learn)\/.+/

// Reached from the wordmark in every header, not from an href we could grep.
const HOME = ''

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(new URL(dir, import.meta.url), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) sources(path, out)
    else if (/\.tsx?$/.test(entry.name)) out.push(path)
  }
  return out
}

// The sitemap lists every route by definition, so counting itself as a link
// would make this test pass on any input.
const NOT_A_LINK = (file: string) =>
  file === '../src/app/sitemap.ts' || file.startsWith('../src/app/blog/')

test('every hand-written route in the sitemap is linked from somewhere else on the site', (t) => {
  const files = [...sources('../src/app'), ...sources('../src/components')].filter(
    (file) => !NOT_A_LINK(file),
  )
  t.true(files.length > 40, 'the walk found nothing, so it is proving nothing')

  const cached = new Map(
    files.map((file) => [file, readFileSync(new URL(file, import.meta.url), 'utf-8')]),
  )

  for (const { url } of sitemap()) {
    const path = pathOf(url)
    if (path === HOME || REGISTRY_LINKED.test(path)) continue

    // The route's own folder is excluded: a page's canonical tag, its Markdown
    // alternate and its own metadata all name its path, and none of them is a
    // way in from anywhere else.
    const ownFolder = `../src/app${path}/`
    const linkedFrom = files.filter(
      (file) =>
        !file.startsWith(ownFolder) &&
        (cached.get(file)!.includes(`'${path}'`) || cached.get(file)!.includes(`"${path}"`)),
    )

    t.true(
      linkedFrom.length > 0,
      `${path} is in the sitemap and nothing links to it, so the only way to reach it is to already know the URL. Add it to the footer, or to the page a reader would look for it on.`,
    )
  }
})

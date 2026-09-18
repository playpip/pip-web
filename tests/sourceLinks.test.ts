import { existsSync, readFileSync, readdirSync } from 'node:fs'
import test from 'ava'

// Posts about this repository name files in the prose and now link them. A link
// to a file is the one kind of claim a reader checks for themselves, which makes
// it worth more than the sentence around it, and it is also the one kind that
// rots without saying so: rename `src/config/routeStates.ts` and the post that
// links it starts serving a 404 to exactly the reader who cared enough to click.
//
// Nothing else in the suite would notice. The file's own tests follow it to its
// new name via the import; the link is a string.
//
// So this walks the source text rather than a registry of links, and it has to
// match two shapes. Eight of these were hand-written `<A href>` before the `Src`
// helper existed, and a guard that only covered the helper would leave them
// exactly as unprotected as they were. `Src` is the other shape, and it is the
// one that is easy to miss, because the page holds only the path: the URL is
// assembled in the helper and the string a grep for github.com would find never
// appears in the post at all. Written that way first, this test read a post with
// a deliberately broken `Src` path and passed.

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(new URL(dir, import.meta.url), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) sources(path, out)
    else if (/\.tsx?$/.test(entry.name)) out.push(path)
  }
  return out
}

/** A hand-written link: `blob` for a file, `tree` for a directory. */
const REPO_URL = /github\.com\/playpip\/pip-web\/(?:blob|tree)\/main\/([^"'\s)<]+)/g

/** `<Src path="tests/headers.test.ts" />`, where the URL is the helper's job. */
const SRC_PROP = /<Src\s+path=(?:"([^"]+)"|\{([^}]+)\})/g

/** Where `Src` builds the URL. Its path is a parameter, and its callers are what this checks. */
const HELPER = '../src/components/marketing/LegalPage.tsx'

function repoLinks(): { file: string; path: string }[] {
  const found: { file: string; path: string }[] = []
  for (const file of [...sources('../src'), ...sources('../functions')]) {
    const text = readFileSync(new URL(file, import.meta.url), 'utf-8')
    for (const [, path] of text.matchAll(REPO_URL)) found.push({ file, path })
    // A `path={…}` capture is an expression rather than a literal, and falls
    // through to the computed check below, which fails it.
    for (const [, literal, expression] of text.matchAll(SRC_PROP))
      found.push({ file, path: literal ?? `\${${expression}}` })
  }
  return found
}

/** A path with a `${}` in it is computed, so there is nothing on disk to look for. */
const COMPUTED = (path: string) => path.includes('${')

test('every file this site links to in its own repository exists', (t) => {
  const links = repoLinks()
  t.true(links.length > 8, 'the walk found no repository links, so it is proving nothing')
  t.true(
    links.some(({ file }) => file.startsWith('../src/app/blog/')),
    'no blog post links a file, so either the posts dropped their source links or Src was renamed and this regex stopped matching',
  )

  for (const { file } of links.filter(({ path }) => COMPUTED(path))) {
    t.is(
      file,
      HELPER,
      `${file} builds a repository link out of an expression, so nothing can check where it points. Pass the path to Src as a literal.`,
    )
  }

  for (const { file, path } of links.filter(({ path }) => !COMPUTED(path))) {
    t.true(
      existsSync(new URL(`../${path}`, import.meta.url)),
      `${file} links to ${path}, which is not in the repository. Renaming a file that a page cites breaks the link silently: update the path, or drop the link.`,
    )
  }
})

test('no repository link carries a line anchor', (t) => {
  // `#L42` is the one part of a GitHub file URL nothing here can check. The path
  // is verifiable and a line number is not: insert a line above it and the
  // anchor points at the wrong code while every test stays green. Name the
  // function in the prose and link the file.
  for (const { file, path } of repoLinks()) {
    t.false(
      /#L\d/.test(path),
      `${file} links to ${path} with a line anchor. Line numbers drift and nothing can catch it. Link the file and name the symbol in the sentence.`,
    )
  }
})

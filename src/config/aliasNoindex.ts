// The `pages.dev` alias, and the rule in `public/_headers` that keeps it out of
// the index.
//
// /blog/cloudflare-pages-dev-duplicate publishes that rule as the fix, which
// makes it a published claim about what we actually ship rather than an
// illustration. So the post renders these constants and tests/headers.test.ts
// asserts `public/_headers` really contains them. Change the rule without
// changing the post and the build fails, which is the only arrangement under
// which a post about a config file is worth anything.

/** The Pages project's production alias. Not a preview host. */
export const ALIAS_HOST = 'pip-web-9oj.pages.dev'

/**
 * The `_headers` pattern. A pattern with a scheme and a host matches that host
 * only, and that scoping is the whole safety of the thing: the same two lines
 * without the host take playpip.io out of Google.
 */
export const ALIAS_RULE = `https://${ALIAS_HOST}/*`

export const ALIAS_HEADER = 'X-Robots-Tag: noindex'

/**
 * The day the alias was checked from outside and found serving the production
 * build with no `X-Robots-Tag` on it. A date rather than the present tense: the
 * post describes what was true when it was written, and the rule below is what
 * is true now.
 */
export const ALIAS_FOUND_ON = '26 August 2026'

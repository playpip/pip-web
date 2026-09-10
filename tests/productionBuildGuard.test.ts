import test from 'ava'
import { readFileSync } from 'node:fs'
import { missingProductionConfig } from '../scripts/guard-production-build.mjs'

// The guard this tests is the only thing standing between a failed deploy and
// accounts disappearing from playpip.io.
//
// The Cloudflare Pages Git integration builds every push to main from git, with
// none of the repo Variables. Usually our workflow publishes over the top a few
// minutes later and nobody sees it. When our deploy does not finish, the
// config-less build is what serves, `syncConfigured()` goes false, and every
// account surface renders null while the copy still promises accounts. It has
// happened twice (technology#69, and again on 10 September when the audit gate
// went red on main and stopped the deploy before the build step).
//
// The guard fails that build so Cloudflare never promotes it. What makes it
// safe is how narrow it is, and narrowness is what is asserted here: it must
// stay silent for our own workflow, for CI, for previews and for a contributor
// with no backend, all of which build without config on purpose.

const CONFIG = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_0123456789abcdefghij',
}

const ON_CLOUDFLARE_PRODUCTION = { CF_PAGES: '1', CF_PAGES_BRANCH: 'main' }

test('it fires on a Cloudflare production build with no config', (t) => {
  const missing = missingProductionConfig({ ...ON_CLOUDFLARE_PRODUCTION })
  t.deepEqual(missing, ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'])
})

test('it fires when either half of the pair is missing on its own', (t) => {
  // Half-configured is the worse case, not the better one: the bundle looks
  // plausible and sync is still off.
  t.deepEqual(
    missingProductionConfig({
      ...ON_CLOUDFLARE_PRODUCTION,
      NEXT_PUBLIC_SUPABASE_URL: CONFIG.NEXT_PUBLIC_SUPABASE_URL,
    }),
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  )
  t.deepEqual(
    missingProductionConfig({
      ...ON_CLOUDFLARE_PRODUCTION,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: CONFIG.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }),
    ['NEXT_PUBLIC_SUPABASE_URL'],
  )
})

test('an empty string counts as missing, not as set', (t) => {
  // A Pages project variable that exists with no value is the shape most likely
  // to arrive from a half-finished dashboard edit, and Next inlines it as ''.
  t.deepEqual(
    missingProductionConfig({
      ...ON_CLOUDFLARE_PRODUCTION,
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
    }),
    ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  )
})

test('it stays silent on a Cloudflare production build that is configured', (t) => {
  t.is(missingProductionConfig({ ...ON_CLOUDFLARE_PRODUCTION, ...CONFIG }), null)
})

test('it stays silent on a Cloudflare preview build, which has no config by design', (t) => {
  // Previews are blind to accounts on purpose. Failing them would cost every
  // content review on the project and buy nothing.
  t.is(missingProductionConfig({ CF_PAGES: '1', CF_PAGES_BRANCH: 'cmo/some-branch' }), null)
  t.is(missingProductionConfig({ CF_PAGES: '1', CF_PAGES_BRANCH: 'fix/audit' }), null)
})

test('it stays silent anywhere that is not Cloudflare', (t) => {
  // Our own deploy workflow, ci.yaml, a fork, and a laptop. `pnpm build` has to
  // keep working with no backend or a contributor cannot run the app.
  t.is(missingProductionConfig({}), null)
  t.is(missingProductionConfig({ CI: 'true', GITHUB_ACTIONS: 'true' }), null)
  t.is(missingProductionConfig({ CF_PAGES_BRANCH: 'main' }), null)
})

test('a branch merely named like main is not the production branch', (t) => {
  t.is(missingProductionConfig({ CF_PAGES: '1', CF_PAGES_BRANCH: 'mainline' }), null)
  t.is(missingProductionConfig({ CF_PAGES: '1', CF_PAGES_BRANCH: 'feat/main-menu' }), null)
})

test('the guard runs before anything else in the build', (t) => {
  // Order is the point: it costs seconds and it must not sit behind a full
  // `next build`. If someone reorders the chain, the guard still works but the
  // failure arrives minutes later, so hold the position.
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as {
    scripts: Record<string, string>
  }

  t.true(
    pkg.scripts.build.startsWith('node scripts/guard-production-build.mjs'),
    'guard-production-build.mjs must be the first step of `pnpm build`',
  )
})

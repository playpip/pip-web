// Pre-build: refuse to let the *other* publisher build production.
//
// Two things publish playpip.io. One is
// .github/workflows/deploy-cloudflare-pages.yaml, which runs the whole gate,
// builds with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY set
// from repo Variables, checks the emitted bundle with assert-sync-config.mjs,
// and only then uploads. The other is the Cloudflare Pages Git integration,
// which builds every push to every branch straight from git. It runs none of
// the gate and has none of the variables.
//
// Normally the second one loses: it publishes a config-less bundle, and a few
// minutes later our workflow publishes a good one over the top. The site is
// briefly wrong and then right, and nobody notices.
//
// It stops losing the moment our deploy does not finish. Any red step, a
// cancelled run, a failed audit, and the config-less build is simply what
// serves. `syncConfigured()` returns false, so SyncSection, AccountRow and the
// onboarding step all render null: accounts vanish from the product while the
// copy still promises them, and nothing anywhere reports it. That was the
// 23-24 August outage (technology#69, technology#73) and it happened again on
// 10 September, that time because a weekly `pnpm audit` advisory went red on
// main and stopped the deploy before it built anything.
//
// assert-sync-config.mjs cannot catch this. It runs inside our workflow, and
// our workflow is the publisher that was never the problem.
//
// So: fail the build itself, in the one environment where a missing variable
// means the result is about to be served to players. A failed Cloudflare build
// is not promoted, so the previous good deployment keeps serving and the site
// stays correct instead of silently losing accounts.
//
// The real fix is disconnecting the Git integration (technology#74), which is
// one click in a dashboard nothing here can reach. Until that happens this is
// the repo-side half, and it stays harmless afterwards.
//
// Scope, deliberately narrow. This fires ONLY when Cloudflare is building the
// production branch. Previews keep building without config on purpose (they are
// blind to accounts by design), CI builds without it on purpose, and a
// contributor with no backend must always be able to run `pnpm build`. If the
// CF_PAGES variables are ever absent or renamed the guard simply does nothing,
// which is exactly where we are today.
//
// Usage: node scripts/guard-production-build.mjs   (first step of `pnpm build`)
// Exit 0 = not our business, or configured. Exit 1 = this build must not ship.

/** The Cloudflare Pages branch whose builds are served on playpip.io. */
const PRODUCTION_BRANCH = 'main'

/** Set by Cloudflare Pages in its build container, and by nothing else we run. */
const CLOUDFLARE_MARKER = 'CF_PAGES'
const CLOUDFLARE_BRANCH = 'CF_PAGES_BRANCH'

const REQUIRED = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']

/**
 * Decide whether this build is allowed to proceed.
 *
 * Pure, so the decision is testable without a build: pass an env-shaped object,
 * get back either null (carry on) or the list of variables that are missing.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string[] | null} the missing variable names, or null to proceed
 */
export function missingProductionConfig(env) {
  // Not Cloudflare: our own workflow, CI, a fork, a laptop. Never our business.
  if (env[CLOUDFLARE_MARKER] !== '1') return null

  // A Cloudflare preview build. Config-less is the documented, intended state.
  if (env[CLOUDFLARE_BRANCH] !== PRODUCTION_BRANCH) return null

  // Cloudflare, production branch: whatever this produces is what players get.
  const missing = REQUIRED.filter((name) => !env[name])
  return missing.length > 0 ? missing : null
}

const missing = missingProductionConfig(process.env)

if (missing) {
  console.error(
    [
      '',
      'guard-production-build: REFUSING TO BUILD PRODUCTION WITHOUT SYNC CONFIG.',
      '',
      `  Cloudflare Pages is building the '${PRODUCTION_BRANCH}' branch, so this build`,
      '  would be served on playpip.io. These are not set:',
      '',
      ...missing.map((name) => `    ${name}`),
      '',
      '  NEXT_PUBLIC_* is inlined at build time. Without them the client bundle keeps a',
      '  runtime lookup that reads empty, syncConfigured() returns false, and every',
      '  account surface removes itself. The build would be green and the site would',
      '  quietly have no accounts in it.',
      '',
      '  This deployment will not be promoted, so playpip.io keeps serving the last good',
      '  one. That is the intended outcome, not a regression.',
      '',
      '  Two ways out, and the first is the real one:',
      '',
      '    1. Disconnect the Cloudflare Pages Git integration (technology#74). The',
      '       workflow in .github/workflows/deploy-cloudflare-pages.yaml is the only',
      '       thing that should publish, and it runs the full gate first.',
      '',
      '    2. Or set both variables on the Pages project itself, if the Git',
      '       integration is meant to publish. Setting them in GitHub does nothing',
      '       for a build that runs on Cloudflare.',
      '',
      '  Whatever stopped the workflow deploy is still the thing to fix: this guard only',
      '  stops the failure reaching players.',
      '',
    ].join('\n'),
  )
  process.exit(1)
}

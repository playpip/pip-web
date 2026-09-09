// Post-build, pre-publish: refuse to ship a production bundle with sync switched off.
//
// Why this exists. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are
// inlined into the client bundle at build time. If they are absent from the build
// environment, Next leaves a runtime `process.env.…` lookup behind instead. In a browser
// that shim is empty, so `syncConfigured()` returns false and every account surface
// removes itself: SyncSection, AccountRow and the onboarding step all render null.
//
// Nothing fails. The build is green, the tests are green, the deploy is green, and the
// site quietly has no accounts in it. That is exactly what shipped: playpip.io served a
// bundle with no config while /privacy told players to enable sync "in Settings, under
// Account", a section that was not being rendered (technology#69).
//
// A unit test cannot see this, because the defect is in the build environment rather than
// in the source. The only place the truth exists is the emitted bundle, so that is what
// this checks.
//
// Deliberately NOT part of `pnpm build` or `test:all`. Missing config is a *supported*
// state for local builds and forks (see src/lib/sync/client.ts), and a contributor should
// never need a backend to run the app. It belongs in the deploy workflow only, where the
// variables are wired and their absence is a fault.
//
// It runs as the "Assert the build has sync configured" step in
// .github/workflows/deploy-cloudflare-pages.yaml, between the build and the publish.
//
// Usage: node scripts/assert-sync-config.mjs [outDir]   (default: out)
// Exit 0 = config is inlined. Exit 1 = it is not, and the deploy must stop.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const outDir = process.argv[2] ?? 'out'
const chunkDir = join(outDir, '_next', 'static', 'chunks')

// The shapes the values take once inlined. The URL is checked structurally rather than
// against a pinned project ref, so that repointing the project stays a deploy-time
// decision and not a failure here. The key matches both the current publishable-key
// format and the older JWT-style anon key.
const URL_RE = /https:\/\/[a-z0-9]{16,}\.supabase\.co/
const KEY_RE = /sb_publishable_[\w-]{20,}|eyJ[\w.-]{60,}/

// The fingerprint of the broken build: the lookup survived to runtime instead of being
// replaced by a literal. Reported separately because it is the specific, actionable
// diagnosis rather than a generic "not found".
const RUNTIME_LOOKUP_RE = /env\.NEXT_PUBLIC_SUPABASE_(?:URL|ANON_KEY)/

function jsFilesIn(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }
  const files = []
  for (const entry of entries) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) files.push(...jsFilesIn(path))
    else if (entry.endsWith('.js')) files.push(path)
  }
  return files
}

const files = jsFilesIn(chunkDir)
if (files.length === 0) {
  console.error(`assert-sync-config: no chunks under ${chunkDir}. Did the build run?`)
  process.exit(1)
}

let urlIn = null
let keyIn = null
let runtimeLookupIn = null

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  if (!urlIn && URL_RE.test(src)) urlIn = file
  if (!keyIn && KEY_RE.test(src)) keyIn = file
  if (!runtimeLookupIn && RUNTIME_LOOKUP_RE.test(src)) runtimeLookupIn = file
}

if (urlIn && keyIn) {
  console.log(`assert-sync-config: config inlined across ${files.length} chunks, sync is on.`)
  process.exit(0)
}

console.error(
  [
    '',
    'assert-sync-config: THIS BUILD HAS SYNC SWITCHED OFF. Refusing to publish.',
    '',
    `  Scanned ${files.length} chunks under ${chunkDir}.`,
    `  Supabase URL inlined: ${urlIn ?? 'NO'}`,
    `  Supabase key inlined: ${keyIn ?? 'NO'}`,
    '',
    runtimeLookupIn
      ? `  Found a runtime lookup that should have been inlined, in ${runtimeLookupIn}.\n` +
        '  That is the signature of the variables being absent when the build ran.'
      : '  No runtime lookup either, so the sync module may have been dropped entirely.',
    '',
    '  Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the environment',
    '  that BUILDS production, then redeploy. Note that is not necessarily this workflow:',
    '  if Cloudflare Pages builds from git directly, the variables have to be set on the',
    '  Pages project, and setting them in GitHub alone changes nothing.',
    '',
    '  Shipping without them is not a degraded deploy. Accounts vanish from the product',
    '  while the copy still promises them.',
    '',
  ].join('\n'),
)
process.exit(1)

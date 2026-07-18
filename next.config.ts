import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import type { NextConfig } from 'next'

// Human-facing version (from package.json) and a per-deploy build id (the git
// short SHA). The version tells users what they're running; the build id is what
// changes every deploy, so it keys both the on-screen label and the service
// worker's cache (see public/sw.js + scripts/stamp-sw.mjs).
const version: string = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
).version

let buildId = 'dev'
try {
  buildId = execSync('git rev-parse --short HEAD').toString().trim()
} catch {
  // No git (e.g. a tarball build) — fall back to the version string.
  buildId = version
}

const nextConfig: NextConfig = {
  // Pure static export ("out/") — the app is fully client-side (local-first,
  // no server), so it deploys to Cloudflare Pages as plain files.
  output: 'export',
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  // Pin the Turbopack root to this project so the pnpm-workspace.yaml
  // marker isn't mistaken for a monorepo root.
  turbopack: {
    root: import.meta.dirname,
  },
}

export default nextConfig

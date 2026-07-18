// Post-build: stamp the git short SHA into the exported service worker's cache
// name, so every deploy ships a byte-different sw.js. The browser then sees an
// updated worker, installs a fresh cache, and purges the old one on activate —
// the whole cache-bust hinges on this string changing per deploy.
//
// Runs against out/sw.js (Next copies public/sw.js there verbatim). Kept out of
// the worker itself so the source stays a plain, build-tool-free file.

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const SW = new URL('../out/sw.js', import.meta.url)

let buildId = 'dev'
try {
  buildId = execSync('git rev-parse --short HEAD').toString().trim()
} catch {
  // No git available — leave a stable-but-non-empty id.
}

const src = readFileSync(SW, 'utf8')
if (!src.includes('__BUILD_ID__')) {
  console.warn('stamp-sw: no __BUILD_ID__ placeholder in out/sw.js — nothing to stamp.')
  process.exit(0)
}
writeFileSync(SW, src.replaceAll('__BUILD_ID__', buildId))
console.log(`stamp-sw: cache keyed to pip-${buildId}`)

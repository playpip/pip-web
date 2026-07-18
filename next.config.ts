import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Pure static export ("out/") — the app is fully client-side (local-first,
  // no server), so it deploys to Cloudflare Pages as plain files.
  output: 'export',
  // Pin the Turbopack root to this project so the pnpm-workspace.yaml
  // marker isn't mistaken for a monorepo root.
  turbopack: {
    root: import.meta.dirname,
  },
}

export default nextConfig

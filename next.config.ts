import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Pin the Turbopack root to this project so the pnpm-workspace.yaml
  // marker isn't mistaken for a monorepo root.
  turbopack: {
    root: import.meta.dirname,
  },
}

export default nextConfig

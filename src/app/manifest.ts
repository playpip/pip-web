import type { MetadataRoute } from 'next'

// The PWA manifest — served at /manifest.webmanifest and linked automatically.
// Installing Pip matters beyond convenience: installed web apps are exempt from
// Safari's 7-day script-storage eviction, which protects the local profile.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'pip',
    short_name: 'pip',
    description:
      'Casual poker, redesigned. Clean single-player Texas Hold’em — play money, no accounts.',
    // Installed app launches straight into the lobby, not the marketing page.
    id: '/game',
    start_url: '/game',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0a0b',
    theme_color: '#0a0a0b',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}

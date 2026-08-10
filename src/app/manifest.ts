import type { MetadataRoute } from 'next'

// Metadata routes must opt in to static generation under `output: 'export'`.
export const dynamic = 'force-static'

// The PWA manifest — served at /manifest.webmanifest and linked automatically.
// Installing Pip matters beyond convenience: installed web apps are exempt from
// Safari's 7-day script-storage eviction, which protects the local profile.
// Chrome shows at most five screenshots on Android and eight on desktop, in
// order, and since Chrome 109 it shows only `wide` on desktop and ignores
// `wide` entirely on Android — so the two sets are separate files, not one set
// resized. Every screenshot of a form factor must share an aspect ratio or the
// odd one out is dropped. Both sets are 16:9, which also clears Play's 2x
// long-side limit. They must be served from playpip.io: an off-domain URL fails
// the pwa.directory check and may not render in the install dialog either.
// `label` is what a screen reader announces there.
const SCREENSHOTS: MetadataRoute.Manifest['screenshots'] = [
  {
    src: '/screenshots/phone-1-table.png',
    sizes: '1080x1920',
    type: 'image/png',
    form_factor: 'narrow',
    label:
      "A hand in progress: four community cards face up, the player's two hole cards, a pot of 8 chips, and Fold, Check and Bet buttons.",
  },
  {
    src: '/screenshots/phone-2-opponent.png',
    sizes: '1080x1920',
    type: 'image/png',
    form_factor: 'narrow',
    label:
      "An opponent's profile: Doris, loose and passive, with three read bars and a note that you have played sixteen hands together.",
  },
  {
    src: '/screenshots/phone-3-venues.png',
    sizes: '1080x1920',
    type: 'image/png',
    form_factor: 'narrow',
    label:
      'The venue ladder: rooms as illustrated cards, the first one open and the rest showing the Roll needed to enter.',
  },
  {
    src: '/screenshots/phone-4-home.png',
    sizes: '1080x1920',
    type: 'image/png',
    form_factor: 'narrow',
    label:
      'The home screen: a Roll of 100 chips, the shop, the learn guides, and tiles for the Daily and the cash tables.',
  },
  {
    src: '/screenshots/phone-5-cash.png',
    sizes: '1080x1920',
    type: 'image/png',
    form_factor: 'narrow',
    label:
      'The cash tables: four stakes from 1/2 to 30/60, each showing table size, stack depth and the Roll needed.',
  },
  {
    src: '/screenshots/desktop-1-table.png',
    sizes: '1920x1080',
    type: 'image/png',
    form_factor: 'wide',
    label:
      "A hand in progress: four community cards face up, the player's two hole cards, a pot of 8 chips, and Fold, Check and Bet buttons.",
  },
  {
    src: '/screenshots/desktop-2-opponent.png',
    sizes: '1920x1080',
    type: 'image/png',
    form_factor: 'wide',
    label:
      "An opponent's profile: Doris, loose and passive, with three read bars and a note that you have played sixteen hands together.",
  },
  {
    src: '/screenshots/desktop-3-venues.png',
    sizes: '1920x1080',
    type: 'image/png',
    form_factor: 'wide',
    label:
      "The venue ladder on a wide screen: all ten rooms as illustrated cards, from Friends' Garage to the Main Event.",
  },
]

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'pip',
    short_name: 'pip',
    description:
      'Casual poker, redesigned. Clean single-player Texas Hold’em — play money, no account needed.',
    // Installed app launches straight into the lobby, not the marketing page.
    id: '/game',
    start_url: '/game',
    display: 'standalone',
    categories: ['games'],
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
    screenshots: SCREENSHOTS,
  }
}

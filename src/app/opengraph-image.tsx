import { ogContentType, ogImage, ogSize } from '@/lib/og'

// Site-wide social card (root). Next merges this into `openGraph.images` and
// `twitter.images` automatically. Prerendered to a static PNG at build.
// Prerender to a static PNG at build (required under `output: 'export'`).
export const dynamic = 'force-static'
export const alt = 'Pip — poker without the casino'
export const size = ogSize
export const contentType = ogContentType

export default function Image() {
  return ogImage({
    eyebrow: 'SINGLE-PLAYER TEXAS HOLD’EM',
    lines: ['Poker without', 'the casino.'],
    subtitle:
      'Real Hold’em vs AI, wrapped in a calm, modern app. Play money, no accounts, open source.',
  })
}

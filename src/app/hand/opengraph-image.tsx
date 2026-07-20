import { ogContentType, ogImage, ogSize } from '@/lib/og'

// Social card for shared hand permalinks (/hand#…). Intentionally GENERIC: the
// hand data lives in the URL fragment, which never reaches a server, so a
// per-hand image is impossible by design. The link still replays the real hand.
// Prerender to a static PNG at build (required under `output: 'export'`).
export const dynamic = 'force-static'
export const alt = 'A poker hand shared on Pip'
export const size = ogSize
export const contentType = ogContentType

export default function Image() {
  return ogImage({
    eyebrow: 'A SHARED HAND',
    lines: ['Watch this', 'play out.'],
    subtitle:
      'Someone shared a Pip hand — every card, every bet, replayed in your browser. No account needed.',
  })
}

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

// Shared OpenGraph / Twitter card renderer. Built with @vercel/og (Satori) so it
// prerenders to a static PNG at build time — works under `output: 'export'` (no
// server at runtime). Mirrors the landing look: flat, black-first, one pip accent.

export const ogSize = { width: 1200, height: 630 }
export const ogContentType = 'image/png'

const PIP = '#7c8cf0'
const BG = '#0a0a0b'
const FG = '#fafafa'
const MUTED = '#a1a1aa'
const RED = '#e5484d'

// Geist, vendored as .woff in src/app/_fonts (Satori supports woff/ttf/otf, not
// woff2). Read lazily at build time from the project cwd — deterministic, no
// network, and no filesystem work at module load (which would run on unrelated
// route prerenders and break them).
function loadFonts() {
  const read = (f: string) => readFileSync(join(process.cwd(), 'src/app/_fonts', f))
  return [
    { name: 'Geist', data: read('Geist-600.woff'), weight: 600 as const, style: 'normal' as const },
    { name: 'Geist', data: read('Geist-400.woff'), weight: 400 as const, style: 'normal' as const },
  ]
}

function Suit({ kind }: { kind: 'spade' | 'heart' }) {
  const d =
    kind === 'heart'
      ? 'M12 21s-8.5-5.9-8.5-12A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8.5 3C20.5 15.1 12 21 12 21z'
      : 'M12 2C12 2 4 9 4 14a4 4 0 0 0 6.9 2.8C10.6 18.5 9.8 20 8.5 21h7c-1.3-1-2.1-2.5-2.4-4.2A4 4 0 0 0 20 14c0-5-8-12-8-12z'
  return (
    <svg width="92" height="92" viewBox="0 0 24 24" fill={kind === 'heart' ? RED : BG}>
      <path d={d} />
    </svg>
  )
}

function Card({
  rank,
  kind,
  rotate,
  x,
}: {
  rank: string
  kind: 'spade' | 'heart'
  rotate: number
  x: number
}) {
  const color = kind === 'heart' ? RED : BG
  return (
    <div
      style={{
        position: 'absolute',
        display: 'flex',
        flexDirection: 'column',
        width: 210,
        height: 294,
        borderRadius: 22,
        backgroundColor: FG,
        padding: 22,
        transform: `translateX(${x}px) rotate(${rotate}deg)`,
        boxShadow: '0 30px 60px rgba(0,0,0,0.45)',
      }}
    >
      <div style={{ display: 'flex', fontSize: 52, fontWeight: 600, color }}>{rank}</div>
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Suit kind={kind} />
      </div>
    </div>
  )
}

interface OgProps {
  eyebrow: string
  lines: string[]
  subtitle: string
}

function OgCard({ eyebrow, lines, subtitle }: OgProps) {
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        backgroundColor: BG,
        color: FG,
        padding: 80,
        fontFamily: 'Geist',
      }}
    >
      {/* left: the copy */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        <div
          style={{
            display: 'flex',
            fontSize: 40,
            fontWeight: 600,
            letterSpacing: -1,
            marginBottom: 30,
          }}
        >
          pip
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 21,
            fontWeight: 600,
            color: PIP,
            letterSpacing: 2,
            marginBottom: 20,
          }}
        >
          {eyebrow}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {lines.map((l) => (
            <div
              key={l}
              style={{
                display: 'flex',
                fontSize: 74,
                fontWeight: 600,
                lineHeight: 1.05,
                letterSpacing: -2,
              }}
            >
              {l}
            </div>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 29,
            color: MUTED,
            marginTop: 28,
            maxWidth: 580,
            lineHeight: 1.3,
          }}
        >
          {subtitle}
        </div>
      </div>
      {/* right: the pocket-aces fan (echoes the landing hero) */}
      <div
        style={{
          display: 'flex',
          position: 'relative',
          width: 430,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Card rank="A" kind="spade" rotate={-11} x={-72} />
        <Card rank="A" kind="heart" rotate={11} x={72} />
      </div>
    </div>
  )
}

/** Build a 1200×630 PNG for a route's `opengraph-image` / `twitter-image`. */
export function ogImage(props: OgProps) {
  return new ImageResponse(<OgCard {...props} />, { ...ogSize, fonts: loadFonts() })
}

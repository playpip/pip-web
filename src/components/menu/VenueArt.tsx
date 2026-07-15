'use client'

// Flat geometric SVG scenes, one per venue, tinted to the venue's accent color.
// Vector so they're crisp from a 48px thumb to a full-width banner, themeable,
// and consistent with the minimal aesthetic. viewBox is 120×96 throughout.

import { cn } from '@/lib/utils'

type Scene = (c: string) => React.ReactNode

// Shorthand helpers keep each scene readable.
const soft = (c: string, o = 0.16) => ({ fill: c, fillOpacity: o })

const SCENES: Record<string, Scene> = {
  // Garage — pitched roof + segmented door.
  garage: (c) => (
    <>
      <polygon points="60,16 104,40 16,40" fill={c} fillOpacity={0.9} />
      <rect x="28" y="40" width="64" height="42" rx="3" fill={c} fillOpacity={0.28} />
      {[48, 58, 68].map((y) => (
        <rect key={y} x="28" y={y} width="64" height="4" rx="2" fill="#0a0a0b" fillOpacity={0.35} />
      ))}
    </>
  ),

  // Pub — foamy pint.
  pub: (c) => (
    <>
      <rect x="42" y="34" width="30" height="46" rx="4" fill={c} fillOpacity={0.85} />
      <path d="M72 44 h8 a6 6 0 0 1 6 6 v10 a6 6 0 0 1 -6 6 h-8 z" fill={c} fillOpacity={0.4} />
      <rect x="42" y="30" width="30" height="10" rx="5" fill="#fafafa" fillOpacity={0.9} />
      <circle cx="48" cy="30" r="6" fill="#fafafa" fillOpacity={0.9} />
      <circle cx="60" cy="27" r="7" fill="#fafafa" fillOpacity={0.9} />
      <circle cx="70" cy="30" r="5" fill="#fafafa" fillOpacity={0.9} />
    </>
  ),

  // Pool Hall — billiards table with pockets, cue and a couple of balls.
  poolhall: (c) => (
    <>
      <rect x="22" y="40" width="76" height="40" rx="8" fill={c} fillOpacity={0.75} />
      <rect x="30" y="47" width="60" height="26" rx="4" fill="#0a0a0b" fillOpacity={0.35} />
      {([[30, 47], [90, 47], [30, 73], [90, 73], [60, 45], [60, 75]] as const).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.5" fill="#0a0a0b" fillOpacity={0.55} />
      ))}
      <circle cx="50" cy="60" r="4.5" fill="#fafafa" fillOpacity={0.95} />
      <circle cx="66" cy="62" r="4.5" fill={c} />
      <line x1="18" y1="34" x2="82" y2="66" stroke="#fafafa" strokeOpacity={0.5} strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),

  // Card Room — two fanned cards with pips.
  cardroom: (c) => (
    <>
      <g transform="rotate(-12 60 56)">
        <rect x="40" y="34" width="34" height="46" rx="5" fill="#fafafa" fillOpacity={0.92} />
        <circle cx="49" cy="45" r="4" fill={c} />
      </g>
      <g transform="rotate(10 60 56)">
        <rect x="52" y="34" width="34" height="46" rx="5" fill="#fafafa" />
        <path d="M69 42 l6 8 -6 8 -6 -8 z" fill={c} />
      </g>
    </>
  ),

  // Downtown Casino — a pair of dice.
  casino: (c) => (
    <>
      {(
        [
          [30, 40, [[13, 13], [37, 37], [25, 25]]],
          [64, 44, [[13, 37], [37, 13], [13, 13], [37, 37]]],
        ] as const
      ).map(([x, y, pips], i) => (
        <g key={i} transform={`rotate(${i ? 8 : -8} ${x + 25} ${y + 25})`}>
          <rect x={x} y={y} width="34" height="34" rx="7" fill={c} fillOpacity={0.9} />
          {pips.map(([px, py], j) => (
            <circle key={j} cx={x + px * 0.68} cy={y + py * 0.68} r="3" fill="#0a0a0b" fillOpacity={0.55} />
          ))}
        </g>
      ))}
    </>
  ),

  // Riverboat — hull, paddlewheel, water.
  riverboat: (c) => (
    <>
      <path d="M26 58 h68 l-8 16 h-52 z" fill={c} fillOpacity={0.9} />
      <rect x="40" y="40" width="30" height="18" rx="2" fill={c} fillOpacity={0.5} />
      <circle cx="84" cy="60" r="12" fill="none" stroke={c} strokeWidth="3" />
      <line x1="84" y1="48" x2="84" y2="72" stroke={c} strokeWidth="3" />
      <line x1="72" y1="60" x2="96" y2="60" stroke={c} strokeWidth="3" />
      <path d="M16 82 q10 -6 20 0 t20 0 t20 0 t20 0" fill="none" stroke={c} strokeOpacity={0.4} strokeWidth="3" />
    </>
  ),

  // Penthouse — skyline with lit windows.
  penthouse: (c) => (
    <>
      {(
        [
          [26, 46, 20, 36],
          [50, 30, 22, 52],
          [76, 40, 20, 42],
        ] as const
      ).map(([x, y, w, h], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={h} rx="2" fill={c} fillOpacity={0.35 + i * 0.12} />
          {Array.from({ length: 6 }).map((_, k) => (
            <rect key={k} x={x + 4 + (k % 2) * 8} y={y + 6 + Math.floor(k / 2) * 9} width="4" height="4" fill="#fafafa" fillOpacity={0.8} />
          ))}
        </g>
      ))}
    </>
  ),

  // Monte Carlo — classical facade (pediment on columns).
  montecarlo: (c) => (
    <>
      <polygon points="60,22 100,42 20,42" fill={c} fillOpacity={0.9} />
      {[28, 44, 60, 76, 92].map((x) => (
        <rect key={x} x={x - 3} y="46" width="6" height="30" fill={c} fillOpacity={0.6} />
      ))}
      <rect x="18" y="76" width="84" height="6" rx="2" fill={c} fillOpacity={0.9} />
      <rect x="18" y="42" width="84" height="4" fill={c} fillOpacity={0.9} />
    </>
  ),

  // Vegas — marquee sign with bulb border + star.
  vegas: (c) => (
    <>
      <rect x="28" y="34" width="64" height="40" rx="6" fill={c} fillOpacity={0.85} />
      <path d="M60 44 l4 9 10 1 -7 7 2 10 -9 -5 -9 5 2 -10 -7 -7 10 -1 z" fill="#fafafa" fillOpacity={0.95} />
      {Array.from({ length: 22 }).map((_, i) => {
        const pt = perimeter(28, 34, 64, 40, i, 22)
        return <circle key={i} cx={pt.x} cy={pt.y} r="1.8" fill="#fafafa" fillOpacity={0.8} />
      })}
    </>
  ),

  // Main Event — trophy + star.
  mainevent: (c) => (
    <>
      <path d="M44 30 h32 v10 a16 16 0 0 1 -32 0 z" fill={c} fillOpacity={0.9} />
      <path d="M44 32 h-8 a8 8 0 0 0 8 8 z" fill={c} fillOpacity={0.5} />
      <path d="M76 32 h8 a8 8 0 0 1 -8 8 z" fill={c} fillOpacity={0.5} />
      <rect x="56" y="54" width="8" height="12" fill={c} fillOpacity={0.9} />
      <rect x="46" y="66" width="28" height="8" rx="2" fill={c} fillOpacity={0.9} />
      <path d="M60 28 l2.5 5 5.5 .6 -4 4 1 5.4 -5 -2.8 -5 2.8 1 -5.4 -4 -4 5.5 -.6 z" fill="#fafafa" fillOpacity={0.95} />
    </>
  ),
}

/** Point on a rectangle's perimeter for evenly spaced marquee bulbs. */
function perimeter(x: number, y: number, w: number, h: number, i: number, n: number) {
  const per = 2 * (w + h)
  let d = (i / n) * per
  if (d < w) return { x: x + d, y }
  d -= w
  if (d < h) return { x: x + w, y: y + d }
  d -= h
  if (d < w) return { x: x + w - d, y: y + h }
  d -= w
  return { x, y: y + h - d }
}

// Venues with a generated image in /public/venues. Anything not listed here
// (or whose image fails to load) falls back to the geometric SVG scene.
const VENUE_IMAGES: Record<string, string> = {
  garage: '/venues/garage.jpg',
  pub: '/venues/pub.jpg',
  poolhall: '/venues/poolhall.jpg',
  cardroom: '/venues/cardroom.jpg',
  casino: '/venues/casino.jpg',
  riverboat: '/venues/riverboat.jpg',
  penthouse: '/venues/penthouse.jpg',
  montecarlo: '/venues/montecarlo.jpg',
  vegas: '/venues/vegas.jpg',
  mainevent: '/venues/mainevent.jpg',
  redeye: '/venues/redeye.jpg',
  study: '/venues/study.jpg',
  duel: '/venues/duel.jpg',
  docks: '/venues/docks.jpg',
}

function VenueScene({ id, accent, className }: { id: string; accent: string; className?: string }) {
  const scene = SCENES[id] ?? SCENES.garage
  return (
    <svg viewBox="0 0 120 96" className={cn('block', className)} aria-hidden preserveAspectRatio="xMidYMid slice">
      <rect x="0" y="0" width="120" height="96" {...soft(accent, 0.14)} />
      {scene(accent)}
    </svg>
  )
}

export function VenueArt({
  id,
  accent,
  className,
}: {
  id: string
  accent: string
  className?: string
}) {
  const image = VENUE_IMAGES[id]
  return (
    <div className={cn('relative overflow-hidden bg-[#0A0A0A]', className)}>
      {/* SVG fallback sits underneath; the image (if any) covers it. */}
      <VenueScene id={id} accent={accent} className="absolute inset-0 size-full" />
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          draggable={false}
          className="absolute inset-0 size-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
    </div>
  )
}

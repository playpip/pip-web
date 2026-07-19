'use client'

// Flat geometric scenes for the main-menu tiles — the same visual language as
// VenueArt (dark near-black frame, one accent colour, flat vector, viewBox
// 120×96), but for the abstract sections rather than places. One motif each:
// the Daily's spotlit card, the Rail's chip stack, the Venues ladder, the Side
// Tables fan. No images, no ambience — these are small and want to stay calm.

import { cn } from '@/lib/utils'

type Scene = (c: string) => React.ReactNode

/** One tower of chips — banded edges with a brighter top face. */
function chipTower(c: string, cx: number, floorY: number, count: number): React.ReactNode {
  const gap = 4.4
  const chips = []
  for (let k = 0; k < count; k++) {
    const top = k === count - 1
    chips.push(
      <ellipse
        key={k}
        cx={cx}
        cy={floorY - k * gap}
        rx={14}
        ry={4.6}
        fill={c}
        fillOpacity={top ? 0.92 : 0.45 + (k % 2) * 0.14}
      />,
    )
  }
  return <g key={cx}>{chips}</g>
}

/** A row of chip towers of the given heights, evenly spread across the frame. */
function chipStacks(c: string, heights: number[], floorY: number): React.ReactNode {
  const step = 96 / (heights.length + 1)
  return <>{heights.map((h, i) => chipTower(c, 12 + step * (i + 1), floorY, h))}</>
}

const SCENES: Record<string, Scene> = {
  // The Daily — a single card under a spotlight, sparkles above. "Today's deal."
  daily: (c) => (
    <>
      <circle cx="60" cy="50" r="30" fill={c} fillOpacity={0.12} />
      <g transform="rotate(-8 60 50)">
        <rect x="47" y="32" width="26" height="37" rx="4" fill={c} fillOpacity={0.9} />
        <rect x="52" y="38" width="9" height="9" rx="1.5" fill="#0a0a0b" fillOpacity={0.28} />
      </g>
      <path
        d="M60 12 l1.8 4.4 4.4 1.8 -4.4 1.8 -1.8 4.4 -1.8 -4.4 -4.4 -1.8 4.4 -1.8 z"
        fill="#fafafa"
        fillOpacity={0.9}
      />
      <circle cx="92" cy="30" r="2" fill="#fafafa" fillOpacity={0.7} />
      <circle cx="28" cy="66" r="1.6" fill="#fafafa" fillOpacity={0.55} />
    </>
  ),

  // The Rail — a stack of chips. Cash on the table.
  rail: (c) => (
    <>
      {[66, 56, 46].map((y, i) => (
        <g key={y}>
          <ellipse cx="60" cy={y} rx="27" ry="8.5" fill={c} fillOpacity={0.88 - i * 0.14} />
          <ellipse cx="60" cy={y} rx="14" ry="4.2" fill="#0a0a0b" fillOpacity={0.26} />
        </g>
      ))}
    </>
  ),

  // Venues — four rungs climbing left to right. The ladder.
  venues: (c) => (
    <>
      {(
        [
          [26, 60, 18],
          [44, 50, 28],
          [62, 40, 38],
          [80, 28, 50],
        ] as const
      ).map(([x, y, h], i) => (
        <rect
          key={x}
          x={x}
          y={y}
          width="13"
          height={h}
          rx="2.5"
          fill={c}
          fillOpacity={0.42 + i * 0.16}
        />
      ))}
    </>
  ),

  // Side Tables — a fanned trio of cards. Same game, different shapes.
  side: (c) => (
    <>
      <rect
        x="48"
        y="34"
        width="24"
        height="35"
        rx="3.5"
        fill={c}
        fillOpacity={0.4}
        transform="rotate(-18 60 52)"
      />
      <rect x="48" y="33" width="24" height="35" rx="3.5" fill={c} fillOpacity={0.62} />
      <rect
        x="48"
        y="34"
        width="24"
        height="35"
        rx="3.5"
        fill={c}
        fillOpacity={0.88}
        transform="rotate(18 60 52)"
      />
    </>
  ),

  // The Rail's rooms — chip towers that grow with the stakes. Micro is a couple
  // of modest stacks; the nosebleeds are a skyline.
  'ring-micro': (c) => chipStacks(c, [3, 2], 62),
  'ring-low': (c) => chipStacks(c, [3, 4, 2], 66),
  'ring-mid': (c) => chipStacks(c, [5, 6, 4], 70),
  'ring-high': (c) => chipStacks(c, [7, 9, 6, 8], 76),
}

// Generated art, once it exists, covers the SVG fallback. Add an entry here and
// drop a square image at public/menu/<id>.jpg — see MENU_PROMPTS.md. Until then
// the geometric scene above stands in (and a failed load falls back to it too).
const CATEGORY_IMAGES: Record<string, string> = {
  daily: '/menu/daily.jpg',
  rail: '/menu/rail.jpg',
  venues: '/menu/venues.jpg',
  side: '/menu/side.jpg',
}

export function CategoryArt({
  id,
  accent,
  className,
}: {
  id: keyof typeof SCENES | string
  accent: string
  className?: string
}) {
  const scene = SCENES[id] ?? SCENES.venues
  const image = CATEGORY_IMAGES[id]
  return (
    <div className={cn('relative overflow-hidden bg-[#0A0A0A]', className)}>
      {/* SVG fallback sits underneath; the image (if any) covers it. */}
      <svg
        viewBox="0 0 120 96"
        className="absolute inset-0 size-full"
        aria-hidden
        preserveAspectRatio="xMidYMid slice"
      >
        <rect x="0" y="0" width="120" height="96" fill={accent} fillOpacity={0.14} />
        {scene(accent)}
      </svg>
      {image && (
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

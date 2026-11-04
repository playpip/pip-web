'use client'

// Flat geometric scenes for the main-menu tiles — the same visual language as
// VenueArt (dark near-black frame, one accent colour, flat vector, viewBox
// 120×96), but for the abstract sections rather than places. One motif each:
// the Daily's spotlit card, the Rail's chip stack, the Venues ladder, the Side
// Tables fan. No images, no ambience — these are small and want to stay calm.

import { cn } from '@/lib/utils'

type Scene = (c: string) => React.ReactNode

// Chip geometry shared by the towers: front-on, slightly squashed ellipses.
const CHIP = { rx: 11.5, ry: 4, h: 4.4 }

/** Tiny alternating lean so a tower reads hand-stacked rather than extruded. */
const lean = (k: number) => (((k * 5) % 3) - 1) * 0.7

/** A chip seen face-on: solid disc, dashed ring of edge spots, dark inlay. */
function chipFace(c: string, cx: number, cy: number): React.ReactNode {
  const { rx, ry } = CHIP
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={c} fillOpacity={0.95} />
      {/* pathLength normalises the dash pattern to 6 even spots around the rim. */}
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx * 0.68}
        ry={ry * 0.68}
        fill="none"
        stroke="#fafafa"
        strokeOpacity={0.75}
        strokeWidth={2.2}
        pathLength={100}
        strokeDasharray="9 7.66"
      />
      <ellipse cx={cx} cy={cy} rx={rx * 0.4} ry={ry * 0.4} fill="#0a0a0b" fillOpacity={0.3} />
    </>
  )
}

/**
 * One tower of chips. Each chip is a solid cylinder band whose top and bottom
 * follow the ellipse curve, with three white edge spots clipped to the band so
 * they hug the curve — stacked, the spots line up into the stripes a real
 * stack has. A seam under each chip separates it from the one below, and a
 * soft shadow sits the tower on the felt.
 */
function chipTower(c: string, cx: number, floorY: number, count: number): React.ReactNode {
  const { rx, ry, h } = CHIP
  const chips = []
  for (let k = 0; k < count; k++) {
    const x = cx + lean(k)
    const yTop = floorY - (k + 1) * h
    const yBot = yTop + h
    const band = `M ${x - rx} ${yTop} A ${rx} ${ry} 0 0 0 ${x + rx} ${yTop} L ${x + rx} ${yBot} A ${rx} ${ry} 0 0 1 ${x - rx} ${yBot} Z`
    // Unique per chip on the page; a collision could only come from identical
    // geometry in another tile, which would clip identically anyway.
    const clipId = `chip-${cx}-${floorY}-${k}`
    chips.push(
      <g key={k}>
        <clipPath id={clipId}>
          <path d={band} />
        </clipPath>
        <path d={band} fill={c} fillOpacity={0.85} />
        <path
          d={`M ${x - rx} ${yBot} A ${rx} ${ry} 0 0 0 ${x + rx} ${yBot}`}
          fill="none"
          stroke="#0a0a0b"
          strokeOpacity={0.35}
          strokeWidth={1}
        />
        <g clipPath={`url(#${clipId})`}>
          {[-0.55, 0, 0.55].map((f) => (
            <rect
              key={f}
              x={x + f * rx - 1.6}
              y={yTop}
              width={3.2}
              height={h + ry * 2}
              fill="#fafafa"
              fillOpacity={0.8}
            />
          ))}
        </g>
      </g>,
    )
  }
  return (
    <g key={cx}>
      <ellipse cx={cx} cy={floorY + 1.5} rx={rx + 4} ry={ry + 1} fill="#0a0a0b" fillOpacity={0.4} />
      {chips}
      {chipFace(c, cx + lean(count - 1), floorY - count * h)}
    </g>
  )
}

/**
 * A row of chip towers of the given heights, evenly spread across the frame.
 * Alternate towers sit a touch higher (further away), back-to-front drawn so
 * near stacks overlap far ones.
 */
function chipStacks(c: string, heights: number[], floorY: number): React.ReactNode {
  const step = 96 / (heights.length + 1)
  const floors = heights.map((_, i) => floorY - (i % 2) * 4)
  const order = heights.map((_, i) => i).sort((a, b) => floors[a] - floors[b])
  return <>{order.map((i) => chipTower(c, 12 + step * (i + 1), floors[i], heights[i]))}</>
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
      {chipTower(c, 45, 64, 5)}
      {chipTower(c, 73, 68, 3)}
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

  // Build a table — an empty felt with the chairs still being set. Three seats
  // placed, one gap where the next one goes.
  custom: (c) => (
    <>
      <ellipse cx="60" cy="52" rx="30" ry="19" fill={c} fillOpacity={0.3} />
      <ellipse cx="60" cy="52" rx="23" ry="13" fill={c} fillOpacity={0.16} />
      <rect x="30" y="34" width="9" height="9" rx="2" fill={c} fillOpacity={0.8} />
      <rect x="55" y="25" width="9" height="9" rx="2" fill={c} fillOpacity={0.8} />
      <rect x="81" y="34" width="9" height="9" rx="2" fill={c} fillOpacity={0.8} />
      {/* the empty chair */}
      <rect
        x="55"
        y="70"
        width="9"
        height="9"
        rx="2"
        fill="none"
        stroke={c}
        strokeOpacity={0.55}
        strokeWidth={1.4}
      />
    </>
  ),

  // Multiplayer — a table seen from above with four people round it. Two have
  // their cameras on (the framed seats with the live dot), one is talking.
  multiplayer: (c) => (
    <>
      <ellipse cx="60" cy="50" rx="27" ry="17" fill={c} fillOpacity={0.3} />
      <ellipse cx="60" cy="50" rx="20" ry="11" fill={c} fillOpacity={0.16} />
      {/* the two faces on camera */}
      {(
        [
          [22, 41],
          [86, 41],
        ] as const
      ).map(([x, y]) => (
        <g key={x}>
          <rect x={x} y={y} width="13" height="13" rx="4" fill={c} fillOpacity={0.9} />
          <circle cx={x + 6.5} cy={y + 5} r="2.4" fill="#0a0a0b" fillOpacity={0.35} />
          <path d={`M ${x + 2.5} ${y + 12} q 4 -5 8 0`} fill="#0a0a0b" fillOpacity={0.35} />
          <circle cx={x + 11} cy={y + 2} r="1.6" fill="#fafafa" fillOpacity={0.9} />
        </g>
      ))}
      {/* the other two, avatars */}
      <circle cx="60" cy="22" r="6.5" fill={c} fillOpacity={0.65} />
      <circle cx="60" cy="78" r="6.5" fill={c} fillOpacity={0.65} />
      {/* somebody talking */}
      <path
        d="M70 18 q 3 4 0 8 M74 15 q 5 7 0 14"
        fill="none"
        stroke="#fafafa"
        strokeOpacity={0.6}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </>
  ),

  // Poker Solitaire — the five by five grid, filling up. One row is done and
  // lit; the last few spaces are still empty, and the next card is on its way.
  solitaire: (c) => (
    <>
      {Array.from({ length: 25 }, (_, i) => {
        const r = Math.floor(i / 5)
        const col = i % 5
        const x = 27 + col * 12.5
        const y = 8 + r * 16
        const empty = [19, 23, 24].includes(i)
        const lit = r === 2
        return empty ? (
          <rect
            key={i}
            x={x}
            y={y}
            width="10"
            height="13.5"
            rx="2"
            fill="none"
            stroke={c}
            strokeOpacity={0.45}
            strokeWidth={0.9}
            strokeDasharray="2 1.6"
          />
        ) : (
          <rect
            key={i}
            x={x}
            y={y}
            width="10"
            height="13.5"
            rx="2"
            fill={lit ? '#fafafa' : c}
            fillOpacity={lit ? 0.92 : 0.38 + ((i * 7) % 5) * 0.09}
          />
        )
      })}
      {/* the lit row's glow */}
      <rect
        x="24.5"
        y="37.5"
        width="62"
        height="18.5"
        rx="4"
        fill="none"
        stroke={c}
        strokeOpacity={0.9}
        strokeWidth={1.4}
      />
      {/* the next card, tilted, coming in from the right */}
      <g transform="rotate(12 99 70)">
        <rect x="93" y="61" width="13" height="18" rx="2.4" fill={c} fillOpacity={0.95} />
        <rect x="95.5" y="63.5" width="4" height="4" rx="0.8" fill="#0a0a0b" fillOpacity={0.3} />
      </g>
    </>
  ),

  // Ten Hands — ten chips in a row, the run of the round, with the stack you
  // finished on standing at the end.
  'ten-hands': (c) => (
    <>
      {Array.from({ length: 10 }, (_, i) => (
        <circle key={i} cx={21 + i * 8.6} cy={22} r="3.2" fill={c} fillOpacity={0.3 + i * 0.07} />
      ))}
      {chipTower(c, 48, 76, 4)}
      {chipTower(c, 74, 80, 7)}
    </>
  ),

  // Mystery Card — two hole cards, one face up, one face down with a "?".
  mystery: (c) => (
    <>
      <rect
        x="36"
        y="28"
        width="26"
        height="38"
        rx="3.5"
        fill="#fafafa"
        fillOpacity={0.9}
        transform="rotate(-9 49 47)"
      />
      <text x="42" y="44" fontSize="11" fontWeight="700" fill={c} transform="rotate(-9 49 47)">
        A
      </text>
      <rect
        x="58"
        y="27"
        width="26"
        height="38"
        rx="3.5"
        fill={c}
        fillOpacity={0.85}
        transform="rotate(8 71 46)"
      />
      <text
        x="71"
        y="52"
        fontSize="17"
        fontWeight="700"
        textAnchor="middle"
        fill="#fafafa"
        fillOpacity={0.85}
        transform="rotate(8 71 46)"
      >
        ?
      </text>
    </>
  ),

  // The Rail's rooms — chip towers that grow with the stakes. Micro is a couple
  // of modest stacks; the nosebleeds are a skyline.
  'ring-micro': (c) => chipStacks(c, [3, 2], 66),
  'ring-small': (c) => chipStacks(c, [4, 3], 67),
  'ring-low': (c) => chipStacks(c, [4, 3, 2], 68),
  'ring-club': (c) => chipStacks(c, [5, 4, 3], 69),
  'ring-mid': (c) => chipStacks(c, [6, 4, 5], 70),
  'ring-big': (c) => chipStacks(c, [7, 6, 8], 72),
  'ring-high': (c) => chipStacks(c, [8, 10, 6, 9], 74),
}

// Generated art, once it exists, covers the SVG fallback. Add an entry here and
// drop a square image at public/menu/<id>.jpg — see MENU_PROMPTS.md. Until then
// the geometric scene above stands in (and a failed load falls back to it too).
const CATEGORY_IMAGES: Record<string, string> = {
  daily: '/menu/daily.jpg',
  rail: '/menu/rail.jpg',
  venues: '/menu/venues.jpg',
  side: '/menu/side.jpg',
  custom: '/menu/custom.jpg',
  multiplayer: '/menu/multiplayer.jpg',
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

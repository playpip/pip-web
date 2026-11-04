// The pictures the daily reward and the streak sheet share: a chip, the light
// that crosses a card, the members' badge, and a streak item drawn to fit its box.

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { DealerDisc } from './ShopDialog'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { CardBack } from '@/components/CardBack'
import { AwardChip } from '@/components/AwardChip'
import { cardBackById } from '@/config/cardBacks'
import { avatarRingById } from '@/config/cosmetics'
import { souvenirAward } from '@/config/shop'
import { VenueArt } from './VenueArt'
import { characterById } from '@/config/cast'
import type { StreakUnlock } from '@/lib/dailyReward'
import { cn } from '@/lib/utils'
import { useProfile } from '@/store/profile'

/** A soft diagonal light that crosses the card every few seconds. */
export function Sheen() {
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12"
      style={{
        background:
          'linear-gradient(90deg, transparent, color-mix(in oklab, var(--foreground) 9%, transparent), transparent)',
      }}
      animate={{ x: ['0%', '450%'] }}
      transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 3.2, ease: 'easeInOut' }}
    />
  )
}

export function DoubleBadge() {
  return (
    <span className="shrink-0 rounded-full bg-pip/20 px-1.5 py-0.5 text-2xs font-bold whitespace-nowrap text-pip">
      ×2 member
    </span>
  )
}

/** One chip seen from above: striped edge, plain inlay. */
export function Coin({
  size,
  color = 'var(--color-streak)',
  className,
}: {
  size: number
  color?: string
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn('relative block shrink-0 rounded-full', className)}
      style={{
        width: size,
        height: size,
        background: `repeating-conic-gradient(from 10deg, ${color} 0deg 30deg, var(--color-chip-stripe) 30deg 45deg)`,
        boxShadow: `0 2px 0 color-mix(in oklab, ${color} 55%, black), 0 4px 10px rgb(0 0 0 / 0.35)`,
      }}
    >
      <span
        className="absolute rounded-full"
        style={{
          inset: size * 0.17,
          background: `radial-gradient(circle at 35% 30%, color-mix(in oklab, ${color} 70%, white), ${color})`,
          boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.25)',
        }}
      />
    </span>
  )
}

/**
 * A streak item drawn to fit a square of `box` pixels, centred. Drawn at the
 * size it is shown rather than shrunk from the shop's art, so nothing sits off
 * the middle of its box.
 */
export function RewardArt({ unlock, box }: { unlock: StreakUnlock; box: number }) {
  const avatar = useProfile((s) => s.avatar)
  const item = unlock.item
  if (unlock.venue) {
    const maud = characterById('maud')
    // The table's painting, cropped to the box, with Maud in the corner.
    return (
      <span
        className="relative block overflow-hidden rounded-lg"
        style={{ width: box, height: box }}
      >
        <VenueArt
          id={unlock.venue.id}
          accent={unlock.venue.accent}
          className="absolute inset-0 size-full"
        />
        {maud && (
          <PlayerAvatar
            spec={maud.avatar}
            size={box}
            className="absolute -right-0.5 -bottom-0.5 size-[55%] ring-2 ring-background"
          />
        )}
      </span>
    )
  }
  if (!item) return null
  switch (item.kind) {
    case 'ring': {
      const pad = Math.max(2, Math.round(box * 0.07))
      return (
        <span
          className="block rounded-full"
          style={{
            background: avatarRingById(item.id)?.ring,
            padding: pad,
            width: box,
            height: box,
          }}
        >
          <PlayerAvatar
            spec={avatar ?? { seed: 'pip', backgroundColor: 'b6e3f4' }}
            size={box * 2}
            className="size-full"
          />
        </span>
      )
    }
    case 'back':
      return <CardBack design={cardBackById(item.id)} size={box >= 52 ? 'sm' : 'xs'} />
    case 'button':
      return (
        <DealerDisc
          id={item.id}
          className="text-sm shadow-md shadow-black/30"
          style={{ width: box * 0.75, height: box * 0.75 }}
        />
      )
    case 'finish':
      return (
        <span
          className="block rounded-[50%] shadow-inner shadow-black/40 ring-[3px] ring-table-rail"
          style={{ width: box, height: box * 0.66, background: item.swatch }}
        />
      )
    case 'souvenir':
      return <AwardChip award={souvenirAward(item)} earned size={box} />
    case 'sound':
      return (
        <span className="flex items-end gap-[3px]" style={{ height: box * 0.6 }} aria-hidden>
          {[0.5, 0.85, 1, 0.7, 0.45].map((h, i) => (
            <span
              key={i}
              className="w-1.5 rounded-full bg-streak"
              style={{ height: `${h * 100}%` }}
            />
          ))}
        </span>
      )
    default:
      return null
  }
}

/** Chips flung out from the payout and falling away. */
export function Burst() {
  const chips = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const angle = (i / 18) * Math.PI * 2 + (i % 3) * 0.2
        const reach = 90 + (i % 4) * 28
        return {
          x: Math.cos(angle) * reach,
          y: Math.sin(angle) * reach * 0.7 - 30,
          size: 12 + (i % 3) * 4,
          color: ['var(--color-streak)', 'var(--color-chip-coral)', 'var(--color-chip-ivory)'][
            i % 3
          ],
          spin: (i % 2 ? 1 : -1) * (180 + i * 20),
        }
      }),
    [],
  )
  return (
    <span aria-hidden className="pointer-events-none absolute top-1/2 left-1/2">
      {chips.map((c, i) => (
        <motion.span
          key={i}
          className="absolute"
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
          animate={{ x: c.x, y: [0, c.y, c.y + 70], opacity: [1, 1, 0], scale: 1, rotate: c.spin }}
          transition={{ duration: 1.1, ease: 'easeOut', delay: i * 0.012 }}
        >
          <Coin size={c.size} color={c.color} />
        </motion.span>
      ))}
    </span>
  )
}

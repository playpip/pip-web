'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChevronRight, Lock } from 'lucide-react'
import { Splash } from '@/components/Splash'
import { useProfile } from '@/store/profile'
import { RING_TABLES, type Venue } from '@/config/venues'
import { useMoney } from '@/lib/useMoney'
import { sound } from '@/lib/sound'
import { SectionScreen } from './SectionScreen'
import { CategoryArt } from './CategoryArt'
import { VenueInfoDialog } from './VenueInfoDialog'
import { useRequireProfile } from './useRequireProfile'

/**
 * The Rail — cash / ring tables. Each stake is a card in its own colour, the
 * chip-stack motif tinted to match, so the page reads like the rest of the
 * lobby rather than a plain list. Tapping a card opens its details (the same
 * dialog the venues use); sitting down happens from there.
 */
export function RailBrowser() {
  const ready = useRequireProfile()
  const router = useRouter()
  const roll = useProfile((s) => s.roll)
  const [infoRoom, setInfoRoom] = useState<Venue | null>(null)

  if (!ready) return <Splash />

  return (
    <SectionScreen
      title="The Rail"
      subtitle="Cash tables. Sit down, stand up when you like — the chips in front of you are yours."
    >
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {RING_TABLES.map((room, i) => (
          <RailCard
            key={room.id}
            room={room}
            index={i}
            playable={roll >= room.buyIn}
            onOpen={() => {
              sound.play('tap')
              setInfoRoom(room)
            }}
          />
        ))}
      </div>

      <p className="mt-5 max-w-2xl px-1 text-sm leading-relaxed text-muted-foreground">
        The stake is the difficulty — Micro plays loose and forgiving, the nosebleeds bite. Every
        room is 100 big blinds deep and the blinds never move: somewhere to kill ten minutes, not a
        tournament to finish. Bust and you can rebuy or walk. The table doesn&rsquo;t mind either
        way.
      </p>

      <VenueInfoDialog
        venue={infoRoom}
        playable={infoRoom ? roll >= infoRoom.buyIn : false}
        onOpenChange={(o) => !o && setInfoRoom(null)}
        onPlay={(room) => {
          sound.play('call')
          router.push(`/play/${room.id}`)
        }}
      />
    </SectionScreen>
  )
}

function RailCard({
  room,
  index,
  playable,
  onOpen,
}: {
  room: Venue
  index: number
  playable: boolean
  onOpen: () => void
}) {
  const money = useMoney()

  return (
    // Animate a plain wrapper, not the card: animating opacity/transform on an
    // element that also clips (overflow-hidden + rounded) makes iOS WebKit
    // re-rasterise the rounded mask each frame and flicker. The clipped card
    // stays a static child — the same structure the venue tiles use.
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      className="w-full"
    >
      <button
        onClick={onOpen}
        aria-label={`About ${room.name}`}
        className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02] text-left transition hover:border-foreground/25 hover:bg-foreground/[0.05] active:scale-[0.99]"
      >
        <div className="relative aspect-[16/10] w-full">
          <CategoryArt id={room.id} accent={room.accent} className="absolute inset-0 size-full" />
          <span
            className="absolute left-2 top-2 rounded-md bg-black/45 px-2 py-1 text-[11px] font-semibold tabular-nums backdrop-blur-sm"
            style={{ color: room.accent }}
          >
            {room.smallBlind.toLocaleString()}/{room.bigBlind.toLocaleString()}
          </span>
          <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-md bg-black/40 backdrop-blur-sm">
            {playable ? (
              <ChevronRight className="size-4 text-white/85 transition group-hover:translate-x-0.5" />
            ) : (
              <Lock className="size-3.5 text-white/85" />
            )}
          </span>
        </div>
        <div className="flex flex-1 flex-col p-3">
          <h3 className="font-semibold">{room.name}</h3>
          <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
            {room.seats}-handed · 100bb deep
          </p>
          <p className="mt-2 text-base font-semibold tabular-nums">
            {playable ? `Sit — ${money(room.buyIn)}` : `Need ${money(room.buyIn)}`}
          </p>
        </div>
      </button>
    </motion.div>
  )
}

'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Lock, ChevronRight, ChevronLeft, RotateCcw, Settings } from 'lucide-react'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { CountUp } from '@/components/CountUp'
import { useProfile } from '@/store/profile'
import { ProfileDialog } from '@/components/profile/ProfileDialog'
import { SettingsDialog } from '@/components/settings/SettingsDialog'
import { ThemeToggle } from '@/components/ThemeToggle'
import { VenueArt } from './VenueArt'
import { VENUES, KITCHEN_TABLE, freerollOpen, type Venue } from '@/config/venues'
import { rankFor } from '@/config/ranks'
import { useMoney } from '@/lib/useMoney'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

interface VenueVM {
  venue: Venue
  index: number
  playable: boolean
  onEnter: () => void
}

export function Home() {
  const router = useRouter()
  const { name, avatar, roll, peakRoll, reset } = useProfile()
  const money = useMoney()
  const scroller = useRef<HTMLDivElement>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const rank = rankFor(peakRoll)
  const broke = freerollOpen(roll)

  const scrollBy = (dir: number) =>
    scroller.current?.scrollBy({ left: dir * 320, behavior: 'smooth' })

  const models: VenueVM[] = VENUES.map((venue, index) => ({
    venue,
    index,
    playable: roll >= venue.buyIn,
    onEnter: () => {
      sound.play('call')
      router.push(`/play/${venue.id}`)
    },
  }))

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-6 py-8 md:px-10">
      {/* top bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            sound.play('tap')
            setEditOpen(true)
          }}
          className="flex items-center gap-3 rounded-full py-1 pl-1 pr-3 transition hover:bg-foreground/5 active:scale-[0.98]"
          aria-label="Edit player"
        >
          {avatar && <PlayerAvatar spec={avatar} size={40} />}
          <div className="text-left leading-tight">
            <div className="text-sm font-medium text-muted-foreground">{name}</div>
            <div className="text-[11px] text-muted-foreground/70">{rank.name}</div>
          </div>
        </button>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xl font-semibold lowercase tracking-tight text-muted-foreground">pip</span>
          <ThemeToggle />
          <button
            onClick={() => {
              sound.play('tap')
              setSettingsOpen(true)
            }}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
            aria-label="Settings"
          >
            <Settings className="size-4" />
          </button>
          <button
            onClick={() => {
              if (confirm('Reset your profile and Roll?')) reset()
            }}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
            aria-label="Reset profile"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>
      </div>

      {/* the Roll — compact balance */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center py-6 text-center"
      >
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Your Roll</p>
        <div className="mt-1 flex items-baseline justify-center gap-2">
          <CountUp
            value={roll}
            format={money}
            className="text-4xl font-semibold tracking-tight tabular-nums md:text-5xl"
          />
          <span className="text-lg font-medium text-muted-foreground">chips</span>
        </div>
        {broke && (
          <button
            onClick={() => {
              sound.play('call')
              router.push(`/play/${KITCHEN_TABLE.id}`)
            }}
            className="mt-4 rounded-2xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
          >
            Play the freeroll — win {money(KITCHEN_TABLE.prize)}
          </button>
        )}
      </motion.div>

      {/* venues — take the remaining space */}
      <div className="flex flex-1 flex-col justify-center pb-2">
        <div className="mb-3 flex items-center justify-between px-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Venues</p>
          <div className="flex items-center gap-3">
            <p className="hidden text-xs text-muted-foreground sm:block">
              Broke? Win your way back at the Kitchen Table.
            </p>
            {/* desktop slider arrows */}
            <div className="hidden gap-1.5 md:flex">
              <ArrowButton dir="left" onClick={() => scrollBy(-1)} />
              <ArrowButton dir="right" onClick={() => scrollBy(1)} />
            </div>
          </div>
        </div>

        {/* desktop: horizontal slider */}
        <div
          ref={scroller}
          className="hidden gap-4 overflow-x-auto scroll-smooth pb-2 md:flex [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {models.map((m) => (
            <VenueTile key={m.venue.id} model={m} />
          ))}
        </div>

        {/* mobile: vertical list */}
        <div className="flex flex-col gap-2.5 md:hidden">
          {models.map((m) => (
            <VenueRow key={m.venue.id} model={m} />
          ))}
        </div>
      </div>

      <ProfileDialog open={editOpen} onOpenChange={setEditOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}

function ArrowButton({ dir, onClick }: { dir: 'left' | 'right'; onClick: () => void }) {
  const Icon = dir === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      onClick={onClick}
      aria-label={dir === 'left' ? 'Scroll left' : 'Scroll right'}
      className="flex size-8 items-center justify-center rounded-full border border-foreground/10 bg-foreground/[0.03] text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground active:scale-90"
    >
      <Icon className="size-4" />
    </button>
  )
}

function TierChip({ venue, index }: { venue: Venue; index: number }) {
  return (
    <span
      className="flex size-7 items-center justify-center rounded-md bg-black/45 text-xs font-semibold backdrop-blur-sm"
      style={{ color: venue.accent }}
    >
      {index + 1}
    </span>
  )
}

function ArtThumb({ venue, className }: { venue: Venue; className?: string }) {
  return (
    <div className={cn('shrink-0 overflow-hidden rounded-lg', className)}>
      <VenueArt id={venue.id} accent={venue.accent} className="size-full" />
    </div>
  )
}

function LockTag({ venue }: { venue: Venue }) {
  const money = useMoney()
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Lock className="size-3" /> {money(venue.buyIn)}
    </span>
  )
}

function Stakes({ venue }: { venue: Venue }) {
  const money = useMoney()
  return (
    <div>
      <div className="text-base font-semibold tabular-nums">{money(venue.buyIn)}</div>
      <div className="text-[11px] text-muted-foreground tabular-nums">win {money(venue.prize)}</div>
    </div>
  )
}

/** Desktop slider card — vertical tile, fixed width, snap target. */
function VenueTile({ model }: { model: VenueVM }) {
  const { venue, index, playable, onEnter } = model
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      disabled={!playable}
      onClick={() => playable && onEnter()}
      className={cn(
        'group flex w-64 shrink-0 snap-start flex-col rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-3 text-left transition',
        playable ? 'hover:border-foreground/25 hover:bg-foreground/[0.05] active:scale-[0.99]' : 'opacity-45',
      )}
    >
      <div className="relative aspect-square overflow-hidden rounded-xl">
        <VenueArt id={venue.id} accent={venue.accent} className="size-full" />
        <div className="absolute left-2 top-2">
          <TierChip venue={venue} index={index} />
        </div>
        {!playable && (
          <div className="absolute right-2 top-2 rounded-md bg-black/45 px-1.5 py-0.5 backdrop-blur-sm">
            <LockTag venue={venue} />
          </div>
        )}
      </div>
      <div className="mt-3 flex-1 px-1">
        <h3 className="font-semibold">{venue.name}</h3>
        <p className="mt-1 text-sm leading-snug text-muted-foreground">{venue.tagline}</p>
      </div>
      <div className="mt-3 flex items-end justify-between px-1">
        <Stakes venue={venue} />
        <ChevronRight
          className={cn(
            'size-4 text-muted-foreground transition group-hover:translate-x-0.5',
            !playable && 'opacity-0',
          )}
        />
      </div>
    </motion.button>
  )
}

/** Mobile list row — horizontal. */
function VenueRow({ model }: { model: VenueVM }) {
  const { venue, playable, onEnter } = model
  return (
    <button
      disabled={!playable}
      onClick={() => playable && onEnter()}
      className={cn(
        'group flex items-center gap-4 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-3 text-left transition',
        playable ? 'hover:border-foreground/25 hover:bg-foreground/[0.05] active:scale-[0.99]' : 'opacity-45',
      )}
    >
      <ArtThumb venue={venue} className="size-14" />
      <div className="min-w-0 flex-1">
        <span className="font-medium">{venue.name}</span>
        <p className="truncate text-sm text-muted-foreground">{venue.tagline}</p>
      </div>
      <div className="shrink-0 text-right">{playable ? <Stakes venue={venue} /> : <LockTag venue={venue} />}</div>
      <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground', !playable && 'opacity-0')} />
    </button>
  )
}

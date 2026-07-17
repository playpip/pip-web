'use client'

// Your style — one place to equip everything: card back, deck face, table
// finish, and the souvenir shelf. Everything is a visual selector (tap to
// equip, ring shows what's in use); locked things explain themselves with a
// quiet hint line instead of a dead button. Buying happens in the Chip Shop;
// choosing happens here.

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CardBack } from '@/components/CardBack'
import { useProfile } from '@/store/profile'
import { ALL_CARD_BACKS, cardBackById, cardBackUnlocked } from '@/config/cardBacks'
import { DECK_FACES, TABLE_FINISHES } from '@/config/shop'
import { venueById } from '@/config/venues'
import { useMoney } from '@/lib/useMoney'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

export function StyleDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const profile = useProfile()
  const money = useMoney()
  const selected = cardBackById(profile.cardBack)

  // One quiet hint line for anything locked — shared by every section.
  const [hint, setHint] = useState<string | null>(null)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showHint = (text: string) => {
    setHint(text)
    if (hintTimer.current) clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => setHint(null), 2800)
  }

  const wonVenues = new Set(
    Object.keys(profile.venueRecords).filter((id) => profile.venueRecords[id].won > 0),
  )
  const ownedSet = new Set(profile.owned)

  const backHint = (design: (typeof ALL_CARD_BACKS)[number]): string => {
    const venue = design.unlock?.venueWin ? venueById(design.unlock.venueWin) : undefined
    if (design.unlock?.price !== undefined) {
      if (venue && !wonVenues.has(venue.id)) {
        return `Win ${venue.name}, then buy ${design.name} in the Chip Shop.`
      }
      return `${design.name} is in the Chip Shop — ${money(design.unlock.price)} chips.`
    }
    return venue ? `Win ${venue.name} to unlock ${design.name}.` : design.name
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Style</DialogTitle>
          <DialogDescription>Card back, deck and table — yours to set.</DialogDescription>
        </DialogHeader>

        <div className="-mx-1.5 flex max-h-[62vh] min-w-0 flex-col gap-6 overflow-y-auto px-1.5 pt-1">
          {/* --- card back ------------------------------------------------- */}
          <section>
            <SectionLabel>Card back</SectionLabel>
            <div className="flex flex-col items-center gap-2.5 pb-1">
              <div className="flex justify-center">
                <motion.div
                  key={`${selected.id}-a`}
                  initial={{ rotate: 0, x: 12 }}
                  animate={{ rotate: -8, x: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                >
                  <CardBack design={selected} size="md" />
                </motion.div>
                <motion.div
                  key={`${selected.id}-b`}
                  className="-ml-6"
                  initial={{ rotate: 0, x: -12 }}
                  animate={{ rotate: 8, x: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                >
                  <CardBack design={selected} size="md" />
                </motion.div>
              </div>
              <p className="text-xs text-muted-foreground">{selected.name}</p>
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {ALL_CARD_BACKS.map((design) => {
                const unlocked = cardBackUnlocked(design, wonVenues, ownedSet)
                return (
                  <motion.button
                    key={design.id}
                    onClick={() => {
                      sound.play('tap')
                      if (unlocked) profile.setCardBack(design.id)
                      else showHint(backHint(design))
                    }}
                    aria-label={backHint(design)}
                    title={backHint(design)}
                    whileTap={{ scale: 0.92 }}
                    className={cn(
                      'relative shrink-0 rounded-lg p-0.5 ring-2 transition',
                      profile.cardBack === design.id ? 'ring-foreground/70' : 'ring-transparent',
                      unlocked ? 'hover:ring-foreground/25' : 'opacity-40',
                    )}
                  >
                    <CardBack design={design} size="xs" />
                    {!unlocked && (
                      <Lock className="absolute inset-0 m-auto size-3.5 text-white/90 drop-shadow" />
                    )}
                  </motion.button>
                )
              })}
            </div>
          </section>

          {/* --- deck face --------------------------------------------------- */}
          <section>
            <SectionLabel>The deck</SectionLabel>
            <div className="flex gap-2">
              <FaceOption
                label="Classic"
                selected={profile.deckFace === 'classic'}
                onSelect={() => {
                  sound.play('tap')
                  profile.setDeckFace('classic')
                }}
              >
                <span className="text-suit-red">♥</span>
                <span className="text-foreground">♠</span>
                <span className="text-suit-red">♦</span>
                <span className="text-foreground">♣</span>
              </FaceOption>
              {DECK_FACES.map((face) => {
                const owned = ownedSet.has(face.id)
                const fourColour = face.id === 'face-fourcolor'
                const bold = face.id === 'face-contrast'
                return (
                  <FaceOption
                    key={face.id}
                    label={face.name.replace(' Deck', '')}
                    selected={profile.deckFace === face.id}
                    locked={!owned}
                    onSelect={() => {
                      sound.play('tap')
                      if (owned) profile.setDeckFace(face.id)
                      else
                        showHint(`${face.name} is in the Chip Shop — ${money(face.price)} chips.`)
                    }}
                  >
                    <span className={cn('text-suit-red', bold && 'font-black')}>♥</span>
                    <span className={cn('text-foreground', bold && 'font-black')}>♠</span>
                    <span
                      className={cn(
                        fourColour ? 'text-suit-blue' : 'text-suit-red',
                        bold && 'font-black',
                      )}
                    >
                      ♦
                    </span>
                    <span
                      className={cn(
                        fourColour ? 'text-suit-green' : 'text-foreground',
                        bold && 'font-black',
                      )}
                    >
                      ♣
                    </span>
                  </FaceOption>
                )
              })}
            </div>
          </section>

          {/* --- table finish ------------------------------------------------ */}
          <section>
            <SectionLabel>Table finish</SectionLabel>
            {/* py: the selection ring (+offset) draws outside the circles */}
            <div className="flex items-center gap-2.5 px-1 py-1.5">
              {/* the plain table */}
              <button
                onClick={() => {
                  sound.play('tap')
                  profile.setTableFinish(null)
                }}
                aria-label="Plain table"
                title="Plain"
                className={cn(
                  'flex size-9 items-center justify-center rounded-full border border-dashed border-foreground/25 transition',
                  profile.tableFinish === null
                    ? 'ring-2 ring-foreground/70'
                    : 'hover:ring-2 hover:ring-foreground/25',
                )}
              >
                <span className="text-[10px] text-muted-foreground">—</span>
              </button>
              {TABLE_FINISHES.map((finish) => {
                const owned = ownedSet.has(finish.id)
                return (
                  <button
                    key={finish.id}
                    onClick={() => {
                      sound.play('tap')
                      if (owned) profile.setTableFinish(finish.id)
                      else
                        showHint(
                          `${finish.name} is in the Chip Shop — ${money(finish.price)} chips.`,
                        )
                    }}
                    aria-label={finish.name}
                    title={finish.name}
                    className={cn(
                      'relative size-9 rounded-full ring-offset-2 ring-offset-background transition',
                      profile.tableFinish === finish.id
                        ? 'ring-2 ring-foreground/70'
                        : 'hover:ring-2 hover:ring-foreground/25',
                      !owned && 'opacity-40',
                    )}
                    style={{ backgroundColor: finish.swatch }}
                  >
                    {!owned && (
                      <Lock className="absolute inset-0 m-auto size-3.5 text-white/90 drop-shadow" />
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        {/* the quiet unlock hint — reserved height, no layout jump */}
        <p className="min-h-4 border-t border-foreground/10 pt-3 text-center text-xs text-muted-foreground">
          {hint ?? 'Locked things tell you where to find them.'}
        </p>
      </DialogContent>
    </Dialog>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">{children}</p>
  )
}

function FaceOption({
  label,
  selected,
  locked = false,
  onSelect,
  children,
}: {
  label: string
  selected: boolean
  locked?: boolean
  onSelect: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'relative flex flex-1 flex-col items-center gap-1 rounded-xl border border-foreground/10 bg-foreground/[0.02] px-3 py-2.5 transition',
        selected ? 'ring-2 ring-foreground/70' : 'hover:ring-2 hover:ring-foreground/25',
        locked && 'opacity-40',
      )}
    >
      <span className="flex gap-0.5 text-sm leading-none">{children}</span>
      <span className="text-xs font-medium">{label}</span>
      {locked && <Lock className="absolute right-2 top-2 size-3 text-muted-foreground" />}
    </button>
  )
}

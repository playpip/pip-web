'use client'

// Your style — one place to equip everything: card back, deck face, table
// finish, avatar ring, dealer button and the sound the table makes. Everything
// is a visual selector (tap to equip, ring shows what's in use); locked things
// explain themselves with a quiet hint line instead of a dead button. Buying
// happens in the Chip Shop; choosing happens here.
//
// **Every row is a scrolling strip** (Will, 2026-09-21: the deck row ran off
// the edge of the dialog and Minimal was a sliver). The card backs always were
// one; the deck and the finishes were flex rows that shared the width, which
// worked at two and three options and silently clipped the fifth. A strip is
// the shape that does not care how many there are, so all six are strips and a
// seventh design is a config entry rather than a layout problem.

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
import {
  AVATAR_RINGS,
  DEALER_BUTTONS,
  SOUND_PACKS,
  cosmeticUnlocked,
  soundPackById,
  type Cosmetic,
} from '@/config/cosmetics'
import { DECK_FACES, TABLE_FINISHES } from '@/config/shop'
import { venueById } from '@/config/venues'
import { useEntitlement } from '@/store/entitlement'
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
  const member = useEntitlement()
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

  /**
   * Why a locked thing is locked, in one sentence.
   *
   * **The membership is named before the price**, which is the order
   * `lib/sitDown` refuses in and for the same reason: telling somebody a number
   * they can reach, when the thing they are missing is not chips, is a lie they
   * can act on. A member-shelf item says both, because both are true and the
   * second one is the part they can do something about.
   *
   * Said plainly and without a link: this is a tooltip on a swatch inside a
   * settings dialog, about as far from the moment to sell as the app gets. The
   * one link lives on /membership.
   */
  const lockLine = (item: Cosmetic): string => {
    if (item.membersOnly && item.price > 0) {
      return member
        ? `${item.name} is on the members' shelf — ${money(item.price)} chips.`
        : `${item.name} comes with the membership, then ${money(item.price)} chips.`
    }
    if (item.membersOnly) return `${item.name} comes with the membership.`
    return `${item.name} is in the Chip Shop — ${money(item.price)} chips.`
  }

  const backHint = (design: (typeof ALL_CARD_BACKS)[number]): string => {
    const venue = design.unlock?.venueWin ? venueById(design.unlock.venueWin) : undefined
    const unlock = design.unlock
    if (!unlock) return design.name
    if (unlock.price !== undefined) {
      if (unlock.membersOnly) {
        return lockLine({
          id: design.id,
          name: design.name,
          blurb: '',
          price: unlock.price,
          membersOnly: true,
        })
      }
      if (venue && !wonVenues.has(venue.id)) {
        return `Win ${venue.name}, then buy ${design.name} in the Chip Shop.`
      }
      return `${design.name} is in the Chip Shop — ${money(unlock.price)} chips.`
    }
    if (unlock.membersOnly) return `${design.name} comes with the membership.`
    return venue ? `Win ${venue.name} to unlock ${design.name}.` : design.name
  }

  /** Equip if it is theirs, explain if it is not. The shape of every tap here. */
  const pick = (item: Cosmetic, equip: () => void) => {
    sound.play('tap')
    if (cosmeticUnlocked(item, ownedSet, member)) equip()
    else showHint(lockLine(item))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Style</DialogTitle>
          <DialogDescription>Card back, deck, table, and the rest of it.</DialogDescription>
        </DialogHeader>

        <div className="-mx-1.5 flex max-h-[62vh] min-h-0 min-w-0 flex-col gap-6 overflow-y-auto px-1.5 pt-1">
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
            {/* The members' backs lead — see the note on ALL_CARD_BACKS, where
                that order is decided and argued. */}
            <Strip>
              {ALL_CARD_BACKS.map((design) => {
                const unlocked = cardBackUnlocked(design, wonVenues, ownedSet, member)
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
                      // Locked member backs keep more of themselves than
                      // anything else on this screen: 40% opacity on a foiled
                      // card leaves a grey rectangle, and the whole point of
                      // the foil is that you can see what you are missing.
                      unlocked
                        ? 'hover:ring-foreground/25'
                        : design.unlock?.membersOnly
                          ? 'opacity-75'
                          : 'opacity-40',
                    )}
                  >
                    <CardBack design={design} size="xs" />
                    {!unlocked && (
                      <Lock className="absolute inset-0 m-auto size-3.5 text-white/90 drop-shadow" />
                    )}
                  </motion.button>
                )
              })}
            </Strip>
          </section>

          {/* --- deck face --------------------------------------------------- */}
          <section>
            <SectionLabel>The deck</SectionLabel>
            <Strip>
              <FaceOption
                label="Classic"
                selected={profile.deckFace === 'classic'}
                onSelect={() => {
                  sound.play('tap')
                  profile.setDeckFace('classic')
                }}
              >
                <SuitRow face="classic" />
              </FaceOption>
              {DECK_FACES.map((face) => (
                <FaceOption
                  key={face.id}
                  label={face.name.replace(' Deck', '')}
                  selected={profile.deckFace === face.id}
                  locked={!cosmeticUnlocked(face, ownedSet, member)}
                  onSelect={() => pick(face, () => profile.setDeckFace(face.id))}
                >
                  <SuitRow face={face.id} />
                </FaceOption>
              ))}
            </Strip>
          </section>

          {/* --- table finish ------------------------------------------------ */}
          <section>
            <SectionLabel>Table finish</SectionLabel>
            <Strip>
              {/* the plain table */}
              <button
                onClick={() => {
                  sound.play('tap')
                  profile.setTableFinish(null)
                }}
                aria-label="Plain table"
                title="Plain"
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-foreground/25 transition',
                  profile.tableFinish === null
                    ? 'ring-2 ring-foreground/70'
                    : 'hover:ring-2 hover:ring-foreground/25',
                )}
              >
                <span className="text-3xs text-muted-foreground">—</span>
              </button>
              {TABLE_FINISHES.map((finish) => {
                const unlocked = cosmeticUnlocked(finish, ownedSet, member)
                return (
                  <button
                    key={finish.id}
                    onClick={() => pick(finish, () => profile.setTableFinish(finish.id))}
                    aria-label={finish.name}
                    title={unlocked ? finish.name : lockLine(finish)}
                    className={cn(
                      'relative size-9 shrink-0 rounded-full ring-offset-2 ring-offset-background transition',
                      profile.tableFinish === finish.id
                        ? 'ring-2 ring-foreground/70'
                        : 'hover:ring-2 hover:ring-foreground/25',
                      !unlocked && 'opacity-40',
                    )}
                    style={{ backgroundColor: finish.swatch }}
                  >
                    {!unlocked && (
                      <Lock className="absolute inset-0 m-auto size-3.5 text-white/90 drop-shadow" />
                    )}
                  </button>
                )
              })}
            </Strip>
          </section>

          {/* --- avatar ring -------------------------------------------------- */}
          <section>
            <SectionLabel>Your ring</SectionLabel>
            <Strip>
              {/* no ring, which is the default and a real choice */}
              <button
                onClick={() => {
                  sound.play('tap')
                  profile.setAvatarRing(null)
                }}
                aria-label="No ring"
                title="No ring"
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-foreground/25 ring-offset-2 ring-offset-background transition',
                  profile.avatarRing === null
                    ? 'ring-2 ring-foreground/70'
                    : 'hover:ring-2 hover:ring-foreground/25',
                )}
              >
                <span className="text-3xs text-muted-foreground">—</span>
              </button>
              {AVATAR_RINGS.map((ring) => {
                const unlocked = cosmeticUnlocked(ring, ownedSet, member)
                return (
                  <button
                    key={ring.id}
                    onClick={() => pick(ring, () => profile.setAvatarRing(ring.id))}
                    aria-label={ring.name}
                    title={unlocked ? ring.name : lockLine(ring)}
                    className={cn(
                      'relative size-9 shrink-0 rounded-full ring-offset-2 ring-offset-background transition',
                      profile.avatarRing === ring.id
                        ? 'ring-2 ring-foreground/70'
                        : 'hover:ring-2 hover:ring-foreground/25',
                      !unlocked && 'opacity-45',
                    )}
                    // The ring drawn as it is worn — a band with the avatar's
                    // own surface inside it, rather than a filled disc, so the
                    // swatch is the thing and not an approximation of it.
                    style={{ background: ring.ring, padding: 3 }}
                  >
                    <span className="block size-full rounded-full bg-muted" />
                    {!unlocked && (
                      <Lock className="absolute inset-0 m-auto size-3.5 text-foreground/80" />
                    )}
                  </button>
                )
              })}
            </Strip>
          </section>

          {/* --- dealer button ------------------------------------------------ */}
          <section>
            <SectionLabel>Dealer button</SectionLabel>
            <Strip>
              {DEALER_BUTTONS.map((button) => {
                const unlocked = cosmeticUnlocked(button, ownedSet, member)
                return (
                  <button
                    key={button.id}
                    onClick={() => pick(button, () => profile.setDealerButton(button.id))}
                    aria-label={button.name}
                    title={unlocked ? button.name : lockLine(button)}
                    className={cn(
                      'relative flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-offset-2 ring-offset-background transition',
                      profile.dealerButton === button.id
                        ? 'ring-2 ring-foreground/70'
                        : 'hover:ring-2 hover:ring-foreground/25',
                      !unlocked && 'opacity-45',
                    )}
                    style={{
                      background: button.face,
                      color: button.ink,
                      boxShadow: button.edge ? `inset 0 0 0 1px ${button.edge}` : undefined,
                    }}
                  >
                    {unlocked ? 'D' : <Lock className="size-3.5" />}
                  </button>
                )
              })}
            </Strip>
          </section>

          {/* --- sound -------------------------------------------------------- */}
          <section>
            <SectionLabel>Sound</SectionLabel>
            <Strip>
              {SOUND_PACKS.map((pack) => {
                const unlocked = cosmeticUnlocked(pack, ownedSet, member)
                return (
                  <button
                    key={pack.id}
                    onClick={() => {
                      if (!unlocked) {
                        sound.play('tap')
                        showHint(lockLine(pack))
                        return
                      }
                      // **Equip, then play.** The engine takes the pack first
                      // so the confirming blip is the pack you just chose — a
                      // sound picker that answers in the old voice is a picker
                      // you cannot hear the point of.
                      sound.setPack(soundPackById(pack.id))
                      profile.setSoundPack(pack.id)
                      sound.play('call')
                    }}
                    aria-label={pack.name}
                    title={unlocked ? pack.blurb : lockLine(pack)}
                    className={cn(
                      'relative flex shrink-0 items-center gap-1.5 rounded-xl border border-foreground/10 bg-foreground/[0.02] px-3 py-2 text-xs font-medium transition',
                      profile.soundPack === pack.id
                        ? 'ring-2 ring-foreground/70'
                        : 'hover:ring-2 hover:ring-foreground/25',
                      !unlocked && 'opacity-45',
                    )}
                  >
                    {!unlocked && <Lock className="size-3 shrink-0" />}
                    {pack.name}
                  </button>
                )
              })}
            </Strip>
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

/**
 * A row that scrolls sideways instead of squeezing.
 *
 * The negative margin plus matching padding is so a selection ring, which draws
 * outside its button, is not clipped by the scroll container it lives in — the
 * card-back strip has always done this and the other five now inherit it rather
 * than each discovering it.
 */
function Strip({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  )
}

/** The four suits as a given deck face draws them. */
function SuitRow({ face }: { face: string }) {
  const fourColour = face === 'face-fourcolor'
  const bold = face === 'face-contrast'
  const light = face === 'face-minimal'
  const big = face === 'face-bigindex'
  const weight = bold ? 'font-black' : light ? 'font-light' : undefined
  return (
    <span className={cn('flex gap-0.5 leading-none', big ? 'text-base' : 'text-sm')}>
      <span className={cn('text-suit-red', weight)}>♥</span>
      <span className={cn('text-foreground', weight)}>♠</span>
      <span className={cn(fourColour ? 'text-suit-blue' : 'text-suit-red', weight)}>♦</span>
      <span className={cn(fourColour ? 'text-suit-green' : 'text-foreground', weight)}>♣</span>
    </span>
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
        // **A fixed width *and* a fixed height.** The width is not `flex-1`
        // because in a strip there is no width to share. The height is fixed
        // because the labels are not the same length: "Big Index" is one line
        // and "High-Contrast" is two, and a row of tiles that grow to their own
        // content is a row of tiles at three different heights (Will,
        // 2026-09-22). Sized for the two-line case so the one-line tiles match
        // it rather than the other way round, with the suits and the label
        // centred in whatever is left.
        'relative flex h-[4.75rem] w-[5.25rem] shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-foreground/10 bg-foreground/[0.02] px-2 transition',
        selected ? 'ring-2 ring-foreground/70' : 'hover:ring-2 hover:ring-foreground/25',
        locked && 'opacity-40',
      )}
    >
      {children}
      <span className="text-center text-xs font-medium leading-tight">{label}</span>
      {locked && <Lock className="absolute right-1.5 top-1.5 size-3 text-muted-foreground" />}
    </button>
  )
}

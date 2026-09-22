'use client'

// The Chip Shop — Pearl's counter. Spend the Roll on style: card backs, the
// four-colour deck, table finishes, rings, dealer buttons, the sound the table
// makes, souvenirs of venues you've conquered. Style and story, never edge
// (docs/shop.md) — nothing here touches gameplay. No sale banners, no NEW dots:
// the shop is here when you go looking.
//
// **Two things on the shelves are new as of 2026-09-21, and both needed a
// ruling** (docs/shop.md rule 3, rewritten):
//
// - **Free stock.** A zero price is a real price here now, and a free row shows
//   "Use", never a Buy button reading 0. Pearl giving something away is better
//   than three new categories a free player can only look at.
// - **The members' shelf**, at the bottom and clearly its own. Some of it comes
//   with the membership and says "Included"; the rest the membership lets you
//   *buy*, with chips you won, at prices above the open shelf. Nothing on any
//   shelf in this room has ever been payable in cash and that has not changed.

import { useMemo, useState } from 'react'
import { Lock, XIcon } from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { accentFromSwatch } from '@/lib/avatar'
import { CardBack } from '@/components/CardBack'
import { useProfile } from '@/store/profile'
import { useEntitlement } from '@/store/entitlement'
import { characterById } from '@/config/cast'
import { AwardChip } from '@/components/AwardChip'
import { SHOP_BACKS, cardBackById } from '@/config/cardBacks'
import { avatarRingById, dealerButtonById, soundPackById } from '@/config/cosmetics'
import { venueById } from '@/config/venues'
import {
  DECK_FACES,
  SHOP_ITEMS,
  SOUVENIRS,
  TABLE_FINISHES,
  souvenirAward,
  type ShopItem,
} from '@/config/shop'
import { useMoney } from '@/lib/useMoney'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

/** The rows of one kind that belong on the open shelf. */
const openShelf = (kind: ShopItem['kind']) =>
  SHOP_ITEMS.filter((item) => item.kind === kind && !item.membersOnly)

/** Everything the membership gates, in the order the categories are listed above. */
const MEMBER_SHELF = SHOP_ITEMS.filter((item) => item.membersOnly)

export function ShopDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const money = useMoney()
  const roll = useProfile((s) => s.roll)
  const pearl = characterById('pearl')
  // One dry line per visit — re-rolled each time the shop opens.
  const line = useMemo(() => {
    const lines = pearl?.lines.seat ?? []
    return open && lines.length > 0 ? lines[Math.floor(Math.random() * lines.length)] : null
  }, [open, pearl])

  // No shop photo — so the cover is spun from Pearl's own palette: her sand
  // swatch warmed by its derived accent into a soft, storefront-y band.
  const swatch = pearl ? `#${pearl.avatar.backgroundColor}` : '#f4e7b6'
  const accent = pearl ? accentFromSwatch(pearl.avatar.backgroundColor) : '#c9a94e'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md" showCloseButton={false}>
        <header className="relative shrink-0 text-center">
          {/* warm cover strip drawn from Pearl's palette */}
          <div
            aria-hidden
            className="h-24 w-full"
            style={{
              backgroundImage: `linear-gradient(135deg, ${accent} 0%, ${swatch} 55%, ${accent} 100%)`,
            }}
          />
          {/* fixed-contrast close, matching the venue dialog */}
          <DialogClose
            aria-label="Close"
            className="absolute top-2.5 right-2.5 grid size-7 place-items-center rounded-full bg-black/35 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/55 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
          >
            <XIcon className="size-4" />
          </DialogClose>
          {/* Pearl straddles the strip's lower edge */}
          <div className="flex flex-col items-center px-4 pb-1">
            {pearl && (
              <PlayerAvatar spec={pearl.avatar} size={72} className="-mt-9 ring-4 ring-popover" />
            )}
            <DialogTitle className="mt-2 text-lg">The Chip Shop</DialogTitle>
            <DialogDescription className="mt-1">{line ?? 'Style, never edge.'}</DialogDescription>
            <p className="mt-3 rounded-full bg-foreground/[0.06] px-3 py-1 text-xs font-medium text-muted-foreground tabular-nums">
              Your Roll — {money(roll)} chips
            </p>
          </div>
        </header>

        <div className="flex max-h-[55vh] min-h-0 flex-col gap-5 overflow-y-auto px-4 pt-4 pb-4">
          <Section title="Card backs" items={SHOP_BACKS.map((d) => shopBackItem(d.id))} />
          <Section title="The deck" items={DECK_FACES.filter((f) => !f.membersOnly)} />
          <Section title="Table finishes" items={TABLE_FINISHES.filter((f) => !f.membersOnly)} />
          <Section title="Your ring" items={openShelf('ring')} />
          <Section title="Dealer buttons" items={openShelf('button')} />
          <Section title="Sound" items={openShelf('sound')} />
          <Section title="Souvenirs" items={[...SOUVENIRS]} />
          <Section
            title="The members' shelf"
            note="Included with the membership, or bought with chips you won — never with money."
            items={MEMBER_SHELF}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

// SHOP_BACKS are card-back designs; their shop rows come from config/shop.
function shopBackItem(id: string): ShopItem {
  return SHOP_ITEMS.find((i) => i.id === id)!
}

function Section({ title, note, items }: { title: string; note?: string; items: ShopItem[] }) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-[0.15em] text-muted-foreground">{title}</p>
      {note && <p className="-mt-1 mb-2 text-xs text-muted-foreground/80">{note}</p>}
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}

function ItemRow({ item }: { item: ShopItem }) {
  const money = useMoney()
  const profile = useProfile()
  const member = useEntitlement()
  const [justBought, setJustBought] = useState(false)

  // **Free things are not bought, and a free thing is never in `owned`.** The
  // shop used to treat "can I use this" and "have I paid for this" as the same
  // question, which is exactly right while every row has a price and wrong the
  // moment one does not — a free row rendered a Buy button reading 0 (Will,
  // 2026-09-21).
  const free = item.price === 0 && !item.membersOnly
  const included = item.price === 0 && item.membersOnly === true
  const owned = profile.owned.includes(item.id)
  const usable = free || owned || (included && member)

  const winNeeded = item.requiresVenueWin
  const hasWin = !winNeeded || (profile.venueRecords[winNeeded]?.won ?? 0) > 0
  const affordable = profile.roll >= item.price
  // The membership is the first refusal, before the win and before the money:
  // a price shown to somebody who cannot buy at any price is a number they
  // would act on. Same order `lib/sitDown` refuses in.
  const needsMembership = Boolean(item.membersOnly) && !member

  const inUse =
    (item.kind === 'face' && profile.deckFace === item.id) ||
    (item.kind === 'finish' && profile.tableFinish === item.id) ||
    (item.kind === 'back' && profile.cardBack === item.id) ||
    (item.kind === 'ring' && profile.avatarRing === item.id) ||
    (item.kind === 'button' && profile.dealerButton === item.id) ||
    (item.kind === 'sound' && profile.soundPack === item.id)

  const buy = () => {
    sound.play('call')
    profile.buyItem(item.id, item.price)
    setJustBought(true)
  }

  const toggleUse = () => {
    sound.play('tap')
    if (item.kind === 'face') profile.setDeckFace(inUse ? 'classic' : item.id)
    if (item.kind === 'finish') profile.setTableFinish(inUse ? null : item.id)
    if (item.kind === 'back' && !inUse) profile.setCardBack(item.id)
    if (item.kind === 'ring') profile.setAvatarRing(inUse ? null : item.id)
    if (item.kind === 'button' && !inUse) profile.setDealerButton(item.id)
    if (item.kind === 'sound' && !inUse) {
      // Engine first, so the confirming blip is already the new pack.
      sound.setPack(soundPackById(item.id))
      profile.setSoundPack(item.id)
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl bg-foreground/[0.03] p-2.5">
      <ItemArt item={item} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{item.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {justBought && item.kind !== 'souvenir'
            ? '“Lovely choice,” says Pearl, wrapping it up.'
            : item.blurb}
        </p>
      </div>
      <div className="shrink-0">
        {usable ? (
          item.kind === 'souvenir' ? (
            <span className="text-xs text-muted-foreground">On your shelf</span>
          ) : (
            <button
              onClick={toggleUse}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                inUse
                  ? 'bg-foreground/10 text-muted-foreground'
                  : 'bg-foreground/[0.06] hover:bg-foreground/[0.12]',
              )}
            >
              {inUse ? 'In use' : 'Use'}
            </button>
          )
        ) : needsMembership ? (
          <span className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
            <Lock className="size-3" />
            {item.price > 0 ? `Members · ${money(item.price)}` : 'With the membership'}
          </span>
        ) : !hasWin ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3" />
            Win {venueById(winNeeded ?? '')?.name ?? '—'}
          </span>
        ) : (
          <button
            onClick={buy}
            disabled={!affordable}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition tabular-nums hover:bg-primary/90 disabled:opacity-40"
          >
            {money(item.price)}
          </button>
        )}
      </div>
    </div>
  )
}

function ItemArt({ item }: { item: ShopItem }) {
  if (item.kind === 'back') {
    return <CardBack design={cardBackById(item.id)} size="xs" />
  }
  if (item.kind === 'face') {
    const fourColour = item.id === 'face-fourcolor'
    const bold = item.id === 'face-contrast'
    const light = item.id === 'face-minimal'
    const big = item.id === 'face-bigindex'
    return (
      <span
        className={cn(
          'flex w-8 flex-wrap items-center justify-center leading-tight',
          big ? 'text-xs' : 'text-2xs',
          bold && 'font-black',
          light && 'font-light',
        )}
      >
        <span className="text-suit-red">♥</span>
        <span className="text-cardface-ink dark:text-foreground">♠</span>
        <span className={fourColour ? 'text-suit-blue' : 'text-suit-red'}>♦</span>
        <span className={fourColour ? 'text-suit-green' : 'text-cardface-ink dark:text-foreground'}>
          ♣
        </span>
      </span>
    )
  }
  if (item.kind === 'souvenir') {
    return <AwardChip award={souvenirAward(item)} earned size={28} className="mx-0.5 shrink-0" />
  }
  if (item.kind === 'ring') {
    const ring = avatarRingById(item.id)
    return (
      <span
        className="mx-1 block size-6 shrink-0 rounded-full"
        style={{ background: ring?.ring, padding: 2.5 }}
        aria-hidden
      >
        <span className="block size-full rounded-full bg-muted" />
      </span>
    )
  }
  if (item.kind === 'button') {
    const button = dealerButtonById(item.id)
    return (
      <span
        className="mx-1 flex size-6 shrink-0 items-center justify-center rounded-full text-3xs font-bold"
        style={{
          background: button.face,
          color: button.ink,
          boxShadow: button.edge ? `inset 0 0 0 1px ${button.edge}` : undefined,
        }}
        aria-hidden
      >
        D
      </span>
    )
  }
  if (item.kind === 'sound') {
    // Three bars whose heights follow the pack's own pitch, so the packs are
    // distinguishable at a glance rather than six identical speaker icons.
    const pack = soundPackById(item.id)
    return (
      <span className="mx-1 flex size-6 shrink-0 items-end justify-center gap-[2px]" aria-hidden>
        {[0.55, 1, 0.75].map((h, i) => (
          <span
            key={i}
            className="w-[3px] rounded-full bg-foreground/45"
            style={{ height: `${Math.min(100, h * pack.pitch * 80)}%` }}
          />
        ))}
      </span>
    )
  }
  return (
    <span
      className="mx-1 size-6 shrink-0 rounded-full ring-1 ring-foreground/10"
      style={{ backgroundColor: item.swatch }}
      aria-hidden
    />
  )
}

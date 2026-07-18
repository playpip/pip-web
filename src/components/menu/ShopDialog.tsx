'use client'

// The Chip Shop — Pearl's counter. Spend the Roll on style: card backs, the
// four-colour deck, table finishes, souvenirs of venues you've conquered.
// Style and story, never edge (docs/shop.md) — nothing here touches gameplay.
// No sale banners, no NEW dots: the shop is here when you go looking.

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
import { characterById } from '@/config/cast'
import { AwardChip } from '@/components/AwardChip'
import { SHOP_BACKS, cardBackById } from '@/config/cardBacks'
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
        <header className="relative text-center">
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

        <div className="flex max-h-[55vh] flex-col gap-5 overflow-y-auto px-4 pt-4 pb-4">
          <Section title="Card backs" items={SHOP_BACKS.map((d) => shopBackItem(d.id))} />
          <Section title="The deck" items={[...DECK_FACES]} />
          <Section title="Table finishes" items={[...TABLE_FINISHES]} />
          <Section title="Souvenirs" items={[...SOUVENIRS]} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

// SHOP_BACKS are card-back designs; their shop rows come from config/shop.
function shopBackItem(id: string): ShopItem {
  return SHOP_ITEMS.find((i) => i.id === id)!
}

function Section({ title, items }: { title: string; items: ShopItem[] }) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-[0.15em] text-muted-foreground">{title}</p>
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
  const [justBought, setJustBought] = useState(false)

  const owned = profile.owned.includes(item.id)
  const winNeeded = item.requiresVenueWin
  const hasWin = !winNeeded || (profile.venueRecords[winNeeded]?.won ?? 0) > 0
  const affordable = profile.roll >= item.price

  const inUse =
    (item.kind === 'face' && profile.deckFace === item.id) ||
    (item.kind === 'finish' && profile.tableFinish === item.id) ||
    (item.kind === 'back' && profile.cardBack === item.id)

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
        {owned ? (
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
    return (
      <span
        className={cn(
          'flex w-8 flex-wrap items-center justify-center text-[11px] leading-tight',
          bold && 'font-black',
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
  return (
    <span
      className="mx-1 size-6 shrink-0 rounded-full ring-1 ring-foreground/10"
      style={{ backgroundColor: item.swatch }}
      aria-hidden
    />
  )
}

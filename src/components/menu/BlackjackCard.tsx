'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Lock, XIcon } from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { ExpandableNote } from './ExpandableNote'
import { VenueArt } from './VenueArt'
import { VenueTile, type TileVM } from './venueCard'
import { HOUSE_RULES, BLACKJACK_STACKS, type HouseRules } from '@/lib/blackjack/rules'
import { useMoney } from '@/lib/useMoney'
import { useSpendableRoll } from '@/lib/useSpendableRoll'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

const ACCENT = '#C9873D'
/** Borrowed from the Downtown Casino, which is exactly the right room for it. */
const ART = 'casino'

/**
 * Blackjack, on the shelf.
 *
 * **Its own card rather than a family**, because a family is rooms priced in
 * one list and blackjack is two lists: what you sit down with, and which house
 * you sit down against. On a poker table those are the same axis — the price
 * picks the company — and here they are not, because the dealer has no
 * personality to scale. It draws to seventeen whether you brought 500 or
 * 50,000.
 *
 * **The copy is dry about it not being poker and never about the player.** The
 * house edge is on the card before you tap it, which is the whole difference
 * between putting a casino game in here and being one.
 */
export function BlackjackCard({ member, index }: { member: boolean; index: number }) {
  const router = useRouter()
  const money = useMoney()
  const spendable = useSpendableRoll()
  const [open, setOpen] = useState(false)

  const cheapest = BLACKJACK_STACKS[0]
  const affordable = spendable >= cheapest
  const model: TileVM = {
    artId: ART,
    accent: ACCENT,
    name: 'Blackjack',
    tag: 'Not poker',
    index,
    line: `${HOUSE_RULES.length} houses · from ${money(cheapest)}`,
    playable: member && affordable,
    lockedReason: !member
      ? 'Comes with the membership'
      : affordable
        ? undefined
        : `Need ${money(cheapest)}`,
    premium: true,
    onOpen: () => {
      sound.play('tap')
      // Same rule as the family cards: a locked tap goes to the page that
      // explains it rather than to a dialog that ends in a padlock.
      if (!member) {
        router.push('/membership')
        return
      }
      setOpen(true)
    },
  }

  return (
    <>
      <VenueTile model={model} />
      <BlackjackDialog open={open} onOpenChange={setOpen} member={member} />
    </>
  )
}

/**
 * Describe it, then price it — the shape every other card on this shelf has.
 *
 * It briefly put both pickers on the first screen, on the reasoning that the
 * two axes change what each other is worth and splitting them would hide half
 * the decision. Will read it beside the venue dialogs and wanted the same two
 * steps (2026-09-20), and he is right for a reason the original argument
 * missed: the first screen's job is to tell you what blackjack *is* and what it
 * costs you, and a player who reads that and leaves should not have to scroll
 * past two pickers to do it. The pickers still sit together on the second
 * screen, so the part of the argument that was true is kept.
 */
function BlackjackDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: boolean
}) {
  const router = useRouter()
  const money = useMoney()
  const spendable = useSpendableRoll()
  const [picking, setPicking] = useState(false)
  const [stack, setStack] = useState(BLACKJACK_STACKS[0])
  const [house, setHouse] = useState<HouseRules>(HOUSE_RULES[1])

  const affordable = spendable >= stack
  const cheapest = BLACKJACK_STACKS[0]
  const canSitAtAll = spendable >= cheapest

  const close = (next: boolean) => {
    // Reset on close, or reopening drops you straight back on the picker.
    if (!next) setPicking(false)
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm" showCloseButton={false}>
        <header className="relative shrink-0 overflow-hidden">
          <VenueArt id={ART} accent={ACCENT} className="h-40 w-full scale-110 blur-[3px]" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15" />
          <DialogClose
            aria-label="Close"
            className="absolute top-2.5 right-2.5 grid size-7 place-items-center rounded-full bg-black/35 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/55 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
          >
            <XIcon className="size-4" />
          </DialogClose>
          {picking && (
            <button
              type="button"
              aria-label="Back"
              onClick={() => setPicking(false)}
              className="absolute top-2.5 left-2.5 grid size-7 place-items-center rounded-full bg-black/35 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/55 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4">
            <DialogTitle className="flex items-center gap-2 text-lg text-white">
              {picking ? 'Choose your table' : 'Blackjack'}
              {!picking && (
                <span
                  className="rounded bg-white/15 px-1.5 py-0.5 text-2xs font-semibold"
                  style={{ color: ACCENT }}
                >
                  Not poker
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="leading-snug text-white/75">
              {picking
                ? 'What you sit down with, and which house you sit down against. The second one is the only thing that changes the odds.'
                : 'No opponents, no position, no reads. Just you and a dealer who cannot be bluffed.'}
            </DialogDescription>
          </div>
        </header>

        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto p-4">
          {picking ? (
            <>
              <section>
                <p className="mb-2 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  Sit down with
                </p>
                <div className="flex flex-wrap gap-2">
                  {BLACKJACK_STACKS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setStack(amount)}
                      disabled={spendable < amount}
                      className={cn(
                        'rounded-xl border px-3 py-1.5 text-sm tabular-nums transition disabled:opacity-40',
                        amount === stack
                          ? 'border-foreground/40 bg-foreground/[0.06] font-semibold'
                          : 'border-foreground/10 hover:border-foreground/25',
                      )}
                    >
                      {money(amount)}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  It comes out of your Roll and goes back in when you stand up, chip for chip. The
                  table minimum is a hundredth of it.
                </p>
              </section>

              <section>
                <p className="mb-2 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  Against
                </p>
                <div className="flex flex-col gap-2">
                  {HOUSE_RULES.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setHouse(option)}
                      className={cn(
                        'rounded-2xl border px-4 py-3 text-left transition',
                        option.id === house.id
                          ? 'border-foreground/40 bg-foreground/[0.06]'
                          : 'border-foreground/10 hover:border-foreground/25',
                      )}
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold">{option.name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {option.edgePercent}% to the house
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                        {option.blurb}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {affordable ? (
                <button
                  onClick={() => {
                    sound.play('call')
                    router.push(`/game/blackjack?table=${house.id}&stack=${stack}`)
                  }}
                  className="w-full rounded-2xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
                >
                  Sit down — {money(stack)}
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-foreground/10 py-3 text-sm text-muted-foreground">
                  <Lock className="size-4" /> Need {money(stack)} to sit down
                </div>
              )}
            </>
          ) : (
            <>
              <section>
                <p className="mb-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  How it plays
                </p>
                <ExpandableNote text={WHAT_IT_IS} />
              </section>

              <section>
                <p className="mb-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  The table
                </p>
                <div className="flex flex-col">
                  <Row
                    label="Sit down with"
                    value={`${money(cheapest)} – ${money(BLACKJACK_STACKS[BLACKJACK_STACKS.length - 1])}`}
                  />
                  <Row label="Houses" value={`${HOUSE_RULES.length}, each stating its edge`} />
                  <Row
                    label="House keeps"
                    value={`${HOUSE_RULES[0].edgePercent}% – ${HOUSE_RULES[HOUSE_RULES.length - 1].edgePercent}%`}
                  />
                  <Row label="Cash out" value="Whenever. Chip for chip." />
                </div>
              </section>

              {!member ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-foreground/10 py-3 text-sm text-muted-foreground">
                  <Lock className="size-4" />
                  <span>
                    Comes with the membership.{' '}
                    <Link
                      href="/membership"
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      What that is
                    </Link>
                  </span>
                </div>
              ) : canSitAtAll ? (
                <button
                  onClick={() => {
                    sound.play('tap')
                    setPicking(true)
                  }}
                  className="w-full rounded-2xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
                >
                  Play
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-foreground/10 py-3 text-sm text-muted-foreground">
                  <Lock className="size-4" /> Need {money(cheapest)} to sit down
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The pitch, such as it is.
 *
 * Long enough to fold, which is the point: somebody who already knows what
 * blackjack is gets four lines and a button, and somebody who does not can open
 * it. The house edge is in here *and* in the table below it, because it is the
 * one fact that decides whether to play at all.
 */
const WHAT_IT_IS =
  'Get closer to twenty-one than the dealer without going over. Two buttons — another card, or no more — and that is genuinely the whole game. There is no skill edge to find: the dealer draws to seventeen whatever you hold, has no decisions for you to read and cannot be bluffed, so the only thing separating a good session from a bad one is the cards. There is no doubling and no splitting here either, which keeps it to the one decision worth having and does make the odds worse than a real table’s — the figures below already account for that. It is in a poker app as a curiosity, and the only honest way to put it here is to tell you what it costs: every table states the percentage the house keeps of everything staked at it, over time, played perfectly. Poker does not have one of those.'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-foreground/[0.06] py-1.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  )
}

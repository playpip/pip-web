'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { PlayingCard } from '@/components/PlayingCard'
import { cardFromString } from '@/lib/poker/cards'

// Poker hands, best → worst, each with a five-card example.
const HANDS: { name: string; made: string; cards: string[] }[] = [
  {
    name: 'Royal Flush',
    made: 'A-K-Q-J-10, all the same suit.',
    cards: ['Ah', 'Kh', 'Qh', 'Jh', 'Th'],
  },
  {
    name: 'Straight Flush',
    made: 'Five in sequence, all one suit.',
    cards: ['9s', '8s', '7s', '6s', '5s'],
  },
  {
    name: 'Four of a Kind',
    made: 'Four cards of the same rank.',
    cards: ['Qc', 'Qd', 'Qh', 'Qs', '4h'],
  },
  {
    name: 'Full House',
    made: 'Three of a kind plus a pair.',
    cards: ['Jh', 'Jd', 'Js', '8c', '8h'],
  },
  {
    name: 'Flush',
    made: 'Five of the same suit, any order.',
    cards: ['Kd', 'Td', '8d', '5d', '2d'],
  },
  {
    name: 'Straight',
    made: 'Five in sequence, mixed suits.',
    cards: ['9c', '8d', '7h', '6s', '5c'],
  },
  {
    name: 'Three of a Kind',
    made: 'Three cards of the same rank.',
    cards: ['7h', '7d', '7s', 'Kc', '2d'],
  },
  { name: 'Two Pair', made: 'Two different pairs.', cards: ['Ah', 'Ad', '9s', '9c', '4h'] },
  { name: 'One Pair', made: 'Two cards of the same rank.', cards: ['Th', 'Td', 'Ks', '6c', '3d'] },
  {
    name: 'High Card',
    made: 'None of the above — highest card plays.',
    cards: ['Ah', 'Qd', '9s', '6c', '2d'],
  },
]

export function HandsHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hand rankings</DialogTitle>
          <DialogDescription>Strongest to weakest.</DialogDescription>
        </DialogHeader>

        <div className="-mx-1 flex max-h-[65vh] flex-col gap-2 overflow-y-auto px-1 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {HANDS.map((hand, i) => (
            <div
              key={hand.name}
              className="flex items-center gap-3 rounded-xl bg-foreground/[0.03] p-2.5"
            >
              <div className="flex shrink-0 gap-0.5">
                {hand.cards.map((c, j) => (
                  <PlayingCard key={j} card={cardFromString(c)} size="xs" />
                ))}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  <span className="text-muted-foreground">{i + 1}.</span> {hand.name}
                </div>
                <p className="text-xs leading-snug text-muted-foreground">{hand.made}</p>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client'

// Moves set ahead of your turn: the row under the table while somebody else
// is to act. Outlined, where your own buttons are filled, so it never reads as
// your turn. Tap one to set it, tap it again to clear it. The server makes it
// for you when the action reaches you, if it still stands (a call lapses when
// the bet changes), and drops it at the end of the street.

import { motion } from 'framer-motion'
import type { HandState } from '@/lib/poker/engine'
import type { PreAction, PreKind } from '@/lib/multiplayer/slow'
import { useMoney } from '@/lib/useMoney'
import { cn } from '@/lib/utils'

export function PreActions({
  hand,
  handIndex,
  heroId,
  pre,
  onSet,
}: {
  hand: HandState
  handIndex: number
  heroId: string
  pre: PreAction | null
  onSet: (pre: { kind: PreKind; amount?: number } | null) => void
}) {
  const money = useMoney()
  const hero = hand.players.find((p) => p.id === heroId)
  const toAct = hand.players[hand.toActIndex]
  if (hero?.status !== 'active' || !toAct || toAct.id === heroId || hand.result) {
    // Nothing: the row (ActionRow) holds its height on its own.
    return null
  }
  const owed = Math.min(hero.stack, Math.max(0, hand.currentBet - hero.committedThisStreet))
  // Only what still stands for this street counts as set.
  const current = pre && pre.hand === handIndex && pre.street === hand.street ? pre : null
  const isOn = (kind: PreKind) =>
    current?.kind === kind && (kind !== 'call' || current.amount === owed)

  const options: { kind: PreKind; label: string; amount?: number }[] = [
    { kind: 'check-fold', label: owed > 0 ? 'Fold' : 'Check/Fold' },
    owed > 0
      ? { kind: 'call', label: `Call ${money(owed)}`, amount: owed }
      : { kind: 'check', label: 'Check' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2"
    >
      {options.map((o) => {
        const on = isOn(o.kind)
        return (
          <motion.button
            key={o.kind}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSet(on ? null : { kind: o.kind, amount: o.amount })}
            aria-pressed={on}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-2xl py-4 text-base font-semibold ring-1 transition',
              on
                ? 'bg-foreground/[0.1] text-foreground ring-foreground/40'
                : 'bg-transparent text-muted-foreground ring-foreground/15 hover:text-foreground hover:ring-foreground/30',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'grid size-4 place-items-center rounded-full ring-1 transition',
                on ? 'bg-foreground ring-foreground' : 'ring-foreground/30',
              )}
            >
              {on && <span className="size-1.5 rounded-full bg-background" />}
            </span>
            {o.label}
          </motion.button>
        )
      })}
    </motion.div>
  )
}

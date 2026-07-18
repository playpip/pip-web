'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { legalActions, potSize, type HandState } from '@/lib/poker/engine'
import { useGame } from '@/store/game'
import { sound } from '@/lib/sound'
import { useMoney } from '@/lib/useMoney'
import { cn } from '@/lib/utils'

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export function ActionBar({ hand }: { hand: HandState }) {
  const act = useGame((s) => s.act)
  const money = useMoney()
  const [sizerOpen, setSizerOpen] = useState(false)
  const [raiseTo, setRaiseTo] = useState(0)

  const legal = legalActions(hand)
  const hero = hand.players[hand.toActIndex]
  const isHeroTurn = hero?.id === 'hero' && !!legal

  // Match the real button row's height exactly (py-4 + text-base = 56px) so the
  // bar appearing/clearing on the hero's turn never resizes the layout — that
  // resize is what nudges the community cards.
  if (!isHeroTurn || !legal) {
    return <div className="h-[56px]" aria-hidden />
  }

  const pot = potSize(hand)
  const isAllIn = raiseTo >= legal.maxRaiseTo

  const openSizer = () => {
    setRaiseTo(clamp(legal.minRaiseTo, legal.minRaiseTo, legal.maxRaiseTo))
    setSizerOpen(true)
  }
  const preset = (fraction: number) => {
    sound.play('tap')
    setRaiseTo(
      clamp(hand.currentBet + Math.round(pot * fraction), legal.minRaiseTo, legal.maxRaiseTo),
    )
  }
  const confirmRaise = () => {
    act({ type: legal.canBet ? 'bet' : 'raise', amount: raiseTo })
    setSizerOpen(false)
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-2"
      >
        <Pill onClick={() => act({ type: 'fold' })} tone="ghost">
          Fold
        </Pill>
        {legal.canCheck ? (
          <Pill onClick={() => act({ type: 'check' })}>Check</Pill>
        ) : (
          <Pill onClick={() => act({ type: 'call' })}>Call {money(legal.callAmount)}</Pill>
        )}
        {(legal.canBet || legal.canRaise) && (
          <Pill onClick={openSizer} tone="primary">
            {legal.canBet ? 'Bet' : 'Raise'}
          </Pill>
        )}
      </motion.div>

      <Dialog open={sizerOpen} onOpenChange={setSizerOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{legal.canBet ? 'Bet' : 'Raise'}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 pt-1">
            <div className="text-center text-4xl font-semibold tabular-nums">
              {isAllIn ? 'All in' : money(raiseTo)}
            </div>

            <input
              type="range"
              min={legal.minRaiseTo}
              max={legal.maxRaiseTo}
              value={raiseTo}
              onChange={(e) => setRaiseTo(Number(e.target.value))}
              className="w-full accent-foreground"
            />

            <div className="flex gap-2">
              {(['½', '¾', 'Pot'] as const).map((label, i) => (
                <button
                  key={label}
                  onClick={() => preset([0.5, 0.75, 1][i])}
                  className="flex-1 rounded-xl bg-foreground/5 py-2 text-sm font-medium transition hover:bg-foreground/10"
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => {
                  sound.play('tap')
                  setRaiseTo(legal.maxRaiseTo)
                }}
                className="flex-1 rounded-xl bg-foreground/5 py-2 text-sm font-medium transition hover:bg-foreground/10"
              >
                Max
              </button>
            </div>

            <button
              onClick={confirmRaise}
              className="w-full rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
            >
              {legal.canBet ? 'Bet' : 'Raise'} {isAllIn ? 'all in' : money(raiseTo)}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Pill({
  children,
  onClick,
  tone = 'default',
}: {
  children: React.ReactNode
  onClick: () => void
  tone?: 'default' | 'primary' | 'ghost'
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 rounded-2xl py-4 text-base font-semibold transition active:scale-[0.97]',
        tone === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
        tone === 'default' && 'bg-foreground/[0.08] text-foreground hover:bg-foreground/[0.14]',
        tone === 'ghost' && 'bg-foreground/[0.03] text-muted-foreground hover:bg-foreground/[0.08]',
      )}
    >
      {children}
    </button>
  )
}

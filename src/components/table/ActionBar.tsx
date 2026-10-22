'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { legalActions, potSize, type Action, type HandState } from '@/lib/poker/engine'
import { useGame } from '@/store/game'
import { sound } from '@/lib/sound'
import { useMoney } from '@/lib/useMoney'
import { cn } from '@/lib/utils'
import {
  BUTTON_KEYS,
  SIZER_PRESET_KEYS,
  sizerIntentFor,
  tableKeyFor,
  type KeyTarget,
} from '@/lib/tableKeys'
import { KeyBadge } from '@/components/KeyBadge'
import { TableKeysDialog, useTableKeyboard, useTableKeys } from './keys'

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export function ActionBar({
  hand,
  marked = [],
  onDrawn,
  viewerId = 'hero',
  onAct,
}: {
  hand: HandState
  /** Five-Card Draw: the cards the hero has marked to throw away. */
  marked?: readonly number[]
  /** Called once the discard has been sent, so the selection can be cleared. */
  onDrawn?: () => void
  /** Whose buttons these are. The single-player table's hero unless told otherwise. */
  viewerId?: string
  /** Where a move goes. The game store unless told otherwise (a multiplayer room). */
  onAct?: (action: Action) => void
}) {
  const localAct = useGame((s) => s.act)
  const act = onAct ?? localAct
  const money = useMoney()
  const [sizerOpen, setSizerOpen] = useState(false)
  const [raiseTo, setRaiseTo] = useState(0)
  // Desktop only (lib/tableKeys). The multiplayer room plays through this bar too.
  const keyboard = useTableKeyboard()
  const [keysOpen, setKeysOpen] = useState(false)
  const slider = useRef<HTMLInputElement>(null)

  const legal = legalActions(hand)
  const hero = hand.players[hand.toActIndex]
  const isHeroTurn = hero?.id === viewerId && !!legal

  const openSizer = () => {
    if (!legal) return
    setRaiseTo(clamp(legal.minRaiseTo, legal.minRaiseTo, legal.maxRaiseTo))
    setSizerOpen(true)
  }
  const openKeys = () => {
    sound.play('tap')
    setKeysOpen(true)
  }

  // Before the early return, so `?` works off turn. Open dialogs handle their own keys.
  useTableKeys(keyboard, (e) => {
    const intent = tableKeyFor(e, e.target as KeyTarget | null, document, isHeroTurn ? legal : null)
    if (!intent) return
    e.preventDefault()
    if (intent === 'help') return openKeys()
    if (intent === 'sizer') openSizer()
    else act({ type: intent })
  })

  const keysList = <TableKeysDialog open={keysOpen} onOpenChange={setKeysOpen} />

  // Match the real button row's height exactly (py-4 + text-base = 56px) so the
  // bar appearing/clearing on the hero's turn never resizes the layout — that
  // resize is what nudges the community cards.
  if (!isHeroTurn || !legal) {
    return (
      <>
        <div className="h-[56px]" aria-hidden />
        {keysList}
      </>
    )
  }

  const pot = potSize(hand)
  const isAllIn = raiseTo >= legal.maxRaiseTo

  const preset = (fraction: number) => {
    sound.play('tap')
    setRaiseTo(
      clamp(hand.currentBet + Math.round(pot * fraction), legal.minRaiseTo, legal.maxRaiseTo),
    )
  }
  const maxOut = () => {
    sound.play('tap')
    setRaiseTo(legal.maxRaiseTo)
  }
  const confirmRaise = () => {
    act({ type: legal.canBet ? 'bet' : 'raise', amount: raiseTo })
    setSizerOpen(false)
  }
  const sizerKeys = (e: React.KeyboardEvent) => {
    const intent = sizerIntentFor(e, e.target as KeyTarget)
    if (!intent) return
    e.preventDefault()
    if (intent === 'confirm') confirmRaise()
    else if (intent.preset < PRESETS.length) preset(PRESETS[intent.preset].fraction)
    else maxOut()
  }

  // The draw round: one button, and what it says depends on what you picked.
  // Standing pat is a real decision rather than a no-op, so the button is never
  // disabled — "Stand pat" is the answer when nothing is marked.
  if (legal.canDraw) {
    const count = marked.length
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2"
        >
          <Pill
            tone="primary"
            onClick={() => {
              act({ type: 'draw', discard: [...marked] })
              onDrawn?.()
            }}
          >
            {count === 0 ? 'Stand pat' : `Draw ${count}`}
          </Pill>
        </motion.div>
        {keysList}
      </>
    )
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-2"
      >
        <Pill
          onClick={() => act({ type: 'fold' })}
          tone="ghost"
          shortcut={keyboard ? BUTTON_KEYS.fold : undefined}
        >
          Fold
        </Pill>
        {legal.canCheck ? (
          <Pill
            onClick={() => act({ type: 'check' })}
            shortcut={keyboard ? BUTTON_KEYS.middle : undefined}
          >
            Check
          </Pill>
        ) : (
          <Pill
            onClick={() => act({ type: 'call' })}
            shortcut={keyboard ? BUTTON_KEYS.middle : undefined}
          >
            Call {money(legal.callAmount)}
          </Pill>
        )}
        {(legal.canBet || legal.canRaise) && (
          <Pill
            onClick={openSizer}
            tone="primary"
            shortcut={keyboard ? BUTTON_KEYS.raise : undefined}
          >
            {legal.canBet ? 'Bet' : 'Raise'}
          </Pill>
        )}
      </motion.div>
      {keysList}

      <Dialog open={sizerOpen} onOpenChange={setSizerOpen}>
        <DialogContent
          className="sm:max-w-xs"
          // The slider, so the arrow keys size and Enter confirms straight away.
          initialFocus={keyboard ? slider : undefined}
          onKeyDown={keyboard ? sizerKeys : undefined}
        >
          <DialogHeader>
            <DialogTitle>{legal.canBet ? 'Bet' : 'Raise'}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 pt-1">
            <div className="text-center text-4xl font-semibold tabular-nums">
              {isAllIn ? 'All in' : money(raiseTo)}
            </div>

            <input
              ref={slider}
              type="range"
              min={legal.minRaiseTo}
              max={legal.maxRaiseTo}
              value={raiseTo}
              onChange={(e) => setRaiseTo(Number(e.target.value))}
              aria-label={legal.canBet ? 'Bet size' : 'Raise size'}
              // Without this the slider reads out a bare chip count. Say what
              // the big number above it says.
              aria-valuetext={isAllIn ? 'All in' : money(raiseTo)}
              className="w-full accent-foreground"
            />

            <div className="flex gap-2">
              {PRESETS.map(({ label, fraction }, i) => (
                <button
                  key={label}
                  onClick={() => preset(fraction)}
                  aria-keyshortcuts={keyboard ? SIZER_PRESET_KEYS[i] : undefined}
                  className="relative flex-1 rounded-xl bg-foreground/5 py-2 text-sm font-medium transition hover:bg-foreground/10"
                >
                  {label}
                  {keyboard && <KeyBadge className={ON_PRESET}>{SIZER_PRESET_KEYS[i]}</KeyBadge>}
                </button>
              ))}
              <button
                onClick={maxOut}
                aria-keyshortcuts={keyboard ? SIZER_PRESET_KEYS[PRESETS.length] : undefined}
                className="relative flex-1 rounded-xl bg-foreground/5 py-2 text-sm font-medium transition hover:bg-foreground/10"
              >
                Max
                {keyboard && (
                  <KeyBadge className={ON_PRESET}>{SIZER_PRESET_KEYS[PRESETS.length]}</KeyBadge>
                )}
              </button>
            </div>

            <button
              onClick={confirmRaise}
              data-sizer-confirm
              aria-keyshortcuts={keyboard ? 'Enter' : undefined}
              className="relative w-full rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
            >
              {legal.canBet ? 'Bet' : 'Raise'} {isAllIn ? 'all in' : money(raiseTo)}
              {keyboard && <KeyBadge className={ON_PRIMARY}>Enter</KeyBadge>}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** The sizer's presets, in `SIZER_PRESET_KEYS` order; Max is the fourth. */
const PRESETS = [
  { label: '½', fraction: 0.5 },
  { label: '¾', fraction: 0.75 },
  { label: 'Pot', fraction: 1 },
] as const

/** The badge on the white primary button. */
const ON_PRIMARY = 'bg-primary-foreground/10 text-primary-foreground/60'
/** The badge on the sizer's narrow presets, clear of the label. */
const ON_PRESET = 'right-1 top-1 h-4 min-w-4 text-[0.6rem]'

function Pill({
  children,
  onClick,
  tone = 'default',
  shortcut,
}: {
  children: React.ReactNode
  onClick: () => void
  tone?: 'default' | 'primary' | 'ghost'
  /** The key that presses it, shown in the corner. Keyboard devices only. */
  shortcut?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-keyshortcuts={shortcut}
      className={cn(
        'relative flex-1 rounded-2xl py-4 text-base font-semibold transition active:scale-[0.97]',
        tone === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
        tone === 'default' && 'bg-foreground/[0.08] text-foreground hover:bg-foreground/[0.14]',
        tone === 'ghost' && 'bg-foreground/[0.03] text-muted-foreground hover:bg-foreground/[0.08]',
      )}
    >
      {children}
      {shortcut && (
        <KeyBadge className={tone === 'primary' ? ON_PRIMARY : undefined}>{shortcut}</KeyBadge>
      )}
    </button>
  )
}

'use client'

// "Your games" on Home: every slow game you are in, as a small table, your
// move first. A row you scroll sideways on a phone, a grid on a wider screen.
// Absent until you have one.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { History, X } from 'lucide-react'
import { MiniTable } from '@/components/room/MiniTable'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { devSignedIn, roomsConfigured } from '@/lib/multiplayer/client'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { useRoom } from '@/store/room'
import { useSlowGames, useSlowGamesLive } from '@/store/slowGames'
import { useSync } from '@/store/sync'

export function YourGames({ delay = 0, className }: { delay?: number; className?: string }) {
  const router = useRouter()
  const signedIn = useSync((s) => s.status === 'signed-in') || devSignedIn()
  const on = roomsConfigured() && signedIn
  useSlowGamesLive(on)
  const games = useSlowGames((s) => s.games)
  const dismiss = useSlowGames((s) => s.dismiss)
  // A finished game, tapped: the table or the review of it.
  const [choosing, setChoosing] = useState<string | null>(null)
  if (!on || games.length === 0) return null
  const waiting = games.filter((g) => g.yourTurn).length

  const open = (code: string) => {
    sound.play('tap')
    // You are already sitting at it: straight to the table.
    useRoom.getState().enter(code)
    router.push(`/game/room?code=${code}`)
  }
  const review = (code: string) => {
    sound.play('tap')
    router.push(`/game/review?room=${code}`)
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: 'easeOut' }}
      className={cn('flex flex-col gap-3', className)}
      aria-label="Your games"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Your games</h2>
        {waiting > 0 && (
          <span className="text-sm font-medium tabular-nums text-muted-foreground">
            {waiting === 1 ? '1 move to make' : `${waiting} moves to make`}
          </span>
        )}
      </div>
      <div className="-mx-6 flex snap-x snap-mandatory scroll-px-6 gap-3 overflow-x-auto px-6 pb-2 pt-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
        {games.map((g) => (
          <div
            key={g.code}
            // One game takes the whole width; more leave the next peeking in, to say the row scrolls.
            className={cn('relative shrink-0 md:w-auto', games.length === 1 ? 'w-full' : 'w-[86%]')}
          >
            <MiniTable
              card={g}
              onOpen={() => {
                if (g.phase !== 'finished') return open(g.code)
                sound.play('tap')
                setChoosing(g.code)
              }}
              className="w-full"
            />
            {g.phase === 'playing' && (
              <button
                type="button"
                onClick={() => review(g.code)}
                aria-label="Review this game so far"
                className="absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-full bg-table-shade/80 text-muted-foreground ring-1 ring-foreground/10 transition hover:text-foreground active:scale-90"
              >
                <History className="size-3.5" />
              </button>
            )}
            {(g.phase === 'finished' || g.phase === 'lobby') && (
              <button
                type="button"
                onClick={() => {
                  sound.play('tap')
                  dismiss(g.code)
                }}
                aria-label="Remove this game"
                className="absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-full bg-table-shade/80 text-muted-foreground ring-1 ring-foreground/10 transition hover:text-foreground active:scale-90"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      <Dialog open={choosing !== null} onOpenChange={(o) => !o && setChoosing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>This game is over</DialogTitle>
          </DialogHeader>
          <div className="mt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                const code = choosing
                setChoosing(null)
                if (code) review(code)
              }}
              className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              <History className="size-4" />
              Session review
            </button>
            <button
              type="button"
              onClick={() => {
                const code = choosing
                setChoosing(null)
                if (code) open(code)
              }}
              className="rounded-2xl bg-foreground/[0.08] py-3 font-semibold transition hover:bg-foreground/[0.14]"
            >
              Look at the table
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.section>
  )
}

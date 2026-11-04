'use client'

// The leaderboard (docs/rating.md): the top 100 by Pip Rating, the rows around
// you, and this week's climbers. A face, a name and a rating, nothing else:
// never the Roll. Live: it reloads when a row changes, and every minute anyway.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { PageShell } from '@/components/PageShell'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { trackOnce } from '@/lib/analytics'
import { devSignedIn } from '@/lib/multiplayer/client'
import { bandFor, isProvisional, ratingOf, weekStartOf } from '@/lib/rating'
import { ratingEnabled } from '@/lib/rating/local'
import { type Board, type BoardRow, readBoard, watchBoard } from '@/lib/rating/remote'
import { useHydrated } from '@/lib/useHydrated'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { useProfile } from '@/store/profile'
import { useSync } from '@/store/sync'

type Tab = 'top' | 'around' | 'climbers'

export function LeaderboardScreen() {
  const router = useRouter()
  const hydrated = useHydrated()
  const signedIn = useSync((s) => s.status === 'signed-in') || devSignedIn()
  const ready = useSync((s) => s.ready) || devSignedIn()
  const [board, setBoard] = useState<Board | null>(null)
  const [failed, setFailed] = useState(false)
  const [tab, setTab] = useState<Tab>('top')

  useEffect(() => trackOnce('leaderboard-opened'), [])

  const load = useCallback(() => {
    void readBoard(weekStartOf(Date.now())).then((b) => {
      if (b) setBoard(b)
      setFailed(!b)
    })
  }, [])

  useEffect(() => {
    if (!ratingEnabled()) return
    let stop = () => {}
    let cancelled = false
    const first = setTimeout(load, 0)
    const every = setInterval(load, 60_000)
    void watchBoard(load).then((s) => {
      if (cancelled) s()
      else stop = s
    })
    return () => {
      cancelled = true
      clearTimeout(first)
      clearInterval(every)
      stop()
    }
  }, [load])

  return (
    <PageShell leading="back" backLabel="Back" onBack={() => router.push('/game')}>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">By Pip Rating. Updated live.</p>
        </header>

        {!ratingEnabled() ? (
          <p className="text-sm text-muted-foreground">The leaderboard is not open yet.</p>
        ) : (
          <>
            {hydrated && ready && !signedIn && <GuestCard />}
            <Tabs tab={tab} onPick={setTab} />
            {failed && !board ? (
              <p className="text-sm text-muted-foreground">The leaderboard could not be reached.</p>
            ) : !board ? (
              <Rows rows={null} />
            ) : tab === 'top' ? (
              <Rows rows={board.top} />
            ) : tab === 'climbers' ? (
              board.climbers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nobody has climbed yet this week.</p>
              ) : (
                <Rows rows={board.climbers} climb />
              )
            ) : board.around ? (
              <Rows
                rows={board.around.rows}
                firstPlace={board.around.firstPlace}
                you={board.around.place}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {signedIn
                  ? 'You are not on the leaderboard yet. Play a few hands, or check you are not hidden in your rating.'
                  : 'Make an account to join the leaderboard.'}
              </p>
            )}
          </>
        )}
      </div>
    </PageShell>
  )
}

const TABS: { value: Tab; label: string }[] = [
  { value: 'top', label: 'Top 100' },
  { value: 'around', label: 'Around you' },
  { value: 'climbers', label: 'This week' },
]

function Tabs({ tab, onPick }: { tab: Tab; onPick: (tab: Tab) => void }) {
  return (
    <div role="tablist" className="grid grid-cols-3 gap-1 rounded-2xl bg-foreground/[0.05] p-1">
      {TABS.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={tab === t.value}
          onClick={() => {
            sound.play('tap')
            onPick(t.value)
          }}
          className="relative min-h-10 rounded-xl text-sm font-medium transition"
        >
          {tab === t.value && (
            <motion.span
              layoutId="leaderboard-tab"
              className="absolute inset-0 rounded-xl bg-foreground/[0.1] shadow-sm shadow-black/30"
              transition={{ type: 'spring', stiffness: 500, damping: 36 }}
            />
          )}
          <span className={cn('relative', tab !== t.value && 'text-muted-foreground')}>
            {t.label}
          </span>
        </button>
      ))}
    </div>
  )
}

/** A guest's own number, on this device only. */
function GuestCard() {
  const rating = useProfile((s) => s.rating)
  const value = ratingOf(rating.core)
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4">
      <div>
        <p className="text-xs text-muted-foreground">Your Pip Rating, on this device</p>
        <p className="text-2xl font-semibold tabular-nums">
          {value.toLocaleString('en-GB')}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {isProvisional(rating.core.decisions) ? 'Provisional' : bandFor(value)}
          </span>
        </p>
      </div>
      <Link
        href="/game?account=new"
        className="shrink-0 rounded-xl border border-foreground/15 px-3 py-2.5 text-center text-sm font-medium transition hover:bg-foreground/[0.06]"
      >
        Make an account to join the leaderboard
      </Link>
    </div>
  )
}

function Rows({
  rows,
  climb = false,
  firstPlace = 1,
  you,
}: {
  rows: BoardRow[] | null
  climb?: boolean
  firstPlace?: number
  you?: number
}) {
  if (!rows) {
    return (
      <ul className="flex flex-col gap-2" aria-busy>
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="h-14 animate-pulse rounded-2xl bg-foreground/[0.04]" />
        ))}
      </ul>
    )
  }
  return (
    <ol className="flex flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02]">
      {rows.map((row, i) => {
        const place = firstPlace + i
        const mine = you !== undefined && place === you
        return (
          <motion.li
            key={row.userId}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 12) * 0.02, duration: 0.25 }}
            className={cn(
              'flex min-h-14 items-center gap-3 border-b border-foreground/[0.06] px-3 py-2 last:border-b-0',
              mine && 'bg-pip/10',
            )}
          >
            <span
              className={cn(
                'w-8 shrink-0 text-center text-sm font-semibold tabular-nums',
                !climb && place <= 3 ? 'text-streak' : 'text-muted-foreground',
              )}
            >
              {climb ? i + 1 : place}
            </span>
            {row.avatar ? (
              <PlayerAvatar spec={row.avatar} size={36} />
            ) : (
              <span className="size-9 shrink-0 rounded-full bg-foreground/[0.08]" />
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {row.name}
              {mine && <span className="ml-1.5 text-xs text-muted-foreground">You</span>}
            </span>
            <span className="text-right tabular-nums">
              <span className="block text-sm font-semibold">
                {row.rating.toLocaleString('en-GB')}
              </span>
              {climb && <span className="block text-xs text-emerald-500">▲{row.weekGain}</span>}
            </span>
          </motion.li>
        )
      })}
    </ol>
  )
}

'use client'

// The open tables on Multiplayer: rooms their hosts opened to anybody, waiting
// for the deal with a chair free (lib/multiplayer/openTables.ts). One tap goes
// to the ordinary join screen, which checks the buy-in and seats you.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ChevronRight, Clock } from 'lucide-react'
import { VenueArt } from '@/components/menu/VenueArt'
import { Face } from '@/components/social/parts'
import { venueById } from '@/config/venues'
import { fetchOpenTables } from '@/lib/multiplayer/client'
import type { OpenTable } from '@/lib/multiplayer/openTables'
import { sound } from '@/lib/sound'
import { useMoney } from '@/lib/useMoney'

/** How often the list is asked again while the page is open and in front. */
const REFRESH_MS = 15_000

type Row = OpenTable & { yours: boolean }

export function OpenTables() {
  const money = useMoney()
  const [tables, setTables] = useState<Row[] | null | 'failed'>(null)

  useEffect(() => {
    let live = true
    const load = () => {
      if (document.visibilityState !== 'visible') return
      void fetchOpenTables().then((t) => {
        if (live) setTables((before) => t ?? (before === null ? 'failed' : before))
      })
    }
    load()
    const timer = setInterval(load, REFRESH_MS)
    document.addEventListener('visibilitychange', load)
    return () => {
      live = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', load)
    }
  }, [])

  return (
    <section className="flex flex-col gap-3" aria-label="Open tables">
      <h2 className="text-lg font-semibold tracking-tight">Open tables</h2>
      {tables === null ? (
        <div className="h-20 animate-pulse rounded-2xl bg-foreground/[0.04]" aria-busy />
      ) : tables === 'failed' ? (
        <p className="rounded-2xl bg-foreground/[0.04] px-4 py-5 text-center text-sm text-muted-foreground">
          Couldn’t reach the tables. Try again in a moment.
        </p>
      ) : tables.length === 0 ? (
        <p className="rounded-2xl bg-foreground/[0.04] px-4 py-5 text-center text-sm text-muted-foreground">
          No open tables right now.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tables.map((t, i) => {
            const venue = venueById(t.venueId)
            const seated = t.people + t.bots
            return (
              <motion.li
                key={t.code}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 6) * 0.03, duration: 0.25, ease: 'easeOut' }}
              >
                <Link
                  href={`/game/room?code=${t.code}`}
                  onClick={() => sound.play('tap')}
                  className="flex min-h-16 items-center gap-3 overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.03] pr-4 transition hover:bg-foreground/[0.06] active:scale-[0.99]"
                >
                  <span className="relative h-16 w-20 shrink-0 self-stretch overflow-hidden">
                    <VenueArt
                      id={t.venueId}
                      accent={venue?.accent ?? '#7C8CF0'}
                      className="absolute inset-0 size-full"
                    />
                    <span className="absolute inset-0 grid place-items-center bg-black/25">
                      <Face avatar={t.host.avatar} ring={t.host.ring} size={36} />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 py-2">
                    <span className="flex items-center gap-1.5 truncate font-medium">
                      {t.yours ? 'Your table' : `${t.host.name}’s table`}
                      {t.kind === 'slow' && (
                        <Clock
                          aria-label="Slow game"
                          className="size-3.5 shrink-0 text-muted-foreground"
                        />
                      )}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground tabular-nums">
                      {venue?.name ?? 'Ladder'} ·{' '}
                      {t.forRoll ? `${money(t.buyIn)} buy-in` : 'For fun'}
                      {t.kind === 'slow' && t.moveHours ? ` · ${t.moveHours}h a move` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
                    {seated}/{t.maxSeats}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </motion.li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RollGraph } from '@/components/RollGraph'
import { useProfile } from '@/store/profile'
import { VENUES, KITCHEN_TABLE } from '@/config/venues'
import { useMoney } from '@/lib/useMoney'

/** Lifetime stats — the story of the grind, told quietly. */
export function StatsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { roll, stats, rollHistory, venueRecords } = useProfile()
  const money = useMoney()

  const winRate = stats.handsPlayed > 0 ? Math.round((stats.handsWon / stats.handsPlayed) * 100) : null
  const min = rollHistory.length > 0 ? Math.min(...rollHistory.map((p) => p.roll)) : null
  const max = rollHistory.length > 0 ? Math.max(...rollHistory.map((p) => p.roll)) : null

  const playedVenues = [...VENUES, KITCHEN_TABLE].filter((v) => (venueRecords[v.id]?.entered ?? 0) > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Stats</DialogTitle>
          <DialogDescription>The story of your grind.</DialogDescription>
        </DialogHeader>

        <div className="-mx-1.5 flex max-h-[65vh] flex-col gap-6 overflow-y-auto px-1.5 py-1">
          {/* the Roll, over time */}
          <section>
            <div className="flex items-baseline justify-between">
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Your Roll</p>
              <p className="text-2xl font-semibold tabular-nums">{money(roll)}</p>
            </div>
            {rollHistory.length >= 2 ? (
              <div className="mt-2">
                <RollGraph points={rollHistory} className="h-32 w-full" />
                <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground/70">
                  <span>low {money(min!)}</span>
                  <span>high {money(max!)}</span>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex h-32 items-center justify-center rounded-2xl bg-foreground/[0.03]">
                <p className="text-sm text-muted-foreground">
                  Play a few games and your story starts here.
                </p>
              </div>
            )}
          </section>

          {/* the numbers */}
          <section className="grid grid-cols-2 gap-2.5">
            <StatCard label="Hands played" value={stats.handsPlayed.toLocaleString()} />
            <StatCard
              label="Hands won"
              value={stats.handsWon.toLocaleString()}
              detail={winRate !== null ? `${winRate}%` : undefined}
            />
            <StatCard label="Biggest pot" value={money(stats.biggestPot)} />
            <StatCard
              label="Tournaments won"
              value={stats.tournamentsWon.toLocaleString()}
              detail={stats.tournamentsEntered > 0 ? `of ${stats.tournamentsEntered}` : undefined}
            />
          </section>

          {/* per-venue records */}
          {playedVenues.length > 0 && (
            <section>
              <p className="mb-2.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Venues
              </p>
              <div className="flex flex-col gap-1">
                {playedVenues.map((venue) => {
                  const rec = venueRecords[venue.id]!
                  return (
                    <div key={venue.id} className="flex items-center gap-2.5 rounded-xl px-1 py-1.5">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: venue.accent }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">{venue.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {rec.won > 0
                          ? `${rec.won} ${rec.won === 1 ? 'win' : 'wins'}`
                          : rec.bestFinish !== null
                            ? `best ${ordinal(rec.bestFinish)}`
                            : `played ${rec.entered}`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StatCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl bg-foreground/[0.04] p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {value}
        {detail && <span className="ml-1.5 text-sm font-medium text-muted-foreground">{detail}</span>}
      </p>
    </div>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

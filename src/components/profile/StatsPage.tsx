'use client'

import { motion } from 'framer-motion'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { PageShell } from '@/components/PageShell'
import { RollGraph } from '@/components/RollGraph'
import { CountUp } from '@/components/CountUp'
import { PlayStyleChart } from './PlayStyleChart'
import { useProfile } from '@/store/profile'
import { VENUES, SIDE_TABLES, KITCHEN_TABLE } from '@/config/venues'
import { rankFor } from '@/config/ranks'
import { derivePlayStyle } from '@/lib/playStyle'
import { accentFromSwatch } from '@/lib/avatar'
import { useMoney } from '@/lib/useMoney'
import { cn } from '@/lib/utils'

const ALL_VENUES = [...VENUES, ...SIDE_TABLES, KITCHEN_TABLE]

/** Lifetime stats — a full-page bento, the play-style quadrant at its centre. */
export function StatsPage() {
  const { name, avatar, roll, peakRoll, stats, rollHistory, venueRecords, tendencies } =
    useProfile()
  const money = useMoney()

  const style = derivePlayStyle(tendencies)
  const rank = rankFor(peakRoll)
  // The charts glow in the player's own colour — a darker take on their avatar swatch.
  const accent = avatar ? accentFromSwatch(avatar.backgroundColor) : 'var(--color-pip)'

  const winRate =
    stats.handsPlayed > 0 ? Math.round((stats.handsWon / stats.handsPlayed) * 100) : null
  const showdownRate =
    tendencies.showdowns > 0 ? Math.round((stats.showdownsWon / tendencies.showdowns) * 100) : null
  const tourneyRate =
    stats.tournamentsEntered > 0
      ? Math.round((stats.tournamentsWon / stats.tournamentsEntered) * 100)
      : null

  const min = rollHistory.length > 0 ? Math.min(...rollHistory.map((p) => p.roll)) : null
  const max = rollHistory.length > 0 ? Math.max(...rollHistory.map((p) => p.roll)) : null

  const playedVenues = ALL_VENUES.filter((v) => (venueRecords[v.id]?.entered ?? 0) > 0)
  const favourite = playedVenues
    .slice()
    .sort((a, b) => (venueRecords[b.id]?.entered ?? 0) - (venueRecords[a.id]?.entered ?? 0))[0]

  return (
    <PageShell leading="back">
      {/* masthead — identity on the left, peak on the right */}
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex flex-wrap items-center justify-between gap-6"
      >
        <div className="flex items-center gap-4">
          {avatar && <PlayerAvatar spec={avatar} size={64} />}
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              The story so far
            </p>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{name}</h1>
            <p className="text-sm text-muted-foreground">{rank.name}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Peak Roll</p>
          <CountUp
            value={peakRoll}
            format={money}
            className="text-3xl font-semibold tracking-tight tabular-nums md:text-4xl"
          />
        </div>
      </motion.header>

      {/* bento */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4, ease: 'easeOut' }}
        className="grid gap-4 lg:grid-cols-3"
      >
        {/* play style — the centrepiece, full-height on the left */}
        <Card className="flex flex-col lg:col-span-1">
          <CardLabel>Your play style</CardLabel>
          <PlayStyleChart style={style} className="mt-3" accent={accent} />
          {style.ready ? (
            <>
              <div className="mt-4 text-center">
                <p className="text-xl font-semibold" style={{ color: accent }}>
                  {style.name}
                </p>
                <p className="mx-auto mt-1 max-w-xs text-sm leading-snug text-muted-foreground">
                  {style.blurb}
                </p>
              </div>
              <div className="mt-auto grid grid-cols-3 gap-2 pt-5">
                <Mini label="Hands" value={`${Math.round(style.looseness * 100)}%`} sub="VPIP" />
                <Mini
                  label="Aggression"
                  value={`${Math.round(style.aggression * 100)}%`}
                  sub="bet/call"
                />
                <Mini
                  label="Fold to bet"
                  value={`${Math.round(style.foldToBet * 100)}%`}
                  sub="discipline"
                />
              </div>
            </>
          ) : (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {Math.max(0, 20 - style.hands)} more hands and your style earns a name.
            </p>
          )}
        </Card>

        {/* right column: roll graph over a grid of numbers */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <div className="flex items-baseline justify-between">
              <CardLabel>Your Roll</CardLabel>
              <p className="text-2xl font-semibold tabular-nums">{money(roll)}</p>
            </div>
            {rollHistory.length >= 2 ? (
              <div className="mt-3">
                <RollGraph
                  points={rollHistory}
                  format={money}
                  className="h-40 w-full"
                  accent={accent}
                />
                <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground/70">
                  <span>low {money(min!)}</span>
                  <span>high {money(max!)}</span>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex h-40 items-center justify-center rounded-xl bg-foreground/[0.03]">
                <p className="text-sm text-muted-foreground">
                  Win a few, lose a few. Your story starts here.
                </p>
              </div>
            )}
          </Card>

          <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="Hands played" value={stats.handsPlayed.toLocaleString()} />
            <Stat
              label="Hands won"
              value={stats.handsWon.toLocaleString()}
              detail={winRate !== null ? `${winRate}%` : undefined}
            />
            <Stat
              label="Showdowns won"
              value={stats.showdownsWon.toLocaleString()}
              detail={showdownRate !== null ? `${showdownRate}%` : undefined}
            />
            <Stat label="Biggest pot" value={money(stats.biggestPot)} />
            <Stat
              label="Tournaments won"
              value={stats.tournamentsWon.toLocaleString()}
              detail={tourneyRate !== null ? `${tourneyRate}%` : undefined}
            />
            <Stat label="Best rank" value={rank.name} />
          </div>
        </div>
      </motion.div>

      {/* venues — full-width footer */}
      {playedVenues.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
          className="mt-4"
        >
          <Card>
            <div className="mb-3 flex items-baseline justify-between">
              <CardLabel>Venues</CardLabel>
              {favourite && (
                <p className="text-xs text-muted-foreground/70">
                  Most played · <span className="text-muted-foreground">{favourite.name}</span>
                </p>
              )}
            </div>
            <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              {playedVenues.map((venue) => {
                const rec = venueRecords[venue.id]!
                return (
                  <div key={venue.id} className="flex items-center gap-2.5 py-1.5">
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
          </Card>
        </motion.section>
      )}
    </PageShell>
  )
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5', className)}
    >
      {children}
    </div>
  )
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{children}</p>
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex flex-col justify-center rounded-2xl bg-foreground/[0.04] p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {value}
        {detail && (
          <span className="ml-1.5 text-sm font-medium text-muted-foreground">{detail}</span>
        )}
      </p>
    </div>
  )
}

function Mini({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-foreground/[0.04] px-2 py-2.5 text-center">
      <p className="text-lg font-semibold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="text-[10px] text-muted-foreground/60">{sub}</p>
    </div>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

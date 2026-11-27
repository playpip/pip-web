'use client'

// A list of games (docs/games.md): yours, or a player's who shows theirs. Each
// row opens the game on the felt at `/game/review?game=…`. The full page has
// the kinds to filter by and more to load; the profile shows the latest few.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Loader2 } from 'lucide-react'
import {
  GAME_KINDS,
  GAMES_PAGE,
  type GameKind,
  type GameRow,
  listGames,
  resultOf,
} from '@/lib/games/api'
import { sound } from '@/lib/sound'
import { useMoney } from '@/lib/useMoney'
import { cn } from '@/lib/utils'

export const gameHref = (id: string) => `/game/review?game=${encodeURIComponent(id)}`

export const gamesHref = (handle: string | null) =>
  handle ? `/game/games?h=${encodeURIComponent(handle)}` : '/game/games'

/**
 * Loads and draws the games. `limit` shows that many and no filters, for the
 * profile. Renders nothing for a player who keeps their games to themselves.
 */
export function GameList({
  handle,
  limit,
  empty,
  hidden,
}: {
  handle: string | null
  limit?: number
  /** What to say when there are none. */
  empty: string
  /** What to say when the player keeps them to themselves. Nothing, without it. */
  hidden?: string
}) {
  const [games, setGames] = useState<GameRow[] | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [more, setMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [kind, setKind] = useState<GameKind | 'all'>('all')

  const load = useCallback(
    async (before: number | null) => {
      setLoading(true)
      const page = await listGames(handle, before)
      setLoading(false)
      if (page === undefined) {
        setFailed(true)
        return
      }
      setFailed(false)
      if (page === null) {
        setGames(null)
        return
      }
      setMore(page.length >= GAMES_PAGE)
      setGames((prior) => (before === null || !prior ? page : [...prior, ...page]))
    },
    [handle],
  )

  useEffect(() => {
    const first = setTimeout(() => void load(null), 0)
    return () => clearTimeout(first)
  }, [load])

  if (games === null) {
    return hidden ? (
      <p className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-4 py-5 text-sm text-muted-foreground">
        {hidden}
      </p>
    ) : null
  }
  if (games === undefined) {
    if (failed) {
      return <p className="py-6 text-center text-sm text-muted-foreground">Couldn’t reach Pip.</p>
    }
    return (
      <div className="flex flex-col gap-2" aria-busy>
        {Array.from({ length: limit ?? 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-foreground/[0.04]" />
        ))}
      </div>
    )
  }

  const shown = (kind === 'all' ? games : games.filter((g) => g.kind === kind)).slice(
    0,
    limit ?? Number.POSITIVE_INFINITY,
  )
  // Only the kinds this list has in it.
  const kinds = GAME_KINDS.filter((k) => k.id === 'all' || games.some((g) => g.kind === k.id))

  return (
    <div className="flex flex-col gap-3">
      {limit === undefined && kinds.length > 2 && (
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {kinds.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => {
                sound.play('tap')
                setKind(k.id)
              }}
              aria-pressed={kind === k.id}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition',
                kind === k.id
                  ? 'bg-foreground/[0.1] text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-4 py-5 text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="divide-y divide-foreground/[0.07] overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.03]">
          {shown.map((g) => (
            <li key={g.id}>
              <GameRowLink game={g} />
            </li>
          ))}
        </ul>
      )}

      {limit === undefined && more && games.length > 0 && (
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            sound.play('tap')
            void load(games[games.length - 1].startedAt)
          }}
          className="mx-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-60"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          More games
        </button>
      )}
    </div>
  )
}

function GameRowLink({ game }: { game: GameRow }) {
  const money = useMoney()
  const result = resultOf(game, money)
  return (
    <Link
      href={gameHref(game.id)}
      onClick={() => sound.play('tap')}
      className="flex items-center gap-3 px-4 py-3 transition hover:bg-foreground/[0.04]"
    >
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: game.accent }}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{game.title}</span>
        <span className="block text-xs text-muted-foreground tabular-nums">
          {when(game.startedAt)} · {game.hands === 1 ? '1 hand' : `${game.hands} hands`}
        </span>
      </span>
      <span
        className={cn(
          'shrink-0 text-sm font-semibold tabular-nums',
          result.tone === 'good'
            ? 'text-emerald-500'
            : result.tone === 'bad'
              ? 'text-suit-red'
              : 'text-muted-foreground',
        )}
      >
        {result.text}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
    </Link>
  )
}

/** "Today 14:05", "Yesterday", "3 Nov", "3 Nov 2025". */
function when(at: number): string {
  const d = new Date(at)
  const now = new Date()
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((day(now) - day(d)) / 86_400_000)
  if (days === 0) {
    return `Today ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
  }
  if (days === 1) return 'Yesterday'
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  })
}

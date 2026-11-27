'use client'

// `/game/games`: every game you have played on this account, or (`?h=`) every
// game a player shows on their profile (docs/games.md).

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { useHydrated } from '@/lib/useHydrated'
import { useSync } from '@/store/sync'
import { GameList } from './GameList'

export function GamesScreen() {
  const router = useRouter()
  const handle = useSearchParams().get('h')
  const hydrated = useHydrated()
  const signedIn = useSync((s) => s.status === 'signed-in')
  const ready = useSync((s) => s.ready)

  const body = () => {
    if (!hydrated || !ready) {
      return <div className="h-64 animate-pulse rounded-2xl bg-foreground/[0.04]" aria-busy />
    }
    if (!signedIn) {
      return (
        <div className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4">
          <p className="text-sm">Make an account to keep your games.</p>
          <Link
            href="/game?account=new"
            className="rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground"
          >
            Make an account
          </Link>
        </div>
      )
    }
    return (
      <GameList
        key={handle ?? ''}
        handle={handle}
        empty={handle ? 'No games yet.' : 'Play a table and your games show up here.'}
        hidden="This player doesn’t show their games."
      />
    )
  }

  return (
    <PageShell leading="back" backLabel="Back" onBack={() => router.back()}>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <div className="px-1">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {handle ? 'Games' : 'Game history'}
          </h1>
          {handle && <p className="mt-1 text-muted-foreground">@{handle}</p>}
        </div>
        {body()}
      </div>
    </PageShell>
  )
}

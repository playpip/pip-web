'use client'

// `/game/player?h=handle`: one player's public profile (docs/social.md). The
// card itself is `PlayerView`, shared with the Friends page on a wide screen.

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { socialEnabled } from '@/lib/social/api'
import { useHydrated } from '@/lib/useHydrated'
import { useSync } from '@/store/sync'
import { PlayerView } from './PlayerView'

export function PlayerScreen() {
  const router = useRouter()
  const handle = useSearchParams().get('h') ?? ''
  const hydrated = useHydrated()
  const signedIn = useSync((s) => s.status === 'signed-in')
  const ready = useSync((s) => s.ready)

  const body = () => {
    if (!socialEnabled()) {
      return <p className="text-sm text-muted-foreground">Profiles aren’t open yet.</p>
    }
    if (!hydrated || !ready) {
      return (
        <div className="h-[28rem] animate-pulse rounded-[2rem] bg-foreground/[0.04]" aria-busy />
      )
    }
    if (!signedIn) {
      return (
        <div className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4">
          <p className="text-sm">Make an account to see players’ profiles.</p>
          <Link
            href="/game?account=new"
            className="rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground"
          >
            Make an account
          </Link>
        </div>
      )
    }
    if (!handle) return <p className="text-sm text-muted-foreground">That player isn’t here.</p>
    return <PlayerView key={handle} handle={handle} />
  }

  return (
    <PageShell leading="back" backLabel="Back" onBack={() => router.back()}>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">{body()}</div>
    </PageShell>
  )
}

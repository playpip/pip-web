'use client'

// Ten Hands (config/quickGames): ten fast hands of Hold'em against the
// regulars, from 1,000 chips, and what you finish with is the score.
//
// The hands are the real table (`TEN_HANDS` in config/venues, a cash table
// with `scoreHands`), so everything a player knows about the felt holds. The
// chips are the house's: nothing leaves the Roll to sit down and nothing comes
// back to it, so a good round is a best and never a bankroll. This page
// decides who may sit and spends the free round; the table itself is told
// nothing about the membership, as everywhere (tests/membershipSurfaces).

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Splash } from '@/components/Splash'
import { Table } from '@/components/table/Table'
import { useRequireProfile } from '@/components/menu/useRequireProfile'
import { quickGame } from '@/config/quickGames'
import { TEN_HANDS } from '@/config/venues'
import { useQuickRound } from '@/lib/useQuickRound'
import { formatChips } from '@/lib/useMoney'
import { useMembership } from '@/store/entitlement'
import { loadTableSnapshot, useGame } from '@/store/game'
import { useProfile } from '@/store/profile'
import { QuickEnd, QuickEndOverlay, QuickIntro, QuickPage, type StartOption } from './QuickScreen'

const START = TEN_HANDS.startingStack ?? 1_000

function sitDown() {
  const profile = useProfile.getState()
  if (!profile.avatar) return
  useGame.getState().leave()
  useGame.getState().sitDown(TEN_HANDS, {
    name: profile.name,
    avatar: profile.avatar,
    member: useMembership.getState().member,
  })
}

export function TenHands() {
  const ready = useRequireProfile()
  const router = useRouter()
  const game = quickGame(TEN_HANDS.id)
  const view = useQuickRound(TEN_HANDS.id)
  const atTable = useGame((s) => s.venue?.id === TEN_HANDS.id && s.status !== 'idle')
  const score = useGame((s) => (s.status === 'scored' ? s.score : null))

  // A refresh mid-round comes back to the same hand, chips intact, without
  // spending another round. Once the round is over, leaving the page stands up.
  useEffect(() => {
    const snapshot = loadTableSnapshot()
    if (useGame.getState().status === 'idle' && snapshot?.venueId === TEN_HANDS.id) {
      useGame.getState().resumeTable(TEN_HANDS, snapshot, useMembership.getState().member)
    }
    return () => {
      if (useGame.getState().status === 'scored') useGame.getState().leave()
    }
  }, [])

  if (!ready) return <Splash />

  const options: StartOption[] = [{ label: 'Play', start: sitDown }]

  if (!atTable) {
    return (
      <QuickPage game={game}>
        <QuickIntro
          game={game}
          view={view}
          options={options}
          rules={[
            'Hold’em, six at the table, 1,000 chips each.',
            'Blinds 10 and 20, and they never go up. The hands deal fast.',
            'Ten hands, or until your stack is gone.',
            'The chips are the house’s, so your Roll is never at stake.',
          ]}
        />
      </QuickPage>
    )
  }

  return (
    <>
      <Table />
      {score && (
        <QuickEndOverlay>
          <QuickEnd
            game={game}
            score={score.chips}
            bestBefore={score.bestBefore}
            view={view}
            again={options}
            onBack={() => {
              useGame.getState().leave()
              router.push('/game/side')
            }}
          >
            <Result chips={score.chips} />
          </QuickEnd>
        </QuickEndOverlay>
      )}
    </>
  )
}

/** Started with, finished with, and the difference. */
function Result({ chips }: { chips: number }) {
  const diff = chips - START
  const rows = [
    ['Started with', formatChips(START)],
    ['Finished with', formatChips(chips)],
    [diff >= 0 ? 'Up' : 'Down', formatChips(Math.abs(diff))],
  ]
  return (
    <ul className="divide-y divide-foreground/[0.06] rounded-2xl bg-foreground/[0.03] ring-1 ring-foreground/10">
      {rows.map(([label, value]) => (
        <li key={label} className="flex items-center justify-between px-3.5 py-2.5 text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-semibold tabular-nums">{value}</span>
        </li>
      ))}
    </ul>
  )
}

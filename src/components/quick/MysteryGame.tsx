'use client'

// Mystery Card (config/quickGames): Hold'em where one of your two cards is
// dealt face down, to you too, and turns over when the river lands. Ten hands
// against the regulars from 1,000 chips; what you finish with is the score.
//
// The same frame as Ten Hands: the real table (`MYSTERY_TABLE`, a score table
// with `mystery` set), the house's chips, and this page deciding who may sit
// and spending the free round. The table is told nothing about membership.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Splash } from '@/components/Splash'
import { Table } from '@/components/table/Table'
import { useRequireProfile } from '@/components/menu/useRequireProfile'
import { quickGame } from '@/config/quickGames'
import { MYSTERY_TABLE } from '@/config/venues'
import { useQuickRound } from '@/lib/useQuickRound'
import { formatChips } from '@/lib/useMoney'
import { useMembership } from '@/store/entitlement'
import { loadTableSnapshot, useGame } from '@/store/game'
import { useProfile } from '@/store/profile'
import { QuickEnd, QuickIntro, QuickPage, type StartOption } from './QuickScreen'

const START = MYSTERY_TABLE.startingStack ?? 1_000

function sitDown() {
  const profile = useProfile.getState()
  if (!profile.avatar) return
  useGame.getState().leave()
  useGame.getState().sitDown(MYSTERY_TABLE, {
    name: profile.name,
    avatar: profile.avatar,
    member: useMembership.getState().member,
  })
}

export function MysteryGame() {
  const ready = useRequireProfile()
  const router = useRouter()
  const game = quickGame(MYSTERY_TABLE.id)
  const view = useQuickRound(MYSTERY_TABLE.id)
  const atTable = useGame((s) => s.venue?.id === MYSTERY_TABLE.id && s.status !== 'idle')
  const score = useGame((s) => (s.status === 'scored' ? s.score : null))

  // A refresh mid-round comes back to the same hand, chips intact, without
  // spending another round. Once the round is over, leaving the page stands up.
  useEffect(() => {
    const snapshot = loadTableSnapshot()
    if (useGame.getState().status === 'idle' && snapshot?.venueId === MYSTERY_TABLE.id) {
      useGame.getState().resumeTable(MYSTERY_TABLE, snapshot, useMembership.getState().member)
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
        <div className="flex flex-col gap-5">
          <QuickIntro game={game} view={view} options={options} />
          <ul className="mx-auto w-full max-w-md list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>Hold’em, six at the table, 1,000 chips each.</li>
            <li>One of your two cards is dealt face down. Nobody sees it, you included.</li>
            <li>It turns over when the river is dealt. Everyone else’s does too.</li>
            <li>Ten hands. Your score is the chips you finish with.</li>
          </ul>
        </div>
      </QuickPage>
    )
  }

  return (
    <>
      <Table />
      {score && (
        // A beat on the last hand's result, then the score over the table.
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.35 }}
          className="fixed inset-0 z-50 overflow-y-auto bg-background/75 px-4 py-10 backdrop-blur-md"
        >
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
        </motion.div>
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

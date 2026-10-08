'use client'

/**
 * The lobby's "Getting started" checklist, for a player who came in through
 * the welcome flow: the steps that make Pip theirs, ticked as they happen and
 * one tap from each. Gone once every step is done or the player puts it away.
 * Players from before the welcome flow have it put away (profile v25).
 */

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Check, ChevronRight, X } from 'lucide-react'
import { AccountDialog } from '@/components/settings/AccountDialog'
import { playedWelcome } from '@/components/onboarding/firstSeat'
import { WELCOME_TABLE } from '@/config/venues'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'
import { useProfile } from '@/store/profile'
import { useSync } from '@/store/sync'

interface Item {
  id: string
  label: string
  done: boolean
  href?: string
  onClick?: () => void
}

export function GettingStarted() {
  const dismissed = useProfile((s) => s.gettingStartedDismissed)
  const dismiss = useProfile((s) => s.dismissGettingStarted)
  const venueRecords = useProfile((s) => s.venueRecords)
  const daily = useProfile((s) => s.daily)
  const ready = useSync((s) => s.ready)
  const status = useSync((s) => s.status)
  const [accountOpen, setAccountOpen] = useState(false)

  if (dismissed || !ready) return null

  const items: Item[] = [
    { id: 'player', label: 'Make your player', done: true },
    {
      id: 'first',
      label: 'Play your first game',
      done: playedWelcome(venueRecords),
      href: `/play/${WELCOME_TABLE.id}`,
    },
    ...(status === 'off'
      ? []
      : [
          {
            id: 'save',
            label: 'Save your player with a free account',
            done: status === 'signed-in',
            onClick: () => setAccountOpen(true),
          },
        ]),
    { id: 'daily', label: 'Play today’s Daily', done: daily !== null, href: '/play/daily' },
    {
      id: 'garage',
      label: 'Win Friends’ Garage, the ladder’s first rung',
      done: (venueRecords.garage?.won ?? 0) > 0,
      href: '/play/garage',
    },
  ]
  const doneCount = items.filter((i) => i.done).length
  if (doneCount === items.length) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 w-full max-w-md rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-4"
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-sm font-semibold">Getting started</h2>
          <p className="text-xs text-muted-foreground">
            {doneCount} of {items.length} done
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            sound.play('tap')
            dismiss()
          }}
          aria-label="Hide getting started"
          className="rounded-full p-2 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${(doneCount / items.length) * 100}%` }}
        />
      </div>
      <ul className="mt-3 flex flex-col">
        {items.map((item) => {
          const body = (
            <>
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border',
                  item.done
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-foreground/20',
                )}
              >
                {item.done && <Check className="size-3.5" />}
              </span>
              <span
                className={cn('flex-1 text-sm', item.done && 'text-muted-foreground line-through')}
              >
                {item.label}
              </span>
              {!item.done && <ChevronRight className="size-4 text-muted-foreground" />}
            </>
          )
          const row =
            'flex min-h-11 w-full items-center gap-3 rounded-xl px-1 text-left transition hover:bg-foreground/[0.04]'
          if (item.done) {
            return (
              <li key={item.id} className={cn(row, 'hover:bg-transparent')}>
                {body}
              </li>
            )
          }
          return (
            <li key={item.id}>
              {item.href ? (
                <Link href={item.href} onClick={() => sound.play('tap')} className={row}>
                  {body}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    sound.play('tap')
                    item.onClick?.()
                  }}
                  className={row}
                >
                  {body}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <AccountDialog open={accountOpen} mode="signup" onOpenChange={setAccountOpen} />
    </motion.section>
  )
}

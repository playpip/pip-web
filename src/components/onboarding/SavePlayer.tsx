'use client'

// Step 3 of the welcome flow, "Save your player", and the one time the lobby
// shows it again.
//
// **The lobby's copy is shown once, inline, and never again (2026-11-04).** In
// the week to 1 November 107 players reached the first game and 71 the save
// step: a player who leaves the Welcome Table for the lobby part-way, or closes
// the tab and comes back to the lobby later, skipped it. So the first lobby
// visit after making a player, for a signed-out newcomer who has not seen the
// step, has the step's card in place of the Getting started list. It is part
// of the page, not a pop-up; seeing it once spends it (whether or not it is
// used), as does seeing the step itself, and "Not now" puts it away there and
// then. The Getting started list still carries the account as one of its rows.

import { type ReactNode, useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { AccountDialog } from '@/components/settings/AccountDialog'
import { signupFact } from '@/components/settings/AccountOffer'
import { sound } from '@/lib/sound'
import { useHydrated } from '@/lib/useHydrated'
import { cn } from '@/lib/utils'
import { useProfile } from '@/store/profile'
import { type SyncStatus, useSync } from '@/store/sync'

/** This device has shown the save step, in the flow or on the lobby. */
const OFFERED_KEY = 'pip.welcome.save-offered'

function saveOffered(): boolean {
  try {
    return localStorage.getItem(OFFERED_KEY) !== null
  } catch {
    // Storage blocked: say it was offered, so nothing can repeat.
    return true
  }
}

function markSaveOffered(): void {
  try {
    localStorage.setItem(OFFERED_KEY, '1')
  } catch {
    // Blocked storage: `saveOffered` already reads as offered.
  }
}

const primary =
  'flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground transition enabled:hover:bg-primary/90 enabled:active:scale-[0.98] disabled:opacity-30'

/** Why an account, in three lines. */
const ACCOUNT_REASONS = [
  'Your Roll and your player on every device',
  'Keep your streak, with a reminder if you want one',
  'Needed for the membership, if you ever join',
]

/** The account, offered: where the player lives now, why an account, and the button. */
export function AccountCard({
  status,
  className,
  lead,
}: {
  status: SyncStatus
  className?: string
  /** Above the title: the lobby's copy shows whose player it is. */
  lead?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const accountsOn = status !== 'off'
  return (
    <div
      className={cn('rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-6', className)}
    >
      {lead}
      <p className="text-lg font-semibold">Save your player</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Right now your player lives in this browser only. A free account keeps it safe and on every
        device. It takes a few seconds.
      </p>
      <ul className="mt-4 flex flex-col gap-2 hyphens-auto break-words text-sm text-muted-foreground">
        {ACCOUNT_REASONS.map((line) => (
          <li key={line} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            {line}
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={!accountsOn}
        onClick={() => {
          sound.play('tap')
          setOpen(true)
        }}
        className={cn(primary, 'mt-6')}
      >
        Create a free account
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        {accountsOn ? signupFact() : 'Accounts are not set up in this build.'}
      </p>
      <AccountDialog open={open} mode="signup" onOpenChange={setOpen} />
    </div>
  )
}

/**
 * The lobby's one showing of the save step. Renders `fallback` (the Getting
 * started list or the account offer) unless this is that one showing.
 */
export function LobbySaveOnce({ fallback }: { fallback: ReactNode }) {
  const hydrated = useHydrated()
  const ready = useSync((s) => s.ready)
  const status = useSync((s) => s.status)
  // Put away for players from before the welcome flow (profile v25), so only
  // a newcomer is offered it.
  const newcomer = useProfile((s) => s.created && !s.gettingStartedDismissed)
  if (!hydrated || !ready || status !== 'signed-out' || !newcomer) return fallback
  return <Once fallback={fallback} status={status} />
}

/** Mounted only once the answer is real, so the decision is read once and kept. */
function Once({ fallback, status }: { fallback: ReactNode; status: SyncStatus }) {
  const [show, setShow] = useState(() => !saveOffered())
  const name = useProfile((s) => s.name)
  const avatar = useProfile((s) => s.avatar)
  useEffect(() => {
    if (show) markSaveOffered()
  }, [show])
  if (!show) return fallback
  return (
    <div className="mt-6 w-full max-w-md">
      <AccountCard
        status={status}
        lead={
          avatar && (
            <div className="mb-4 flex items-center gap-3">
              <PlayerAvatar spec={avatar} size={44} />
              <span className="min-w-0 truncate font-medium">{name}</span>
            </div>
          )
        }
      />
      <button
        type="button"
        onClick={() => {
          sound.play('tap')
          setShow(false)
        }}
        className="mt-1 flex min-h-11 w-full items-center justify-center text-sm text-muted-foreground transition hover:text-foreground"
      >
        Not now
      </button>
    </div>
  )
}

/** Shown with the save step, so the lobby knows not to show it. */
export function useMarkSaveOffered(): void {
  useEffect(() => markSaveOffered(), [])
}

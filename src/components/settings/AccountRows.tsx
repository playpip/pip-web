'use client'

// The signed-in account, as rows on Settings. This was a dialog of its own
// ("Manage account") holding four buttons and two small forms; every one of
// them is a setting, so they sit with the rest (Will, 2026-11-10). The forms
// open in place, inside their row.

import { useState } from 'react'
import { ChevronRight, KeyRound, LogOut, RefreshCw } from 'lucide-react'
import { SettingsRow } from '@/components/settings/group'
import { MANAGE_IN_STORE, useMembershipSource } from '@/lib/membership/store'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { useSync } from '@/store/sync'

const field =
  'w-full rounded-xl bg-foreground/[0.04] px-3 py-3 text-base outline-none ring-primary/40 focus:ring-2'
const smallButton =
  'min-h-11 shrink-0 rounded-xl bg-foreground/[0.06] px-4 text-sm font-medium transition hover:bg-foreground/[0.12] active:scale-[0.97] disabled:opacity-40'
const secondaryButton =
  'min-h-11 min-w-[7rem] flex-1 rounded-xl bg-foreground/[0.06] py-3 text-sm font-medium transition hover:bg-foreground/[0.12] disabled:opacity-40'
const rowButton =
  'block w-full text-left transition hover:bg-foreground/[0.04] active:bg-foreground/[0.06] disabled:opacity-60'

/** When it last synced, with a button to do it now. */
export function SyncRow() {
  const { busy, dirty, lastSyncedAt, syncNow } = useSync()
  return (
    <SettingsRow
      icon={RefreshCw}
      tint="blue"
      label="Sync"
      hint={
        dirty ? 'Saving…' : lastSyncedAt ? `Last synced ${when(lastSyncedAt)}.` : 'Not synced yet.'
      }
      control={
        <button
          type="button"
          onClick={() => {
            sound.play('tap')
            void syncNow()
          }}
          disabled={busy}
          className={smallButton}
        >
          Sync now
        </button>
      }
    />
  )
}

/** Change or set the password, the form opening inside the row. */
export function PasswordRow() {
  const [changing, setChanging] = useState(false)
  const [changed, setChanged] = useState(false)
  const { hasPassword, busy, clearError } = useSync()
  const label = hasPassword ? 'Change password' : 'Set a password'

  if (changing)
    return (
      <SettingsRow icon={KeyRound} tint="pip" label={label}>
        <ChangePassword
          onCancel={() => setChanging(false)}
          onSaved={() => {
            setChanged(true)
            setChanging(false)
          }}
        />
      </SettingsRow>
    )

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        sound.play('tap')
        clearError()
        setChanged(false)
        setChanging(true)
      }}
      className={rowButton}
    >
      <SettingsRow
        icon={KeyRound}
        tint="pip"
        label={label}
        hint={changed ? 'Password saved. You’re still signed in here.' : undefined}
        control={<ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
      />
    </button>
  )
}

/** Sign out. The profile on this device stays as it is. */
export function SignOutRow() {
  const { busy, signOut } = useSync()
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        sound.play('tap')
        void signOut()
      }}
      className={rowButton}
    >
      <SettingsRow
        icon={LogOut}
        tint="plain"
        label="Sign out"
        hint="Your profile stays on this device exactly as it is."
      />
    </button>
  )
}

/**
 * Delete the account, behind a confirm that says what goes and what stays.
 * Signed in only. It sits at the foot of Settings beside Reset profile, the
 * other button that cannot be undone.
 */
export function DeleteAccount() {
  const [confirming, setConfirming] = useState(false)
  const signedIn = useSync((s) => s.status === 'signed-in')
  const deleteAccount = useSync((s) => s.deleteAccount)
  const source = useMembershipSource()
  const storeManage = source ? MANAGE_IN_STORE[source] : undefined
  if (!signedIn) return null

  if (!confirming)
    return (
      <button
        type="button"
        onClick={() => {
          sound.play('tap')
          setConfirming(true)
        }}
        className="flex min-h-11 w-full items-center justify-center text-xs text-muted-foreground/70 underline-offset-2 transition hover:text-foreground hover:underline"
      >
        Delete my account and synced data
      </button>
    )

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4">
      <p className="text-xs leading-relaxed">
        This deletes your account and the synced copy of your profile. The profile on this device
        stays exactly as it is. It cannot be undone.
      </p>
      {/* A web membership is cancelled by delete-account. A store one can't
          be: only the player can cancel it, in the store (Apple 5.1.1(v)). */}
      {storeManage && (
        <p className="text-xs leading-relaxed">
          Your membership was bought through the store, so deleting the account doesn’t stop it
          renewing.{' '}
          <a href={storeManage.href} className="font-medium underline underline-offset-2">
            Cancel it there
          </a>{' '}
          first.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            sound.play('tap')
            setConfirming(false)
          }}
          className={secondaryButton}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            sound.play('call')
            void deleteAccount().then((ok) => ok && setConfirming(false))
          }}
          className={cn(secondaryButton, 'text-suit-red')}
        >
          Delete it
        </button>
      </div>
    </div>
  )
}

// No current-password field, deliberately. Supabase's updateUser takes the
// session as the proof, so asking for the old one adds a step on a device that
// already holds a valid session and buys no security. Typing it twice is here
// for a different reason: nothing echoes a password back, so a typo would lock
// the player out of a password they think they know.
function ChangePassword({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [mismatch, setMismatch] = useState(false)
  const { busy, error, updatePassword, clearError } = useSync()

  const submit = async () => {
    sound.play('tap')
    if (next.length < 8) return
    if (next !== again) {
      setMismatch(true)
      return
    }
    if (await updatePassword(next)) onSaved()
  }

  /** Any edit is a fresh attempt: drop whatever the last one complained about. */
  const clearComplaints = () => {
    setMismatch(false)
    if (error) clearError()
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <input
        type="password"
        value={next}
        onChange={(e) => {
          setNext(e.target.value)
          clearComplaints()
        }}
        placeholder="New password"
        autoComplete="new-password"
        aria-label="New password"
        className={field}
      />
      <input
        type="password"
        value={again}
        onChange={(e) => {
          setAgain(e.target.value)
          clearComplaints()
        }}
        onKeyDown={(e) => e.key === 'Enter' && void submit()}
        placeholder="New password again"
        autoComplete="new-password"
        aria-label="New password again"
        className={field}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            sound.play('tap')
            clearError()
            onCancel()
          }}
          disabled={busy}
          className={secondaryButton}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy || next.length < 8 || again.length < 8}
          className={secondaryButton}
        >
          Save it
        </button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground/70">
        At least 8 characters. You stay signed in on this device.
      </p>
      {mismatch && <p className="text-xs leading-relaxed text-suit-red">Those two don’t match.</p>}
      {error && <p className="text-xs leading-relaxed text-suit-red">{error}</p>}
    </div>
  )
}

/** Rough and human. Nobody needs a timestamp for this. */
function when(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

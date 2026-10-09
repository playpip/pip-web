'use client'

// Everything account-shaped lives here, in its own dialog over Settings. The
// forms used to sit inline in the Settings sheet, which made it long and made a
// four-field flow share a scroll with the dark-mode toggle. Same reasoning as
// the QR: a real task gets its own surface rather than a cramped inline panel.
//
// Four modes, one dialog. Signed out it's sign in / create / reset; signed in
// it's the management view. Nothing here nags: it only opens when the player
// presses a button in Settings asking for it.

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FaApple } from 'react-icons/fa'
import { FcGoogle } from 'react-icons/fc'
import { useSync } from '@/store/sync'
import { oauthProviders, type OAuthProvider } from '@/lib/sync/client'
import { EmailSection } from '@/components/settings/EmailSection'
import { ALL_EMAIL, emailReady, rememberOptIn, writeEmailPrefs } from '@/lib/email/prefs'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { MANAGE_IN_STORE, useMembershipSource } from '@/lib/membership/store'

export type AccountMode = 'signin' | 'signup' | 'reset' | 'manage'

// Sizes are touch-first: this ships as an Android app via TWA, so a control
// that is comfortable with a mouse is not the bar. Buttons clear 44px (Apple's
// minimum; Material asks 48). Inputs are 16px because iOS auto-zooms on
// anything smaller, which the viewport currently suppresses with
// `userScalable: false` — a login form shouldn't lean on that.
const field =
  'w-full rounded-xl bg-foreground/[0.04] px-3 py-3 text-base outline-none ring-primary/40 focus:ring-2'
const primaryButton =
  'min-h-11 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40'
const secondaryButtonBase =
  'min-h-11 rounded-xl bg-foreground/[0.06] py-3 text-sm font-medium transition hover:bg-foreground/[0.12] disabled:opacity-40'
// The row variants share a line; the full-width one must not also grow
// vertically, which is what `flex-1` would do to a child of the column.
const secondaryButton = `flex-1 ${secondaryButtonBase}`
const wideSecondaryButton = `w-full ${secondaryButtonBase}`
// A quiet link is still a tap target: 11px text in a 15px-tall box was the
// worst thing in here on a phone.
const textLink =
  'flex min-h-11 items-center justify-center text-xs text-muted-foreground/70 underline-offset-2 transition hover:text-foreground hover:underline'

const PROVIDERS: Record<OAuthProvider, { label: string; icon: React.ReactNode }> = {
  google: { label: 'Continue with Google', icon: <FcGoogle aria-hidden className="size-5" /> },
  apple: { label: 'Continue with Apple', icon: <FaApple aria-hidden className="size-5" /> },
}

const COPY: Record<AccountMode, { title: string; description: string }> = {
  signin: {
    title: 'Sign in',
    description: 'Your progress follows you to any device you sign in on.',
  },
  signup: {
    // "Nothing to confirm" is true because production runs with
    // mailer_autoconfirm on: Supabase Auth sends no confirmation, only a
    // password reset when asked. If that ever changes, this line and the
    // landing page's trust card go with it. (The opt-in emails in docs/email.md
    // confirm nothing either; they are off unless the box below is ticked.)
    title: 'Create a free account',
    description:
      'An email and a password, and nothing to confirm. Your Roll follows you to every device you sign in on.',
  },
  reset: {
    title: 'Reset your password',
    description: 'We’ll email you a link. Your progress on this device is untouched either way.',
  },
  manage: {
    title: 'Your account',
    description: 'Sync, change your password, sign out, or delete it entirely.',
  },
}

export function AccountDialog({
  open,
  mode,
  onOpenChange,
}: {
  open: boolean
  mode: AccountMode
  onOpenChange: (open: boolean) => void
}) {
  const [current, setCurrent] = useState<AccountMode>(mode)
  const status = useSync((s) => s.status)
  const clearError = useSync((s) => s.clearError)

  // Reopening should show what the button asked for, not the last thing shown.
  useEffect(() => {
    if (open) {
      setCurrent(mode)
      clearError()
    }
  }, [open, mode, clearError])

  // Signing in or out from inside the dialog flips it to the other side rather
  // than leaving a stale form behind.
  useEffect(() => {
    if (!open) return
    if (status === 'signed-in') setCurrent('manage')
    else if (current === 'manage') setCurrent('signin')
  }, [status, open, current])

  const copy = COPY[current]
  // With Google or Apple on offer, "an email and a password" is no longer the
  // only way in, so the signup line stops saying it is.
  const description =
    current === 'signup' && oauthProviders().length > 0
      ? 'Use Google, Apple or an email and a password. Nothing to confirm. Your Roll follows you to every device you sign in on.'
      : copy.description

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-1">
          {current === 'manage' ? (
            <Manage onDone={() => onOpenChange(false)} />
          ) : (
            <AuthForm mode={current} setMode={setCurrent} onDone={() => onOpenChange(false)} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AuthForm({
  mode,
  setMode,
  onDone,
}: {
  mode: AccountMode
  setMode: (m: AccountMode) => void
  onDone: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  // Unticked by default, and nothing else in the form leans on it: consent to
  // email has to be its own act (GDPR), not a side effect of making an account.
  const [optIn, setOptIn] = useState(false)
  const { busy, error, signIn, signUp, signInWith, sendReset, clearError } = useSync()
  const providers = mode === 'reset' ? [] : oauthProviders()
  const offerEmail = mode === 'signup' && emailReady()

  const go = (next: AccountMode) => {
    sound.play('tap')
    clearError()
    setSent(false)
    setMode(next)
  }

  const submit = async () => {
    sound.play('tap')
    if (mode === 'reset') {
      setSent(await sendReset(email.trim()))
      return
    }
    const ok =
      mode === 'signin'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password)
    // The account exists before its email switches can: the row is the
    // player's own, so it is written as them, once they are signed in.
    if (ok && offerEmail && optIn) await writeEmailPrefs(ALL_EMAIL)
    // Closing on success is the whole confirmation: the Settings row behind
    // this now says "signed in as …", so a success screen would be a click for
    // nothing.
    if (ok) onDone()
  }

  return (
    <>
      {providers.map((p) => (
        <button
          key={p}
          onClick={() => {
            sound.play('tap')
            // Google and Apple leave the page; the tick has to survive the trip.
            if (offerEmail) rememberOptIn(optIn)
            // On the web this leaves the page. In the store app it signs in
            // where it is, so close on success like the email form does.
            void signInWith(p).then(() => {
              if (useSync.getState().status === 'signed-in') onDone()
            })
          }}
          disabled={busy}
          className={cn(wideSecondaryButton, 'flex items-center justify-center gap-2')}
        >
          {PROVIDERS[p].icon}
          {PROVIDERS[p].label}
        </button>
      ))}
      {providers.length > 0 && (
        <p className="py-1 text-center text-xs text-muted-foreground/70">or with your email</p>
      )}

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void submit()}
        placeholder="Email"
        autoComplete="email"
        aria-label="Email"
        className={field}
      />
      {mode !== 'reset' && (
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          placeholder="Password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          aria-label="Password"
          className={field}
        />
      )}

      {offerEmail && (
        <label className="flex cursor-pointer items-start gap-2.5 py-1 text-xs leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            checked={optIn}
            onChange={(e) => setOptIn(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span>
            Email me when my streak is about to end, and a summary on Mondays. You can turn either
            off in Manage account.
          </span>
        </label>
      )}

      <button
        onClick={submit}
        disabled={busy || !email.trim() || (mode !== 'reset' && password.length < 8)}
        className={primaryButton}
      >
        {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
      </button>

      {mode === 'signup' && (
        <p className="text-xs leading-relaxed text-muted-foreground/70">
          At least 8 characters. We store your email and your profile, nothing else, no tracking,
          and you can delete both from here whenever you like.
        </p>
      )}

      {sent && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Sent. Check your email for the link. It expires after an hour.
        </p>
      )}
      {error && <p className="text-xs leading-relaxed text-suit-red">{error}</p>}

      <div className="flex flex-col items-center">
        {mode === 'signin' && (
          <>
            <button onClick={() => go('reset')} className={textLink}>
              Forgotten your password?
            </button>
            <button onClick={() => go('signup')} className={textLink}>
              No account yet? Create one
            </button>
          </>
        )}
        {mode === 'signup' && (
          <button onClick={() => go('signin')} className={textLink}>
            Already have one? Sign in
          </button>
        )}
        {mode === 'reset' && (
          <button onClick={() => go('signin')} className={textLink}>
            Back to sign in
          </button>
        )}
      </div>
    </>
  )
}

function Manage({ onDone }: { onDone: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [changing, setChanging] = useState(false)
  const [changed, setChanged] = useState(false)
  const {
    email,
    hasPassword,
    busy,
    dirty,
    lastSyncedAt,
    error,
    signOut,
    syncNow,
    deleteAccount,
    clearError,
  } = useSync()
  const source = useMembershipSource()
  const storeManage = source ? MANAGE_IN_STORE[source] : undefined

  return (
    <>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Signed in as <span className="text-foreground">{email}</span>. Your progress syncs on its
        own.{' '}
        {dirty
          ? 'Saving…'
          : lastSyncedAt
            ? `Last synced ${when(lastSyncedAt)}.`
            : 'Not synced yet.'}
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => {
            sound.play('tap')
            void syncNow()
          }}
          disabled={busy}
          className={cn(secondaryButton, busy && 'opacity-50')}
        >
          Sync now
        </button>
        <button
          onClick={() => {
            sound.play('tap')
            void signOut().then(onDone)
          }}
          disabled={busy}
          className={secondaryButton}
        >
          Sign out
        </button>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground/70">
        Signing out leaves your profile on this device exactly as it is.
      </p>

      <EmailSection />

      {changing ? (
        <ChangePassword
          onCancel={() => setChanging(false)}
          onSaved={() => {
            setChanged(true)
            setChanging(false)
          }}
        />
      ) : (
        <button
          onClick={() => {
            sound.play('tap')
            clearError()
            setChanged(false)
            setConfirming(false)
            setChanging(true)
          }}
          disabled={busy}
          className={wideSecondaryButton}
        >
          {hasPassword ? 'Change password' : 'Set a password'}
        </button>
      )}

      {changed && !changing && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Password saved. You’re still signed in here.
        </p>
      )}

      {confirming ? (
        <div className="flex flex-col gap-2 rounded-xl bg-foreground/[0.04] p-3">
          <p className="text-xs leading-relaxed">
            This deletes your account and the synced copy of your profile. The profile on this
            device stays exactly as it is. It cannot be undone.
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
          <div className="flex gap-2">
            <button
              onClick={() => {
                sound.play('tap')
                setConfirming(false)
              }}
              className={secondaryButton}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                sound.play('call')
                void deleteAccount().then((ok) => ok && onDone())
              }}
              className={cn(secondaryButton, 'text-suit-red')}
            >
              Delete it
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            sound.play('tap')
            setChanging(false)
            setConfirming(true)
          }}
          className={cn(textLink, 'w-full')}
        >
          Delete my account and synced data
        </button>
      )}

      {/* The password form shows its own errors, so this would be a duplicate. */}
      {error && !changing && <p className="text-xs leading-relaxed text-suit-red">{error}</p>}
    </>
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
    <div className="flex flex-col gap-2 rounded-xl bg-foreground/[0.04] p-3">
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

      <div className="flex gap-2">
        <button
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

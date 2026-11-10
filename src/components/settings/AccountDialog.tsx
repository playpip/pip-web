'use client'

// Everything account-shaped lives here, in its own dialog over Settings. The
// forms used to sit inline in the Settings sheet, which made it long and made a
// four-field flow share a scroll with the dark-mode toggle. Same reasoning as
// the QR: a real task gets its own surface rather than a cramped inline panel.
//
// Three modes, one dialog: sign in, create, reset. Signed in, there is nothing
// to show here: the account's controls are rows on Settings (AccountRows), so
// the dialog closes the moment a sign-in lands. Nothing here nags: it only
// opens when the player presses a button asking for it.

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
import { oauthProviders, type OAuthProvider, providerNames } from '@/lib/sync/client'
import { ALL_EMAIL, emailReady, rememberOptIn, writeEmailPrefs } from '@/lib/email/prefs'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

export type AccountMode = 'signin' | 'signup' | 'reset'

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
// Full width, and not `flex-1`, which would grow it vertically in the column.
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

  // A sign-in landing closes the dialog rather than leaving a spent form behind.
  useEffect(() => {
    if (open && status === 'signed-in') onOpenChange(false)
  }, [status, open, onOpenChange])

  const copy = COPY[current]
  // With Google or Apple on offer, "an email and a password" is no longer the
  // only way in, so the signup line stops saying it is.
  const names = providerNames()
  const description =
    current === 'signup' && names
      ? `Use ${names} or an email and a password. Nothing to confirm. Your Roll follows you to every device you sign in on.`
      : copy.description

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-1">
          <AuthForm mode={current} setMode={setCurrent} onDone={() => onOpenChange(false)} />
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
            off in Settings.
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

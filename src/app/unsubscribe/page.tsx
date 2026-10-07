'use client'

// The unsubscribe link in every Pip email (docs/email.md).
//
// A page with a button rather than a link that acts on load, for two reasons.
// Mail scanners open links before people do, and one that unsubscribed on GET
// would switch people's email off without them. And the Edge Function's own
// page cannot be HTML on the supabase.co domain. The mail client's one-click
// Unsubscribe button does not come through here: it posts straight to the
// function (List-Unsubscribe-Post, RFC 8058).
//
// No sign-in needed. The token in the link is the whole credential, and all it
// can do is switch email off.

import { useState } from 'react'
import Link from 'next/link'
import { useHydrated } from '@/lib/useHydrated'

const FUNCTION_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/unsubscribe`
  : null

type State = 'idle' | 'busy' | 'done' | 'no-match' | 'failed'

const button =
  'flex min-h-11 items-center justify-center rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40'

export default function UnsubscribePage() {
  const hydrated = useHydrated()
  const [state, setState] = useState<State>('idle')
  // Read during render once mounted: the token is in the query string, which a
  // static export cannot see at build time.
  const token = hydrated ? new URLSearchParams(window.location.search).get('token') : null

  const stop = async () => {
    if (!token || !FUNCTION_URL) return
    setState('busy')
    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const body = (await res.json().catch(() => null)) as { unsubscribed?: boolean } | null
      setState(!res.ok ? 'failed' : body?.unsubscribed ? 'done' : 'no-match')
    } catch {
      setState('failed')
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6">
      <h1 className="text-xl font-semibold">Stop Pip emails</h1>

      {!hydrated ? (
        <p className="text-sm text-muted-foreground">One moment…</p>
      ) : !token || !FUNCTION_URL ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          This link is not complete. Use the link at the foot of the email, or turn email off in
          Settings in Pip.
        </p>
      ) : state === 'done' ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Done. Pip will not email you again. You can turn email back on in Settings.
        </p>
      ) : state === 'no-match' ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          This link does not match any Pip emails. Nothing was changed.
        </p>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-muted-foreground">
            This turns off the Daily reminder and the weekly summary for your account.
          </p>
          <button onClick={() => void stop()} disabled={state === 'busy'} className={button}>
            Turn off Pip emails
          </button>
          {state === 'failed' && (
            <p className="text-xs text-suit-red">That did not work. Try again in a minute.</p>
          )}
        </>
      )}

      <Link
        href="/game"
        className="flex min-h-11 items-center justify-center text-xs text-muted-foreground/70 underline-offset-2 transition hover:text-foreground hover:underline"
      >
        Open Pip
      </Link>
    </main>
  )
}

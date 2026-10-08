'use client'

// The player's email switches: one row in `email_prefs`, theirs alone under
// RLS. The sending happens in the `send-emails` Edge Function (docs/email.md);
// this module only reads and writes the two switches.
//
// Opt-in is the whole design. No row means no email, a new row starts with both
// switches off unless the player ticked the box, and nothing here ever turns a
// switch on that the player did not just turn on themselves.

import { getSupabase, syncConfigured } from '@/lib/sync/client'

/**
 * Is email switched on in this build?
 *
 * Off until `NEXT_PUBLIC_EMAILS=on` is set, which is done once the functions
 * are deployed and the schedule is running. A switch that promises email the
 * project cannot yet send is worse than no switch, the same rule as
 * `checkoutReady()`.
 */
export function emailReady(): boolean {
  return syncConfigured() && process.env.NEXT_PUBLIC_EMAILS === 'on'
}

export interface EmailPrefs {
  dailyReminder: boolean
  weeklyDigest: boolean
}

/** Both on: what ticking the box at sign-up means. */
export const ALL_EMAIL: EmailPrefs = { dailyReminder: true, weeklyDigest: true }

async function signedInUser() {
  const sb = await getSupabase()
  if (!sb) return null
  const { data } = await sb.auth.getSession()
  const userId = data.session?.user.id
  return userId ? { sb, userId } : null
}

/**
 * The signed-in player's switches. Both off when there is no row yet; null
 * when they could not be read (offline, signed out, the table not there yet).
 */
export async function readEmailPrefs(): Promise<EmailPrefs | null> {
  const who = await signedInUser()
  if (!who) return null
  const { data, error } = await who.sb
    .from('email_prefs')
    .select('weekly_digest, daily_reminder')
    .eq('user_id', who.userId)
    .maybeSingle()
  if (error) return null
  return {
    dailyReminder: data?.daily_reminder ?? false,
    weeklyDigest: data?.weekly_digest ?? false,
  }
}

/** Write both switches. True when the row now says what was asked. */
export async function writeEmailPrefs(prefs: EmailPrefs): Promise<boolean> {
  const who = await signedInUser()
  if (!who) return false
  const { error } = await who.sb.from('email_prefs').upsert(
    {
      user_id: who.userId,
      daily_reminder: prefs.dailyReminder,
      weekly_digest: prefs.weeklyDigest,
    },
    { onConflict: 'user_id' },
  )
  return !error
}

// Google and Apple sign-in leave the page and come back to a fresh load, so a
// box ticked before going has to be remembered across the trip. It is kept for
// an hour at most and applied once, by the sync store, when the session lands.
const PENDING_KEY = 'pip.emailOptIn'
const PENDING_MS = 60 * 60_000

/** Remember (or forget) a ticked opt-in box across a Google/Apple redirect. */
export function rememberOptIn(on: boolean): void {
  try {
    if (on) localStorage.setItem(PENDING_KEY, String(Date.now()))
    else localStorage.removeItem(PENDING_KEY)
  } catch {
    // Storage blocked: the box is lost on the redirect, and the switches in
    // Settings are still there. Nothing is turned on that was not asked for.
  }
}

/** Apply a remembered opt-in, once. Called when a session is found on load. */
export async function applyPendingOptIn(): Promise<void> {
  let at: number
  try {
    at = Number(localStorage.getItem(PENDING_KEY))
    localStorage.removeItem(PENDING_KEY)
  } catch {
    return
  }
  if (!at || Date.now() - at > PENDING_MS) return
  await writeEmailPrefs(ALL_EMAIL)
}

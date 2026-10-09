// The Supabase seam. Everything that knows Supabase exists lives behind this
// module, so the rest of the app only ever sees "sync is available or it isn't".
//
// Two properties worth keeping:
//
//   1. **Nothing happens without an account.** The client is created lazily, on
//      the first call that needs it, so an ordinary visit makes no network call,
//      creates no identity and sets no storage. That is the brand claim, not an
//      optimisation, and it is why this is a getter rather than a module-level
//      `createClient()`.
//   2. **Missing config is a supported state**, not a crash. Local builds and
//      forks have no project, so `getSupabase()` returns null and every sync
//      surface hides itself. A contributor should never have to set up a
//      backend to run the app.
//
// The publishable key is public and always will be: it ships in the bundle and
// the repo is open source. RLS on the `profiles` table is the only thing
// protecting user data. See supabase/migrations/.

'use client'

// Type-only: erased at build time, so importing it costs nothing.
import type { SupabaseClient } from '@supabase/supabase-js'
// Generated from the live schema by `pnpm supabase:generate-types`. Typing the
// client with it means table and column names are checked against the real
// database at build time rather than at 2am.
import type { Database } from '@/types/supabase-types'
import { appSupports, inApp } from '@/lib/nativeApp'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** Is sync configured in this build? Safe to call during render. */
export function syncConfigured(): boolean {
  return Boolean(URL && KEY)
}

/** The sign-in providers Pip knows how to offer besides email and password. */
export type OAuthProvider = 'google' | 'apple'

const KNOWN_PROVIDERS: readonly OAuthProvider[] = ['google', 'apple']

/**
 * The providers this build offers, from `NEXT_PUBLIC_AUTH_PROVIDERS` (e.g.
 * `google,apple`). Each one has to be switched on in the Supabase dashboard
 * first, and this list is what keeps the button off until it is: a button for a
 * provider the project hasn't enabled sends the player to a raw JSON error on
 * supabase.co. Same rule as `checkoutReady()`. Order is the order shown.
 */
export function oauthProviders(): OAuthProvider[] {
  if (!syncConfigured()) return []
  const raw = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? '').toLowerCase().split(',')
  const offered = KNOWN_PROVIDERS.filter((p) => raw.map((r) => r.trim()).includes(p))
  // In the store app the web redirect can't work (Google refuses embedded web
  // views), so a provider is offered only if this build signs in with it
  // natively. An older app, or one without Google set up, just doesn't show it.
  return inApp() ? offered.filter((p) => appSupports(`signIn:${p}`)) : offered
}

/**
 * The providers on offer, as words: "Google, Apple", or just "Apple" in an app
 * build without Google. Named from `oauthProviders()`, so the copy can never
 * offer a button the dialog doesn't show.
 */
export function providerNames(): string | null {
  const names = oauthProviders().map((p) => (p === 'google' ? 'Google' : 'Apple'))
  return names.length > 0 ? names.join(', ') : null
}

let client: SupabaseClient<Database> | null = null
let loading: Promise<SupabaseClient<Database> | null> | null = null

/**
 * The client, created on first use. Null when the build has no project.
 *
 * **The import is dynamic on purpose.** Statically importing supabase-js put
 * ~54 KB (brotli) into the shared chunk that every page loads, including the
 * marketing landing page, where it can never be used — about 15% on top of the
 * whole landing payload for a feature most visitors never touch. This way the
 * library is a lazy chunk fetched only when somebody actually has a session or
 * reaches for the sign-in form.
 *
 * The cost of that is this returning a promise. Every caller is already async.
 */
export async function getSupabase(): Promise<SupabaseClient<Database> | null> {
  if (!URL || !KEY) return null
  if (client) return client
  if (!loading) {
    loading = import('@supabase/supabase-js').then(({ createClient }) => {
      client = createClient<Database>(URL, KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // The reset link comes back as a URL fragment; let the client consume it.
          // Google and Apple sign-in come back the same way, and `init()` picks
          // the session up through getSession(), which waits for this.
          //
          // The fragment holds a real access token with the account's email in
          // it, and it sits in the URL until this client loads and strips it.
          // Anything reading location in the meantime sees it: that is how it
          // reached analytics (fixed with data-exclude-hash in app/layout.tsx),
          // and it is still in browser history.
          //
          // The PKCE flow would take the token out of the URL entirely, and we
          // deliberately are not using it: ruled 2026-08-09, technology#30.
          // PKCE keeps its code verifier in the browser that asked for the link,
          // so a reset opened in a mail app's webview, or on a phone when the
          // account is on a laptop, fails outright. That is a login failure for
          // someone doing a normal thing, traded against an exposure that ends
          // up in the player's own history on their own device. Do not set
          // flowType without reopening that decision: it is a user-facing
          // regression risk, not a config tidy-up.
          detectSessionInUrl: true,
        },
      })
      return client
    })
  }
  return loading
}

/** The row shape in `profiles`. Mirrors supabase/migrations/. */
export interface ProfileRow {
  user_id: string
  version: number
  state: Record<string, unknown>
  updated_at: string
  device_id: string | null
}

const DEVICE_KEY = 'pip.device'

/**
 * A stable id for this browser, so a row can say who wrote it last. Not an
 * identity and never sent anywhere except the user's own row: it exists so the
 * conflict prompt can tell "another device wrote this" from "I wrote this".
 */
export function deviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY)
    if (existing) return existing
    const fresh = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, fresh)
    return fresh
  } catch {
    // Storage blocked (Safari private mode). A per-tab id still tells two
    // devices apart, it just won't survive a reload.
    return 'ephemeral'
  }
}

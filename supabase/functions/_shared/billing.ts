// What every billing function shares: the Stripe client, the service-role
// Supabase client, CORS, and "who is calling".
//
// **This is Deno, on Supabase, and it is the only place a Stripe secret lives.**
// The site is a static export on Cloudflare Pages with no server at all, and
// `functions/` at the repo root is markdown content negotiation that knows no
// price exists (see functions/membership.ts). Nothing under src/ may ever import
// from here; the secrets below would be one careless import away from a public
// bundle.
//
// Secrets are set with `supabase secrets set`, never committed:
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MONTHLY,
//   STRIPE_PRICE_ANNUAL, SITE_URL, and optionally STRIPE_AUTOMATIC_TAX=true and
//   STRIPE_PORTAL_CONFIGURATION.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by
// the platform. See docs/stripe.md.

// The major is pinned alongside `apiVersion` below: a bare `npm:stripe` would
// float to whatever is newest at each deploy, and a new major pins a new API
// version under us. Bump both together.
import Stripe from 'npm:stripe@22'
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'

function env(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`${name} is not set`)
  return value
}

export const stripe = new Stripe(env('STRIPE_SECRET_KEY'), {
  // fetch rather than node:http, which is what Deno's edge runtime wants.
  httpClient: Stripe.createFetchHttpClient(),
  // Pinned, as Probus pins it on the same account. Stripe versions its API per
  // account, and this account is shared: left unpinned, the shape of every
  // object here would change the day anybody moves the account default.
  apiVersion: '2026-08-26.dahlia',
  appInfo: { name: 'Pip', url: 'https://playpip.io' },
})

/**
 * **Pip shares its Stripe account** with Ava Technologies' other projects
 * (Probus first). Business details, branding, Tax and the statement descriptor
 * are account-wide, and every webhook endpoint on the account is sent every
 * project's events. There is no filtering on Stripe's side.
 *
 * So everything Pip creates carries this tag — the Checkout session and the
 * subscription — and anything without it belongs to somebody else. The webhook
 * ignores untagged events with a 200, because a 500 on a sibling's checkout
 * makes Stripe retry it for three days and eventually disable this endpoint.
 * `delete-account` cancels only tagged subscriptions, so a Pip account delete
 * can never cancel something bought from another Ava project.
 *
 * Same key and shape as Probus's `PROJECT_METADATA`, so the dashboard filters
 * on `metadata.project` for either.
 */
export const PROJECT_METADATA = { project: 'pip' } as const

export function isPip(metadata: Stripe.Metadata | null | undefined): boolean {
  return metadata?.project === PROJECT_METADATA.project
}

/**
 * A customer-portal configuration of Pip's own (`bpc_…`), optional.
 *
 * The account's default portal configuration is shared with every Ava project,
 * so its headline, its links and which products a customer may switch between
 * are not Pip's to set. docs/stripe.md creates a Pip one; until it exists, the
 * default is used.
 */
export const PORTAL_CONFIGURATION = Deno.env.get('STRIPE_PORTAL_CONFIGURATION') || undefined

/** Where Checkout and the portal send people back to. No trailing slash. */
export const SITE_URL = env('SITE_URL').replace(/\/+$/, '')

/**
 * The two prices this function will sell, and nothing else.
 *
 * The client sends a price id (its copy lives in `NEXT_PUBLIC_STRIPE_PRICE_*`)
 * and it is checked against this list. A client that sends any other id — an
 * old test price, somebody else's product, a price with a 100% coupon baked in —
 * gets a 400, because a checkout that sells whatever it is told to is a checkout
 * anybody can reprice from a console.
 */
export const PRICES = new Set([env('STRIPE_PRICE_MONTHLY'), env('STRIPE_PRICE_ANNUAL')])

/**
 * Service role: bypasses RLS. The only writer of `memberships` there is.
 * Never returned to a caller and never logged.
 */
export const admin: SupabaseClient = createClient(
  env('SUPABASE_URL'),
  env('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } },
)

/**
 * CORS. The browser calls these from playpip.io (and localhost in development),
 * so the preflight has to be answered. `*` is safe here because every function
 * but the webhook demands a bearer token, and the webhook demands a Stripe
 * signature: an origin check would add nothing a stolen token does not already
 * bypass.
 */
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/**
 * The signed-in caller, from their own access token, or null.
 *
 * Checked with `auth.getUser(token)`, which asks the auth server, rather than by
 * decoding the JWT locally: a deleted user's token is still well-formed until it
 * expires, and a deleted user must not be able to start a subscription.
 */
export async function caller(req: Request): Promise<User | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

/** The caller's membership row, read with the service role. */
export async function membershipOf(userId: string) {
  const { data, error } = await admin
    .from('memberships')
    .select('stripe_customer_id, stripe_subscription_id, status')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data as {
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    status: string
  } | null
}

/** Stripe statuses where a second subscription would be a double charge. */
export const LIVE = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused']

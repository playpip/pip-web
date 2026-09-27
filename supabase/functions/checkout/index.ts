// Start a Stripe Checkout session for the signed-in caller.
//
// POST { priceId, currency, startNow, termsVersion } with the player's access token → { url }.
//
// **This function never grants anything.** It hands the player to Stripe's
// hosted page and returns. The membership row is written by `stripe-webhook`
// when Stripe says the money arrived, and by nothing else — so a player who
// closes the tab, a card that declines, or a success URL typed by hand all end
// the same way: not a member.

import {
  CORS,
  PROJECT_METADATA,
  LIVE,
  PRICES,
  SITE_URL,
  caller,
  json,
  membershipOf,
  stripe,
} from '../_shared/billing.ts'

/**
 * The currencies the price carries in `currency_options`. The player's choice
 * is passed through rather than left to Stripe to guess from their IP, because
 * the number they were looking at on /membership is the number they must be
 * charged (docs/membership.md → Currencies).
 */
const CURRENCIES = new Set(['gbp', 'usd', 'eur', 'cny'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const user = await caller(req)
  if (!user) return json({ error: 'signed-out' }, 401)

  let body: { priceId?: unknown; currency?: unknown; startNow?: unknown; termsVersion?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad-request' }, 400)
  }
  const priceId = typeof body.priceId === 'string' ? body.priceId : ''
  const currency = typeof body.currency === 'string' ? body.currency.toLowerCase() : ''
  if (!PRICES.has(priceId)) return json({ error: 'unknown-price' }, 400)
  if (!CURRENCIES.has(currency)) return json({ error: 'unknown-currency' }, 400)

  // The player asked for the membership to start now, which is what ends a
  // consumer's 14-day right to cancel on the day they join rather than 14 days
  // later (/terms says they will be asked). The box on /membership is required,
  // but a POST can arrive without the page, so it is checked again here.
  //
  // It cannot be asked on Stripe's page: Checkout's own terms consent points at
  // the account's terms URL, and this account is Ava's, shared with Probus.
  if (body.startNow !== true) return json({ error: 'consent' }, 400)
  const termsVersion = typeof body.termsVersion === 'string' ? body.termsVersion.slice(0, 40) : ''

  const row = await membershipOf(user.id)

  // A second subscription on top of a live one is a double charge that looks
  // like an ordinary checkout. `past_due` included: that player needs the
  // portal to fix a card, not a second membership.
  if (row && LIVE.includes(row.status)) return json({ error: 'already-a-member' }, 409)

  const automaticTax = Deno.env.get('STRIPE_AUTOMATIC_TAX') === 'true'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    currency,
    // A returning player (lapsed, cancelled) keeps their Stripe customer, so
    // their invoices stay in one place. A new one is created by Checkout.
    ...(row?.stripe_customer_id
      ? {
          customer: row.stripe_customer_id,
          ...(automaticTax ? { customer_update: { address: 'auto' as const } } : {}),
        }
      : { customer_email: user.email }),
    // The user id rides on both the session and the subscription. The webhook
    // reads it from the subscription, which is the object every later event is
    // about; the session copy is for a human reading the dashboard.
    //
    // `PROJECT_METADATA` on both is what tells Pip's webhook this is Pip's and
    // Probus's webhook that it is not theirs — the account is shared, and every
    // endpoint on it hears every project's events (see _shared/billing.ts).
    // `start_now` and `terms_version` are the record of the consent above, for
    // a cancellation request or a dispute months from now.
    client_reference_id: user.id,
    metadata: {
      ...PROJECT_METADATA,
      user_id: user.id,
      start_now: 'requested',
      terms_version: termsVersion,
    },
    subscription_data: {
      metadata: { ...PROJECT_METADATA, user_id: user.id, terms_version: termsVersion },
    },
    // Tax-inclusive prices need Stripe Tax to work out the split for the
    // invoice. Off until Stripe Tax is *active* on the account: it is shared, and
    // on the live account it was still `pending` (no head office, no
    // registrations) when Probus launched — at which point every session that
    // asks for it fails, for every Ava project alike.
    ...(automaticTax ? { automatic_tax: { enabled: true } } : {}),
    success_url: `${SITE_URL}/membership?joined=1#plans`,
    cancel_url: `${SITE_URL}/membership#plans`,
  })

  if (!session.url) return json({ error: 'no-session' }, 502)
  return json({ url: session.url })
})

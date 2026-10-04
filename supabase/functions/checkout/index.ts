// Start a Stripe Checkout session for the signed-in caller.
//
// POST { priceId, currency, startNow, termsVersion, for? } with the player's access token → { url }.
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
  isPip,
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

  let body: {
    priceId?: unknown
    currency?: unknown
    startNow?: unknown
    termsVersion?: unknown
    for?: unknown
  }
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

  // What the player tapped to reach /membership, handed back on the success
  // URL so the page can link them to it. Only a feature id's shape gets through:
  // the page checks it against the shipped features and ignores anything else,
  // so this only keeps arbitrary text off a URL Stripe redirects to.
  const tapped = typeof body.for === 'string' && /^[a-z-]{1,40}$/.test(body.for) ? body.for : ''

  const row = await membershipOf(user.id)

  // A second subscription on top of a live one is a double charge that looks
  // like an ordinary checkout. `past_due` included: that player needs the
  // portal to fix a card, not a second membership.
  if (row && LIVE.includes(row.status)) return json({ error: 'already-a-member' }, 409)

  // **Two open checkouts are a double charge waiting to happen.** The check
  // above only sees a membership once its webhook has landed, so two tabs — or
  // Back and Join again — would each get a session, and paying both makes two
  // subscriptions. So every other open Pip session of this player's is expired
  // before a new one is made, and a new one only lives 30 minutes (Stripe's
  // minimum). The webhook cancels a duplicate if one still gets through.
  const others = await stripe.checkout.sessions.list({
    status: 'open',
    limit: 20,
    ...(row?.stripe_customer_id
      ? { customer: row.stripe_customer_id }
      : { customer_details: { email: user.email ?? '' } }),
  })
  for (const open of others.data) {
    if (isPip(open.metadata) && open.metadata?.user_id === user.id) {
      await stripe.checkout.sessions.expire(open.id).catch(() => {
        // Already completed or expired between the list and now. Either way it
        // is no longer open, which is all this wanted.
      })
    }
  }

  const automaticTax = Deno.env.get('STRIPE_AUTOMATIC_TAX') === 'true'

  const session = await stripe.checkout.sessions.create({
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
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
    success_url: `${SITE_URL}/membership?joined=1${tapped ? `&for=${tapped}` : ''}#plans`,
    cancel_url: `${SITE_URL}/membership#plans`,
  })

  if (!session.url) return json({ error: 'no-session' }, 502)
  return json({ url: session.url })
})

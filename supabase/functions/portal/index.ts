// Open the Stripe customer portal for the signed-in caller.
//
// POST with the player's access token → { url }.
//
// This is the cancel button `HOW_TO_CANCEL` promises: Settings → Membership →
// Manage, one click here, one in the portal. Changing a card and downloading an
// invoice live there too, which is why we do not build any of them ourselves.

import {
  CORS,
  PORTAL_CONFIGURATION,
  SITE_URL,
  caller,
  json,
  membershipOf,
  stripe,
} from '../_shared/billing.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const user = await caller(req)
  if (!user) return json({ error: 'signed-out' }, 401)

  const row = await membershipOf(user.id)
  if (!row?.stripe_customer_id) return json({ error: 'no-membership' }, 404)

  const session = await stripe.billingPortal.sessions.create({
    customer: row.stripe_customer_id,
    // Pip's own portal, not the account default the other Ava projects share.
    ...(PORTAL_CONFIGURATION ? { configuration: PORTAL_CONFIGURATION } : {}),
    return_url: `${SITE_URL}/membership`,
  })
  return json({ url: session.url })
})

# Stripe — how the till is wired, and how to open it

The membership's payment path. What is gated and why is [membership.md](./membership.md);
this is the plumbing and the switch-on runbook.

## The shape

The site is a static export with no server, so everything that holds a secret runs as a
**Supabase Edge Function** (Deno) in `supabase/functions/`. The browser never loads Stripe.js
and never holds a Stripe key: it asks a function for a URL and goes there.

| Function | Called by | Does |
|---|---|---|
| `checkout` | the Join button on `/membership` | Checks the price id against the two it sells, refuses a player who already has a live subscription, returns a hosted Checkout URL in the currency the player was looking at |
| `stripe-webhook` | Stripe | Verifies the signature, re-fetches the subscription, upserts `memberships`. **The only writer that table has** |
| `portal` | Settings → Membership → Manage, and the member view on `/membership` | Returns a customer-portal URL: cancel, change card, invoices |
| `delete-account` | Settings → Delete my account (once checkout is live) | Cancels every billable subscription, *then* deletes the user |

Client side it is one file, `src/lib/membership/billing.ts`, plus the `Join` box in
`MembershipScreen.tsx` and `components/settings/MembershipSection.tsx`. Entitlement is still
read in exactly one place, `store/entitlement.ts`.

### Properties worth keeping

- **Returning from Checkout grants nothing.** `?joined=1` only changes what the join box says
  while `awaitMembership()` re-reads the row for ~15 seconds. The webhook decides.
- **The webhook trusts no event body.** It re-fetches the subscription and writes what Stripe
  says *now*, so out-of-order and duplicate deliveries cannot leave a stale status.
- **One live subscription per player.** `checkout` refuses with `already-a-member`; the
  webhook will not let a late event about an old, dead subscription overwrite a live one.
- **Deleting an account cancels first.** If the cancel fails, the account is left alone and
  the player can retry. Builds without the price ids keep using `delete_own_account()`.
- `tests/billing.test.ts` pins the lines above, since CI cannot run Deno.

## The account is shared (2026-09-26)

Pip sells through **Ava Technologies Global Ltd's Stripe account**, the same one Probus uses
(`../ava-technologies/probus`, GO-LIVE.md stage 4). Business details, branding, Stripe Tax and
the statement descriptor are account-wide, and **every webhook endpoint on the account is sent
every project's events**. What follows from that, all built:

- **Everything Pip creates is tagged `metadata.project = pip`** — the Checkout session and the
  subscription (`PROJECT_METADATA` in `_shared/billing.ts`, same key Probus uses). The webhook
  ignores anything untagged with a 200; a 500 would have Stripe retry a Probus event for three
  days and then disable Pip's endpoint. Filter on it in the dashboard to see Pip revenue alone.
- **`delete-account` cancels only tagged subscriptions**, so deleting a Pip account can never
  cancel something bought from another Ava project.
- **The seller is Ava, and the player is told so before paying.** Checkout, the receipt and the
  statement carry Ava's name, not Pip's. The join box and `/terms` both name
  `SELLER` (`config/membership.ts`) and the statement text `AVA TECH* PIP`. An unrecognised
  statement line is the commonest cause of chargebacks on a small subscription.
- **Consent is asked on our page, not Stripe's.** Checkout's own terms checkbox points at the
  account's terms URL, which is Ava's. So the join box has a required "start straight away"
  box, `checkout` refuses without it, and the session records `start_now` and
  `terms_version` (`TERMS_VERSION`) — the same record Probus keeps.
- **Pip has its own customer-portal configuration** (`STRIPE_PORTAL_CONFIGURATION`), because
  the default one is shared.
- **The API version is pinned** (`2026-08-26.dahlia`, the same as Probus) along with the SDK
  major (`npm:stripe@22`). Unpinned, the objects would change shape whenever anybody moved the
  shared account's default version.

## Switching it on

Do it in **test mode** end to end first, then repeat with live keys.

### 1. Stripe dashboard (Ava's account)

Account-wide settings — business details, branding, the `AVA TECH` shortened descriptor — are
already done for Probus. Do not change them for Pip; they are Probus's too.

1. **Product**: "Pip membership", with `metadata.project = pip`, statement descriptor
   **`PIP`** (so charges read `AVA TECH* PIP` — check this on the first test charge; if it
   reads otherwise, fix `SELLER.statement` to match), and a **consumer** digital-goods tax
   code — not Probus's business SaaS code `txcd_10103001`. Pick it from Stripe's list.
2. **Two recurring prices** on it — monthly and yearly. Each in **GBP** as the default
   currency, with `currency_options` for **USD, EUR and CNY** at exactly the amounts in
   `MEMBERSHIP_PRICES` (`src/config/membership.ts`). Tax behaviour **inclusive** on every one
   (Probus's are exclusive; that is a per-price setting and they don't collide).
   Leave Adaptive Pricing **off**.
3. **Pip's own portal configuration**: create one (Settings → Billing → Customer portal, or
   `stripe billing_portal configurations create`) that allows cancelling at period end,
   updating payment methods and viewing invoices, lists only the Pip product, and has
   playpip.io's terms and privacy links. Its `bpc_…` id is `STRIPE_PORTAL_CONFIGURATION`.
4. **Stripe Tax**: shared with Probus. When Probus went live it was still `pending` on the live
   account (no head office, no registrations). Leave `STRIPE_AUTOMATIC_TAX` unset until it is
   active — a session that asks for automatic tax fails without it. Ava is VAT-registered, so
   VAT is owed on UK sales either way: with inclusive prices it comes out of the £5.99.
5. **Payment methods**: cards are on by default. For the CNY price to be useful, check
   whether Alipay can be enabled for subscriptions on the account (WeChat Pay cannot do
   recurring). This is account-wide, so it is Probus's checkout too.
6. **A webhook endpoint of Pip's own**:
   `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`, listening to
   `checkout.session.completed` and `customer.subscription.created`, `.updated`, `.deleted`,
   `.paused`, `.resumed` — nothing else. Copy its signing secret; it is not Probus's.
7. **A restricted key named `pip`** — never the account's secret key, because a leak would
   expose every Ava project. Checkout Sessions: Write · Subscriptions: Write · Customers: Read
   · Customer portal: Write. Everything else None. If a permission is missing, Stripe's
   error names it.

### 2. Supabase

```bash
supabase db push      # if memberships isn't in the live database yet

supabase secrets set \
  STRIPE_SECRET_KEY=rk_test_… \
  STRIPE_WEBHOOK_SECRET=whsec_… \
  STRIPE_PRICE_MONTHLY=price_… \
  STRIPE_PRICE_ANNUAL=price_… \
  STRIPE_PORTAL_CONFIGURATION=bpc_… \
  SITE_URL=https://playpip.io        # http://localhost:3000 while testing locally
# later, once Stripe Tax is registered:
# supabase secrets set STRIPE_AUTOMATIC_TAX=true

supabase functions deploy checkout
supabase functions deploy portal
supabase functions deploy delete-account
supabase functions deploy stripe-webhook   # verify_jwt = false comes from config.toml
```

### 3. The site

Set **repo Variables** `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` and `NEXT_PUBLIC_STRIPE_PRICE_ANNUAL`
to the same two ids, and redeploy. That flips `checkoutReady()`, which turns the join button
on, the Settings row on, and account deletion over to `delete-account`.

**Deploy the functions before setting these.** The moment the ids are in the bundle, account
deletion calls `delete-account`; if it is not deployed, deleting an account fails.

### 4. Check it

Put the test-mode price ids in `.env.local`, run `pnpm dev`, and walk through:

- [ ] Signed out, `/membership` → "Create a free account to join" opens sign-up
- [ ] Signed in → Join is dead until the start-now box is ticked
- [ ] Join → Stripe Checkout in the currency picked on the page, under Ava's name
- [ ] The session and subscription in the dashboard carry `project: pip`, `start_now`,
      `terms_version`
- [ ] Pay with `4242 4242 4242 4242` → back on `/membership#plans`, "Confirming…" → "Welcome in"
- [ ] A side table unlocks without a reload
- [ ] Join again from another tab → "already has a membership"
- [ ] Settings → Membership → Manage → portal → cancel → Settings says "Cancelled… until <date>"
- [ ] Card `4000 0000 0000 0341` (attaches, then fails on renewal) + a test clock → "Your last
      payment didn't go through"
- [ ] Delete the account while subscribed → subscription shows as cancelled in Stripe
- [ ] The test charge's statement descriptor reads `AVA TECH* PIP`
- [ ] Stripe dashboard → Pip's webhook → every delivery 200, including Probus's events
- [ ] Probus's webhook → Pip's events answered 200 `ignored`, not 500

## What is not built

- **Disputes** are not watched. Probus logs its own `charge.dispute.created`; Pip's would
  need the same (a subscription's payment intent carries no project tag, so the check would
  go through the invoice's subscription). Until then, disputes are seen in the dashboard.

- **Funnel events** (`technology#52`): none of the four are tracked yet.
- **Refunds** are done by hand in the Stripe dashboard; the webhook picks up the resulting
  status change like any other.
- **Plan switching** is left to the portal if you enable it; the webhook stores whatever
  price the subscription ends up on.

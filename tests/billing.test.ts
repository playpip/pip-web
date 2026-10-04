import { readFileSync, readdirSync } from 'node:fs'
import test from 'ava'

// The billing Edge Functions are Deno and run on Supabase, so nothing in this
// suite can execute them. What can be checked is the handful of lines whose
// absence would make them unsafe, each of which looks like an ordinary line to
// delete in a tidy-up. Read as source, comments stripped, so a note explaining
// a check cannot stand in for the check.

const code = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')

const webhook = code('supabase/functions/stripe-webhook/index.ts')
const checkout = code('supabase/functions/checkout/index.ts')
const remove = code('supabase/functions/delete-account/index.ts')
const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf-8')

// The webhook has JWT verification off, so the signature is its only lock.
test('the webhook refuses anything Stripe did not sign', (t) => {
  t.regex(config, /\[functions\.stripe-webhook\]\s*verify_jwt = false/)
  t.regex(webhook, /constructEventAsync\(/, 'the signature is not checked')
  t.regex(webhook, /bad signature', \{ status: 400 \}/, 'a bad signature is not refused')
  // Parsing first changes the bytes that were signed.
  t.regex(webhook, /await req\.text\(\)/)
  t.notRegex(webhook, /await req\.json\(\)/)
})

test('every other billing function wants a signed-in player', (t) => {
  for (const name of ['checkout', 'portal', 'delete-account']) {
    t.regex(config, new RegExp(`\\[functions\\.${name}\\]\\s*verify_jwt = true`), name)
    t.regex(code(`supabase/functions/${name}/index.ts`), /await caller\(req\)/, name)
  }
})

// The Stripe account is Ava Technologies', shared with Probus and whatever comes
// next. Every endpoint hears every project's events, so an untagged event is
// somebody else's and must be left alone — and acknowledged, because a 500 on a
// sibling's event is retried for three days and then gets this endpoint disabled.
test('on the shared account, Pip only touches what it tagged', (t) => {
  const shared = code('supabase/functions/_shared/billing.ts')
  t.regex(shared, /PROJECT_METADATA = \{ project: 'pip' \}/)

  t.regex(checkout, /metadata: \{\s*\.\.\.PROJECT_METADATA/, 'the session is not tagged')
  t.regex(
    checkout,
    /subscription_data: \{\s*metadata: \{ \.\.\.PROJECT_METADATA/,
    'the subscription is not tagged, so the webhook will ignore every renewal',
  )

  t.regex(
    webhook,
    /if \(!isPip\(session\.metadata\)\) break/,
    'another project’s checkout reaches sync',
  )
  t.regex(
    webhook,
    /if \(isPip\(sub\.metadata\)\) await sync/,
    'another project’s subscription reaches sync',
  )
  t.regex(webhook, /if \(!isPip\(sub\.metadata\)\) return/)

  t.regex(
    remove,
    /isPip\(sub\.metadata\) && BILLABLE/,
    'deleting a Pip account can cancel a Probus subscription',
  )
})

// /terms says the player is asked to confirm the membership starts at once.
test('checkout refuses without the start-now consent', (t) => {
  t.regex(checkout, /if \(body\.startNow !== true\) return json\(\{ error: 'consent' \}, 400\)/)
  t.regex(checkout, /start_now: 'requested'/)
  t.regex(checkout, /terms_version: termsVersion/)
})

// Two tabs, or Back and Join again, each got a session; paying both made two
// subscriptions and the first kept billing out of sight. Found in the pre-launch
// review (2026-09-27) and closed in two layers.
test('a player cannot end up with two paid memberships', (t) => {
  t.regex(checkout, /sessions\.list\(\{\s*status: 'open'/, 'open sessions are not looked for')
  t.regex(
    checkout,
    /sessions\.expire\(open\.id\)/,
    'a player’s other open sessions are not expired',
  )
  t.regex(checkout, /expires_at: /, 'sessions live for Stripe’s default 24 hours')
  t.regex(webhook, /DUPLICATE subscription/, 'a second live subscription is written over the first')
  t.regex(webhook, /await stripe\.subscriptions\.cancel\(sub\.id\)/)
})

// Every Stripe import in the functions is the same major, matching `apiVersion`.
test('the functions load one Stripe SDK', (t) => {
  for (const source of [webhook, code('supabase/functions/_shared/billing.ts')]) {
    t.notRegex(
      source,
      /from 'npm:stripe'/,
      'an unpinned npm:stripe floats to a new major on deploy',
    )
  }
})

// A checkout that sells whatever price id it is sent can be repriced from a console.
test('checkout only sells the two configured prices', (t) => {
  t.regex(checkout, /if \(!PRICES\.has\(priceId\)\)/)
  t.regex(checkout, /already-a-member/, 'a live member can start a second subscription')
})

test('deleting an account cancels in Stripe before it deletes', (t) => {
  const cancel = remove.indexOf('subscriptions.cancel(')
  const del = remove.indexOf('deleteUser(')
  t.true(cancel > 0 && del > cancel, 'the user is deleted before the subscription is cancelled')
  t.regex(remove, /cancel-failed/, 'a failed cancel still goes on to delete')

  const sync = code('src/store/sync.ts')
  t.regex(sync, /checkoutReady\(\)\s*\?\s*await sb\.functions\.invoke\('delete-account'/)
})

// The functions hold the Stripe secret and the service role key.
test('nothing the browser loads imports the billing functions', (t) => {
  const walk = (dir: string): string[] =>
    readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? walk(`${dir}/${e.name}`)
        : /\.tsx?$/.test(e.name)
          ? [`${dir}/${e.name}`]
          : [],
    )
  for (const path of walk('src')) {
    t.notRegex(code(path), /supabase\/functions|SERVICE_ROLE|STRIPE_SECRET/, path)
  }
})

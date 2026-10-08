// Turn off every Pip email for the holder of an unsubscribe token.
//
//   POST ?token=<uuid>       RFC 8058 one-click, from the mail client's own
//                            Unsubscribe button (List-Unsubscribe-Post), and
//                            from the playpip.io/unsubscribe page → JSON.
//   POST { "token": … }      the same, token in a JSON body.
//   GET  ?token=<uuid>       the same, answered with a short HTML page.
//
// Deployed with JWT verification off (supabase/config.toml): whoever clicks an
// unsubscribe link is often not signed in, and a mail provider never is. The
// token is the whole credential. It is a random uuid stored on the row, it can
// only switch email *off*, and it cannot read anything back, so a guessed or
// leaked one costs somebody an email they can turn on again in Settings.
//
// **The GET page may arrive as plain text.** Supabase serves `text/html` from
// functions only on a custom domain; on `*.supabase.co` it is rewritten to
// `text/plain`. That is why the link in the email body goes to
// playpip.io/unsubscribe (a page with a button) rather than here, and why the
// page below is short enough to read either way.

import { admin } from '../_shared/service.ts'
import { parseToken } from '../_shared/email.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function page(message: string, status = 200): Response {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="robots" content="noindex"><title>Pip email</title></head>
<body style="margin:0;padding:48px 16px;background:#0a0a0a;color:#ededed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<main style="max-width:420px;margin:0 auto;">
<p style="font-size:18px;font-weight:600;margin:0 0 24px;">pip</p>
<p style="font-size:16px;line-height:1.5;margin:0 0 16px;">${message}</p>
<p style="font-size:14px;line-height:1.5;color:#a1a1a1;margin:0;"><a href="https://playpip.io/game" style="color:#a1a1a1;">Open Pip</a></p>
</main></body></html>`
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

/** Both switches off for this token. True when a row matched. */
async function unsubscribe(token: string): Promise<boolean> {
  const { data, error } = await admin
    .from('email_prefs')
    .update({ weekly_digest: false, daily_reminder: false })
    .eq('unsubscribe_token', token)
    .select('user_id')
  if (error) throw error
  return (data ?? []).length > 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const url = new URL(req.url)

  if (req.method === 'GET') {
    const token = parseToken(url.searchParams.get('token'))
    if (!token) return page('This unsubscribe link is not complete. Nothing was changed.', 400)
    try {
      const found = await unsubscribe(token)
      return page(
        found
          ? 'Done. Pip will not email you again. You can turn email back on in Settings.'
          : 'This link does not match any Pip emails. Nothing was changed.',
      )
    } catch (err) {
      console.error('unsubscribe: update failed:', err)
      return page('That did not work. Try the link again in a minute.', 500)
    }
  }

  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  // One-click sends `List-Unsubscribe=One-Click` as a form body and keeps the
  // token in the URL. The site's page sends JSON. Accept either.
  let token = parseToken(url.searchParams.get('token'))
  if (!token && req.headers.get('content-type')?.includes('application/json')) {
    const body = (await req.json().catch(() => ({}))) as { token?: unknown }
    token = parseToken(typeof body.token === 'string' ? body.token : null)
  }
  if (!token) return json({ error: 'token' }, 400)

  try {
    return json({ unsubscribed: await unsubscribe(token) })
  } catch (err) {
    console.error('unsubscribe: update failed:', err)
    return json({ error: 'failed' }, 500)
  }
})

# Email (opt-in)

Pip sends three kinds of email, and only to a signed-in player who asked for them:

| Kind | When | What it says |
|------|------|--------------|
| **Streak reminder** | From 18:00 UTC, on a day the player has not played yet, if they played the day before | Today's Daily number, that it closes at midnight UTC, the streak if the profile has one, a link to `/game` |
| **Weekly summary** | Mondays from 09:00 UTC | The Roll, hands / tournaments / wins and the Roll's change since the last summary, the streak if alive, today's Daily number, one link |
| **Welcome** | Within the hour of a first opt-in (rows created in the last 2 days with no welcome sent) | Which of the two they turned on, and how to stop them |

Password-reset email is separate: Supabase Auth sends it through Resend's SMTP, as before.

The code: `supabase/migrations/20261007090000_email_prefs.sql`, `supabase/functions/send-emails`,
`supabase/functions/unsubscribe`, the pure logic in `supabase/functions/_shared/email.ts`
(tested by `tests/email.test.ts`), the schedule in `supabase/cron/send-emails.sql`, the switches
in `src/lib/email/prefs.ts`, `src/store/emailPrefs.ts`, Settings → Manage account → Email, the box in
`AccountDialog`, and the page at `/unsubscribe`.

## The rules the build keeps

1. **Opt-in only.** Both switches default to off. The box at sign-up is unticked. Nothing in the
   app turns a switch on except the player.
2. **At most one email per player per UTC day**, whatever the kinds. A welcome or a Monday
   summary holds that day's reminder.
3. **Never invent a number.** Every figure is read from the synced `profiles.state`, or
   subtracted from the snapshot the last summary stored. A figure that cannot be read leaves its
   line out. The first summary after a welcome-less opt-in has no weekly numbers because there is
   nothing to subtract from, and says so by not saying them.
4. **Every email carries both unsubscribes**: a link at the foot (to `playpip.io/unsubscribe`,
   a page with a button) and RFC 8058 one-click headers (`List-Unsubscribe` +
   `List-Unsubscribe-Post`) that post straight to the `unsubscribe` function. Either turns off
   both switches without a sign-in.
5. **No tracking.** No open pixel, no rewritten links. Keep open and click tracking **off** on
   the Resend domain; /privacy says we do not track opens or clicks.

## How a run works

`pg_cron` calls `send-emails` hourly at :05 with the `x-cron-secret` header. The function:

1. reads every `email_prefs` row with a switch on, and those players' `profiles.state`;
2. asks `dueKind()` what each is due at this hour;
3. per kind, in batches of up to 100: **claims** the day by stamping `last_sent_<kind>` where it
   is not already today's, sends only the claimed rows through Resend's batch API (with an
   `Idempotency-Key`), and puts the stamps back if Resend refuses;
4. for welcomes and summaries, stores the snapshot the next summary subtracts from.

So a missed hour is caught by the next one, and a doubled run (or a manual one on top of the
schedule) sends nothing twice.

**The streak.** Read by `readStreak()` from `state.streak` (`{current, best, lastDate}`, see
`src/lib/streak.ts`): consecutive UTC days with a hand played at any table. If it is missing, no
email mentions a streak, and a streak is only quoted while it is alive (last played today or
yesterday).

**"At risk".** `state.streak.lastDate` is yesterday. It depends on the player's device having
synced; hands played on a device that never got back online look unplayed.

## The table

`public.email_prefs`, one row per player who has touched a switch. RLS lets a player read, create
and change their own row. **Column grants** narrow writes to `user_id`, `weekly_digest` and
`daily_reminder`: the `last_sent_*` stamps, the snapshot and the unsubscribe token are written
only by the functions with the service role. `on delete cascade` from `auth.users` means both
delete paths (`delete_own_account()` and the `delete-account` function) take the row with the
account.

## Switching it on (Will)

Do these in order. Nothing is sent until step 6, and nobody sees a switch until step 8.

### 1. Resend

- The verified domain is `mail.playpip.io` (Auth mail uses it). Emails send from
  `hello@mail.playpip.io` with replies to `hello@playpip.io` (`FROM` and `REPLY_TO` in
  `supabase/functions/_shared/email.ts`).
- `RESEND_API_KEY` can be the same key Supabase's SMTP uses, or a separate Sending-access key
  for `mail.playpip.io` if you want to be able to revoke one without the other.
- Resend → Domains → mail.playpip.io → **open tracking off, click tracking off**.

### 2. The table

```bash
pnpm supabase:db:push:dry-run   # should list only 20261007090000_email_prefs.sql
pnpm supabase:db:push
pnpm supabase:generate-types    # replaces the hand-written email_prefs types
```

### 3. Secrets

```bash
CRON_SECRET=$(openssl rand -hex 32); echo "$CRON_SECRET"   # keep it for step 6
supabase secrets set \
  CRON_SECRET="$CRON_SECRET" \
  RESEND_API_KEY=re_xxx \
  EMAIL_ALLOWLIST=you@example.com
```

`EMAIL_ALLOWLIST` (comma-separated) means only those addresses are ever sent anything. Leave it
on until step 7. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by the platform.

### 4. Deploy the functions

```bash
supabase functions deploy send-emails --no-verify-jwt
supabase functions deploy unsubscribe --no-verify-jwt
```

(`supabase/config.toml` already says `verify_jwt = false` for both; the flag just makes it
explicit.)

### 5. Test with one address

Point a local build at production: in `.env.local` set the Supabase pair and
`NEXT_PUBLIC_EMAILS=on`, run `pnpm dev`, sign in with the allowlisted address, and turn on both
switches in Settings → Email. Then:

```bash
FN=https://<project-ref>.supabase.co/functions/v1

# Who is due now, sending nothing:
curl -sX POST "$FN/send-emails" -H "x-cron-secret: $CRON_SECRET" \
  -H 'content-type: application/json' -d '{"dry":true}'

# Who would be due at another time (dry runs only):
curl -sX POST "$FN/send-emails" -H "x-cron-secret: $CRON_SECRET" \
  -H 'content-type: application/json' -d '{"dry":true,"now":"2026-10-12T09:30:00Z"}'

# A real run (the welcome should arrive):
curl -sX POST "$FN/send-emails" -H "x-cron-secret: $CRON_SECRET" \
  -H 'content-type: application/json' -d '{}'
```

To see a reminder or summary on demand, in the SQL editor (your own row only):

```sql
-- clear today's stamps so the one-a-day rule lets another through
update public.email_prefs
   set last_sent_welcome = coalesce(last_sent_welcome, now() - interval '3 days'),
       last_sent_reminder = null, last_sent_digest = null
 where user_id = '<your user id>';
-- make yesterday's Daily the last one played (the next sync from a device may undo this)
update public.profiles
   set state = jsonb_set(state, '{daily,date}', to_jsonb((current_date - 1)::text))
 where user_id = '<your user id>';
```

then run the real `curl` after 18:00 UTC (reminder) or on a Monday after 09:00 UTC (summary).

Unsubscribe: press the link at the foot of the email (page → button), and check both switches
are off in Settings. One-click, as a mail provider sends it:

```bash
curl -sX POST "$FN/unsubscribe?token=<token from the email's link>" \
  -H 'content-type: application/x-www-form-urlencoded' -d 'List-Unsubscribe=One-Click'
```

### 6. Schedule it

Supabase → SQL editor: open `supabase/cron/send-emails.sql`, put the real `CRON_SECRET` into the
`vault.create_secret` line and the project ref into the URL, run it. Don't save the edited file.
Check with `select * from cron.job_run_details order by start_time desc limit 10;`.

### 7. Open it to everybody

```bash
supabase secrets unset EMAIL_ALLOWLIST
```

### 8. Show the switches

GitHub → playpip/pip-web → Settings → Secrets and variables → Actions → Variables:
`NEXT_PUBLIC_EMAILS` = `on`. The next push to `main` builds it in; Settings → Email and the box
at sign-up appear for signed-in players.

**To stop everything:** `select cron.unschedule('pip-send-emails');`. Unset `NEXT_PUBLIC_EMAILS`
to hide the switches again.

## Copy

Short and literal, like the rest of Pip (docs/brand.md). The words live in `render()` in
`_shared/email.ts`, and `tests/email.test.ts` pins what each email may and may not say. No
currency symbol ever, no streak that is not in the profile, no number that is not read.

import { readFileSync, readdirSync } from 'node:fs'
import test from 'ava'

// The database's security model, checked rather than remembered.
//
// Pip holds user data. The publishable key ships in the client bundle and this
// repo is open source, so anybody can call the API as an anonymous user, and
// Row Level Security is the only thing between one player's row and everyone
// else's. `20260803203142_init_profiles.sql` says exactly that at the top, and
// `20260803211903_delete_own_account.sql` lists the four properties that make a
// `security definer` function safe to hand an anon-key client.
//
// Both of those were comments. A comment does not fail a build, and the way
// this model gets undone is not a decision somebody makes, it is a later
// migration written by somebody who did not read the earlier one. So the rules
// live here now, and they are checked against **every** migration rather than
// against the two that exist today: the file that breaks this has not been
// written yet.
//
// What this cannot do: it reads SQL as text, so it proves what we wrote, not
// what the live project is running. `supabase db push` is a separate, manual
// step. The outside-in half of the same question (can an anonymous caller
// actually read a row?) is the CTO repo's `scripts/supabase-canary.mjs`.

const dir = new URL('../supabase/migrations/', import.meta.url)

/** Every migration, comments stripped. A `--` note about a policy is not one. */
const migrations = readdirSync(dir)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => ({
    name,
    sql: readFileSync(new URL(name, dir), 'utf-8').replace(/^\s*--.*$/gm, ' '),
  }))

const all = migrations.map((m) => m.sql).join('\n')

test('there are migrations to check', (t) => {
  // Guards the guard: a bad path here would make every test below vacuously
  // pass, which is the one failure mode a test file like this really has.
  t.true(migrations.length >= 2, `found ${migrations.length} migration files`)
})

// --- every table is protected, and stays protected -------------------------

test('every table we create has row level security turned on', (t) => {
  const tables = [...all.matchAll(/create table (?:if not exists )?public\.(\w+)/gi)].map(
    (m) => m[1],
  )
  t.true(tables.includes('profiles'), 'profiles has stopped being created here')

  for (const table of tables) {
    t.regex(
      all,
      new RegExp(`alter table public\\.${table} enable row level security`, 'i'),
      `public.${table} is created without RLS, so it is world readable`,
    )
  }
})

test('nothing ever turns row level security back off', (t) => {
  for (const { name, sql } of migrations) {
    t.notRegex(sql, /disable row level security/i, name)
    // `force`/`no force` changes whether the table owner is exempt. It is not
    // something we use, and its arrival would mean somebody was working around
    // a policy rather than writing one.
    t.notRegex(sql, /alter table[\s\S]{0,80}no force row level security/i, name)
  }
})

// --- every policy is scoped to the caller ----------------------------------

const policies = [...all.matchAll(/create policy\s+"([^"]+)"\s+on\s+public\.(\w+)([\s\S]*?);/gi)]

test('every policy names the caller, and none of them is open', (t) => {
  t.true(policies.length >= 1, 'no policies found, which cannot be right')

  for (const [, name, table, body] of policies) {
    t.regex(
      body,
      /auth\.uid\(\)/,
      `"${name}" on ${table} does not mention auth.uid(), so it is not scoped to anybody`,
    )
    // `using (true)` is the shape of an accidentally public table. It reads as
    // "no restriction" and it is the single most likely way this breaks.
    t.notRegex(body, /using\s*\(\s*true\s*\)/i, `"${name}" on ${table} is open to everyone`)
    t.notRegex(body, /with check\s*\(\s*true\s*\)/i, `"${name}" on ${table} accepts any write`)
    // A policy without `to` applies to every role, which is what we want. One
    // naming `service_role` would be granting the bypass role a policy, which
    // means somebody has misunderstood which side the webhook writes from.
    t.notRegex(body, /\bto\s+service_role\b/i, `"${name}" on ${table} mentions service_role`)
  }
})

test("a player's profile is reachable by that player and nobody else", (t) => {
  const onProfiles = policies.filter(([, , table]) => table === 'profiles')
  t.is(onProfiles.length, 1, 'profiles should have exactly one policy')

  const [, , , body] = onProfiles[0] as RegExpMatchArray
  // `using` covers reads and the pre-image of a write; `with check` stops a
  // write claiming to be somebody else's row. Both halves, or only half the
  // table is protected.
  t.regex(body, /using\s*\(\s*auth\.uid\(\) = user_id\s*\)/i)
  t.regex(body, /with check\s*\(\s*auth\.uid\(\) = user_id\s*\)/i)
})

test('deleting the account still takes the profile with it', (t) => {
  // The delete path documented on /privacy is this cascade plus
  // delete_own_account(). Losing it would leave rows behind a deleted user,
  // which is a written promise quietly becoming untrue.
  t.regex(all, /user_id\s+uuid primary key references auth\.users on delete cascade/i)
})

// --- the security definer function -----------------------------------------
//
// `security definer` means the body runs as the owner and RLS does not apply to
// it. That is the whole reason it can delete an auth user, and it is why the
// argument list is the only thing standing between "deletes my account" and
// "deletes anybody's account".

const definers = [
  ...all.matchAll(/create (?:or replace )?function public\.(\w+)\s*\(([^)]*)\)([\s\S]*?)\$\$/gi),
].filter(([, , , body]) => /security definer/i.test(body))

test('a security definer function takes no arguments', (t) => {
  t.true(definers.length >= 1, 'delete_own_account() has gone missing')

  for (const [, name, args] of definers) {
    t.is(
      args.trim(),
      '',
      `public.${name}() is security definer and takes arguments, so it can act on a row ` +
        'the caller does not own. If one ever genuinely needs a parameter, the reviewer has ' +
        'to show it cannot reach another user, and this test is the place to record that.',
    )
  }
})

test('a security definer function cannot have its references shadowed', (t) => {
  for (const [, name, , body] of definers) {
    // Without an empty search_path, a table or function planted in another
    // schema can be resolved ahead of the one we meant.
    t.regex(body, /set search_path = ''/i, `public.${name}() does not pin its search_path`)
  }
})

test('delete_own_account is callable only when signed in', (t) => {
  t.regex(all, /revoke execute on function public\.delete_own_account\(\) from public, anon/i)
  t.regex(all, /grant execute on function public\.delete_own_account\(\) to authenticated/i)
  // Belt and braces inside the body: if the grants ever stop being true, this
  // refuses rather than evaluating `id = null` and matching nothing at all.
  t.regex(all, /if uid is null then[\s\S]{0,120}raise exception/i)
  // And the delete is by the caller's own id, never by anything passed in.
  t.regex(all, /delete from auth\.users where id = uid/i)
})

test('nothing else in the schema is granted to anon', (t) => {
  // The anon role is every visitor. It needs no execute grant on anything, and
  // a `grant ... to anon` is worth stopping to look at whatever it is on.
  for (const { name, sql } of migrations) {
    t.notRegex(sql, /^\s*grant\b[^;]*\bto\b[^;]*\banon\b/im, `${name}: grants something to anon`)
  }
})

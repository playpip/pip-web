import test from 'ava'
import { friendly } from '../src/lib/sync/errors'

// The real strings Supabase returns, not paraphrases. If these change upstream
// the mapping quietly degrades to the catch-all, which is survivable; what is
// not survivable is a specific message being answered by the wrong advice.

test('a wrong sign-in is about the pair, not the password', (t) => {
  t.is(friendly('Invalid login credentials'), 'That email and password don’t match.')
})

test('a taken email says so', (t) => {
  t.is(friendly('User already registered'), 'There’s already an account on that email.')
})

test('reusing the current password is not a length complaint', (t) => {
  const out = friendly('New password should be different from the old password.')
  t.is(out, 'That’s the password you already have. Pick a different one.')
})

test('a stale session asking for reauthentication says what to do', (t) => {
  t.is(
    friendly('Reauthentication is needed to change the password'),
    'Sign out and back in, then try again.',
  )
})

test('a short password still gets the length rule', (t) => {
  t.is(
    friendly('Password should be at least 8 characters'),
    'Passwords need to be at least 8 characters.',
  )
})

test('a bad address is about the address', (t) => {
  t.is(
    friendly('Unable to validate email address'),
    'That doesn’t look like a valid email address.',
  )
})

// This one is why the file exists. "Email rate limit exceeded" was reaching the
// email branch first and telling the player their address was malformed.
test('rate limiting asks for patience, even though it says "email"', (t) => {
  t.is(friendly('Email rate limit exceeded'), 'Too many tries. Give it a minute.')
  t.is(
    friendly('For security purposes, you can only request this after 51 seconds.'),
    'Too many tries. Give it a minute.',
  )
})

test('anything else reassures about local progress', (t) => {
  t.is(friendly('fetch failed'), 'Something went wrong. Your progress is safe on this device.')
})

import test from 'ava'
import { friendly, neverReachedServer } from '../src/lib/sync/errors'

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

// `neverReachedServer` decides whether an anonymous event fires. It is the only
// instrument we have for a question nothing here can test: 62% of our views are
// from mainland China, `*.supabase.co` is a third-party origin, and a sign-in
// that never lands looks to us exactly like nobody wanting an account.
//
// The asymmetry is the design. A false positive would send us fixing China for
// a typo, so anything not positively recognised as unreachable reads as
// reached, and the count is a floor.

test('a real HTTP status means the server answered, whatever it said', (t) => {
  // The shapes supabase-js gives an AuthApiError. All of these are working
  // accounts and a player getting something wrong.
  t.false(neverReachedServer({ name: 'AuthApiError', status: 400, message: 'Invalid login' }))
  t.false(neverReachedServer({ name: 'AuthApiError', status: 422, message: 'Weak password' }))
  t.false(neverReachedServer({ name: 'AuthApiError', status: 429, message: 'rate limit' }))
  t.false(neverReachedServer({ name: 'AuthApiError', status: 500, message: 'boom' }))
})

test('a fetch that threw is the thing we are trying to count', (t) => {
  t.true(
    neverReachedServer({ name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' }),
  )
})

test('the name alone is enough, in case the status stops being 0', (t) => {
  // Status 0 is how supabase-js constructs it today, not a promise it makes.
  t.true(neverReachedServer({ name: 'AuthRetryableFetchError', message: 'Load failed' }))
})

test('a status of 0 is enough, in case the name changes', (t) => {
  t.true(neverReachedServer({ name: 'SomethingElse', status: 0 }))
})

test('an unfamiliar error reads as reached, so the count is a floor', (t) => {
  // Every one of these would be a false outage. None may fire the event.
  t.false(neverReachedServer(null))
  t.false(neverReachedServer(undefined))
  t.false(neverReachedServer('fetch failed'))
  t.false(neverReachedServer(new Error('fetch failed')))
  t.false(neverReachedServer({ message: 'no status at all' }))
  t.false(neverReachedServer({ status: '0' }))
})

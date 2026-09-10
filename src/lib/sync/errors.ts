// Supabase's auth errors are developer-facing. These are not.
//
// Pure and separate from the store so it can be tested: there is no store test
// infrastructure, and this is the part most likely to be quietly wrong. The
// order of the checks is the whole logic - the generic "password" catch has to
// come last, or a specific message about the old password gets answered with
// advice about length.

/**
 * Did this auth error come back from Supabase, or did the request never arrive?
 *
 * The two look identical to a player: both are a sign-in that did not work. They
 * are opposite facts about the product. A wrong password means accounts work and
 * this person mistyped. A request that never landed means accounts do not exist
 * for whoever is on that network, and it is invisible to us, because the app
 * shows a generic error and nobody reports it.
 *
 * That distinction is the whole reason this function exists: 62% of our views
 * are from mainland China, `*.supabase.co` is a third-party origin, and no
 * runner and no UK phone can test whether it resolves from there. The only
 * instrument we can build is the app telling us, anonymously, that it tried.
 *
 * The discriminator is the HTTP status. supabase-js gives an `AuthApiError` a
 * real status (400 for a bad password, 422, 429 for a throttle) and gives a
 * fetch that threw an `AuthRetryableFetchError` with status 0. So a positive
 * status is proof the server answered, whatever it said, and anything else is
 * an error that never got an answer.
 *
 * Conservative on purpose, and only in one direction: this returns true only
 * for a shape we positively recognise as a request that got no answer. Anything
 * unfamiliar reads as "reached", so the event under-reports rather than
 * inventing an outage. A number that is too low is a weak signal; a number that
 * is too high would send us fixing China for a typo.
 */
export function neverReachedServer(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { status, name } = error as { status?: unknown; name?: unknown }

  // The server answered, whatever it said. Nothing else matters.
  if (typeof status === 'number' && status > 0) return false

  // supabase-js wraps a fetch that threw. Status is 0 on this by construction,
  // but match the name too: it is the documented type and the status is an
  // implementation detail of the same library.
  if (name === 'AuthRetryableFetchError') return true
  return status === 0
}

export function friendly(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login')) return 'That email and password don’t match.'
  if (m.includes('already registered')) return 'There’s already an account on that email.'
  if (m.includes('different from the old') || m.includes('should be different'))
    return 'That’s the password you already have. Pick a different one.'
  if (m.includes('reauthentication') || m.includes('reauthenticate'))
    return 'Sign out and back in, then try again.'
  // Above the two catch-alls on purpose: Supabase's throttle message is "Email
  // rate limit exceeded", which the email branch was swallowing and answering
  // with advice about the address being malformed.
  if (m.includes('rate limit') || m.includes('too many') || m.includes('for security purposes'))
    return 'Too many tries. Give it a minute.'
  if (m.includes('password')) return 'Passwords need to be at least 8 characters.'
  if (m.includes('email')) return 'That doesn’t look like a valid email address.'
  return 'Something went wrong. Your progress is safe on this device.'
}

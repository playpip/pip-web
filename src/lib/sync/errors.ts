// Supabase's auth errors are developer-facing. These are not.
//
// Pure and separate from the store so it can be tested: there is no store test
// infrastructure, and this is the part most likely to be quietly wrong. The
// order of the checks is the whole logic - the generic "password" catch has to
// come last, or a specific message about the old password gets answered with
// advice about length.

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

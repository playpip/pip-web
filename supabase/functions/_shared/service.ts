// The service-role client for the email functions.
//
// Separate from billing.ts on purpose: that module reads the Stripe secrets at
// import and throws without them, and the email functions must deploy and run
// on a project where billing is not configured.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
// Nothing under src/ may import from here.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export function env(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`${name} is not set`)
  return value
}

export const SUPABASE_URL = env('SUPABASE_URL').replace(/\/+$/, '')

/** Where the `unsubscribe` function answers. Used in List-Unsubscribe. */
export const UNSUBSCRIBE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/unsubscribe`

/** Service role: bypasses RLS. Never returned to a caller and never logged. */
export const admin: SupabaseClient = createClient(SUPABASE_URL, env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
})

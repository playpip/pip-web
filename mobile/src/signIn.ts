// Google and Apple sign-in, natively, handed to the web view as a Supabase
// session (EXPO-PLAN.md, "Sign-in with Google and Apple in the app").
//
// The web's redirect flow can't run here: Google refuses sign-in inside an
// embedded web view (`disallowed_useragent`), and Apple's web page is a worse
// version of the sheet iOS already has. So the system sheet gets an ID token,
// Supabase turns it into a session, and the tokens go back to the page, which
// calls setSession() and carries on exactly as after a web sign-in. The app
// keeps no session of its own afterwards.

import { createClient } from '@supabase/supabase-js'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import { Platform } from 'react-native'

export type Provider = 'google' | 'apple'

type Result =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; cancelled: true }
  | { ok: false; error: string }

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
const GOOGLE_IOS = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
const GOOGLE_WEB = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID

/** Sign in with Apple is iOS only; Android hides the button (EXPO-PLAN.md). */
export const appleAvailable = Platform.OS === 'ios' && Boolean(SUPABASE_URL && SUPABASE_KEY)

/**
 * Google needs the iOS client (for the system sheet) and the web client (so the
 * ID token's audience is the one Supabase checks).
 */
export const googleConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY && GOOGLE_WEB && GOOGLE_IOS)

/** A throwaway client: it signs in once, hands the tokens over and is dropped. */
function supabase() {
  return createClient(SUPABASE_URL ?? '', SUPABASE_KEY ?? '', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

async function apple(): Promise<Result> {
  // Apple gets the nonce's hash and puts it in the token; Supabase gets the raw
  // nonce and checks the two match, so a token can't be replayed.
  const nonce = Crypto.randomUUID()
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce)
  let credential: AppleAuthentication.AppleAuthenticationCredential
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      ],
      nonce: hashed,
    })
  } catch (err) {
    if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') return { ok: false, cancelled: true }
    throw err
  }
  if (!credential.identityToken) return { ok: false, error: 'Apple did not return a token.' }
  return exchange('apple', credential.identityToken, nonce)
}

async function google(): Promise<Result> {
  // Imported here, not at the top: the native module only exists in builds
  // configured with a Google client (app.config.ts), and importing it in one
  // without would throw at startup.
  const { GoogleSignin, isErrorWithCode, statusCodes } = await import(
    '@react-native-google-signin/google-signin'
  )
  GoogleSignin.configure({ iosClientId: GOOGLE_IOS, webClientId: GOOGLE_WEB })
  try {
    const response = await GoogleSignin.signIn()
    if (response.type === 'cancelled') return { ok: false, cancelled: true }
    const token = response.data.idToken
    if (!token) return { ok: false, error: 'Google did not return a token.' }
    // The free Google library can't pass a nonce on iOS; "Skip nonce checks"
    // is on for the Google provider in Supabase for this reason.
    return exchange('google', token)
  } catch (err) {
    if (isErrorWithCode(err) && err.code === statusCodes.IN_PROGRESS) {
      return { ok: false, error: 'Google sign-in is already open.' }
    }
    throw err
  }
}

async function exchange(provider: Provider, token: string, nonce?: string): Promise<Result> {
  const { data, error } = await supabase().auth.signInWithIdToken({ provider, token, nonce })
  if (error || !data.session) return { ok: false, error: error?.message ?? 'No session came back.' }
  return {
    ok: true,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  }
}

export function signIn(provider: Provider): Promise<Result> {
  if (provider === 'apple' && appleAvailable) return apple()
  if (provider === 'google' && googleConfigured) return google()
  return Promise.resolve({ ok: false, error: `${provider} sign-in isn't set up in this build.` })
}

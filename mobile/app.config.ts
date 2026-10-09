// app.json is the config; this adds the parts that depend on IDs which are set
// per environment (eas.json `env`, or mobile/.env.local for `expo start`).
//
// Google sign-in's native plugin refuses to build without the iOS client's URL
// scheme, so it is only added once EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is set.
// Until then the app doesn't offer Google (src/bridge.ts leaves it out of
// `supports`) and the web hides the button in the app.

import type { ConfigContext, ExpoConfig } from 'expo/config'

/** `123-abc.apps.googleusercontent.com` → `com.googleusercontent.apps.123-abc` */
function reversed(clientId: string): string {
  return clientId.split('.').reverse().join('.')
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleIos = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  const plugins = [...(config.plugins ?? [])]
  if (googleIos) {
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: reversed(googleIos) }])
  }
  return { ...(config as ExpoConfig), plugins }
}

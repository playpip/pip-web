# Pip — iOS and Android

The store app: an Expo shell around the web app in a web view. The plan and the
reasoning are in `EXPO-PLAN.md`.

This folder has its own **npm** install, separate from the web app's pnpm one, so
the Cloudflare build never pulls in React Native.

```bash
cd mobile
npm install
npx expo start        # scan the QR code with Expo Go
```

By default it loads https://playpip.io. To try unreleased web changes, run
`pnpm dev` in the web app and point the shell at it over your network:

```bash
EXPO_PUBLIC_SITE_URL=http://<your-mac's-LAN-IP>:3000 npx expo start
```

## The bridge

The web side is `src/lib/nativeApp.ts` in the web app; the native side is
`src/bridge.ts` here. The shell injects `window.PipApp` before the page loads,
and the page sends messages with `window.ReactNativeWebView.postMessage`.

| Message | What the shell does |
|---------|---------------------|
| `haptic { buzz }` | Plays the cue with `expo-haptics` |
| `signIn { provider }` → session | Apple or Google sign-in natively, exchanged for a Supabase session (`src/signIn.ts`) |
| `products` → prices | The store's prices for monthly and yearly (`src/purchases.ts`) |
| `purchase { plan, userId }` | Buys through RevenueCat as that Supabase user |
| `restore { userId }` | Restore purchases, which Apple requires |

Web deploys reach the app straight away and the app only updates on a store
release, so the shell ignores any message type it doesn't know, and lists the
ones it does in `window.PipApp.supports`. The web checks `appSupports(type)`
before relying on one and falls back to the website flow when it's missing.
A new message type goes in `SUPPORTS` in `src/bridge.ts` in the same change
that handles it.

## Camera and microphone

Private tables can turn on a camera and mic (WebRTC `getUserMedia`, only after
the player taps to turn one on). The shell supports it with:

- iOS: `NSCameraUsageDescription` and `NSMicrophoneUsageDescription` in
  `app.json` → `ios.infoPlist`, and `mediaCapturePermissionGrantType=
  "grantIfSameHostElseDeny"` on the web view (`App.tsx`), so the player sees
  iOS's prompt once and no extra WebKit prompt each session.
- Android: `CAMERA`, `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` in
  `app.json` → `android.permissions`. react-native-webview asks for the runtime
  permission itself when the page calls `getUserMedia`, so there's no message
  for it.
- `media` in `SUPPORTS`. The web hides the camera and mic controls without it.

- iOS: `modules/pip-speaker`, a local Expo module. Once the camera or mic is
  on, WebKit puts the app's audio in call mode and iOS sends it to the
  earpiece; the module moves it back to the loudspeaker on every route change
  (headphones and Bluetooth are left alone). Autolinked from `modules/`, and
  started from `App.tsx`. It isn't in Expo Go, so check it in a development
  build.

These are native settings, so they need a new store build (EAS build and
submit), not an over-the-air update. Until people update, their app doesn't
list `media` and the web keeps the controls hidden.

## Icons and splash

- iOS uses `assets/pip.icon`, a copy of the Icon Composer source in
  `design/pip.icon`. Re-copy it when the design changes.
- Android's adaptive icon and the top-level `icon.png` are cut from
  `public/icons/icon-source-1024.png`; the splash chip is `src/app/icon.svg`.
- Expo Go shows its own icon and splash. Seeing these needs a development
  build.

Always use `npx expo install <package>` here, not `npm install`. It picks the
version that matches the Expo SDK.

## Setup that needs the accounts

The code for all of this is in place. Each part switches on once its IDs exist; until then
the app leaves it out of `supports` and the website hides it.

**Sign in with Apple** (works in the first build)
- In Supabase → Auth → Providers → Apple, add the bundle ID `io.playpip.app` to **Client
  IDs**, after the web Services ID. EAS turns on the Sign in with Apple capability for the
  App ID during the build.

**Google sign-in**
- In the Google Cloud project used for the web sign-in, create an **iOS** OAuth client with
  bundle ID `io.playpip.app`.
- Add its client ID to the Supabase Google provider's **Client IDs**, and turn on **Skip
  nonce checks** for Google.
- Add to `eas.json` → `build.base.env` (and `mobile/.env.local` for local runs):
  `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (the iOS client) and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
  (the existing web client). Then build again; Google needs a store build, not just an
  over-the-air update.

**In-app purchases**
1. App Store Connect → the app → Subscriptions: one subscription group ("Pip Membership"),
   two auto-renewable subscriptions with product IDs `io.playpip.app.member.monthly` (1 month)
   and `io.playpip.app.member.yearly` (1 year). Price them to match the website, £5.99 and
   £49. Each needs a display name, description and review screenshot, and goes in with the
   first build that sells them.
2. RevenueCat: a project with the iOS app (bundle ID, App Store Connect in-app purchase key),
   an entitlement called **`member`** with both products attached, and a current offering
   with a **monthly** and an **annual** package.
3. RevenueCat → Integrations → Webhooks: URL
   `https://<project>.supabase.co/functions/v1/revenuecat-webhook`, Authorization header set
   to a long random secret.
4. Supabase: `supabase db push` (adds `memberships.source`), then
   `supabase secrets set REVENUECAT_WEBHOOK_AUTH='<the same secret>' REVENUECAT_SECRET_KEY='<RevenueCat secret API key>'`
   and `supabase functions deploy revenuecat-webhook stripe-webhook`.
5. Add `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (RevenueCat's public iOS SDK key) to `eas.json` →
   `build.base.env`, and build again.

**Builds**
```bash
npx eas-cli@latest build --platform ios --profile production --auto-submit   # TestFlight
npx eas-cli@latest build --platform ios --profile development               # dev build for your phone
```

**Ships in 1.0.0.** The camera and microphone permissions are in the app's first store build,
so no installed version ever lacks them. Once the app is out, any later change to native
permissions needs a version bump: `runtimeVersion` follows the app version, and an
over-the-air update must never reach a build without the permissions it relies on.

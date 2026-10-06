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

Web deploys reach the app straight away and the app only updates on a store
release, so the shell ignores any message type it doesn't know.

Always use `npx expo install <package>` here, not `npm install`. It picks the
version that matches the Expo SDK.

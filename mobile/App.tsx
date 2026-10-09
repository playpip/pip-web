// Phase 0/1 (EXPO-PLAN.md): Pip's web build inside a native shell.
//
// Remote mode: the web view loads the live site, so every web deploy reaches
// the app with no store release. Set EXPO_PUBLIC_SITE_URL to point it at a dev
// server on your network instead (e.g. http://192.168.1.20:3000).

import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef } from 'react'
import { BackHandler, Linking, Platform, StyleSheet, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import { handleMessage, injectedFlag } from './src/bridge'
import { Offline } from './src/Offline'

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://playpip.io'

// Matches `background_color` in src/app/manifest.ts, so there's no white flash
// before the first paint.
const BACKGROUND = '#0a0a0b'

// Where the app opens. Same as the PWA's `start_url` in src/app/manifest.ts:
// the game, not the marketing landing page.
const START_URL = `${SITE_URL}/game`

// iOS draws the web view edge to edge, so the felt runs behind the notch and
// the home bar and the page pads itself clear of them (globals.css, keyed on
// data-pip-app). Android keeps native safe-area padding for now: its web view
// doesn't reliably report the insets to CSS.
const Frame = Platform.OS === 'ios' ? View : SafeAreaView

const isOwnSite = (url: string) => url.startsWith(SITE_URL) || url === 'about:blank'

export default function App() {
  const webView = useRef<WebView>(null)
  const canGoBack = useRef(false)

  // Answers go back into the page by id; nativeApp.ts on the web side resolves
  // the request that is waiting for it.
  const reply = (id: string, payload: unknown) => {
    webView.current?.injectJavaScript(
      `window.__pipAppReply && window.__pipAppReply(${JSON.stringify(id)}, ${JSON.stringify(payload)}); true;`,
    )
  }

  // Android's back button walks the web view's history, and only leaves the
  // app once there's nothing left to go back to.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack.current) return false
      webView.current?.goBack()
      return true
    })
    return () => sub.remove()
  }, [])

  return (
    <SafeAreaProvider>
      <Frame style={styles.root} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <WebView
          ref={webView}
          source={{ uri: START_URL }}
          style={styles.root}
          originWhitelist={['https://*', 'http://*']}
          injectedJavaScriptBeforeContentLoaded={injectedFlag}
          // No connection, or the site is down: Pip's own screen with a retry,
          // never a browser-style error page.
          renderError={() => <Offline onRetry={() => webView.current?.reload()} />}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          onMessage={(e) => {
            // Only Pip's own pages may ask: a sign-in reply carries a full
            // session, and a purchase spends the player's money.
            if (!isOwnSite(e.nativeEvent.url)) return
            handleMessage(e.nativeEvent.data, reply)
          }}
          onNavigationStateChange={(nav) => {
            canGoBack.current = nav.canGoBack
          }}
          // iOS's springy scroll stays on. The page turns it off where it
          // shouldn't happen (the felt) with overscroll-behavior in CSS.
          decelerationRate="normal"
          setBuiltInZoomControls={false}
          // Web Audio cues play on a tap, not on load.
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          // Off-site links (Stripe, socials) go to the system browser, whether
          // they navigate the page or open a new window.
          onShouldStartLoadWithRequest={(req) => {
            if (isOwnSite(req.url)) return true
            Linking.openURL(req.url)
            return false
          }}
          onOpenWindow={(e) => Linking.openURL(e.nativeEvent.targetUrl)}
        />
      </Frame>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BACKGROUND },
})

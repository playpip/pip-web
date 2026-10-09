// What the app shows when Pip can't be reached: no connection, or the site is
// down. Native, so it never looks like a browser's error page, and in Pip's
// own look (the chip on the near-black, quiet text, one button).

import { Image, Pressable, StyleSheet, Text, View } from 'react-native'

export function Offline({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.root}>
      <Image source={require('../assets/splash-icon.png')} style={styles.chip} />
      <Text style={styles.title}>Can’t reach the table</Text>
      <Text style={styles.body}>
        Pip needs a connection to open. Check you’re online, then try again.
      </Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
    backgroundColor: '#0a0a0b',
  },
  chip: { width: 56, height: 56, marginBottom: 8 },
  title: { color: '#fafafa', fontSize: 20, fontWeight: '600' },
  body: { color: '#a1a1aa', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  button: {
    marginTop: 12,
    height: 48,
    paddingHorizontal: 28,
    borderRadius: 16,
    backgroundColor: '#fafafa',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  buttonText: { color: '#0a0a0b', fontSize: 16, fontWeight: '600' },
})

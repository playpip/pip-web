import test from 'ava'
import { AVATAR_BG_SWATCHES, accentFromSwatch } from '@/lib/avatar'

// accentFromSwatch parses a `#rrggbb`/`rrggbb` swatch, converts to HSL, then
// re-emits an accent at a fixed lightness (L = 0.55) with saturation clamped to
// [0.45, 0.72] — same hue, darker and more vivid. It is pure integer/float math
// terminating in a hex string, with no locale, timezone, or Intl dependency, so
// the exact strings asserted below are deterministic on every platform (unlike
// formatChips in useMoney.test.ts, whose output is locale-sensitive in general).
//
// The expected values were produced by executing the real function on each
// input, not derived by hand — they pin the function's actual behaviour so a
// change to the colour math is caught.
//
// Malformed swatches take the guard's early return and yield the pip brand
// accent `#7c8cf0` (the `--color-pip` token). The accent path never emits that
// exact string for a valid swatch, so the fallback is unambiguous.

const HEX = /^#[0-9a-f]{6}$/

test('each of the six avatar swatches maps to a distinct valid accent', (t) => {
  const expected: Record<(typeof AVATAR_BG_SWATCHES)[number], string> = {
    b6e3f4: '#3ab2df', // sky   → blue
    c0aede: '#7f59c0', // lilac → purple
    d1f4d0: '#49d345', // mint  → green
    ffd5dc: '#df3a55', // blush → rose
    ffdfbf: '#df8c3a', // peach → orange
    f4e7b6: '#dfbc3a', // sand  → yellow
  }
  for (const swatch of AVATAR_BG_SWATCHES) {
    t.is(accentFromSwatch(swatch), expected[swatch])
    t.regex(accentFromSwatch(swatch), HEX)
  }
  // All six accents are different from one another.
  const accents = AVATAR_BG_SWATCHES.map(accentFromSwatch)
  t.is(new Set(accents).size, AVATAR_BG_SWATCHES.length)
})

test('a leading "#" is accepted and does not change the result', (t) => {
  // The guard strips a single leading "#" before validating.
  t.is(accentFromSwatch('#b6e3f4'), accentFromSwatch('b6e3f4'))
  t.is(accentFromSwatch('#b6e3f4'), '#3ab2df')
})

test('hex parsing is case-insensitive', (t) => {
  t.is(accentFromSwatch('B6E3F4'), '#3ab2df')
  t.is(accentFromSwatch('#B6E3F4'), '#3ab2df')
  t.is(accentFromSwatch('FFD5DC'), accentFromSwatch('ffd5dc'))
})

test('malformed swatches fall back to the pip accent #7c8cf0', (t) => {
  // Empty, non-hex, and wrong-length inputs all fail the /^[0-9a-f]{6}$/ check.
  t.is(accentFromSwatch(''), '#7c8cf0')
  t.is(accentFromSwatch('nope'), '#7c8cf0')
  t.is(accentFromSwatch('#12'), '#7c8cf0')
  t.is(accentFromSwatch('12'), '#7c8cf0')
  t.is(accentFromSwatch('zzzzzz'), '#7c8cf0') // six chars, but not hex digits
  t.is(accentFromSwatch('b6e3f'), '#7c8cf0') // five hex digits (too short)
  t.is(accentFromSwatch('b6e3f44'), '#7c8cf0') // seven hex digits (too long)
})

test('whitespace is NOT trimmed, so padded swatches are treated as malformed', (t) => {
  // Only "#" is stripped; surrounding spaces survive and fail validation.
  t.is(accentFromSwatch('#b6e3f4 '), '#7c8cf0')
  t.is(accentFromSwatch(' b6e3f4'), '#7c8cf0')
})

test('hue is preserved while darkening — a blue swatch stays blue, not red', (t) => {
  const accent = accentFromSwatch('b6e3f4') // pale sky blue
  t.is(accent, '#3ab2df')
  const r = Number.parseInt(accent.slice(1, 3), 16)
  const g = Number.parseInt(accent.slice(3, 5), 16)
  const b = Number.parseInt(accent.slice(5, 7), 16)
  // Blue dominates and the red channel is the smallest: still unmistakably blue.
  t.true(b > g)
  t.true(g > r)
})

test('pure RGB primaries keep their dominant channel', (t) => {
  t.is(accentFromSwatch('ff0000'), '#df3a3a') // red   stays red
  t.is(accentFromSwatch('00ff00'), '#3adf3a') // green stays green
  t.is(accentFromSwatch('0000ff'), '#3a3adf') // blue  stays blue
})

test('achromatic swatches (no hue) all collapse to the same red-ish accent', (t) => {
  // With delta = 0 the code leaves hue = 0 and saturation = 0; saturation is
  // then floored to 0.45 at hue 0, so black, white and grey all emit #c05959.
  t.is(accentFromSwatch('000000'), '#c05959')
  t.is(accentFromSwatch('ffffff'), '#c05959')
  t.is(accentFromSwatch('808080'), '#c05959')
})

test('a valid swatch never coincidentally returns the fallback string', (t) => {
  // Even feeding in the fallback colour itself yields a derived accent, not the
  // literal `#7c8cf0` — confirming the fallback marks the malformed path only.
  t.is(accentFromSwatch('7c8cf0'), '#3a50df')
  t.not(accentFromSwatch('7c8cf0'), '#7c8cf0')
})

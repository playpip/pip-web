import { readFileSync, readdirSync } from 'node:fs'
import test from 'ava'

// Sync shipped on 3 August 2026 and made one sentence false everywhere it was
// still written in the absolute: your profile *can* leave your device now, if
// you ask it to. The copy that shipped with sync was corrected. The copy that
// predated it was not, so the landing page spent a fortnight promising "your
// profile never leaves your device" four sections below a trust strip offering
// to back your progress up to every device. Every individual fact on that page
// was true and the page still argued with itself.
//
// The honest form already existed on /privacy and is the one this file enforces:
// nothing leaves your device *unless you ask it to*. So the rule is not that the
// phrases below are banned, it is that they never appear naked. Say where the
// data lives and the sentence has to carry the exception with it.

/** The absolutes. Each is true of a player who has never touched sync. */
const CLAIMS = [
  /(nothing|never) leaves your (device|browser)/i,
  /(profile|progress|data) never leaves/i,
  /only on your device/i,
  /not our server/i,
]

/** What makes one of them honest, within eye-line of the claim itself. */
const QUALIFIER = /unless|if you ask|switch sync on|turn sync on|sync is off/i

/** How far either side of a match we will look for the exception. */
const WINDOW = 180

/**
 * Blog posts are dated records of what was true on the day, and there is
 * already a post about sync arriving. Correcting them is rewriting history;
 * `two-devices-two-chip-counts` is the correction.
 */
const SKIP = /\/blog\//

function surfaces(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(new URL(dir, import.meta.url), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) surfaces(path, out)
    else if (/\.tsx?$/.test(entry.name) && !SKIP.test(path)) out.push(path)
  }
  return out
}

test('nothing claims your data stays put without naming the exception', (t) => {
  const files = [...surfaces('../src/app'), ...surfaces('../src/components/marketing')]
  t.true(files.length > 20, 'the walk found nothing, so it is proving nothing')

  for (const file of files) {
    // JSX wraps a sentence across lines, so the phrase only exists once the
    // whitespace is flattened. Matching the raw source misses every claim that
    // happens to straddle a line break, which is most of them.
    const source = readFileSync(new URL(file, import.meta.url), 'utf-8').replace(/\s+/g, ' ')
    for (const claim of CLAIMS) {
      const match = claim.exec(source)
      if (!match) continue
      const from = Math.max(0, match.index - WINDOW)
      const context = source.slice(from, match.index + match[0].length + WINDOW)
      t.regex(
        context,
        QUALIFIER,
        `${file}: "${match[0]}" is stated absolutely, and sync makes it false`,
      )
    }
  }
})

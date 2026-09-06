import { readFileSync, readdirSync } from 'node:fs'
import test from 'ava'

// Motion is a setting, and the drills screens have to honour it.
//
// A player who asked their OS for less motion asked once, for everything. Both
// drills screens animate on mount and neither used to check: the room's tiles
// stagger in on a delay, the spot slides in on every answer, the reveal panel
// and the next button come up, and the rating delta flies (pip-web#76).
//
// `<MotionConfig reducedMotion="user">` makes framer-motion respect the setting
// for a whole subtree, which is the pattern `learn/Tutorial.tsx` already uses,
// so the rule is that a file animating with framer-motion also declares it.
//
// The second half is the part the wrapper cannot do. `MotionConfig` has no
// reach into a Tailwind class, so a tap that scales a button keeps scaling
// whatever the setting says. Those need the `motion-reduce` variant spelled
// out, and pairing the counts is what stops the next one being added without
// it: the failure mode here is silent and invisible to anyone not using the
// setting, which is exactly the kind that survives a code review.
//
// **This is mechanical, not verified.** Nothing in CI has a browser or an OS
// accessibility setting. It proves the wrapper and the variants are present. It
// does not prove the screens sit still, and that still needs somebody to turn
// the setting on and look.

const sources = () =>
  readdirSync(new URL('../src/components/drills', import.meta.url)).map(
    (f) => `src/components/drills/${f}`,
  )

/** A file with its comments taken out, so a note about motion is not evidence of any. */
const code = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')

test('anything in the drills screens that animates honours reduce motion', (t) => {
  let checked = 0
  for (const path of sources()) {
    const source = code(path)
    if (!source.includes('framer-motion')) continue
    checked++
    // `<MotionConfig`, not `MotionConfig`. The import alone matched the first
    // version of this test, so deleting the wrapper and leaving the import
    // behind, which is what a tidy-up does, passed it.
    t.regex(source, /<MotionConfig\b/, `${path}: animates without honouring the setting`)
  }
  // Both screens animate today. If this ever reads zero the test above has
  // stopped looking at anything and is quietly passing on an empty loop.
  t.true(checked >= 2, `only ${checked} drills files animate, so this proved almost nothing`)
})

test('every tap scale in the drills screens has a motion-reduce variant', (t) => {
  let scales = 0
  for (const path of sources()) {
    const source = code(path)
    const found = source.match(/active:scale-\[/g)?.length ?? 0
    const guarded = source.match(/motion-reduce:active:scale-100/g)?.length ?? 0
    scales += found
    t.is(found, guarded, `${path}: ${found} tap scales, ${guarded} behind motion-reduce`)
  }
  t.true(scales >= 4, `only ${scales} tap scales found, so this proved almost nothing`)
})

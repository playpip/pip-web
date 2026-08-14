import { readdirSync, readFileSync, statSync } from 'node:fs'
import test from 'ava'
import {
  DEFAULT_TEXT_SCALE,
  effectiveTextScale,
  isTableRoute,
  parseTextScale,
  rootFontSize,
  TABLE_MAX_TEXT_SCALE,
  TEXT_SCALES,
  textScaleLabel,
} from '@/lib/textScale'
import { TEXT_SCALE_BOOT_SCRIPT } from '@/components/text-scale-provider'

test('the scale reaches 200%, which is what WCAG 1.4.4 requires', (t) => {
  t.true(TEXT_SCALES.includes(200))
  t.is(DEFAULT_TEXT_SCALE, TEXT_SCALES[0])
  // Monotonic, so the control reads left to right.
  for (let i = 1; i < TEXT_SCALES.length; i++) {
    t.true(TEXT_SCALES[i] > TEXT_SCALES[i - 1])
  }
})

test('anything stored that we do not recognise falls back to 100%', (t) => {
  for (const step of TEXT_SCALES) {
    t.is(parseTextScale(String(step)), step)
  }
  for (const junk of [null, undefined, '', 'large', '175', '0', 'NaN', '  ']) {
    t.is(parseTextScale(junk), DEFAULT_TEXT_SCALE)
  }
})

test('the root font size is a percentage, never px', (t) => {
  // px would replace the reader's own browser font size instead of multiplying
  // it, which takes the setting away from exactly the people it is for.
  for (const step of TEXT_SCALES) {
    t.is(rootFontSize(step), `${step}%`)
    t.false(rootFontSize(step).includes('px'))
  }
  t.is(textScaleLabel(200), '200%')
})

// --- the table cap ---------------------------------------------------------

test('the table caps at 150%, and nothing else does', (t) => {
  // Will played a hand at 200% on a phone: "150% is just about playable but not
  // 200%" (technology#57). The felt cannot reflow (nine seats, a board and an
  // action row have to be on screen at once), so it stops where it stops
  // working, and every reading surface still reaches the 200% WCAG 1.4.4 asks
  // for. Dropping the top step instead would have cost the whole app that.
  t.is(TABLE_MAX_TEXT_SCALE, 150)
  t.true(
    (TEXT_SCALES as readonly number[]).includes(TABLE_MAX_TEXT_SCALE),
    'the cap is a real step',
  )
  t.true(TABLE_MAX_TEXT_SCALE < 200, 'a cap at the top step would not be a cap')

  for (const path of ['/play/kitchen', '/play/kitchen/', '/play/challenge-high']) {
    t.true(isTableRoute(path))
    t.is(effectiveTextScale(200, path), TABLE_MAX_TEXT_SCALE)
    // Below the cap the table is left alone.
    t.is(effectiveTextScale(125, path), 125)
    t.is(effectiveTextScale(150, path), 150)
  }

  for (const path of [
    '/',
    '/game',
    '/learn/starting-hands',
    '/stats',
    '/tutorial',
    '/play',
    null,
  ]) {
    t.false(isTableRoute(path))
    t.is(effectiveTextScale(200, path), 200)
  }
})

test('the boot script applies the cap before first paint', (t) => {
  // The provider's effect runs after paint, so a hard refresh straight on to a
  // resumed table would draw the felt at 200% and then jump. The inline script
  // has to know about the cap itself.
  const run = (stored: string | null, pathname: string): string => {
    const style: { fontSize: string } = { fontSize: '' }
    new Function('localStorage', 'location', 'document', TEXT_SCALE_BOOT_SCRIPT)(
      { getItem: () => stored },
      { pathname },
      { documentElement: { style } },
    )
    return style.fontSize
  }

  t.is(run('200', '/play/kitchen'), '150%')
  t.is(run('200', '/game'), '200%')
  t.is(run('150', '/play/kitchen'), '150%')
  t.is(run('125', '/play/kitchen'), '125%')
  // 100 and junk are left alone, so the reader's own browser default stands.
  t.is(run('100', '/game'), '')
  t.is(run(null, '/game'), '')
  t.is(run('175', '/game'), '')
})

// ---------------------------------------------------------------------------

const SRC = new URL('../src/', import.meta.url)

function sourceFiles(dir: URL): URL[] {
  return readdirSync(dir).flatMap((name) => {
    const entry = new URL(name, dir)
    if (statSync(entry).isDirectory()) return sourceFiles(new URL(`${name}/`, dir))
    return /\.tsx?$/.test(name) ? [entry] : []
  })
}

test('no text is sized in px, so the setting reaches all of it', (t) => {
  // A font size written in pixels is frozen whatever the root font size is.
  // One caption left behind while the paragraph around it doubles is the loss
  // of content WCAG 1.4.4 is about, and it is invisible until someone turns
  // the setting on. Repeated sizes have tokens (globals.css), one-offs use rem.
  const offenders: string[] = []
  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, 'utf-8')
    for (const match of source.matchAll(/text-\[[0-9.]+px\]/g)) {
      offenders.push(`${file.pathname.split('/src/')[1]}: ${match[0]}`)
    }
  }
  t.deepEqual(offenders, [], `use a rem size or a token instead:\n${offenders.join('\n')}`)
})

test('the dialog primitive caps itself at the viewport and scrolls', (t) => {
  // A dialog is centred with a transform, so content taller than the screen
  // spills off the top *and* the bottom with no way to reach either. At 200%
  // most of them are taller than a phone, which is how a fix for WCAG 1.4.4
  // turns into a new loss of content. The cap plus the scroll is the fix; the
  // column flex is what lets a body shrink instead of pushing the header off.
  const source = readFileSync(new URL('components/ui/dialog.tsx', SRC), 'utf-8')
  const popup = source.split('data-slot="dialog-content"')[1]?.split('{...props}')[0] ?? ''
  for (const required of ['max-h-[calc(100dvh-2rem)]', 'overflow-y-auto', 'flex-col']) {
    t.true(popup.includes(required), `dialog-content lost ${required}`)
  }
})

test('a dialog scroll region capped in vh can still give way', (t) => {
  // `max-h-[62vh]` is the look at 100%. Without `min-h-0` beside it the region
  // refuses to shrink when the header and footer around it double, and the
  // dialog goes back to overflowing the screen.
  const offenders: string[] = []
  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, 'utf-8')
    for (const [, , classes] of source.matchAll(/(['"`])([^'"`]*max-h-\[[0-9.]+vh\][^'"`]*)\1/g)) {
      if (!classes.includes('min-h-0')) {
        offenders.push(`${file.pathname.split('/src/')[1]}: ${classes.trim()}`)
      }
    }
  }
  t.deepEqual(offenders, [], `add min-h-0 alongside the cap:\n${offenders.join('\n')}`)
})

import { readdirSync, readFileSync, statSync } from 'node:fs'
import test from 'ava'
import {
  DEFAULT_TEXT_SCALE,
  parseTextScale,
  rootFontSize,
  TEXT_SCALES,
  textScaleLabel,
} from '@/lib/textScale'

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

import { readdirSync, readFileSync } from 'node:fs'
import test from 'ava'

// `sync-auth-unreachable` counts tabs whose sign-in got no answer from
// Supabase. On its own it is a count, and a count cannot answer the question it
// was built for: 40 blocked tabs is a crisis at 100 attempts and a rounding
// error at 40,000. `sync-auth-attempt` is the denominator, and the two are only
// a rate if every path that can send the numerator has already sent it.
//
// It shipped without one, and nobody could see that from the call site: the
// event reads fine on its own line. So the gate is here rather than in a
// comment.
//
// What this proves, and what it does not. It counts call sites per file and
// checks the first attempt precedes the first unreachable. That catches the
// realistic mistake, which is a new auth path (a reset, a re-auth, a magic
// link) sending the numerator and forgetting the denominator. It does not walk
// the control flow, so two attempt calls in one branch and none in another
// would pass. If you find yourself writing that, the counting is not the
// problem.

const NUMERATOR = "trackOnce('sync-auth-unreachable')"
const DENOMINATOR = "trackOnce('sync-auth-attempt')"

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(new URL(dir, import.meta.url), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) sourceFiles(path, out)
    else if (/\.tsx?$/.test(entry.name)) out.push(path)
  }
  return out
}

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf-8')
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

const FILES = sourceFiles('../src')
const SENDERS = FILES.filter((path) => read(path).includes(NUMERATOR))

test('the walk found the numerator, so a pass means something', (t) => {
  t.true(FILES.length > 100, 'the source walk found almost nothing')
  t.true(
    SENDERS.length > 0,
    `nothing sends ${NUMERATOR}. If it was deliberately removed, delete this file and the ` +
      'attempt event with it, because the denominator on its own measures nothing.',
  )
})

test('every file sending the numerator sends the denominator at least as often', (t) => {
  for (const path of SENDERS) {
    const source = read(path)
    const numerators = count(source, NUMERATOR)
    const denominators = count(source, DENOMINATOR)
    t.true(
      denominators >= numerators,
      `${path} sends sync-auth-unreachable ${numerators} time(s) and sync-auth-attempt ` +
        `${denominators}. Every auth path that can report a request going unanswered has to ` +
        'count the attempt too, or the share is unknowable.',
    )
  }
})

test('the attempt is counted before the failure it is the denominator for', (t) => {
  for (const path of SENDERS) {
    const source = read(path)
    t.true(
      source.indexOf(DENOMINATOR) < source.indexOf(NUMERATOR),
      `${path} reports an unreachable sign-in before it has counted an attempt`,
    )
  }
})

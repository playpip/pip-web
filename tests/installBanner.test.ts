import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import test from 'ava'
import { installBannerDue, installBannerRoute } from '@/lib/installBanner'

const DAY = 24 * 60 * 60 * 1000

test('the banner shows on the lobby and reading pages', (t) => {
  for (const p of ['/', '/game', '/learn', '/learn/pot-odds', '/blog/deal-me-in', '/membership'])
    t.true(installBannerRoute(p), p)
})

test('the banner never shows at a table, a drill, a lesson or the welcome steps', (t) => {
  for (const p of [
    '/play/pub',
    '/game/room',
    '/game/side',
    '/game/rail',
    '/game/blackjack',
    '/game/drills/outs',
    '/game/lessons/one',
    '/welcome',
    '/tutorial',
    '/hand',
  ])
    t.false(installBannerRoute(p), p)
})

test('a first visit never sees it', (t) => {
  t.false(installBannerDue(1, null))
  t.true(installBannerDue(2, null))
})

// "No nagging. Ever." (Landing.tsx): nothing comes back after its close button.
test('once closed it never comes back, however long ago', (t) => {
  for (const at of [0, 1, 30 * DAY, 365 * DAY]) t.false(installBannerDue(5, at), String(at))
})

// Safari's Smart App Banner is opted into per page (APP_BANNER), so it can only
// show where the Android banner may. Each file that carries it must sit on an
// allowed route, and the root layout must not set it for the whole site.
test("Safari's app banner is only on pages the Android banner allows", (t) => {
  const root = 'src/app'
  const carriers: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (
        /^(page|layout)\.tsx$/.test(name) &&
        readFileSync(full, 'utf8').includes('APP_BANNER')
      )
        carriers.push(full)
    }
  }
  walk(root)
  t.true(carriers.length > 0)
  for (const file of carriers) {
    // src/app/game/(lobby)/page.tsx -> /game ; route groups and dynamic segments
    const route =
      `/${file
        .slice(root.length + 1)
        .replace(/(^|\/)(page|layout)\.tsx$/, '')
        .replace(/\([^)]*\)\/?/g, '')}`.replace(/\/$/, '') || '/'
    t.true(installBannerRoute(route), `${file} (${route}) carries the app banner`)
  }
  t.notRegex(readFileSync(join(root, 'layout.tsx'), 'utf8'), /itunes:|\.\.\.APP_BANNER/)
})

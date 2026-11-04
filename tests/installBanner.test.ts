import test from 'ava'
import {
  INSTALL_BANNER_SNOOZE_DAYS,
  installBannerDue,
  installBannerRoute,
} from '@/lib/installBanner'

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
  t.false(installBannerDue(1, null, 0))
  t.true(installBannerDue(2, null, 0))
})

test('closing it keeps it away for 30 days', (t) => {
  const now = 100 * DAY
  t.false(installBannerDue(5, now - (INSTALL_BANNER_SNOOZE_DAYS - 1) * DAY, now))
  t.true(installBannerDue(5, now - INSTALL_BANNER_SNOOZE_DAYS * DAY, now))
})

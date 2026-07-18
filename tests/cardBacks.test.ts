import test from 'ava'
import { CARD_BACKS, DEFAULT_CARD_BACK, cardBackById, nearestCardBack } from '@/config/cardBacks'

test('the free set stays a slim starter spread with unique ids', (t) => {
  t.is(CARD_BACKS.length, 5)
  t.is(new Set(CARD_BACKS.map((d) => d.id)).size, 5)
})

test('unknown ids fall back to the default design', (t) => {
  t.is(cardBackById('nope'), DEFAULT_CARD_BACK)
  t.is(cardBackById('midnight').name, 'Midnight')
})

test('nearestCardBack maps the old free-form palette onto sensible designs', (t) => {
  // Old picker colours (pre-v8 profiles) land on the closest curated free tone.
  // The cool blues/greys (ocean, slate) left the free set for the shop, so those
  // legacy colours now settle on the nearest remaining free design.
  t.is(nearestCardBack('#C39A3E').id, 'sand') // old ochre → sand
  t.is(nearestCardBack('#4E6E99').id, 'ivy') // old denim → nearest free tone
  t.is(nearestCardBack('#6B7280').id, 'ivy') // old stone → nearest free tone
  // Garbage input falls back to the default rather than crashing.
  t.is(nearestCardBack(undefined), DEFAULT_CARD_BACK)
  t.is(nearestCardBack('not-a-colour'), DEFAULT_CARD_BACK)
})

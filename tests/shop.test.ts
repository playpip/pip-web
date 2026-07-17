import test from 'ava'
import { SHOP_ITEMS, SOUVENIRS, TABLE_FINISHES, tableFinishById } from '@/config/shop'
import {
  ALL_CARD_BACKS,
  CARD_BACKS,
  EARNED_BACKS,
  SHOP_BACKS,
  cardBackUnlocked,
  cardBackById,
} from '@/config/cardBacks'
import { KITCHEN_TABLE, SIDE_TABLES, VENUES, venueById } from '@/config/venues'

test('shop item ids are unique and every price is positive', (t) => {
  t.is(new Set(SHOP_ITEMS.map((i) => i.id)).size, SHOP_ITEMS.length)
  for (const item of SHOP_ITEMS) {
    t.true(item.price > 0, `${item.id} has price ${item.price}`)
    t.truthy(item.name)
  }
})

test('every venue-win requirement points at a real venue', (t) => {
  for (const item of SHOP_ITEMS) {
    if (item.requiresVenueWin) {
      t.truthy(venueById(item.requiresVenueWin), `${item.id} requires unknown venue`)
    }
  }
})

test('every table has a souvenir requiring its win — ladder, side tables and the freeroll', (t) => {
  const allVenues = [...VENUES, ...SIDE_TABLES, KITCHEN_TABLE]
  for (const venue of allVenues) {
    const souvenir = SOUVENIRS.find((s) => s.requiresVenueWin === venue.id)
    t.truthy(souvenir, `${venue.id} has no souvenir`)
    t.truthy(souvenir!.name !== venue.id, `${venue.id} souvenir is missing its name`)
    if (venue.buyIn > 0) {
      t.true(souvenir!.price <= venue.buyIn, 'souvenirs cost less than the venue buy-in')
    }
  }
  // Plus exactly one no-win-required absurdity.
  const free = SOUVENIRS.filter((s) => !s.requiresVenueWin)
  t.is(free.length, 1)
  t.is(free[0].id, 'souvenir-goldenpip')
})

test('card backs: the free set stays free, earned and shop backs gate correctly', (t) => {
  t.is(new Set(ALL_CARD_BACKS.map((d) => d.id)).size, ALL_CARD_BACKS.length)
  const none = new Set<string>()
  for (const design of CARD_BACKS) t.true(cardBackUnlocked(design, none, none))
  // Earned: locked until the venue is won.
  const garageBack = EARNED_BACKS.find((d) => d.unlock?.venueWin === 'garage')!
  t.false(cardBackUnlocked(garageBack, none, none))
  t.true(cardBackUnlocked(garageBack, new Set(['garage']), none))
  // Bought: locked until owned — a venue win alone isn't enough for a hybrid.
  const goldleaf = SHOP_BACKS.find((d) => d.id === 'back-goldleaf')!
  t.false(cardBackUnlocked(goldleaf, new Set(['riverboat']), none))
  t.true(cardBackUnlocked(goldleaf, none, new Set(['back-goldleaf'])))
  // Every earned back exists for a real ladder venue.
  t.is(EARNED_BACKS.length, VENUES.length)
  for (const d of EARNED_BACKS) t.truthy(venueById(d.unlock!.venueWin!))
})

test('unknown card back ids still fall back to the default', (t) => {
  t.is(cardBackById('back-goldleaf').name, 'Gold Leaf')
  t.is(cardBackById('nonsense').id, 'pip')
})

test('table finishes resolve by id', (t) => {
  t.is(tableFinishById('finish-walnut')?.name, 'Walnut')
  t.is(tableFinishById(null), undefined)
  t.is(tableFinishById('nope'), undefined)
  t.true(TABLE_FINISHES.every((f) => f.swatch.startsWith('#')))
})

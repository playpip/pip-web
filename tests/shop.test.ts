import test from 'ava'
import { SHOP_ITEMS, SOUVENIRS, TABLE_FINISHES, tableFinishById } from '@/config/shop'
import {
  ALL_COSMETICS,
  AVATAR_RINGS,
  DEALER_BUTTONS,
  SOUND_PACKS,
  avatarRingById,
  cosmeticPurchasable,
  cosmeticUnlocked,
  dealerButtonById,
  soundPackById,
} from '@/config/cosmetics'
import {
  ALL_CARD_BACKS,
  CARD_BACKS,
  EARNED_BACKS,
  MEMBER_BACKS,
  MEMBER_SHOP_BACKS,
  SHOP_BACKS,
  cardBackPurchasable,
  cardBackUnlocked,
  cardBackById,
} from '@/config/cardBacks'
import { KITCHEN_TABLE, SIDE_TABLES, VENUES, venueById } from '@/config/venues'

test('shop item ids are unique and no price is negative', (t) => {
  t.is(new Set(SHOP_ITEMS.map((i) => i.id)).size, SHOP_ITEMS.length)
  for (const item of SHOP_ITEMS) {
    t.true(item.price >= 0, `${item.id} has price ${item.price}`)
    t.true(Number.isInteger(item.price), `${item.id} has a fractional price`)
    t.truthy(item.name)
  }
})

// This used to read `price > 0`, and loosening it is the kind of edit that
// quietly removes a guarantee, so here is the replacement guarantee: a zero
// price means free *or* included, never "we forgot to price it". Every free
// row is one of a short list somebody decided to give away, and a new item
// arriving at 0 by accident fails here rather than shipping as a freebie.
test('the only free things are the ones we meant to give away', (t) => {
  const free = SHOP_ITEMS.filter((i) => i.price === 0 && !i.membersOnly).map((i) => i.id)
  t.deepEqual(free.sort(), [
    'button-house',
    'face-bigindex',
    'finish-baize',
    'ring-hairline',
    'sound-house',
    'sound-hush',
  ])
  // And each of them is free to somebody who owns nothing and pays nothing.
  const none = new Set<string>()
  for (const id of free) {
    const item = SHOP_ITEMS.find((i) => i.id === id)!
    t.true(cosmeticUnlocked(item, none, false), `${id} is on the free list but is not free`)
  }
})

// The four states a cosmetic can be in (the table on `Cosmetic` in
// config/cosmetics.ts). Not arithmetic — this *is* the economy, and every one
// of the four rows is a promise made somewhere in the docs.
test('the four states of a cosmetic behave the way the table says', (t) => {
  const none = new Set<string>()
  const free = { id: 'x', name: 'x', blurb: '', price: 0 }
  const priced = { id: 'x', name: 'x', blurb: '', price: 100 }
  const included = { id: 'x', name: 'x', blurb: '', price: 0, membersOnly: true }
  const memberShelf = { id: 'x', name: 'x', blurb: '', price: 100, membersOnly: true }

  // Free: everybody, always, member or not.
  t.true(cosmeticUnlocked(free, none, false))
  t.false(cosmeticPurchasable(free, none, false), 'a free thing was put up for sale')

  // Chip Shop stock: owning it is the whole gate, and a membership is not one.
  t.false(cosmeticUnlocked(priced, none, true), 'a membership bought a chip item')
  t.true(cosmeticUnlocked(priced, new Set(['x']), false))
  t.true(cosmeticPurchasable(priced, none, false))
  t.false(cosmeticPurchasable(priced, new Set(['x']), false), 'sold twice')

  // Included: while the membership is live, and never for sale at any price.
  t.false(cosmeticUnlocked(included, none, false))
  t.true(cosmeticUnlocked(included, none, true))
  t.false(cosmeticPurchasable(included, none, true), 'an included thing has a Buy button')
  t.false(
    cosmeticUnlocked(included, new Set(['x']), false),
    'an included thing unlocked from `owned`, which is client-written',
  )

  // The member shelf: the membership opens the right to buy, chips buy it —
  // and **bought is bought**, which is the row that needed the ruling. A
  // lapsed member keeps what they spent chips on.
  t.false(
    cosmeticPurchasable(memberShelf, none, false),
    'a stranger could buy off the member shelf',
  )
  t.true(cosmeticPurchasable(memberShelf, none, true))
  t.false(cosmeticUnlocked(memberShelf, none, true), 'a member got it without paying the chips')
  t.true(
    cosmeticUnlocked(memberShelf, new Set(['x']), false),
    'a cancelled membership took back something bought with chips',
  )
})

// Rule 3, in its rewritten form (docs/shop.md). The half that did not change is
// the half worth pinning: nothing in this room is payable in money. A member
// item with a price is buyable *with chips* by a member, which is a different
// sentence, and the test above is what holds it.
test('every member cosmetic is either included or priced in chips, never sold for money', (t) => {
  const member = ALL_COSMETICS.filter((c) => c.membersOnly)
  t.true(member.length >= 6, 'the member shelf is suspiciously empty')
  for (const item of member) {
    t.true(item.price >= 0, `${item.id} has a negative price`)
    t.truthy(item.blurb, `${item.id} has nothing to say`)
  }
  // Every category reaches both sides of the wall: something free and
  // something behind it. A category that is entirely paid is a category a free
  // player watches from outside, which is not what any of these were for.
  for (const group of [AVATAR_RINGS, DEALER_BUTTONS, SOUND_PACKS]) {
    t.true(
      group.some((c) => c.price === 0 && !c.membersOnly),
      `${group[0].id.split('-')[0]} has nothing free in it`,
    )
    t.true(
      group.some((c) => c.membersOnly),
      `${group[0].id.split('-')[0]} has nothing for members`,
    )
  }
})

// The four included member card backs shipped with no shop row at all: every
// other category listed its included item on the members' shelf and the backs
// did not, which made the membership look smaller than it is (Will,
// 2026-09-22). The bug was silent — nothing was broken, something was just
// absent — so it needs a test rather than care.
test('every member cosmetic has a row on the shelf', (t) => {
  const listed = new Set(SHOP_ITEMS.map((i) => i.id))
  const gated = [
    ...MEMBER_BACKS.map((d) => d.id),
    ...MEMBER_SHOP_BACKS.map((d) => d.id),
    ...ALL_COSMETICS.filter((c) => c.membersOnly).map((c) => c.id),
  ]
  for (const id of gated) {
    t.true(listed.has(id), `${id} is behind the membership and is on no shelf anywhere`)
  }
  // And the shelf says which it is, for every row on it: an included row has
  // no price and a member-shelf row has one. A third shape would render as a
  // Buy button reading 0, which is the bug the open shelf already had once.
  for (const item of SHOP_ITEMS.filter((i) => i.membersOnly)) {
    t.true(item.price === 0 || item.price > 0, `${item.id} has an unreadable price`)
    t.truthy(item.blurb, `${item.id} is on the members' shelf with nothing to say`)
  }
})

test('cosmetic ids are unique across every category', (t) => {
  const ids = ALL_COSMETICS.map((c) => c.id)
  t.is(new Set(ids).size, ids.length)
  // And they resolve. A typo'd id in the profile falls back rather than
  // throwing, so the failure this catches is silent by construction.
  t.is(avatarRingById('ring-gilt')?.name, 'Gilt')
  t.is(avatarRingById(null), undefined)
  t.is(avatarRingById('nonsense'), undefined)
  t.is(dealerButtonById('nonsense').id, 'button-house', 'an unknown button is not the free one')
  t.is(soundPackById(undefined).id, 'sound-house')
})

// A pack is a transform of the twelve voices (lib/sound.ts). These bounds are
// not taste, they are audibility: a pitch of 0.2 puts `fold` under 50Hz and a
// gain of 3 makes the table shout, and neither is a thing the shop may sell.
test('sound packs stay inside sane multipliers', (t) => {
  for (const pack of SOUND_PACKS) {
    t.true(pack.pitch >= 0.5 && pack.pitch <= 1.5, `${pack.id} pitch ${pack.pitch}`)
    t.true(pack.gain > 0 && pack.gain <= 1.2, `${pack.id} gain ${pack.gain}`)
    t.true(pack.length >= 0.5 && pack.length <= 2, `${pack.id} length ${pack.length}`)
  }
  // The house pack is the identity, so "what Pip has always sounded like" is
  // literally unchanged rather than approximately unchanged.
  const house = SOUND_PACKS.find((p) => p.id === 'sound-house')!
  t.is(house.pitch, 1)
  t.is(house.gain, 1)
  t.is(house.length, 1)
  t.is(house.timbre, undefined)
})

// A shop back gets its blurb from a lookup keyed by design id, so adding a
// design without adding its line ships an item with an empty subtitle (the
// Lilac back did exactly that). Every item on the shelf says something.
test('every shop item has a blurb', (t) => {
  for (const item of SHOP_ITEMS) {
    t.truthy(item.blurb, `${item.id} has no blurb`)
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

// The membership's cosmetics, and the rules that keep the two economies apart.
// None of it is arithmetic: all of it is the shape of the thing.
test('member backs come with the membership and are never for sale', (t) => {
  const none = new Set<string>()
  t.true(MEMBER_BACKS.length > 0)
  for (const design of MEMBER_BACKS) {
    t.true(design.unlock?.membersOnly, `${design.id} is in the member set without saying so`)
    // These are the *included* ones, so a price on one is a category error: it
    // would belong in MEMBER_SHOP_BACKS, where a lapse does not take it back.
    // Keeping the two lists apart is what makes that difference readable
    // without running the predicate in your head.
    t.is(design.unlock?.price, undefined, `${design.id} has a chip price and is in the wrong list`)
    t.false(cardBackUnlocked(design, none, none, false), `${design.id} was free to a stranger`)
    t.true(cardBackUnlocked(design, none, none, true), `${design.id} was refused to a member`)
    // Owning the id is not the unlock, or a lapsed membership would leave the
    // back behind and `owned` would quietly become a second entitlement store.
    t.false(
      cardBackUnlocked(design, none, new Set([design.id]), false),
      `${design.id} unlocked from the owned list, which is client-written`,
    )
  }
})

// The member shelf (docs/shop.md rule 3, rewritten 2026-09-21). The membership
// opens the right to buy; chips you won still buy it; **bought is bought**.
test('the member shelf is opened by the membership and paid for in chips', (t) => {
  const none = new Set<string>()
  t.true(MEMBER_SHOP_BACKS.length > 0)
  for (const design of MEMBER_SHOP_BACKS) {
    t.true(design.unlock?.membersOnly, `${design.id} is on the member shelf without saying so`)
    t.true((design.unlock?.price ?? 0) > 0, `${design.id} is on the member shelf with no price`)

    // A membership alone is not the unlock — it is the right to buy.
    t.false(cardBackUnlocked(design, none, none, true), `${design.id} was handed to a member free`)
    t.false(cardBackPurchasable(design, none, none, false), `${design.id} was sold to a stranger`)
    t.true(cardBackPurchasable(design, none, none, true))

    // And the whole point of the shelf: cancelling does not repossess it.
    t.true(
      cardBackUnlocked(design, none, new Set([design.id]), false),
      `${design.id} was taken back from somebody who paid chips for it`,
    )
    t.false(cardBackPurchasable(design, none, new Set([design.id]), true), 'sold twice')
  }
})

// The one direction the flag must never travel. A design that has ever been
// buyable with chips by anybody must stay buyable with chips: moving an open
// shelf item behind the membership is the thing rule 1 exists to stop, and it
// would be a two-character edit in the config.
test('nothing on the open shelf has been moved behind the membership', (t) => {
  for (const design of SHOP_BACKS) {
    t.falsy(
      design.unlock?.membersOnly,
      `${design.id} is Chip Shop stock and now needs a membership`,
    )
  }
  const openIds = new Set(SHOP_BACKS.map((d) => d.id))
  for (const design of MEMBER_SHOP_BACKS) {
    t.false(openIds.has(design.id), `${design.id} is on both shelves`)
  }
})

// The membership must not change what a free player already had. This is the
// mechanical half of "anything shipped free is free forever" for cosmetics.
test('the membership did not take a card back away from anybody', (t) => {
  const none = new Set<string>()
  for (const design of CARD_BACKS) {
    t.true(cardBackUnlocked(design, none, none, false), `${design.id} stopped being free`)
  }
  for (const design of EARNED_BACKS) {
    t.falsy(design.unlock?.membersOnly, `${design.id} is earned and has been made paid`)
    t.true(cardBackUnlocked(design, new Set([design.unlock!.venueWin!]), none, false))
  }
  for (const design of SHOP_BACKS) {
    t.falsy(design.unlock?.membersOnly, `${design.id} is bought with chips and now needs money`)
    t.true(cardBackUnlocked(design, none, new Set([design.id]), false))
  }
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

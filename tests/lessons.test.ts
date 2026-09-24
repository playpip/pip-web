import { existsSync, readFileSync } from 'node:fs'
import test from 'ava'
import { type Character, characterById, profileFor } from '@/config/cast'
import { DRILL_KINDS, OPEN_PACK_ID, SHOVE_PACK_ID, drillKind } from '@/config/drills'
import { holeKey } from '@/config/handNames'
import { COURSE, LESSONS, POSITION_LESSON_ID, canTakeLesson, lessonById } from '@/config/lessons'
import { opensHand, postflopPlace, preflopPlace, seatById } from '@/config/positions'
import { breakevenFolds, pct, requiredEquity } from '@/config/potOdds'
import { HAND_BANDS } from '@/config/startingHands'
import { ALL_VENUES } from '@/config/venues'
import { BLUFF_WEIGHTS, facing, riverRange } from '@/lib/drills/riverRange'
import { UNSEEN } from '@/lib/drills/turnSpot'
import { isRight, questionFor } from '@/lib/lessons/beats'
import { riverOuts, showdownShare } from '@/lib/lessons/reckon'
import { TRAITS, mostOf, playsAt, roomById } from '@/lib/lessons/regulars'
import { LESSON_BLINDS, dealScene, lineOf, playActions, sceneState } from '@/lib/lessons/scene'
import { decideAction } from '@/lib/poker/ai/policy'
import { type Card, cardFromString, mulberry32 } from '@/lib/poker/cards'
import { applyAction, isHandComplete, potSize, startHand } from '@/lib/poker/engine'
import { determineWinners } from '@/lib/poker/handEval'

// Lessons with Webb. What this file holds:
//
// 1. every scene in every lesson is a real hand: the engine deals it and plays
//    every action, in turn, or the build fails;
// 2. no question carries a typed answer, and every computed answer agrees with
//    the chart, the seat order and the engine;
// 3. Level 1 is free and made of things that were already free; everything else
//    that is built is the membership's; nothing unbuilt is linked.

test('every scene is dealt and played by the engine, and played on', (t) => {
  for (const lesson of LESSONS) {
    for (const beat of lesson.beats) {
      const state = sceneState(beat.scene, lesson.seed)
      // You are players[0], in the seat the beat says, holding what it says.
      t.is(state.players[0].id, beat.scene.heroSeat, `${beat.id}: you are not where it says`)
      t.deepEqual(
        state.players[0].hole.map((c) => `${c.rank}${c.suit}`),
        [...beat.scene.hero],
        `${beat.id}: your cards`,
      )
      t.not(beat.webb, beat.scene.heroSeat, `${beat.id}: Webb is in your chair`)
      // The blinds are posted where the seat names say they are.
      const blind = (id: string) => state.players.find((p) => p.id === id)?.committedThisHand
      if (!beat.scene.actions?.length) {
        const blinds = beat.scene.blinds ?? LESSON_BLINDS
        t.is(blind('sb'), blinds.small, `${beat.id}: small blind`)
        t.is(blind('bb'), blinds.big, `${beat.id}: big blind`)
      }
      // A hand played face up is the hand the scene says, in the seat it says.
      for (const [seat, hole] of Object.entries(beat.scene.hands ?? {})) {
        const player = state.players.find((p) => p.id === seat)
        t.deepEqual(
          player?.hole.map((c) => `${c.rank}${c.suit}`),
          [...(hole ?? [])],
          beat.id,
        )
      }
      for (const seat of beat.reveal ?? []) {
        t.truthy(beat.scene.hands?.[seat], `${beat.id}: shows ${seat}'s cards without naming them`)
      }
      if (beat.playOn)
        t.notThrows(() => playActions(state, beat.playOn ?? []), `${beat.id}: what it plays on`)
      // The same every visit.
      t.deepEqual(sceneState(beat.scene, lesson.seed), state)
    }
  }
})

test('an action out of turn is refused, not drawn', (t) => {
  const state = dealScene({ heroSeat: 'btn', hero: ['As', 'Ks'] }, 1)
  t.throws(() => playActions(state, [{ seat: 'btn', type: 'fold' }]), {
    message: /not btn's turn/,
  })
})

test('every question is worked out, and agrees with the chart, the seats and the table', (t) => {
  let asked = 0
  for (const lesson of LESSONS) {
    for (const beat of lesson.beats) {
      const state = sceneState(beat.scene, lesson.seed)
      const question = questionFor(beat, state)
      if (!beat.ask) {
        t.is(question, null)
        continue
      }
      asked++
      if (!question) {
        t.fail(`${beat.id}: asks and has no question`)
        continue
      }
      t.true(
        question.choices.some((c) => c.id === question.answer),
        `${beat.id}: no right button`,
      )
      t.true(isRight(question, question.answer))
      t.true(question.because.length > 20)

      if (beat.ask.kind === 'open-or-fold') {
        const hand = holeKey(state.players[0].hole) ?? ''
        const opens = opensHand(seatById(beat.scene.heroSeat), hand)
        t.is(question.answer, opens ? 'raise' : 'fold', `${beat.id}: ${hand}`)
        t.regex(question.because, opens ? /it is a raise\.$/ : /it is a fold\.$/)
        // The felt then plays what the answer says.
        const first = beat.playOn?.[0]
        t.is(first?.seat, beat.scene.heroSeat, `${beat.id}: the table does not show your move`)
        t.is(first?.type, opens ? 'raise' : 'fold', `${beat.id}: the table plays the other answer`)
      }
      if (beat.ask.kind === 'acts-last') {
        const place = beat.ask.street === 'preflop' ? preflopPlace : postflopPlace
        t.is(place(seatById(question.answer as never)), 6)
        t.is(question.answer, beat.ask.street === 'preflop' ? 'bb' : 'btn')
      }
      if (beat.ask.kind === 'acts-first') {
        t.is(question.answer, state.players[state.toActIndex].id)
        t.is(question.answer, beat.webb, `${beat.id}: the lesson says it is Webb to act`)
      }
    }
  }
  t.true(asked >= 4, `only ${asked} questions`)
})

test('the Position lesson is the shape it says: beats, the ideas, and a way into the pack', (t) => {
  const lesson = lessonById(POSITION_LESSON_ID)
  t.true(lesson.beats.length >= 6 && lesson.beats.length <= 10, `${lesson.beats.length} beats`)
  t.is(lesson.beats[0].voice, 'webb', 'Webb opens it')
  t.is(lesson.beats.at(-1)?.voice, 'webb', 'Webb closes it')
  t.is(lesson.practice, OPEN_PACK_ID)
  const kinds = lesson.beats.map((b) => b.ask?.kind).filter(Boolean)
  t.true(kinds.includes('acts-last'))
  t.true(kinds.includes('acts-first'))
  // The same hand, a fold early and a raise late: the lesson's whole argument.
  const j9 = lesson.beats.filter((b) => b.ask?.kind === 'open-or-fold' && b.scene.hero[0] === 'Jh')
  const verdicts = j9.map((b) => questionFor(b, sceneState(b.scene, lesson.seed))?.answer)
  t.deepEqual(verdicts, ['fold', 'raise'])
  // A steal: after you raise on the button, both blinds fold and the pot is yours.
  const steal = lesson.beats.find((b) => b.id === 'late-with-j9')
  if (steal?.playOn) {
    const after = playActions(sceneState(steal.scene, lesson.seed), steal.playOn)
    t.is(after.street, 'complete')
    t.true(after.players[0].stack > 2_000, 'the blinds did not come to you')
  }
})

test('lessons from Level 2 up are the membership’s; the gate is the one every surface uses', (t) => {
  for (const lesson of LESSONS) {
    t.true(lesson.membersOnly, `${lesson.id}: a paid lesson shipped without its flag`)
    t.false(canTakeLesson(lesson, false))
    t.true(canTakeLesson(lesson, true))
    t.regex(lesson.id, /^[a-z0-9-]+$/)
  }
})

test('the course: Level 1 is free and already existed, and nothing unbuilt is linked', (t) => {
  t.deepEqual(
    COURSE.map((level) => level.level),
    [1, 2, 3, 4, 5],
  )
  const first = COURSE[0]
  t.true(first.items.some((item) => item.kind === 'tour'))
  for (const item of first.items) {
    t.not(item.kind, 'lesson', 'Level 1 is the tour and the free drills, not a new lesson')
    t.not(item.kind, 'planned')
    if (item.kind === 'drill') t.falsy(drillKind(item.id).membersOnly, `${item.id} is paid`)
  }
  t.deepEqual(
    first.items.flatMap((i) => (i.kind === 'drill' ? [i.id] : [])),
    DRILL_KINDS.filter((k) => !k.membersOnly).map((k) => k.id),
    'every free drill is on Level 1, and only those',
  )
  for (const level of COURSE.slice(1)) {
    for (const item of level.items) {
      if (item.kind === 'drill') t.true(drillKind(item.id).membersOnly === true, item.id)
      if (item.kind === 'lesson') t.true(lessonById(item.id).membersOnly === true, item.id)
      if (item.kind === 'planned') t.false(LESSONS.some((l) => l.title === item.title))
    }
  }
  // Every built lesson is on the shelf, once.
  const shelved = COURSE.flatMap((l) => l.items).flatMap((i) => (i.kind === 'lesson' ? [i.id] : []))
  t.deepEqual(shelved.sort(), LESSONS.map((l) => l.id).sort())
})

test('the lessons are app routes, and the /learn guides stay the guides', (t) => {
  t.true(existsSync(new URL('../src/app/game/lessons/[lesson]/page.tsx', import.meta.url)))
  t.false(existsSync(new URL('../src/app/learn/lessons', import.meta.url)))
  // The guides link to the lesson, and say it comes with the membership rather
  // than leaving that for the lesson to spring on somebody.
  for (const guide of ['position', 'starting-hands', 'pot-odds']) {
    const page = readFileSync(
      new URL(`../src/app/learn/${guide}/page.tsx`, import.meta.url),
      'utf-8',
    )
    t.regex(page, /<DoItWithWebb/, `${guide} does not offer the lesson`)
  }
})

// --- the lessons after Position ----------------------------------------------
//
// Every new kind of question is checked against the thing it claims to agree
// with, computed again here by a different route where one exists: the chart,
// the showdown, the guide's price, the pack's range, the cast's dials.

const cardKey = (c: { rank: string; suit: string }) => `${c.rank}${c.suit}`

/** Every beat in every lesson that asks, dealt, with its question. */
function asked() {
  return LESSONS.flatMap((lesson) =>
    lesson.beats.flatMap((beat) => {
      if (!beat.ask) return []
      const state = sceneState(beat.scene, lesson.seed)
      const question = questionFor(beat, state)
      return question ? [{ lesson, beat, ask: beat.ask, state, question }] : []
    }),
  )
}

test('every lesson is the shape the course promises', (t) => {
  for (const lesson of LESSONS) {
    const n = lesson.beats.length
    t.true(n >= 5 && n <= 10, `${lesson.id}: ${n} beats`)
    t.is(lesson.beats[0].voice, 'webb', `${lesson.id}: Webb opens it`)
    t.is(lesson.beats.at(-1)?.voice, 'webb', `${lesson.id}: Webb closes it`)
    t.true(
      lesson.beats.filter((b) => b.ask).length >= 3,
      `${lesson.id}: fewer than three questions`,
    )
    t.is(new Set(lesson.beats.map((b) => b.id)).size, n, `${lesson.id}: a beat id twice`)
    if (lesson.practice !== null) t.notThrows(() => drillKind(lesson.practice as string))
    // Every beat's own words fit a phone's talk bubble.
    for (const beat of lesson.beats) {
      t.true(beat.say.length <= 320, `${beat.id}: ${beat.say.length} characters`)
    }
  }
})

test('the starting-hands questions are the chart, seat by seat', (t) => {
  for (const { beat, ask, state, question } of asked()) {
    if (ask.kind !== 'first-seat') continue
    const hand = holeKey(state.players[0].hole) ?? ''
    t.is(question.answer, HAND_BANDS[hand] ?? 'never', `${beat.id}: ${hand}`)
    // ...and the chart as the position guide reads it: no seat before the
    // answer opens it, and the answer's seat does.
    const order = ['utg', 'mp', 'co'] as const
    const bands = ['any', 'middle', 'late']
    for (const [i, seat] of order.entries()) {
      const opens = opensHand(seatById(seat), hand)
      t.is(opens, bands.indexOf(question.answer) !== -1 && bands.indexOf(question.answer) <= i)
    }
  }
})

/** Every river against a face-up hand, the showdown read directly. */
function winners(hero: Card[], villain: Card[], board: Card[]): { wins: number; unseen: number } {
  const seen = new Set([...hero, ...villain, ...board].map(cardKey))
  let wins = 0
  let unseen = 0
  for (const rank of '23456789TJQKA') {
    for (const suit of 'cdhs') {
      if (seen.has(`${rank}${suit}`)) continue
      unseen++
      const river = [...board, cardFromString(`${rank}${suit}`)]
      const { winners: w } = determineWinners(
        [
          { id: 'a', hole: hero },
          { id: 'b', hole: villain },
        ],
        river,
      )
      if (w.length === 1 && w[0] === 'a') wins++
    }
  }
  return { wins, unseen }
}

test('outs and prices agree with the showdown and with the pot-odds guide', (t) => {
  let outs = 0
  let calls = 0
  for (const { beat, ask, state, question } of asked()) {
    const hero = state.players[0]
    if (ask.kind === 'count-outs' || ask.kind === 'call-or-fold') {
      const villain = state.players.find((p) => p.id === ask.against)?.hole ?? []
      const { wins, unseen } = winners(hero.hole, villain, state.community)
      t.is(unseen, UNSEEN, `${beat.id}: the deck does not add up`)
      t.true(
        (beat.reveal ?? []).includes(ask.against),
        `${beat.id}: counting against a hidden hand`,
      )
      if (ask.kind === 'count-outs') {
        outs++
        t.is(question.answer, String(wins), beat.id)
        t.is(question.choices.length, 4)
      } else {
        calls++
        const toCall = state.currentBet - hero.committedThisStreet
        const pot = potSize(state)
        const price = toCall / (pot + toCall)
        t.is(question.answer, wins / UNSEEN > price ? 'call' : 'fold', beat.id)
        t.is(
          beat.playOn?.[0]?.type as string | undefined,
          question.answer,
          `${beat.id}: the felt plays the other answer`,
        )
      }
    }
    if (ask.kind === 'price') {
      const toCall = state.currentBet - hero.committedThisStreet
      const pot = potSize(state)
      // The guide's function and the plain fraction are the same number.
      t.is(question.answer, `${pct(toCall / (pot + toCall))}%`)
      t.is(question.answer, `${pct(requiredEquity(toCall / (pot - toCall)))}%`)
    }
    if (ask.kind === 'bluff-price') {
      const pot = potSize(state)
      t.is(question.answer, `${pct(breakevenFolds(ask.bet / pot))}%`)
      t.is(question.answer, `${pct(ask.bet / (pot + ask.bet))}%`)
      const first = beat.playOn?.[0]
      if (first) t.deepEqual([first.type, first.to], ['bet', ask.bet], beat.id)
    }
  }
  t.true(outs >= 3 && calls >= 3, `${outs} outs questions and ${calls} calls`)
})

test('the outs lesson catches the outs that are not outs', (t) => {
  const lesson = lessonById('outs')
  const beat = lesson.beats.find((b) => b.id === 'outs-that-are-not')
  if (!beat) return t.fail()
  const state = sceneState(beat.scene, lesson.seed)
  const webb = state.players.find((p) => p.id === 'bb')?.hole ?? []
  const outs = riverOuts(state.players[0].hole, webb, state.community)
  // Nine hearts, and two of them lose: the one that pairs the board and the one
  // that makes four of a kind.
  t.deepEqual(outs.traps.map(cardKey).sort(), ['2h', 'Jh'])
  const question = questionFor(beat, state)
  t.true(
    question?.choices.some((c) => c.id === '9'),
    'the miscount is on a button',
  )
  t.is(question?.answer, '7')
})

test('stack questions are read off the dealt stacks', (t) => {
  let n = 0
  for (const { ask, state, question } of asked()) {
    if (ask.kind === 'big-blinds') {
      n++
      const start = (id: string) => {
        const p = state.players.find((q) => q.id === id)
        return p ? p.stack + p.committedThisHand : 0
      }
      const mine = start(state.players[0].id)
      const chips = ask.against ? Math.min(mine, start(ask.against)) : mine
      t.is(Number(question.answer) * state.bigBlind, chips)
    }
    if (ask.kind === 'raise-share') {
      const p = state.players[0]
      t.is(question.answer, `${pct((2.5 * state.bigBlind) / (p.stack + p.committedThisHand))}%`)
    }
  }
  t.true(n >= 3)
})

test('the range questions are the calling-the-river pack’s model', (t) => {
  let n = 0
  for (const { beat, ask, state, question } of asked()) {
    if (ask.kind === 'in-range') {
      n++
      // Played out to the river the scene names, the pack's range holds the
      // answer and none of the others.
      const board = (beat.scene.board ?? []).map(cardFromString)
      t.is(board.length, 5, `${beat.id}: the range lesson names its whole board`)
      const range = riverRange(state.players[0].hole, board, lineOf(beat.scene, ask.seat))
      const holds = (pair: readonly string[]) =>
        range.some((c) => {
          const keys = c.hole.map(cardKey)
          return pair.every((k) => keys.includes(k))
        })
      ask.hands.forEach((pair, i) => {
        t.is(holds(pair), question.answer === `h${i}`, `${beat.id}: ${pair}`)
      })
    }
    if (ask.kind === 'river-call') {
      const hero = state.players[0]
      const toCall = state.currentBet - hero.committedThisStreet
      const pot = potSize(state)
      const fraction = toCall / (pot - toCall)
      const range = riverRange(hero.hole, state.community, lineOf(beat.scene, ask.seat))
      const typical = facing(hero.hole, state.community, range, fraction, BLUFF_WEIGHTS.typical)
      t.is(question.answer, typical.equity > toCall / (pot + toCall) ? 'call' : 'fold')
    }
    if (ask.kind === 'better-bluff') {
      const line = lineOf(beat.scene, ask.seat)
      const shares = ask.hands.map((pair) =>
        showdownShare(pair.map(cardFromString), state.community, line),
      )
      t.is(question.answer, shares[0] < shares[1] ? 'h0' : 'h1')
    }
  }
  t.true(n >= 3)
  // The line the river is priced on is the one the table played: bet, bet.
  const river = lessonById('ranges').beats.find((b) => b.ask?.kind === 'river-call')
  if (river) t.deepEqual(lineOf(river.scene, 'bb'), { flop: 'bet', turn: 'bet' })
})

// --- the regulars: every claim pinned to the dial it comes from ---------------

const regularsLesson = () => lessonById('the-regulars')

/** The Regulars lesson's questions, with the room they are asked at. */
function regularQuestions() {
  return regularsLesson().beats.flatMap((beat) =>
    beat.ask?.kind === 'which-regular' ? [{ beat, ask: beat.ask }] : [],
  )
}

test('the regulars lesson asks about each trait it names, of people at the table', (t) => {
  const traits = regularQuestions().map((q) => q.ask.trait)
  t.deepEqual([...traits].sort(), ['bluffs', 'loose', 'tight'])
  for (const { beat, ask } of regularQuestions()) {
    const seated = Object.values(beat.cast ?? {})
    for (const id of ask.among) t.true(seated.includes(id), `${beat.id}: ${id} is not at the table`)
  }
})

test('every regulars answer is the dial, in every room those regulars play', (t) => {
  // The claim is about the character, not one room: so it has to hold in every
  // room all of them sit in, or the lesson is only true at the Pub.
  for (const { beat, ask } of regularQuestions()) {
    const answer = questionFor(beat, sceneState(beat.scene, regularsLesson().seed))?.answer
    const rooms = ALL_VENUES.filter((room) => ask.among.every((id) => playsAt(id, room)))
    t.true(rooms.length >= 3, `${beat.id}: only ${rooms.length} rooms`)
    for (const room of rooms)
      t.is<string | undefined, string | undefined>(
        mostOf(ask.trait, ask.among, room),
        answer,
        room.id,
      )
    // ...and read straight off the cast, not through the lesson's helpers.
    const dial = TRAITS[ask.trait].dial
    const sign = TRAITS[ask.trait].sign
    const own = (id: string) => sign * (characterById(id)?.delta?.[dial] ?? 0)
    for (const id of ask.among) {
      if (id !== answer) t.true(own(answer ?? '') > own(id), `${beat.id}: ${id} vs ${answer}`)
    }
  }
  // The claims the lesson makes in words, one dial each.
  const delta = (id: string) => characterById(id)?.delta ?? {}
  t.true((delta('doris').tightness ?? 0) < 0, 'Doris plays looser than the room')
  t.true((delta('marge').tightness ?? 0) > 0, 'Marge plays tighter than the room')
  t.true((delta('frank').bluff ?? 0) > 0, 'Frank bluffs more than the room')
  // "Nobody else here has it turned up as far", "by a distance": the others at
  // the table carry no bluff nudge of their own, or one well short of his.
  for (const id of Object.values(regularsLesson().beats[0].cast ?? {})) {
    if (id !== 'frank') t.true((delta('frank').bluff ?? 0) - (delta(id).bluff ?? 0) >= 0.05, id)
  }
  // "Frank still checks most of his air": betting air checked-to happens at
  // most `bluff` of the time (policy.ts), and his is under a half everywhere.
  for (const room of ALL_VENUES.filter((r) => playsAt('frank', r))) {
    t.true(profileFor(room, characterById('frank') as Character).bluff < 0.5, room.id)
  }
})

test('the regulars play the way the lesson says, measured', (t) => {
  // The dials are what the lesson compares; this plays them, so a change to the
  // AI that stopped a dial meaning what the lesson says it means fails here.
  // Full numbers from 5,000 hands at the Pub are in config/lessons.ts.
  const pub = roomById('pub')
  const ids = ['doris', 'frank', 'marge', 'priya', 'gus', 'ted']
  const profiles = Object.fromEntries(
    ids.map((id) => [id, { ...profileFor(pub, characterById(id) as Character), iterations: 40 }]),
  )
  const seen: Record<string, number> = {}
  const played: Record<string, number> = {}
  for (let h = 0; h < 240; h++) {
    const rng = mulberry32(h * 7919 + 3)
    const seated = [...ids.slice(h % 6), ...ids.slice(0, h % 6)]
    let s = startHand({
      seats: seated.map((id) => ({ id, name: id, stack: 2_000 })),
      buttonIndex: h % 6,
      smallBlind: 10,
      bigBlind: 20,
      rng,
    })
    const put = new Set<string>()
    const sat = new Set<string>()
    while (!isHandComplete(s) && s.street === 'preflop') {
      const p = s.players[s.toActIndex]
      const a = decideAction(s, profiles[p.id], rng)
      sat.add(p.id)
      if (a.type !== 'fold' && a.type !== 'check') put.add(p.id)
      s = applyAction(s, a)
    }
    for (const id of sat) {
      seen[id] = (seen[id] ?? 0) + 1
      if (put.has(id)) played[id] = (played[id] ?? 0) + 1
    }
  }
  const vpip = (id: string) => (played[id] ?? 0) / (seen[id] ?? 1)
  t.log('VPIP', ids.map((id) => `${id} ${vpip(id).toFixed(2)}`).join(', '))
  t.true(vpip('doris') > vpip('marge') + 0.06, `Doris ${vpip('doris')} vs Marge ${vpip('marge')}`)
  t.true(vpip('doris') < 0.5, 'Doris still folds most of her hands')

  // Checked to on the river with nothing: the Bluffing lesson's own spot.
  const bluffing = lessonById('bluffing')
  const spot = bluffing.beats.find((b) => b.ask?.kind === 'bluff-price')
  if (!spot) return t.fail()
  const state = sceneState(spot.scene, bluffing.seed)
  const bets = (id: string) => {
    let n = 0
    for (let seed = 1; seed <= 300; seed++) {
      const a = decideAction(state, profiles[id], mulberry32(seed))
      if (a.type === 'bet') n++
    }
    return n / 300
  }
  const frank = bets('frank')
  t.log(
    'air bet when checked to',
    ['frank', 'doris', 'marge', 'priya'].map((id) => `${id} ${bets(id)}`).join(', '),
  )
  for (const id of ['doris', 'marge', 'priya']) {
    t.true(frank > bets(id) + 0.05, `Frank ${frank} vs ${id}`)
  }
  t.true(frank < 0.5, 'Frank still checks most of his air')
})

test('the stack-sizes lesson hands into the shove-or-fold pack', (t) => {
  // It went back to the shelf while the pack was being built; the pack landed
  // on 2026-09-24, and Level 4 is now read → lesson → practice like the rest.
  t.is(lessonById('stack-sizes').practice, SHOVE_PACK_ID)
})

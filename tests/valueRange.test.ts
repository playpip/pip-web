import test from 'ava'
import { categoryOf, fastScore, riverRange } from '@/lib/drills/riverRange'
import {
  CALL_SHARES,
  MISSED_CALLS,
  callShare,
  callingGroups,
  countAgainst,
  keepCount,
  valueBand,
  valueCount,
} from '@/lib/drills/valueRange'
import { mulberry32, shuffledDeck } from '@/lib/poker/cards'
import { determineWinners } from '@/lib/poker/handEval'

// Who calls a river bet. The claim this file holds is the one that makes the
// bet-or-check pack gradeable at a four-point margin: **the numbers are
// counts, and the criterion is the expected value written out.** So each is
// rebuilt here from the showdown code, hand by hand.

/** Random river spots where the hero has a made hand of their own, as the pack deals. */
function spots(n: number, seed: number) {
  const rng = mulberry32(seed)
  const out: { hero: ReturnType<typeof shuffledDeck>; board: ReturnType<typeof shuffledDeck> }[] =
    []
  while (out.length < n) {
    const deck = shuffledDeck(rng)
    const hero = deck.slice(0, 2)
    const board = deck.slice(2, 7)
    const b = categoryOf(fastScore(board))
    if (b >= 3 || categoryOf(fastScore([...hero, ...board])) <= b) continue
    out.push({ hero, board })
  }
  return out
}

test('every hand that missed is a hand you beat', (t) => {
  for (const { hero, board } of spots(30, 1)) {
    const range = riverRange(hero, board, { flop: 'check', turn: 'check' })
    const mine = fastScore([...hero, ...board])
    for (const combo of range.filter((c) => !c.made)) t.true(combo.score < mine)
  }
})

test('the count and the gain are the showdown, hand by hand', (t) => {
  // Rebuild both from `determineWinners` with the same cut and weight: the
  // share against the callers, and EV(bet) − EV(check) summed hand by hand as
  // chips won and lost, not through the formula.
  let checked = 0
  for (const [i, { hero, board }] of spots(10, 7).entries()) {
    const line = { flop: i % 2 ? 'bet' : 'check', turn: i % 3 ? 'check' : 'bet' } as const
    const range = riverRange(hero, board, line)
    const counted = countAgainst(hero, board, range)
    const made = range.filter((c) => c.made).sort((x, y) => y.score - x.score)
    const missed = range.filter((c) => !c.made)
    const pot = 100
    for (const bet of [50, 75, 100]) {
      const keep = keepCount(counted.made, callShare(bet / pot).tight)
      const share = (hole: (typeof made)[number]['hole']) => {
        const { winners } = determineWinners(
          [
            { id: 'hero', hole: hero },
            { id: 'them', hole },
          ],
          board,
        )
        return winners.includes('hero') ? 1 / winners.length : 0
      }
      let calls = 0
      let won = 0
      let evBet = 0
      let evCheck = 0
      const each = (hole: (typeof made)[number]['hole'], callWeight: number) => {
        const e = share(hole)
        calls += callWeight
        won += callWeight * e
        // Betting: a call is a pot of pot + 2 bets, a fold is the pot.
        evBet += callWeight * (e * (pot + 2 * bet) - bet) + (1 - callWeight) * pot
        evCheck += e * pot
      }
      made.forEach((combo, k) => {
        each(combo.hole, k < keep ? 1 : 0)
      })
      for (const combo of missed) each(combo.hole, MISSED_CALLS.high)
      const count = valueCount(counted, keep, MISSED_CALLS.high, bet, pot)
      t.true(Math.abs(count.equity - won / calls) < 1e-9, `spot ${i} bet ${bet}`)
      t.true(Math.abs(count.gain - (evBet - evCheck)) < 1e-6, `spot ${i} bet ${bet}`)
      t.true(count.effective >= count.equity - 1e-12, 'the fold term went negative')
      t.is(count.effective > 0.5, count.gain > 0, 'effective equity is on the wrong side of a half')
      checked++
    }
  }
  t.is(checked, 30)
})

test('the cut never splits a tie, and a wider share keeps more', (t) => {
  for (const { hero, board } of spots(20, 3)) {
    const counted = countAgainst(
      hero,
      board,
      riverRange(hero, board, { flop: 'bet', turn: 'check' }),
    )
    let last = 0
    for (const share of [0.3, 0.45, 0.55, 0.7, 0.9, 1]) {
      const keep = keepCount(counted.made, share)
      t.true(keep >= last)
      t.true(keep >= Math.ceil(counted.made.length * share) || counted.made.length === 0)
      if (keep < counted.made.length && keep > 0) {
        t.true(counted.made[keep].score < counted.made[keep - 1].score, 'a tie was split')
      }
      last = keep
    }
  }
})

test('your share rises as they call wider, so the band’s ends bound it', (t) => {
  // The generator walks every cut from the tight end to the loose; this is why
  // that is the same as saying "anywhere in the band".
  for (const { hero, board } of spots(20, 11)) {
    const counted = countAgainst(
      hero,
      board,
      riverRange(hero, board, { flop: 'check', turn: 'check' }),
    )
    let last = -1
    for (let keep = 1; keep <= counted.made.length; keep++) {
      const e = valueCount(counted, keep, 0, 50, 100).equity
      t.true(e >= last - 1e-12, `the share fell when a weaker hand joined the callers`)
      last = e
    }
    const lo = valueCount(counted, 5, MISSED_CALLS.low, 50, 100).equity
    const hi = valueCount(counted, 5, MISSED_CALLS.high, 50, 100).equity
    t.true(hi >= lo - 1e-12, 'more calling misses cannot lower your share')
  }
})

test('a bigger bet is called by fewer, and every size has a band', (t) => {
  for (let i = 1; i < CALL_SHARES.length; i++) {
    t.true(CALL_SHARES[i].tight < CALL_SHARES[i - 1].tight)
    t.true(CALL_SHARES[i].loose < CALL_SHARES[i - 1].loose)
  }
  for (const band of CALL_SHARES) t.true(band.tight < band.loose && band.loose <= 1)
  t.is(callShare(0.5), CALL_SHARES[0])
  t.is(callShare(2 / 3), CALL_SHARES[1])
  t.is(callShare(1), CALL_SHARES[2])
  t.true(MISSED_CALLS.low < MISSED_CALLS.typical && MISSED_CALLS.typical < MISSED_CALLS.high)
})

test('the band holds every cut and both miss weights, and the groups add up', (t) => {
  for (const { hero, board } of spots(10, 21)) {
    const counted = countAgainst(
      hero,
      board,
      riverRange(hero, board, { flop: 'check', turn: 'bet' }),
    )
    const band = valueBand(counted, 60, 120)
    const share = callShare(0.5)
    const lo = keepCount(counted.made, share.tight)
    const hi = keepCount(counted.made, share.loose)
    t.is(band.all.length, (hi - lo + 1) * 2)
    const groups = callingGroups(counted, band.typical.madeCalls, MISSED_CALLS.typical)
    const hands = groups.reduce((n, g) => n + g.hands, 0)
    const beaten = groups.reduce((n, g) => n + g.beaten, 0)
    t.true(Math.abs(hands - band.typical.calls) < 1e-9)
    t.true(Math.abs(beaten - band.typical.beaten) < 1e-9)
  }
})

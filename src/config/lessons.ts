import { BET_PACK_ID, OPEN_PACK_ID, RIVER_PACK_ID, SHOVE_PACK_ID } from '@/config/drills'
import { type MembersOnly, included } from '@/config/membership'
import { SET_OR_BETTER_ON_THE_FLOP } from '@/config/startingHands'
import type { Beat } from '@/lib/lessons/beats'
import { OPEN_TO, type SceneAction, foldsTo } from '@/lib/lessons/scene'
import type { DrillKindId } from '@/lib/drills/types'

// Lessons with Webb: the course, and the lessons in it.
//
// **A lesson is played on the table, not read** (Will, 2026-09-23, three times).
// Webb sits in a seat, deals a real hand through the engine, and teaches in
// beats: he sets the scene, stops and asks you something, you answer with a
// real button, and he answers with the cards still in front of you. The written
// guides under /learn are the reading half and stay free and unchanged; this is
// the doing half.
//
// **The lessons are the membership's, except Level 1.** Level 1 is the tour and
// the two free drills that already existed — composed onto the shelf, not
// rebuilt, and never gated (the drills are free forever by ruling, technology#38).
// Every lesson from Level 2 up carries `membersOnly` from the commit that
// registers it, like a drill kind (rule #8): absent means free forever.
//
// **Nothing unbuilt is sold.** The course names what it will teach at every
// level, and the parts that do not exist yet are on the shelf as exactly that:
// "Not built yet", no link, no padlock suggesting there is something behind it.
// The same rule `shipped` enforces on the membership page (config/membership.ts).

export type LessonId =
  | 'position'
  | 'starting-hands'
  | 'outs'
  | 'pot-odds'
  | 'stack-sizes'
  | 'ranges'
  | 'bluffing'
  | 'the-regulars'

export interface Lesson extends MembersOnly {
  /** Route segment under /game/lessons, and stable: links and the shelf use it. */
  id: LessonId
  title: string
  /** One line on the shelf. What you will be able to do. */
  blurb: string
  /**
   * The drill kind the last beat hands you into, or null for a lesson whose
   * practice is not built yet: its last beat goes back to the shelf instead.
   */
  practice: DrillKindId | null
  /** The seed for the cards no beat names, so the table is the same every visit. */
  seed: number
  beats: readonly Beat[]
}

/**
 * Level 2's first lesson: position.
 *
 * Built to the position guide's argument, in its order and never against it:
 * the seats, who acts last (and that it changes at the flop), why acting last
 * is worth money, the same hand being a fold early and a raise late, and
 * stealing the blinds. Every question's answer is computed (lib/lessons/beats),
 * and every hand is graded by the chart the guide prints.
 */
const POSITION: Lesson = {
  id: 'position',
  title: 'Position',
  blurb:
    'Why the last seat to act is worth money, and why the same two cards are a fold in one seat and a raise in another.',
  practice: OPEN_PACK_ID,
  seed: 20_260_923,
  membersOnly: true,
  beats: [
    {
      id: 'the-chair',
      voice: 'webb',
      say: 'Sit down. This chapter is about the chair, not the cards.',
      scene: { heroSeat: 'btn', hero: ['Kc', 'Td'] },
      webb: 'bb',
    },
    {
      id: 'the-seats',
      voice: 'plain',
      say: 'Six seats. The D is the button, the dealer this hand. The next two round post the blinds before anybody has seen a card. After them: under the gun, the middle, the cutoff, and the button again. It moves one seat every hand.',
      scene: { heroSeat: 'btn', hero: ['Kc', 'Td'] },
      webb: 'bb',
      labels: true,
    },
    {
      id: 'last-after-the-flop',
      voice: 'plain',
      say: 'The order is not the same all hand. From the flop on, the first seat still in after the button speaks first, on every street.',
      scene: { heroSeat: 'btn', hero: ['Kc', 'Td'] },
      webb: 'bb',
      labels: true,
      ask: { kind: 'acts-last', street: 'postflop', prompt: 'So who acts last after the flop?' },
    },
    {
      id: 'last-before-the-flop',
      voice: 'plain',
      say: 'Before the flop it runs differently. The blinds have already put chips in, and that buys them something.',
      scene: { heroSeat: 'btn', hero: ['Kc', 'Td'] },
      webb: 'bb',
      labels: true,
      ask: { kind: 'acts-last', street: 'preflop', prompt: 'Who acts last before the flop?' },
    },
    {
      id: 'why-it-pays',
      voice: 'plain',
      say: 'Why the last seat is worth money. You raised on the button, I called in the big blind, and the flop is out.',
      scene: {
        heroSeat: 'btn',
        hero: ['Kc', 'Td'],
        board: ['Qs', '7d', '2c'],
        actions: [
          ...foldsTo('btn'),
          { seat: 'btn', type: 'raise', to: OPEN_TO },
          { seat: 'sb', type: 'fold' },
          { seat: 'bb', type: 'call' },
        ],
      },
      webb: 'bb',
      ask: { kind: 'acts-first', prompt: 'Whose turn is it?' },
      playOn: [{ seat: 'bb', type: 'check' }],
      aside:
        'So I check, and now you know something about my hand and I know nothing about yours. You can bet, or take a free card. I have to guess first again on the turn, and on the river.',
    },
    {
      id: 'early-with-j9',
      voice: 'plain',
      say: 'Now the cards. You are under the gun with J♥9♥: first to act, and five players still to come after you.',
      scene: { heroSeat: 'utg', hero: ['Jh', '9h'] },
      webb: 'bb',
      ask: { kind: 'open-or-fold', prompt: 'Raise or fold?' },
      playOn: [{ seat: 'utg', type: 'fold' }],
    },
    {
      id: 'late-with-j9',
      voice: 'plain',
      say: 'The same two cards. The button has come round to you and everybody has folded: only the blinds are left.',
      scene: { heroSeat: 'btn', hero: ['Jh', '9h'], actions: foldsTo('btn') },
      webb: 'bb',
      ask: { kind: 'open-or-fold', prompt: 'Raise or fold?' },
      playOn: [
        { seat: 'btn', type: 'raise', to: OPEN_TO },
        { seat: 'sb', type: 'fold' },
        { seat: 'bb', type: 'fold' },
      ],
      aside:
        'We both fold, and the blinds are yours. That is stealing the blinds: nobody had to hold worse, they only had to not hold anything good, and with two players left that is most of the time.',
    },
    {
      id: 'not-any-two',
      voice: 'plain',
      say: 'Folded to you on the button again, this time with Q♠8♦. The seat makes more hands playable. It does not make every hand playable.',
      scene: { heroSeat: 'btn', hero: ['Qs', '8d'], actions: foldsTo('btn') },
      webb: 'bb',
      ask: { kind: 'open-or-fold', prompt: 'Raise or fold?' },
      playOn: [{ seat: 'btn', type: 'fold' }],
    },
    {
      id: 'homework',
      voice: 'webb',
      say: 'End of the chapter. The exam is ten hands, and you can resit it as often as you like.',
      scene: { heroSeat: 'co', hero: ['As', 'Jd'], actions: foldsTo('co') },
      webb: 'bb',
    },
  ],
}

// --- the lessons after Position -------------------------------------------
//
// Same rules as Position, all of them: every hand is dealt and played by the
// engine, every question's answer is worked out (lib/lessons/beats.ts, by the
// same function the guide or the pack beside it grades with), Webb's own voice
// opens and closes, and the teaching in between is plain.

/** You raise on the button, the small blind folds, Webb calls in the big blind. */
const RAISED_AND_CALLED: SceneAction[] = [
  ...foldsTo('btn'),
  { seat: 'btn', type: 'raise', to: OPEN_TO },
  { seat: 'sb', type: 'fold' },
  { seat: 'bb', type: 'call' },
]

/** ...and both of you check the flop, so the turn is out. */
const CHECKED_TO_THE_TURN: SceneAction[] = [
  ...RAISED_AND_CALLED,
  { seat: 'bb', type: 'check' },
  { seat: 'btn', type: 'check' },
]

/**
 * Level 2: starting hands.
 *
 * The starting-hands guide's argument, at the table: high cards, pairs,
 * connected cards and suits, in that order, and the chart that puts them
 * together. Every verdict is the chart's (`opensHand`, the guide's own bands),
 * so the lesson cannot call a hand playable that the free guide folds.
 */
const STARTING_HANDS: Lesson = {
  id: 'starting-hands',
  title: 'Starting hands',
  blurb:
    'What makes two cards worth playing, why most of them are a fold, and the chart that sorts them.',
  practice: OPEN_PACK_ID,
  seed: 20_260_924,
  membersOnly: true,
  beats: [
    {
      id: 'most-are-a-fold',
      voice: 'webb',
      say: 'There are 1,326 ways to be dealt two cards. This chapter is about throwing most of them away, which is less dull than it sounds.',
      scene: { heroSeat: 'utg', hero: ['7c', '2d'] },
      webb: 'bb',
    },
    {
      id: 'high-cards',
      voice: 'plain',
      say: 'First thing that matters: high cards. Most hands never get past one pair, so the pair you make wants to be a big one. You are under the gun with A♠K♦.',
      scene: { heroSeat: 'utg', hero: ['As', 'Kd'] },
      webb: 'bb',
      ask: { kind: 'open-or-fold', prompt: 'Raise or fold?' },
      playOn: [{ seat: 'utg', type: 'raise', to: OPEN_TO }],
    },
    {
      id: 'a-pair-already',
      voice: 'plain',
      say: `Second: being a pair already. 4♣4♦ is a small hand, and it plays for what it becomes: it flops a set or better once in every ${(1 / SET_OR_BETTER_ON_THE_FLOP).toFixed(1)} flops.`,
      scene: { heroSeat: 'utg', hero: ['4c', '4d'] },
      webb: 'bb',
      ask: { kind: 'open-or-fold', prompt: 'Raise or fold?' },
      playOn: [{ seat: 'utg', type: 'raise', to: OPEN_TO }],
    },
    {
      id: 'connected-and-suited',
      voice: 'plain',
      say: 'Third and fourth: cards that work together, and suits. 7♥6♥ can make straights and flushes, and on its own it is seven high.',
      scene: { heroSeat: 'utg', hero: ['7h', '6h'] },
      webb: 'bb',
      ask: { kind: 'first-seat', prompt: 'Where does the chart start raising it?' },
      aside:
        'Hands that need help want fewer players behind them, which is why they wait for a later seat.',
    },
    {
      id: 'the-suits-are-small',
      voice: 'plain',
      say: 'The suits are worth something, and less than people think. A♦10♣ is A♦10♦ without the matching suit.',
      scene: { heroSeat: 'utg', hero: ['Ad', 'Tc'] },
      webb: 'bb',
      ask: { kind: 'first-seat', prompt: 'Where does the chart start raising A♦10♣?' },
      aside:
        'Suited, it opens from every seat. Offsuit it waits for the middle. That is about the size of what a suit does: one band on the chart.',
    },
    {
      id: 'any-ace',
      voice: 'plain',
      say: 'A trap: any ace. You are in the middle seat with A♣5♦, and four players still to come.',
      scene: { heroSeat: 'mp', hero: ['Ac', '5d'], actions: foldsTo('mp') },
      webb: 'bb',
      ask: { kind: 'open-or-fold', prompt: 'Raise or fold?' },
      playOn: [{ seat: 'mp', type: 'fold' }],
      aside:
        'When the ace pairs, the five is your kicker, and the hands that call a raise tend to have a better one.',
    },
    {
      id: 'the-hammer',
      voice: 'plain',
      say: 'And back to where we started. 7♣2♦: the two lowest cards that cannot make a straight together, and no flush either.',
      scene: { heroSeat: 'btn', hero: ['7c', '2d'], actions: foldsTo('btn') },
      webb: 'bb',
      ask: { kind: 'first-seat', prompt: 'Where does the chart start raising it?' },
      playOn: [{ seat: 'btn', type: 'fold' }],
    },
    {
      id: 'the-chart',
      voice: 'webb',
      say: 'That is the chart: high cards, pairs, cards that work together, suits, in that order. Ten hands of it next. I will be in the big blind, not saying anything.',
      scene: { heroSeat: 'co', hero: ['Kh', 'Qh'], actions: foldsTo('co') },
      webb: 'bb',
    },
  ],
}

/**
 * Level 3: outs.
 *
 * Counted the way the count-your-outs drill counts them: Webb plays his hand
 * face up, every card left is dealt as the river in turn, and the showdown
 * decides. So an out is a card that wins, not a card that looks like it helps,
 * and the lesson's second count is the one where those are different.
 */
const OUTS: Lesson = {
  id: 'outs',
  title: 'Outs',
  blurb:
    'Counting the cards that win it for you, and spotting the ones that look like help and are not.',
  practice: 'count-your-outs',
  seed: 20_260_925,
  membersOnly: true,
  beats: [
    {
      id: 'face-up',
      voice: 'webb',
      say: 'I am going to play this hand face up. It is bad for my reputation and good for your arithmetic.',
      scene: {
        heroSeat: 'btn',
        hero: ['6h', '5h'],
        hands: { bb: ['Kc', 'Qd'] },
        board: ['Kh', '7h', '2c', 'Js'],
        actions: RAISED_AND_CALLED,
      },
      webb: 'bb',
      reveal: ['bb'],
    },
    {
      id: 'the-flush-draw',
      voice: 'plain',
      say: 'The turn is out. I have a pair of kings. You have four hearts and nothing else. An out is a card that makes your hand the winner, not just a better hand.',
      scene: {
        heroSeat: 'btn',
        hero: ['6h', '5h'],
        hands: { bb: ['Kc', 'Qd'] },
        board: ['Kh', '7h', '2c', 'Js'],
        actions: CHECKED_TO_THE_TURN,
      },
      webb: 'bb',
      reveal: ['bb'],
      ask: { kind: 'count-outs', against: 'bb', prompt: 'How many outs have you got?' },
      aside:
        'Thirteen hearts in the deck, two in your hand and two on the board. Every one of the other nine makes your flush, and nothing else you can hit beats a pair of kings.',
    },
    {
      id: 'outs-that-are-not',
      voice: 'plain',
      say: 'Same cards for you. This time I have a pair of twos in my hand, so with the one on the board I have three of them.',
      scene: {
        heroSeat: 'btn',
        hero: ['6h', '5h'],
        hands: { bb: ['2d', '2s'] },
        board: ['Kh', '7h', '2c', 'Js'],
        actions: CHECKED_TO_THE_TURN,
      },
      webb: 'bb',
      reveal: ['bb'],
      ask: { kind: 'count-outs', against: 'bb', prompt: 'How many outs now?' },
      aside:
        'The jack gives me a full house and the two gives me four of a kind. Count the cards that win, not the ones that look nice.',
    },
    {
      id: 'the-straight-draw',
      voice: 'plain',
      say: 'A straight draw. You have 10♣9♦ on 8♥7♠2♦K♣, and I have the pair of kings again.',
      scene: {
        heroSeat: 'btn',
        hero: ['Tc', '9d'],
        hands: { bb: ['Kd', 'Qs'] },
        board: ['8h', '7s', '2d', 'Kc'],
        actions: CHECKED_TO_THE_TURN,
      },
      webb: 'bb',
      reveal: ['bb'],
      ask: { kind: 'count-outs', against: 'bb', prompt: 'How many outs?' },
      aside:
        'Open at both ends: any jack or any six makes the straight. Four of each, and none of them helps me.',
    },
    {
      id: 'what-it-is-for',
      voice: 'plain',
      say: 'Why count at all: outs are the start of every price. Nine outs with one card to come is nine of the forty-four you cannot see, which is about one river in five. The next lesson turns that into call or fold.',
      scene: {
        heroSeat: 'btn',
        hero: ['6h', '5h'],
        hands: { bb: ['Kc', 'Qd'] },
        board: ['Kh', '7h', '2c', 'Js'],
        actions: CHECKED_TO_THE_TURN,
      },
      webb: 'bb',
      reveal: ['bb'],
    },
    {
      id: 'count-them',
      voice: 'webb',
      say: 'That is outs. The practice deals two hands face up and asks you to count, and some of them are traps. I left those in on purpose.',
      scene: {
        heroSeat: 'btn',
        hero: ['Tc', '9d'],
        hands: { bb: ['Kd', 'Qs'] },
        board: ['8h', '7s', '2d', 'Kc'],
        actions: CHECKED_TO_THE_TURN,
      },
      webb: 'bb',
      reveal: ['bb'],
    },
  ],
}

/**
 * Level 3: pot odds.
 *
 * The pot-odds guide's two numbers, on a hand: the price is `requiredEquity`
 * (the guide's table), the chance is every river dealt against Webb's face-up
 * hand (the pot odds drill's count), and the verdict is whichever is bigger.
 * The rule of two is offered as what it is, a close approximation.
 */
const POT_ODDS: Lesson = {
  id: 'pot-odds',
  title: 'Pot odds',
  blurb:
    'The price of a call as a share of the pot, your chance as a share of the deck, and calling when the chance is bigger.',
  practice: 'pot-odds',
  seed: 20_260_926,
  membersOnly: true,
  beats: [
    {
      id: 'a-price',
      voice: 'webb',
      say: 'Every call has a price, and the pot prints it for you. Most players never read it. I bet.',
      scene: {
        heroSeat: 'btn',
        hero: ['6h', '5h'],
        hands: { bb: ['Kc', 'Qd'] },
        board: ['Kh', '7h', '2c', 'Js'],
        actions: [...CHECKED_TO_THE_TURN, { seat: 'bb', type: 'bet', to: 55 }],
      },
      webb: 'bb',
      reveal: ['bb'],
    },
    {
      id: 'the-price',
      voice: 'plain',
      say: 'There were 110 in the pot and I bet 55, so it holds 165. You have to put 55 in to carry on.',
      scene: {
        heroSeat: 'btn',
        hero: ['6h', '5h'],
        hands: { bb: ['Kc', 'Qd'] },
        board: ['Kh', '7h', '2c', 'Js'],
        actions: [...CHECKED_TO_THE_TURN, { seat: 'bb', type: 'bet', to: 55 }],
      },
      webb: 'bb',
      reveal: ['bb'],
      ask: { kind: 'price', prompt: 'How often do you need to win to break even?' },
    },
    {
      id: 'the-chance',
      voice: 'plain',
      say: 'Now your side of it. Nine hearts make your flush, out of forty-four cards you cannot see. The rule of two is the quick way: two per out, so about eighteen per cent. It runs a little low, and it is close enough to decide with.',
      scene: {
        heroSeat: 'btn',
        hero: ['6h', '5h'],
        hands: { bb: ['Kc', 'Qd'] },
        board: ['Kh', '7h', '2c', 'Js'],
        actions: [...CHECKED_TO_THE_TURN, { seat: 'bb', type: 'bet', to: 55 }],
      },
      webb: 'bb',
      reveal: ['bb'],
      ask: { kind: 'call-or-fold', against: 'bb', prompt: 'Call or fold?' },
      playOn: [{ seat: 'btn', type: 'fold' }],
      aside:
        'Not by much. But a call that is short every time is short every time, and it adds up.',
    },
    {
      id: 'a-smaller-bet',
      voice: 'plain',
      say: 'The same hands. This time I bet 20 into the 110.',
      scene: {
        heroSeat: 'btn',
        hero: ['6h', '5h'],
        hands: { bb: ['Kc', 'Qd'] },
        board: ['Kh', '7h', '2c', 'Js'],
        actions: [...CHECKED_TO_THE_TURN, { seat: 'bb', type: 'bet', to: 20 }],
      },
      webb: 'bb',
      reveal: ['bb'],
      ask: { kind: 'call-or-fold', against: 'bb', prompt: 'Call or fold?' },
      playOn: [{ seat: 'btn', type: 'call' }],
      aside:
        'Same draw, same chance. The only thing that changed is the price, and the price decides.',
    },
    {
      id: 'the-straight-draw-priced',
      voice: 'plain',
      say: 'Your straight draw from the outs lesson, eight outs. I bet 60 into the 110.',
      scene: {
        heroSeat: 'btn',
        hero: ['Tc', '9d'],
        hands: { bb: ['Kd', 'Qs'] },
        board: ['8h', '7s', '2d', 'Kc'],
        actions: [...CHECKED_TO_THE_TURN, { seat: 'bb', type: 'bet', to: 60 }],
      },
      webb: 'bb',
      reveal: ['bb'],
      ask: { kind: 'call-or-fold', against: 'bb', prompt: 'Call or fold?' },
      playOn: [{ seat: 'btn', type: 'fold' }],
      aside:
        'A bet of more than half the pot is more than any single draw can pay with one card to come. That is not an accident: it is what the bet is for.',
    },
    {
      id: 'two-cards-to-come',
      voice: 'plain',
      say: 'On the flop, with two cards to come, the quick rule is four per out instead of two. Only if you are sure to see both cards, which you are not when there is another bet coming on the turn. Price one card at a time.',
      scene: {
        heroSeat: 'btn',
        hero: ['6h', '5h'],
        hands: { bb: ['Kc', 'Qd'] },
        board: ['Kh', '7h', '2c', 'Js'],
        actions: RAISED_AND_CALLED,
      },
      webb: 'bb',
      reveal: ['bb'],
    },
    {
      id: 'read-the-price',
      voice: 'webb',
      say: 'That is pot odds: what it costs against how often you win. The practice has both hands face up and a bet to price, and I have made some of them close.',
      scene: {
        heroSeat: 'btn',
        hero: ['Tc', '9d'],
        hands: { bb: ['Kd', 'Qs'] },
        board: ['8h', '7s', '2d', 'Kc'],
        actions: [...CHECKED_TO_THE_TURN, { seat: 'bb', type: 'bet', to: 60 }],
      },
      webb: 'bb',
      reveal: ['bb'],
    },
  ],
}

/**
 * Level 4: stack sizes.
 *
 * Big blinds as the unit that matters, the same chips shrinking when the blinds
 * go up, what a standard raise costs a short stack, and the effective stack.
 * Every number is read off the dealt table. It does not grade a shove: that is
 * a chart of its own, and the lesson hands into the pack that teaches it.
 */
const STACK_SIZES: Lesson = {
  id: 'stack-sizes',
  title: 'Stack sizes',
  blurb:
    'Counting a stack in big blinds, why a short one has fewer moves, and what rising blinds do to the same chips.',
  // Not built yet: the shove-or-fold pack. Until it is, the last beat goes
  // back to the shelf rather than into a practice that does not exist.
  practice: SHOVE_PACK_ID,
  seed: 20_260_927,
  membersOnly: true,
  beats: [
    {
      id: 'chips-are-not-the-number',
      voice: 'webb',
      say: 'How many chips you have is the second most interesting number about your stack. The first is how many big blinds.',
      scene: { heroSeat: 'btn', hero: ['Ks', 'Jh'], actions: foldsTo('btn') },
      webb: 'bb',
    },
    {
      id: 'deep',
      voice: 'plain',
      say: 'Two thousand chips, blinds of 10 and 20. This is the depth every other lesson has been dealt at.',
      scene: { heroSeat: 'btn', hero: ['Ks', 'Jh'], actions: foldsTo('btn') },
      webb: 'bb',
      ask: { kind: 'big-blinds', prompt: 'How many big blinds have you got?' },
      aside:
        'At a hundred big blinds there is room for everything: raise, get raised, call, see three streets and still fold.',
    },
    {
      id: 'the-blinds-go-up',
      voice: 'plain',
      say: 'A tournament puts the blinds up every few hands and your stack does not follow. The same two thousand chips, a few levels later: blinds of 100 and 200.',
      scene: {
        heroSeat: 'btn',
        hero: ['Ks', 'Jh'],
        blinds: { small: 100, big: 200 },
        actions: foldsTo('btn'),
      },
      webb: 'bb',
      ask: { kind: 'big-blinds', prompt: 'How many big blinds now?' },
      aside: 'Nothing happened to your chips. They are worth a tenth of the poker they were.',
    },
    {
      id: 'what-a-raise-costs',
      voice: 'plain',
      say: 'A standard raise is two and a half big blinds. At a hundred big blinds that is small change. Here it is not.',
      scene: {
        heroSeat: 'btn',
        hero: ['Ks', 'Jh'],
        blinds: { small: 100, big: 200 },
        actions: foldsTo('btn'),
      },
      webb: 'bb',
      ask: { kind: 'raise-share', prompt: 'How much of your stack is a raise to 500?' },
      aside:
        'And if I raise you back, you are calling most of what is left or giving up a quarter of it. So a short stack stops raising small. It moves all in, or it folds.',
    },
    {
      id: 'shove-or-fold',
      voice: 'plain',
      say: 'This is what that looks like. Ten big blinds on the button, folded to you with K♠J♥: all in, and the blinds have to decide with their whole stacks.',
      scene: {
        heroSeat: 'btn',
        hero: ['Ks', 'Jh'],
        blinds: { small: 100, big: 200 },
        actions: [
          ...foldsTo('btn'),
          { seat: 'btn', type: 'raise', to: 2_000 },
          { seat: 'sb', type: 'fold' },
          { seat: 'bb', type: 'fold' },
        ],
      },
      webb: 'bb',
    },
    {
      id: 'effective',
      voice: 'plain',
      say: 'One more number. You have 3,000 and I have 1,200, blinds of 50 and 100, and it is folded to you.',
      scene: {
        heroSeat: 'btn',
        hero: ['Ks', 'Jh'],
        blinds: { small: 50, big: 100 },
        stacks: { btn: 3_000, bb: 1_200 },
        actions: foldsTo('btn'),
      },
      webb: 'bb',
      ask: {
        kind: 'big-blinds',
        against: 'bb',
        prompt: 'How deep is this pot between us, in big blinds?',
      },
      aside:
        'That is the effective stack, and it is the one to count. You play this hand as if you had twelve big blinds, because against me you do.',
    },
    {
      id: 'count-in-blinds',
      voice: 'webb',
      say: 'That is stack sizes. Count in big blinds, and count the smaller stack. Short stacks get one decision, and it is worth getting right.',
      scene: {
        heroSeat: 'btn',
        hero: ['Ks', 'Jh'],
        blinds: { small: 100, big: 200 },
        actions: foldsTo('btn'),
      },
      webb: 'bb',
    },
  ],
}

/**
 * Level 5: ranges.
 *
 * The calling-the-river pack's model, played forward: Webb calls, bets the
 * flop, bets the turn, bets the river, and each thing he does takes hands out
 * of the set he can have (`riverRange`: played before the flop, and something
 * to bet on every street he bet). The river decision is the pack's own grade.
 */
const RANGE_SCENE = {
  heroSeat: 'btn',
  hero: ['Kc', 'Qd'],
  board: ['Qh', '8d', '3c', '5s', '2h'],
} as const

const RANGES: Lesson = {
  id: 'ranges',
  title: 'Ranges',
  blurb:
    'Thinking about every hand somebody could have instead of guessing one, and crossing hands off as they play.',
  practice: RIVER_PACK_ID,
  seed: 20_260_928,
  membersOnly: true,
  beats: [
    {
      id: 'not-one-hand',
      voice: 'webb',
      say: 'You will never know my two cards. You can know a great deal about which ones I have not got, which is nearly as good and much more polite.',
      scene: { ...RANGE_SCENE, actions: foldsTo('btn') },
      webb: 'bb',
    },
    {
      id: 'he-called',
      voice: 'plain',
      say: 'You raised with K♣Q♦ and I called. A range is every hand I could hold, and calling already says something: I do not call a raise with anything.',
      scene: { ...RANGE_SCENE, actions: RAISED_AND_CALLED },
      webb: 'bb',
      ask: {
        kind: 'in-range',
        seat: 'bb',
        hands: [
          ['7c', '2d'],
          ['Ks', 'Js'],
          ['9d', '3h'],
        ],
        prompt: 'Which of these could I have?',
      },
    },
    {
      id: 'he-bet-the-flop',
      voice: 'plain',
      say: 'I bet the flop. A bet says I have something here: a pair of my own, or a draw to one.',
      scene: {
        ...RANGE_SCENE,
        actions: [...RAISED_AND_CALLED, { seat: 'bb', type: 'bet', to: 60 }],
      },
      webb: 'bb',
      ask: {
        kind: 'in-range',
        seat: 'bb',
        hands: [
          ['As', 'Ks'],
          ['Qc', 'Jc'],
          ['7s', '2s'],
        ],
        prompt: 'Which of these could I still have?',
      },
      playOn: [{ seat: 'btn', type: 'call' }],
    },
    {
      id: 'he-bet-the-turn',
      voice: 'plain',
      say: 'You called. The turn is the 5♠ and I bet again.',
      scene: {
        ...RANGE_SCENE,
        actions: [
          ...RAISED_AND_CALLED,
          { seat: 'bb', type: 'bet', to: 60 },
          { seat: 'btn', type: 'call' },
          { seat: 'bb', type: 'bet', to: 150 },
        ],
      },
      webb: 'bb',
      ask: {
        kind: 'in-range',
        seat: 'bb',
        hands: [
          ['Ah', 'Kh'],
          ['Qs', 'Ts'],
          ['6c', '4c'],
        ],
        prompt: 'And now?',
      },
      playOn: [{ seat: 'btn', type: 'call' }],
      aside:
        'Two bets have taken out most of the hands with nothing. What is left is pairs, and the draws that were live on the flop.',
    },
    {
      id: 'the-river-bet',
      voice: 'plain',
      say: 'The river is the 2♥ and I bet 330. The hands still in my range are the ones that bet twice. Some of them are better than your pair of queens and some are draws that missed.',
      scene: {
        ...RANGE_SCENE,
        actions: [
          ...RAISED_AND_CALLED,
          { seat: 'bb', type: 'bet', to: 60 },
          { seat: 'btn', type: 'call' },
          { seat: 'bb', type: 'bet', to: 150 },
          { seat: 'btn', type: 'call' },
          { seat: 'bb', type: 'bet', to: 330 },
        ],
      },
      webb: 'bb',
      ask: { kind: 'river-call', seat: 'bb', prompt: 'Call or fold?' },
    },
    {
      id: 'the-habit',
      voice: 'webb',
      say: 'That is ranges. Start wide and cross hands off every time somebody does something. The practice is ten river bets to call or fold, against exactly this.',
      scene: { ...RANGE_SCENE, actions: RAISED_AND_CALLED },
      webb: 'bb',
    },
  ],
}

/**
 * Level 5: bluffing.
 *
 * Why a bluff works (they fold a better hand), what it has to achieve
 * (`breakevenFolds`, the bet-sizing guide's number) and which hand to do it
 * with (the one that cannot win a showdown against the range, counted through
 * the calling-the-river pack's model).
 */
const BLUFF_SCENE = {
  heroSeat: 'btn',
  hero: ['6h', '5h'],
  board: ['Kh', '7h', '2c', 'Js', '9c'],
} as const

/** Checked all the way to you on the river. */
const CHECKED_TO_THE_RIVER: SceneAction[] = [
  ...CHECKED_TO_THE_TURN,
  { seat: 'bb', type: 'check' },
  { seat: 'btn', type: 'check' },
  { seat: 'bb', type: 'check' },
]

const BLUFFING: Lesson = {
  id: 'bluffing',
  title: 'Bluffing',
  blurb:
    'Why a bet with the worst hand can win, how often it has to, and which hands to do it with.',
  practice: RIVER_PACK_ID,
  seed: 20_260_929,
  membersOnly: true,
  beats: [
    {
      id: 'nobody-is-fooled',
      voice: 'webb',
      say: 'A bluff is a bet with the worse hand that wins because the better one folds. Nobody has to be fooled. They only have to fold.',
      scene: { ...BLUFF_SCENE, actions: CHECKED_TO_THE_RIVER },
      webb: 'bb',
    },
    {
      id: 'the-missed-draw',
      voice: 'plain',
      say: 'Your hearts never came. Six high will not win a showdown against anything I called with, and I have checked to you. The only way to win this pot is a bet I fold to.',
      scene: { ...BLUFF_SCENE, actions: CHECKED_TO_THE_RIVER },
      webb: 'bb',
      ask: { kind: 'bluff-price', bet: 55, prompt: 'You bet 55 into 110. How often must I fold?' },
      playOn: [
        { seat: 'btn', type: 'bet', to: 55 },
        { seat: 'bb', type: 'fold' },
      ],
      aside:
        'I fold. The chance that I fold is called fold equity, and it is the whole of a bluff’s value: your cards never had any.',
    },
    {
      id: 'bigger-bets',
      voice: 'plain',
      say: 'A bigger bet makes a fold more likely, and costs more when it does not come.',
      scene: { ...BLUFF_SCENE, actions: CHECKED_TO_THE_RIVER },
      webb: 'bb',
      ask: { kind: 'bluff-price', bet: 110, prompt: 'Bet the pot, 110. How often must I fold?' },
      aside:
        'Half the time, for the same pot. So the size is a trade: every extra chip has to buy enough extra folds to pay for itself.',
    },
    {
      id: 'which-hand',
      voice: 'plain',
      say: 'Which hands to bluff with. Suppose you had one of these two here instead.',
      scene: { ...BLUFF_SCENE, actions: CHECKED_TO_THE_RIVER },
      webb: 'bb',
      ask: {
        kind: 'better-bluff',
        seat: 'bb',
        hands: [
          ['6h', '5h'],
          ['8s', '8d'],
        ],
        prompt: 'Which is the better bluff?',
      },
      aside:
        'A bet with the eights makes the worse hands fold and gets called by the better ones, which is the wrong way round for a bet.',
    },
    {
      id: 'the-caller',
      voice: 'webb',
      say: 'That is bluffing. The other side of it is calling one, and the practice is ten river bets where you have to decide whether I mean it.',
      scene: { ...BLUFF_SCENE, actions: CHECKED_TO_THE_RIVER },
      webb: 'bb',
    },
  ],
}

/**
 * Level 5: the regulars.
 *
 * What the cast at the low tables actually do, and only that. Every trait is a
 * dial on the character (config/cast.ts `delta`) that the AI reads
 * (lib/poker/ai/policy.ts), every answer is the dials compared at the Pub
 * (lib/lessons/regulars.ts), and tests/lessons.test.ts pins each claim to its
 * dial and re-measures the direction in simulated play. Measured over 5,000
 * simulated hands at the Pub (2026-09-24): Doris put chips in before the flop
 * 38% of the time and Marge 23%; with nothing, checked to, Frank bet 10% and
 * everyone else 4–6%. Ted's lower aggression moved nothing measurable, so the
 * lesson says nothing about Ted.
 */
const REGULARS_TABLE = { utg: 'doris', mp: 'frank', co: 'marge', sb: 'priya' } as const

const REGULARS_ROOM = 'pub'

const THE_REGULARS: Lesson = {
  id: 'the-regulars',
  title: 'The regulars',
  blurb:
    'What the faces at the low tables really do differently, read off the settings that make them play.',
  practice: RIVER_PACK_ID,
  seed: 20_260_930,
  membersOnly: true,
  beats: [
    {
      id: 'written-down',
      voice: 'webb',
      say: 'Everybody at these tables has habits. Theirs happen to be written down, which is more than you can say for most people.',
      scene: { heroSeat: 'btn', hero: ['Qs', 'Jd'] },
      webb: 'bb',
      cast: REGULARS_TABLE,
    },
    {
      id: 'the-dials',
      voice: 'plain',
      say: 'Pip is open source, so this is not gossip. Each regular plays the room’s game with a small nudge on three dials: how tight, how aggressive, how often they bluff. Doris, Frank, Marge and Priya are at the Pub tonight.',
      scene: { heroSeat: 'btn', hero: ['Qs', 'Jd'] },
      webb: 'bb',
      cast: REGULARS_TABLE,
      labels: false,
    },
    {
      id: 'loosest',
      voice: 'plain',
      say: 'Start before the flop. Some players put chips in with almost anything, and some wait.',
      scene: { heroSeat: 'btn', hero: ['Qs', 'Jd'] },
      webb: 'bb',
      cast: REGULARS_TABLE,
      ask: {
        kind: 'which-regular',
        trait: 'loose',
        among: ['doris', 'marge', 'priya'],
        room: REGULARS_ROOM,
        prompt: 'Who plays the most hands?',
      },
      aside:
        'So when Doris is in a pot she can have almost anything, and your good hands beat more of it.',
    },
    {
      id: 'tightest',
      voice: 'plain',
      say: 'And the other end of the same dial.',
      scene: { heroSeat: 'btn', hero: ['Qs', 'Jd'] },
      webb: 'bb',
      cast: REGULARS_TABLE,
      ask: {
        kind: 'which-regular',
        trait: 'tight',
        among: ['doris', 'frank', 'marge'],
        room: REGULARS_ROOM,
        prompt: 'Who folds the most hands before the flop?',
      },
      aside:
        'When Marge is in a pot at all, her hand has cleared a higher bar than anybody else’s. A hand you would happily play against Doris is worth less against her.',
    },
    {
      id: 'the-bluffer',
      voice: 'plain',
      say: 'Now the bets with nothing. The pot is checked round to somebody holding air.',
      scene: { heroSeat: 'btn', hero: ['Qs', 'Jd'] },
      webb: 'bb',
      cast: REGULARS_TABLE,
      ask: {
        kind: 'which-regular',
        trait: 'bluffs',
        among: ['frank', 'marge', 'priya'],
        room: REGULARS_ROOM,
        prompt: 'Who bets it the most?',
      },
      aside:
        'Frank bets air more often than anybody else here, by a distance. He still checks it most of the time. More bluffs is not all bluffs.',
    },
    {
      id: 'what-it-is-not',
      voice: 'plain',
      say: 'What the dials are not: a promise. They move how often, never what. Doris still folds most of her hands, Frank still checks most of his air, and the cards decide every hand.',
      scene: { heroSeat: 'btn', hero: ['Qs', 'Jd'] },
      webb: 'bb',
      cast: REGULARS_TABLE,
    },
    {
      id: 'read-the-table',
      voice: 'webb',
      say: 'That is the regulars. Next time one of them bets into you on the river, it is worth remembering who. The practice is ten of those bets.',
      scene: { heroSeat: 'btn', hero: ['Qs', 'Jd'] },
      webb: 'bb',
      cast: REGULARS_TABLE,
    },
  ],
}

export const LESSONS: readonly Lesson[] = [
  STARTING_HANDS,
  POSITION,
  OUTS,
  POT_ODDS,
  STACK_SIZES,
  RANGES,
  BLUFFING,
  THE_REGULARS,
]

/** The Position lesson's id, and its route is `/game/lessons/${POSITION_LESSON_ID}`. */
export const POSITION_LESSON_ID = 'position' satisfies LessonId

/** A lesson by id, or a failure: an unknown id is a route that should not exist. */
export function lessonById(id: string): Lesson {
  const lesson = LESSONS.find((entry) => entry.id === id)
  if (!lesson) throw new Error(`No lesson "${id}". Add one to config/lessons.ts`)
  return lesson
}

/**
 * May this player take this lesson? One function for the shelf and the screen,
 * like `canPlayDrill`, so the two cannot disagree. `member` is `useEntitlement()`.
 */
export function canTakeLesson(lesson: Lesson, member: boolean): boolean {
  return included(lesson, member)
}

// --- the course -------------------------------------------------------------

/**
 * One thing on the shelf.
 *
 * - `tour`: the free three-minute tour at /tutorial.
 * - `guide`: a written guide or quick answer under /learn — always free, on
 *   every level, because reading is never the membership (docs/membership.md).
 *   Every page in LEARN_GUIDES is on the course exactly once; with the guides
 *   grid gone from /learn, this is the only link to them from the site.
 * - `lesson`: a lesson in {@link LESSONS}; it carries its own flag.
 * - `drill`: a drill kind, practice for the level; it carries its own flag.
 * - `planned`: something the course will teach and that does not exist. It has
 *   no link and no flag, and the shelf says "Not built yet" — never "coming
 *   with the membership", which would be selling it.
 */
export type CourseItem =
  | { kind: 'tour' }
  | { kind: 'guide'; slug: string }
  | { kind: 'lesson'; id: LessonId }
  | { kind: 'drill'; id: DrillKindId }
  | { kind: 'planned'; title: string }

export interface CourseLevel {
  level: 1 | 2 | 3 | 4 | 5
  title: string
  /** One line: what the level teaches. */
  blurb: string
  items: readonly CourseItem[]
}

/**
 * The five levels. Level 1 is free and made entirely of things that already
 * existed free; the rest are the membership's, and hold what is built today
 * alongside what is not, honestly labelled.
 */
export const COURSE: readonly CourseLevel[] = [
  {
    level: 1,
    title: 'First hands',
    blurb: 'The order of play, what beats what, and reading the board.',
    items: [
      { kind: 'tour' },
      { kind: 'guide', slug: 'hand-rankings' },
      { kind: 'guide', slug: 'how-to-play-texas-holdem' },
      { kind: 'guide', slug: 'three-pair-in-texas-holdem' },
      { kind: 'drill', id: 'whats-your-hand' },
      { kind: 'drill', id: 'which-hand-wins' },
    ],
  },
  {
    level: 2,
    title: 'Choosing hands',
    blurb: 'Which two cards to play, and why the seat matters as much as the cards.',
    items: [
      { kind: 'guide', slug: 'starting-hands' },
      { kind: 'guide', slug: 'position' },
      { kind: 'lesson', id: 'starting-hands' },
      { kind: 'lesson', id: 'position' },
      { kind: 'drill', id: OPEN_PACK_ID },
    ],
  },
  {
    level: 3,
    title: 'Pricing hands',
    blurb: 'Outs, pot odds, calling the river, and when to bet rather than check.',
    items: [
      { kind: 'guide', slug: 'pot-odds' },
      { kind: 'guide', slug: 'bet-sizing' },
      { kind: 'guide', slug: 'how-often-do-you-flop-a-set' },
      { kind: 'lesson', id: 'outs' },
      { kind: 'lesson', id: 'pot-odds' },
      { kind: 'drill', id: 'which-five-play' },
      { kind: 'drill', id: 'count-your-outs' },
      { kind: 'drill', id: 'hand-strength' },
      { kind: 'drill', id: 'pot-odds' },
      { kind: 'drill', id: RIVER_PACK_ID },
      { kind: 'drill', id: BET_PACK_ID },
    ],
  },
  {
    level: 4,
    title: 'Tournaments',
    blurb: 'Playing a stack that shrinks: how deep you are, and when it is shove or fold.',
    items: [
      { kind: 'lesson', id: 'stack-sizes' },
      { kind: 'drill', id: SHOVE_PACK_ID },
    ],
  },
  {
    level: 5,
    title: 'Reading players',
    blurb: 'Ranges instead of hands, bluffing on purpose, and what the regulars give away.',
    items: [
      { kind: 'lesson', id: 'ranges' },
      { kind: 'lesson', id: 'bluffing' },
      { kind: 'lesson', id: 'the-regulars' },
    ],
  },
]

// The cast — Pip's fixed troupe of opponents. Characters, not random names:
// each has a face (a fixed avatar spec), a one-line bio, a home range on the
// ladder, and a small personality nudge over the venue's AI profile. The venue
// sets the difficulty band (skill stays venue-owned — see docs/venues.md); the
// character sets the flavour. See docs/cast.md for the voice and how to add one.

import type { AvatarSpec } from '@/lib/avatar'
import type { AiProfile } from '@/lib/poker/ai/policy'
import type { Venue } from './venues'

/** Where on the ladder a character plays, by buy-in. */
export type CastBand = 'low' | 'mid' | 'high'

export interface CharacterLines {
  /** Sitting down at the table. */
  seat: readonly string[]
  /** Winning a big pot. */
  win: readonly string[]
  /** Busting out of the tournament. */
  bust: readonly string[]
}

export interface Character {
  id: string
  name: string
  /** One line, venue-tagline register: short, dry, affectionate. */
  bio: string
  avatar: AvatarSpec
  /** Ladder bands they frequent (ignored when `only` pins them). */
  bands: readonly CastBand[]
  /** Pin a character to specific venues (the Kitchen host, the Vault boss). */
  only?: readonly string[]
  /** Personality nudges over the venue's AiProfile. Never touches skill. */
  delta?: Partial<Pick<AiProfile, 'tightness' | 'aggression' | 'bluff'>>
  /** Rare table talk — one quiet line, heavily rationed (see store/game). */
  lines: CharacterLines
}

const av = (seed: string, backgroundColor: string): AvatarSpec => ({
  seed: `pip-cast-${seed}`,
  backgroundColor,
})

export const CAST: readonly Character[] = [
  // --- the low tables: the Garage, the Pub, the Pool Hall and friends -------
  {
    id: 'doris',
    name: 'Doris',
    bio: 'Brings her own biscuits. Plays every hand she’s dealt.',
    avatar: av('doris', 'ffd5dc'),
    bands: ['low'],
    delta: { tightness: -0.1, aggression: -0.05 },
    lines: {
      seat: ['Doris settles in and opens a tin of biscuits.', '“Deal me in, love,” says Doris.'],
      win: [
        '“Beginner’s luck,” says Doris, for the ninth time.',
        'Doris sweeps the pot in like crumbs off a table.',
      ],
      bust: ['“Well, that’s the bus fare gone,” says Doris.', 'Doris heads home to feed the cat.'],
    },
  },
  {
    id: 'frank',
    name: 'Frank',
    bio: 'Swears he’s never bluffed in his life. Bluffs constantly.',
    avatar: av('frank', 'b6e3f4'),
    bands: ['low'],
    delta: { bluff: 0.1, aggression: 0.08 },
    lines: {
      seat: [
        'Frank arrives ten minutes late and blames traffic.',
        'Frank promises to play it straight tonight.',
      ],
      win: [
        '“Told you I had it,” says Frank. He did not have it.',
        'Frank rakes it in, looking extremely honest.',
      ],
      bust: [
        'Frank leaves muttering about rigged decks.',
        '“One bad card,” says Frank. It was several.',
      ],
    },
  },
  {
    id: 'marge',
    name: 'Marge',
    bio: 'Waits for aces. Sometimes gets them.',
    avatar: av('marge', 'd1f4d0'),
    bands: ['low'],
    delta: { tightness: 0.12, aggression: -0.05 },
    lines: {
      seat: [
        'Marge orders a lemonade and means business.',
        'Marge folds her coat, then her first six hands.',
      ],
      win: [
        'Marge taps the table twice. High praise.',
        '“Patience,” says Marge, stacking quietly.',
      ],
      bust: ['Marge taps the table and heads home.', 'Marge leaves exactly as calmly as she came.'],
    },
  },
  {
    id: 'benny',
    name: 'Benny',
    bio: 'Watched every training video. Understood some.',
    avatar: av('benny', 'f4e7b6'),
    bands: ['low'],
    delta: { aggression: 0.12, bluff: 0.05 },
    lines: {
      seat: [
        'Benny shuffles his chips like the videos taught him.',
        'Benny mentions “ranges” within the first minute.',
      ],
      win: [
        '“Standard,” says Benny. It was not standard.',
        'Benny wins one and updates his spreadsheet.',
      ],
      bust: ['Benny goes home to rewatch episode four.', '“Cooler,” says Benny, uncertainly.'],
    },
  },
  {
    id: 'priya',
    name: 'Priya',
    bio: 'Says three words an hour. All of them true.',
    avatar: av('priya', 'c0aede'),
    bands: ['low', 'mid'],
    delta: { tightness: 0.06, aggression: 0.06 },
    lines: {
      seat: ['Priya nods hello and says nothing else.', 'Priya sits, watches, waits.'],
      win: ['Priya says nothing. The chips say it.', '“Thank you,” says Priya, precisely once.'],
      bust: [
        '“Nice hand,” says Priya, and means it.',
        'Priya leaves without a word. Somehow politely.',
      ],
    },
  },
  {
    id: 'gus',
    name: 'Gus',
    bio: 'It’s his garage. He’d rather you didn’t win in it.',
    avatar: av('gus', 'ffdfbf'),
    bands: ['low'],
    delta: { tightness: -0.06 },
    lines: {
      seat: [
        'Gus drags in another folding chair. “Room for one more.”',
        'Gus sweeps sawdust off the felt. It isn’t felt.',
      ],
      win: [
        '“House rules,” Gus grins, raking it in.',
        'Gus wins and immediately re-racks everyone’s chips.',
      ],
      bust: ['Gus goes to find more folding chairs.', '“Lock up when you’re done,” says Gus.'],
    },
  },
  {
    id: 'sofia',
    name: 'Sofia',
    bio: 'Between shots. Never misses either table.',
    avatar: av('sofia', 'b6e3f4'),
    bands: ['low', 'mid'],
    delta: { bluff: 0.06, aggression: 0.05 },
    lines: {
      seat: [
        'Sofia chalks a cue she isn’t using.',
        'Sofia leans her cue against the chair. Claimed.',
      ],
      win: ['Sofia banks the pot off two cushions.', '“Called it,” says Sofia. She had, quietly.'],
      bust: [
        'Sofia shrugs and racks up the next game.',
        'Sofia is already lining up a long pot on the far table.',
      ],
    },
  },
  {
    id: 'ted',
    name: 'Ted',
    bio: 'Has a seat at the bar with his name on it. Literally.',
    avatar: av('ted', 'd1f4d0'),
    bands: ['low'],
    delta: { aggression: -0.08 },
    lines: {
      seat: [
        'Ted brings his pint over. It’s not his first.',
        'Ted asks what the blinds are. Again.',
      ],
      win: [
        'Ted toasts the table. “To poker!”',
        'Ted wins and buys himself a celebratory packet of crisps.',
      ],
      bust: [
        'Ted declares darts the superior game and leaves.',
        '“Same time next week,” says Ted, unbothered.',
      ],
    },
  },
  {
    id: 'astrid',
    name: 'Astrid',
    bio: 'On her fourth coffee. It’s not helping. Or it is.',
    avatar: av('astrid', 'c0aede'),
    bands: ['low', 'mid'],
    delta: { aggression: 0.08, bluff: 0.04 },
    lines: {
      seat: [
        'Astrid arrives with a thermos the size of a leg.',
        'Astrid checks the time, winces, sits anyway.',
      ],
      win: ['Astrid celebrates with more coffee.', '“Sleep is a fold,” says Astrid, stacking.'],
      bust: [
        'Astrid decides this is technically bedtime.',
        'Astrid leaves at exactly caffeine o’clock.',
      ],
    },
  },

  // --- the mid tables: the Card Room up the Riverboat ------------------------
  {
    id: 'vivienne',
    name: 'Vivienne',
    bio: 'Plays position like a chess opening.',
    avatar: av('vivienne', 'c0aede'),
    bands: ['mid'],
    delta: { tightness: 0.08, aggression: 0.08 },
    lines: {
      seat: [
        'Vivienne takes the seat on the button’s left. Deliberately.',
        'Vivienne sets down her coat and her standards.',
      ],
      win: [
        '“Position,” says Vivienne, to no one in particular.',
        'Vivienne collects the pot like a rent payment.',
      ],
      bust: [
        'Vivienne leaves precisely as gracefully as she arrived.',
        '“Well played,” says Vivienne, meaning partly it.',
      ],
    },
  },
  {
    id: 'carlos',
    name: 'Carlos',
    bio: 'Knows every dealer downtown by name.',
    avatar: av('carlos', 'ffdfbf'),
    bands: ['mid'],
    lines: {
      seat: [
        'Carlos waves at the whole room on his way in.',
        'Carlos asks after the dealer’s kids. There is no dealer.',
      ],
      win: ['Carlos tips an imaginary dealer.', '“Downtown luck,” says Carlos, beaming.'],
      bust: [
        'Carlos is already texting the next table.',
        'Carlos leaves a tip anyway. Force of habit.',
      ],
    },
  },
  {
    id: 'jun',
    name: 'Jun',
    bio: 'Works the docks. Collects bounties both places.',
    avatar: av('jun', 'b6e3f4'),
    bands: ['mid'],
    delta: { aggression: 0.1 },
    lines: {
      seat: [
        'Jun cracks his knuckles out of habit, not menace.',
        'Jun checks the exits, then his cards.',
      ],
      win: ['Jun stacks the pot like cargo. Efficiently.', '“Paid on delivery,” says Jun.'],
      bust: ['Jun clocks out early. The tide’s out.', 'Jun nods once and ships out.'],
    },
  },
  {
    id: 'mo',
    name: 'Mo',
    bio: 'Floats the flop, barrels the turn, blames the river.',
    avatar: av('mo', 'd1f4d0'),
    bands: ['mid'],
    delta: { bluff: 0.08 },
    lines: {
      seat: ['Mo boards last, as always.', 'Mo licks a thumb and checks the wind. Indoors.'],
      win: ['“The river provides,” says Mo.', 'Mo hauls the pot in hand over hand.'],
      bust: [
        'Mo mutters something nautical and disembarks.',
        '“Wrong river,” says Mo, philosophically.',
      ],
    },
  },
  {
    id: 'elaine',
    name: 'Elaine',
    bio: 'Owns the chop shop. The name isn’t about cars.',
    avatar: av('elaine', 'ffd5dc'),
    bands: ['mid'],
    delta: { aggression: 0.1, tightness: -0.05 },
    lines: {
      seat: [
        'Elaine sets a kitchen timer on the table.',
        'Elaine rolls up her sleeves before the first deal.',
      ],
      win: ['Elaine’s timer dings, right on schedule.', '“Next,” says Elaine, stacking fast.'],
      bust: [
        'Elaine leaves. Somewhere, an engine revs.',
        'Elaine pockets the timer. “Back in twenty.”',
      ],
    },
  },
  {
    id: 'dmitri',
    name: 'Dmitri',
    bio: 'Thinks four streets ahead. Occasionally in the wrong hand.',
    avatar: av('dmitri', 'f4e7b6'),
    bands: ['mid'],
    delta: { tightness: 0.1 },
    lines: {
      seat: [
        'Dmitri cleans his glasses. Twice.',
        'Dmitri arranges his chips by denomination, then by mood.',
      ],
      win: [
        '“As calculated,” says Dmitri, visibly relieved.',
        'Dmitri permits himself one small nod.',
      ],
      bust: [
        'Dmitri requests the hand history for later review.',
        '“Fascinating,” says Dmitri, meaning painful.',
      ],
    },
  },
  {
    id: 'rosa',
    name: 'Rosa',
    bio: 'Calls the flop, the turn, your bluff.',
    avatar: av('rosa', 'ffd5dc'),
    bands: ['mid'],
    delta: { aggression: 0.02, tightness: -0.04 },
    lines: {
      seat: [
        'Rosa sits down like she never left.',
        'Rosa stacks her chips into one unbothered tower.',
      ],
      win: ['Rosa knew you didn’t have it.', '“Mm,” says Rosa, collecting.'],
      bust: [
        'Rosa applauds the table and takes her leave.',
        'Rosa leaves the tower standing. A monument.',
      ],
    },
  },

  // --- the high tables: the Penthouse to the Main Event ----------------------
  {
    id: 'laurent',
    name: 'Laurent',
    bio: 'Old money. Older patience.',
    avatar: av('laurent', 'b6e3f4'),
    bands: ['high'],
    delta: { tightness: 0.1, aggression: 0.02 },
    lines: {
      seat: [
        'Laurent’s watch costs more than the prize.',
        'Laurent orders nothing. He brought his own stillness.',
      ],
      win: [
        'Laurent nods, as if it were always inevitable.',
        'Laurent accepts the pot the way one accepts weather.',
      ],
      bust: [
        'Laurent congratulates you in flawless understatement.',
        '“Refreshing,” says Laurent, departing.',
      ],
    },
  },
  {
    id: 'ingrid',
    name: 'Ingrid',
    bio: 'Won it all in Monte Carlo. Twice. Gave it back once.',
    avatar: av('ingrid', 'ffdfbf'),
    bands: ['high'],
    lines: {
      seat: [
        'Ingrid air-kisses the dealer’s general direction.',
        'Ingrid sits as though photographed.',
      ],
      win: ['Ingrid collects, comme il faut.', '“Encore,” says Ingrid, to the deck.'],
      bust: [
        '“Monaco calls,” says Ingrid, unbothered.',
        'Ingrid leaves; the table feels underdressed.',
      ],
    },
  },
  {
    id: 'webb',
    name: 'Webb',
    bio: 'Wrote the book. The other pros wrote reviews.',
    avatar: av('webb', 'd1f4d0'),
    bands: ['high'],
    delta: { tightness: 0.05, aggression: 0.05 },
    lines: {
      seat: [
        'Webb reads the table like a first edition.',
        'Webb turns an invisible page and posts the blind.',
      ],
      win: [
        'Webb pencils a note in the margin of nothing.',
        '“Chapter six,” says Webb, raking it in.',
      ],
      bust: ['“Variance,” says Webb, almost fondly.', 'Webb closes the book on tonight.'],
    },
  },
  {
    id: 'kenji',
    name: 'Kenji',
    bio: 'Three bracelets. Sleeps with the third.',
    avatar: av('kenji', 'f4e7b6'),
    bands: ['high'],
    delta: { aggression: 0.08 },
    lines: {
      seat: [
        'Kenji stacks his chips into perfect towers.',
        'Kenji straightens one chip nobody else could see.',
      ],
      win: ['Kenji’s towers acquire a new wing.', 'Kenji wins without disturbing a single stack.'],
      bust: [
        'Kenji bows slightly and vanishes into the night.',
        'Kenji leaves the towers perfectly level. Respect.',
      ],
    },
  },
  {
    id: 'celeste',
    name: 'Celeste',
    bio: 'You’ve seen her on a final table. She hasn’t seen you.',
    avatar: av('celeste', 'c0aede'),
    bands: ['high'],
    delta: { bluff: 0.06, aggression: 0.05 },
    lines: {
      seat: [
        'Celeste doesn’t look up from behind her sunglasses.',
        'Celeste sits down and the lights feel dimmer.',
      ],
      win: [
        'Celeste wins like it’s a formality.',
        'Celeste slides the pot in without breaking gaze.',
      ],
      bust: [
        'Celeste removes her sunglasses. Respect.',
        'Celeste leaves; the cameras follow, out of habit.',
      ],
    },
  },
  {
    id: 'sal',
    name: 'Big Sal',
    bio: 'Plays big pots on feel. The feel is usually right.',
    avatar: av('sal', 'ffdfbf'),
    bands: ['high'],
    delta: { tightness: -0.08, aggression: 0.1 },
    lines: {
      seat: [
        'Big Sal’s laugh arrives before he does.',
        'Big Sal squeezes into the chair and calls it home.',
      ],
      win: ['Big Sal laughs. The chips join in.', '“Felt right,” says Big Sal. It usually does.'],
      bust: [
        'Big Sal tips his hat. “Kid, that was poker.”',
        'Big Sal leaves laughing at a joke nobody told.',
      ],
    },
  },

  // --- pinned characters ------------------------------------------------------
  {
    id: 'ray',
    name: 'Uncle Ray',
    bio: 'Hosts the Kitchen Table. Roots for you, mostly.',
    avatar: av('ray', 'd1f4d0'),
    bands: ['low'],
    only: ['kitchen'],
    lines: {
      seat: ['Uncle Ray puts the kettle on.', '“Just like old times,” says Uncle Ray, dealing.'],
      win: [
        '“One more?” says Uncle Ray, already shuffling.',
        'Uncle Ray wins and looks faintly apologetic.',
      ],
      bust: ['Uncle Ray beams. “Go get ’em.”', '“Knew you had it in you,” says Uncle Ray.'],
    },
  },
  {
    id: 'pearl',
    name: 'Pearl',
    bio: 'Runs the Chip Shop. Everything’s for sale except an edge.',
    avatar: av('pearl', 'f4e7b6'),
    bands: ['low'],
    // Pinned to a non-venue: Pearl works the counter, never a table.
    only: ['shop'],
    lines: {
      seat: [
        'Pearl polishes a chip that was already clean.',
        '“Browse all you like,” says Pearl. “The cards play the same either way.”',
        'Pearl straightens the shelf. It was already straight.',
        '“Style’s the only thing worth paying for,” says Pearl.',
      ],
      win: ['“Lovely choice,” says Pearl, wrapping it up.'],
      bust: ['Pearl flips the sign to CLOSED. It still says OPEN.'],
    },
  },
  {
    id: 'sable',
    name: 'Sable',
    bio: 'The Vault’s last lock. Nobody’s picked it twice.',
    avatar: av('sable', 'c0aede'),
    bands: ['high'],
    only: ['vault'],
    delta: { tightness: 0.05, aggression: 0.05 },
    lines: {
      seat: ['Sable slides the deck across without a word.', 'The door seals. Sable deals.'],
      win: ['Sable locks the pot away.', 'Sable’s expression does not change. It never has.'],
      bust: [
        'Sable almost smiles. The Vault opens.',
        'Sable stands, nods once. Combination cracked.',
      ],
    },
  },
] as const

/** Band by buy-in, so new venues are covered automatically. */
export function bandFor(venue: Venue): CastBand {
  if (venue.buyIn <= 1_500) return 'low'
  if (venue.buyIn <= 25_000) return 'mid'
  return 'high'
}

/** Who plays this venue: pinned characters if any, else the band's regulars. */
export function rosterFor(venue: Venue): Character[] {
  const pinned = CAST.filter((ch) => ch.only?.includes(venue.id))
  if (pinned.length > 0) return pinned
  const band = bandFor(venue)
  return CAST.filter((ch) => !ch.only && ch.bands.includes(band))
}

/**
 * Draw tonight's table: a shuffled slice of the venue's roster, topped up from
 * the wider (unpinned) cast if the roster ever runs short. Pass a seeded rng
 * for a reproducible draw (the Daily Deal does).
 */
export function draftCast(
  venue: Venue,
  count: number,
  rng: () => number = Math.random,
): Character[] {
  const draw = (pool: Character[], n: number): Character[] => {
    const copy = [...pool]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy.slice(0, n)
  }
  const picked = draw(rosterFor(venue), count)
  if (picked.length < count) {
    const have = new Set(picked.map((ch) => ch.id))
    const rest = CAST.filter((ch) => !ch.only && !have.has(ch.id))
    picked.push(...draw(rest, count - picked.length))
  }
  return picked
}

/** The venue's AiProfile with the character's nudges applied. Skill untouched. */
export function profileFor(venue: Venue, ch: Character): AiProfile {
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
  return {
    ...venue.ai,
    tightness: clamp01(venue.ai.tightness + (ch.delta?.tightness ?? 0)),
    aggression: clamp01(venue.ai.aggression + (ch.delta?.aggression ?? 0)),
    bluff: clamp01(venue.ai.bluff + (ch.delta?.bluff ?? 0)),
  }
}

export function characterById(id: string): Character | undefined {
  return CAST.find((ch) => ch.id === id)
}

# The daily reward

> **Status: built (2026-10-25).** Rules in `src/lib/dailyReward.ts` (tested by
> `tests/dailyReward.test.ts`); the card and the claim in `src/components/menu/DailyReward.tsx`;
> the record is `profile.dailyReward` (`PERSIST_VERSION` 28), merged by `mergeRewards`.

Come back each day, claim chips, and the chips grow with the streak (Will, 2026-10-25). It is
a retention feature, and the one place Pip hands out chips for turning up.

## The rules

- **One flame.** Claiming counts the day for the streak (`lib/streak`), the same as playing a
  hand. The streak is days you showed up.
- **Counted in buy-ins at your table**, the lowest ladder rung you have not won yet (the Main
  Event once you have won them all). Day 1 is always at least a seat there (Will, 2026-10-25:
  "it needs to be at least enough to get to a table relative to your level").
- **A seven-day ladder:** 1 / 1.25 / 1.5 / 1.75 / 2 / 2.5 / 3 buy-ins. A brand-new player gets
  100 on day 1 and 300 on day 7; someone climbing toward the Main Event gets a million on day 1.
- **Past the first week the top rate holds** (Will, 2026-10-25): every day after day 7 pays three
  buy-ins, so a long streak is always worth more than starting one.
- **Miss a day and it goes back to day 1.** Earned items stay yours.
- **Members get double the chips**, every day. Streak items are the same for everybody.
- **What the streak hands over** (`MILESTONES`), never sold, held in `owned` once earned:

  | Day | Unlock |
  |---|---|
  | 7 | Ember ring |
  | 14 | Kindling card back |
  | 21 | **The Regulars' Table** (`REGULARS_TABLE`), and **Maud**, a regular who only sits there |
  | 30 | Hearth dealer button |
  | 60 | Embers table finish |
  | 100 | The Hundred (souvenir) |
  | 150 | Crackle sound pack |
  | 200 | Phoenix card back |
  | 365 | The Year (souvenir) |

  Items carry `streakDay` in their config and live on the shop's Streak tab. The table carries
  `streakUnlock`; `refuseSitDown` answers `streak-locked` without it (after the money check), and
  its lobby card (`RegularsCard`) appears only once earned. Its painting is
  `public/venues/regulars.jpg`.
- **A gift, not winnings:** the Roll goes up and the peak (rank) does not.

## Where it shows

- **A card under the streak flame**, waiting to be tapped. Never a pop-up. Once claimed, it goes,
  and the flame stays.
- **The claim dialog**: the week's ladder, the next streak item, the claim, a burst of chips, and
  the item turned over if one is due.
- **The streak sheet** (2026-11-04, Will: "I just want to see what i've had and what's coming up
  so I can see rewards i'm gonna get as well as my current streak"). The flame under the Roll
  (`StreakBadge`) is always on Home, claimed or not, and opens a bottom sheet
  (`components/menu/StreakSheet.tsx`, on `ui/sheet`). It holds three things only:
  - **the streak**, big: the flame and "N days" (or "No streak yet"). Once it scrolls away the
    title row shows it instead, like an iOS large title;
  - **what you've had**: every day of this streak, oldest first, with its date and chips, and each
    unlock ticked if it is in `owned`. Plain days from day 7 on pay the same, so a run of them
    between unlocks is one row ("Days 8 to 13, 300 chips a day");
  - **today**, marked, "Claimed" or "Not claimed yet", then **what's coming**: the next five days
    each, then every unlock still ahead with its day and "in N days".

  One timeline: a solid rail through the days had, dashed through the days to come. It opens
  scrolled so today is in sight. Members see doubled chips; there is no other members line. One
  footnote: "Miss a day and it starts again." Claiming stays on the Home card.

  **What it knows about the past.** No history of claims is stored, only `streak` (its length
  and last day) and `dailyReward.lastClaim`. So a past day's chips are worked out from the rules
  at today's table and today's membership; a day kept by playing a hand rather than claiming
  shows what that day would have paid. Unlocks are ticked from `owned`, so those are exact.
  Opening it sends `streak-sheet-opened` once per tab (`trackOnce`). The chip and the item art
  it shares with the card live in `components/menu/RewardArt.tsx`.
- **The streak reminder email** (docs/email.md) says what today's claim pays, what a member gets,
  and what item is next. The day after a streak ends, it offers day 1.

## Honest limits

Chips live on the device, so a player who edits their profile can claim twice. That is the same
trade the rest of the economy makes (docs/sync.md). A second device cannot claim the same day:
`mergeRewards` keeps the later claim.

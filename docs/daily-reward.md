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

- **A card under the Roll**, waiting to be tapped. Never a pop-up. Once claimed, it gives its
  place back to the streak flame.
- **The claim dialog**: the week's ladder, the next streak item, the claim, a burst of chips, and
  the item turned over if one is due.
- **The streak sheet** (2026-11-04, Will: "I need to be able to tap the streak button and see
  my rewards"). The flame under the Roll (`StreakBadge`) is a button that opens a bottom sheet
  (`components/menu/StreakSheet.tsx`, on `ui/sheet`), titled with the streak ("7-day streak", or
  "No streak yet"). It shows today (the claim, through `claimDailyReward`, if it is still to do;
  otherwise tomorrow's reward), the last seven days lit where they counted (worked out from
  `streak.current` and `lastDate`), every `MILESTONES` unlock in order with owned ones ticked and
  the next unowned one marked "N days to go", how the streak works, and members' double chips (a
  quiet `membershipFor('daily-reward')` link for everyone else). Opening it sends
  `streak-sheet-opened` once per tab (`trackOnce`). The chip, the sheen and the item art it shares
  with the card live in `components/menu/RewardArt.tsx`.
- **The streak reminder email** (docs/email.md) says what today's claim pays, what a member gets,
  and what item is next. The day after a streak ends, it offers day 1.

## Honest limits

Chips live on the device, so a player who edits their profile can claim twice. That is the same
trade the rest of the economy makes (docs/sync.md). A second device cannot claim the same day:
`mergeRewards` keeps the later claim.

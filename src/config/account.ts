/**
 * What the site says about the free account, in one sentence.
 *
 * The account went prominent in the app in #97 (technology#97) and the search
 * pages were left alone, so a visitor arriving from Google on a guide or on
 * `/play-poker-free-no-signup` never heard that it exists. Those pages are the
 * ones strangers land on, which makes them the ones the offer was missing from.
 *
 * It is a constant rather than eight sentences because within a week of the
 * change the site was describing the same account three different ways. One
 * fact gets one sentence: a page that wants to say something else about the
 * account has to come here and change it for every page at once.
 *
 * The second clause is not decoration. `Landing.tsx` promises "No forced
 * pop-ups, no pay-to-win, no nagging. Ever.", and an offer that appears on
 * every guide without saying you can ignore it is how that promise starts
 * being false. Discoverability, not persuasion.
 */
export const ACCOUNT_OFFER =
  'A free account keeps your Roll on every device, and you never need one to play.'

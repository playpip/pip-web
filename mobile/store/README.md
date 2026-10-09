# App Store listing — Pip (iOS)

Everything for the App Store Connect listing. Phase 3 of `EXPO-PLAN.md`.

## What's here

| File | What it is |
|------|------------|
| `store.config.json` | EAS Metadata: name, subtitle, description, keywords, promo text, URLs, categories, age rating answers, copyright, review contact and notes. en-GB and en-US carry the same text. |
| `screenshots/01-home.png` … `07-stats.png` | Seven 1320×2868 PNGs for the 6.9" iPhone slot, no alpha. Already listed in `store.config.json` under `APP_IPHONE_67`. |

The screenshots are the live site at playpip.io in a 440×956 iPhone viewport at 3×, with the
app flag set (so the copy says "this app"), and a seeded profile (Robin, 18,450 chips, walnut
table). Screens 03–06 are member features. They were captured with a stand-in signed-in member,
faked in the browser only, so nothing was written to Supabase.

## Before you submit: fill these in

In `store.config.json` → `apple.review`:

- `email`, `phone`: your contact details for App Review.
- `demoUsername`, `demoPassword`: create a real Pip account for the reviewer and give it an
  active membership row, so every member feature unlocks.
- In `notes`, the two `[WILL: …]` lines: the IAP product IDs, and a reminder about the demo account. Delete both brackets once done.

Also decide:

- **Name.** The config has `Pip: Poker Trainer`. "Pip" on its own is almost certainly taken
  on the App Store. Other options: `Pip: Texas Hold'em Trainer` (26), `Pip Poker` (9),
  `Pip – Hold'em, Redesigned` (25). If you change the name, keep "poker" or "hold'em" in it,
  because the name carries the most search weight.
- **Subtitle.** The config has `Calm Texas Hold'em practice` (27). Alternatives:
  `Texas Hold'em, play money` (25), `Learn poker on a quiet table` (28).
- **Copyright.** Set to `2026 Ava Technologies Global Ltd`, because that is the `SELLER` in
  `src/config/membership.ts` and the seller named in the Terms. If the Apple Developer account
  is in your own name, use `2026 Will Lamerton`. Either way, the seller name on the App Store
  is the developer account's legal entity, so the Terms should name the same one.

## Pushing it

1. `eas.json` already points EAS at `store/store.config.json` (`submit.production.ios.metadataPath`).
2. The app record must already exist in App Store Connect (`eas submit` creates it, or create
   it by hand with bundle ID `io.playpip.app`).
3. From `mobile/`: `npx eas-cli@latest metadata:push`. This pushes the text, age rating,
   categories, review info and screenshots. Screenshot paths in the config are relative to
   `mobile/`.
4. If the push won't take the screenshots, drag the seven PNGs in order into the 6.9" iPhone
   slot in App Store Connect. App Store Connect scales them down for the smaller iPhone sizes.
   No iPad set is needed, because `supportsTablet` is false.
5. Check in App Store Connect that the age rating comes out at 18+ (17+ under the older
   scheme) and that the categories read Games › Card (and Board), secondary Education.

`release` is manual release plus phased rollout. Change `automaticRelease` to `true` if you
want it live the moment it is approved.

## App Privacy ("nutrition label")

Worked out from `docs/sync.md`, `src/app/privacy/page.tsx`, `src/lib/analytics.ts`,
`src/store/entitlement.ts` and the app shell. Nothing leaves the phone until someone creates an
account, apart from the anonymous Umami counts.

**Tracking: No.** No ad SDKs, no IDFA, no data broker, no cross-app or cross-site linking.
No App Tracking Transparency prompt is needed.

| Data type (Apple's name) | Collected? | Linked to the user? | Used for tracking? | Purpose | Where it comes from |
|---|---|---|---|---|---|
| Contact Info › Email Address | Yes, only with an account | Yes | No | App Functionality | Supabase Auth sign-in, password reset, and the opt-in Daily/weekly emails (sent via Resend) |
| User Content › Gameplay Content | Yes, only with an account | Yes | No | App Functionality | The synced profile: chosen name, avatar, Roll, stats, drill ratings, cosmetics |
| Identifiers › User ID | Yes, only with an account | Yes | No | App Functionality | Supabase user id |
| Identifiers › Device ID | Yes, only with an account | Yes | No | App Functionality | The random `device_id` stored with the synced row for the conflict prompt. It is app-generated, not the IDFA. Declaring it is the safe reading. |
| Purchases › Purchase History | Yes, members only | Yes | No | App Functionality | The `memberships` row (status, renewal date). In-app purchases themselves are processed by Apple. |
| Usage Data › Product Interaction | Yes | **No** | No | Analytics | Umami, cookieless: page views and named events only, no identifiers |

Not collected: location, contacts, health, financial info (Apple handles payment; Stripe is
web only), browsing history, search history, diagnostics, sensitive info. Cloudflare's
standard access logs (IP addresses) are hosting logs, not something the app collects, and
Apple does not ask for them.

**Native Google and Apple sign-in are built**, so declare **Contact Info › Name** (linked, App
Functionality). Google and Apple send a name, and the privacy page says Supabase
keeps it. Google also sends a profile picture URL. Pip never shows it, but if you want to be
thorough, declare it under User Content › Photos or Videos.

## Age rating answers, and why

| Question | Answer | Why |
|---|---|---|
| Simulated Gambling | **Frequent/Intense** | The whole app is poker with play chips. This answer alone puts it at 18+ (17+ in the older scheme). EXPO-PLAN already expects this. |
| Gambling (real money) | **No** | Nothing can be deposited, won or cashed out, and chips are never sold (Terms, "It's play money"). |
| Alcohol, Tobacco or Drug Use or References | **Infrequent/Mild** | Table talk and shop copy mention pints and a beermat (`config/cast.ts`, `config/shop.ts`). It doesn't change the rating, but answering None would be wrong. |
| Contests | None | No prizes. The ladder and the Daily are single-player. |
| Unrestricted Web Access | No | The web view only loads playpip.io. Every other link opens in Safari (`onShouldStartLoadWithRequest` in `App.tsx`). |
| User-Generated Content, Messaging and Chat | No | No chat, and no player content is shown to anyone else. |
| Advertising | No | No ads. |
| Loot boxes | No | The Chip Shop sells fixed cosmetics for play chips, with no random rewards. |
| Everything else (violence, sexual content, horror, medical, profanity, mature themes, weapons) | None | — |

## Export compliance

Answer **No** to non-exempt encryption. `ios.config.usesNonExemptEncryption: false` is already
in `app.json`, so App Store Connect won't ask. Pip only uses HTTPS through the system web view.

## Things that could get it rejected

Updated 2026-10-09, after native sign-in, In-App Purchase, the offline screen and `/support`
landed. In order of how likely they are:

1. **In-App Purchase has to be live in the build you submit (3.1.1, 2.1).** The code is in
   (`mobile/src/purchases.ts`, the membership page in the app, Restore purchases,
   `revenuecat-webhook`), but it only switches on once `EXPO_PUBLIC_REVENUECAT_IOS_KEY` is in
   `eas.json` and the products exist (`mobile/README.md` → In-app purchases). A build without
   it shows "Joining in the app is coming soon", which Apple will reject. Submit the two
   subscriptions with the build.
2. **A web view around a website (4.2 minimum functionality).** Still the most common reason
   wrappers are turned down. Pip now does real native work: haptics shaped to every sound,
   Sign in with Apple, In-App Purchase, and a native no-connection screen. The review notes
   say so.
3. **Age stated in your own pages.** `/privacy` and `/terms` say "13 and over"; the store
   rating is 18+. Not a blocker, but it reads as a contradiction. Your call how to word it.
4. **The Terms describe Stripe only** ("cancel from Settings", "charged by Ava Technologies").
   Add the Apple path: billed by Apple, cancelled in App Store settings, refunds through
   Apple. `/support` already says this, and the app's purchase screen carries the auto-renew
   wording and the Terms and Privacy links 3.1.2 needs.
5. **Demo account.** Create it, give it an active membership (insert a `memberships` row with
   status `active` and a future `current_period_end`), and put its details in the review
   fields.
6. **Account deletion is three taps** (Settings › Manage account › Delete my account and
   synced data). That meets 5.1.1(v). Members who bought in the app are told to cancel with
   Apple first, which Apple asks for.

Fixed since the first draft: the offline screen, the support page (`supportUrl` now points at
`/support`), the sign-in copy (it names only the providers this build offers), and
`metadataPath` in `eas.json`.

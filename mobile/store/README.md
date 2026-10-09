# App Store listing — Pip (iOS)

Everything for the App Store Connect listing. Phase 3 of `EXPO-PLAN.md`.

## What's here

| File | What it is |
|------|------------|
| `store.config.json` | EAS Metadata: name, subtitle, description, keywords, promo text, URLs, categories, age rating answers, copyright, review contact and notes. en-GB and en-US carry the same text. |
| `screenshots/01-home.png` … `07-stats.png` | Seven 1320×2868 PNGs for the 6.9" iPhone slot, no alpha. Listed in `store.config.json` under `APP_IPHONE_67`. |
| `promo/` | Promotional art: two header images and two search-results images (below). |
| `screenshots-6.3/` | The same seven at 1206×2622 for the 6.3" slot, rendered at that size rather than scaled down. Listed under `APP_IPHONE_61`. |

The screenshots are the live site at playpip.io in a 440×956 iPhone viewport at 3×, with the
app flag set (so the copy says "this app"), and a seeded profile (Robin, 18,450 chips, the
green Baize finish, mint avatar background, so the felt, backdrop and Roll sparkline all read
green). Screens 03–06 are member features. They were captured with a stand-in signed-in member,
faked in the browser only, so nothing was written to Supabase.

## Before you submit: fill these in

In `store.config.json` → `apple.review`:

- `email`, `phone`: your contact details for App Review.
- `demoUsername`, `demoPassword`: create a real Pip account for the reviewer and give it an
  active membership row, so every member feature unlocks.
- In `notes`, the two `[WILL: …]` lines: the IAP product IDs, and a reminder about the demo account. Delete both brackets once done.

Also decide:

- **Name.** `Pip: Poker`, in both locales.
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
4. **Which folder goes where:** `screenshots/` goes in the **6.9" Display** slot (required).
   `screenshots-6.3/` goes in the **6.3" Display** slot (optional; without it App Store Connect
   scales the 6.9" set down). If the push won't take them, drag each folder's seven PNGs in
   order into its slot by hand. No iPad set is needed, because `supportsTablet` is false.
5. Check in App Store Connect that the age rating comes out at 18+ (17+ under the older
   scheme) and that the categories read Games › Card (and Board), secondary Education.

`release` is manual release plus phased rollout. Change `automaticRelease` to `true` if you
want it live the moment it is approved.

## Promotional art

These go in App Store Connect's promotional artwork / featuring section (the app's page under
App Store › Promotional Artwork, or the "Nominate" featuring form). They aren't part of
`eas metadata:push`, so upload them by hand. All are opaque PNGs, composed at their own size,
with the content kept inside roughly the central 80% so Apple's crops and overlays miss it.

| File | Slot | What's on it |
|------|------|--------------|
| `promo/header-3840x1646.png` | Header / hero artwork, 3840×1646 (wide) | Chip, `pip` wordmark, "Hold'em, redesigned.", "Play money. No ads. No pop-ups.", and three screens: home, table, the Webb lesson |
| `promo/header-5244x2950.png` | Header / hero artwork, 5244×2950 (16:9) | The same, with the three screens slightly overlapped to fit the narrower frame |
| `promo/search-1920x1280.png` | Search results artwork, 1920×1280 | Chip, wordmark and the same line, set large for small display, with one screen (the table) |
| `promo/search-3840x2560.png` | Search results artwork, 3840×2560 (2×) | The same at double size |

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

# Data, portability & offline

Pip has **no accounts and no server**. Your progress is a single persisted profile
that lives in the browser on the device you play on. This doc covers how that data
is kept safe, how you move it between devices without an account, and how the app
works offline and updates itself.

See also: persistence shape lives in [`store/profile.ts`](../src/store/profile.ts);
the deploy/release side is in [development.md](./development.md#deploy--releases).

## What's stored, and where

- **`profile` (persisted).** Everything that survives a session — name, avatar,
  Roll, peak Roll, stats, per-venue records, per-cast reads, awards, cosmetics.
  Zustand `persist` → `localStorage` under `pip.profile`, **versioned** with a
  `migrate` hook so the format can evolve without wiping progress. Change its shape
  → bump `PERSIST_VERSION` and add a migrate branch.
- **Live table snapshot (transient).** The in-progress hand is snapshotted to
  `localStorage` (`game.ts`) at each deal/hand-end so a refresh resumes the table.
  Not part of a backup — it's scratch state for the current sit-down.

Only the profile is treated as durable data. Everything else is derivable.

## Keeping local storage durable

`localStorage` is the right tool for an account-free, single-player app, but it can
be evicted under storage pressure or by aggressive privacy settings. Two defences,
both wired in `AppBoot`:

- **`navigator.storage.persist()`** on boot — asks the browser to mark our storage
  persistent so it isn't evicted. Honoured by Chrome/Firefox.
- **Install the PWA.** On iOS the real protection against Safari's 7-day
  script-storage eviction is an installed web app — which is also why `manifest.ts`
  exists and the app is installable.

## Moving a profile between devices

No accounts means we give the player explicit, low-friction ways to carry their
data. All three paths share **one envelope format and one validator** in
[`lib/backup.ts`](../src/lib/backup.ts) (`buildEnvelope` → `validateEnvelope`), so a
bad file, paste, or scan is rejected identically and **nothing touches the profile
until it fully validates** (atomic restore, then reload so `migrate` runs).

| Path | Carries | Good for | Where |
|------|---------|----------|-------|
| **Copy data / Paste** | Full profile, lossless | Same-person, any size | [`lib/transfer.ts`](../src/lib/transfer.ts) |
| **QR code** | Trimmed profile (identity + cosmetics) | Scan-to-phone, no typing | `profileQrUrl` + `ImportHandler` |
| **Back up to a file** | Full profile, lossless | Cold storage / archival | `exportProfile` / `readBackup` |

All of this lives in the "Move to another device" section of
[`SettingsDialog`](../src/components/settings/SettingsDialog.tsx).

### Code (copy / paste)

`transfer.ts` gzip-compresses the envelope (via `CompressionStream`, with a raw
base64url fallback) and base64url-encodes it behind a `pip1:`/`pip0:` prefix. A
full profile with 300-point Roll history is ~6–7 KB of JSON → a ~2 KB code. Copy
puts it on the clipboard; **Paste a code** decodes and offers the restore.

### QR (scan to phone)

A full profile is too dense for a reliably-scannable QR (~2 KB), so the QR path
carries a **trimmed** envelope — the `TRIMMED_KEYS` subset: identity (name, avatar,
Roll, peak Roll) and unlocks (awards, owned, cosmetics), **not** the heavy
history/stats. That encodes into a `~/game?p=<code>` deep link of a few hundred
chars — comfortable for a QR.

`QrCode.tsx` renders it; scanning opens the app, and `ImportHandler` (mounted on the
lobby, `/game`) reads the `p` param, offers the restore, and strips the param so a
refresh can't replay it. Detailed stats stay on the origin device — the copy/paste
code is the lossless option for everything.

> **A restore overwrites the whole profile on the target device** (the trimmed
> paths merge over defaults, so unlisted fields reset). The confirm step says so.

> **Convention exception:** `QrCode.tsx` uses a fixed white card (`bg-white`),
> against the theme-tokens-only rule in [design.md](./design.md). A QR is functional
> imagery that phone cameras want as dark-on-light; theme tokens wouldn't survive
> the camera. It's the one deliberate exception, commented in the file.

## Offline (the service worker)

The whole game is client-side, so after the first visit Pip is fully playable
offline. `public/sw.js` is a small, hand-rolled shell — no build-tool coupling:

- **Navigations:** network-first, falling back to the cached shell (`/`) offline.
- **Hashed/static assets** (`/_next/static`, icons, venue art): cache-first.
- **Everything else:** straight to the network.
- **404s are never cached** (the `response.ok` guards), so a deploy-window 404 can't
  become an asset forever.

The worker is registered in production only, from `useServiceWorkerUpdate`
(see [development.md](./development.md#versioning--cache-busting) for the update flow
and cache-busting).

## Loading & launch screen

Two layers cover "the app is loading", so the player never stares at a blank frame:

- **Native launch screen (installed PWA).** The OS composes one from `manifest.ts`
  — `background_color` (`#0a0a0b`) + the app icon + name. Free, shown before our
  code runs.
- **In-app splash (`Splash.tsx`).** Shown during the brief gap before the app
  hydrates, and while a venue table settles — it replaces the old blank
  `min-h-dvh` placeholders on `/game` (the PWA start URL), `/hand`, and the table.
  It's **deliberately JS-free** (markup + a CSS `animate-pulse`, the brand chip on a
  themed surface), so it's baked into the prerendered HTML and paints instantly,
  even before the bundle loads. `useHydrated` (an external-store gate) then flips to
  the real UI with no hydration mismatch.

Like the QR card, the chip mark uses the brand's fixed palette (it matches
`app/icon.svg`) — the accepted brand-mark exception to theme-tokens-only; the
surrounding surface uses tokens so it reads in both themes.

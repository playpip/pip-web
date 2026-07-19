# Main-menu tile art prompts

One ready-to-paste block per home-screen section tile (The Daily, The Rail,
Venues, Side Tables). They follow the **same template as the venue art** (see
`VENUE_PROMPTS.md`): a *scene*, flat minimalist vector, near-black background,
one dominant accent matching the tile's accent in `Home.tsx`.

Unlike venues (which are literal places), these are the abstract sections of the
app — so each subject is a small evocative vignette of what the section _is_ (the
one deal a day, the cash rail, the ladder of rooms, the spread of formats).

Shared rules: **square (1:1), ≥1024px, no text, no logos, no people.** Keep the
same style reference / seed as the venue set so it all reads as one family. The
tile crops to a 16:10 panel with `object-cover` (centre-weighted), so keep the
subject centred and give it a little headroom top and bottom. Save output to
`public/menu/<id>.jpg` and register it in `CATEGORY_IMAGES`
(`src/components/menu/CategoryArt.tsx`).

## The Daily — `daily` (accent #7C8CF0, periwinkle)

Flat minimalist vector illustration of a single playing card standing upright on a small pedestal beneath one bright circular spotlight, a soft sunrise-like glow rising behind it, a neat scatter of poker chips around the base, the rest of the room falling away into darkness. Detailed and layered, filling the frame, cinematic. Clean modern iOS-app aesthetic, limited palette dominated by periwinkle blue with charcoal and off-white accents, set against a near-black background (#0A0A0A). Subtle flat shading, soft ambient glow, slight isometric depth. Premium, cinematic. No text, no logos, no people.

## The Rail — `rail` (accent #4FB477, green)

Flat minimalist vector illustration of a polished brass spectator rail in the foreground overlooking a green-baize cash poker floor below, tall neat stacks of chips and a couple of felt card tables catching pooled overhead light, empty bar stools set along the rail, the far side of the room fading into shadow. Detailed and layered, filling the frame, cinematic. Clean modern iOS-app aesthetic, limited palette dominated by emerald green with charcoal and off-white accents, set against a near-black background (#0A0A0A). Subtle flat shading, soft ambient glow, slight isometric depth. Premium, cinematic. No text, no logos, no people.

## Venues — `venues` (accent #E0A458, gold)

Flat minimalist vector illustration of a grand carpeted staircase climbing past a row of lit doorways, each doorway glowing a slightly different warm hue like the entrance to a different room, a velvet rope stanchion and a small scatter of poker chips on the lower steps, the stair rising toward a bright landing above. Detailed and layered, filling the frame, cinematic. Clean modern iOS-app aesthetic, limited palette dominated by warm gold with charcoal and off-white accents, set against a near-black background (#0A0A0A). Subtle flat shading, soft ambient glow, slight isometric depth. Premium, cinematic. No text, no logos, no people.

## Side Tables — `side` (accent #E06D8C, rose)

Flat minimalist vector illustration of a cluster of small poker tables of different shapes — a round table, a square table, a two-seat heads-up table — each under its own hanging lamp in a dim hall, cards and chips set out differently on each, warm pools of light dotting the surrounding darkness. Detailed and layered, filling the frame, cinematic. Clean modern iOS-app aesthetic, limited palette dominated by rose pink with charcoal and off-white accents, set against a near-black background (#0A0A0A). Subtle flat shading, soft ambient glow, slight isometric depth. Premium, cinematic. No text, no logos, no people.

## Wiring it up

For each generated image:

1. Save it to `public/menu/<id>.jpg` (e.g. `public/menu/rail.jpg`).
2. Uncomment / add its line in `CATEGORY_IMAGES` in
   `src/components/menu/CategoryArt.tsx`:
   ```ts
   const CATEGORY_IMAGES: Record<string, string> = {
     daily: '/menu/daily.jpg',
     rail: '/menu/rail.jpg',
     venues: '/menu/venues.jpg',
     side: '/menu/side.jpg',
   }
   ```

The geometric SVG scene stays as the automatic fallback — a missing or
failed-to-load image simply reveals it, so the tiles never break.

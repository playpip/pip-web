# Venue art prompts

One ready-to-paste block per venue. All follow the same template (the one used
for the ladder art): a *place*, flat minimalist vector, near-black background,
one dominant accent matching the venue's `accent` in `src/config/venues.ts`.

Shared rules: **square (1:1), ≥1024px, no text, no logos, no people.** Don't
force poker imagery everywhere — the venues should read as places; a scatter of
chips or cards is seasoning, not the subject. Save output to
`public/venues/<id>.jpg` and register it in `VENUE_IMAGES`
(`src/components/menu/VenueArt.tsx`).

## Side tables

### The Red-Eye — `redeye` (Turbo, accent #E06D8C)

Flat minimalist vector illustration of a late-night express train carriage interior, a fold-down table by the window with scattered playing cards and a small stack of poker chips, city lights streaking past the dark window, warm overhead reading lamps along the aisle, seat rows receding into the carriage. Detailed and layered, filling the frame, cinematic. Clean modern iOS-app aesthetic, limited palette dominated by rose pink with charcoal and off-white accents, set against a near-black background (#0A0A0A). Subtle flat shading, soft ambient glow, slight isometric depth. Premium, cinematic. No text, no logos, no people.

### The Study — `study` (Deep stack, accent #6E8B9E)

Flat minimalist vector illustration of a wood-panelled private study at night, a deep leather armchair beside a glowing banker's lamp, floor-to-ceiling bookshelves, a small card table with tall neat towers of poker chips and a closed book, heavy curtains and a tall window with moonlight. Detailed and layered, filling the frame, cinematic. Clean modern iOS-app aesthetic, limited palette dominated by slate blue-grey with charcoal and off-white accents, set against a near-black background (#0A0A0A). Subtle flat shading, soft ambient glow, slight isometric depth. Premium, cinematic. No text, no logos, no people.

### The Duel — `duel` (Heads-up, accent #9A7FD1)

Flat minimalist vector illustration of two empty chairs facing each other across a small square table under a single hanging cone of light, two face-down playing cards and one neat chip stack set before each seat, everything else falling away into darkness, faint floorboards catching the spill of the lamp. Detailed and layered, filling the frame, cinematic. Clean modern iOS-app aesthetic, limited palette dominated by soft violet with charcoal and off-white accents, set against a near-black background (#0A0A0A). Subtle flat shading, soft ambient glow, slight isometric depth. Premium, cinematic. No text, no logos, no people.

### The Docks — `docks` (Bounty, accent #C9873D)

Flat minimalist vector illustration of a harbour dock at night, wooden crates and coiled ropes under a hanging storm lantern, one shipping crate cracked open spilling poker chips, cargo hooks and distant crane silhouettes against the night sky, dark water glinting between the planks. Detailed and layered, filling the frame, cinematic. Clean modern iOS-app aesthetic, limited palette dominated by amber gold with charcoal and off-white accents, set against a near-black background (#0A0A0A). Subtle flat shading, soft ambient glow, slight isometric depth. Premium, cinematic. No text, no logos, no people.

### The All-Nighter — `allnighter` (Hyper, accent #8F6FE8)

Flat minimalist vector illustration of an all-night diner counter at 4am, a steaming coffee pot and stacked cups, playing cards and a few poker chips scattered among sugar packets on the counter, neon glow washing in through the window blinds, a wall clock showing the small hours, bar stools in a row. Detailed and layered, filling the frame, cinematic. Clean modern iOS-app aesthetic, limited palette dominated by electric lavender with charcoal and off-white accents, set against a near-black background (#0A0A0A). Subtle flat shading, soft ambient glow, slight isometric depth. Premium, cinematic. No text, no logos, no people.

### The Chop Shop — `chopshop` (Turbo bounty, accent #D95F43)

Flat minimalist vector illustration of a backstreet garage workshop at night, a car raised on a lift in silhouette, tool chests and hanging work lamps, a workbench card game set up on an upturned oil drum with chips and cards, sparks-orange glow from a workbench lamp, shutter door half open to the night. Detailed and layered, filling the frame, cinematic. Clean modern iOS-app aesthetic, limited palette dominated by burnt orange-red with charcoal and off-white accents, set against a near-black background (#0A0A0A). Subtle flat shading, soft ambient glow, slight isometric depth. Premium, cinematic. No text, no logos, no people.

### The Vault — `vault` (High-stakes heads-up, accent #93A5B8)

Flat minimalist vector illustration of the inside of a bank vault, a colossal circular steel door ajar with polished spokes and bolts, walls of deposit boxes receding into shadow, a single small table set for two with two towering stacks of poker chips and two face-down cards each, one cold overhead light. Detailed and layered, filling the frame, cinematic. Clean modern iOS-app aesthetic, limited palette dominated by cool steel blue with charcoal and off-white accents, set against a near-black background (#0A0A0A). Subtle flat shading, soft ambient glow, slight isometric depth. Premium, cinematic. No text, no logos, no people.

## Ladder (reference)

The template used for the existing ladder art, with the Main Event as the example:

> Flat minimalist vector illustration of a grand championship trophy on a raised pedestal under dramatic stage spotlights, streamers and confetti falling, a scatter of poker chips and playing cards at its base, a spotlit tournament stage behind. Detailed and layered, filling the frame, cinematic. Clean modern iOS-app aesthetic, limited palette dominated by coral red with charcoal and off-white accents, set against a near-black background (#0A0A0A). Subtle flat shading, soft ambient glow, slight isometric depth. Premium, cinematic. No text, no logos, no people.

Swap the subject and the dominant colour (venue `accent`) per venue; keep every
other clause identical so the set stays coherent.

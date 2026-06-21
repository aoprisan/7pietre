# 7 Pietre art — Gemini prompts

Generation prompts and authoring specs for every image asset in the game. Two families:

1. **[Neighborhood backdrops](#neighborhood-backdrop-art)** — the scrollable courtyard behind
   play. Loaded today by `src/render/theme.ts`.
2. **[Game-object sprites](#game-object-sprites)** — players, the ball and the stones. The
   renderer (`src/render/renderer.ts`) currently draws these procedurally from canvas shapes;
   the prompts below define the target art direction so generated sprites can drop in later
   behind the same draw calls. Sizes and colors are taken from the live render so art lines up
   with hitboxes.

---

# Neighborhood backdrop art

Each neighborhood (`NEIGHBORHOODS` in `src/sim/config.ts`) maps to a `skin`, and the
renderer loads a backdrop image from `static/art/<skin>.webp`. If the file is missing the
game falls back to the procedural backdrop in `src/render/theme.ts`, so art can be added
incrementally.

## Authoring spec

- **Aspect / size:** tall portrait at the FIELD ratio — **540×1500** (≈9:25). The backdrop
  covers the whole scrollable world, not just one screen.
- **Layout:** flat oblique top-down courtyard. The castle base sits in the **upper third**
  (around y≈360 of 1500); the open run-up corridor fills the **lower two-thirds**.
- **Keep the center clear:** props belong at the edges so players, stones and the ball read
  cleanly over the middle of the court.
- **No chalk lines, no people, no text** — the court border, base circle, throw line and
  hopscotch are drawn in-engine (`Theme.drawChalk`) so they stay aligned with gameplay.
- Export as **`.webp`** named exactly after the skin, e.g. `static/art/dusk-courtyard.webp`.
  After adding a new file, also add its path to `OPTIONAL` in `static/sw.js` so it is cached
  for offline play.

## Prompts

### `dusk-courtyard` — Cartierul Vechi (1994 dusk)

> A 1990s Eastern-European apartment-block courtyard at golden hour, ~7pm. Cracked grey
> asphalt with patchy concrete and expansion joints, a weathered Socialist-era concrete
> bloc with rows of balconies and a few warmly-lit windows along the top. A carpet-beating
> rack with a draped red rug on the left edge, a boxy beige Dacia-style car parked
> top-right. Warm dusty peach-and-purple dusk light, long soft shadows, nostalgic faded
> film grain. Flat oblique top-down game-backdrop view, empty central courtyard, no people,
> no text, no chalk markings. Tall portrait orientation (9:25).

### `noon-courtyard` — Cartierul Nou (summer midday)

> The same style of Eastern-European apartment-block courtyard but at bright summer midday.
> Sun-bleached light grey asphalt, vivid blue sky with a few clouds above a lighter painted
> concrete bloc, green chestnut trees and a small patch of grass with a rug-beating rack on
> one edge, a parked light-blue car on the other. Crisp short shadows, saturated warm summer
> palette, light dust haze. Flat oblique top-down game-backdrop view, empty central
> courtyard, no people, no text, no chalk markings. Tall portrait orientation (9:25).

---

# Game-object sprites

The players, ball and stones are drawn over the backdrop. They share its art direction —
**flat oblique top-down, nostalgic faded-1990s palette, soft contact shadows** — but each
sprite ships on its **own transparent background** so the engine can place, rotate and
y-sort it. The renderer draws these procedurally today (`drawPlayer`, `drawBall`,
`drawStack` / `drawFallenStones` in `src/render/renderer.ts`); these prompts are the spec for
replacing those shapes with generated art.

## Authoring spec

- **View:** the *same* flat oblique top-down angle as the backdrop — looking down and slightly
  forward, so a standing figure shows the top of the head plus a little of the front of the
  body. No full side view, no straight-down view.
- **Transparent background.** Export **`.webp` with alpha** (or transparent PNG). Tight crop,
  centered, with a few px of padding. The soft ground shadow is drawn **in-engine**, so do
  **not** bake a hard shadow into the sprite (a faint ambient occlusion under the feet is fine).
- **Resolution:** the game renders at a 540×960 internal viewport, so on-screen these are tiny.
  Generate **~4× the play size** for crispness then downscale: target the px footprints in each
  section below. Keep shapes chunky and readable at thumbnail size — this reads as a clean
  mobile game piece, not a detailed illustration.
- **Palette:** match `src/render/palette.ts`. Hex values are quoted in each prompt below.
- **No text, no UI, no chalk, no outline frame.** Markers like the `YOU` arrow, the low-hitbox
  ring, the carried-stone overlay and the tagged-out grey state are engine overlays — don't
  draw them.
- **Naming (suggested):** drop files under `static/art/sprites/`, e.g.
  `static/art/sprites/player-a.webp`. When wired in, add each path to `OPTIONAL` in
  `static/sw.js` so it caches for offline play.

## Prompts

### `player-a` — attacker (Team A, warm orange)

The attacking runners. Footprint ≈ **36×64 px** on screen (body ≈26 wide, head r≈9, short
legs). Skin tone `#e7c39a`.

> A single cartoon child playing in a courtyard, seen from a flat oblique top-down game angle
> (looking down and slightly forward). Chunky, simple, readable mobile-game sprite. Wearing a
> warm burnt-orange t-shirt (`#e8703a`) with a darker orange shaded side (`#a6451f`), plain
> shorts, light sneakers. Rounded body, small round head with the top and a hint of the face
> visible, warm light-tan skin (`#e7c39a`). Faded nostalgic 1990s palette, soft ambient
> shading, gentle dust. Centered, tight crop, transparent background, no shadow on the ground,
> no text, no outline frame.

Optional pose variants (same outfit) for later frames: **idle**, **running** (legs mid-stride,
leaning forward), **carrying a stone** (both arms up holding a flat stone), **throwing**
(one arm cocked back). One file per pose, or a horizontal sprite strip.

### `player-b` — defender (Team B, cool blue)

Identical figure and view to `player-a`, recolored to the defending team.

> A single cartoon child playing in a courtyard, seen from a flat oblique top-down game angle
> (looking down and slightly forward). Chunky, simple, readable mobile-game sprite. Wearing a
> cool sky-blue t-shirt (`#5aa0c9`) with a darker blue shaded side (`#356f90`), plain shorts,
> light sneakers. Rounded body, small round head with the top and a hint of the face visible,
> warm light-tan skin (`#e7c39a`). Faded nostalgic 1990s palette, soft ambient shading, gentle
> dust. Centered, tight crop, transparent background, no shadow on the ground, no text, no
> outline frame.

> For the **summer / noon** skin, recolor the defenders to forest green (`#2f8f6b`, shade
> `#1d6147`) to match `NOON_COURTYARD` in `palette.ts`.

### `ball` — the throwing ball

A small worn rubber playground ball, ≈ **18 px** diameter on screen (`BALL_RADIUS` 9). Color
`#e85a3a` (the dusk skin; the noon skin is a brighter `#ef6a2a`). Drawn flying and bouncing,
so it must read as round from the same top-down-ish angle with a single soft highlight.

> A small worn red-orange rubber playground ball (`#e85a3a`), simple and round, viewed from a
> flat oblique top-down game angle. Matte scuffed surface, one soft warm highlight at the
> upper-left, faded 1990s palette, chunky readable mobile-game style. Centered, tight crop,
> transparent background, no cast shadow, no text, no outline frame.

### `stones` — the seven stones

Seven flat oval river/skipping stones that stack into a little castle (the `Castelul`). Each
stone reads as a low rounded slab — ≈ **52×13 px** at the base of the stack, tapering to ≈26
wide at the top; a loose stone on the ground is ≈ **26×14 px**. Earthy cycled tones from
`STONE_COLORS`: `#b86b4a #9c8a6f #c98a5a #8a968f #d9b06a #a8745a #bfa173`.

> A set of seven flat oval river stones for a stacking game, each a smooth low slab in warm
> earthy tones — terracotta, sandy beige, clay-brown, muted sage-grey (`#b86b4a`, `#9c8a6f`,
> `#c98a5a`, `#8a968f`, `#d9b06a`, `#a8745a`, `#bfa173`). Flat oblique top-down game angle, a
> soft highlight along each stone's top, chunky readable mobile-game style, faded nostalgic
> 1990s palette. Lay the seven stones out separately, each centered on its own transparent
> background, no cast shadow, no text, no outline frame.

Optional companion: a single **assembled castle** sprite — the seven stones stacked largest-
to-smallest into a ~86 px-tall tapered tower (`STACK_HEIGHT`), for the standing-target siege
view.

> The same seven flat earthy river stones stacked largest-at-the-bottom into a small tapered
> tower about seven stones tall, like a little stone castle, viewed from a flat oblique
> top-down game angle. Soft highlights along each stone's top edge, chunky readable
> mobile-game style, faded nostalgic 1990s palette. Centered, transparent background, no cast
> shadow, no text, no outline frame.

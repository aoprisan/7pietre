# Neighborhood backdrop art — Gemini prompts

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

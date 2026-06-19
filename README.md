# 7 Pietre

A mobile-first **PWA prototype** of the Eastern-European courtyard game *7 Pietre*
(Castelul / seven-stones / Lagori). Topple a stacked castle of 7 stones with a
slingshot throw, then race to **rebuild** it while dodging the defenders' ball.
Single-player vs bots, 3-on-3, best of 5.

> Goal of the prototype: validate whether the **throw → run → rebuild** loop is
> fun on a touchscreen. Architecture is built so human and bot players are
> interchangeable and real multiplayer can drop in later.

- **TypeScript, zero runtime dependencies.** The shipped bundle is self-contained.
- **Static** build (relative paths) → deployable to GitHub Pages.
- **PWA**: web manifest + offline service worker, installable.
- **Canvas 2D** arena, HTML/CSS menus + HUD, portrait, touch-first (mouse mirrors).

## Play

1. `npm install`
2. `npm run dev` → open the printed `http://localhost:8123`
3. Pick a neighborhood + difficulty, hit **JOACĂ**.

On a phone: open the dev URL (same network) or the deployed Pages URL and
**Add to Home Screen** to install. It runs offline after first load.

### Controls
- **Slingshot throw** (siege + defender ball-throw): drag back anywhere to set
  direction + power, release to launch an arc. A dotted trajectory + power gauge
  preview the shot.
- **Virtual joystick** (scramble movement): floating origin where your thumb
  lands, capped analog magnitude.
- **Action button** (bottom-right): contextual **IA / PUNE** — pick up a fallen
  stone, place it at the base, or grab the ball as a defender.
- After your throw resolves, control auto-hands-off to the joystick for the
  scramble.

## Architecture

Three concerns are kept strictly separate (see `src/`):

```
src/
  sim/          PURE simulation — no DOM, no rendering, no input
    step.ts       step(state, intentsByPlayer, dt): fixed timestep, deterministic
    rng.ts        seeded RNG (mulberry32), state threaded on GameState.rng
    state.ts      match/round construction, role swaps, stone scatter
    config.ts     ALL tuning (physics, ranges, difficulty, neighborhoods)
    types.ts vec.ts
  controllers/  every player is just a source of Intent
    types.ts      Controller interface + HumanInputSource
    human.ts      reads the input layer
    bot.ts        local AI (attacker + defender behaviors, 3 difficulty knobs)
    remote.ts     RemoteController STUB — empty seam for future multiplayer
  input/        joystick.ts, dragAim.ts, actionButton.ts, inputManager.ts
  render/       renderer.ts, theme.ts (prebaked courtyard), palette.ts, camera.ts
  ui/           menu.ts (neighborhood select), hud.ts, results.ts
  main.ts       loop wiring
```

**Game loop** (`main.ts`): accumulate real time → run the sim in **fixed**
`1/60s` steps → render with **interpolation** (`alpha`) between the previous and
current tick. Each step: every controller emits one `Intent`
(`{ move, aim, action }`), `step()` evolves state, transient `events` drive sfx +
screen shake.

**Why this shape:** `step` is pure and deterministic, so the same seed + intent
stream reproduces a round exactly — the precondition for replays and authoritative
netcode. `HumanController`, `BotController` and the empty `RemoteController` all
satisfy one interface, so swapping a bot for a human (or a remote peer) touches
nothing in the sim or renderer.

### Round flow
- **SIEGE** — each attacker takes one slingshot throw at the stack. A hit topples
  it and immediately starts the scramble; if all throws miss, defenders hold.
- **SCRAMBLE** — attackers fetch fallen stones and restack them at the base while
  defenders fetch the ball and throw it at a runner's **low hitbox** (below the
  knee → ball must be low, `z < KNEE_HEIGHT`, to tag). Rebuild all 7 → attackers
  win; all attackers tagged or 90s timer expires → defenders win.
- Roles swap each round; first team to 3 wins the match.

### Throw physics (why a full-power straight shot lands on the castle)
Horizontal distance of an arc that returns to ground:
`d = power² · THROW_MAX_SPEED · 2·THROW_MAX_VZ / GRAVITY`. With the defaults in
`config.ts`, full power from the throw line (~510 units to the base) lands right
at the castle, so power is the skill knob. Bots invert this to aim:
`power = √(d·GRAVITY / (2·THROW_MAX_SPEED·THROW_MAX_VZ))`.

## Theme

1990s apartment-block courtyard at golden hour — concrete + dust, balconies, a
carpet-beating rack, a boxy parked car, chalk court lines. All art is generated
in-code (canvas shapes; no external assets). The static backdrop is pre-rendered
once to an offscreen canvas and blitted each frame.

## Neighborhoods

The menu is structured around neighborhoods even though play is offline. MVP
ships **one** (`NEIGHBORHOODS` in `config.ts`); adding another is a single config
entry + a palette in `render/palette.ts`. This menu shape won't change when real
rooms arrive.

## Build & deploy

| Command | What it does |
| --- | --- |
| `npm run dev` | esbuild watch + tiny static server on `:8123` |
| `npm run build` | bundle `src/main.ts` → `dist/app.js`, copy shell, generate PNG icons |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | headless **sim** smoke (matches resolve, defense matters) + **render** smoke (Renderer runs across all phases) |

Output in `dist/` uses only relative paths. The included GitHub Actions workflow
(`.github/workflows/deploy.yml`) typechecks, tests, builds, and publishes `dist/`
to GitHub Pages. Icons are produced by `tools/gen-icons.mjs`, a zero-dependency
PNG encoder (Node `zlib` + hand-written CRC) so nothing third-party ships.

## Tooling note

Runtime code has **zero dependencies**. `esbuild` and `typescript` are
dev-only (bundling + typecheck) and never end up in `dist/`.

## Out of scope (intentionally)

Real multiplayer/networking, accounts, backend, persistence beyond a local
high-score, monetization, multiple neighborhoods. The `RemoteController` seam is
present but empty.

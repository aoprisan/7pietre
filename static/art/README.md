# static/art

Drop neighborhood backdrop images here, named after each `skin`:

- `dusk-courtyard.webp`
- `noon-courtyard.webp`

They are loaded by `src/render/theme.ts` and copied to `dist/art/` by the build. If a file
is absent the game uses the procedural backdrop instead, so these are optional.

See `docs/art-prompts.md` for the Gemini generation prompts and authoring spec
(tall portrait 540×1500, no chalk/people/text).

# Target: MRMBRAND/toolkit-content-upload

This file is the agent task for one target repo. Read `shared-context.md` first; this file extends it.

## Repo

A Vite/React app that provides a font picker for theme configuration. Default branch: `develop`.

You are working inside a fresh clone, already on a new branch off `develop`. The font binaries listed in your `font.config.json` have already been copied into `public/fonts/`.

## Files you may edit

- `src/fonts.js`
- `src/fonts.css`

**Do not touch anything else.** No package.json, no other components, no formatting passes.

## Reference PR — read this first

Before editing anything, read the diff at https://github.com/MRMBRAND/toolkit-content-upload/pull/19 ("Adds Martini Torino font for Bacardi"). It is the canonical example of an "add font" change in this repo. **Mimic it precisely.** When in doubt about a convention, look at how PR #19 did it.

You can fetch it via `gh pr diff 19 --repo MRMBRAND/toolkit-content-upload`.

## Conventions you must follow

These are not negotiable — the agent that doesn't follow them produces a PR that gets bounced.

### `src/fonts.js`

- The `FONTS` array is **alphabetically ordered by `name`**. Insert your new entry in the correct alphabetical position.
- A simple entry is **single-line**: `{ name: 'Marcellus' },`
- An entry with `hasBold: true` or with restrictions is **multi-line**:
  ```js
  {
    name: 'Martini Torino',
    hasBold: true,
    exclusiveBrandOrMarket: [{ brandId: '2' }],
  },
  ```
- `hasBold: true` if the rollout includes a bold weight file (look at `files` in the config — a `weight: 700` entry means bold). Otherwise omit the key entirely.
- Restrictions go in `exclusiveBrandOrMarket`. **IDs are quoted strings**, even though the source config has them as integers. Convert `brandId: 2` → `brandId: '2'`. Same for `marketId`.
- If the config has multiple brands and one market, expand to one object per pair: `[{ brandId: '2', marketId: '70' }, { brandId: '3', marketId: '70' }]`. Look at the Patron Serif Office entry in PR #19 for the pattern.
- If `restrictions.brands` has values but `restrictions.markets` does not (or vice versa), emit objects with only the present key: `[{ brandId: '2' }]`.
- **Single quotes** for all strings. Trailing comma on the last array element inside an entry.

### `src/fonts.css`

- The file is also **alphabetically ordered**. Insert the new `@font-face` block in the correct alphabetical position based on `font-family`.
- **One `@font-face` per font family**, for the regular weight only. Even if the rollout includes a bold binary, do not add a second block for it — `hasBold: true` in `fonts.js` handles that elsewhere.
- Use `format('truetype')` for `.otf` files. This is technically incorrect but it is the established convention in this repo. Do not "fix" it.
- Path is relative: `url('../public/fonts/<filename>')`.
- Single quotes for `font-family` value.
- Pattern:
  ```css
  @font-face {
    font-family: 'Martini Torino';
    src: url('../public/fonts/MartiniTorino-Regular.otf') format('truetype');
  }
  ```

### Things you must NOT do

- **No unrelated reformatting.** PR #19 happens to contain some reformatting of the Patron Serif Office entry (double quotes → single quotes, trailing comma added). Do not replicate that. Your diff should touch only the alphabetical neighbours of your new entry.
- No reordering of other entries.
- No edits to `package.json`, `vite.config.*`, or any component file.
- No `yarn lint`, no `prettier --write`, no formatter runs.

## What the config gives you

You receive a `font.config.json` like:

```json
{
  "family": "Martini Torino",
  "files": [
    { "filename": "MartiniTorino-Regular.otf", "weight": 400, "style": "normal" },
    { "filename": "MartiniTorinoBold.otf", "weight": 700, "style": "normal" }
  ],
  "restrictions": {
    "brands": [2],
    "markets": []
  },
  "metadata": { ... }
}
```

Mapping to this repo:

- `family` → the `name:` field in the `FONTS` entry and `font-family:` in the CSS.
- Presence of a `weight: 700` file → `hasBold: true`.
- The `weight: 400 / style: normal` file's filename → the `src:` URL in the CSS.
- `restrictions.brands` and `restrictions.markets` → `exclusiveBrandOrMarket` (as quoted strings).
- Empty `restrictions.brands` AND empty `restrictions.markets` → omit `exclusiveBrandOrMarket` entirely.

## Output

When done, print exactly one JSON object to stdout and nothing else:

```json
{"status":"ok","files_changed":["src/fonts.js","src/fonts.css"],"notes":""}
```

Or, if anything looks unfamiliar:

```json
{"status":"stop","reason":"Specific reason — e.g. FONTS array not found in src/fonts.js, or font name already present"}
```

If the font already appears in `src/fonts.js`, return `{"status":"ok","files_changed":[],"notes":"already present, no changes"}` — do not duplicate it.

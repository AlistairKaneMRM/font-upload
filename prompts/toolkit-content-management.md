# Target: MRMBRAND/toolkit-content-management

This file is the agent task for one target repo. Read `shared-context.md` first; this file extends it.

## Repo

A Vite/React + TypeScript app for content management. Default branch: `main`.

You are working inside a fresh clone, already on a new branch off `main`. The font binaries listed in your `font.config.json` have already been copied into `public/fonts/`.

## Files you may edit

- `src/data/fonts.ts`
- `src/data/fonts.css`

**Do not touch anything else.** Not `README.md`, not `package.json`, not any component. The reference PR (#128) happens to bundle an unrelated README rewrite — ignore it.

## Reference PR — read this first

Before editing anything, read the diff at https://github.com/MRMBRAND/toolkit-content-management/pull/128 ("19666 - Add Lillet Begum font for Pernod"). Focus on the changes to `src/data/fonts.ts` and `src/data/fonts.css`. **Ignore the README changes** — they are noise from an unrelated cleanup.

Fetch it with `gh pr diff 128 --repo MRMBRAND/toolkit-content-management`.

## Conventions you must follow

### `src/data/fonts.ts`

- TypeScript: the typed array is `export const FONTS: FontRecord[] = [...]`.
- Entries are **alphabetically ordered by `name`**. Insert your entry at the correct position.
- A simple entry is **single-line**: `{ name: 'Kurale' },`
- An entry with **only boolean flags** stays single-line: `{ name: 'Literata', hasItalic: true, hasBold: true },`
- An entry with `exclusiveBrandOrMarket` is **multi-line**:
  ```ts
  {
    name: 'Lillet Begum',
    hasItalic: true,
    hasBold: true,
    exclusiveBrandOrMarket: [
      { brandId: '10', marketId: '12' },
      { brandId: '10', marketId: '116' },
    ],
  },
  ```
- Property order inside multi-line entries: `name`, then `hasItalic`, then `hasBold`, then `exclusiveBrandOrMarket`.
- `hasBold: true` if any file in the config has `weight: 700`. Otherwise omit.
- `hasItalic: true` if any file in the config has `style: "italic"`. Otherwise omit.
- `exclusiveBrandOrMarket` shape mirrors the content-upload prompt:
  - IDs are **quoted strings**: `brandId: '10'`, `marketId: '12'`. Not integers.
  - One object per (brand, market) pair. If only brands are present, emit `{ brandId: '10' }`. If only markets, `{ marketId: '12' }`. If both, emit the cartesian product (one object per pair).
  - Both `restrictions.brands` and `restrictions.markets` empty → omit `exclusiveBrandOrMarket` entirely.
- **Single quotes** for all strings. Trailing comma on the last element inside an entry and at the end of the entry itself.

### `src/data/fonts.css`

- This file emits **one `@font-face` block per font file variant**, not one per family. A family with Regular + Bold + RegularItalic + BoldItalic produces **four** `@font-face` blocks.
- All blocks for a family sit together as a contiguous group, inserted at the position the family's base `font-family` name would alphabetize to.
- Block order within the group: Regular, RegularItalic, Bold, BoldItalic. Skip any variant the config doesn't include.
- **`font-family` name per variant**, derived from `family` in the config:
  - Regular (weight 400, style normal) → `'<family>'` (no suffix)
  - Regular-Italic (weight 400, style italic) → `'<family> Regular-Italic'`
  - Bold (weight 700, style normal) → `'<family> Bold'`
  - Bold-Italic (weight 700, style italic) → `'<family> Bold-Italic'`
- **`src` URL** is absolute and points at `/fonts/<filename>`:
  ```css
  src: url('/fonts/Begum-Regular.otf') format('opentype');
  ```
- **`format()` keyword** based on the file extension:
  - `.otf` → `format('opentype')`
  - `.ttf` → `format('truetype')`
  - `.woff` → `format('woff')`
  - `.woff2` → `format('woff2')`
- Single quotes throughout. One blank line between blocks (matching surrounding style).

### Things you must NOT do

- **No edits outside the two allowed files.** Especially: do not modify `README.md` even if it looks stale — that's not your job.
- No reordering or reformatting of unrelated entries.
- No `npm run lint`, no Prettier runs, no formatter sweeps.

## What the config gives you

```json
{
  "family": "Lillet Begum",
  "files": [
    { "filename": "Begum-Regular.otf", "weight": 400, "style": "normal" },
    { "filename": "Begum-RegularItalic.otf", "weight": 400, "style": "italic" },
    { "filename": "Begum-Bold.otf", "weight": 700, "style": "normal" },
    { "filename": "Begum-BoldItalic.otf", "weight": 700, "style": "italic" }
  ],
  "restrictions": {
    "brands": [10],
    "markets": [12, 116]
  }
}
```

Mapping to this repo:

- `family` → `name` field in `FONTS` and the base `font-family` in CSS.
- For each file, look at (`weight`, `style`) → emit one `@font-face` with the right suffix and the right binary path.
- `weight: 700` anywhere → `hasBold: true` in `fonts.ts`.
- `style: "italic"` anywhere → `hasItalic: true` in `fonts.ts`.
- `restrictions.brands` × `restrictions.markets` → `exclusiveBrandOrMarket` cartesian product (string IDs).

## Output

When done, print exactly one JSON object to stdout and nothing else:

```json
{"status":"ok","files_changed":["src/data/fonts.ts","src/data/fonts.css"],"notes":""}
```

Or, if anything looks unfamiliar:

```json
{"status":"stop","reason":"Specific reason"}
```

If the font already appears in `src/data/fonts.ts`, return `{"status":"ok","files_changed":[],"notes":"already present"}`.

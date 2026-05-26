# Target: MRMBRAND/rendering-service

This file is the agent task for one target repo. Read `shared-context.md` first; this file extends it.

## Repo

The rendering service that runs on the Mac mini fleet. Default branch: `master`.

You are working inside a fresh clone, already on a new branch off `master`.

**The font binaries are NOT copied into this repo.** Rendering-service expects fonts to be installed at `/Library/Fonts` on each Mac mini, which is a separate manual deploy step outside this rollout. Your only job is to declare the font's existence in the data file.

## Files you may edit

- `src/fontData.ts`

**Do not touch anything else.** No other source files, no config, no docs.

## Reference PR — read this first

Before editing anything, read the diff at https://github.com/MRMBRAND/rendering-service/pull/120 ("Adds Begum font"). It is the canonical example of an "add font" change in this repo. **Mimic it precisely.**

Fetch it with `gh pr diff 120 --repo MRMBRAND/rendering-service`.

## Conventions you must follow

### `src/fontData.ts`

- The typed array is `const data: IFont[] = [...]`.
- Entries are **alphabetically ordered by `name`**. Insert your entry at the correct position.
- A simple entry (no bold, no italic) is **single-line**:
  ```ts
  { name: 'Belleza', normalFile: 'Belleza-Regular.ttf' },
  ```
- An entry with bold and/or italic variants is **multi-line**:
  ```ts
  {
    name: 'Begum',
    normalFile: 'Begum-Regular.otf',
    bold: true,
    boldFontFile: 'Begum-Bold.otf',
    italic: true,
    italicFontFile: 'Begum-RegularItalic.otf',
    boldItalicFontFile: 'Begum-BoldItalic.otf',
  },
  ```
- **Field order inside multi-line entries:** `name`, `normalFile`, then the bold pair (`bold`, `boldFontFile`), then the italic pair (`italic`, `italicFontFile`), then `boldItalicFontFile` if present.
- `normalFile` is always present: the filename from the config's `files[]` entry where `weight: 400, style: "normal"`.
- `bold: true` plus `boldFontFile: '<filename>'` if a file has `weight: 700, style: "normal"`.
- `italic: true` plus `italicFontFile: '<filename>'` if a file has `weight: 400, style: "italic"`.
- `boldItalicFontFile: '<filename>'` if a file has `weight: 700, style: "italic"`. There is no separate `boldItalic: true` flag — its presence is implied by `bold: true` and `italic: true` both being set.
- **Single quotes** throughout. Trailing comma on the last property in a multi-line entry and on the entry itself.
- The filename in each `*File` field is the **exact filename from the config**, including extension.

### Restrictions

This repo does **not** track brand/market restrictions — those live in the editor/upload layers, not in the rendering engine. **Ignore the `restrictions` block entirely in `font.config.json`.** Do not add any restriction-related fields to `fontData.ts`.

### Things you must NOT do

- **No font binaries copied into the repo.** Do not create `public/fonts/`, do not add `.otf`/`.ttf` files. Binaries are deployed to `/Library/Fonts` on the Mac minis separately.
- No edits to any file other than `src/fontData.ts`.
- No reordering or reformatting of unrelated entries.
- No formatter / linter sweeps.

## What the config gives you

```json
{
  "family": "Begum",
  "files": [
    { "filename": "Begum-Regular.otf", "weight": 400, "style": "normal" },
    { "filename": "Begum-RegularItalic.otf", "weight": 400, "style": "italic" },
    { "filename": "Begum-Bold.otf", "weight": 700, "style": "normal" },
    { "filename": "Begum-BoldItalic.otf", "weight": 700, "style": "italic" }
  ],
  "restrictions": { "brands": [10], "markets": [12] }
}
```

Mapping to this repo:

- `family` → `name` field.
- The `weight: 400, style: "normal"` file's filename → `normalFile`.
- The `weight: 700, style: "normal"` file's filename, if present → `boldFontFile`, plus `bold: true`.
- The `weight: 400, style: "italic"` file's filename, if present → `italicFontFile`, plus `italic: true`.
- The `weight: 700, style: "italic"` file's filename, if present → `boldItalicFontFile`.
- `restrictions` → ignored.

## Output

When done, print exactly one JSON object to stdout and nothing else:

```json
{"status":"ok","files_changed":["src/fontData.ts"],"notes":""}
```

Or, if anything looks unfamiliar:

```json
{"status":"stop","reason":"Specific reason"}
```

If the font already appears in `src/fontData.ts`, return `{"status":"ok","files_changed":[],"notes":"already present"}`.

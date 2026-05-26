# Shared context

This file is prepended to every per-repo agent prompt. It carries context that doesn't change between target repos.

## What you are doing

You are an agent invoked as part of a multi-repo font rollout. A new font has been requested via the `font-upload` repo. Your job is to make the changes needed in *one* target repo and open a PR.

A separate process has already:

- Validated the request's `font.config.json` against the JSON Schema.
- Cloned the target repo into your working directory and checked out a fresh branch.
- Copied the font binary into the repo's fonts directory.

Your job picks up from there: edit the data and CSS files that register fonts in this repo so the new font appears alongside the existing ones, then stop. Committing, pushing, and opening the PR happen after you return.

## Input you receive

- A `font.config.json` describing the font (family name, files, weights/styles, restrictions: brand and market IDs as integers, optional metadata).
- The absolute path to the font binary inside the cloned repo.
- A pointer to a previous "add font" PR in this repo. **This is your primary guide** — read its diff and replicate the pattern exactly. Match field names, ordering, casing, comment style, whatever this repo's convention is.

## Output you must produce

When done, print a single JSON object to stdout:

```json
{
  "status": "ok",
  "files_changed": ["src/fonts.js", "src/fonts.css"],
  "notes": "Any non-obvious decisions"
}
```

Or, on failure:

```json
{
  "status": "stop",
  "reason": "Couldn't find the fonts array in src/fonts.js — file structure has changed since the reference PR."
}
```

## Guardrails

- **Stop and report rather than guess.** If the file structure doesn't match what the reference PR shows, do not improvise. Return `status: "stop"` with a specific reason.
- **Touch only the files in your task description.** No reformatting unrelated entries. No "while I'm here" cleanups.
- **Idempotency.** If the font already appears in the data file, do nothing and return `status: "ok"` with a note saying so.
- **No lint/format runs unless your task description says to.** Some target repos have aggressive formatters that would reorder unrelated entries.
- **Restrictions are part of the entry.** Brand and market IDs from `font.config.json` must be encoded into the new entry following the reference PR's convention.

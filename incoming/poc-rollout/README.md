# poc-rollout

Drop a real font here to exercise the Phase 2 POC against `MRMBRAND/toolkit-content-upload`.

## What to put here

1. **Font binary file(s):** `.otf`, `.ttf`, `.woff`, or `.woff2`. If a Bold weight ships, include both Regular and Bold files. Filename is up to you — just reference them exactly in the config.
2. **`font.config.json`** describing the font. Example:

   ```json
   {
     "family": "Your Font Name",
     "files": [
       { "filename": "YourFont-Regular.otf", "weight": 400, "style": "normal" },
       { "filename": "YourFontBold.otf", "weight": 700, "style": "normal" }
     ],
     "restrictions": {
       "brands": [2],
       "markets": []
     },
     "metadata": {
       "license_ref": "wherever the licence lives",
       "requested_by": "your-name",
       "ticket": "FONTS-NNN"
     }
   }
   ```

   - `restrictions.brands` and `restrictions.markets` are **arrays of integers** (numeric IDs from hyble). Empty arrays are fine if no restriction applies in that dimension.
   - Including a `weight: 700` file triggers `hasBold: true` in the toolkit-content-upload entry.

## Run it

From the repo root, once your font + config are in place:

```sh
scripts/run-poc.sh incoming/poc-rollout/font.config.json
```

The script clones `MRMBRAND/toolkit-content-upload` into a temp directory, branches off `develop`, copies the binaries in, invokes the agent, and prints the resulting diff. It does **not** push or open a PR — review the diff first.

Once you're happy with the diff, the script prints the exact `git commit && git push && gh pr create` commands to run.

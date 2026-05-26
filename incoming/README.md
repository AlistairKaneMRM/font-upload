# incoming/

Staging area for new font requests. To request a rollout:

1. Create a new subdirectory here named after your font slug (lowercase kebab-case): `incoming/my-new-font/`.
2. Drop the font binary into that directory (`.otf`, `.ttf`, `.woff`, or `.woff2`).
3. Add a `font.config.json` next to the binary describing the font. See [`../schema/font.config.schema.json`](../schema/font.config.schema.json) for the full shape, and [`../examples/`](../examples/) for past rollouts.
4. Open a PR.

CI will validate the config; a reviewer approves the licensing/approval and merges. (The post-merge rollout itself is not yet implemented.)

## Minimal example

```
incoming/my-new-font/
├── MyNewFont-Regular.otf
└── font.config.json
```

```json
{
  "family": "My New Font",
  "files": [
    { "filename": "MyNewFont-Regular.otf", "weight": 400, "style": "normal" }
  ],
  "restrictions": {
    "brands": [12, 34],
    "markets": [1, 7]
  },
  "metadata": {
    "license_ref": "license-doc-or-ticket-ref",
    "requested_by": "your-name",
    "ticket": "FONTS-NNN"
  }
}
```

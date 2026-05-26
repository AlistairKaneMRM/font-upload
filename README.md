# font-upload

Orchestrator for adding a new font across the company's stack. Replaces a manual ~11-step process that spans multiple repos and remote Mac mini servers.

## Status

Phase 1 — scaffolding only. The request side of the funnel (drop a font into `incoming/`, get CI validation on the config) is the first piece in place. Agents that fan out to target repos are not built yet.

## How a rollout request works

1. Open a PR to this repo that adds two files to `incoming/<font-slug>/`:
   - The font binary (`.otf`, `.ttf`, `.woff`, or `.woff2`)
   - `font.config.json` — metadata + restrictions, validated against [`schema/font.config.schema.json`](schema/font.config.schema.json)
2. CI validates the config against the JSON Schema. Red/green appears on the PR. Brand and market IDs are numeric and supplied by the requester directly (looked up from hyble); there is no allow-list in this repo.
3. Reviewer checks licensing/approval is correct and merges.
4. *(Not yet built)* Merge triggers the rollout workflow: macOS metrics job runs, then agents fan out and open PRs in each target repo. Cross-links get posted back here.

See [`examples/`](examples/) for past rollouts.

## Layout

```
schema/                 # JSON Schema for font.config.json
prompts/                # per-repo agent prompts (Phase 3)
coordinator/            # TS coordinator that fans out to target repos (Phase 4)
scripts/                # shell + node utilities (validation, clone/branch, open-pr)
incoming/               # staging area for new font requests
.github/workflows/      # CI: validate-incoming runs today; font-rollout (the main workflow) lands in Phase 5
targets.yaml            # per-target-repo manifest
```

## Local validation

```sh
npm install
node scripts/validate-config.js
```

Walks every `font.config.json` under `incoming/` and reports schema or allow-list violations.

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
npm run validate
```

Walks every `font.config.json` under `incoming/` and reports schema violations.

## Running a rollout from your laptop

The coordinator drives every target in `targets.yaml` in parallel from a single `font.config.json`. By default it runs in **dry-run** mode — it clones each target, lets the agent edit files, then stops at the diff for inspection without pushing anything.

```sh
# Dry-run against all targets
npm run rollout -- incoming/poc-rollout/font.config.json

# Push branches and open PRs
npm run rollout -- --execute incoming/poc-rollout/font.config.json

# Run against one target only
npm run rollout -- --target=toolkit-content-upload incoming/poc-rollout/font.config.json
```

Output is a JSON summary on stdout (PR URLs, statuses, agent notes). Failed/stopped targets keep their working directories around for debugging; successful ones get cleaned up unless `--keep-workdirs` is passed.

For tuning a single target's prompt in isolation, use [`scripts/run-poc.sh`](scripts/run-poc.sh) — same agent, more verbose output, single target only.

## Running a rollout from CI

The `.github/workflows/font-rollout.yml` workflow runs the coordinator automatically when a PR adding/modifying `incoming/<slug>/font.config.json` is merged to `main`.

### Required repository secrets

Set both at https://github.com/AlistairKaneMRM/font-upload/settings/secrets/actions :

- `ANTHROPIC_API_KEY` — the Anthropic API key the headless `claude -p` agent runs against.
- `FONT_ROLLOUT_TOKEN` — a GitHub PAT with `repo` scope on every `MRMBRAND/*` target repo. The default `GITHUB_TOKEN` is scoped to this repo only and can't clone the private targets or open PRs in them. A fine-grained PAT works too, scoped to: `Contents: write` + `Pull requests: write` on each target.

### How it fires

1. PR merged to `main` with changes under `incoming/**`.
2. Workflow finds every `font.config.json` added or modified in the push, via `scripts/find-changed-configs.sh`.
3. Re-runs `npm run validate` as a safety check.
4. For each new config: `npm run rollout -- --execute <config>`. The coordinator clones each target in parallel, agents do their edits, branches push, PRs open.
5. JSON summaries (one per rollout) upload as the `rollout-summary` artifact.

### Triggering manually

Use the **Actions → Font rollout → Run workflow** button. By default it diffs against `HEAD~1`; pass a different base ref to replay an older merge.

### Not yet wired

- Posting cross-link comments back to the source `font-upload` PR after rollout completes.
- Auto-moving processed `incoming/<slug>/` directories into `examples/`.
- The macOS metrics job needed before fan-out to `hyble`.

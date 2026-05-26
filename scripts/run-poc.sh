#!/usr/bin/env bash
# Phase 2/3 POC runner. Drives a single agent invocation against one target
# repo and leaves the resulting changes in a temp clone for human review.
# Does NOT push or open a PR.
#
# Usage:
#   scripts/run-poc.sh <target-name> path/to/font.config.json
#
# <target-name> matches the basename of repo: in targets.yaml, e.g.
# `toolkit-content-management` or `toolkit-content-upload`.

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: $0 <target-name> path/to/font.config.json" >&2
  echo >&2
  echo "available targets:" >&2
  node "$(dirname "$0")/lib/resolve-target.js" __list_only__ 2>&1 | sed -n '/available/,$p' | tail -n +2 >&2 || true
  exit 1
fi

TARGET_NAME="$1"
CONFIG_PATH="$2"

if [[ ! -f "$CONFIG_PATH" ]]; then
  echo "config not found: $CONFIG_PATH" >&2
  exit 1
fi

CONFIG_PATH=$(readlink -f "$CONFIG_PATH")
CONFIG_DIR=$(dirname "$CONFIG_PATH")
REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)

# Resolve target details from targets.yaml.
eval "$(node "$REPO_ROOT/scripts/lib/resolve-target.js" "$TARGET_NAME")"

FAMILY=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).family)" "$CONFIG_PATH")
SLUG=$(echo "$FAMILY" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')
BRANCH="add-font/${SLUG}-poc"

WORKDIR=$(mktemp -d -t font-poc-XXXXXX)
TARGET_DIR="$WORKDIR/target"

trap 'echo; echo "==> Working dir preserved: $TARGET_DIR (delete manually when done)"' EXIT

echo "==> Target:    $TARGET_REPO ($DEFAULT_BRANCH)"
echo "==> Family:    $FAMILY"
echo "==> Slug:      $SLUG"
echo "==> Workdir:   $TARGET_DIR"
echo "==> Branch:    $BRANCH"
echo

echo "==> Cloning $TARGET_REPO ($DEFAULT_BRANCH)..."
gh repo clone "$TARGET_REPO" "$TARGET_DIR" -- --depth 1 --branch "$DEFAULT_BRANCH" --no-tags --quiet
cd "$TARGET_DIR"
git checkout -b "$BRANCH" >/dev/null

echo "==> Copying font binaries into $FONTS_DIR/:"
node - "$CONFIG_PATH" "$CONFIG_DIR" "$FONTS_DIR" <<'NODE'
const fs = require('fs');
const path = require('path');
const [configPath, configDir, fontsDir] = process.argv.slice(2);
const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
fs.mkdirSync(fontsDir, { recursive: true });
for (const f of cfg.files) {
  const src = path.join(configDir, f.filename);
  const dst = path.join(fontsDir, f.filename);
  fs.copyFileSync(src, dst);
  console.log('    ' + f.filename);
}
NODE

PROMPT_FILE="$WORKDIR/prompt.md"
{
  cat "$REPO_ROOT/prompts/shared-context.md"
  printf '\n\n---\n\n'
  cat "$REPO_ROOT/$PROMPT_PATH"
  printf '\n\n---\n\n## This rollout\n\n'
  printf 'The font binaries have already been copied into `%s/`. Your working directory is the cloned repo.\n\n' "$FONTS_DIR"
  printf 'The `font.config.json` for this rollout:\n\n'
  printf '```json\n'
  cat "$CONFIG_PATH"
  printf '\n```\n\nMake the edits per the conventions above, then print your output JSON.\n'
} > "$PROMPT_FILE"

echo
echo "==> Invoking agent (prompt: $PROMPT_FILE)..."
echo

set +e
claude -p "$(cat "$PROMPT_FILE")" \
  --add-dir "$TARGET_DIR" \
  --allowed-tools "Read Edit Glob Grep Bash(gh pr diff*) Bash(git diff*) Bash(git log*)" \
  --permission-mode acceptEdits \
  --no-session-persistence
AGENT_EXIT=$?
set -e

echo
echo "==> Agent exit code: $AGENT_EXIT"
echo

git add -A

echo "==> Diff stat:"
git diff --cached --stat
echo
echo "==> Full diff:"
git diff --cached

echo
echo "==> Branch '$BRANCH' is staged at $TARGET_DIR (NOT pushed)."
echo "    To open a PR manually after review:"
echo "      cd $TARGET_DIR"
echo "      git commit -m 'Adds $FAMILY font'"
echo "      git push -u origin $BRANCH"
echo "      gh pr create --base $DEFAULT_BRANCH --title 'Adds $FAMILY font'"

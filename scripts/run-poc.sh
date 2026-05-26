#!/usr/bin/env bash
# Phase 2 POC runner. Drives a single agent invocation against
# MRMBRAND/toolkit-content-upload and leaves the resulting changes in a temp
# clone for human review. Does NOT push or open a PR.
#
# Usage:
#   scripts/run-poc.sh path/to/font.config.json
#
# The font binaries listed in the config must sit in the same directory as the
# config itself (i.e. an `incoming/<slug>/` shape).

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 path/to/font.config.json" >&2
  exit 1
fi

CONFIG_PATH="$1"
if [[ ! -f "$CONFIG_PATH" ]]; then
  echo "config not found: $CONFIG_PATH" >&2
  exit 1
fi

CONFIG_PATH=$(readlink -f "$CONFIG_PATH")
CONFIG_DIR=$(dirname "$CONFIG_PATH")
REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)

FAMILY=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).family)" "$CONFIG_PATH")
SLUG=$(echo "$FAMILY" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')

TARGET_REPO="MRMBRAND/toolkit-content-upload"
DEFAULT_BRANCH="develop"
BRANCH="add-font/${SLUG}-poc"

WORKDIR=$(mktemp -d -t font-poc-XXXXXX)
TARGET_DIR="$WORKDIR/target"

trap 'echo; echo "==> Working dir preserved: $TARGET_DIR (delete manually when done)"' EXIT

echo "==> Family:    $FAMILY"
echo "==> Slug:      $SLUG"
echo "==> Workdir:   $TARGET_DIR"
echo "==> Branch:    $BRANCH"
echo

echo "==> Cloning $TARGET_REPO ($DEFAULT_BRANCH)..."
gh repo clone "$TARGET_REPO" "$TARGET_DIR" -- --depth 1 --branch "$DEFAULT_BRANCH" --no-tags --quiet
cd "$TARGET_DIR"
git checkout -b "$BRANCH" >/dev/null

echo "==> Copying font binaries:"
node - "$CONFIG_PATH" "$CONFIG_DIR" <<'NODE'
const fs = require('fs');
const path = require('path');
const [configPath, configDir] = process.argv.slice(2);
const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
fs.mkdirSync('public/fonts', { recursive: true });
for (const f of cfg.files) {
  const src = path.join(configDir, f.filename);
  const dst = path.join('public/fonts', f.filename);
  fs.copyFileSync(src, dst);
  console.log('    ' + f.filename);
}
NODE

PROMPT_FILE="$WORKDIR/prompt.md"
{
  cat "$REPO_ROOT/prompts/shared-context.md"
  printf '\n\n---\n\n'
  cat "$REPO_ROOT/prompts/toolkit-content-upload.md"
  printf '\n\n---\n\n## This rollout\n\n'
  printf 'The font binaries have already been copied into `public/fonts/`. Your working directory is the cloned repo.\n\n'
  printf 'The `font.config.json` for this rollout:\n\n'
  printf '```json\n'
  cat "$CONFIG_PATH"
  printf '\n```\n\nMake the edits per the conventions above, then print your output JSON.\n'
} > "$PROMPT_FILE"

echo
echo "==> Invoking agent (prompt: $PROMPT_FILE)..."
echo

# Restrict the agent to what it actually needs.
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

# Stage everything (incl. the newly copied binaries) so `git diff --cached`
# shows the full picture.
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

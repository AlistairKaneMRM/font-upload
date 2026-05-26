#!/usr/bin/env bash
# Emits one line per font.config.json added or modified between
# the previous commit and HEAD. Used by the CI workflow to know
# which rollouts to run on a push to main.
#
# If a base ref is supplied as the first argument, diffs against
# that instead of HEAD~1 — useful for workflow_dispatch runs where
# HEAD~1 might be unrelated.

set -euo pipefail

BASE_REF="${1:-HEAD~1}"

git diff --name-only --diff-filter=AM "$BASE_REF" HEAD -- 'incoming/**/font.config.json' \
  | sort -u

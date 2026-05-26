#!/usr/bin/env node
// Reads targets.yaml and emits shell-evaluable assignments for one target.
//
// Usage:
//   eval "$(scripts/lib/resolve-target.js <target-name>)"
//
// <target-name> matches the basename of `repo:` in the manifest, e.g.
// `toolkit-content-management`. Falls through to a full slug match too.
//
// Output:
//   TARGET_REPO='MRMBRAND/...'
//   DEFAULT_BRANCH='main'
//   FONTS_DIR='public/fonts'
//   PROMPT_PATH='prompts/...'

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const targetName = process.argv[2];
if (!targetName) {
  console.error("usage: resolve-target.js <target-name>");
  process.exit(2);
}

const repoRoot = path.resolve(__dirname, "..", "..");
const targetsPath = path.join(repoRoot, "targets.yaml");
const doc = yaml.load(fs.readFileSync(targetsPath, "utf8"));

const targets = doc.targets || [];
const target = targets.find(
  (t) => path.basename(t.repo) === targetName || t.repo === targetName
);

if (!target) {
  console.error(`target not found: ${targetName}`);
  if (targets.length > 0) {
    console.error("available targets:");
    for (const t of targets) console.error(`  ${path.basename(t.repo)}`);
  }
  process.exit(1);
}

function shellQuote(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

const fields = {
  TARGET_REPO: target.repo,
  DEFAULT_BRANCH: target.default_branch,
  FONTS_DIR: target.fonts_dir,
  PROMPT_PATH: target.prompt,
};

for (const [key, value] of Object.entries(fields)) {
  if (value === undefined || value === null) {
    console.error(`target ${targetName} is missing field: ${key}`);
    process.exit(1);
  }
  console.log(`${key}=${shellQuote(value)}`);
}

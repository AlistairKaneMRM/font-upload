#!/usr/bin/env node
// Validates every font.config.json under incoming/ against the schema, and
// confirms each declared font binary actually exists next to its config.
//
// Run locally with `npm run validate`. CI runs the same script.

const fs = require("fs");
const path = require("path");
const Ajv = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const repoRoot = path.resolve(__dirname, "..");
const incomingDir = path.join(repoRoot, "incoming");
const schemaPath = path.join(repoRoot, "schema", "font.config.schema.json");

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

function findConfigs(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findConfigs(full));
    } else if (entry.name === "font.config.json") {
      results.push(full);
    }
  }
  return results;
}

function formatAjvErrors(errors) {
  return errors
    .map((e) => `  - ${e.instancePath || "(root)"} ${e.message}`)
    .join("\n");
}

const configs = findConfigs(incomingDir);

if (configs.length === 0) {
  console.log("No font.config.json files under incoming/ — nothing to validate.");
  process.exit(0);
}

let failed = false;

for (const configPath of configs) {
  const relPath = path.relative(repoRoot, configPath);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (err) {
    console.error(`✗ ${relPath} — invalid JSON: ${err.message}`);
    failed = true;
    continue;
  }

  if (!validate(parsed)) {
    console.error(`✗ ${relPath} — schema violations:`);
    console.error(formatAjvErrors(validate.errors));
    failed = true;
    continue;
  }

  const configDir = path.dirname(configPath);
  const missing = parsed.files
    .map((f) => f.filename)
    .filter((name) => !fs.existsSync(path.join(configDir, name)));

  if (missing.length > 0) {
    console.error(`✗ ${relPath} — referenced font file(s) missing from ${path.relative(repoRoot, configDir)}/:`);
    for (const name of missing) console.error(`  - ${name}`);
    failed = true;
    continue;
  }

  console.log(`✓ ${relPath}`);
}

process.exit(failed ? 1 : 0);

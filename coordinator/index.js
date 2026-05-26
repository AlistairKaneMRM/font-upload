#!/usr/bin/env node
// Coordinator: runs a single font.config.json through every target in
// targets.yaml in parallel. For each target it clones the repo, branches off
// the default branch, copies font binaries in (when fonts_dir is defined),
// invokes the agent, then — if --execute is passed — commits, pushes, and
// opens a PR. Default mode is --dry-run, which stops after the diff is
// produced.
//
// Usage:
//   node coordinator/index.js [options] <font.config.json>
//
// Options:
//   --execute            Push branches and open PRs (default: dry-run)
//   --target=<name>      Run only this target (matches basename of repo:)
//   --keep-workdirs      Preserve temp working directories on success
//   -h, --help           Show usage
//
// Output: a JSON summary on stdout listing per-target results.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const yaml = require("js-yaml");

const REPO_ROOT = path.resolve(__dirname, "..");

function usage(exitCode = 0) {
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write(`Usage: node coordinator/index.js [options] <font.config.json>

Options:
  --execute            Push branches and open PRs (default: dry-run)
  --target=<name>      Run only this target (matches basename of repo:)
  --keep-workdirs      Preserve temp working directories on success
  -h, --help           Show this usage and exit
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const opts = { execute: false, target: null, keepWorkdirs: false };
  const positionals = [];
  for (const a of argv) {
    if (a === "-h" || a === "--help") usage(0);
    else if (a === "--execute") opts.execute = true;
    else if (a === "--keep-workdirs") opts.keepWorkdirs = true;
    else if (a.startsWith("--target=")) opts.target = a.slice("--target=".length);
    else if (a.startsWith("--")) {
      process.stderr.write(`unknown option: ${a}\n`);
      usage(2);
    } else positionals.push(a);
  }
  if (positionals.length !== 1) usage(2);
  opts.configPath = path.resolve(positionals[0]);
  return opts;
}

function loadTargets(targetFilter) {
  const doc = yaml.load(fs.readFileSync(path.join(REPO_ROOT, "targets.yaml"), "utf8"));
  const all = doc.targets || [];
  if (!targetFilter) return all;
  const matched = all.filter(
    (t) => path.basename(t.repo) === targetFilter || t.repo === targetFilter
  );
  if (matched.length === 0) {
    const known = all.map((t) => path.basename(t.repo)).join(", ");
    throw new Error(`no target matches "${targetFilter}". Available: ${known}`);
  }
  return matched;
}

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`config not found: ${configPath}`);
  }
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function makeSlug(family) {
  return family
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function assemblePrompt(target, config, fontsDir) {
  const shared = fs.readFileSync(path.join(REPO_ROOT, "prompts", "shared-context.md"), "utf8");
  const targetPrompt = fs.readFileSync(path.join(REPO_ROOT, target.prompt), "utf8");
  const rolloutSection = fontsDir
    ? `The font binaries have already been copied into \`${fontsDir}/\`. Your working directory is the cloned repo.\n`
    : `Binaries are NOT stored in this repo. Your working directory is the cloned repo.\n`;
  return [
    shared,
    "\n\n---\n\n",
    targetPrompt,
    "\n\n---\n\n## This rollout\n\n",
    rolloutSection,
    "\nThe `font.config.json` for this rollout:\n\n```json\n",
    JSON.stringify(config, null, 2),
    "\n```\n\nMake the edits per the conventions above, then print your output JSON.\n",
  ].join("");
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], ...opts });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => {
      if (code !== 0) {
        const err = new Error(`${cmd} ${args.join(" ")} exited ${code}\n${stderr}`);
        err.stdout = stdout;
        err.stderr = stderr;
        err.code = code;
        reject(err);
        return;
      }
      resolve({ stdout, stderr });
    });
    child.on("error", reject);
  });
}

function parseAgentOutput(stdout) {
  const match = stdout.match(/\{[\s\S]*\}\s*$/);
  if (!match) {
    throw new Error(`agent emitted no JSON object:\n${stdout.slice(-1000)}`);
  }
  try {
    return JSON.parse(match[0]);
  } catch (e) {
    throw new Error(`agent JSON parse failed: ${e.message}\n---\n${match[0]}`);
  }
}

async function processTarget(target, config, configDir, opts) {
  const name = path.basename(target.repo);
  const slug = makeSlug(config.family);
  const branch = `add-font/${slug}`;
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), `font-rollout-${name}-`));
  const targetDir = path.join(workdir, "target");
  const result = { target: name, repo: target.repo, branch, workdir: targetDir };

  try {
    // 1. Clone
    await run("gh", [
      "repo", "clone", target.repo, targetDir, "--",
      "--depth", "1", "--branch", target.default_branch, "--no-tags", "--quiet",
    ]);

    // 2. Branch
    await run("git", ["checkout", "-b", branch], { cwd: targetDir });

    // 3. Copy binaries if applicable
    if (target.fonts_dir) {
      const dst = path.join(targetDir, target.fonts_dir);
      fs.mkdirSync(dst, { recursive: true });
      for (const f of config.files) {
        const src = path.join(configDir, f.filename);
        if (!fs.existsSync(src)) throw new Error(`missing font binary: ${src}`);
        fs.copyFileSync(src, path.join(dst, f.filename));
      }
    }

    // 4. Build the prompt and invoke the agent
    const prompt = assemblePrompt(target, config, target.fonts_dir || null);
    const agentRes = await run("claude", [
      "-p", prompt,
      "--add-dir", targetDir,
      "--allowed-tools",
      "Read Edit Glob Grep Bash(gh pr diff*) Bash(git diff*) Bash(git log*)",
      "--permission-mode", "acceptEdits",
      "--no-session-persistence",
    ], { cwd: targetDir });

    const agentOutput = parseAgentOutput(agentRes.stdout);
    result.agent = agentOutput;

    if (agentOutput.status === "stop") {
      result.status = "stopped";
      result.reason = agentOutput.reason;
      return result;
    }

    // 5. Stage and check there's something to commit
    await run("git", ["add", "-A"], { cwd: targetDir });
    const diffStat = await run("git", ["diff", "--cached", "--stat"], { cwd: targetDir });
    result.diffStat = diffStat.stdout.trim();

    if (!result.diffStat) {
      result.status = "ok";
      result.notes = "no changes to commit (font may already be present)";
      return result;
    }

    if (!opts.execute) {
      result.status = "dry-run";
      result.notes = "stopped before commit; workdir preserved for review";
      return result;
    }

    // 6. Commit, push, PR
    await run("git", ["commit", "-m", `Adds ${config.family} font`], { cwd: targetDir });
    await run("git", ["push", "-u", "origin", branch], { cwd: targetDir });
    const pr = await run("gh", [
      "pr", "create",
      "--base", target.default_branch,
      "--head", branch,
      "--title", `Adds ${config.family} font`,
      "--body", `Automated rollout via font-upload coordinator.\n\nFont family: ${config.family}\n\n${agentOutput.notes ? "Agent notes:\n" + agentOutput.notes + "\n" : ""}`,
    ], { cwd: targetDir });

    result.status = "ok";
    result.prUrl = pr.stdout.trim();
    return result;
  } catch (err) {
    result.status = "error";
    result.error = err.message;
    return result;
  } finally {
    if (
      opts.keepWorkdirs ||
      result.status === "error" ||
      result.status === "stopped" ||
      result.status === "dry-run"
    ) {
      result.workdir_preserved = true;
    } else {
      try {
        fs.rmSync(workdir, { recursive: true, force: true });
        result.workdir_preserved = false;
      } catch {
        result.workdir_preserved = true;
      }
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const config = loadConfig(opts.configPath);
  const configDir = path.dirname(opts.configPath);
  const targets = loadTargets(opts.target);

  process.stderr.write(
    `==> Running ${opts.execute ? "EXECUTE" : "dry-run"} for "${config.family}" against ${targets.length} target(s): ${targets
      .map((t) => path.basename(t.repo))
      .join(", ")}\n`
  );

  const results = await Promise.all(
    targets.map((t) => processTarget(t, config, configDir, opts))
  );

  const summary = {
    family: config.family,
    mode: opts.execute ? "execute" : "dry-run",
    results,
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");

  const anyFailed = results.some((r) => r.status === "error");
  process.exit(anyFailed ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write(`fatal: ${err.message}\n`);
  process.exit(2);
});

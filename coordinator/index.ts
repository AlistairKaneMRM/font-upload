// Coordinator entry point. Fills in during Phase 4.
//
// Responsibilities:
//   1. Read the validated font.config.json for the rollout.
//   2. Load targets.yaml.
//   3. For each target: clone repo, branch, copy binary, invoke the agent,
//      commit, push, open PR.
//   4. Collect PR URLs and emit them as the workflow's output.
//
// Phase 1: stub only.

function main(): void {
  throw new Error("Coordinator not implemented yet — wired up in Phase 4.");
}

main();

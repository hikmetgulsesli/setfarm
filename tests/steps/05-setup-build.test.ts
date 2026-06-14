import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { setupBuildModule } from "../../dist/installer/steps/05-setup-build/module.js";
import { onComplete } from "../../dist/installer/steps/05-setup-build/guards.js";
import type { ParsedOutput, CompleteContext } from "../../dist/installer/steps/types.js";

describe("05-setup-build step module", () => {
  it("module metadata is correct", () => {
    assert.equal(setupBuildModule.id, "setup-build");
    assert.equal(setupBuildModule.type, "single");
    assert.equal(setupBuildModule.agentRole, "setup-build");
    assert.equal(setupBuildModule.maxPromptSize, 6144);
    assert.deepEqual(setupBuildModule.requiredOutputFields, ["STATUS"]);
    assert.ok(typeof setupBuildModule.preClaim === "function");
  });

  it("preClaim supports auto-completion instead of setup-build agent handoff", () => {
    const preclaim = fs.readFileSync("src/installer/steps/05-setup-build/preclaim.ts", "utf-8");
    assert.ok(preclaim.includes("SETFARM_DISABLE_AUTO_SETUP_BUILD"), "auto-complete should have an opt-out env guard");
    assert.ok(preclaim.includes("AUTO-COMPLETED setup-build"), "setup-build should complete in preClaim when baseline checks pass");
    assert.ok(preclaim.includes("completeStep(step.id, output)"), "preClaim should use the normal completeStep path");
  });

  it("preClaim recovers missing package.json by rerunning setup-repo scaffold", () => {
    const preclaim = fs.readFileSync("src/installer/steps/05-setup-build/preclaim.ts", "utf-8");
    const recovery = preclaim.indexOf("rerunSetupRepoScaffold");
    const missingPackage = preclaim.indexOf("package.json missing after setup-repo");
    const setupScript = preclaim.indexOf("setup-repo.sh");
    assert.ok(recovery >= 0, "setup-build should have a setup-repo recovery path");
    assert.ok(setupScript > recovery, "recovery path should call setup-repo.sh");
    assert.ok(missingPackage > setupScript, "missing package failure should be reported only after recovery");
    assert.ok(preclaim.includes('resolvePlatformScript("setup-repo.sh")'), "setup-build recovery should use the active setup script");
    assert.ok(preclaim.includes('resolvePlatformScript("stitch-to-jsx.mjs")'), "setup-build should use the active Stitch-to-JSX script");
    assert.ok(preclaim.includes('resolvePlatformScript("generated-screen-validator.mjs")'), "setup-build should validate generated screens before handoff");
    assert.equal(preclaim.includes(".openclaw/setfarm-repo/scripts/setup-repo.sh"), false, "setup-build must not hard-code the legacy setup script path");
    assert.ok(preclaim.includes("String(displayName)"), "recovery path should preserve project display title");
    assert.ok(preclaim.includes("String(uiLanguage)"), "recovery path should preserve UI language for scaffold html lang");
  });

  it("preClaim re-evaluates stale setup-build failure flags before auto-complete", () => {
    const preclaim = fs.readFileSync("src/installer/steps/05-setup-build/preclaim.ts", "utf-8");
    const repoReady = preclaim.indexOf("package.json");
    const clearBaseline = preclaim.indexOf("delete ctx.context[\"baseline_fail\"]");
    const clearCompat = preclaim.indexOf("delete ctx.context[\"compat_fail\"]");
    const autoComplete = preclaim.indexOf("AUTO-COMPLETED setup-build");
    assert.ok(clearBaseline > repoReady, "baseline_fail should be cleared after repo readiness is confirmed");
    assert.ok(clearCompat > clearBaseline, "compat_fail should be cleared with stale baseline state");
    assert.ok(autoComplete > clearCompat, "stale failure flags must be cleared before auto-complete decision");
  });

  it("setup baseline can fall back to local main without retry loops", () => {
    const stepOps = fs.readFileSync("src/installer/step-ops.ts", "utf-8");
    const worktreeOps = fs.readFileSync("src/installer/worktree-ops.ts", "utf-8");
    assert.ok(stepOps.includes("setfarm.localMainAuthoritative"), "setup-build should persist local-main fallback state");
    assert.ok(stepOps.includes("Remote main publish failed; using local main baseline"), "remote publish failure should not force setup-build retry");
    assert.ok(worktreeOps.includes("origin/main has not caught up"), "worktree creation should preserve local baseline fallback");
    assert.ok(worktreeOps.includes("returning to normal main sync"), "fallback should clear once remote main contains the baseline");
  });

  it("buildPrompt substitutes REPO/TECH_STACK/BUILD_CMD_HINT from context", () => {
    const prompt = setupBuildModule.buildPrompt({
      runId: "r1",
      task: "t",
      context: {
        repo: "$HOME/projects/testapp-12345",
        tech_stack: "vite-react",
        build_cmd_hint: "npm run build",
      },
    });
    assert.ok(prompt.includes("$HOME/projects/testapp-12345"));
    assert.ok(prompt.includes("vite-react"));
    assert.ok(prompt.includes("npm run build"));
    assert.ok(prompt.includes("Rules"));
  });

  it("buildPrompt carries setup-build repair context to the setup-build agent", () => {
    const prompt = setupBuildModule.buildPrompt({
      runId: "r1",
      task: "t",
      context: {
        repo: "$HOME/projects/testapp-12345",
        tech_stack: "vite-react",
        build_cmd_hint: "npm run build",
        previous_failure: "SETUP_BUILD_PRECLAIM_BLOCKER:\nDESIGN_IMPORT_VALIDATE failed",
        failure_category: "design_import_failure",
        failure_suggestion: "Fix the deterministic Stitch-to-JSX import baseline.",
        design_import_validate_report: ".setfarm/setup/DESIGN_IMPORT_VALIDATE.json",
      },
    });

    assert.ok(prompt.includes("Failure category: design_import_failure"));
    assert.ok(prompt.includes("Fix the deterministic Stitch-to-JSX import baseline."));
    assert.ok(prompt.includes(".setfarm/setup/DESIGN_IMPORT_VALIDATE.json"));
    assert.ok(prompt.includes("SETUP_BUILD_PRECLAIM_BLOCKER"));
  });

  it("buildPrompt stays within maxPromptSize for typical inputs", () => {
    const prompt = setupBuildModule.buildPrompt({
      runId: "r1",
      task: "t",
      context: { repo: "$HOME/projects/app", tech_stack: "vite-react" },
    });
    assert.ok(
      Buffer.byteLength(prompt, "utf-8") < setupBuildModule.maxPromptSize,
      `prompt ${Buffer.byteLength(prompt, "utf-8")} >= budget ${setupBuildModule.maxPromptSize}`
    );
  });

  it("validateOutput requires STATUS: done", () => {
    assert.equal(setupBuildModule.validateOutput({ status: "done" } as ParsedOutput).ok, true);
    assert.equal(setupBuildModule.validateOutput({ status: "retry" } as ParsedOutput).ok, false);
    assert.equal(setupBuildModule.validateOutput({} as ParsedOutput).ok, false);
  });

  it("does not add a second Tailwind/Vite integration after setup-build", () => {
    const stepOps = fs.readFileSync("src/installer/step-ops.ts", "utf-8");
    const preclaim = fs.readFileSync("src/installer/steps/05-setup-build/preclaim.ts", "utf-8");
    const guardrails = fs.readFileSync("src/installer/step-guardrails.ts", "utf-8");
    assert.equal(stepOps.includes("@tailwindcss/vite"), false, "setup-build completion should not mutate Vite/Tailwind after preclaim build checks");
    assert.ok(preclaim.includes("tailwindcss@^3.4.19"), "missing Tailwind setup should use the v3 PostCSS baseline");
    assert.ok(guardrails.includes("tailwindcss@^3.4.19"), "late Tailwind guardrails should use the same v3 PostCSS baseline");
    assert.ok(guardrails.includes("tailwindcss: {}"), "late PostCSS fallback should not generate a Tailwind v4 plugin config");
  });

  it("records actionable process stderr when setup-build preclaim fails", () => {
    const preclaim = fs.readFileSync("src/installer/steps/05-setup-build/preclaim.ts", "utf-8");
    assert.ok(preclaim.includes("formatProcessFailure"), "preclaim should preserve stdout/stderr from failed commands");
    assert.ok(preclaim.includes("stderr:"), "preclaim failures should include stderr labels");
    assert.ok(preclaim.includes("npm run build failed after stitch-to-jsx:\\n"), "post-stitch build failures should keep the real compiler output");
    assert.ok(preclaim.includes("DESIGN_IMPORT_VALIDATE failed after stitch-to-jsx:\\n"), "design import validation failures should keep the validator output");
    assert.ok(preclaim.includes("design_import_failure"), "generated screen defects should be classified separately from implementation failures");
    assert.ok(preclaim.includes("DESIGN_IMPORT_REPAIR_SUGGESTION"), "setup-build retry should receive a deterministic repair path");
    assert.ok(preclaim.includes("summarizeDesignImportReport(repo)"), "validator reports should be summarized for the retry agent");
  });

  it("setup-build is a hard preclaim gate", () => {
    const stepOps = fs.readFileSync("src/installer/step-ops.ts", "utf-8");
    const preclaim = fs.readFileSync("src/installer/steps/05-setup-build/preclaim.ts", "utf-8");
    assert.match(stepOps, /HARD_PRECLAIM_STEPS\s*=\s*new Set\(\["setup-build", "security-gate", "qa-test", "final-test"\]\)/);
    assert.ok(preclaim.includes("function throwPreclaimFailure"), "setup-build should hard-stop preclaim failures instead of looping through the agent");
    assert.ok(preclaim.includes('throwPreclaimFailure(ctx, msg, "design_import_failure", DESIGN_IMPORT_REPAIR_SUGGESTION)'), "design import failures should throw from preclaim");
    assert.ok(preclaim.includes("DESIGN_IMPORT_VALIDATE failed before setup-build completion"), "final design validation failures should still be hard blockers");
  });

  it("commits Stitch runtime CSS generated alongside screens", () => {
    const preclaim = fs.readFileSync("src/installer/steps/05-setup-build/preclaim.ts", "utf-8");
    assert.ok(preclaim.includes("generatedPaths"), "setup-build should stage all generated Stitch artifacts together");
    assert.ok(preclaim.includes("\"src/screens/\""), "generated screens should still be staged");
    assert.ok(preclaim.includes("\"src/index.css\""), "stitch-to-jsx runtime CSS in src/index.css should be staged");
    assert.ok(preclaim.includes("\"src/App.css\""), "alternate CSS entrypoints should be staged when updated");
  });

  it("validates generated screens before committing or building them", () => {
    const preclaim = fs.readFileSync("src/installer/steps/05-setup-build/preclaim.ts", "utf-8");
    const convert = preclaim.indexOf('resolvePlatformScript("stitch-to-jsx.mjs")');
    const validate = preclaim.indexOf('resolvePlatformScript("generated-screen-validator.mjs")', convert);
    const commit = preclaim.indexOf("chore: auto-generate JSX screens from Stitch HTML");
    const postBuild = preclaim.indexOf("post-stitch build ok");
    assert.ok(convert >= 0, "setup-build should run stitch-to-jsx");
    assert.ok(validate > convert, "screen validation should run after conversion");
    assert.ok(commit > validate, "generated screens should be committed only after validation");
    assert.ok(postBuild > validate, "post-stitch build should run only after validation");
    assert.ok(preclaim.includes("[validatorPath, repo, \"--fix\"]"), "setup-build should auto-fix deterministic generated screen defects before failing");
    assert.ok(preclaim.indexOf("await writeSetupHandoff(ctx, repo, buildCmd)", validate) > validate, "setup-build should refresh setup certificate after design validation");
    assert.ok(preclaim.includes("enforceFinalDesignImportValidation(ctx, repo)"), "setup-build completion should be blocked by final manifest/screen validation even when stitch-to-jsx is skipped");
    assert.ok(preclaim.includes("DESIGN_IMPORT_VALIDATE failed before setup-build completion"), "final design validation failures should be classified before setup-build completes");
  });

  it("onComplete stamps build_cmd from parsed output", async () => {
    const context: Record<string, string> = {};
    const ctx: CompleteContext = {
      runId: "r1",
      stepId: "setup-build",
      parsed: { status: "done", build_cmd: "pnpm run build" } as ParsedOutput,
      context,
    };
    await onComplete(ctx);
    assert.equal(context["build_cmd"], "pnpm run build");
  });

  it("onComplete falls back to build_cmd_hint when parsed.build_cmd missing", async () => {
    const context: Record<string, string> = { build_cmd_hint: "yarn build" };
    await onComplete({
      runId: "r1",
      stepId: "setup-build",
      parsed: { status: "done" } as ParsedOutput,
      context,
    });
    assert.equal(context["build_cmd"], "yarn build");
  });

  it("onComplete final fallback is 'npm run build'", async () => {
    const context: Record<string, string> = {};
    await onComplete({
      runId: "r1",
      stepId: "setup-build",
      parsed: { status: "done" } as ParsedOutput,
      context,
    });
    assert.equal(context["build_cmd"], "npm run build");
  });

  it("onComplete throws when compat_fail flag is present", async () => {
    const context: Record<string, string> = { compat_fail: "nextjs not supported" };
    await assert.rejects(
      onComplete({
        runId: "r1",
        stepId: "setup-build",
        parsed: { status: "done" } as ParsedOutput,
        context,
      }),
      /COMPAT: nextjs not supported/
    );
  });

  it("onComplete throws when baseline_fail flag is present", async () => {
    const context: Record<string, string> = { baseline_fail: "Module not found: react-router-dom" };
    await assert.rejects(
      onComplete({
        runId: "r1",
        stepId: "setup-build",
        parsed: { status: "done" } as ParsedOutput,
        context,
      }),
      /BASELINE: npm run build failed/
    );
  });

  it("onComplete treats generated icon fallback as supervisor quality warning when build passes", async () => {
    const tmp = fs.mkdtempSync("/tmp/setfarm-setup-build-icons-");
    try {
      fs.mkdirSync(`${tmp}/src/screens`, { recursive: true });
      fs.writeFileSync(`${tmp}/package.json`, JSON.stringify({
        scripts: { build: "node -e \"process.exit(0)\"" },
      }));
      fs.writeFileSync(
        `${tmp}/src/screens/Operations.tsx`,
        [
          "import { BadgeHelp } from 'lucide-react';",
          "export function Operations() { return <main><BadgeHelp />Operations</main>; }",
          "",
        ].join("\n"),
      );
      const context: Record<string, string> = {
        repo: tmp,
        baseline_fail: "DESIGN_IMPORT_ICON_FALLBACK warning after stitch-to-jsx",
        failure_category: "design_import_failure",
      };

      await onComplete({
        runId: "r1",
        stepId: "setup-build",
        parsed: { status: "done", build_cmd: "npm run build" } as ParsedOutput,
        context,
      });
      assert.equal(context["baseline_fail"], undefined);
      assert.equal(context["failure_category"], undefined);
      assert.equal(context["build_cmd"], "npm run build");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("onComplete keeps design import failure active when validation report still fails even if build passes", async () => {
    const tmp = fs.mkdtempSync("/tmp/setfarm-setup-build-design-report-");
    try {
      fs.mkdirSync(`${tmp}/.setfarm/setup`, { recursive: true });
      fs.writeFileSync(`${tmp}/package.json`, JSON.stringify({
        scripts: { build: "node -e \"process.exit(0)\"" },
      }));
      fs.writeFileSync(`${tmp}/.setfarm/setup/DESIGN_IMPORT_VALIDATE.json`, JSON.stringify({
        status: "fail",
        failures: ["SCREEN_SURFACE_MISMATCH: SURF_RETURNS missing generated screen"],
      }));
      const context: Record<string, string> = {
        repo: tmp,
        baseline_fail: "DESIGN_IMPORT_VALIDATE failed after stitch-to-jsx",
        failure_category: "design_import_failure",
      };

      await assert.rejects(
        onComplete({
          runId: "r1",
          stepId: "setup-build",
          parsed: { status: "done", build_cmd: "npm run build" } as ParsedOutput,
          context,
        }),
        /DESIGN_IMPORT_VALIDATE/
      );
      assert.match(context["baseline_fail"], /DESIGN_IMPORT_VALIDATE/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("onComplete clears stale baseline_fail when the current build passes", async () => {
    const tmp = fs.mkdtempSync("/tmp/setfarm-setup-build-");
    try {
      fs.writeFileSync(`${tmp}/package.json`, JSON.stringify({
        scripts: { build: "node -e \"process.exit(0)\"" },
      }));
      const context: Record<string, string> = {
        repo: tmp,
        baseline_fail: "previous generated JSX failed",
        previous_failure: "SETUP_BUILD_PRECLAIM_BLOCKER:\nprevious generated JSX failed",
        failure_category: "design_import_failure",
        failure_suggestion: "repair generated JSX",
      };

      await onComplete({
        runId: "r1",
        stepId: "setup-build",
        parsed: { status: "done", build_cmd: "npm run build" } as ParsedOutput,
        context,
      });

      assert.equal(context["baseline_fail"], undefined);
      assert.equal(context["previous_failure"], undefined);
      assert.equal(context["failure_category"], undefined);
      assert.equal(context["failure_suggestion"], undefined);
      assert.equal(context["build_cmd"], "npm run build");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

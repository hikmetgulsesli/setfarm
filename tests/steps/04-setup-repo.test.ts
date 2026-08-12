import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { setupRepoModule } from "../../src/installer/steps/04-setup-repo/module.js";
import type { ParsedOutput } from "../../src/installer/steps/types.js";
import {
  preClaim as preClaimSource,
  SetupRepoEnglishTextRequiredError,
} from "../../src/installer/steps/04-setup-repo/preclaim.js";

describe("04-setup-repo step module", () => {
  it("module metadata is correct", () => {
    assert.equal(setupRepoModule.id, "setup-repo");
    assert.equal(setupRepoModule.type, "single");
    assert.equal(setupRepoModule.agentRole, "setup-repo");
    assert.equal(setupRepoModule.maxPromptSize, 6144);
    assert.deepEqual(setupRepoModule.requiredOutputFields, ["STATUS"]);
    assert.ok(typeof setupRepoModule.preClaim === "function");
    assert.ok(typeof setupRepoModule.onComplete === "function");
  });

  it("buildPrompt substitutes REPO/BRANCH/TECH_STACK/DB_REQUIRED from context", () => {
    const prompt = setupRepoModule.buildPrompt({
      runId: "r1",
      task: "t",
      context: {
        repo: "$HOME/projects/testapp-99999",
        branch: "feature-testapp",
        tech_stack: "vite-react",
        db_required: "postgres",
      },
    });
    assert.ok(prompt.includes("$HOME/projects/testapp-99999"));
    assert.ok(prompt.includes("feature-testapp"));
    assert.ok(prompt.includes("vite-react"));
    assert.ok(prompt.includes("postgres"));
    assert.ok(prompt.includes("Rules"));
  });

  it("buildPrompt uses defaults when context keys missing", () => {
    const prompt = setupRepoModule.buildPrompt({ runId: "r1", task: "t", context: {} });
    assert.ok(prompt.includes("main"));
    assert.ok(prompt.includes("vite-react"));
    assert.ok(prompt.includes("none"));
  });

  it("buildPrompt stays within maxPromptSize", () => {
    const prompt = setupRepoModule.buildPrompt({
      runId: "r1",
      task: "t",
      context: { repo: "$HOME/projects/typical-app", tech_stack: "vite-react", db_required: "none" },
    });
    assert.ok(
      Buffer.byteLength(prompt, "utf-8") < setupRepoModule.maxPromptSize,
      `prompt ${Buffer.byteLength(prompt, "utf-8")} >= budget ${setupRepoModule.maxPromptSize}`
    );
  });

  it("validateOutput rejects when STATUS is missing", () => {
    const r = setupRepoModule.validateOutput({} as ParsedOutput);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes("STATUS")));
  });

  it("validateOutput rejects STATUS that is not 'done'", () => {
    const r = setupRepoModule.validateOutput({ status: "retry" } as ParsedOutput);
    assert.equal(r.ok, false);
  });

  it("validateOutput accepts STATUS: done (case-insensitive)", () => {
    assert.equal(setupRepoModule.validateOutput({ status: "done" } as ParsedOutput).ok, true);
    assert.equal(setupRepoModule.validateOutput({ status: "DONE" } as ParsedOutput).ok, true);
  });

  it("preClaim supports auto-completion instead of setup-repo agent handoff", () => {
    const preclaim = fs.readFileSync("src/installer/steps/04-setup-repo/preclaim.ts", "utf-8");
    assert.ok(preclaim.includes("SETFARM_DISABLE_AUTO_SETUP_REPO"), "auto-complete should have an opt-out env guard");
    const admission = preclaim.indexOf("loadCompilerEnglishAdmissionLedgerAuthorityV1(getSql()");
    const storyAdmission = preclaim.indexOf("loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(getSql()");
    const optOut = preclaim.indexOf('if (process.env.SETFARM_DISABLE_AUTO_SETUP_REPO === "1") return;');
    assert.ok(
      admission > 0 && storyAdmission > admission && optOut > storyAdmission,
      "auto-work opt-out must not bypass durable PLAN or STORIES English admission",
    );
    assert.ok(preclaim.includes("AUTO-COMPLETED setup-repo"), "setup-repo should complete in preClaim when the repo is ready");
    assert.ok(
      preclaim.includes("completeStep(step.id, output, ctx.claimEnvelope)"),
      "preClaim should complete through the immutable claim capability",
    );
    assert.ok(preclaim.includes("repoReady"), "auto-complete must require a real prepared repo");
    assert.ok(preclaim.includes('resolvePlatformScript("setup-repo.sh")'), "setup-repo preClaim should use the active platform script path");
    assert.equal(preclaim.includes(".openclaw/setfarm-repo/scripts/setup-repo.sh"), false, "setup-repo preClaim must not hard-code the legacy install path");
  });

  it("onComplete canonicalizes setup-repo branch to the run id", async () => {
    const { onComplete } = await import("../../src/installer/steps/04-setup-repo/guards.js");
    const context: Record<string, string> = { branch: "feature-long-plan-branch", BRANCH: "feature-long-plan-branch" };
    await onComplete({
      runId: "run-123",
      stepId: "setup-repo",
      parsed: { status: "done", existing_code: "false" } as ParsedOutput,
      context,
    });

    assert.equal(context.branch, "run-123");
    assert.equal(context.BRANCH, "run-123");
    assert.equal(context.existing_code, "false");
  });

  it("vite scaffold template is project-neutral", () => {
    const script = fs.readFileSync("scripts/setup-repo.sh", "utf-8");
    assert.ok(script.includes('git init -b main'), "fresh repos should initialize main directly");
    assert.ok(script.includes("normalize_stack()"), "setup-repo should normalize planner TECH_STACK labels");
    assert.ok(script.includes("react-vite-typescript"), "React/Vite/TypeScript labels should map to vite-react");
    assert.ok(script.includes("static|html|static-html|static-site|plain-html|site|landing|landing-page"), "static HTML labels should map to static-html");
    assert.ok(script.includes("static-html)"), "Static HTML should have a first-class scaffold case");
    assert.ok(script.includes("chore: scaffold static html app"), "Static HTML scaffold should commit a project-neutral baseline");
    assert.ok(script.includes('[ "$TECH_STACK" = "static-html" ] && [ ! -f index.html ]'), "Static HTML scaffold should require index.html instead of package.json");
    assert.ok(script.includes("browser-game|canvas-game|arcade|game"), "browser game labels should scaffold on the Vite React baseline");
    assert.ok(script.includes("nextjs)"), "Next.js should have a first-class scaffold case");
    assert.ok(script.includes('"build": "next build"'), "Next.js scaffold should build with next build");
    assert.ok(script.includes("clean_branch_tracking main"), "setup-repo should remove duplicate upstream config before push -u");
    assert.ok(script.includes('"@testing-library/user-event"'), "Vite scaffold should include user-event because agents write interaction tests");
    assert.ok(script.includes('"test:run": "vitest run"'), "Vite scaffold should include non-watch test:run script");
    assert.ok(script.includes("cat > vitest.config.ts"), "Vite scaffold should create separate Vitest config");
    assert.ok(script.includes("pool: 'forks'"), "Vitest scaffold should avoid runaway thread pools in agent runs");
    assert.ok(script.includes("maxWorkers: 1"), "Vitest scaffold should run one worker for deterministic agent checks");
    assert.ok(script.includes("fileParallelism: false"), "Vitest scaffold should disable file-level parallelism");
    assert.ok(script.includes("cat > src/test/setup.ts"), "Vite scaffold should create test setup helper");
    assert.ok(script.includes("cleanup();"), "Vite scaffold test setup should cleanup React renders");
    assert.ok(script.includes("rafHandles"), "Vite scaffold test setup should cleanup RAF loops from browser-game runtimes");
    assert.ok(script.includes("intervalHandles"), "Vite scaffold test setup should cleanup interval loops from generated runtimes");
    assert.ok(script.includes("timeoutHandles"), "Vite scaffold test setup should cleanup pending timers from generated runtimes");
    assert.ok(script.includes("cat > src/App.test.tsx"), "Vite scaffold should create a durable baseline render test");
    assert.ok(script.includes("renders an application root"), "baseline render test should survive later App.tsx implementations");
    assert.ok(script.includes("getByTestId('setfarm-app-root')"), "baseline render test should assert the neutral app root, not a semantic main wrapper");
    assert.ok(script.includes('"lucide-react"'), "frontend scaffolds should install lucide-react for SVG icons");
    assert.equal(script.includes("Material+Symbols+Outlined"), false, "scaffold must not load Material Symbols icon fonts");
    assert.ok(script.includes("<title>$HTML_TITLE</title>"), "HTML title should come from sanitized display title");
    assert.ok(script.includes("UI_LANGUAGE=\"${7:-English}\""), "setup-repo should preserve its UI_LANGUAGE argument");
    assert.ok(script.includes("canonicalize_ui_language()"), "setup-repo should validate compatible English aliases");
    const languageValidation = script.indexOf('UI_LANGUAGE=$(canonicalize_ui_language "$UI_LANGUAGE")');
    const firstRepoMutation = script.indexOf('mkdir -p "$REPO"');
    assert.ok(languageValidation >= 0, "language validation must be present");
    assert.ok(firstRepoMutation > languageValidation, "language validation must precede repo mutation");
    assert.ok(script.includes('<html lang="en">'), "frontend scaffolds should use the canonical English language tag");
    assert.equal(script.includes("turkish|tr|tr-tr"), false, "setup-repo must not retain a non-English language branch");
    assert.equal(script.includes("$HTML_LANG"), false, "frontend scaffolds must not derive a mutable language tag");
    assert.ok(script.includes('"name": "$PACKAGE_NAME"'), "package name should come from project slug");
    assert.ok(script.includes('data-setfarm-root="baseline"'), "App baseline should be machine-detectable");
    assert.equal(script.includes('return <main data-setfarm-root="baseline"'), false, "generated-screen scaffolds must start from a neutral app root");
    assert.ok(script.includes("baseline scaffold did not create package.json"), "fresh frontend repos must fail if scaffold is missing");
    assert.ok(script.includes("PLATFORM_ROOT="), "setup-repo.sh should resolve scripts relative to the active platform root");
    assert.ok(script.includes('STITCH_SCRIPT="$PLATFORM_ROOT/scripts/stitch-api.mjs"'), "setup-repo.sh should call the active Stitch script");
    assert.equal(script.includes('STITCH_SCRIPT="$HOME/.openclaw/setfarm-repo/scripts/stitch-api.mjs"'), false, "setup-repo.sh must not hard-code the legacy Stitch script path");
    assert.equal(script.includes("<title>Notes</title>"), false);
    assert.equal(script.includes("useNotes"), false);
    assert.equal(script.includes("NoteStatus"), false);
    assert.equal(script.includes("setfarm-notes"), false);
  });

  it("setup-repo.sh scaffolds static HTML without a framework package", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-static-scaffold-"));
    try {
      const repo = path.join(tmp, "repo");
      fs.mkdirSync(repo, { recursive: true });
      execFileSync("git", ["init", "-b", "main"], { cwd: repo, stdio: "pipe" });
      execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repo, stdio: "pipe" });
      execFileSync("git", ["config", "user.name", "Setfarm Test"], { cwd: repo, stdio: "pipe" });
      execFileSync("git", ["remote", "add", "origin", "https://example.com/setfarm/static-test.git"], { cwd: repo, stdio: "pipe" });

      execFileSync("bash", [
        "scripts/setup-repo.sh",
        repo,
        "feature-static",
        "",
        "",
        "static-html",
        "Static Canary",
        "en-US",
      ], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          SETFARM_GITHUB_REPO: "",
          SETFARM_RUN_SLUG: "static-canary",
          SETFARM_APP_TITLE: "Static Canary",
        },
        stdio: "pipe",
        timeout: 30000,
      });

      assert.equal(fs.existsSync(path.join(repo, "index.html")), true);
      assert.equal(fs.existsSync(path.join(repo, "assets/css/styles.css")), true);
      assert.equal(fs.existsSync(path.join(repo, "assets/js/app.js")), true);
      assert.equal(fs.existsSync(path.join(repo, "package.json")), false);
      const html = fs.readFileSync(path.join(repo, "index.html"), "utf-8");
      assert.match(html, /<html lang="en">/);
      assert.match(html, /data-setfarm-root="baseline"/);
      const css = fs.readFileSync(path.join(repo, "assets/css/styles.css"), "utf-8");
      assert.match(css, /@import "\.\.\/\.\.\/stitch\/design-tokens\.css"/);
      assert.match(css, /font-family: var\(--font-family-base/);
      assert.doesNotMatch(css, /font-family:\s*Inter\b/i);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejects non-English setup before mutating absent or existing targets", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-setup-language-"));
    try {
      const absentRepo = path.join(tmp, "absent");
      const absentResult = spawnSync("bash", [
        "scripts/setup-repo.sh",
        absentRepo,
        "main",
        "",
        "",
        "static-html",
        "Language Canary",
        "Klingon",
      ], { cwd: process.cwd(), encoding: "utf-8", timeout: 5_000 });

      assert.equal(absentResult.status, 64);
      assert.equal(absentResult.stdout, "");
      assert.equal(absentResult.stderr, "SETUP_REPO_UI_LANGUAGE_MUST_BE_ENGLISH\n");
      assert.equal(fs.existsSync(absentRepo), false);

      const existingRepo = path.join(tmp, "existing");
      fs.mkdirSync(existingRepo);
      const marker = path.join(existingRepo, "marker.txt");
      fs.writeFileSync(marker, "unchanged\n");
      const entriesBefore = fs.readdirSync(existingRepo);
      const markerBefore = fs.readFileSync(marker);
      const existingResult = spawnSync("bash", [
        "scripts/setup-repo.sh",
        existingRepo,
        "main",
        "",
        "",
        "static-html",
        "Language Canary",
        "Spanish",
      ], { cwd: process.cwd(), encoding: "utf-8", timeout: 5_000 });

      assert.equal(existingResult.status, 64);
      assert.equal(existingResult.stdout, "");
      assert.equal(existingResult.stderr, "SETUP_REPO_UI_LANGUAGE_MUST_BE_ENGLISH\n");
      assert.deepEqual(fs.readdirSync(existingRepo), entriesBefore);
      assert.deepEqual(fs.readFileSync(marker), markerBefore);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejects contaminated scaffold titles before shell target mutation", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-setup-title-"));
    const markerBypass = `English title ${String.fromCodePoint(0x0416)}`;
    try {
      const absentRepo = path.join(tmp, "absent");
      const absentResult = spawnSync("bash", [
        "scripts/setup-repo.sh",
        absentRepo,
        "main",
        "",
        "",
        "static-html",
        markerBypass,
        "English",
      ], { cwd: process.cwd(), encoding: "utf-8", timeout: 5_000 });

      assert.equal(absentResult.status, 64);
      assert.equal(absentResult.stdout, "");
      assert.equal(absentResult.stderr, "SETUP_REPO_ENGLISH_TEXT_REQUIRED: PROJECT_DISPLAY_NAME: English single-line admission failed\n");
      assert.equal(absentResult.stderr.includes(markerBypass), false);
      assert.equal(fs.existsSync(absentRepo), false);

      const existingRepo = path.join(tmp, "existing");
      fs.mkdirSync(existingRepo);
      const marker = path.join(existingRepo, "marker.txt");
      fs.writeFileSync(marker, "unchanged\n");
      const entriesBefore = fs.readdirSync(existingRepo);
      const markerBefore = fs.readFileSync(marker);
      const existingResult = spawnSync("bash", [
        "scripts/setup-repo.sh",
        existingRepo,
        "main",
        "",
        "",
        "static-html",
        "English title",
        "English",
      ], {
        cwd: process.cwd(),
        encoding: "utf-8",
        timeout: 5_000,
        env: { ...process.env, SETFARM_APP_TITLE: markerBypass },
      });

      assert.equal(existingResult.status, 64);
      assert.equal(existingResult.stdout, "");
      assert.equal(existingResult.stderr, "SETUP_REPO_ENGLISH_TEXT_REQUIRED: SETFARM_APP_TITLE: English single-line admission failed\n");
      assert.deepEqual(fs.readdirSync(existingRepo), entriesBefore);
      assert.deepEqual(fs.readFileSync(marker), markerBefore);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejects ASCII localized and multiline titles before mutation while accepting English typography", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-setup-title-policy-"));
    try {
      const localizedTitle = String.fromCharCode(
        71, 117, 97, 114, 100, 97, 114, 32, 99, 97, 109, 98, 105, 111, 115,
      );
      for (const [suffix, title] of [["localized", localizedTitle], ["multiline", "Line one\nLine two"]]) {
        const target = path.join(tmp, suffix);
        const result = spawnSync("bash", [
          "scripts/setup-repo.sh",
          target,
          "main",
          "",
          "",
          "static-html",
          title,
          "English",
        ], { cwd: process.cwd(), encoding: "utf-8", timeout: 5_000 });
        assert.equal(result.status, 64, suffix);
        assert.equal(fs.existsSync(target), false, suffix);
      }

      const acceptedRepo = path.join(tmp, "accepted");
      fs.mkdirSync(acceptedRepo);
      execFileSync("git", ["init", "-b", "main"], { cwd: acceptedRepo, stdio: "pipe" });
      execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: acceptedRepo, stdio: "pipe" });
      execFileSync("git", ["config", "user.name", "Setfarm Test"], { cwd: acceptedRepo, stdio: "pipe" });
      execFileSync("git", ["remote", "add", "origin", "https://example.com/setfarm/typography-test.git"], {
        cwd: acceptedRepo,
        stdio: "pipe",
      });
      const typographyTitle = `Planner${String.fromCodePoint(0x2019)}s Desk`;
      const accepted = spawnSync("bash", [
        "scripts/setup-repo.sh",
        acceptedRepo,
        "main",
        "",
        "",
        "static-html",
        typographyTitle,
        "English",
      ], { cwd: process.cwd(), encoding: "utf-8", timeout: 30_000 });
      assert.equal(accepted.status, 0, accepted.stderr);
      assert.match(fs.readFileSync(path.join(acceptedRepo, "index.html"), "utf-8"), /Planner/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("preClaim rejects contaminated persisted titles before context or target mutation", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-setup-preclaim-title-"));
    const markerBypass = `English title ${String.fromCodePoint(0x03a9)}`;
    try {
      const absentRepo = path.join(tmp, "absent");
      const absentContext = { repo: absentRepo, project_display_name: markerBypass };
      await assert.rejects(
        preClaimSource({
          runId: "run-english-absent",
          stepId: "setup-repo",
          task: "Build a preference tool",
          retryCount: 0,
          context: absentContext,
        }),
        (error) => {
          assert.ok(error instanceof SetupRepoEnglishTextRequiredError);
          assert.equal(error.code, "SETUP_REPO_ENGLISH_TEXT_REQUIRED");
          assert.equal(error.field, "project_display_name");
          assert.equal(error.message.includes(markerBypass), false);
          return true;
        },
      );
      assert.deepEqual(absentContext, { repo: absentRepo, project_display_name: markerBypass });
      assert.equal(fs.existsSync(absentRepo), false);

      const existingRepo = path.join(tmp, "existing");
      fs.mkdirSync(existingRepo);
      const marker = path.join(existingRepo, "marker.txt");
      fs.writeFileSync(marker, "unchanged\n");
      const entriesBefore = fs.readdirSync(existingRepo);
      const markerBefore = fs.readFileSync(marker);
      const existingContext = {
        repo: existingRepo,
        project_display_name: "English title",
        app_title: markerBypass,
      };
      await assert.rejects(
        preClaimSource({
          runId: "run-english-existing",
          stepId: "setup-repo",
          task: "Build a preference tool",
          retryCount: 0,
          context: existingContext,
        }),
        (error) => {
          assert.ok(error instanceof SetupRepoEnglishTextRequiredError);
          assert.equal(error.field, "app_title");
          return true;
        },
      );
      assert.deepEqual(existingContext, {
        repo: existingRepo,
        project_display_name: "English title",
        app_title: markerBypass,
      });
      assert.deepEqual(fs.readdirSync(existingRepo), entriesBefore);
      assert.deepEqual(fs.readFileSync(marker), markerBefore);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("preClaim passes project display name and literal English into setup-repo scaffold", () => {
    const preclaim = fs.readFileSync("src/installer/steps/04-setup-repo/preclaim.ts", "utf-8");
    assert.ok(preclaim.includes("project_display_name"), "preClaim should read display name from plan context");
    assert.ok(preclaim.includes("String(displayName)"), "setup-repo.sh should receive display name as an argv");
    assert.equal(preclaim.includes('ctx.context["ui_language"]'), false, "preClaim must not inherit a mutable UI language");
    assert.equal(preclaim.includes('ctx.context["UI_LANGUAGE"]'), false, "preClaim must not inherit a mutable UI language alias");
    assert.ok(preclaim.includes('String(displayName), "English"]'), "setup-repo.sh should receive literal English");
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { verifyModule } from "../../dist/installer/steps/07-verify/module.js";
import { normalize, validateOutput } from "../../dist/installer/steps/07-verify/guards.js";
import {
  commentLooksMechanicallySatisfied,
  formatPrCommentsForAgent,
  getMechanicallySatisfiedInlineReviewThreadIds,
  getResolvableHistoricalInlineReviewThreadIds,
} from "../../dist/installer/steps/07-verify/pr-comments.js";
import type { PrState } from "../../dist/installer/steps/07-verify/pr-comments.js";
import { resolveVerifyRetryIssues } from "../../dist/installer/step-ops.js";
import { isStaleFailureStoryOutput, verifiedStoryOutput } from "../../dist/installer/repo.js";
import type { ParsedOutput } from "../../dist/installer/steps/types.js";

const verifyPromptSource = readFileSync(
  resolve(import.meta.dirname, "../../src/installer/steps/07-verify/prompt.md"),
  "utf-8"
);

describe("07-verify step module", () => {
  it("module metadata is correct", () => {
    assert.equal(verifyModule.id, "verify");
    assert.equal(verifyModule.type, "single");
    assert.equal(verifyModule.agentRole, "reviewer");
    assert.equal(verifyModule.maxPromptSize, 16384);
    assert.deepEqual(verifyModule.requiredOutputFields, ["STATUS"]);
  });

  it("injectContext seeds supervisor memory and PR metadata defaults", async () => {
    const context: Record<string, string> = { foo: "bar" };
    await verifyModule.injectContext({
      runId: "r1", stepId: "verify", task: "t", context,
    });
    assert.match(context.setfarm_memory || "", /# Setfarm Memory[\s\S]*## Global Memory/);
    assert.equal(context.stack_memory_files, "memory/global.md");
    delete context.setfarm_memory;
    delete context.stack_memory_files;
    assert.deepEqual(context, {
      foo: "bar",
      supervisor_memory: "(no supervisor memory yet)",
      pr_comments: "",
      pr_check_state: "",
      pr_mergeable: "",
      pr_merge_state_status: "",
    });
  });

  it("buildPrompt substitutes worktree, main repo, PR, and preflight context", () => {
    const prompt = verifyModule.buildPrompt({
      runId: "r1",
      task: "t",
      context: {
        repo: "$HOME/projects/counter-12345",
        story_workdir: "/tmp/story-worktrees/r1-us-001",
        branch: "feature-counter",
        pr_url: "https://github.com/u/r/pull/42",
        preflight_analysis: "3 files changed, 0 ESLint errors",
        current_story: "US-002: Domain state",
      },
    });
    assert.ok(prompt.includes("$HOME/projects/counter-12345"));
    assert.ok(prompt.includes("MAIN_REPO: $HOME/projects/counter-12345"));
    assert.ok(prompt.includes("STORY_WORKDIR: /tmp/story-worktrees/r1-us-001"));
    assert.ok(prompt.includes("VERIFY_WORKDIR: /tmp/story-worktrees/r1-us-001"));
    assert.ok(prompt.includes("REPO: /tmp/story-worktrees/r1-us-001"));
    assert.ok(prompt.includes("feature-counter"));
    assert.ok(prompt.includes("https://github.com/u/r/pull/42"));
    assert.ok(prompt.includes("3 files changed"));
    assert.ok(prompt.includes("US-002"));
    assert.ok(prompt.includes("Rules"));
  });

  it("buildPrompt falls back to final_pr when pr_url missing", () => {
    const prompt = verifyModule.buildPrompt({
      runId: "r1",
      task: "t",
      context: { final_pr: "https://github.com/u/r/pull/99" },
    });
    assert.ok(prompt.includes("https://github.com/u/r/pull/99"));
  });

  it("buildPrompt default PREFLIGHT notice when analysis not run", () => {
    const prompt = verifyModule.buildPrompt({ runId: "r1", task: "t", context: {} });
    assert.ok(prompt.includes("(no pre-flight run)"));
  });

  it("source prompt keeps verify as a gatekeeper instead of a fixer", () => {
    assert.ok(verifyPromptSource.includes("does not fix code"));
    assert.ok(verifyPromptSource.includes("git commit"));
    assert.ok(verifyPromptSource.includes("git push"));
    assert.ok(verifyPromptSource.includes("STATUS: retry"));
    assert.ok(verifyPromptSource.includes("STATUS: done` is allowed only after the PR is actually `MERGED`"));
    assert.ok(verifyPromptSource.includes("Do not dismiss them as \"pre-existing\""));
    assert.ok(verifyPromptSource.includes("current-main runtime/smoke evidence is clean"));
    assert.ok(verifyPromptSource.includes("8 minutes"));
    assert.ok(verifyPromptSource.includes("VERIFY_INFRA_PR_URL_MISSING"));
    assert.ok(verifyPromptSource.includes("Setfarm must create/reuse the story PR before reviewer runs"));
    assert.ok(verifyPromptSource.includes("Bounded Manager Protocol"));
    assert.ok(verifyPromptSource.includes("Verify is an evidence gate"));
    assert.ok(verifyPromptSource.includes("Build/test/smoke verification before source review"));
    assert.ok(verifyPromptSource.includes("inspect only files changed by the PR"));
    assert.ok(verifyPromptSource.includes("VERIFY_WORKDIR"));
    assert.ok(verifyPromptSource.includes("STORY_WORKDIR"));
    assert.ok(verifyPromptSource.includes("VERIFY_WORKDIR_BRANCH_MISMATCH"));
    assert.ok(verifyPromptSource.includes("Do not check out the story branch inside"));
    assert.ok(verifyPromptSource.includes("Do not run long-lived servers in the foreground"));
    assert.ok(verifyPromptSource.includes("Never execute"));
    assert.ok(verifyPromptSource.includes("npm run dev"));
    assert.ok(verifyPromptSource.includes("Writing ad hoc Playwright/Puppeteer/browser scripts"));
    assert.ok(verifyPromptSource.includes("If `PLAYWRIGHT_REPORT` is present and failing"));
    assert.ok(verifyPromptSource.includes("Do not run Python Playwright"));
    assert.ok(verifyPromptSource.includes("dead_control"));
    assert.ok(verifyPromptSource.includes("Negative evidence finalization"));
    assert.ok(verifyPromptSource.includes("one focused source search and one narrower confirmation search"));
    assert.ok(verifyPromptSource.includes("programmatic `window.app` or test-bridge actions are not a"));
  });

  it("buildPrompt stays within maxPromptSize for typical context", () => {
    const prompt = verifyModule.buildPrompt({
      runId: "r1",
      task: "t",
      context: {
        repo: "$HOME/projects/app",
        branch: "feature-app",
        preflight_analysis: "ESLint: 0 errors, 2 warnings\nTSC: clean\n5 files changed",
        stories_json: JSON.stringify(Array.from({ length: 5 }, (_, i) => ({
          id: `US-00${i + 1}`,
          title: `Story ${i + 1}`,
          description: "lorem ipsum ".repeat(20),
        }))),
      },
    });
    assert.ok(
      Buffer.byteLength(prompt, "utf-8") < verifyModule.maxPromptSize,
      `prompt ${Buffer.byteLength(prompt, "utf-8")} >= budget ${verifyModule.maxPromptSize}`
    );
  });

  it("validateOutput rejects missing STATUS", () => {
    const r = validateOutput({} as ParsedOutput);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes("STATUS")));
  });

  it("validateOutput accepts STATUS: done", () => {
    assert.equal(validateOutput({ status: "done" } as ParsedOutput).ok, true);
  });

  it("validateOutput accepts STATUS: skip", () => {
    assert.equal(validateOutput({ status: "skip" } as ParsedOutput).ok, true);
  });

  it("validateOutput accepts STATUS: retry without extra fields (retry handled upstream in step-ops)", () => {
    // Note: step-ops.ts early-returns on STATUS: retry before module delegation,
    // so module.validateOutput() never runs for retry. We accept it here for
    // API symmetry and unit-test clarity; enforcement lives upstream.
    assert.equal(validateOutput({ status: "retry" } as ParsedOutput).ok, true);
    assert.equal(validateOutput({ status: "retry", feedback: "x" } as ParsedOutput).ok, true);
  });

  it("validateOutput rejects unknown STATUS values", () => {
    const r = validateOutput({ status: "ok" } as ParsedOutput);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes("Unknown STATUS")));
  });

  it("normalize trims + lowercases + extracts first word from STATUS", () => {
    const parsed = { status: "DONE\n\nExtra narrative" } as ParsedOutput;
    normalize(parsed);
    assert.equal(parsed["status"], "done");
  });

  it("normalize leaves STATUS untouched when absent", () => {
    const parsed = { feedback: "x" } as ParsedOutput;
    normalize(parsed);
    assert.equal(parsed["status"], undefined);
  });

  it("retry issue resolution prefers current FEEDBACK over stale context issues", () => {
    const issues = resolveVerifyRetryIssues(
      {
        status: "retry",
        feedback: "- PR #3 has an unresolved current review comment.",
      },
      {
        issues: "none",
        previous_failure: "none",
      },
      "STATUS: retry\nFEEDBACK:\n- PR #3 has an unresolved current review comment.",
    );

    assert.match(issues, /STATUS: retry/);
    assert.match(issues, /PR #3 has an unresolved current review comment/);
    assert.doesNotMatch(issues, /^none$/i);
  });

  it("does not block on resolved or outdated inline review threads", () => {
    const state: PrState = {
      state: "OPEN",
      checksStatus: "passing",
      mergeable: "MERGEABLE",
      mergeStateStatus: "CLEAN",
      comments: [
        {
          id: "review-1",
          kind: "review",
          state: "COMMENTED",
          author: "gemini-code-assist",
          body: "## Code Review\n\nSummary of findings already handled in inline threads.",
          createdAt: "2026-05-18T00:31:27Z",
        },
        {
          id: "resolved-inline",
          kind: "review-comment",
          author: "gemini-code-assist",
          body: "Add touch-action: none to the game road.",
          createdAt: "2026-05-18T00:31:28Z",
          path: "src/App.css",
          line: 65,
          originalLine: 64,
          threadResolved: true,
          outdated: false,
        },
        {
          id: "outdated-inline",
          threadId: "PRRT_outdated",
          kind: "review-comment",
          author: "gemini-code-assist",
          body: "Previous code path had stale score accumulation.",
          createdAt: "2026-05-18T00:31:28Z",
          path: "src/hooks/useAppState.ts",
          originalLine: 92,
          threadOutdated: true,
          outdated: true,
        },
      ],
    };
    const formatted = formatPrCommentsForAgent(state);

    assert.equal(formatted, "");
    assert.deepEqual(getResolvableHistoricalInlineReviewThreadIds(state), ["PRRT_outdated"]);
  });

  it("still blocks current inline review comments and changes-requested reviews", () => {
    const formatted = formatPrCommentsForAgent({
      state: "OPEN",
      checksStatus: "passing",
      mergeable: "MERGEABLE",
      mergeStateStatus: "CLEAN",
      comments: [
        {
          id: "current-inline",
          threadId: "PRRT_current",
          kind: "review-comment",
          author: "reviewer",
          body: "The pause button still mutates gameplay state.",
          createdAt: "2026-05-18T00:31:28Z",
          path: "src/App.tsx",
          line: 120,
          originalLine: 120,
          threadResolved: false,
          outdated: false,
        },
        {
          id: "changes-requested",
          kind: "review",
          state: "CHANGES_REQUESTED",
          author: "reviewer",
          body: "Please fix the blocking runtime state issue before merge.",
          createdAt: "2026-05-18T00:31:27Z",
        },
      ],
    });

    assert.match(formatted, /2 actionable/);
    assert.match(formatted, /thread=PRRT_current/);
    assert.match(formatted, /src\/App\.tsx:120|pause button/);
    assert.match(formatted, /CHANGES_REQUESTED/);
    assert.match(formatted, /must not resolve current actionable review threads/);
    assert.doesNotMatch(formatted, /Setfarm will resolve current inline review threads/);
  });

  it("blocks actionable COMMENTED review summaries but ignores service lifecycle banners", () => {
    const formatted = formatPrCommentsForAgent({
      state: "OPEN",
      headOid: "head-1",
      checksStatus: "passing",
      mergeable: "MERGEABLE",
      mergeStateStatus: "CLEAN",
      comments: [
        {
          id: "gemini-review",
          kind: "review",
          state: "COMMENTED",
          author: "gemini-code-assist",
          body: [
            "## Code Review",
            "",
            "The review feedback highlights a critical logic issue in actStartGame where starting the game destructively restarts progress when paused or in settings, rather than resuming or closing menus.",
            "",
            "> [!IMPORTANT]",
            "> The consumer version of Gemini Code Assist on GitHub is being sunset.",
            "> Starting June 18, 2026, new organization installations will be blocked.",
          ].join("\n"),
          commitOid: "head-1",
          createdAt: "2026-06-06T13:11:22Z",
        },
        {
          id: "gemini-banner-only",
          kind: "review",
          state: "COMMENTED",
          author: "gemini-code-assist",
          body: "The consumer version of Gemini Code Assist on GitHub is being sunset. New review activity will officially cease.",
          createdAt: "2026-06-06T13:11:23Z",
        },
      ],
    });

    assert.match(formatted, /1 actionable/);
    assert.match(formatted, /critical logic issue/);
    assert.doesNotMatch(formatted, /banner-only/);
  });

  it("ignores Gemini COMMENTED digest summaries after inline feedback is resolved", () => {
    const digest = formatPrCommentsForAgent({
      state: "OPEN",
      headOid: "head-1",
      headCommittedAt: "2026-06-21T13:13:28Z",
      checksStatus: "passing",
      mergeable: "MERGEABLE",
      mergeStateStatus: "CLEAN",
      comments: [
        {
          id: "gemini-review-digest",
          kind: "review",
          state: "COMMENTED",
          author: "gemini-code-assist",
          body: [
            "## Code Review",
            "",
            "This pull request transitions the application from a static HTML page to a dynamic, state-managed counter application. The feedback focuses on enhancing security and robustness: escaping counter IDs and colors to prevent DOM-based XSS, removing a redundant polling mechanism, and adding defensive checks in the state module.",
            "",
            "> [!IMPORTANT]",
            "> The consumer version of Gemini Code Assist on GitHub is being sunset.",
          ].join("\n"),
          commitOid: "head-1",
          createdAt: "2026-06-21T13:15:08Z",
        },
      ],
    });
    const actionable = formatPrCommentsForAgent({
      state: "OPEN",
      headOid: "head-1",
      headCommittedAt: "2026-06-21T13:13:28Z",
      checksStatus: "passing",
      mergeable: "MERGEABLE",
      mergeStateStatus: "CLEAN",
      comments: [
        {
          id: "review-actionable",
          kind: "review",
          state: "COMMENTED",
          author: "reviewer",
          body: "Please fix the persistence bug before merge; the reset button currently fails after reload.",
          commitOid: "head-1",
          createdAt: "2026-06-21T13:15:08Z",
        },
      ],
    });

    assert.equal(digest, "");
    assert.match(actionable, /Please fix the persistence bug/);
  });

  it("does not re-block stale COMMENTED review summaries after a newer head commit", () => {
    const body = [
      "## Code Review",
      "",
      "The review feedback highlights a critical logic issue where keyboard controls are missing and preferences are saved incorrectly.",
    ].join("\n");

    const stale = formatPrCommentsForAgent({
      state: "OPEN",
      headOid: "new-head",
      headCommittedAt: "2026-06-06T13:47:33Z",
      checksStatus: "passing",
      mergeable: "MERGEABLE",
      mergeStateStatus: "CLEAN",
      comments: [
        {
          id: "old-gemini-review",
          kind: "review",
          state: "COMMENTED",
          author: "gemini-code-assist",
          body,
          commitOid: "old-head",
          createdAt: "2026-06-06T13:43:50Z",
        },
      ],
    });
    assert.equal(stale, "");

    const current = formatPrCommentsForAgent({
      state: "OPEN",
      headOid: "new-head",
      headCommittedAt: "2026-06-06T13:47:33Z",
      checksStatus: "passing",
      mergeable: "MERGEABLE",
      mergeStateStatus: "CLEAN",
      comments: [
        {
          id: "current-gemini-review",
          kind: "review",
          state: "COMMENTED",
          author: "gemini-code-assist",
          body,
          commitOid: "new-head",
          createdAt: "2026-06-06T13:48:00Z",
        },
      ],
    });
    assert.match(current, /1 actionable/);
    assert.match(current, /keyboard controls are missing/);
  });

  it("preserves actionable PR review details and code fences for implement retry context", () => {
    const longLeadIn = "Context ".repeat(90);
    const formatted = formatPrCommentsForAgent({
      state: "OPEN",
      checksStatus: "passing",
      mergeable: "MERGEABLE",
      mergeStateStatus: "CLEAN",
      comments: [
        {
          id: "delta-inline",
          threadId: "PRRT_delta",
          kind: "review-comment",
          author: "reviewer",
          body: [
            longLeadIn,
            "The animation delta is unbounded after tab restore. Clamp the delta to 100ms before dispatching TICK.",
            "",
            "```suggestion",
            "const delta = Math.min(now - lastTime, 100);",
            "lastTime = now;",
            "dispatch({ type: \"TICK\", delta });",
            "```",
          ].join("\n"),
          createdAt: "2026-06-06T09:31:28Z",
          path: "src/game/game-runtime.ts",
          line: 255,
          originalLine: 255,
          threadResolved: false,
          outdated: false,
        },
      ],
    });

    assert.match(formatted, /thread=PRRT_delta/);
    assert.match(formatted, /src\/game\/game-runtime\.ts:255/);
    assert.match(formatted, /Clamp the delta to 100ms/);
    assert.match(formatted, /```suggestion/);
    assert.match(formatted, /const delta = Math\.min\(now - lastTime, 100\);/);
    assert.match(formatted, /Do not output STATUS: done until every listed thread/);
    assert.doesNotMatch(formatted, /```s\s*$/);
  });

  it("does not truncate realistic long actionable review code before the fix body ends", () => {
    const longCollisionFix = [
      "![critical](https://www.gstatic.com/codereviewagent/critical.svg)",
      "",
      "The current collision detection logic does not remove obstacles or shards from the active lists once they collide with the player.",
      "Filtering out collided obstacles and shards from the active arrays on collision resolves this issue.",
      "",
      "```typescript",
      "      // Collision detection",
      "      let lives = current.lives;",
      "      let energy = current.energy;",
      "      let score = current.score;",
      "      let gameOver: boolean = current.gameOver;",
      "",
      "      const remainingObstacles: Obstacle[] = [];",
      "      let collided = false;",
      "      for (const obs of newObstacles) {",
      "        if (obs.lane === current.playerLane && obs.position >= current.playerPosition - 5 && obs.position <= current.playerPosition + 5) {",
      "          collided = true;",
      "        } else {",
      "          remainingObstacles.push(obs);",
      "        }",
      "      }",
      "",
      "      if (collided) {",
      "        lives -= 1;",
      "        energy = Math.max(0, energy - 20);",
      "        if (lives <= 0) {",
      "          gameOver = true;",
      "        }",
      "        newObstacles = remainingObstacles;",
      "      }",
      "",
      "      const remainingShards: Shard[] = [];",
      "      for (const shard of newShards) {",
      "        if (shard.lane === current.playerLane && shard.position >= current.playerPosition - 5 && shard.position <= current.playerPosition + 5) {",
      "          score += 10;",
      "          energy = Math.min(MAX_ENERGY, energy + 10);",
      "        } else {",
      "          remainingShards.push(shard);",
      "        }",
      "      }",
      "      newShards = remainingShards;",
      "```",
    ].join("\n");

    const formatted = formatPrCommentsForAgent({
      state: "OPEN",
      checksStatus: "passing",
      mergeable: "MERGEABLE",
      mergeStateStatus: "CLEAN",
      comments: [
        {
          id: "collision-inline",
          threadId: "PRRT_collision",
          kind: "review-comment",
          author: "gemini-code-assist",
          body: longCollisionFix,
          createdAt: "2026-06-06T11:00:00Z",
          path: "src/features/game.store.ts",
          line: 174,
          originalLine: 174,
          threadResolved: false,
          outdated: false,
        },
      ],
    });

    assert.match(formatted, /thread=PRRT_collision/);
    assert.match(formatted, /remainingShards\.push\(shard\)/);
    assert.match(formatted, /newShards = remainingShards/);
    assert.doesNotMatch(formatted, /comment truncated after/);
  });

  it("marks current inline review threads as mechanically satisfied only when suggestion semantics are present", () => {
    const comment = {
      id: "current-inline",
      threadId: "PRRT_current",
      kind: "review-comment" as const,
      author: "reviewer",
      body: [
        "This renders a hardcoded list. Use runtime state instead.",
        "",
        "```suggestion",
        "{Array.from({ length: runtime?.lives ?? 3 }).map((_, i) => (",
        "  <Heart key={i} />",
        "))}",
        "```",
      ].join("\n"),
      createdAt: "2026-05-18T00:31:28Z",
      path: "src/screens/Gameplay.tsx",
      line: 120,
      originalLine: 120,
      threadResolved: false,
      outdated: false,
    };

    assert.equal(
      commentLooksMechanicallySatisfied(
        comment,
        "export function View({ runtime }) { return <>{Array.from({ length: runtime?.lives ?? 3 }).map((_, i) => <Heart key={i} />)}</>; }",
      ),
      true,
    );
    assert.equal(commentLooksMechanicallySatisfied(comment, "<Heart /><Heart /><Heart />"), false);
  });

  it("marks current inline review threads as mechanically satisfied from fenced code blocks", () => {
    const comment = {
      id: "current-inline",
      threadId: "PRRT_obstacle",
      kind: "review-comment" as const,
      author: "reviewer",
      body: [
        "Filter out the collided obstacle from the array.",
        "",
        "```typescript",
        "const remainingObstacles: Obstacle[] = [];",
        "for (const o of obstacles) {",
        "  if (o.lane === state.playerLane) {",
        "    lives -= 1;",
        "  } else {",
        "    remainingObstacles.push(o);",
        "  }",
        "}",
        "obstacles = remainingObstacles;",
        "```",
      ].join("\n"),
      createdAt: "2026-06-06T09:06:17Z",
      path: "src/game/game-runtime.ts",
      line: 159,
      originalLine: 155,
      threadResolved: false,
      outdated: false,
    };

    assert.equal(
      commentLooksMechanicallySatisfied(
        comment,
        "function reduce() { const remainingObstacles: Obstacle[] = []; for (const o of obstacles) { if (o.lane === state.playerLane) { lives -= 1; } else { remainingObstacles.push(o); } } obstacles = remainingObstacles; }",
      ),
      true,
    );
  });

  it("marks delta clamp and animation lifecycle review comments as mechanically satisfied from source evidence", () => {
    const deltaComment = {
      id: "delta-inline",
      threadId: "PRRT_delta",
      kind: "review-comment" as const,
      author: "reviewer",
      body: "Clamp the delta to a maximum value (e.g., 100ms) to ensure physics updates remain stable.",
      createdAt: "2026-06-06T09:06:17Z",
      path: "src/game/game-runtime.ts",
      line: 255,
      originalLine: 242,
      threadResolved: false,
      outdated: false,
    };
    const lifecycleComment = {
      id: "loop-inline",
      threadId: "PRRT_loop",
      kind: "review-comment" as const,
      author: "reviewer",
      body: "The requestAnimationFrame loop continues while paused or gameOver. Manage lifecycle from dispatch.",
      createdAt: "2026-06-06T09:06:17Z",
      path: "src/game/game-runtime.ts",
      line: 243,
      originalLine: 234,
      threadResolved: false,
      outdated: false,
    };

    assert.equal(
      commentLooksMechanicallySatisfied(
        deltaComment,
        "const clampedDelta = Math.min(action.delta, 100); const advance = clampedDelta * speed;",
      ),
      true,
    );
    assert.equal(
      commentLooksMechanicallySatisfied(
        lifecycleComment,
        "if (state.started && !state.paused && !state.gameOver && handle === null) { handle = requestAnimationFrame(tick); } else { handle = null; }",
      ),
      true,
    );
    assert.equal(commentLooksMechanicallySatisfied(deltaComment, "const delta = now - lastTime;"), false);
  });

  it("marks DOM XSS innerHTML review comments as mechanically satisfied by safe DOM construction", () => {
    const xssComment = {
      id: "xss-inline",
      threadId: "PRRT_xss",
      kind: "review-comment" as const,
      author: "reviewer",
      body: [
        "The `counter.id` and `counter.color` values are inserted directly into the `innerHTML` string without escaping.",
        "Since these values can be loaded from `localStorage` (which is user-controlled), this introduces a potential DOM-based Cross-Site Scripting (XSS) vulnerability and attribute breakout risk.",
      ].join("\n"),
      createdAt: "2026-06-21T12:00:00Z",
      path: "assets/js/app.js",
      line: 64,
      originalLine: 64,
      threadResolved: false,
      outdated: false,
    };
    const fixedSource = `
      const allowedColors = new Set(['blue', 'amber', 'emerald']);
      function renderCounter(counter) {
        const article = document.createElement('article');
        const safeId = String(counter.id || '');
        const safeColor = allowedColors.has(counter.color) ? counter.color : 'blue';
        article.className = 'counter-card';
        article.classList.add('counter-card--' + safeColor);
        article.setAttribute('data-counter-id', safeId);
        const label = document.createElement('span');
        label.textContent = String(counter.label || '');
        const add = document.createElement('button');
        add.setAttribute('data-counter-id', safeId);
        add.textContent = 'Add';
        article.append(label, add);
        return article;
      }
    `;

    assert.equal(commentLooksMechanicallySatisfied(xssComment, fixedSource), true);
    assert.equal(
      commentLooksMechanicallySatisfied(
        xssComment,
        "function renderCounter(counter) { card.innerHTML = '<button data-counter-id=\"' + counter.id + '\">Add</button>'; }",
      ),
      false,
    );
    assert.equal(
      commentLooksMechanicallySatisfied(
        xssComment,
        "function renderCounter(counter) { const el = document.createElement('article'); el.setAttribute('data-counter-id', counter.id); return el; }",
      ),
      false,
    );
  });

  it("marks CSV all-cell escaping review comments as mechanically satisfied from source evidence", () => {
    const csvComment = {
      id: "csv-inline",
      threadId: "PRRT_csv",
      kind: "review-comment" as const,
      author: "gemini-code-assist",
      body: [
        "Currently, only `item.name` is escaped for CSV output. If other fields such as `item.category` or `item.sku` contain commas, double quotes, or newlines, the generated CSV file will be malformed.",
        "Using a dedicated helper function to escape all CSV cells ensures the output is always valid RFC 4180 compliant CSV.",
      ].join("\n"),
      createdAt: "2026-06-26T12:35:18Z",
      path: "assets/js/us-003/act_export_summary.js",
      line: 111,
      originalLine: 111,
      threadResolved: false,
      outdated: false,
    };

    const fixedSource = `
      function toCsv(summary) {
        function escapeCell(val) {
          var str = val === null || val === undefined ? '' : String(val);
          if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\\n') !== -1 || str.indexOf('\\r') !== -1) {
            return '"' + str.replace(/"/g, '""') + '"';
          }
          return str;
        }
        function row(cells) {
          return cells.map(escapeCell).join(',');
        }
        var lines = [];
        lines.push(row(['Top Category', summary.metrics.topCategory]));
        summary.items.forEach(function (item) {
          lines.push(row([item.id, item.name, item.sku, item.category, item.status]));
        });
        return lines.join('\\n');
      }
    `;
    const partialSource = `
      function toCsv(summary) {
        function escapeCell(val) { return '"' + String(val).replace(/"/g, '""') + '"'; }
        var lines = [];
        summary.items.forEach(function (item) {
          lines.push([item.id, escapeCell(item.name), item.sku, item.category, item.status].join(','));
        });
        return lines.join('\\n');
      }
    `;

    assert.equal(commentLooksMechanicallySatisfied(csvComment, fixedSource), true);
    assert.equal(commentLooksMechanicallySatisfied(csvComment, partialSource), false);
  });

  it("marks selector ref subscriptions and raf throttle review comments as mechanically satisfied from source evidence", () => {
    const selectorComment = {
      id: "selector-inline",
      threadId: "PRRT_selector",
      kind: "review-comment" as const,
      author: "reviewer",
      body: "In `useGameSelector`, the `selector` function is passed directly as a dependency to `useEffect`. Inline arrow selectors cause resubscribe churn. Use a mutable ref to store the latest selector and subscribe once.",
      createdAt: "2026-06-06T09:06:17Z",
      path: "src/App.tsx",
      line: 26,
      originalLine: 26,
      threadResolved: false,
      outdated: false,
    };
    const rafComment = {
      id: "raf-inline",
      threadId: "PRRT_raf",
      kind: "review-comment" as const,
      author: "reviewer",
      body: "The game loop currently triggers a tick on every frame of `requestAnimationFrame`. Because requestAnimationFrame follows display refresh rate, throttle to a target frame rate such as 60 FPS.",
      createdAt: "2026-06-06T09:06:17Z",
      path: "src/game/game-runtime.ts",
      line: 26,
      originalLine: 26,
      threadResolved: false,
      outdated: false,
    };

    assert.equal(
      commentLooksMechanicallySatisfied(
        selectorComment,
        "function useGameSelector<T>(selector: (s: GameState) => T): T { const selectorRef = useRef(selector); selectorRef.current = selector; useEffect(() => { const update = () => setValue(selectorRef.current(getGameStore() as unknown as GameState)); const unsub = subscribe(update); return () => { unsub(); }; }, []); return value; }",
      ),
      true,
    );
    assert.equal(
      commentLooksMechanicallySatisfied(
        rafComment,
        "export function startGameRuntime() { let lastTime = performance.now(); const interval = 1000 / 60; const tick = (now: number) => { const elapsed = now - lastTime; if (elapsed >= interval) { lastTime = now - (elapsed % interval); getGameStore().tick(); } runtimeHandle = requestAnimationFrame(tick); }; runtimeHandle = requestAnimationFrame(tick); }",
      ),
      true,
    );
    assert.equal(
      commentLooksMechanicallySatisfied(
        rafComment,
        "export function startGameRuntime() { const tick = () => { getGameStore().tick(); requestAnimationFrame(tick); }; requestAnimationFrame(tick); }",
      ),
      false,
    );
  });

  it("marks game-over restart reducer review comments as mechanically satisfied from source evidence", () => {
    const restartComment = {
      id: "restart-inline",
      threadId: "PRRT_restart",
      kind: "review-comment" as const,
      author: "reviewer",
      body: "When the game is over and the user clicks 'Initiate Sequence', INITIATE_SEQUENCE only clears gameOver. It should reset the gameplay state when state.gameOver is true.",
      createdAt: "2026-06-06T13:43:50Z",
      path: "src/features/game/game.store.ts",
      line: 236,
      originalLine: 220,
      threadResolved: false,
      outdated: false,
    };

    assert.equal(
      commentLooksMechanicallySatisfied(
        restartComment,
        `
        export function gameReducer(state: GameState, action: GameAction): GameState {
          switch (action.type) {
            case 'INITIATE_SEQUENCE': {
              if (state.gameOver) {
                return {
                  ...createInitialState(),
                  highScore: state.highScore,
                  difficulty: state.difficulty,
                  screen: 'gameplay',
                  storageStatus: state.storageStatus,
                  paused: false,
                  gameOver: false,
                };
              }
              return { ...state, screen: 'gameplay', paused: false, gameOver: false };
            }
          }
        }`,
      ),
      true,
    );
    assert.equal(
      commentLooksMechanicallySatisfied(
        restartComment,
        "case 'INITIATE_SEQUENCE': { return { ...state, screen: 'gameplay', paused: false, gameOver: false }; }",
      ),
      false,
    );
  });

  it("marks persisted state type guard review comments as mechanically satisfied from source evidence", () => {
    const typeGuardComment = {
      id: "persisted-state-inline",
      threadId: "PRRT_persisted_state",
      kind: "review-comment" as const,
      author: "reviewer",
      body: "The `isPersistedState` type guard is too loose. It only checks if `records` is an array and `settings` is an object. Validate internal record properties and settings.pollingInterval to prevent runtime errors like NaN.",
      createdAt: "2026-06-15T08:45:48Z",
      path: "src/features/example/example.repo.ts",
      line: 70,
      originalLine: 33,
      threadResolved: false,
      outdated: false,
    };

    assert.equal(
      commentLooksMechanicallySatisfied(
        typeGuardComment,
        `
        function isRetryRecord(value: unknown): value is RetryRecord {
          if (typeof value !== 'object' || value === null) return false;
          const record = value as Record<string, unknown>;
          return typeof record.id === 'string' &&
            typeof record.name === 'string' &&
            typeof record.status === 'string' &&
            typeof record.retryAt === 'number' &&
            Number.isFinite(record.retryAt);
        }

        function isRetrySettings(value: unknown): value is RetrySettings {
          if (typeof value !== 'object' || value === null) return false;
          const settings = value as Record<string, unknown>;
          return typeof settings.autoRetry === 'boolean' &&
            typeof settings.darkMode === 'boolean' &&
            typeof settings.pollingInterval === 'number' &&
            Number.isFinite(settings.pollingInterval);
        }

        function isPersistedState(value: unknown): value is PersistedState {
          if (typeof value !== 'object' || value === null) return false;
          const candidate = value as Record<string, unknown>;
          return Array.isArray(candidate.records) &&
            candidate.records.every(isRetryRecord) &&
            isRetrySettings(candidate.settings);
        }`,
      ),
      true,
    );
    assert.equal(
      commentLooksMechanicallySatisfied(
        typeGuardComment,
        "function isPersistedState(value: any) { return Array.isArray(value.records) && typeof value.settings === 'object'; }",
      ),
      false,
    );
  });

  it("marks plain DOM focus restoration review comments as mechanically satisfied from source evidence", () => {
    const focusComment = {
      id: "dom-focus-inline",
      threadId: "PRRT_dom_focus",
      kind: "review-comment" as const,
      author: "reviewer",
      body: "The current render clears the DOM and loses focus/cursor position on every re-render. Preserve the focused input by data-action-id and restore the text selection after rendering.",
      createdAt: "2026-06-18T08:45:48Z",
      path: "assets/js/app.js",
      line: 154,
      originalLine: 154,
      threadResolved: false,
      outdated: false,
    };

    const fixedSource = `
      function render() {
        var activeEl = document.activeElement;
        var activeId = activeEl && typeof activeEl.getAttribute === 'function'
          ? activeEl.getAttribute('data-action-id')
          : null;
        var selectionStart = null;
        var selectionEnd = null;
        if (activeEl && activeEl.tagName === 'INPUT') {
          selectionStart = activeEl.selectionStart;
          selectionEnd = activeEl.selectionEnd;
        }
        root.innerHTML = '';
        renderSurface();
        if (activeId) {
          var elementToFocus = root.querySelector("[data-action-id='" + activeId + "']");
          if (elementToFocus) {
            elementToFocus.focus();
            elementToFocus.setSelectionRange(selectionStart, selectionEnd);
          }
        }
      }`;

    assert.equal(commentLooksMechanicallySatisfied(focusComment, fixedSource), true);
    assert.equal(commentLooksMechanicallySatisfied(focusComment, "function render() { root.innerHTML = ''; renderSurface(); }"), false);
  });

  it("marks missing input field review comments as mechanically satisfied from current HTML source", () => {
    const inputComment = {
      id: "input-inline",
      threadId: "PRRT_input",
      kind: "review-comment" as const,
      author: "reviewer",
      body: "The `Record Editor` form is missing the `Add tag and press Enter` input field specified in the UI contract. Currently, the values array is hardcoded to `[]` in `app.js`.",
      createdAt: "2026-06-18T08:45:48Z",
      path: "index.html",
      line: 81,
      originalLine: 81,
      threadResolved: false,
      outdated: false,
    };

    const fixedHtml = `
      <form id="record-editor">
        <label>
          Tags
          <input
            type="text"
            id="draft-tags"
            data-action-id="ACT_ADD_TAG"
            placeholder="Add tag and press Enter"
            aria-label="Add tag and press Enter"
          />
        </label>
      </form>`;

    assert.equal(commentLooksMechanicallySatisfied(inputComment, fixedHtml), true);
    assert.equal(
      commentLooksMechanicallySatisfied(inputComment, '<form><input type="text" placeholder="Different field" /></form>'),
      false,
    );
  });

  it("marks defensive DOM search filter review comments as mechanically satisfied from source evidence", () => {
    const defensiveFilterComment = {
      id: "dom-filter-inline",
      threadId: "PRRT_dom_filter",
      kind: "review-comment" as const,
      author: "reviewer",
      body: "Filtering assumes every record has well-formed name and id strings. Guard against null, undefined, or malformed records before calling toLowerCase().",
      createdAt: "2026-06-18T08:45:48Z",
      path: "assets/js/app.js",
      line: 212,
      originalLine: 212,
      threadResolved: false,
      outdated: false,
    };

    const fixedSource = `
      var filtered = state.records.filter(function (r) {
        var name = r && r.name ? String(r.name).toLowerCase() : '';
        var id = r && r.id ? String(r.id).toLowerCase() : '';
        return !query || name.indexOf(query) !== -1 || id.indexOf(query) !== -1;
      });`;

    assert.equal(commentLooksMechanicallySatisfied(defensiveFilterComment, fixedSource), true);
    assert.equal(
      commentLooksMechanicallySatisfied(
        defensiveFilterComment,
        "var filtered = state.records.filter(function (r) { return r.name.toLowerCase().includes(query) || r.id.toLowerCase().includes(query); });",
      ),
      false,
    );
  });

  it("marks React debounced search review comments as mechanically satisfied from source evidence", () => {
    const importComment = {
      id: "react-import-inline",
      threadId: "PRRT_react_import",
      kind: "review-comment" as const,
      author: "gemini-code-assist",
      body: [
        "To implement a debounced search input and avoid performance lag, we need to import `useState` and `useEffect` from React.",
        "",
        "```",
        "import { useState, useEffect } from 'react';",
        "```",
      ].join("\n"),
      createdAt: "2026-06-15T08:45:48Z",
      path: "src/screens/RecordOperations.tsx",
      line: 13,
      originalLine: 13,
      threadResolved: false,
      outdated: false,
    };
    const debounceComment = {
      id: "react-debounce-inline",
      threadId: "PRRT_react_debounce",
      kind: "review-comment" as const,
      author: "gemini-code-assist",
      body: [
        "To prevent keystroke latency and unnecessary full-app re-renders on every keystroke, introduce a local state for the search query and debounce the propagation to the global store.",
        "",
        "```",
        "const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);",
        "useEffect(() => { setLocalSearchQuery(searchQuery); }, [searchQuery]);",
        "useEffect(() => { const timer = setTimeout(() => { actions?.[\"search-records\"]?.(localSearchQuery); }, 300); return () => clearTimeout(timer); }, [localSearchQuery, searchQuery, actions]);",
        "```",
      ].join("\n"),
      createdAt: "2026-06-15T08:45:48Z",
      path: "src/screens/RecordOperations.tsx",
      line: 23,
      originalLine: 23,
      threadResolved: false,
      outdated: false,
    };
    const fixedSource = `
      import { Search } from 'lucide-react';
      import { useState, useEffect } from "react";

      export function RecordOperations({ actions, searchQuery = "" }) {
        const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

        useEffect(() => {
          setLocalSearchQuery(searchQuery);
        }, [searchQuery]);

        useEffect(() => {
          const timer = window.setTimeout(() => {
            if (localSearchQuery !== searchQuery) {
              actions?.["search-records"]?.(localSearchQuery);
            }
          }, 300);
          return () => window.clearTimeout(timer);
        }, [localSearchQuery, searchQuery, actions]);

        return <input value={localSearchQuery} onChange={(event) => setLocalSearchQuery(event.target.value)} />;
      }
    `;

    assert.equal(commentLooksMechanicallySatisfied(importComment, fixedSource), true);
    assert.equal(commentLooksMechanicallySatisfied(debounceComment, fixedSource), true);
    assert.equal(commentLooksMechanicallySatisfied(debounceComment, "const query = event.target.value;"), false);
  });

  it("marks React external-store and supported-action review comments as mechanically satisfied from source evidence", () => {
    const externalStoreComment = {
      id: "external-store-inline",
      threadId: "PRRT_external_store",
      kind: "review-comment" as const,
      author: "gemini-code-assist",
      body: [
        "Use `useSyncExternalStore` to subscribe to the external store. This prevents state tearing and simplifies the hook implementation.",
        "",
        "```",
        "export function useRetrySignalStore() {",
        "  const state = useSyncExternalStore(",
        "    retrySignalStore.subscribe,",
        "    () => retrySignalStore.state",
        "  );",
        "  return { state, dispatch: retrySignalStore.dispatch };",
        "}",
        "```",
      ].join("\n"),
      createdAt: "2026-06-15T12:48:38Z",
      path: "src/features/app.store.tsx",
      line: 73,
      originalLine: 73,
      threadResolved: false,
      outdated: false,
    };
    const supportedActionComment = {
      id: "supported-actions-inline",
      threadId: "PRRT_supported_actions",
      kind: "review-comment" as const,
      author: "gemini-code-assist",
      body: [
        "Optimizing `createActions` to only assign handlers for supported action IDs. This avoids allocating unnecessary closures for unhandled actions and allows screen components to correctly detect if an action is supported.",
        "",
        "```",
        "function createActions<T extends string>(",
        "  ids: readonly T[],",
        "): Partial<Record<T, () => void>> {",
        "  const actions = {} as Partial<Record<T, () => void>>;",
        "  for (const id of ids) {",
        "    switch (id as string) {",
        "      case 'open':",
        "        actions[id] = () => openPanel();",
        "        break;",
        "      default:",
        "        break;",
        "    }",
        "  }",
        "  return actions;",
        "}",
        "```",
      ].join("\n"),
      createdAt: "2026-06-15T12:48:38Z",
      path: "src/App.tsx",
      line: 165,
      originalLine: 165,
      threadResolved: false,
      outdated: false,
    };
    const fixedSource = `
      import { useSyncExternalStore } from "react";

      export function useRetrySignalStore() {
        const state = useSyncExternalStore(
          retrySignalStore.subscribe,
          () => retrySignalStore.state,
        );
        return { state, dispatch: retrySignalStore.dispatch };
      }

      function createActions<T extends string>(ids: readonly T[]): Partial<Record<T, () => void>> {
        const actions = {} as Partial<Record<T, () => void>>;
        for (const id of ids) {
          switch (id as string) {
            case "open":
              actions[id] = () => openPanel();
              break;
            case "reset":
              actions[id] = () => reset();
              break;
            default:
              break;
          }
        }
        return actions;
      }
    `;

    assert.equal(commentLooksMechanicallySatisfied(externalStoreComment, fixedSource), true);
    assert.equal(commentLooksMechanicallySatisfied(supportedActionComment, fixedSource), true);
    assert.equal(commentLooksMechanicallySatisfied(externalStoreComment, "const [state, setState] = useState(store.state);"), false);
    assert.equal(
      commentLooksMechanicallySatisfied(
        supportedActionComment,
        "function createActions(ids) { return Object.fromEntries(ids.map(id => [id, () => undefined])); }",
      ),
      false,
    );
  });

  it("marks base CSS class toggle review comments as mechanically satisfied from state-class source evidence", () => {
    const classToggleComment = {
      id: "css-class-toggle-inline",
      threadId: "PRRT_css_class_toggle",
      kind: "review-comment" as const,
      author: "gemini-code-assist",
      body: "The `showFeedback` function toggles the `error-banner` class on the `save-feedback` element based on `isError`. However, `error-banner` is the base styling class for the banner layout. Consider using a separate class like `error-state` for error-specific colors, or keep the base class always on.",
      createdAt: "2026-06-17T09:45:48Z",
      path: "assets/js/us-004/act_save_preferences.js",
      line: 65,
      originalLine: 65,
      threadResolved: false,
      outdated: false,
    };

    assert.equal(
      commentLooksMechanicallySatisfied(
        classToggleComment,
        `
        function showFeedback(message, isError) {
          const feedback = document.getElementById('save-feedback');
          feedback.textContent = message;
          feedback.classList.add('feedback-banner');
          feedback.classList.toggle('error-state', !!isError);
          feedback.classList.toggle('success-state', !isError);
          feedback.classList.remove('hidden');
        }`,
      ),
      true,
    );
    assert.equal(
      commentLooksMechanicallySatisfied(
        classToggleComment,
        "feedback.classList.toggle('error-banner', !!isError);",
      ),
      false,
    );
  });

  it("marks window.app cleanup and stable callback review comments as mechanically satisfied", () => {
    const getterCleanupComment = {
      id: "window-app-getters",
      threadId: "PRRT_window_getters",
      kind: "review-comment" as const,
      author: "gemini-code-assist",
      body: "The `useEffect` that defines getters on `window.app` does not clean them up when the component unmounts. Add a cleanup function to delete the defined properties from `window.app` on unmount.",
      createdAt: "2026-07-01T10:00:00Z",
      path: "src/features/run-probe/run-probe.store.tsx",
      line: 380,
      originalLine: 380,
      threadResolved: false,
      outdated: false,
    };
    const methodCleanupComment = {
      id: "window-app-methods",
      threadId: "PRRT_window_methods",
      kind: "review-comment" as const,
      author: "gemini-code-assist",
      body: "Clean Up Window App Methods on Unmount. Add a cleanup function to delete the action methods assigned to `window.app` when the component unmounts.",
      createdAt: "2026-07-01T10:00:00Z",
      path: "src/features/run-probe/run-probe.store.tsx",
      line: 403,
      originalLine: 403,
      threadResolved: false,
      outdated: false,
    };
    const stableCallbacksComment = {
      id: "stable-callbacks",
      threadId: "PRRT_stable_callbacks",
      kind: "review-comment" as const,
      author: "gemini-code-assist",
      body: "Unnecessary Callback Recreation. The `shell` object returned by `useRunProbeShell()` changes on every state update. Destructure the stable methods (`selectRecord`, `setActivePanel`) and only depend on the specific state values needed.",
      createdAt: "2026-07-01T10:00:00Z",
      path: "src/App.tsx",
      line: 70,
      originalLine: 70,
      threadResolved: false,
      outdated: false,
    };
    const fixedStoreSource = `
      useEffect(() => {
        if (typeof window === "undefined") return;
        const w = window as unknown as { app?: Record<string, unknown> };
        const app = (w.app ?? {}) as Record<string, unknown>;
        Object.defineProperty(app, "activeSurface", { configurable: true, get: () => stateRef.current.preferences.activeSurfaceId });
        Object.defineProperty(app, "activePanel", { configurable: true, get: () => stateRef.current.preferences.activePanel });
        w.app = app;
        return () => {
          const currentApp = w.app;
          if (!currentApp) return;
          delete currentApp.activeSurface;
          delete currentApp.activePanel;
          if (Object.keys(currentApp).length === 0) delete w.app;
        };
      }, []);

      useEffect(() => {
        if (typeof window === "undefined") return;
        const w = window as unknown as { app?: Record<string, unknown> };
        const app = (w.app ?? {}) as Record<string, unknown>;
        app.setActiveSurface = (id: string) => setActiveSurface(id);
        app.setActivePanel = (panel: string) => setActivePanel(panel);
        w.app = app;
        return () => {
          const currentApp = w.app;
          if (!currentApp) return;
          delete currentApp.setActiveSurface;
          delete currentApp.setActivePanel;
          if (Object.keys(currentApp).length === 0) delete w.app;
        };
      }, [setActiveSurface, setActivePanel]);
    `;
    const fixedAppSource = `
      function AppShell() {
        const shell = useRunProbeShell();
        const { setActiveSurface, setActivePanel, selectRecord, markRefreshed } = shell;
        const screenActions = useMemo(() => ({
          "refresh-1": () => markRefreshed(Date.now()),
          "settings-2": () => setActivePanel("settings"),
          "manual-refresh-3": () => selectRecord("probe-api"),
        }), [markRefreshed, selectRecord, setActivePanel, setActiveSurface]);
        return <div data-testid="setfarm-app-root" />;
      }
    `;
    const fixedCallbackSource = `
      function AppShell() {
        const { state, selectRecord, setActivePanel } = useRunProbeShell();
        const selectedRecordId = state.preferences.selectedRecordId;
        const firstRecordId = state.records[0]?.id ?? null;
        const handleRefreshAction = useCallback(() => {
          selectRecord(null);
        }, [selectRecord]);
        const handleManualRefreshAction = useCallback(() => {
          const next = selectedRecordId ?? firstRecordId;
          selectRecord(next);
        }, [selectedRecordId, firstRecordId, selectRecord]);
        const handleSettingsAction = useCallback(() => {
          setActivePanel("settings");
        }, [setActivePanel]);
        const screenActions = useMemo(() => ({
          "refresh-1": handleRefreshAction,
          "settings-2": handleSettingsAction,
          "manual-refresh-3": handleManualRefreshAction,
        }), [handleRefreshAction, handleSettingsAction, handleManualRefreshAction]);
        return <div data-testid="setfarm-app-root" />;
      }
    `;

    assert.equal(commentLooksMechanicallySatisfied(getterCleanupComment, fixedStoreSource), true);
    assert.equal(commentLooksMechanicallySatisfied(methodCleanupComment, fixedStoreSource), true);
    assert.equal(commentLooksMechanicallySatisfied(stableCallbacksComment, fixedAppSource), true);
    assert.equal(commentLooksMechanicallySatisfied(stableCallbacksComment, fixedCallbackSource), true);
    assert.equal(commentLooksMechanicallySatisfied(getterCleanupComment, `Object.defineProperty(app, "activeSurface", { get: () => state.activeSurface });`), false);
    assert.equal(commentLooksMechanicallySatisfied(stableCallbacksComment, `const shell = useRunProbeShell(); const screenActions = useMemo(() => ({}), [shell]);`), false);
  });

  it("marks optional shell method-call review comments as mechanically satisfied", () => {
    const optionalMethodComment = {
      id: "optional-shell-method",
      threadId: "PRRT_optional_shell_method",
      kind: "review-comment" as const,
      author: "gemini-code-assist",
      body: "Similar to `actRefreshStatus`, using optional chaining on `options.shell` (e.g., `options.shell?.setAutoRefresh(enabled)`) will throw a `TypeError` if `options.shell` is defined but `setAutoRefresh` is undefined. Use optional chaining on the method call itself to ensure safe execution.",
      createdAt: "2026-07-01T10:00:00Z",
      path: "src/features/surf-status-utility/act_toggle_status.ts",
      line: 29,
      originalLine: 29,
      threadResolved: false,
      outdated: false,
    };
    const fixedSource = `
      export function actToggleStatus(options: ToggleStatusOptions = {}) {
        const shell = options.shell;
        const doSetAutoRefresh =
          options.setAutoRefresh ??
          (shell
            ? (enabled: boolean) => shell.setAutoRefresh?.(enabled)
            : FALLBACK_SET_AUTO_REFRESH);
        doSetAutoRefresh(true);
      }
    `;
    const unsafeSource = `
      const doSetAutoRefresh =
        options.setAutoRefresh ??
        (options.shell
          ? (enabled: boolean) => options.shell?.setAutoRefresh(enabled)
          : FALLBACK_SET_AUTO_REFRESH);
    `;

    assert.equal(commentLooksMechanicallySatisfied(optionalMethodComment, fixedSource), true);
    assert.equal(commentLooksMechanicallySatisfied(optionalMethodComment, unsafeSource), false);
  });

  it("marks Run Probe status utility review comments as mechanically satisfied", () => {
    const reviewSummaryState: PrState = {
      state: "OPEN",
      checksStatus: "passing",
      mergeable: "MERGEABLE",
      mergeStateStatus: "CLEAN",
      comments: [{
        id: "gemini-summary",
        kind: "review",
        state: "COMMENTED",
        author: "gemini-code-assist",
        body: "## Code Review\n\nThis pull request simplifies the application. However, these changes introduced several critical issues: markRefreshed and system-state-toggle wiring regressed. Feedback is provided to restore these functionalities, along with corresponding action types.",
        createdAt: "2026-07-01T10:00:00Z",
      }],
    };
    const refreshComment = {
      id: "run-probe-refresh",
      threadId: "PRRT_run_probe_refresh",
      kind: "review-comment" as const,
      author: "gemini-code-assist",
      body: "The refresh handlers `handleRefreshAction` and `handleManualRefreshAction` no longer call `markRefreshed()`. Additionally, restore `handleSystemStateToggleAction` to handle toggling the auto-refresh state.",
      createdAt: "2026-07-01T10:00:00Z",
      path: "src/App.tsx",
      line: 49,
      originalLine: 49,
      threadResolved: false,
      outdated: false,
    };
    const propsComment = {
      ...refreshComment,
      id: "run-probe-props",
      threadId: "PRRT_run_probe_props",
      body: "The `StatusUtilityRunProbe` component requires the `lastRefreshedAt` and `autoRefresh` props to display the actual refresh timestamp and bind the system state toggle.",
      line: 128,
      originalLine: 128,
    };
    const unionComment = {
      ...refreshComment,
      id: "run-probe-union",
      threadId: "PRRT_run_probe_union",
      path: "src/screens/StatusUtilityRunProbe.tsx",
      body: 'Restore `"system-state-toggle"` to the `StatusUtilityRunProbeActionId` type union so that the toggle action is properly typed.',
      line: 14,
      originalLine: 14,
    };
    const toggleComment = {
      ...unionComment,
      id: "run-probe-toggle",
      threadId: "PRRT_run_probe_toggle",
      body: 'The `handleToggle` function is currently invoking `actions?.["manual-refresh-3"]?.()` instead of toggling the system state. Restore the `"system-state-toggle"` action call.',
      line: 46,
      originalLine: 46,
    };
    const attrsComment = {
      ...unionComment,
      id: "run-probe-attrs",
      threadId: "PRRT_run_probe_attrs",
      body: "Restore the `data-action-id` and `data-state` attributes on the checkbox input and remove the unnecessary `defaultValue` attribute.",
      line: 81,
      originalLine: 81,
    };
    const fixedAppSource = `
      const handleRefreshAction = useCallback(() => {
        actRefreshStatus(currentSelected, fallback, { markRefreshed: () => markRefreshed() });
      }, [markRefreshed]);
      const handleManualRefreshAction = useCallback(() => {
        actRefreshStatus(current, fallback, { markRefreshed: () => markRefreshed() });
      }, [markRefreshed]);
      const handleSystemStateToggleAction = useCallback(() => {
        actToggleStatus(autoRefresh, { setAutoRefresh });
      }, [autoRefresh, setAutoRefresh]);
      const screenActions = useMemo(() => ({ "system-state-toggle": handleSystemStateToggleAction }), [handleSystemStateToggleAction]);
      <StatusUtilityRunProbe actions={screenActions} lastRefreshedAt={lastRefreshedAt} autoRefresh={autoRefresh} />
    `;
    const fixedScreenSource = `
      export type StatusUtilityRunProbeActionId =
        | "refresh-1"
        | "settings-2"
        | "manual-refresh-3"
        | "documentation-1"
        | "privacy-2"
        | "system-state-toggle";
      function formatTimestamp(at: number | null | undefined): string { return typeof at === "number" ? "Jan 01, 00:00:00" : "—"; }
      export function StatusUtilityRunProbe({ actions, autoRefresh }: StatusUtilityRunProbeProps) {
        const [systemEnabled, setSystemEnabled] = useState<boolean>(autoRefresh ?? true);
        const handleSystemToggle = useCallback(() => {
          setSystemEnabled((prev) => {
            const next = !prev;
            actions?.["system-state-toggle"]?.();
            return next;
          });
        }, [actions]);
        return <input checked={systemEnabled} onChange={handleSystemToggle} className="sr-only peer" id="system-state-toggle" type="checkbox" data-action-id="system-state-toggle" data-state={systemEnabled ? "ready" : "paused"} />;
      }
    `;

    assert.equal(formatPrCommentsForAgent(reviewSummaryState), "");
    assert.equal(commentLooksMechanicallySatisfied(refreshComment, fixedAppSource), true);
    assert.equal(commentLooksMechanicallySatisfied(propsComment, fixedAppSource), true);
    assert.equal(commentLooksMechanicallySatisfied(unionComment, fixedScreenSource), true);
    assert.equal(commentLooksMechanicallySatisfied(toggleComment, fixedScreenSource), true);
    assert.equal(commentLooksMechanicallySatisfied(attrsComment, fixedScreenSource), true);
  });

  it("marks static web init, defensive filter, action-id, and aria role review comments as mechanically satisfied", () => {
    const initComment = {
      id: "static-init-inline",
      threadId: "PRRT_static_init",
      kind: "review-comment" as const,
      author: "gemini-code-assist",
      body: "The metrics and recent activity list display hardcoded placeholder values on initial page load. Initialize the metrics and list with actual store data when the DOM is ready.",
      createdAt: "2026-06-18T13:32:50Z",
      path: "assets/js/actions.js",
      line: 80,
      originalLine: 80,
      threadResolved: false,
      outdated: false,
    };
    const defensiveComment = {
      id: "static-defensive-inline",
      threadId: "PRRT_static_defensive",
      kind: "review-comment" as const,
      author: "gemini-code-assist",
      body: "Defensively filter out null or non-object elements from the retrieved notes array before downstream functions access properties.",
      createdAt: "2026-06-18T13:32:50Z",
      path: "assets/js/actions.js",
      line: 16,
      originalLine: 16,
      threadResolved: false,
      outdated: false,
    };
    const actionIdComment = {
      id: "static-action-id-inline",
      threadId: "PRRT_static_action_id",
      kind: "review-comment" as const,
      author: "gemini-code-assist",
      body: "For consistency with all other action IDs, the `resolve-action` action ID should use the uppercase `ACT_` prefix with underscores.",
      createdAt: "2026-06-18T13:32:50Z",
      path: "screen.html",
      line: 111,
      originalLine: 111,
      threadResolved: false,
      outdated: false,
    };
    const ariaRoleComment = {
      id: "static-aria-role-inline",
      threadId: "PRRT_static_aria_role",
      kind: "review-comment" as const,
      author: "gemini-code-assist",
      body: 'The `span` element representing the status dot has an `aria-label` but lacks a semantic `role`. Adding `role="img"` ensures assistive technologies announce its status label.',
      createdAt: "2026-06-18T13:32:50Z",
      path: "assets/js/app.js",
      line: 42,
      originalLine: 42,
      threadResolved: false,
      outdated: false,
    };

    const fixedJs = `
      function getItems() {
        var state = window.AppStore.getState();
        var items = (state && state.items) || [];
        return items.filter(function (item) {
          return item !== null && typeof item === 'object';
        });
      }
      function init() {
        var items = getItems();
        updateMetrics(items, 'all');
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
      const dotVisual = createEl('span', 'dot-visual dot-visual--' + dot.status, {
        'aria-label': 'Status: ' + dot.status,
        role: 'img'
      });
    `;
    const fixedHtml = '<button type="button" data-action-id="ACT_RESOLVE_ACTION">Resolve</button><span aria-label="Status: ready" role="img"></span>';

    assert.equal(commentLooksMechanicallySatisfied(initComment, fixedJs), true);
    assert.equal(commentLooksMechanicallySatisfied(defensiveComment, fixedJs), true);
    assert.equal(commentLooksMechanicallySatisfied(actionIdComment, fixedHtml), true);
    assert.equal(commentLooksMechanicallySatisfied(ariaRoleComment, fixedJs), true);
    assert.equal(commentLooksMechanicallySatisfied(ariaRoleComment, fixedHtml), true);
    assert.equal(commentLooksMechanicallySatisfied(actionIdComment, '<button data-action-id="resolve-action">Resolve</button>'), false);
    assert.equal(commentLooksMechanicallySatisfied(ariaRoleComment, '<span aria-label="Status: ready"></span>'), false);
  });

  it("finds mechanically satisfied inline review thread ids from current PR source files", () => {
    const root = mkdtempSync(join(tmpdir(), "setfarm-pr-comments-"));
    try {
      const screenDir = join(root, "src", "screens");
      mkdirSync(screenDir, { recursive: true });
      writeFileSync(
        join(screenDir, "Gameplay.tsx"),
        "export function View({ runtime }) { return <>{Array.from({ length: runtime?.lives ?? 3 }).map((_, i) => <Heart key={i} />)}</>; }",
      );
      const state: PrState = {
        state: "OPEN",
        checksStatus: "passing",
        mergeable: "MERGEABLE",
        mergeStateStatus: "CLEAN",
        comments: [
          {
            id: "current-inline",
            threadId: "PRRT_current",
            kind: "review-comment",
            author: "reviewer",
            body: [
              "Please render lives dynamically.",
              "",
              "```suggestion",
              "{Array.from({ length: runtime?.lives ?? 3 }).map((_, i) => <Heart key={i} />)}",
              "```",
            ].join("\n"),
            createdAt: "2026-05-18T00:31:28Z",
            path: "src/screens/Gameplay.tsx",
            line: 120,
            originalLine: 120,
            threadResolved: false,
            outdated: false,
          },
          {
            id: "unmatched-inline",
            threadId: "PRRT_unmatched",
            kind: "review-comment",
            author: "reviewer",
            body: [
              "Please add score persistence.",
              "",
              "```suggestion",
              "localStorage.setItem('score', String(score))",
              "```",
            ].join("\n"),
            createdAt: "2026-05-18T00:31:29Z",
            path: "src/screens/Gameplay.tsx",
            line: 121,
            originalLine: 121,
            threadResolved: false,
            outdated: false,
          },
        ],
      };

      assert.deepEqual(getMechanicallySatisfiedInlineReviewThreadIds(state, root), ["PRRT_current"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("finds mechanically satisfied static routing threads from files referenced in review prose", () => {
    const root = mkdtempSync(join(tmpdir(), "setfarm-pr-comments-static-route-"));
    try {
      execFileSync("git", ["init", "-b", "main"], { cwd: root, stdio: "ignore" });
      execFileSync("git", ["config", "user.email", "setfarm@example.test"], { cwd: root });
      execFileSync("git", ["config", "user.name", "Setfarm Test"], { cwd: root });
      writeFileSync(join(root, "index.html"), '<main data-testid="setfarm-app-root"></main>');
      writeFileSync(join(root, "insights.html"), '<!doctype html><html><body><main data-testid="setfarm-app-root"></main></body></html>');
      execFileSync("git", ["add", "."], { cwd: root });
      execFileSync("git", ["commit", "-m", "main"], { cwd: root, stdio: "ignore" });
      execFileSync("git", ["checkout", "-b", "feature-route"], { cwd: root, stdio: "ignore" });
      writeFileSync(
        join(root, "index.html"),
        '<!doctype html><html><head><meta http-equiv="refresh" content="0; url=insights.html"></head><body><main data-setfarm-root="baseline" data-testid="setfarm-app-root"><a href="insights.html">Insights</a></main></body></html>',
      );
      writeFileSync(
        join(root, "insights.html"),
        '<!doctype html><html><body><main data-testid="setfarm-app-root"><a href="index.html">Insights</a></main></body></html>',
      );
      execFileSync("git", ["add", "."], { cwd: root });
      execFileSync("git", ["commit", "-m", "feature"], { cwd: root, stdio: "ignore" });
      execFileSync("git", ["checkout", "main"], { cwd: root, stdio: "ignore" });

      const state: PrState = {
        state: "OPEN",
        headRefName: "feature-route",
        checksStatus: "passing",
        mergeable: "MERGEABLE",
        mergeStateStatus: "CLEAN",
        comments: [
          {
            id: "static-route-inline",
            threadId: "PRRT_static_route",
            kind: "review-comment",
            author: "gemini-code-assist",
            body: "There is an inconsistency in how navigation and page structure are handled between `index.html` and `insights.html`. Clarify the MPA routing model so index.html is not an empty shell.",
            createdAt: "2026-06-18T13:32:50Z",
            path: "insights.html",
            line: 40,
            originalLine: 40,
            threadResolved: false,
            outdated: false,
          },
        ],
      };

      assert.deepEqual(getMechanicallySatisfiedInlineReviewThreadIds(state, root), ["PRRT_static_route"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("checks the PR head ref source before the local working tree", () => {
    const root = mkdtempSync(join(tmpdir(), "setfarm-pr-comments-git-"));
    try {
      execFileSync("git", ["init", "-b", "main"], { cwd: root, stdio: "ignore" });
      execFileSync("git", ["config", "user.email", "setfarm@example.test"], { cwd: root });
      execFileSync("git", ["config", "user.name", "Setfarm Test"], { cwd: root });
      mkdirSync(join(root, "src", "screens"), { recursive: true });
      const screenPath = join(root, "src", "screens", "Gameplay.tsx");
      writeFileSync(screenPath, "<Heart /><Heart /><Heart />");
      execFileSync("git", ["add", "."], { cwd: root });
      execFileSync("git", ["commit", "-m", "main"], { cwd: root, stdio: "ignore" });
      execFileSync("git", ["checkout", "-b", "feature-lives"], { cwd: root, stdio: "ignore" });
      writeFileSync(
        screenPath,
        "export function View({ runtime }) { return <>{Array.from({ length: runtime?.lives ?? 3 }).map((_, i) => <Heart key={i} />)}</>; }",
      );
      execFileSync("git", ["add", "."], { cwd: root });
      execFileSync("git", ["commit", "-m", "feature"], { cwd: root, stdio: "ignore" });
      execFileSync("git", ["checkout", "main"], { cwd: root, stdio: "ignore" });

      const state: PrState = {
        state: "OPEN",
        headRefName: "feature-lives",
        checksStatus: "passing",
        mergeable: "MERGEABLE",
        mergeStateStatus: "CLEAN",
        comments: [
          {
            id: "current-inline",
            threadId: "PRRT_current",
            kind: "review-comment",
            author: "reviewer",
            body: [
              "Please render lives dynamically.",
              "",
              "```suggestion",
              "{Array.from({ length: runtime?.lives ?? 3 }).map((_, i) => <Heart key={i} />)}",
              "```",
            ].join("\n"),
            createdAt: "2026-05-18T00:31:28Z",
            path: "src/screens/Gameplay.tsx",
            line: 120,
            originalLine: 120,
            threadResolved: false,
            outdated: false,
          },
        ],
      };

      assert.deepEqual(getMechanicallySatisfiedInlineReviewThreadIds(state, root), ["PRRT_current"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("replaces stale failure output when a story becomes verified", () => {
    const stale = "PR_REVIEW_COMMENTS_OPEN: US-002 has actionable PR review comments that must be fixed before merge.";
    const staleNaturalLanguage = "Open actionable PR review thread remains on src/App.tsx in PR #2.";

    assert.equal(isStaleFailureStoryOutput(stale), true);
    assert.equal(isStaleFailureStoryOutput(staleNaturalLanguage), true);
    assert.match(verifiedStoryOutput(stale), /STATUS: verified/);
    assert.match(
      verifiedStoryOutput(stale, "STATUS: done\nRESULT: reviewer passed") || "",
      /reviewer passed/,
    );
    assert.equal(verifiedStoryOutput("STATUS: done\nCHANGES: created app"), null);
  });
});

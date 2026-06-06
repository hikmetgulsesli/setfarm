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

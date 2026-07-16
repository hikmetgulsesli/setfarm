import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { mkdtemp } from "node:fs/promises";

import {
  readProjectedDesignSourceAuthorityV2,
  runDesignSourceAuthorityV2,
  serializeAttemptTransportV2,
} from "../../src/product-compiler/design-source-runtime-v2.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { ProductCompilationAttemptRepository } from "../../src/product-compiler/product-compilation-attempt-repository.js";
import { produceDesignGenerationTargetsV2 } from "../../src/product-compiler/producers/design-targets-v2.js";
import { compilePlanSemanticProposalV2 } from "../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import {
  CONTAINED_GAME_TASK,
  containedGamePlanProposalV2,
} from "../product-compiler/fixtures/product-semantics-v2.js";
import {
  stitchDownloadReceipts,
  validStitchHtml,
  validStitchPng,
} from "../product-compiler/fixtures/stitch-artifacts.js";
import { createIsolatedTestDatabase } from "./test-database.js";

describe("design-source authority v2 runtime", { concurrency: 1 }, () => {
  it("materializes one exact attempt, projects only selected authority, and replays without redispatch", async () => {
    const database = await createIsolatedTestDatabase();
    const repo = await mkdtemp(path.join(tmpdir(), "setfarm-design-source-runtime-v2-"));
    const rejectedRepo = await mkdtemp(path.join(tmpdir(), "setfarm-design-source-runtime-v2-rejected-"));
    try {
      const releaseSha = "a".repeat(40);
      const admissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
      const runId = "run-design-source-runtime-v2";
      await database.sql`
        INSERT INTO runs (
          id, workflow_id, task, status, protocol, protocol_version,
          compiler_release_sha, activation_preflight_hash, release_admission_hash
        ) VALUES (
          ${runId}, 'feature-dev', 'design source runtime v2 fixture',
          'running', 'v3', 1, ${releaseSha}, ${"b".repeat(64)}, ${admissionHash}
        )
      `;
      const claims = await database.sql<Array<{ id: string }>>`
        INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
        VALUES (${runId}, 'design', NULL, 'setfarm-design-source-runtime-v2')
        RETURNING id::text AS id
      `;
      const claimId = Number(claims[0]!.id);

      const compiled = compilePlanSemanticProposalV2({
        task: CONTAINED_GAME_TASK,
        proposal: containedGamePlanProposalV2(),
      });
      assert.equal(compiled.status, "canonicalized", JSON.stringify(compiled));
      if (compiled.status !== "canonicalized") return;
      const targets = produceDesignGenerationTargetsV2(compiled.productSpec);
      assert.equal(targets.status, "produced", JSON.stringify(targets));
      if (targets.status !== "produced") return;
      const target = targets.generationTargets.targets[0]!;
      const placement = target.requiredControlPlacements[0]!;
      const statusObservable = target.requiredObservableSelectors.find((observable) =>
        observable.selector.kind === "accessibility")!;
      assert.equal(statusObservable.selector.kind, "accessibility");
      if (statusObservable.selector.kind !== "accessibility") return;
      const canvasSurface = target.containedSurfaceRefs.find((surfaceRef) =>
        surfaceRef !== statusObservable.selector.surfaceRef)!;
      const screenId = "screen-runtime-v2";
      const htmlBytes = validStitchHtml([
        `<main data-surface-id="${target.surfaceRef}">`,
        `<button data-action="${placement.actionRef}" data-control-slot="${placement.controlSlotRef}">Start Game</button>`,
        `<section data-surface-id="${canvasSurface}"><canvas aria-label="Game canvas"></canvas></section>`,
        `<section data-surface-id="${statusObservable.selector.surfaceRef}"><div hidden role="status" aria-label="Game status">Playing</div></section>`,
        "</main>",
      ].join(""), "design-source-runtime-v2");
      const screenshotBytes = validStitchPng(229);
      const directScreenEvidence = [{
        screenId,
        title: target.expectedScreenTitle,
        responsePaths: ["$result.screens[0]"],
        htmlAvailable: true,
        screenshotAvailable: true,
        ...stitchDownloadReceipts(screenId, htmlBytes, screenshotBytes),
        identityConflicts: [],
        disposition: "admitted_renderable_screen",
        missingEvidence: [],
      }];
      const transport = {
        schema: "setfarm.stitch-attempt-transport.v1",
        total: 1,
        screens: [{ screenId, title: target.expectedScreenTitle }],
        screenSource: "direct",
        directCandidateTotal: 1,
        excludedDirectTotal: 0,
        directScreenEvidenceSchema: "setfarm.stitch-direct-screen-evidence.v2",
        directScreenEvidence,
        downloaded: [{
          screenId,
          title: target.expectedScreenTitle,
          htmlFile: `${screenId}.html`,
          screenshotFile: `${screenId}.png`,
        }],
      };
      const repository = new ProductCompilationAttemptRepository(database.sql);
      let dispatches = 0;
      const runtimeInput = {
        repo,
        runId,
        projectId: "stitch-runtime-v2-project",
        contract: {
          productSpec: compiled.productSpec,
          generationTargets: targets.generationTargets,
        },
        originClaimId: claimId,
        ownerClaimId: claimId,
        ownerInstanceId: "design-source-runtime-v2-test",
        producerReleaseSha: releaseSha,
        provider: "stitch",
        model: "GEMINI_3_1_PRO",
        deviceType: "DESKTOP" as const,
        uiLanguage: "English",
        duplicateWaitMs: 500,
        duplicatePollMs: 10,
      };
      const dependencies = {
        repository,
        generateStage: async (input: { stageId: string; targetRefs: readonly string[] }) => {
          dispatches += 1;
          assert.equal(input.stageId, "DSGS_001");
          assert.deepEqual(input.targetRefs, [target.targetId]);
          return {
            disposition: "accepted" as const,
            response: transport,
            rawEvidence: serializeAttemptTransportV2(transport),
            artifacts: [{ screenId, htmlBytes, screenshotBytes }],
          };
        },
      };

      const first = await runDesignSourceAuthorityV2(runtimeInput, dependencies);
      assert.equal(first.runner.status, "accepted", JSON.stringify(first.runner));
      if (first.runner.status !== "accepted") return;
      assert.equal(first.runner.replayed, false);
      assert.equal(dispatches, 1);
      assert.equal(first.authority.promptContractHash, hashCanonicalJson({
        schema: "setfarm.design-source-prompt-contract.v2",
        builder: "buildV3BatchStitchPromptV2",
        generationTargetsSchema: targets.generationTargets.schema,
        projectId: "stitch-runtime-v2-project",
      }));
      assert.equal(first.artifacts?.designGraph.controls.length, 1);
      assert.equal(first.artifacts?.designGraph.controls[0]?.identity.controlSlotRef, placement.controlSlotRef);
      assert.equal(await readFile(path.join(repo, "stitch", `${screenId}.html`), "utf8"), htmlBytes.toString("utf8"));
      assert.deepEqual(
        JSON.parse(await readFile(path.join(repo, "stitch", "DESIGN_INTERACTION_GRAPH_V2.json"), "utf8")),
        first.artifacts?.designGraph,
      );
      assert.match(await readFile(path.join(repo, "stitch", "DESIGN.md"), "utf8"), /Physical control slots/);

      const replay = await runDesignSourceAuthorityV2(runtimeInput, {
        repository,
        generateStage: async () => {
          throw new Error("accepted authority must replay without provider dispatch");
        },
      });
      assert.equal(replay.runner.status, "accepted", JSON.stringify(replay.runner));
      if (replay.runner.status !== "accepted") return;
      assert.equal(replay.runner.replayed, true);
      assert.equal(dispatches, 1);
      assert.deepEqual(
        replay.artifacts,
        await readProjectedDesignSourceAuthorityV2(repo, runtimeInput.contract),
      );
      assert.deepEqual(replay.artifacts, first.artifacts);

      const rejectedRunId = "run-design-source-runtime-v2-rejected";
      await database.sql`
        INSERT INTO runs (
          id, workflow_id, task, status, protocol, protocol_version,
          compiler_release_sha, activation_preflight_hash, release_admission_hash
        ) VALUES (
          ${rejectedRunId}, 'feature-dev', 'design source runtime v2 rejected fixture',
          'running', 'v3', 1, ${releaseSha}, ${"c".repeat(64)}, ${admissionHash}
        )
      `;
      const rejectedClaims = await database.sql<Array<{ id: string }>>`
        INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
        VALUES (${rejectedRunId}, 'design', NULL, 'setfarm-design-source-runtime-v2')
        RETURNING id::text AS id
      `;
      const rejectedClaimId = Number(rejectedClaims[0]!.id);
      const rejectedScreenId = "screen-runtime-v2-rejected";
      const rejectedHtml = validStitchHtml([
        `<main data-surface-id="${target.surfaceRef}">`,
        `<section data-surface-id="${canvasSurface}"><canvas aria-label="Game canvas"></canvas></section>`,
        `<section data-surface-id="${statusObservable.selector.surfaceRef}"><div hidden role="status" aria-label="Game status">Playing</div></section>`,
        "</main>",
      ].join(""), "design-source-runtime-v2-rejected");
      const rejectedScreenshot = validStitchPng(230);
      const rejectedEvidence = [{
        screenId: rejectedScreenId,
        title: target.expectedScreenTitle,
        responsePaths: ["$result.screens[0]"],
        htmlAvailable: true,
        screenshotAvailable: true,
        ...stitchDownloadReceipts(rejectedScreenId, rejectedHtml, rejectedScreenshot),
        identityConflicts: [],
        disposition: "admitted_renderable_screen",
        missingEvidence: [],
      }];
      const rejectedTransport = {
        schema: "setfarm.stitch-attempt-transport.v1",
        total: 1,
        screens: [{ screenId: rejectedScreenId, title: target.expectedScreenTitle }],
        screenSource: "direct",
        directCandidateTotal: 1,
        excludedDirectTotal: 0,
        directScreenEvidenceSchema: "setfarm.stitch-direct-screen-evidence.v2",
        directScreenEvidence: rejectedEvidence,
        downloaded: [{
          screenId: rejectedScreenId,
          title: target.expectedScreenTitle,
          htmlFile: `${rejectedScreenId}.html`,
          screenshotFile: `${rejectedScreenId}.png`,
        }],
      };
      const retryPrompts: string[] = [];
      const rejected = await runDesignSourceAuthorityV2({
        ...runtimeInput,
        repo: rejectedRepo,
        runId: rejectedRunId,
        projectId: "stitch-runtime-v2-rejected-project",
        originClaimId: rejectedClaimId,
        ownerClaimId: rejectedClaimId,
      }, {
        repository,
        generateStage: async ({ prompt }) => {
          retryPrompts.push(prompt);
          return {
            disposition: "accepted",
            response: rejectedTransport,
            rawEvidence: serializeAttemptTransportV2(rejectedTransport),
            artifacts: [{
              screenId: rejectedScreenId,
              htmlBytes: rejectedHtml,
              screenshotBytes: rejectedScreenshot,
            }],
          };
        },
      });
      assert.equal(rejected.runner.status, "rejected", JSON.stringify(rejected.runner));
      if (rejected.runner.status !== "rejected") return;
      assert.equal(rejected.runner.stopReason, "maximum_attempts");
      assert.equal(rejected.runner.attempts.length, 2);
      assert.equal(retryPrompts.length, 2);
      assert.doesNotMatch(retryPrompts[0]!, /SETFARM_PROVEN_RETRY_DELTA_V1/);
      assert.match(retryPrompts[1]!, /SETFARM_PROVEN_RETRY_DELTA_V1/);
      await assert.rejects(readFile(path.join(rejectedRepo, "stitch", "DESIGN_MANIFEST.json")));
    } finally {
      await Promise.all([
        rm(repo, { recursive: true, force: true }),
        rm(rejectedRepo, { recursive: true, force: true }),
      ]);
      await database.cleanup();
    }
  });
});

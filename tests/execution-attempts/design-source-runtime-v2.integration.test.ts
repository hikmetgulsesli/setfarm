import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
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
    const additionalRepos: string[] = [];
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
        selectedHtmlAdmissionPolicy: {
          schema: "setfarm.design-source-selected-html-admission-policy.v2",
          maximumBytes: 800_000,
          encoding: "utf8_fatal",
          language: "English",
          contract: "setfarm.english-text-contract.v1",
        },
      }));
      assert.notEqual(first.authority.promptContractHash, hashCanonicalJson({
        schema: "setfarm.design-source-prompt-contract.v2",
        builder: "buildV3BatchStitchPromptV2",
        generationTargetsSchema: targets.generationTargets.schema,
        projectId: "stitch-runtime-v2-project",
      }), "pre-policy accepted attempts must not match the English-admission authority");
      assert.equal(first.artifacts?.designGraph.controls.length, 1);
      assert.equal(first.artifacts?.designGraph.controls[0]?.identity.controlSlotRef, placement.controlSlotRef);
      assert.equal(await readFile(path.join(repo, "stitch", `${screenId}.html`), "utf8"), htmlBytes.toString("utf8"));
      assert.deepEqual(
        JSON.parse(await readFile(path.join(repo, "stitch", "DESIGN_INTERACTION_GRAPH_V2.json"), "utf8")),
        first.artifacts?.designGraph,
      );
      assert.deepEqual(
        JSON.parse(await readFile(path.join(repo, "stitch", "GENERATION_TARGETS.json"), "utf8")),
        targets.generationTargets,
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
        `<a href="#">Settings</a>`,
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
      assert.equal(
        rejected.runner.failure.operationalCauseHash,
        hashCanonicalJson(DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1),
      );
      assert.equal(retryPrompts.length, 2);
      assert.doesNotMatch(retryPrompts[0]!, /SETFARM_PROVEN_RETRY_DELTA_V1/);
      assert.match(retryPrompts[1]!, /SETFARM_PROVEN_RETRY_DELTA_V1/);
      assert.match(retryPrompts[1]!, /nested_reason_codes: CANDIDATE_[A-Z0-9_,]+/);
      assert.match(retryPrompts[1]!, /CANDIDATE_UNDECLARED_INTERACTIVE_CONTROL/);
      assert.match(
        retryPrompts[1]!,
        /Do not add actionable navigation, sidebar, header, footer, breadcrumb, menu, icon-only, settings, privacy, terms, account, or utility controls/,
      );
      await assert.rejects(readFile(path.join(rejectedRepo, "stitch", "DESIGN_MANIFEST.json")));

      const selectedHtmlCases = [
        {
          id: "non-english",
          activationHash: "d".repeat(64),
          htmlBytes: validStitchHtml([
            `<main data-surface-id="${target.surfaceRef}">`,
            `<button data-action="${placement.actionRef}" data-control-slot="${placement.controlSlotRef}">Start Game</button>`,
            `<section data-surface-id="${canvasSurface}"><canvas aria-label="Game canvas"></canvas></section>`,
            `<section data-surface-id="${statusObservable.selector.surfaceRef}"><div hidden role="status" aria-label="Game status">Playing</div></section>`,
            `<p>${String.fromCharCode(0x00e9)}</p>`,
            "</main>",
          ].join(""), "design-source-runtime-v2-non-English"),
          diagnostic: "ENGLISH_TEXT_NON_ASCII at / code unit 0x00E9",
        },
        {
          id: "invalid-utf8",
          activationHash: "e".repeat(64),
          htmlBytes: Buffer.concat([
            validStitchHtml([
              `<main data-surface-id="${target.surfaceRef}">`,
              `<button data-action="${placement.actionRef}" data-control-slot="${placement.controlSlotRef}">Start Game</button>`,
              `<section data-surface-id="${canvasSurface}"><canvas aria-label="Game canvas"></canvas></section>`,
              `<section data-surface-id="${statusObservable.selector.surfaceRef}"><div hidden role="status" aria-label="Game status">Playing</div></section>`,
              "</main>",
            ].join(""), "design-source-runtime-v2-invalid-utf8"),
            Buffer.from([0xc3, 0x28]),
          ]),
          diagnostic: "DESIGN_SOURCE_SELECTED_HTML_UTF8_INVALID",
        },
        {
          id: "byte-limit",
          activationHash: "f".repeat(64),
          htmlBytes: validStitchHtml([
            `<main data-surface-id="${target.surfaceRef}">`,
            `<button data-action="${placement.actionRef}" data-control-slot="${placement.controlSlotRef}">Start Game</button>`,
            `<section data-surface-id="${canvasSurface}"><canvas aria-label="Game canvas"></canvas></section>`,
            `<section data-surface-id="${statusObservable.selector.surfaceRef}"><div hidden role="status" aria-label="Game status">Playing</div></section>`,
            `<p>${"A".repeat(800_001)}</p>`,
            "</main>",
          ].join(""), "design-source-runtime-v2-byte-limit"),
          diagnostic: "DESIGN_SOURCE_SELECTED_HTML_BYTE_LIMIT_EXCEEDED",
        },
        {
          id: "code-unit-limit",
          activationHash: "1".repeat(64),
          htmlBytes: validStitchHtml([
            `<main data-surface-id="${target.surfaceRef}">`,
            `<button data-action="${placement.actionRef}" data-control-slot="${placement.controlSlotRef}">Start Game</button>`,
            `<section data-surface-id="${canvasSurface}"><canvas aria-label="Game canvas"></canvas></section>`,
            `<section data-surface-id="${statusObservable.selector.surfaceRef}"><div hidden role="status" aria-label="Game status">Playing</div></section>`,
            `<p>${"A".repeat(200_001)}</p>`,
            "</main>",
          ].join(""), "design-source-runtime-v2-code-unit-limit"),
          diagnostic: "ENGLISH_TEXT_VALUE_LIMIT_EXCEEDED at /",
        },
      ];
      for (const [caseIndex, selectedHtmlCase] of selectedHtmlCases.entries()) {
        const caseRepo = await mkdtemp(path.join(
          tmpdir(),
          `setfarm-design-source-runtime-v2-${selectedHtmlCase.id}-`,
        ));
        additionalRepos.push(caseRepo);
        const caseRunId = `run-design-source-runtime-v2-${selectedHtmlCase.id}`;
        await database.sql`
          INSERT INTO runs (
            id, workflow_id, task, status, protocol, protocol_version,
            compiler_release_sha, activation_preflight_hash, release_admission_hash
          ) VALUES (
            ${caseRunId}, 'feature-dev', 'design source selected HTML admission fixture',
            'running', 'v3', 1, ${releaseSha}, ${selectedHtmlCase.activationHash}, ${admissionHash}
          )
        `;
        const caseClaims = await database.sql<Array<{ id: string }>>`
          INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
          VALUES (${caseRunId}, 'design', NULL, 'setfarm-design-source-runtime-v2')
          RETURNING id::text AS id
        `;
        const caseClaimId = Number(caseClaims[0]!.id);
        const caseScreenId = `screen-runtime-v2-${selectedHtmlCase.id}`;
        const caseScreenshot = validStitchPng(231 + caseIndex);
        const caseTransport = {
          ...transport,
          screens: [{ screenId: caseScreenId, title: target.expectedScreenTitle }],
          directScreenEvidence: [{
            screenId: caseScreenId,
            title: target.expectedScreenTitle,
            responsePaths: ["$result.screens[0]"],
            htmlAvailable: true,
            screenshotAvailable: true,
            ...stitchDownloadReceipts(
              caseScreenId,
              selectedHtmlCase.htmlBytes,
              caseScreenshot,
            ),
            identityConflicts: [],
            disposition: "admitted_renderable_screen",
            missingEvidence: [],
          }],
          downloaded: [{
            screenId: caseScreenId,
            title: target.expectedScreenTitle,
            htmlFile: `${caseScreenId}.html`,
            screenshotFile: `${caseScreenId}.png`,
          }],
        };
        const caseResult = await runDesignSourceAuthorityV2({
          ...runtimeInput,
          repo: caseRepo,
          runId: caseRunId,
          projectId: `stitch-runtime-v2-${selectedHtmlCase.id}-project`,
          originClaimId: caseClaimId,
          ownerClaimId: caseClaimId,
        }, {
          repository,
          generateStage: async () => ({
            disposition: "accepted",
            response: caseTransport,
            rawEvidence: serializeAttemptTransportV2(caseTransport),
            artifacts: [{
              screenId: caseScreenId,
              htmlBytes: selectedHtmlCase.htmlBytes,
              screenshotBytes: caseScreenshot,
            }],
          }),
        });
        assert.equal(caseResult.runner.status, "rejected", JSON.stringify(caseResult.runner));
        if (caseResult.runner.status !== "rejected") {
          throw new Error(`Selected HTML case ${selectedHtmlCase.id} did not reject`);
        }
        assert.deepEqual(
          caseResult.runner.failure.reasonCodes,
          ["DESIGN_SOURCE_SELECTED_HTML_ENGLISH_REQUIRED"],
        );
        assert.equal(caseResult.runner.attempts.length, 1);
        const attemptRoot = path.join(caseRepo, caseResult.runner.attempt.attemptLocator);
        assert.equal(
          await readFile(path.join(attemptRoot, "raw", "stages", "DSGS_001", "response.bin"), "utf8"),
          serializeAttemptTransportV2(caseTransport),
        );
        const screenKey = createHash("sha256").update(caseScreenId, "utf8").digest("hex");
        assert.deepEqual(
          await readFile(path.join(
            attemptRoot,
            "download",
            "stages",
            "DSGS_001",
            "screens",
            `${screenKey}.html`,
          )),
          selectedHtmlCase.htmlBytes,
        );
        const failureArtifact = JSON.parse(
          await readFile(path.join(attemptRoot, "raw", "failure.json"), "utf8"),
        ) as { evidence: { diagnostic: string } };
        assert.equal(failureArtifact.evidence.diagnostic, selectedHtmlCase.diagnostic);
        await assert.rejects(
          readFile(path.join(caseRepo, "stitch", "DESIGN_MANIFEST.json")),
          { code: "ENOENT" },
        );
        await assert.rejects(
          readFile(path.join(caseRepo, "stitch", `${caseScreenId}.html`)),
          { code: "ENOENT" },
        );
      }

      const carryForwardRepo = await mkdtemp(path.join(
        tmpdir(),
        "setfarm-design-source-runtime-v2-carry-forward-",
      ));
      additionalRepos.push(carryForwardRepo);
      const carryForwardRunId = "run-design-source-runtime-v2-carry-forward";
      await database.sql`
        INSERT INTO runs (
          id, workflow_id, task, status, protocol, protocol_version,
          compiler_release_sha, activation_preflight_hash, release_admission_hash
        ) VALUES (
          ${carryForwardRunId}, 'feature-dev', 'design source carry-forward admission fixture',
          'running', 'v3', 1, ${releaseSha}, ${"2".repeat(64)}, ${admissionHash}
        )
      `;
      const carryForwardClaims = await database.sql<Array<{ id: string }>>`
        INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
        VALUES (${carryForwardRunId}, 'design', NULL, 'setfarm-design-source-runtime-v2')
        RETURNING id::text AS id
      `;
      const carryForwardClaimId = Number(carryForwardClaims[0]!.id);
      const multiStageProductSpec: any = structuredClone(compiled.productSpec);
      const requirementRefs = multiStageProductSpec.requirements.map(
        (requirement: { id: string }) => requirement.id,
      );
      for (const [index, name] of ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"].entries()) {
        const ordinal = index + 1;
        const routeId = `ROUTE_AUXILIARY_${ordinal}`;
        const surfaceId = `SURF_AUXILIARY_${ordinal}_PAGE`;
        multiStageProductSpec.routes.push({
          id: routeId,
          path: `/auxiliary-${ordinal}`,
          rootSurfaceRef: surfaceId,
          surfaceRefs: [surfaceId],
          entry: false,
        });
        multiStageProductSpec.surfaces.push({
          id: surfaceId,
          name: `${name} Page`,
          kind: "page",
          routeRef: routeId,
          required: true,
          composition: { kind: "route_root" },
        });
        multiStageProductSpec.traceability.bindings.push(
          { semanticKind: "route", semanticRef: routeId, requirementRefs },
          { semanticKind: "surface", semanticRef: surfaceId, requirementRefs },
        );
      }
      const multiStageTargetsResult = produceDesignGenerationTargetsV2(multiStageProductSpec);
      assert.equal(
        multiStageTargetsResult.status,
        "produced",
        JSON.stringify(multiStageTargetsResult),
      );
      if (multiStageTargetsResult.status !== "produced") {
        throw new Error("Multi-stage generation targets were not produced");
      }
      const multiStageTargets = multiStageTargetsResult.generationTargets;
      assert.equal(multiStageTargets.targets.length, 6);
      const stageOneTargets = multiStageTargets.targets.slice(0, 5);
      const stageTwoTargets = multiStageTargets.targets.slice(5);
      assert.deepEqual(stageTwoTargets.map((item) => item.targetId), [target.targetId]);

      const acceptedStage = (
        stageId: string,
        stageTargets: typeof multiStageTargets.targets,
        seed: number,
      ) => {
        const artifacts = stageTargets.map((stageTarget, index) => {
          const stageScreenId = `carry-${stageTarget.targetId.toLowerCase().replaceAll("_", "-")}`;
          return {
            screenId: stageScreenId,
            htmlBytes: stageTarget.targetId === target.targetId
              ? htmlBytes
              : validStitchHtml(
                `<main data-surface-id="${stageTarget.surfaceRef}"><h1>${stageTarget.expectedScreenTitle}</h1></main>`,
                `design-source-runtime-v2-${stageScreenId}`,
              ),
            screenshotBytes: validStitchPng(seed + index),
            title: stageTarget.expectedScreenTitle,
          };
        });
        const stageTransport = {
          schema: "setfarm.stitch-attempt-transport.v1",
          total: artifacts.length,
          screens: artifacts.map((artifact) => ({
            screenId: artifact.screenId,
            title: artifact.title,
          })),
          screenSource: "direct",
          directCandidateTotal: artifacts.length,
          excludedDirectTotal: 0,
          directScreenEvidenceSchema: "setfarm.stitch-direct-screen-evidence.v2",
          directScreenEvidence: artifacts.map((artifact, index) => ({
            screenId: artifact.screenId,
            title: artifact.title,
            responsePaths: [`$result.screens[${index}]`],
            htmlAvailable: true,
            screenshotAvailable: true,
            ...stitchDownloadReceipts(
              artifact.screenId,
              artifact.htmlBytes,
              artifact.screenshotBytes,
            ),
            identityConflicts: [],
            disposition: "admitted_renderable_screen",
            missingEvidence: [],
          })),
          downloaded: artifacts.map((artifact) => ({
            screenId: artifact.screenId,
            title: artifact.title,
            htmlFile: `${artifact.screenId}.html`,
            screenshotFile: `${artifact.screenId}.png`,
          })),
        };
        return {
          disposition: "accepted" as const,
          response: stageTransport,
          rawEvidence: serializeAttemptTransportV2(stageTransport),
          artifacts: artifacts.map((artifact) => ({
            screenId: artifact.screenId,
            htmlBytes: artifact.htmlBytes,
            screenshotBytes: artifact.screenshotBytes,
          })),
          stageId,
        };
      };
      const stageOneAccepted = acceptedStage("DSGS_001", stageOneTargets, 240);
      const stageTwoAccepted = acceptedStage("DSGS_002", stageTwoTargets, 250);
      const carryForwardDispatches: string[] = [];
      const carryForward = await runDesignSourceAuthorityV2({
        ...runtimeInput,
        repo: carryForwardRepo,
        runId: carryForwardRunId,
        projectId: "stitch-runtime-v2-carry-forward-project",
        contract: {
          productSpec: multiStageProductSpec,
          generationTargets: multiStageTargets,
        },
        originClaimId: carryForwardClaimId,
        ownerClaimId: carryForwardClaimId,
      }, {
        repository,
        generateStage: async ({ attempt, stageId, targetRefs }) => {
          carryForwardDispatches.push(`${attempt.ordinal}:${stageId}`);
          if (stageId === "DSGS_001") {
            assert.deepEqual(targetRefs, stageOneTargets.map((item) => item.targetId));
            return stageOneAccepted;
          }
          assert.equal(stageId, "DSGS_002");
          assert.deepEqual(targetRefs, stageTwoTargets.map((item) => item.targetId));
          if (attempt.ordinal === 1) {
            return {
              disposition: "rejected",
              failure: {
                failureFingerprint: hashCanonicalJson({ case: "carry-forward-stage-two" }),
                operationalCauseHash: hashCanonicalJson({ case: "carry-forward-stage-two-cause" }),
                reasonCodes: ["DESIGN_TARGET_EVIDENCE_INCOMPLETE"],
                evidence: {
                  failedStageIds: [stageId],
                  failedTargetRefs: targetRefs,
                },
              },
              rawEvidence: "stage two rejected before retry\n",
            };
          }
          return stageTwoAccepted;
        },
      });
      assert.equal(carryForward.runner.status, "accepted", JSON.stringify(carryForward.runner));
      if (carryForward.runner.status !== "accepted") {
        throw new Error("Carry-forward attempt did not become accepted");
      }
      assert.equal(carryForward.runner.replayed, false);
      assert.equal(carryForward.runner.attempt.ordinal, 2);
      assert.equal(carryForward.runner.attempts.length, 2);
      assert.deepEqual(carryForwardDispatches, [
        "1:DSGS_001",
        "1:DSGS_002",
        "2:DSGS_002",
      ]);
      const carryForwardAttemptRoot = path.join(
        carryForwardRepo,
        carryForward.runner.attempt.attemptLocator,
      );
      assert.equal(
        await readFile(path.join(
          carryForwardAttemptRoot,
          "raw",
          "stages",
          "DSGS_001",
          "response.bin",
        ), "utf8"),
        stageOneAccepted.rawEvidence,
      );
      const carriedArtifact = stageOneAccepted.artifacts[0]!;
      const carriedScreenKey = createHash("sha256")
        .update(carriedArtifact.screenId, "utf8")
        .digest("hex");
      assert.deepEqual(
        await readFile(path.join(
          carryForwardAttemptRoot,
          "download",
          "stages",
          "DSGS_001",
          "screens",
          `${carriedScreenKey}.html`,
        )),
        carriedArtifact.htmlBytes,
      );
      assert.deepEqual(
        await readFile(path.join(carryForwardRepo, "stitch", `${carriedArtifact.screenId}.html`)),
        carriedArtifact.htmlBytes,
      );
      await readFile(path.join(carryForwardRepo, "stitch", "DESIGN_MANIFEST.json"));
    } finally {
      await Promise.all([
        rm(repo, { recursive: true, force: true }),
        rm(rejectedRepo, { recursive: true, force: true }),
        ...additionalRepos.map((additionalRepo) => rm(additionalRepo, { recursive: true, force: true })),
      ]);
      await database.cleanup();
    }
  });
});

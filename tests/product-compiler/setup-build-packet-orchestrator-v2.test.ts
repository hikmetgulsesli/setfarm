import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import { createArtifactIndex } from "../../src/product-compiler/artifact-index.js";
import { ContentAddressedArtifactStore } from "../../src/product-compiler/artifact-store.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../src/product-compiler/canonical-json.js";
import {
  readProjectedDesignSourceAuthorityV2,
  runDesignSourceAuthorityV2,
  serializeAttemptTransportV2,
} from "../../src/product-compiler/design-source-runtime-v2.js";
import { bootstrapArtifactIndex } from "../../src/product-compiler/indexed-artifact-publisher.js";
import { ProductCompilationAttemptRepository } from "../../src/product-compiler/product-compilation-attempt-repository.js";
import { produceDesignGenerationTargetsV2 } from "../../src/product-compiler/producers/design-targets-v2.js";
import { compilePlanSemanticProposalV2 } from "../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import { renderProductSpecV2Compatibility } from "../../src/product-compiler/renderers/product-spec-v2-compatibility.js";
import { createRuntimeArtifactReader } from "../../src/product-compiler/runtime-artifact-reader.js";
import {
  assembleSetupBuildPacketContractsV2,
  orchestrateSetupBuildProductPacket,
  SetupBuildPacketError,
  type DesignSourceAttemptExpectationV2,
  type SetupConverterSourceV1,
} from "../../src/product-compiler/setup-build-packet-orchestrator.js";
import {
  createIsolatedTestDatabase,
  type TestDatabase,
} from "../execution-attempts/test-database.js";
import {
  CONTAINED_GAME_TASK,
  containedGamePlanProposalV2,
} from "./fixtures/product-semantics-v2.js";
import {
  stitchDownloadReceipts,
  validStitchHtml,
  validStitchPng,
} from "./fixtures/stitch-artifacts.js";

const RELEASE_SHA = "e".repeat(40);
const LIMITS = {
  maxPayloadBytes: 4 * 1024 * 1024,
  rootQuotaBytes: 16 * 1024 * 1024,
  minFreeBytes: 0,
};

function writeJson(file: string, value: unknown, canonical = false): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    canonical ? canonicalJsonStringify(value) : `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

function git(repo: string, args: string[]): string {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}

type NativeFixture = Readonly<{
  runId: string;
  repo: string;
  artifactRoot: string;
  planText: string;
  attemptId: string;
  designSourceExpectation: DesignSourceAttemptExpectationV2;
  converterSource: SetupConverterSourceV1;
  targetRef: string;
  surfaceRef: string;
  screenId: string;
  generatedFile: string;
  manifestPath: string;
}>;

async function createNativeV2Fixture(input: Readonly<{
  database: TestDatabase;
  roots: string[];
}>): Promise<NativeFixture> {
  const runId = "setup-packet-native-v2";
  const repo = fs.mkdtempSync(path.join(tmpdir(), "setfarm-setup-packet-native-v2-"));
  const artifactParent = fs.mkdtempSync(path.join(tmpdir(), "setfarm-setup-packet-native-v2-cas-"));
  input.roots.push(repo, artifactParent);
  const artifactRoot = path.join(artifactParent, "sha256");
  const releaseAdmissionHash = await input.database.seedV3ReleaseGoAdmission(RELEASE_SHA);
  await input.database.sql.unsafe(
    `INSERT INTO runs (
       id, workflow_id, task, status, protocol, protocol_version,
       compiler_release_sha, activation_preflight_hash, release_admission_hash
     ) VALUES ($1, 'feature-dev', $2, 'running', 'v3', 1, $3, $4, $5)`,
    [runId, CONTAINED_GAME_TASK, RELEASE_SHA, "f".repeat(64), releaseAdmissionHash],
  );
  const claims = await input.database.sql<Array<{ id: string }>>`
    INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
    VALUES (${runId}, 'design', NULL, 'setup-packet-native-v2-test')
    RETURNING id::text AS id
  `;
  const claimId = Number(claims[0]!.id);

  const compiled = compilePlanSemanticProposalV2({
    task: CONTAINED_GAME_TASK,
    proposal: containedGamePlanProposalV2(),
  });
  assert.equal(compiled.status, "canonicalized", JSON.stringify(compiled));
  if (compiled.status !== "canonicalized") throw new Error("native ProductSpecV2 fixture rejected");
  const targets = produceDesignGenerationTargetsV2(compiled.productSpec);
  assert.equal(targets.status, "produced", JSON.stringify(targets));
  if (targets.status !== "produced") throw new Error("native DesignGenerationTargetsV2 fixture rejected");
  const target = targets.generationTargets.targets[0]!;
  const placement = target.requiredControlPlacements[0]!;
  const statusObservable = target.requiredObservableSelectors.find((observable) =>
    observable.selector.kind === "accessibility");
  assert.equal(statusObservable?.selector.kind, "accessibility");
  if (!statusObservable || statusObservable.selector.kind !== "accessibility") {
    throw new Error("native design fixture lacks accessibility status observable");
  }
  const canvasSurface = target.containedSurfaceRefs.find((surfaceRef) =>
    surfaceRef !== statusObservable.selector.surfaceRef);
  assert.ok(canvasSurface);
  const screenId = "screen-setup-packet-native-v2";
  const htmlBytes = validStitchHtml([
    `<main data-surface-id="${target.surfaceRef}">`,
    `<button data-action="${placement.actionRef}" data-control-slot="${placement.controlSlotRef}">Start Game</button>`,
    `<section data-surface-id="${canvasSurface}"><canvas aria-label="Game canvas"></canvas></section>`,
    `<section data-surface-id="${statusObservable.selector.surfaceRef}"><div hidden role="status" aria-label="Game status">Playing</div></section>`,
    "</main>",
  ].join(""), "setup-packet-native-v2");
  const screenshotBytes = validStitchPng(251);
  const transport = {
    schema: "setfarm.stitch-attempt-transport.v1",
    total: 1,
    screens: [{ screenId, title: target.expectedScreenTitle }],
    screenSource: "direct",
    directCandidateTotal: 1,
    excludedDirectTotal: 0,
    directScreenEvidenceSchema: "setfarm.stitch-direct-screen-evidence.v2",
    directScreenEvidence: [{
      screenId,
      title: target.expectedScreenTitle,
      responsePaths: ["$result.screens[0]"],
      htmlAvailable: true,
      screenshotAvailable: true,
      ...stitchDownloadReceipts(screenId, htmlBytes, screenshotBytes),
      identityConflicts: [],
      disposition: "admitted_renderable_screen",
      missingEvidence: [],
    }],
    downloaded: [{
      screenId,
      title: target.expectedScreenTitle,
      htmlFile: `${screenId}.html`,
      screenshotFile: `${screenId}.png`,
    }],
  };
  const repository = new ProductCompilationAttemptRepository(input.database.sql);
  const authority = await runDesignSourceAuthorityV2({
    repo,
    runId,
    projectId: "stitch-setup-packet-native-v2",
    contract: {
      productSpec: compiled.productSpec,
      generationTargets: targets.generationTargets,
    },
    originClaimId: claimId,
    ownerClaimId: claimId,
    ownerInstanceId: "setup-packet-native-v2-test",
    producerReleaseSha: RELEASE_SHA,
    provider: "stitch",
    model: "GEMINI_3_1_PRO",
    deviceType: "DESKTOP",
    uiLanguage: "English",
    duplicateWaitMs: 500,
    duplicatePollMs: 10,
  }, {
    repository,
    generateStage: async ({ stageId, targetRefs }) => {
      assert.equal(stageId, "DSGS_001");
      assert.deepEqual(targetRefs, [target.targetId]);
      return {
        disposition: "accepted",
        response: transport,
        rawEvidence: serializeAttemptTransportV2(transport),
        artifacts: [{ screenId, htmlBytes, screenshotBytes }],
      };
    },
  });
  assert.equal(authority.runner.status, "accepted", JSON.stringify(authority.runner));
  if (authority.runner.status !== "accepted") throw new Error("native design-source attempt was not accepted");
  const projected = await readProjectedDesignSourceAuthorityV2(repo, {
    productSpec: compiled.productSpec,
    generationTargets: targets.generationTargets,
  });
  const binding = projected.responseBindings.bindings[0]!;
  assert.equal(binding.targetRef, target.targetId);
  assert.equal(binding.responseScreenId, screenId);

  const converterPath = path.resolve("scripts/stitch-to-jsx.mjs");
  const converterText = fs.readFileSync(converterPath, "utf8");
  const converterBytes = Buffer.from(converterText, "utf8");
  const converterSource: SetupConverterSourceV1 = {
    source: {
      schema: "setfarm.source-artifact-ref.v1",
      hash: createHash("sha256").update(converterBytes).digest("hex"),
      mediaType: "text/javascript",
      locator: "scripts/stitch-to-jsx.mjs",
      byteLength: converterBytes.byteLength,
    },
    text: converterText,
  };
  execFileSync(process.execPath, [converterPath, repo], {
    cwd: process.cwd(),
    stdio: "pipe",
  });
  const projectedScreenIndex = JSON.parse(
    fs.readFileSync(path.join(repo, "src", "screens", "SCREEN_INDEX.json"), "utf8"),
  );
  const projectedScreen = projectedScreenIndex.find((entry: any) => entry.screenId === screenId);
  assert.ok(projectedScreen);
  const generatedFile = String(projectedScreen.file);
  assert.equal(projectedScreen.projection.authoritySchema, "setfarm.design-interaction-graph.v2");
  assert.equal(projectedScreen.projection.targetRef, target.targetId);
  assert.equal(projectedScreen.controls[0]?.controlSlotRef, placement.controlSlotRef);
  assert.equal(
    projectedScreen.observables.length,
    target.requiredObservableSelectors.length,
  );

  fs.mkdirSync(path.join(repo, ".setfarm", "setup"), { recursive: true });
  fs.writeFileSync(path.join(repo, "package.json"), `${JSON.stringify({
    name: "contained-game",
    private: true,
    scripts: { build: "vite build", test: "vitest run" },
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(repo, "src", "main.tsx"), "export const main = true;\n");
  fs.writeFileSync(path.join(repo, "src", "game.ts"), "export const phase = 'ready';\n");
  const dependencyEvidence = { requested: [], approved: [], installed: [], rejected: [] };
  const manifestPath = path.join(repo, ".setfarm", "setup", "FILE_TREE_MANIFEST.json");
  writeJson(path.join(repo, ".setfarm", "setup", "SETUP_CERTIFICATE.json"), {
    schema: "setfarm.setup-certificate.v1",
    runId,
    projectName: "Contained Game",
    projectSlug: "contained-game",
    platform: "game",
    techStack: "browser-game",
    stackPackId: "browser-game-canvas",
    commands: { build: "npm run build", test: "npm test" },
    entrypoints: ["src/main.tsx", "src/App.tsx"],
    setupOwnedFiles: ["package.json"],
    forbiddenDuringImplement: ["package.json"],
    sharedFiles: [],
    scaffoldSnapshot: [
      "package.json",
      "src/main.tsx",
      "src/game.ts",
      "src/screens/SCREEN_INDEX.json",
      "src/screens/index.ts",
      ...(fs.existsSync(path.join(repo, "src", "index.css")) ? ["src/index.css"] : []),
      generatedFile,
    ],
    generatedDesignFiles: [generatedFile],
    designAuthority: {
      required: true,
      source: "stitch",
      screenMap: "stitch/SCREEN_MAP.json",
      rules: ["ProductSpecV2 target, response screen, and generated source must bind exactly."],
      conversionPolicy: "wrap_jsx",
      conversionNote: "Generated JSX is an immutable setup input.",
    },
    fileTreeManifestPath: ".setfarm/setup/FILE_TREE_MANIFEST.json",
    sharedGrantsPath: ".setfarm/setup/SHARED_GRANTS.json",
    targetResolutionRules: {},
    dependencyEvidence,
    buildEvidence: {
      buildCommand: "npm run build",
      artifactPath: "dist/index.html",
      stdoutPath: "",
      stderrPath: "",
    },
    createdAt: "2026-07-17T00:00:00.000Z",
  });
  writeJson(manifestPath, {
    schema: "setfarm.file-tree-manifest.v1",
    runId,
    stackPackId: "browser-game-canvas",
    resolvedTargets: [
      {
        storyId: "US-001",
        role: "action_handler",
        domainSlug: "game",
        targetSlug: "game-runtime",
        path: "src/game.ts",
        resolvedPath: "src/game.ts",
        ruleId: "browser-game.action_handler",
        collisionStatus: "unique",
        source: "scope_target",
      },
      {
        storyId: "US-001",
        role: "surface_component",
        surfaceId: target.surfaceRef,
        screenId,
        domainSlug: "game",
        targetSlug: "play-page",
        path: generatedFile,
        resolvedPath: generatedFile,
        ruleId: "browser-game.surface_component",
        collisionStatus: "unique",
        source: "scope_target",
      },
    ],
    dependencyPlan: dependencyEvidence,
    mockInjectionPoints: [],
    routeRegistrationPlan: [],
  });
  writeJson(path.join(repo, ".setfarm", "setup", "SHARED_GRANTS.json"), {
    schema: "setfarm.shared-grants.v1",
    version: 1,
    runId,
    grants: [],
  });

  git(repo, ["init", "-q"]);
  git(repo, ["config", "user.email", "setfarm-test@example.invalid"]);
  git(repo, ["config", "user.name", "Setfarm Test"]);
  git(repo, ["add", "."]);
  git(repo, ["commit", "-q", "-m", "native v2 fixture"]);
  await bootstrapArtifactIndex({
    index: createArtifactIndex(input.database.sql),
    store: new ContentAddressedArtifactStore(artifactRoot, { limits: LIMITS }),
    quotaBytes: LIMITS.rootQuotaBytes,
    maxPayloadBytes: LIMITS.maxPayloadBytes,
  });
  return {
    runId,
    repo,
    artifactRoot,
    planText: renderProductSpecV2Compatibility(compiled.productSpec),
    attemptId: authority.runner.attempt.attemptId,
    designSourceExpectation: {
      attemptId: authority.runner.attempt.attemptId,
      authorityHash: authority.runner.attempt.authorityHash,
      requestHash: authority.runner.attempt.requestHash,
      outputSealHash: authority.runner.attempt.outputSealHash!,
      productSpecHash: hashCanonicalJson(compiled.productSpec),
      generationTargetsHash: hashCanonicalJson(targets.generationTargets),
      compilerReleaseSha: RELEASE_SHA,
    },
    converterSource,
    targetRef: target.targetId,
    surfaceRef: target.surfaceRef,
    screenId,
    generatedFile,
    manifestPath,
  };
}

describe("setup-build native Product Build Packet v3 orchestration", { concurrency: 1 }, () => {
  const roots: string[] = [];
  let database: TestDatabase;

  before(async () => {
    database = await createIsolatedTestDatabase();
  });

  after(async () => {
    roots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true }));
    await database.cleanup();
  });

  it("activates and deep-replays a native v2 design closure, rejecting wrong attempts and topology drift", async () => {
    const fixture = await createNativeV2Fixture({ database, roots });
    const producer = {
      pass: "setup-build-product-packet-v3",
      codeSha: RELEASE_SHA,
      toolVersions: {
        node: process.versions.node,
        productCompiler: "4.0.0",
        stackTopologyCatalog: "1.0.0",
        productDeliveryProfileCatalog: "1.0.0",
        productEvidenceCapabilityPolicy: "1.0.0",
        runtimeEvidenceContractProducer: "1.0.0",
      },
    };

    await assert.rejects(
      assembleSetupBuildPacketContractsV2({
        sql: database.sql,
        runId: fixture.runId,
        repo: fixture.repo,
        planText: fixture.planText,
        producer,
        converterSource: fixture.converterSource,
        designSourceExpectation: {
          ...fixture.designSourceExpectation,
          attemptId: `PCA_${"0".repeat(64)}`,
        },
      }),
      (error: unknown) => error instanceof SetupBuildPacketError
        && error.code === "SETUP_PACKET_DESIGN_SOURCE_ATTEMPT_REJECTED",
    );

    const result = await orchestrateSetupBuildProductPacket({
      sql: database.sql,
      artifactRoot: fixture.artifactRoot,
      artifactLimits: LIMITS,
      runId: fixture.runId,
      expectedMode: "v3",
      repo: fixture.repo,
      planText: fixture.planText,
      productSemanticsVersion: "v2",
      converterSource: fixture.converterSource,
      designSourceExpectation: fixture.designSourceExpectation,
      ownerInstanceId: "setup-packet-native-v2-test",
    });
    assert.equal(result.compilation.activation, "activated", JSON.stringify(result.compilation));
    assert.equal(result.compilation.compilation.status, "sealed");
    assert.ok("productSpecV2" in result.contracts);
    if (!("productSpecV2" in result.contracts)) return;
    assert.equal(result.contracts.productSpecV2.schema, "setfarm.product-spec.v2");
    assert.equal(result.contracts.designGraphV2?.schema, "setfarm.design-interaction-graph.v2");
    assert.equal(result.contracts.storyPlanV2.schema, "setfarm.story-plan.v2");
    assert.equal(result.contracts.designSourceClosureV2.kind, "stitch");
    assert.equal(result.contracts.implementationSourceMapV1.designSourceKind, "stitch");
    assert.equal(result.contracts.implementationSourceMapV1.screens.length, 1);
    assert.equal(
      result.contracts.buildTopologyV1.pathBindings.find((binding) =>
        binding.path === fixture.generatedFile)?.role,
      "generated",
    );
    assert.equal(result.contracts.designSourceClosureV2.acceptedAttempt.attemptRef, fixture.attemptId);
    assert.equal(result.contracts.sourceHashes.generatedSources.length, 1);

    const sealed = await createRuntimeArtifactReader({
      sql: database.sql,
      artifactRoot: fixture.artifactRoot,
      artifactLimits: LIMITS,
    }).readExactSealedPacket(fixture.runId);
    assert.equal(sealed.packet.schema, "setfarm.product-build-packet.v3");
    if (sealed.packet.schema !== "setfarm.product-build-packet.v3") return;
    assert.equal(sealed.packet.designSourceKind, "stitch");
    assert.equal(sealed.productSpec.schema, "setfarm.product-spec.v2");
    assert.equal(sealed.designGraph?.schema, "setfarm.design-interaction-graph.v2");
    assert.equal(sealed.storyPlan.schema, "setfarm.story-plan.v2");
    assert.equal(sealed.designSourceClosure.kind, "stitch");
    assert.equal(sealed.designSources?.generationTargets.schema, "setfarm.design-generation-targets.v2");
    assert.equal(sealed.designSources?.renderedSemantics.schema, "setfarm.stitch-rendered-semantics.v2");
    assert.equal(sealed.designSources?.responseBindings.schema, "setfarm.stitch-target-response-bindings.v3");
    assert.equal(sealed.designSources?.responseBindings.bindings[0]?.targetRef, fixture.targetRef);
    assert.equal(sealed.refs.designGraph, sealed.designSourceClosure.designGraph.envelopeHash);

    const rows = await database.sql<Array<{ packets: number; refs: number }>>`
      SELECT (SELECT COUNT(*)::integer FROM product_packets WHERE run_id = ${fixture.runId}) AS packets,
             (SELECT COUNT(*)::integer FROM run_artifact_refs WHERE run_id = ${fixture.runId}) AS refs
    `;
    assert.deepEqual(rows.map((row) => ({ ...row })), [{ packets: 1, refs: 8 }]);

    const screenIndexPath = path.join(fixture.repo, "src", "screens", "SCREEN_INDEX.json");
    const exactScreenIndex = fs.readFileSync(screenIndexPath, "utf8");
    for (const mutate of [
      (screenIndex: any[]) => {
        screenIndex[0]!.controls[0]!.actionRef = "ACT_FORGED";
      },
      (screenIndex: any[]) => {
        screenIndex[0]!.observables[0]!.sourceElementRef = "E999999";
      },
      (screenIndex: any[]) => {
        screenIndex[0]!.projection.targetRef = "TARGET_FORGED";
      },
    ]) {
      const screenIndex = JSON.parse(exactScreenIndex);
      mutate(screenIndex);
      writeJson(screenIndexPath, screenIndex);
      await assert.rejects(
        assembleSetupBuildPacketContractsV2({
          sql: database.sql,
          runId: fixture.runId,
          repo: fixture.repo,
          planText: fixture.planText,
          producer: sealed.producer,
          converterSource: fixture.converterSource,
          designSourceExpectation: fixture.designSourceExpectation,
        }),
        (error: unknown) => error instanceof SetupBuildPacketError
          && [
            "SETUP_PACKET_JSON_INVALID",
            "SETUP_PACKET_GENERATED_SOURCE_MISSING",
            "SETUP_PACKET_GENERATED_SOURCE_TOPOLOGY_MISSING",
          ].includes(error.code),
      );
      fs.writeFileSync(screenIndexPath, exactScreenIndex, "utf8");
    }

    const manifest = JSON.parse(fs.readFileSync(fixture.manifestPath, "utf8"));
    const surfaceTarget = manifest.resolvedTargets.find((target: any) =>
      target.role === "surface_component" && target.path === fixture.generatedFile);
    surfaceTarget.screenId = "screen-corrupted-topology";
    writeJson(fixture.manifestPath, manifest);
    await assert.rejects(
      assembleSetupBuildPacketContractsV2({
        sql: database.sql,
        runId: fixture.runId,
        repo: fixture.repo,
        planText: fixture.planText,
        producer: sealed.producer,
        converterSource: fixture.converterSource,
        designSourceExpectation: fixture.designSourceExpectation,
      }),
      (error: unknown) => error instanceof SetupBuildPacketError
        && error.code === "SETUP_PACKET_GENERATED_SOURCE_TOPOLOGY_MISSING",
    );
  });
});

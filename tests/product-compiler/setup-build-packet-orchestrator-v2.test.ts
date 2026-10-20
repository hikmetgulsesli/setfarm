import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import type { ClaimContext } from "../../src/installer/steps/types.js";
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
  diagnosticRoot?: string;
  writerContext?: Record<string, string>;
}>;

type RetainedWriterWitness = Readonly<{ runId: string; diagnosticRoot: string }>;

async function withRetainedWriterLog<T>(
  diagnosticRoot: string,
  call: "first" | "second",
  materialize: () => Promise<T>,
): Promise<T> {
  const { selectedFreshInstallationRootV1 } = await import("../../src/installation/fresh-installation-selection-v1.js");
  // Logger prioritizes a selected fresh installation over SETFARM_DB_PATH.
  // Refuse that context; never clear or retarget its captured authority.
  assert.equal(selectedFreshInstallationRootV1(), null, "writer log isolation requires the admitted ordinary fixture context");
  const logRoot = fs.mkdtempSync(path.join(diagnosticRoot, `writer-log-${call}-`));
  const loggingSelectionPath = path.join(logRoot, "logging-selection.db");
  const logFile = path.join(logRoot, "logs", "workflow.log");
  const hadPreviousSelection = Object.hasOwn(process.env, "SETFARM_DB_PATH");
  const previousSelection = process.env.SETFARM_DB_PATH;
  try {
    // This path configures only the existing dynamic logger; SQL remains bound
    // explicitly to the owned clone through pgConfigureIsolatedTestDatabase.
    process.env.SETFARM_DB_PATH = loggingSelectionPath;
    writeJson(path.join(logRoot, "logging-scope.json"), {
      call, loggingSelectionPath, logFile, previousSelectionPresent: hadPreviousSelection,
      scope: "only this real materializeSetupBuildContracts invocation",
    });
    const result = await materialize();
    const logBytes = fs.readFileSync(logFile);
    assert.match(logBytes.toString("utf8"), /\[setup-handoff\]/);
    writeJson(path.join(logRoot, "logging-result.json"), {
      logFile, byteLength: logBytes.byteLength,
      sha256: createHash("sha256").update(logBytes).digest("hex"),
    });
    return result;
  } finally {
    if (hadPreviousSelection) process.env.SETFARM_DB_PATH = previousSelection!;
    else delete process.env.SETFARM_DB_PATH;
    const restoredPresence = Object.hasOwn(process.env, "SETFARM_DB_PATH") === hadPreviousSelection;
    const restoredValue = process.env.SETFARM_DB_PATH === previousSelection;
    writeJson(path.join(logRoot, "logging-restoration.json"), {
      call, logFile, restoredPresence, restoredValue,
      logExists: fs.existsSync(logFile),
    });
    assert.equal(restoredPresence, true);
    assert.equal(restoredValue, true);
  }
}

async function createNativeV2Fixture(input: Readonly<{
  database: TestDatabase;
  roots: string[];
  actualWriter?: boolean;
  noncanonicalAssertions?: boolean;
  retainedWitnesses?: RetainedWriterWitness[];
  prepareWriterDatabase?: () => Promise<void>;
  diagnostic?: (message: string) => void;
}>): Promise<NativeFixture> {
  const identity = input.actualWriter
    ? `writer-${input.noncanonicalAssertions ? "noncanonical" : "stock"}-${randomUUID()}`
    : "native-v2";
  const runId = input.actualWriter ? `setup-packet-${identity}` : "setup-packet-native-v2";
  const repo = fs.mkdtempSync(path.join(tmpdir(), `setfarm-setup-packet-${identity}-`));
  const artifactParent = fs.mkdtempSync(path.join(tmpdir(), `setfarm-setup-packet-${identity}-cas-`));
  input.roots.push(repo, artifactParent);
  const artifactRoot = path.join(artifactParent, "sha256");
  const diagnosticRoot = input.actualWriter ? path.join(artifactParent, "writer-role-witness") : undefined;
  let phase = "owned-database-admission";
  if (diagnosticRoot) {
    input.retainedWitnesses!.push({ runId, diagnosticRoot });
    input.diagnostic?.(`Retained actual-writer witness: ${diagnosticRoot}`);
    writeJson(path.join(diagnosticRoot, "identity.json"), {
      runId, repo, artifactRoot, diagnosticRoot, database: input.database.database,
      actualWriter: true, noncanonicalAssertions: Boolean(input.noncanonicalAssertions),
      cleanupPolicy: "retain new repo/CAS/diagnostics; dispose only fresh owned database",
    });
  }
  try {
    if (input.actualWriter) {
      assert.ok(input.prepareWriterDatabase);
      await input.prepareWriterDatabase();
    }
    phase = "accepted-design-source";
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

    const proposal = containedGamePlanProposalV2();
    if (input.noncanonicalAssertions) {
      const control = proposal.actions[0]!.observables.find((item: any) => item.selector.kind === "control");
      assert.ok(control);
      control.assertions = [
        { phase: "before", property: "visible_text", operator: "equals", expected: "Start Game" },
        { phase: "before", property: "visibility", operator: "equals", expected: true },
        { phase: "before", property: "enabled", operator: "equals", expected: true },
        { phase: "after", property: "visible_text", operator: "equals", expected: "Start Game" },
        { phase: "after", property: "visibility", operator: "equals", expected: true },
        { phase: "after", property: "enabled", operator: "equals", expected: true },
      ];
    }
    const compiled = compilePlanSemanticProposalV2({ task: CONTAINED_GAME_TASK, proposal });
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
    const screenId = input.actualWriter ? `screen-${identity}` : "screen-setup-packet-native-v2";
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
      projectId: input.actualWriter ? `stitch-${identity}` : "stitch-setup-packet-native-v2",
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
    phase = "executed-converter-attestation";
    let converterSource: SetupConverterSourceV1;
    if (input.actualWriter) {
      // Import only after the unsuffixed client is admitted to the owned clone.
      const { executeAttestedStitchConverter } = await import("../../src/installer/steps/05-setup-build/preclaim.js");
      converterSource = executeAttestedStitchConverter(converterPath, repo);
      const conversionResult = JSON.parse(fs.readFileSync(
        path.join(repo, ".setfarm", "setup", "STITCH_TO_JSX_RESULT.json"), "utf8",
      ));
      assert.deepEqual(conversionResult, { schema: "setfarm.stitch-to-jsx-result.v1", status: "passed" });
      writeJson(path.join(diagnosticRoot!, "converter-source.json"), converterSource);
      writeJson(path.join(diagnosticRoot!, "conversion-result.json"), conversionResult);
    } else {
      const converterText = fs.readFileSync(converterPath, "utf8");
      const converterBytes = Buffer.from(converterText, "utf8");
      converterSource = {
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
    }
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
    const writerContext = input.actualWriter ? {
      task: CONTAINED_GAME_TASK,
      prd: renderProductSpecV2Compatibility(compiled.productSpec),
      platform: "game", tech_stack: "browser-game", stack_pack_id: "browser-game-canvas",
      product_semantics_version: "v2", project_name: "Contained Game",
      project_display_name: "Contained Game", project_slug: "contained-game",
    } : undefined;
    phase = "actual-setup-writer";
    if (input.actualWriter) {
      const actionRef = placement.actionRef;
      const actionFile = `src/features/game/${actionRef.toLowerCase()}.ts`;
      fs.mkdirSync(path.dirname(path.join(repo, actionFile)), { recursive: true });
      fs.writeFileSync(path.join(repo, actionFile), "export const startGame = () => 'playing';\n");
      fs.mkdirSync(path.join(repo, "src", "game"), { recursive: true });
      fs.writeFileSync(path.join(repo, "src", "game", "game-runtime.ts"), "export const phase = 'ready';\n");
      const scopeTargets = [
        { role: "surface_component", surface_id: target.surfaceRef, screen_id: screenId },
        { role: "action_handler", domain_slug: "game", target_slug: "start-game", action_ids: [actionRef] },
        { role: "game_runtime", domain_slug: "game", target_slug: "game-runtime" },
      ];
      await input.database.sql`
        INSERT INTO stories (
          id, run_id, story_index, story_id, title, description, acceptance_criteria,
          status, retry_count, max_retries, depends_on, scope_files, shared_files,
          scope_targets, requested_dependencies, shared_edit_requests, resolved_scope_files,
          scope_description, file_skeletons, implementation_contract
        ) VALUES (
          ${`${runId}-US-001`}, ${runId}, 0, 'US-001', 'Start the contained game',
          'Start the game from its exact generated play screen.',
          ${JSON.stringify(["Start Game updates the contained game canvas and status panel."])},
          'pending', 0, 5, '[]', '[]', '[]', ${JSON.stringify(scopeTargets)},
          '[]', '[]', '[]', 'Own the play screen and game start runtime.', '{}', '{}'
        )
      `;
      writeJson(path.join(diagnosticRoot!, "writer-input.json"), {
        runId, repo, context: writerContext, buildCommand: "npm run build", scopeTargets,
        requested_dependencies: [], productSpec: compiled.productSpec,
        generationTargets: targets.generationTargets, proposal,
      });
      const { materializeSetupBuildContracts } = await import("../../src/installer/setup-handoff.js");
      const written = await withRetainedWriterLog(diagnosticRoot!, "first", () =>
        materializeSetupBuildContracts(runId, repo, writerContext!, "npm run build"));
      writeJson(path.join(diagnosticRoot!, "actual-writer-result.json"), written);
      assert.equal(written.certificate.stackPackId, "browser-game-canvas");
      assert.equal(written.manifest.resolvedTargets.filter((item) =>
        item.path === generatedFile && item.role === "surface_component"
        && item.surfaceId === target.surfaceRef && item.screenId === screenId
        && item.storyId === "US-001").length, 1);
      assert.deepEqual(written.certificate.dependencyEvidence, dependencyEvidence);
      assert.deepEqual(written.manifest.dependencyPlan, dependencyEvidence);
      assert.equal(fs.existsSync(path.join(repo, "package-lock.json")), false);
      assert.equal(fs.existsSync(path.join(repo, "node_modules")), false);
    } else {
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
    }

    phase = "fixture-git-and-artifact-index";
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
      ...(diagnosticRoot ? { diagnosticRoot, writerContext } : {}),
    };
  } catch (error) {
    if (diagnosticRoot) writeJson(path.join(diagnosticRoot, "fixture-failure.json"), {
      phase, name: error instanceof Error ? error.name : undefined,
      message: error instanceof Error ? error.message : String(error),
      code: (error as { code?: unknown })?.code,
      evidence: (error as { evidence?: unknown })?.evidence,
    });
    throw error;
  }
}

describe("setup-build native Product Build Packet v3 orchestration", { concurrency: 1 }, () => {
  const roots: string[] = [];
  // New causal witnesses are retained; the original fixture still owns roots cleanup.
  const retainedRoots: string[] = [];
  const retainedWitnesses: RetainedWriterWitness[] = [];
  let database: TestDatabase;
  let writerDatabase: typeof import("../../src/db-pg.js") | undefined;
  let writerDatabaseConfigured = false;
  let writerDatabasePreparation: Promise<void> | undefined;

  async function prepareWriterDatabase(): Promise<void> {
    if (!writerDatabasePreparation) writerDatabasePreparation = (async () => {
      writerDatabase = await import("../../src/db-pg.js");
      writerDatabase.pgConfigureIsolatedTestDatabase(database.url);
      writerDatabaseConfigured = true;
      await writerDatabase.initializeInternalProductionCurrentEntryDatabaseV1();
    })();
    // Cache a refusal too; never reset/rebind an already-connected module.
    await writerDatabasePreparation;
    const selectedDatabases: string[] = [];
    for (const sql of [database.sql, writerDatabase!.getSql()]) {
      const rows = await sql.unsafe<Array<{ database: string }>>("SELECT current_database() AS database");
      assert.equal(rows.length, 1);
      assert.equal(rows[0]!.database, database.database);
      selectedDatabases.push(rows[0]!.database);
    }
    for (const witness of retainedWitnesses) writeJson(path.join(witness.diagnosticRoot, "database-selection.json"), {
      expectedDatabase: database.database, selectedDatabases,
    });
  }

  before(async () => {
    database = await createIsolatedTestDatabase();
  });

  after(async () => {
    roots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true }));
    // Snapshot only this fixture's neutral rows before normal owned-clone disposal.
    try {
      for (const witness of retainedWitnesses) {
        const runs = await database.sql`SELECT id, status, protocol, compiler_release_sha FROM runs WHERE id = ${witness.runId}`;
        const stories = await database.sql`
          SELECT story_id, scope_targets, requested_dependencies, scope_files,
                 resolved_scope_files, implementation_contract
          FROM stories WHERE run_id = ${witness.runId} ORDER BY story_index
        `;
        const attempts = await database.sql`
          SELECT attempt_id, state, disposition, authority_hash, request_hash, output_seal_hash
          FROM product_compilation_attempts WHERE run_id = ${witness.runId}
        `;
        writeJson(path.join(witness.diagnosticRoot, "owned-database-rows-before-disposal.json"), {
          database: database.database, runs, stories, attempts,
        });
      }
    } finally {
      try {
        if (writerDatabaseConfigured) await writerDatabase!.pgClose();
        for (const witness of retainedWitnesses) writeJson(path.join(witness.diagnosticRoot, "unsuffixed-client-close.json"), {
          status: writerDatabaseConfigured ? "closed" : "not-configured", beforeOwnedDatabaseCleanup: true,
        });
      } finally {
        await database.cleanup();
        for (const witness of retainedWitnesses) writeJson(path.join(witness.diagnosticRoot, "owned-database-cleanup.json"), {
          status: "disposed", database: database.database, retainedRoots,
        });
      }
    }
  });

  async function assertActualWriterPacket(noncanonicalAssertions: boolean, diagnostic: (message: string) => void): Promise<void> {
    const fixture = await createNativeV2Fixture({
      database, roots: retainedRoots, actualWriter: true, noncanonicalAssertions,
      retainedWitnesses, prepareWriterDatabase, diagnostic,
    });
    const producer = {
      pass: "setup-build-product-packet-v3", codeSha: RELEASE_SHA,
      toolVersions: {
        node: process.versions.node, productCompiler: "4.0.0", stackTopologyCatalog: "1.0.0",
        productDeliveryProfileCatalog: "1.0.0", productEvidenceCapabilityPolicy: "1.0.0",
        runtimeEvidenceContractProducer: "1.0.0",
      },
    };
    const assemblyInput = {
      runId: fixture.runId, repo: fixture.repo, planText: fixture.planText, producer,
      converterSource: fixture.converterSource, designSourceExpectation: fixture.designSourceExpectation,
    };
    const exactSources = [
      ".setfarm/setup/SETUP_CERTIFICATE.json", ".setfarm/setup/FILE_TREE_MANIFEST.json",
      ".setfarm/setup/SHARED_GRANTS.json", "src/screens/SCREEN_INDEX.json", fixture.generatedFile,
    ].map((locator) => {
      const bytes = fs.readFileSync(path.join(fixture.repo, locator));
      return { locator, hash: createHash("sha256").update(bytes).digest("hex"), byteLength: bytes.byteLength, text: bytes.toString("utf8") };
    });
    writeJson(path.join(fixture.diagnosticRoot!, "assembly-input.json"), {
      database: database.database, ...assemblyInput, targetRef: fixture.targetRef,
      surfaceRef: fixture.surfaceRef, screenId: fixture.screenId, generatedFile: fixture.generatedFile,
      exactSources,
      topologyInput: "Actual certificate, manifest, shared grants, ProductSpec and repo bytes retained above/in repo; private assembler constructs topology.",
    });
    let assembled: Awaited<ReturnType<typeof assembleSetupBuildPacketContractsV2>> | undefined;
    let assemblyError: unknown;
    let assemblyThrew = false;
    try {
      assembled = await assembleSetupBuildPacketContractsV2({ sql: database.sql, ...assemblyInput });
    } catch (error) {
      assemblyThrew = true;
      assemblyError = error;
    }
    // Preserve the real outcome before any permanent acceptance/RED qualification assertion.
    writeJson(path.join(fixture.diagnosticRoot!, "assembly-outcome.json"), assembled ? {
      status: "assembled", contracts: assembled,
    } : {
      status: "threw", name: assemblyError instanceof Error ? assemblyError.name : undefined,
      message: assemblyError instanceof Error ? assemblyError.message : String(assemblyError),
      stack: assemblyError instanceof Error ? assemblyError.stack : undefined,
      code: (assemblyError as { code?: unknown })?.code,
      evidence: (assemblyError as { evidence?: unknown })?.evidence,
    });
    if (assemblyThrew) {
      assert.ok(assemblyError instanceof SetupBuildPacketError, "writer qualification must reach the actual SourceMap gate");
      assert.equal(assemblyError.code, "SETUP_PACKET_IMPLEMENTATION_SOURCE_MAP_REJECTED");
      assert.deepEqual(assemblyError.evidence.rejectionCodes, ["IMPLEMENTATION_SOURCE_MAP_V1_SOURCE_OWNERSHIP_MISMATCH"]);
      const diagnostics = assemblyError.evidence.diagnostics as Array<{ code: string; reference?: string }>;
      assert.ok(diagnostics.some((item) => item.code === "IMPLEMENTATION_SOURCE_MAP_V1_SOURCE_OWNERSHIP_MISMATCH"
        && item.reference === fixture.targetRef));
      assert.equal(diagnostics.some((item) => item.code === "IMPLEMENTATION_SOURCE_MAP_V1_OBSERVABLE_IDENTITY_MISMATCH"), false);
      assert.ifError(assemblyError); // Intended acceptance stays RED until the actual writer is fixed.
    }
    assert.ok(assembled, "actual setup writer must assemble the native packet");
    const certificate = JSON.parse(exactSources[0]!.text);
    assert.deepEqual(certificate.generatedDesignFiles.filter((locator: string) => /\.(tsx|jsx)$/i.test(locator)), [fixture.generatedFile]);
    assert.equal(assembled.implementationSourceMapV1.screens.length, 1);
    const mappedScreen = assembled.implementationSourceMapV1.screens[0]!;
    assert.equal(mappedScreen.targetRef, fixture.targetRef);
    assert.equal(mappedScreen.responseScreenId, fixture.screenId);
    assert.equal(mappedScreen.path, fixture.generatedFile);
    assert.equal(mappedScreen.contentHash, exactSources[4]!.hash);
    assert.equal(mappedScreen.storyId, "US-001");
    const binding = assembled.buildTopologyV1.pathBindings.find((item) => item.path === fixture.generatedFile);
    assert.ok(binding);
    assert.equal(binding.role, "generated");
    assert.equal(binding.presence, "present");
    assert.equal(binding.knownContentHash, exactSources[4]!.hash);
    const owner = assembled.buildTopologyV1.owners.find((item) => item.id === binding.ownerRef);
    assert.ok(owner?.kind === "story");
    assert.equal(owner.storyRef, "US-001");
    const story = assembled.storyPlanV2.stories.find((item) => item.id === "US-001");
    assert.ok(story);
    assert.equal(story.ownerRef, binding.ownerRef);
    assert.equal(mappedScreen.ownerRef, binding.ownerRef);
    assert.equal(mappedScreen.pathRef, binding.id);
    assert.ok(story.ownedPathRefs.includes(binding.id));
    const { materializeSetupBuildContracts } = await import("../../src/installer/setup-handoff.js");
    const repeated = await withRetainedWriterLog(fixture.diagnosticRoot!, "second", () =>
      materializeSetupBuildContracts(fixture.runId, fixture.repo, fixture.writerContext!, "npm run build"));
    writeJson(path.join(fixture.diagnosticRoot!, "actual-writer-second-result.json"), repeated);
    assert.deepEqual(repeated.certificate.generatedDesignFiles, certificate.generatedDesignFiles);
    assert.deepEqual(repeated.certificate.generatedDesignFiles.filter((locator) => /\.(tsx|jsx)$/i.test(locator)), [fixture.generatedFile]);
    assert.deepEqual(repeated.certificate.dependencyEvidence, { requested: [], approved: [], installed: [], rejected: [] });
    assert.equal(fs.existsSync(path.join(fixture.repo, "package-lock.json")), false);
    assert.equal(fs.existsSync(path.join(fixture.repo, "node_modules")), false);

    // These post-acceptance probes leave the causal writer/packet inputs and
    // acceptance assertions above unchanged. Every temporary projection/source
    // mutation is restored; new witness files and the handwritten file remain.
    const sourcePath = path.join(fixture.repo, fixture.generatedFile);
    const indexPath = path.join(fixture.repo, "src/screens/SCREEN_INDEX.json");
    const originalSource = fs.readFileSync(sourcePath);
    const originalIndex = fs.readFileSync(indexPath);
    const handwrittenFile = "src/screens/UnindexedHandwritten.tsx";
    fs.writeFileSync(path.join(fixture.repo, handwrittenFile), originalSource);
    const materialize = () => withRetainedWriterLog(fixture.diagnosticRoot!, "second", () =>
      materializeSetupBuildContracts(fixture.runId, fixture.repo, fixture.writerContext!, "npm run build"));
    const withHandwritten = await materialize();
    writeJson(path.join(fixture.diagnosticRoot!, "actual-writer-unindexed-result.json"), withHandwritten);
    assert.deepEqual(withHandwritten.certificate.generatedDesignFiles.filter((locator) => /\.(tsx|jsx)$/i.test(locator)), [fixture.generatedFile]);
    assert.equal(withHandwritten.certificate.generatedDesignFiles.includes(handwrittenFile), false);

    const assertAdmissionRejected = async (name: string): Promise<void> => {
      let refusal: unknown;
      try { await materialize(); } catch (error) { refusal = error; }
      writeJson(path.join(fixture.diagnosticRoot!, `admission-${name}-outcome.json`), {
        code: (refusal as { code?: unknown })?.code,
        message: refusal instanceof Error ? refusal.message : String(refusal),
      });
      assert.equal((refusal as { code?: unknown })?.code, "SETUP_GENERATED_SCREEN_ADMISSION_REJECTED", name);
    };
    try {
      const forgedIndex = JSON.parse(originalIndex.toString("utf8"));
      forgedIndex[0].file = handwrittenFile;
      for (const entry of [...forgedIndex[0].controls, ...forgedIndex[0].observables, ...forgedIndex[0].rejectedControls]) {
        entry.generatedSourceLocator = handwrittenFile;
      }
      writeJson(indexPath, forgedIndex);
      await assertAdmissionRejected("handwritten-without-direct-manifest-binding");
    } finally {
      fs.writeFileSync(indexPath, originalIndex);
    }
    for (const projection of [
      "stitch/GENERATION_TARGETS.json", "stitch/STITCH_RESPONSE_BINDINGS.json",
      "stitch/DESIGN_INTERACTION_GRAPH_V2.json",
    ]) {
      const projectionPath = path.join(fixture.repo, projection);
      const retainedPath = path.join(fixture.diagnosticRoot!, `temporarily-missing-${path.basename(projection)}`);
      fs.renameSync(projectionPath, retainedPath);
      try { await assertAdmissionRejected(`missing-${path.basename(projection)}`); }
      finally { fs.renameSync(retainedPath, projectionPath); }
    }
    const graphPath = path.join(fixture.repo, "stitch/DESIGN_INTERACTION_GRAPH_V2.json");
    const originalGraph = fs.readFileSync(graphPath);
    try {
      const driftedGraph = JSON.parse(originalGraph.toString("utf8"));
      driftedGraph.generationTargetsHash = "0".repeat(64);
      writeJson(graphPath, driftedGraph);
      await assertAdmissionRejected("graph-generation-target-hash-drift");
    } finally {
      fs.writeFileSync(graphPath, originalGraph);
    }
    try {
      // A replacement decoder would leave this invalid byte only in a comment,
      // so source validation alone cannot stand in for fatal UTF-8 decoding.
      fs.writeFileSync(sourcePath, Buffer.concat([originalSource, Buffer.from("\n// invalid UTF-8: "), Buffer.from([0xff])]));
      await assertAdmissionRejected("invalid-utf8-source");
      fs.writeFileSync(sourcePath, Buffer.concat([originalSource, Buffer.from("\n// "), Buffer.alloc(16 * 1024 * 1024, 0x20)]));
      await assertAdmissionRejected("oversize-source");
    } finally {
      fs.writeFileSync(sourcePath, originalSource);
    }
    const retainedIndex = path.join(fixture.diagnosticRoot!, "preconversion-SCREEN_INDEX.json");
    fs.renameSync(indexPath, retainedIndex);
    try {
      const preparing = await materialize();
      writeJson(path.join(fixture.diagnosticRoot!, "actual-writer-preconversion-result.json"), preparing);
      assert.deepEqual(preparing.certificate.generatedDesignFiles.filter((locator) => /\.(tsx|jsx)$/i.test(locator)), []);
    } finally {
      fs.renameSync(retainedIndex, indexPath);
    }
    const restored = await materialize();
    writeJson(path.join(fixture.diagnosticRoot!, "actual-writer-restored-result.json"), restored);
    assert.deepEqual(restored.certificate.generatedDesignFiles, certificate.generatedDesignFiles);
    assert.deepEqual(fs.readFileSync(sourcePath), originalSource);
    assert.deepEqual(fs.readFileSync(indexPath), originalIndex);
  }

  it("sixth source-map actual-writer stock assertions", async (t) => {
    await assertActualWriterPacket(false, (message) => t.diagnostic(message));
  });

  it("sixth source-map actual-writer noncanonical assertions", async (t) => {
    await assertActualWriterPacket(true, (message) => t.diagnostic(message));
  });

  it("keeps native retry ready after real regeneration repairs stale indexed source", async (t) => {
    const fixture = await createNativeV2Fixture({
      database, roots: retainedRoots, actualWriter: true,
      retainedWitnesses, prepareWriterDatabase, diagnostic: (message) => t.diagnostic(message),
    });
    const diagnosticRoot = fixture.diagnosticRoot!;
    const { executeAttestedStitchConverter, writeSetupHandoff } = await import("../../src/installer/steps/05-setup-build/preclaim.js");
    const { resolvePlatformScript } = await import("../../src/installer/paths.js");
    const { selectedFreshInstallationRootV1 } = await import("../../src/installation/fresh-installation-selection-v1.js");
    const ctx: ClaimContext = {
      runId: fixture.runId, stepId: "setup-build", task: CONTAINED_GAME_TASK, retryCount: 1,
      context: { ...fixture.writerContext!, repo: fixture.repo },
    };
    const producer = {
      pass: "setup-build-product-packet-v3", codeSha: RELEASE_SHA,
      toolVersions: {
        node: process.versions.node, productCompiler: "4.0.0", stackTopologyCatalog: "1.0.0",
        productDeliveryProfileCatalog: "1.0.0", productEvidenceCapabilityPolicy: "1.0.0",
        runtimeEvidenceContractProducer: "1.0.0",
      },
    };
    const errorEvidence = (error: unknown) => {
      const detail = error as { code?: unknown; evidence?: unknown; status?: unknown; signal?: unknown; stdout?: Buffer | string; stderr?: Buffer | string } | undefined;
      return {
        name: error instanceof Error ? error.name : undefined,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        code: detail?.code, evidence: detail?.evidence, status: detail?.status, signal: detail?.signal,
        stdout: detail?.stdout?.toString(), stderr: detail?.stderr?.toString(),
      };
    };
    const sourceLocators = [
      ".setfarm/setup/SETUP_CERTIFICATE.json", ".setfarm/setup/FILE_TREE_MANIFEST.json",
      ".setfarm/setup/SHARED_GRANTS.json", "src/screens/SCREEN_INDEX.json", fixture.generatedFile,
      "stitch/GENERATION_TARGETS.json", "stitch/STITCH_RESPONSE_BINDINGS.json",
      "stitch/DESIGN_INTERACTION_GRAPH_V2.json", "stitch/DESIGN_MANIFEST.json",
      ".setfarm/setup/STITCH_TO_JSX_RESULT.json", ".setfarm/setup/DESIGN_IMPORT_VALIDATE.json",
    ];
    const retainSources = (phase: string) => {
      const exactSources = sourceLocators.map((locator) => {
        const sourcePath = path.join(fixture.repo, locator);
        if (!fs.existsSync(sourcePath)) return { locator, presence: "absent" };
        const bytes = fs.readFileSync(sourcePath);
        const retainedPath = path.join(diagnosticRoot, `retry-${phase}-sources`, locator);
        fs.mkdirSync(path.dirname(retainedPath), { recursive: true });
        fs.writeFileSync(retainedPath, bytes);
        return {
          locator, presence: "present", retainedPath, byteLength: bytes.byteLength,
          hash: createHash("sha256").update(bytes).digest("hex"), text: bytes.toString("utf8"),
        };
      });
      writeJson(path.join(diagnosticRoot, `retry-${phase}-sources.json`), exactSources);
      return exactSources;
    };
    const assembleRetained = async (phase: string, converterSource: SetupConverterSourceV1) => {
      const assemblyInput = {
        runId: fixture.runId, repo: fixture.repo, planText: fixture.planText, producer,
        converterSource, designSourceExpectation: fixture.designSourceExpectation,
      };
      writeJson(path.join(diagnosticRoot, `retry-${phase}-assembly-input.json`), {
        database: database.database, ...assemblyInput, exactSources: retainSources(phase),
      });
      try {
        const contracts = await assembleSetupBuildPacketContractsV2({ sql: database.sql, ...assemblyInput });
        writeJson(path.join(diagnosticRoot, `retry-${phase}-assembly-outcome.json`), { status: "assembled", contracts });
        return contracts;
      } catch (error) {
        writeJson(path.join(diagnosticRoot, `retry-${phase}-assembly-outcome.json`), { status: "threw", ...errorEvidence(error) });
        throw error;
      }
    };
    const handoffRetained = async (
      call: "before-regeneration" | "after-regeneration",
      claim: ClaimContext = ctx,
      logLabel: string = call,
    ) => {
      // A refused writer logs through the actual wrapper, before the writer's
      // success-only [setup-handoff] marker used by the existing helper.
      assert.equal(selectedFreshInstallationRootV1(), null, "retry log isolation requires the admitted ordinary fixture context");
      const logRoot = fs.mkdtempSync(path.join(diagnosticRoot, `retry-handoff-${logLabel}-`));
      const loggingSelectionPath = path.join(logRoot, "logging-selection.db");
      const logFile = path.join(logRoot, "logs", "workflow.log");
      const previousSelectionPresent = Object.hasOwn(process.env, "SETFARM_DB_PATH");
      const previousSelection = process.env.SETFARM_DB_PATH;
      writeJson(path.join(logRoot, "input.json"), {
        call, ctx: claim, repo: fixture.repo, buildCommand: "npm run build", loggingSelectionPath, logFile,
        previousSelectionPresent,
        stage: call === "before-regeneration" ? "before_native_stitch_regeneration" : "strict",
      });
      let callError: unknown;
      let callThrew = false;
      try {
        process.env.SETFARM_DB_PATH = loggingSelectionPath;
        if (call === "before-regeneration") {
          await writeSetupHandoff(claim, fixture.repo, "npm run build", "before_native_stitch_regeneration");
        } else {
          await writeSetupHandoff(claim, fixture.repo, "npm run build");
        }
      } catch (error) {
        callThrew = true;
        callError = error;
        throw error;
      } finally {
        if (previousSelectionPresent) process.env.SETFARM_DB_PATH = previousSelection!;
        else delete process.env.SETFARM_DB_PATH;
        const restoredPresence = Object.hasOwn(process.env, "SETFARM_DB_PATH") === previousSelectionPresent;
        const restoredValue = process.env.SETFARM_DB_PATH === previousSelection;
        const logBytes = fs.existsSync(logFile) ? fs.readFileSync(logFile) : undefined;
        writeJson(path.join(logRoot, "outcome.json"), {
          call, ctx: claim, status: callThrew ? "threw" : "returned",
          ...(callThrew ? { error: errorEvidence(callError) } : {}),
          logFile, logExists: Boolean(logBytes), byteLength: logBytes?.byteLength,
          sha256: logBytes ? createHash("sha256").update(logBytes).digest("hex") : undefined,
          restoredPresence, restoredValue,
        });
        assert.equal(restoredPresence, true);
        assert.equal(restoredValue, true);
      }
      assert.match(fs.readFileSync(logFile, "utf8"), /\[module:setup-build preclaim\]/);
    };

    const sourcePath = path.join(fixture.repo, fixture.generatedFile);
    const originalSource = fs.readFileSync(sourcePath);
    let phase = "original-packet";
    let regenerationPassed = false;
    writeJson(path.join(diagnosticRoot, "retry-initial-context.json"), ctx);
    try {
      await assembleRetained("original", fixture.converterSource);
      phase = "stale-source";
      const sourceText = originalSource.toString("utf8");
      const closingMain = sourceText.lastIndexOf("</main>");
      assert.ok(closingMain >= 0, "fixture generated source must contain its real main element");
      fs.writeFileSync(sourcePath, `${sourceText.slice(0, closingMain)}<button>Stale retry control</button>${sourceText.slice(closingMain)}`);
      retainSources("stale");
      phase = "before-regeneration-handoff";
      await handoffRetained("before-regeneration");
      writeJson(path.join(diagnosticRoot, "retry-before-regeneration-context.json"), ctx);

      phase = "attested-regeneration";
      const converterPath = resolvePlatformScript("stitch-to-jsx.mjs");
      writeJson(path.join(diagnosticRoot, "retry-regeneration-input.json"), { converterPath, repo: fixture.repo });
      const converterSource = executeAttestedStitchConverter(converterPath, fixture.repo);
      writeJson(path.join(diagnosticRoot, "retry-converter-source.json"), converterSource);
      const conversionResult = JSON.parse(fs.readFileSync(path.join(fixture.repo, ".setfarm/setup/STITCH_TO_JSX_RESULT.json"), "utf8"));
      writeJson(path.join(diagnosticRoot, "retry-conversion-result.json"), conversionResult);
      assert.deepEqual(conversionResult, { schema: "setfarm.stitch-to-jsx-result.v1", status: "passed" });
      phase = "generated-screen-validator";
      const validatorPath = resolvePlatformScript("generated-screen-validator.mjs");
      writeJson(path.join(diagnosticRoot, "retry-validator-input.json"), {
        executable: "node", args: [validatorPath, fixture.repo, "--fix"], cwd: fixture.repo, timeout: 60000,
      });
      const validatorStdout = execFileSync("node", [validatorPath, fixture.repo, "--fix"], {
        cwd: fixture.repo, timeout: 60000, stdio: "pipe", encoding: "utf8",
      });
      fs.writeFileSync(path.join(diagnosticRoot, "retry-validator.stdout.txt"), validatorStdout);
      const validatorReport = JSON.parse(fs.readFileSync(path.join(fixture.repo, ".setfarm/setup/DESIGN_IMPORT_VALIDATE.json"), "utf8"));
      writeJson(path.join(diagnosticRoot, "retry-validator-report.json"), validatorReport);
      assert.equal(validatorReport.status, "pass", JSON.stringify(validatorReport));
      assert.equal(validatorReport.fixMode, true);
      assert.deepEqual(validatorReport.failedRules, []);
      regenerationPassed = true;

      phase = "strict-handoff-after-regeneration";
      await handoffRetained("after-regeneration");
      writeJson(path.join(diagnosticRoot, "retry-after-regeneration-context.json"), ctx);
      phase = "repaired-packet";
      // Assemble and retain the healthy real authority BEFORE the context oracle.
      const assembled = await assembleRetained("repaired", converterSource);
      const certificate = JSON.parse(fs.readFileSync(path.join(fixture.repo, ".setfarm/setup/SETUP_CERTIFICATE.json"), "utf8"));
      const manifest = JSON.parse(fs.readFileSync(fixture.manifestPath, "utf8"));
      const currentSourceHash = createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex");
      assert.deepEqual(certificate.generatedDesignFiles.filter((locator: string) => /\.(tsx|jsx)$/i.test(locator)), [fixture.generatedFile]);
      assert.equal(manifest.resolvedTargets.filter((item: any) =>
        item.path === fixture.generatedFile && item.role === "surface_component"
        && item.surfaceId === fixture.surfaceRef && item.screenId === fixture.screenId
        && item.storyId === "US-001").length, 1);
      assert.equal(assembled.implementationSourceMapV1.screens.length, 1);
      const mappedScreen = assembled.implementationSourceMapV1.screens[0]!;
      assert.equal(mappedScreen.targetRef, fixture.targetRef);
      assert.equal(mappedScreen.responseScreenId, fixture.screenId);
      assert.equal(mappedScreen.path, fixture.generatedFile);
      assert.equal(mappedScreen.contentHash, currentSourceHash);
      assert.equal(mappedScreen.storyId, "US-001");
      const binding = assembled.buildTopologyV1.pathBindings.find((item) => item.path === fixture.generatedFile);
      assert.ok(binding);
      assert.equal(binding.role, "generated");
      assert.equal(binding.presence, "present");
      assert.equal(binding.knownContentHash, currentSourceHash);
      const owner = assembled.buildTopologyV1.owners.find((item) => item.id === binding.ownerRef);
      assert.ok(owner?.kind === "story");
      assert.equal(owner.storyRef, "US-001");
      const story = assembled.storyPlanV2.stories.find((item) => item.id === "US-001");
      assert.ok(story);
      assert.equal(story.ownerRef, binding.ownerRef);
      assert.equal(mappedScreen.ownerRef, binding.ownerRef);
      assert.equal(mappedScreen.pathRef, binding.id);
      assert.ok(story.ownedPathRefs.includes(binding.id));
      assert.deepEqual(certificate.dependencyEvidence, { requested: [], approved: [], installed: [], rejected: [] });
      assert.equal(fs.existsSync(path.join(fixture.repo, "package-lock.json")), false);
      assert.equal(fs.existsSync(path.join(fixture.repo, "node_modules")), false);

      phase = "final-readiness";
      writeJson(path.join(diagnosticRoot, "retry-final-readiness-context.json"), ctx);
      for (const key of ["baseline_fail", "compat_fail", "previous_failure", "failure_category", "failure_suggestion"]) {
        assert.equal(ctx.context[key], undefined, `healthy regenerated native retry must not retain ${key}`);
      }
      assert.equal(ctx.context.setup_certificate_path, ".setfarm/setup/SETUP_CERTIFICATE.json");
      assert.equal(ctx.context.file_tree_manifest_path, ".setfarm/setup/FILE_TREE_MANIFEST.json");
      writeJson(path.join(diagnosticRoot, "retry-outcome.json"), { status: "ready", ctx });

      // Controls begin only after the original causal packet/readiness oracle.
      // Keep their contexts separate from that original retry ClaimContext.
      const newControlClaim = (): ClaimContext => ({
        runId: fixture.runId, stepId: "setup-build", task: CONTAINED_GAME_TASK, retryCount: 1,
        context: { ...fixture.writerContext!, repo: fixture.repo },
      });
      const blockerKeys = ["baseline_fail", "compat_fail", "previous_failure", "failure_category", "failure_suggestion"];
      const blockerSnapshot = (claim: ClaimContext) => Object.fromEntries(blockerKeys.map((key) => [
        key, { present: Object.hasOwn(claim.context, key), value: claim.context[key] },
      ]));
      const assertAdmissionBlocker = (claim: ClaimContext) => {
        assert.match(claim.context.baseline_fail!, /^SETUP_GENERATED_SCREEN_ADMISSION_REJECTED:/);
        assert.equal(claim.context.previous_failure, `SETUP_BUILD_PRECLAIM_BLOCKER:\n${claim.context.baseline_fail}`);
        assert.equal(claim.context.failure_category, "setup_contract_failure");
        assert.equal(claim.context.failure_suggestion, "Fix SETUP_CERTIFICATE/FILE_TREE_MANIFEST generation, then rerun setup-build preclaim.");
      };
      const repairedSource = fs.readFileSync(sourcePath);
      const staleSource = fs.readFileSync(path.join(diagnosticRoot, "retry-stale-sources", fixture.generatedFile));
      phase = "control-default-strict-stale";
      try {
        fs.writeFileSync(sourcePath, staleSource);
        const strictClaim = newControlClaim();
        await handoffRetained("after-regeneration", strictClaim, "control-default-strict-stale");
        writeJson(path.join(diagnosticRoot, "retry-control-default-strict-stale.json"), strictClaim);
        assertAdmissionBlocker(strictClaim);
      } finally {
        fs.writeFileSync(sourcePath, repairedSource);
      }

      phase = "control-unrelated-blockers-before-regeneration";
      const baselineClaim = newControlClaim();
      Object.assign(baselineClaim.context, {
        baseline_fail: "Existing unrelated baseline build failure",
        previous_failure: "Existing unrelated baseline failure detail",
        failure_category: "setup_build_failure",
        failure_suggestion: "Repair the existing unrelated build failure",
        compat_fail: "Existing unrelated compatibility failure",
      });
      const compatClaim = newControlClaim();
      compatClaim.context.compat_fail = "Existing compatibility-only failure";
      const conservation = [
        { name: "baseline-and-compat", claim: baselineClaim, expected: blockerSnapshot(baselineClaim) },
        { name: "compat-only", claim: compatClaim, expected: blockerSnapshot(compatClaim) },
      ];
      writeJson(path.join(diagnosticRoot, "retry-control-conservation-input.json"), conservation);
      try {
        fs.writeFileSync(sourcePath, staleSource);
        for (const control of conservation) {
          await handoffRetained("before-regeneration", control.claim, `control-${control.name}-defer`);
          const actual = blockerSnapshot(control.claim);
          writeJson(path.join(diagnosticRoot, `retry-control-${control.name}-after-defer.json`), {
            ctx: control.claim, expected: control.expected, actual,
          });
          assert.deepEqual(actual, control.expected, `${control.name}: preparation must neither set nor clear unrelated blockers`);
        }

        phase = "control-real-regeneration";
        const controlConverterSource = executeAttestedStitchConverter(converterPath, fixture.repo);
        writeJson(path.join(diagnosticRoot, "retry-control-converter-source.json"), controlConverterSource);
        const controlConversionResult = JSON.parse(fs.readFileSync(path.join(fixture.repo, ".setfarm/setup/STITCH_TO_JSX_RESULT.json"), "utf8"));
        writeJson(path.join(diagnosticRoot, "retry-control-conversion-result.json"), controlConversionResult);
        assert.deepEqual(controlConversionResult, { schema: "setfarm.stitch-to-jsx-result.v1", status: "passed" });
        phase = "control-generated-screen-validator";
        const controlValidatorStdout = execFileSync("node", [validatorPath, fixture.repo, "--fix"], {
          cwd: fixture.repo, timeout: 60000, stdio: "pipe", encoding: "utf8",
        });
        fs.writeFileSync(path.join(diagnosticRoot, "retry-control-validator.stdout.txt"), controlValidatorStdout);
        const controlValidatorReport = JSON.parse(fs.readFileSync(path.join(fixture.repo, ".setfarm/setup/DESIGN_IMPORT_VALIDATE.json"), "utf8"));
        writeJson(path.join(diagnosticRoot, "retry-control-validator-report.json"), controlValidatorReport);
        assert.equal(controlValidatorReport.status, "pass", JSON.stringify(controlValidatorReport));
        assert.equal(controlValidatorReport.fixMode, true);
        assert.deepEqual(controlValidatorReport.failedRules, []);
        phase = "control-unrelated-blockers-after-regeneration";
        for (const control of conservation) {
          await handoffRetained("after-regeneration", control.claim, `control-${control.name}-strict`);
          const actual = blockerSnapshot(control.claim);
          writeJson(path.join(diagnosticRoot, `retry-control-${control.name}-after-repair.json`), {
            ctx: control.claim, expected: control.expected, actual,
          });
          assert.deepEqual(actual, control.expected, `${control.name}: strict successful repair must preserve unrelated blockers`);
          assert.equal(control.claim.context.setup_certificate_path, ".setfarm/setup/SETUP_CERTIFICATE.json");
        }
        await assembleRetained("controls-repaired", controlConverterSource);

        phase = "control-invalid-post-regeneration-strict";
        const validControlSource = fs.readFileSync(sourcePath);
        try {
          fs.writeFileSync(sourcePath, staleSource);
          const invalidPostRegenerationClaim = newControlClaim();
          await handoffRetained("after-regeneration", invalidPostRegenerationClaim, "control-invalid-post-regeneration-strict");
          writeJson(path.join(diagnosticRoot, "retry-control-invalid-post-regeneration-strict.json"), invalidPostRegenerationClaim);
          assertAdmissionBlocker(invalidPostRegenerationClaim);
        } finally {
          fs.writeFileSync(sourcePath, validControlSource);
        }
      } finally {
        try {
          retainSources("controls-before-source-restoration");
        } finally {
          fs.writeFileSync(sourcePath, repairedSource);
          writeJson(path.join(diagnosticRoot, "retry-control-source-restoration.json"), {
            restored: fs.readFileSync(sourcePath).equals(repairedSource),
            sourceHash: createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex"),
          });
          assert.deepEqual(fs.readFileSync(sourcePath), repairedSource);
        }
      }

      phase = "control-real-non-admission-writer-error";
      const storyRows = await database.sql<Array<{ scope_targets: string | null }>>`
        SELECT scope_targets FROM stories WHERE run_id = ${fixture.runId} AND story_id = 'US-001'
      `;
      assert.equal(storyRows.length, 1);
      const originalScopeTargets = storyRows[0]!.scope_targets;
      assert.equal(typeof originalScopeTargets, "string");
      const invalidScopeTargets = JSON.parse(originalScopeTargets!);
      invalidScopeTargets[0].role = "unmapped_retry_control";
      writeJson(path.join(diagnosticRoot, "retry-control-story-input.json"), {
        runId: fixture.runId, storyId: "US-001", originalScopeTargets, invalidScopeTargets,
      });
      try {
        await database.sql`
          UPDATE stories SET scope_targets = ${JSON.stringify(invalidScopeTargets)}
          WHERE run_id = ${fixture.runId} AND story_id = 'US-001'
        `;
        const unresolvedRoleClaim = newControlClaim();
        await handoffRetained("before-regeneration", unresolvedRoleClaim, "control-unresolved-story-role");
        writeJson(path.join(diagnosticRoot, "retry-control-unresolved-story-role.json"), unresolvedRoleClaim);
        assert.match(unresolvedRoleClaim.context.baseline_fail!, /^SCOPE_TARGET_UNRESOLVED:/);
        assert.match(unresolvedRoleClaim.context.baseline_fail!, /missingRole=unmapped_retry_control/);
        assert.equal(unresolvedRoleClaim.context.failure_category, "setup_contract_failure");
        assert.equal(unresolvedRoleClaim.context.previous_failure, `SETUP_BUILD_PRECLAIM_BLOCKER:\n${unresolvedRoleClaim.context.baseline_fail}`);
      } finally {
        await database.sql`
          UPDATE stories SET scope_targets = ${originalScopeTargets}
          WHERE run_id = ${fixture.runId} AND story_id = 'US-001'
        `;
        const restoredStoryRows = await database.sql<Array<{ scope_targets: string | null }>>`
          SELECT scope_targets FROM stories WHERE run_id = ${fixture.runId} AND story_id = 'US-001'
        `;
        writeJson(path.join(diagnosticRoot, "retry-control-story-restoration.json"), {
          originalScopeTargets, restoredStoryRows,
        });
        assert.deepEqual(restoredStoryRows.map((row) => row.scope_targets), [originalScopeTargets]);
      }
      retainSources("controls-final");
      writeJson(path.join(diagnosticRoot, "retry-controls-outcome.json"), { status: "passed", causalContext: ctx });
    } catch (error) {
      retainSources("failure");
      writeJson(path.join(diagnosticRoot, "retry-outcome.json"), {
        status: "threw", phase, regenerationPassed, ctx, error: errorEvidence(error),
      });
      throw error;
    } finally {
      // Only undo this test's temporary stale source if actual repair failed.
      // Keep the failed/stale bytes, all logs, repo and CAS witnesses retained.
      if (!regenerationPassed) fs.writeFileSync(sourcePath, originalSource);
      writeJson(path.join(diagnosticRoot, "retry-source-restoration.json"), {
        regenerationPassed, originalSourceRestored: !regenerationPassed,
        sourceHash: createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex"),
      });
    }
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

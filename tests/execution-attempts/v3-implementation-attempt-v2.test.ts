import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdir,
  link,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  createV3ArtifactRefKeyV2,
  V3_ARTIFACT_REF_KEY_V2_MAX_LENGTH,
} from "../../src/execution/v3-artifact-ref-key-v2.js";
import {
  createV3ImplementationAttemptV2Assembler,
  V3ImplementationAttemptV2AssemblyError,
} from "../../src/execution/v3-implementation-attempt-v2.js";
import { captureShadowSourceRevision } from "../../src/execution/shadow-attempt-recorder.js";
import { createV3PreparationClaimAuthorityV2 } from "../../src/execution/v3-preparation-claim-authority-v2.js";
import {
  captureV3ImplementationSourceSnapshotsV2,
  V3SourceSnapshotErrorV2,
} from "../../src/execution/v3-source-snapshot-v2.js";
import { resolveV3GitRevision } from "../../src/execution/v3-git-revision.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { compilePlanSemanticProposalV2 } from "../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import { produceImplementationSourceMapV1 } from "../../src/product-compiler/producers/implementation-source-map-v1.js";
import { produceStoryPlanV2 } from "../../src/product-compiler/producers/story-plan-v2.js";
import { BuildTopologyV1Schema } from "../../src/product-compiler/schemas/build-topology-v1.js";
import { ProductCompilationReportV3Schema } from "../../src/product-compiler/schemas/compilation-report-v3.js";
import { ProductBuildPacketV3Schema } from "../../src/product-compiler/schemas/product-build-packet-v3.js";
import { ProductSpecV2Schema } from "../../src/product-compiler/schemas/product-spec-v2.js";
import type {
  ExactSealedRuntimePacket,
  SealedRuntimePacketV3,
} from "../../src/product-compiler/runtime-artifact-reader.js";
import { buildNoDesignProductBuildPacketV3Contracts } from "../product-compiler/fixtures/product-build-packet-v3.js";
import {
  CONTAINED_GAME_TASK,
  containedGamePlanProposalV2,
} from "../product-compiler/fixtures/product-semantics-v2.js";

const RUN_ID = "run-native-v3-attempt-v2";
const STEP_ID = "implement";
const PRODUCER = {
  pass: "v3-attempt-v2-test",
  codeSha: "c".repeat(40),
  toolVersions: {},
};

function sha256(bytes: string | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function semanticEnvelopeHash(artifactType: string, payload: unknown): string {
  return hashCanonicalJson({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType,
    producer: PRODUCER,
    payload,
  });
}

function git(repo: string, args: readonly string[]): string {
  return execFileSync("git", [...args], {
    cwd: repo,
    encoding: "utf8",
    timeout: 10_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function sealNoDesignPacketV3(input: Readonly<{
  productSpec: any;
  buildTopology: any;
  storyPlan: any;
  designSourceClosure: any;
  implementationSourceMap: any;
}>): SealedRuntimePacketV3 {
  const refs = {
    productSpec: semanticEnvelopeHash("setfarm.product-spec.v2", input.productSpec),
    designGraph: null,
    buildTopology: semanticEnvelopeHash("setfarm.build-topology.v1", input.buildTopology),
    storyPlan: semanticEnvelopeHash("setfarm.story-plan.v2", input.storyPlan),
    designSourceClosure: semanticEnvelopeHash(
      "setfarm.design-source-closure.v2",
      input.designSourceClosure,
    ),
    implementationSourceMap: semanticEnvelopeHash(
      "setfarm.implementation-source-map.v1",
      input.implementationSourceMap,
    ),
  };
  const compiler = { version: "4.0.0", codeSha: PRODUCER.codeSha };
  const packet = ProductBuildPacketV3Schema.parse({
    schema: "setfarm.product-build-packet.v3",
    packetVersion: 3,
    parentPacketHashes: [],
    designSourceKind: "none",
    productSpecV2Hash: refs.productSpec,
    designGraphV2Hash: null,
    buildTopologyV1Hash: refs.buildTopology,
    storyPlanV2Hash: refs.storyPlan,
    designSourceClosureV2Hash: refs.designSourceClosure,
    implementationSourceMapV1Hash: refs.implementationSourceMap,
    compiler,
    validationIds: ["VALIDATE_NATIVE_V3_ATTEMPT_V2"],
  });
  const packetHash = semanticEnvelopeHash("setfarm.product-build-packet.v3", packet);
  const compilationReport = ProductCompilationReportV3Schema.parse({
    schema: "setfarm.product-compilation-report.v3",
    compiler,
    inputHashes: ["9".repeat(64)],
    diagnostics: [],
    validationIds: packet.validationIds,
    status: "sealed",
    artifactHashes: {
      productSpecV2: refs.productSpec,
      designGraphV2: null,
      buildTopologyV1: refs.buildTopology,
      storyPlanV2: refs.storyPlan,
      designSourceClosureV2: refs.designSourceClosure,
      implementationSourceMapV1: refs.implementationSourceMap,
    },
    packetHash,
  });
  return {
    runId: RUN_ID,
    packetHash,
    producer: PRODUCER,
    productSpec: input.productSpec,
    designGraph: null,
    buildTopology: input.buildTopology,
    storyPlan: input.storyPlan,
    designSourceClosure: input.designSourceClosure,
    implementationSourceMap: input.implementationSourceMap,
    packet,
    compilationReport,
    refs: {
      ...refs,
      packet: packetHash,
      compilationReport: semanticEnvelopeHash(
        "setfarm.product-compilation-report.v3",
        compilationReport,
      ),
    },
  };
}

function implementationSourceMapForNoDesign(input: Readonly<{
  productSpec: unknown;
  buildTopology: unknown;
  storyPlan: unknown;
  designSourceClosure: unknown;
}>) {
  const sourceMapResult = produceImplementationSourceMapV1({
    designSourceKind: "none",
    productSpec: input.productSpec,
    designGraph: null,
    buildTopology: input.buildTopology,
    storyPlan: input.storyPlan,
    designSourceClosure: input.designSourceClosure,
    generationTargets: null,
    responseBindings: null,
    screenIndex: [],
    screenIndexSource: null,
    converterSource: null,
    generatedSources: [],
  });
  assert.equal(sourceMapResult.status, "produced", JSON.stringify(sourceMapResult));
  if (sourceMapResult.status !== "produced") throw new Error("unreachable");
  return sourceMapResult.sourceMap;
}

function nativePacketV3(sourceHash: string): SealedRuntimePacketV3 {
  const base = buildNoDesignProductBuildPacketV3Contracts();
  const buildTopology = structuredClone(base.buildTopologyV1);
  buildTopology.pathBindings[0]!.knownContentHash = sourceHash;
  const stories = produceStoryPlanV2({
    productSpec: base.productSpecV2,
    buildTopology,
  });
  assert.equal(stories.status, "produced", JSON.stringify(stories));
  if (stories.status !== "produced") throw new Error("unreachable");
  const storyPlan = stories.storyPlan;
  return sealNoDesignPacketV3({
    productSpec: base.productSpecV2,
    buildTopology,
    storyPlan,
    designSourceClosure: base.designSourceClosureV2,
    implementationSourceMap: implementationSourceMapForNoDesign({
      productSpec: base.productSpecV2,
      buildTopology,
      storyPlan,
      designSourceClosure: base.designSourceClosureV2,
    }),
  });
}

function twoStoryProductSpecV2() {
  const proposal: any = containedGamePlanProposalV2();
  const requirementRefs = proposal.requirements.map((requirement: any) => requirement.id);
  proposal.states.push({
    key: "settings_mode",
    name: "Settings Mode",
    kind: "application",
    initialValue: { enabled: false },
    invariants: ["The enabled value is boolean."],
    requirementRefs,
  });
  proposal.routes.push({
    key: "settings",
    path: "/settings",
    entry: false,
    requirementRefs,
  });
  proposal.surfaces.push({
    key: "settings_page",
    name: "Settings Page",
    kind: "terminal",
    routeKey: "settings",
    required: true,
    composition: { kind: "route_root" },
    requirementRefs,
  });
  proposal.actions.push({
    key: "toggle_settings",
    name: "Toggle Settings",
    controlPlacements: [{
      key: "primary_toggle",
      surfaceKey: "settings_page",
      controlHint: "primary_button",
      requirementRefs,
    }],
    affectedSurfaceKeys: [],
    trigger: { kind: "user", sourceRef: "Toggle Settings" },
    inputs: [],
    preconditions: [],
    evidenceScenario: {
      controlPlacementKey: "primary_toggle",
      targetInputValues: {},
      prerequisiteSteps: [],
    },
    stateDeltas: [{
      key: "toggle_value",
      stateKey: "settings_mode",
      operation: "set",
      path: "/enabled",
      valueFrom: { kind: "literal", value: true },
    }],
    navigation: { kind: "stay" },
    persistenceIntents: [],
    observables: [{
      key: "toggle_control",
      selector: { kind: "control", controlPlacementKey: "primary_toggle" },
      assertions: [{
        phase: "after",
        property: "enabled",
        operator: "equals",
        expected: true,
      }],
      requirementRefs,
    }],
    requirementRefs,
  });
  const compiled = compilePlanSemanticProposalV2({
    task: CONTAINED_GAME_TASK,
    proposal,
  });
  assert.equal(compiled.status, "canonicalized", JSON.stringify(compiled));
  if (compiled.status !== "canonicalized") throw new Error("unreachable");
  const productSpec: any = structuredClone(compiled.productSpec);
  productSpec.delivery = {
    platform: "cli",
    techStack: "node-cli",
    uiLanguage: "English",
    database: "none",
    designRequired: false,
    uiVisionSummary: "A deterministic two-story dependency contract.",
  };
  productSpec.evidencePredicates.forEach((predicate: any) => {
    predicate.capabilityRefs = ["CAP_CLI_INTERACTION"];
  });
  const settingsAction = productSpec.actions.find((action: any) =>
    action.id === "ACT_TOGGLE_SETTINGS")!;
  settingsAction.input.fields = [{
    name: "enabled",
    valueType: "boolean",
    required: true,
  }];
  settingsAction.evidenceScenario.targetInputValues = { enabled: true };
  settingsAction.stateDeltas[0]!.valueFrom = {
    kind: "input",
    field: "enabled",
  };
  return ProductSpecV2Schema.parse(productSpec);
}

function twoStoryNativePacketV3(input: Readonly<{
  firstTopologyHash: string;
  secondTopologyHash: string;
}>): SealedRuntimePacketV3 {
  const productSpec = twoStoryProductSpecV2();
  const buildTopology = BuildTopologyV1Schema.parse({
    schema: "setfarm.build-topology.v1",
    stackPack: {
      id: "node-cli",
      version: "2.0.0",
      contentHash: sha256("two-story-stack"),
    },
    repo: {
      id: "attempt-v2-two-story",
      baseSha: "5".repeat(40),
      treeHash: "6".repeat(40),
    },
    owners: [
      { id: "OWNER_US_001", kind: "story", storyRef: "US-001" },
      { id: "OWNER_US_002", kind: "story", storyRef: "US-002" },
    ],
    pathBindings: [
      {
        id: "PATH_APP",
        path: "src/app.ts",
        role: "source",
        ownerRef: "OWNER_US_001",
        presence: "present",
        knownContentHash: input.firstTopologyHash,
      },
      {
        id: "PATH_APP_HELPER",
        path: "src/app-helper.ts",
        role: "source",
        ownerRef: "OWNER_US_001",
        presence: "present",
        knownContentHash: input.firstTopologyHash,
      },
      {
        id: "PATH_SETTINGS",
        path: "src/settings.ts",
        role: "source",
        ownerRef: "OWNER_US_002",
        presence: "present",
        knownContentHash: input.secondTopologyHash,
      },
    ],
    sharedGrants: [{
      id: "GRANT_APP_TO_SETTINGS",
      fromOwnerRef: "OWNER_US_001",
      toOwnerRef: "OWNER_US_002",
      pathRefs: ["PATH_APP"],
      permissions: ["read"],
    }],
    entrypoints: [{
      id: "ENTRY_CLI",
      kind: "cli",
      pathRef: "PATH_APP",
      mountPoint: ".",
      routeRefs: productSpec.routes.map((route) => route.id).sort(),
    }],
    commands: [{
      id: "CMD_BUILD",
      kind: "build",
      argv: ["npm", "run", "build"],
      cwd: ".",
      timeoutMs: 120_000,
      capabilityRefs: [],
    }],
    capabilities: [{
      id: "CAP_CLI_INTERACTION",
      kind: "cli_interaction",
      enabled: true,
    }],
    policies: {
      packageManager: "npm",
      allowedRoots: ["src"],
      deniedGlobs: [],
      buildOutputPaths: ["dist"],
    },
  });
  const stories = produceStoryPlanV2({ productSpec, buildTopology });
  assert.equal(stories.status, "produced", JSON.stringify(stories));
  if (stories.status !== "produced") throw new Error("unreachable");
  assert.deepEqual(stories.storyPlan.stories.map((story) => story.id), ["US-001", "US-002"]);
  assert.deepEqual(stories.storyPlan.stories[1]!.dependsOn, ["US-001"]);
  const designSourceClosure = {
    schema: "setfarm.design-source-closure.v2" as const,
    kind: "none" as const,
    reason: "product_delivery_design_not_required" as const,
  };
  const implementationSourceMap = implementationSourceMapForNoDesign({
    productSpec,
    buildTopology,
    storyPlan: stories.storyPlan,
    designSourceClosure,
  });
  return sealNoDesignPacketV3({
    productSpec,
    buildTopology,
    storyPlan: stories.storyPlan,
    designSourceClosure,
    implementationSourceMap,
  });
}

function dependencyAttempt() {
  return {
    storyId: "US-999",
    attemptId: "ATT_dependency-pinned-0001",
    attemptGeneration: 1,
    attemptClass: "product_implementation" as const,
    disposition: "produced_delta" as const,
    sliceHash: "1".repeat(64),
    outputHash: "2".repeat(64),
    sourceAfter: { sha: "3".repeat(40), treeHash: "4".repeat(40) },
    fileSignatures: [{
      pathRef: "PATH_DEPENDENCY",
      path: "src/dependency.ts",
      presence: "present" as const,
      contentHash: "5".repeat(64),
    }],
  };
}

function recreateAuthority(
  authority: ReturnType<typeof createV3PreparationClaimAuthorityV2>,
  overrides: Partial<Parameters<typeof createV3PreparationClaimAuthorityV2>[0]>,
) {
  const {
    schema: _schema,
    authorityVersion: _authorityVersion,
    packetSchema: _packetSchema,
    authorityHash: _authorityHash,
    ...payload
  } = authority;
  return createV3PreparationClaimAuthorityV2({ ...payload, ...overrides });
}

describe("bounded native V3 artifact references", () => {
  it("hashes the full story identity and retains the full artifact hash within the DB bound", () => {
    const maxStory = `US-${"A".repeat(157)}`;
    const hash = "a".repeat(64);
    const sliceRef = createV3ArtifactRefKeyV2("slice", maxStory, hash);
    const planRef = createV3ArtifactRefKeyV2("evidence_plan", maxStory, hash);
    assert.equal(sliceRef.length, 138);
    assert.equal(planRef.length, 146);
    assert.equal(sliceRef.length <= V3_ARTIFACT_REF_KEY_V2_MAX_LENGTH, true);
    assert.equal(planRef.endsWith(hash.toUpperCase()), true);
    assert.notEqual(
      sliceRef,
      createV3ArtifactRefKeyV2("slice", `US-${"B".repeat(157)}`, hash),
    );
    assert.equal(createV3ArtifactRefKeyV2("slice", maxStory, hash), sliceRef);
  });
});

describe("descriptor-bounded V3 source snapshots", { concurrency: 1 }, () => {
  let root = "";

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
    root = "";
  });

  it("captures present and absent topology paths in canonical order", async () => {
    root = await mkdtemp(path.join(tmpdir(), "setfarm-source-snapshot-v2-"));
    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, "src/present.ts"), "export const value = 1;\n");
    const result = captureV3ImplementationSourceSnapshotsV2({
      worktree: root,
      files: [
        { pathRef: "PATH_PRESENT", path: "src/present.ts" },
        { pathRef: "PATH_ABSENT", path: "src/absent.ts" },
        { pathRef: "PATH_FUTURE", path: "future/nested.ts" },
      ],
    });
    assert.deepEqual(result.snapshots.map((item) => item.pathRef), [
      "PATH_ABSENT",
      "PATH_FUTURE",
      "PATH_PRESENT",
    ]);
    assert.equal(result.snapshots[0]!.presence, "absent");
    assert.equal(result.snapshots[1]!.presence, "absent");
    assert.equal(result.snapshots[2]!.contentHash, sha256("export const value = 1;\n"));
    assert.equal(result.totalBytes, Buffer.byteLength("export const value = 1;\n"));
  });

  it("rejects final and parent symlinks plus per-file and aggregate overflow", async () => {
    root = await mkdtemp(path.join(tmpdir(), "setfarm-source-snapshot-v2-"));
    const outside = await mkdtemp(path.join(tmpdir(), "setfarm-source-outside-v2-"));
    try {
      await mkdir(path.join(root, "src"));
      await writeFile(path.join(outside, "outside.ts"), "outside\n");
      assert.throws(
        () => captureV3ImplementationSourceSnapshotsV2({
          worktree: root,
          files: [{ pathRef: "PATH_ESCAPE", path: "../outside.ts" }],
        }),
        (error) => error instanceof V3SourceSnapshotErrorV2
          && error.code === "V3_SOURCE_SNAPSHOT_INPUT_INVALID",
      );
      await symlink(path.join(outside, "outside.ts"), path.join(root, "src/link.ts"));
      assert.throws(
        () => captureV3ImplementationSourceSnapshotsV2({
          worktree: root,
          files: [{ pathRef: "PATH_LINK", path: "src/link.ts" }],
        }),
        (error) => error instanceof V3SourceSnapshotErrorV2
          && error.code === "V3_SOURCE_SNAPSHOT_TYPE_UNSUPPORTED",
      );

      await symlink(outside, path.join(root, "linked"));
      assert.throws(
        () => captureV3ImplementationSourceSnapshotsV2({
          worktree: root,
          files: [{ pathRef: "PATH_PARENT_LINK", path: "linked/outside.ts" }],
        }),
        (error) => error instanceof V3SourceSnapshotErrorV2
          && error.code === "V3_SOURCE_SNAPSHOT_TYPE_UNSUPPORTED",
      );

      await writeFile(path.join(root, "src/large.ts"), "12345");
      assert.throws(
        () => captureV3ImplementationSourceSnapshotsV2({
          worktree: root,
          files: [{ pathRef: "PATH_LARGE", path: "src/large.ts" }],
          limits: { maxFileBytes: 4 },
        }),
        (error) => error instanceof V3SourceSnapshotErrorV2
          && error.code === "V3_SOURCE_SNAPSHOT_FILE_TOO_LARGE",
      );
      await writeFile(path.join(root, "src/second.ts"), "67890");
      assert.throws(
        () => captureV3ImplementationSourceSnapshotsV2({
          worktree: root,
          files: [
            { pathRef: "PATH_LARGE", path: "src/large.ts" },
            { pathRef: "PATH_SECOND", path: "src/second.ts" },
          ],
          limits: { maxFileBytes: 5, maxTotalBytes: 9 },
        }),
        (error) => error instanceof V3SourceSnapshotErrorV2
          && error.code === "V3_SOURCE_SNAPSHOT_TOTAL_TOO_LARGE",
      );
      await link(path.join(root, "src/second.ts"), path.join(root, "src/hardlink.ts"));
      assert.throws(
        () => captureV3ImplementationSourceSnapshotsV2({
          worktree: root,
          files: [{ pathRef: "PATH_HARDLINK", path: "src/hardlink.ts" }],
        }),
        (error) => error instanceof V3SourceSnapshotErrorV2
          && error.code === "V3_SOURCE_SNAPSHOT_TYPE_UNSUPPORTED",
      );
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});

describe("native PacketV3 to SliceV2 attempt assembly", { concurrency: 1 }, () => {
  let repo = "";

  afterEach(async () => {
    if (repo) await rm(repo, { recursive: true, force: true });
    repo = "";
  });

  async function fixture() {
    repo = await mkdtemp(path.join(tmpdir(), "setfarm-attempt-v2-"));
    git(repo, ["init", "-q", "-b", "main"]);
    git(repo, ["config", "user.name", "Setfarm Test"]);
    git(repo, ["config", "user.email", "setfarm-test@example.invalid"]);
    await mkdir(path.join(repo, "src"));
    const source = "export const packetV3 = true;\n";
    await writeFile(path.join(repo, "src/index.ts"), source);
    git(repo, ["add", "src/index.ts"]);
    git(repo, ["commit", "-qm", "base"]);
    const packet = nativePacketV3(sha256(source));
    const sourceRevision = resolveV3GitRevision({ repo, requestedRef: "HEAD" });
    const historicalShadowFingerprint = await captureShadowSourceRevision(repo);
    assert.notEqual(
      sourceRevision.treeHash,
      historicalShadowFingerprint.treeHash,
      "Preparation authority must bind the Git root tree, not the historical worktree fingerprint",
    );
    const authority = createV3PreparationClaimAuthorityV2({
      stateVersion: 1,
      runId: RUN_ID,
      stepId: STEP_ID,
      storyId: "US-001",
      packetHash: packet.packetHash,
      compilationReportHash: packet.refs.compilationReport,
      baseRevision: sourceRevision,
      projectedDependencyIds: [],
      dependencyAttempts: [],
    });
    return { packet, authority, sourceRevision };
  }

  async function twoStoryFixture() {
    repo = await mkdtemp(path.join(tmpdir(), "setfarm-attempt-v2-dependency-"));
    git(repo, ["init", "-q", "-b", "main"]);
    git(repo, ["config", "user.name", "Setfarm Test"]);
    git(repo, ["config", "user.email", "setfarm-test@example.invalid"]);
    await mkdir(path.join(repo, "src"));
    const current = {
      app: "export const dependencyVersion = 'A';\n",
      helper: "export const dependencyHelper = 'A';\n",
      settings: "export const settings = true;\n",
    };
    await writeFile(path.join(repo, "src/app.ts"), current.app);
    await writeFile(path.join(repo, "src/app-helper.ts"), current.helper);
    await writeFile(path.join(repo, "src/settings.ts"), current.settings);
    git(repo, ["add", "src"]);
    git(repo, ["commit", "-qm", "dependency A output"]);
    const packet = twoStoryNativePacketV3({
      firstTopologyHash: sha256("dependency topology base"),
      secondTopologyHash: sha256(current.settings),
    });
    const sourceRevision = resolveV3GitRevision({ repo, requestedRef: "HEAD" });
    const attemptA = {
      storyId: "US-001",
      attemptId: "ATT_dependency-generation-A",
      attemptGeneration: 1,
      attemptClass: "product_implementation" as const,
      disposition: "produced_delta" as const,
      sliceHash: sha256("dependency slice A"),
      outputHash: sha256("dependency output A"),
      sourceAfter: sourceRevision,
      fileSignatures: [
        {
          pathRef: "PATH_APP",
          path: "src/app.ts",
          presence: "present" as const,
          contentHash: sha256(current.app),
        },
        {
          pathRef: "PATH_APP_HELPER",
          path: "src/app-helper.ts",
          presence: "present" as const,
          contentHash: sha256(current.helper),
        },
      ],
    };
    const attemptB = {
      ...attemptA,
      attemptId: "ATT_dependency-generation-B",
      attemptGeneration: 2,
      sliceHash: sha256("dependency slice B"),
      outputHash: sha256("dependency output B"),
      sourceAfter: { sha: "b".repeat(40), treeHash: "c".repeat(40) },
      fileSignatures: attemptA.fileSignatures.map((signature) => ({
        ...signature,
        contentHash: sha256(`${signature.path}:generation-B`),
      })),
    };
    const authority = createV3PreparationClaimAuthorityV2({
      stateVersion: 7,
      runId: RUN_ID,
      stepId: STEP_ID,
      storyId: "US-002",
      packetHash: packet.packetHash,
      compilationReportHash: packet.refs.compilationReport,
      baseRevision: sourceRevision,
      projectedDependencyIds: ["US-001"],
      dependencyAttempts: [attemptA],
    });
    return { packet, authority, attemptA, attemptB, sourceRevision };
  }

  it("fresh-compiles and independently verifies SliceV2 without publishing or reserving", async () => {
    const value = await fixture();
    const assembler = createV3ImplementationAttemptV2Assembler({
      readPacket: async () => value.packet,
    });
    const result = await assembler.assemble({
      runId: RUN_ID,
      stepId: STEP_ID,
      storyId: "US-001",
      worktree: repo,
      preparationAuthority: value.authority,
    });
    assert.equal(result.slice.schema, "setfarm.implementation-slice.v2");
    assert.equal(result.sliceHash, hashCanonicalJson(result.envelope));
    assert.equal(result.slice.storyId, "US-001");
    assert.equal(result.slice.sourceRevision.treeHash, value.sourceRevision.treeHash);
    assert.equal(result.slice.files[0]!.contentHash, sha256("export const packetV3 = true;\n"));
    assert.equal(result.preparationAuthorityHash, value.authority.authorityHash);
    assert.equal(result.sliceRefKey.length <= 160, true);
    assert.equal("attempt" in result, false);
    assert.equal("evidencePlan" in result, false);
  });

  it("fails closed on historical packets, report drift, dependency drift, and source drift", async () => {
    const value = await fixture();
    const input = {
      runId: RUN_ID,
      stepId: STEP_ID,
      storyId: "US-001",
      worktree: repo,
      preparationAuthority: value.authority,
    };
    const historical = structuredClone(value.packet) as any;
    historical.packet.schema = "setfarm.product-build-packet.v2";
    await assert.rejects(
      createV3ImplementationAttemptV2Assembler({
        readPacket: async () => historical as ExactSealedRuntimePacket,
      }).assemble(input),
      (error) => error instanceof V3ImplementationAttemptV2AssemblyError
        && error.code === "V3_ATTEMPT_V2_NATIVE_PACKET_REQUIRED",
    );

    const wrongReport = recreateAuthority(value.authority, {
      compilationReportHash: "f".repeat(64),
    });
    await assert.rejects(
      createV3ImplementationAttemptV2Assembler({
        readPacket: async () => value.packet,
      }).assemble({ ...input, preparationAuthority: wrongReport }),
      (error) => error instanceof V3ImplementationAttemptV2AssemblyError
        && error.code === "V3_ATTEMPT_V2_COMPILATION_REPORT_MISMATCH",
    );

    const wrongDependencies = recreateAuthority(value.authority, {
      projectedDependencyIds: ["US-999"],
      dependencyAttempts: [dependencyAttempt()],
    });
    await assert.rejects(
      createV3ImplementationAttemptV2Assembler({
        readPacket: async () => value.packet,
      }).assemble({ ...input, preparationAuthority: wrongDependencies }),
      (error) => error instanceof V3ImplementationAttemptV2AssemblyError
        && error.code === "V3_ATTEMPT_V2_DEPENDENCY_AUTHORITY_MISMATCH",
    );

    await writeFile(path.join(repo, "src/index.ts"), "drifted\n");
    await assert.rejects(
      createV3ImplementationAttemptV2Assembler({
        readPacket: async () => value.packet,
      }).assemble(input),
      (error) => error instanceof V3ImplementationAttemptV2AssemblyError
        && error.code === "V3_ATTEMPT_V2_SOURCE_REVISION_MISMATCH",
    );
  });

  it("rejects a worktree change between the two source fences", async () => {
    const value = await fixture();
    let captures = 0;
    const assembler = createV3ImplementationAttemptV2Assembler({
      readPacket: async () => value.packet,
      captureBaseRevision: () => {
        captures += 1;
        return captures === 1
          ? value.sourceRevision
          : { sha: value.sourceRevision.sha, treeHash: "f".repeat(64) };
      },
      assertCleanWorktree: () => {},
    });
    await assert.rejects(
      assembler.assemble({
        runId: RUN_ID,
        stepId: STEP_ID,
        storyId: "US-001",
        worktree: repo,
        preparationAuthority: value.authority,
      }),
      (error) => error instanceof V3ImplementationAttemptV2AssemblyError
        && error.code === "V3_ATTEMPT_V2_SOURCE_REVISION_MISMATCH",
    );
    assert.equal(captures, 2);
  });

  it("pins dependency generation A even when surrounding state exposes newer B", async () => {
    const value = await twoStoryFixture();
    let latestDependencyReads = 0;
    const surroundingState = {
      readPacket: async () => value.packet,
      readLatestDependency: async () => {
        latestDependencyReads += 1;
        return value.attemptB;
      },
    };
    const assembler = createV3ImplementationAttemptV2Assembler(surroundingState);
    const input = {
      runId: RUN_ID,
      stepId: STEP_ID,
      storyId: "US-002",
      worktree: repo,
      preparationAuthority: value.authority,
    };
    const result = await assembler.assemble(input);
    assert.equal(latestDependencyReads, 0);
    assert.equal(
      result.preparationAuthority.dependencyAttempts[0]!.attemptId,
      value.attemptA.attemptId,
    );
    assert.equal(
      result.preparationAuthority.dependencyAttempts[0]!.attemptGeneration,
      value.attemptA.attemptGeneration,
    );
    assert.deepEqual(result.dependencyOutputs, [{
      storyId: value.attemptA.storyId,
      sliceHash: value.attemptA.sliceHash,
      outputHash: value.attemptA.outputHash,
      sourceAfter: value.attemptA.sourceAfter,
      fileSignatures: value.attemptA.fileSignatures,
    }]);
    assert.deepEqual(result.slice.dependencyOutputs, result.dependencyOutputs);
    assert.deepEqual(result.compilerInput.currentFiles.map((file) => file.pathRef), [
      "PATH_APP",
      "PATH_SETTINGS",
    ]);

    const partial = recreateAuthority(value.authority, {
      dependencyAttempts: [{
        ...value.attemptA,
        fileSignatures: [value.attemptA.fileSignatures[0]!],
      }],
    });
    await assert.rejects(
      assembler.assemble({ ...input, preparationAuthority: partial }),
      (error) => error instanceof V3ImplementationAttemptV2AssemblyError
        && error.code === "V3_ATTEMPT_V2_SLICE_COMPILATION_REJECTED",
    );

    const extra = recreateAuthority(value.authority, {
      dependencyAttempts: [{
        ...value.attemptA,
        fileSignatures: [
          ...value.attemptA.fileSignatures,
          {
            pathRef: "PATH_EXTRA",
            path: "src/extra.ts",
            presence: "present",
            contentHash: sha256("extra"),
          },
        ],
      }],
    });
    await assert.rejects(
      assembler.assemble({ ...input, preparationAuthority: extra }),
      (error) => error instanceof V3ImplementationAttemptV2AssemblyError
        && error.code === "V3_ATTEMPT_V2_SLICE_COMPILATION_REJECTED",
    );

    const wrongCurrentSignature = recreateAuthority(value.authority, {
      dependencyAttempts: [{
        ...value.attemptA,
        fileSignatures: value.attemptA.fileSignatures.map((signature, index) =>
          index === 0
            ? { ...signature, contentHash: value.attemptB.fileSignatures[0]!.contentHash }
            : signature),
      }],
    });
    await assert.rejects(
      assembler.assemble({ ...input, preparationAuthority: wrongCurrentSignature }),
      (error) => error instanceof V3ImplementationAttemptV2AssemblyError
        && error.code === "V3_ATTEMPT_V2_SLICE_COMPILATION_REJECTED",
    );
  });
});

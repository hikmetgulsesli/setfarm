import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { canonicalJsonStringify } from "./canonical-json.js";
import {
  resolveNodeExecutionLayoutV2,
} from "./node-execution-layout-catalog-v2.js";
import {
  NodeScaffoldPrivateMaterializerErrorV2,
  inspectBuildDependencyMaterializationReceiptV2,
  inspectScaffoldBaseMaterializationReceiptV2,
  isProductionNodeScaffoldPrivateStageV2,
  revalidateNodeScaffoldDependenciesV2,
  revalidateNodeScaffoldPrivateStageV2,
  type MaterializedNodeScaffoldPrivateStageV2,
} from "./node-scaffold-private-materializer-v2.js";
import {
  resolveNodeScaffoldToolchainV2,
} from "./node-scaffold-toolchain-catalog-v2.js";
import {
  compileNodeExecutionPathTokenSetV2,
} from "./path-token-v2.js";
import {
  compileSemanticSourceIntentSetV1,
} from "./semantic-source-intent-set-v1.js";
import {
  compileSemanticSourcePathTokenSetV2,
} from "./semantic-source-path-token-set-v2.js";
import {
  FILE_TREE_MANIFEST_BLOCKER_CODES_V2,
  FILE_TREE_MANIFEST_BOUNDED_WORK_LIMITS_V2,
  FILE_TREE_MANIFEST_CONTRACT_HASH_V2,
  FILE_TREE_MANIFEST_MAX_CANONICAL_BYTES_V2,
  FILE_TREE_MANIFEST_V2_SCHEMA,
  FILE_TREE_MANIFEST_VERSION_V2,
  FileTreeManifestV2Schema,
  FileTreePathEntryV2Schema,
  deriveFileTreePathRefV2,
  deriveFileTreeStoryOwnerRefV2,
  hashFileTreeManifestV2,
  hashFileTreeOwnerMembershipV2,
  hashFileTreePathAbsenceV2,
  hashFileTreePathEntryV2,
  hashFileTreePathMembershipV2,
  recursivelyFreezeFileTreeManifestV2,
  type FileTreeManifestHashPayloadV2,
  type FileTreeManifestV2,
  type FileTreeOwnerV2,
  type FileTreePathEntryHashPayloadV2,
  type FileTreePathEntryV2,
} from "./schemas/file-tree-manifest-v2.js";
import {
  hashPortablePathCaseFoldIdentityV2,
  hashPortablePathIdentityV2,
  type NodeExecutionPathTokenSetV2,
  type PathTokenV2,
} from "./schemas/path-token-v2.js";
import type {
  SemanticSourceIntentSetV1,
  SemanticSourceIntentV1,
} from "./schemas/semantic-source-intent-set-v1.js";
import type {
  SemanticSourcePathTokenSetV2,
  SemanticSourcePathTokenV2,
} from "./schemas/semantic-source-path-token-set-v2.js";
import type {
  ScaffoldBaseMaterializationReceiptV2,
} from "./schemas/node-scaffold-private-materialization-v2.js";
import type {
  NodeExecutionLayoutV2,
} from "./schemas/node-execution-layout-catalog-v2.js";
import type {
  NodeScaffoldToolchainResolutionV2,
} from "./schemas/node-scaffold-toolchain-catalog-v2.js";

const INPUT_MAX_CANONICAL_BYTES_V2 = 10 * 1024 * 1024;
const VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 = 14 * 1024 * 1024;
const INPUT_BOUNDED_WORK_LIMITS_V2 = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 16,
  maxNodes: INPUT_MAX_CANONICAL_BYTES_V2 + 65_536,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits: (INPUT_MAX_CANONICAL_BYTES_V2 * 8) + (2 * 1024 * 1024),
});
const VERIFIER_BOUNDED_WORK_LIMITS_V2 = Object.freeze({
  ...INPUT_BOUNDED_WORK_LIMITS_V2,
  maxNodes: VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 + 65_536,
  maxWorkUnits:
    (VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 * 8) + (2 * 1024 * 1024),
});
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];
const NO_DESIGN_CLOSURE_V2 = Object.freeze({
  schema: "setfarm.design-source-closure.v2" as const,
  kind: "none" as const,
  reason: "product_delivery_design_not_required" as const,
});

const CompilerInputV2Schema = z.object({
  productSpec: z.unknown(),
  deliverySelection: z.unknown(),
}).strict();

const VerifierInputV2Schema = CompilerInputV2Schema.extend({
  candidate: z.unknown(),
}).strict();

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 1_500) : "Unknown error";
}

function boundedSnapshot(
  input: unknown,
  maxBytes: number,
  workLimits: Omit<Parameters<typeof canonicalJsonBytesBounded>[1], "maxBytes">,
): unknown {
  const bytes = canonicalJsonBytesBounded(input, { maxBytes, ...workLimits });
  return JSON.parse(bytes.toString("utf8"));
}

export type FileTreeManifestDiagnosticCodeV2 =
  | "FILE_TREE_V2_ARTIFACT_INVALID"
  | "FILE_TREE_V2_CODE_AUTHORITY_DRIFT"
  | "FILE_TREE_V2_INPUT_INVALID"
  | "FILE_TREE_V2_OUTPUT_LIMIT_EXCEEDED"
  | "FILE_TREE_V2_PRIVATE_STAGE_INVALID"
  | "FILE_TREE_V2_PRODUCTION_AUTHORITY_REQUIRED"
  | "FILE_TREE_V2_TEST_AUTHORITY_REQUIRED"
  | "FILE_TREE_V2_UPSTREAM_AUTHORITY_REJECTED";

export type FileTreeManifestDiagnosticV2 = Readonly<{
  code: FileTreeManifestDiagnosticCodeV2;
  path: string;
  message: string;
}>;

export type FileTreeManifestCompilationResultV2 =
  | Readonly<{
      status: "shadow_compiled";
      diagnostics: readonly [];
      value: Readonly<FileTreeManifestV2>;
      canonicalBytes: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly FileTreeManifestDiagnosticV2[];
    }>;

function rejected(
  code: FileTreeManifestDiagnosticCodeV2,
  path: string,
  message: string,
): FileTreeManifestCompilationResultV2 {
  return Object.freeze({
    status: "rejected" as const,
    diagnostics: Object.freeze([Object.freeze({
      code,
      path: path.slice(0, 1_000),
      message: message.slice(0, 1_500),
    })]),
  });
}

class FileTreeCodeAuthorityErrorV2 extends Error {
  constructor(message: string) {
    super(message.slice(0, 1_500));
    this.name = "FileTreeCodeAuthorityErrorV2";
  }
}

class FileTreeUpstreamAuthorityErrorV2 extends Error {
  constructor(message: string) {
    super(message.slice(0, 1_500));
    this.name = "FileTreeUpstreamAuthorityErrorV2";
  }
}

function authorityFailure(message: string): never {
  throw new FileTreeCodeAuthorityErrorV2(message);
}

function upstreamFailure(message: string): never {
  throw new FileTreeUpstreamAuthorityErrorV2(message);
}

type FreshAuthorityV2 = Readonly<{
  layout: Readonly<NodeExecutionLayoutV2>;
  nodePathSet: Readonly<NodeExecutionPathTokenSetV2>;
  semanticIntentSet: Readonly<SemanticSourceIntentSetV1>;
  semanticPathSet: Readonly<SemanticSourcePathTokenSetV2>;
  scaffoldResolution: Readonly<NodeScaffoldToolchainResolutionV2>;
}>;

function reproduceFreshAuthorityV2(input: Readonly<{
  productSpec: unknown;
  deliverySelection: unknown;
}>): FreshAuthorityV2 {
  const layout = resolveNodeExecutionLayoutV2(input);
  const nodePaths = compileNodeExecutionPathTokenSetV2(input);
  const semanticIntents = compileSemanticSourceIntentSetV1({
    ...input,
    designSourceClosure: NO_DESIGN_CLOSURE_V2,
  });
  const semanticPaths = compileSemanticSourcePathTokenSetV2(input);
  const scaffold = resolveNodeScaffoldToolchainV2(input);
  if (layout.status !== "shadow_resolved") {
    upstreamFailure(layout.diagnostics[0]?.message ?? "Node layout was rejected");
  }
  if (nodePaths.status !== "shadow_compiled") {
    upstreamFailure(nodePaths.diagnostics[0]?.message ?? "Node paths were rejected");
  }
  if (semanticIntents.status !== "shadow_compiled") {
    upstreamFailure(
      semanticIntents.diagnostics[0]?.message ?? "Semantic intents were rejected",
    );
  }
  if (semanticPaths.status !== "shadow_compiled") {
    upstreamFailure(
      semanticPaths.diagnostics[0]?.message ?? "Semantic paths were rejected",
    );
  }
  if (scaffold.status !== "shadow_resolved") {
    upstreamFailure(
      scaffold.diagnostics[0]?.message ?? "Node scaffold resolution was rejected",
    );
  }
  const resolution = scaffold.resolution;
  if (
    resolution.sourceAuthority.layoutHash !== layout.layout.layoutHash
    || resolution.sourceAuthority.pathTokenSetHash !== nodePaths.value.tokenSetHash
    || resolution.sourceAuthority.semanticPathTokenSetHash
      !== semanticPaths.value.setHash
    || resolution.sourceAuthority.semanticRuleSetHash
      !== semanticIntents.intentSet.authority.semanticRuleSet.ruleSetHash
    || semanticPaths.value.sourceAuthority.semanticIntentSetHash
      !== semanticIntents.intentSet.intentSetHash
    || resolution.sourceAuthority.productSpecHash
      !== semanticIntents.intentSet.authority.productSpecHash
    || resolution.sourceAuthority.deliverySelectionHash
      !== semanticIntents.intentSet.authority.deliverySelection.selectionHash
    || resolution.sourceAuthority.profileId
      !== semanticIntents.intentSet.authority.deliverySelection.profileId
    || resolution.sourceAuthority.stackPackId
      !== semanticIntents.intentSet.authority.stackPackBinding.stackPackId
  ) {
    authorityFailure("Fresh layout, path, semantic, selection and scaffold authorities diverged");
  }
  return Object.freeze({
    layout: layout.layout,
    nodePathSet: nodePaths.value,
    semanticIntentSet: semanticIntents.intentSet,
    semanticPathSet: semanticPaths.value,
    scaffoldResolution: resolution,
  });
}

function nodePathTokenBySlotV2(
  pathSet: Readonly<NodeExecutionPathTokenSetV2>,
  slotRef: string,
): Readonly<PathTokenV2> {
  const found = pathSet.tokens.filter((token) => token.origin.slotRef === slotRef);
  if (found.length !== 1) authorityFailure(`Expected exactly one Node path token for ${slotRef}`);
  return found[0]!;
}

function semanticIntentByRefV2(
  intentSet: Readonly<SemanticSourceIntentSetV1>,
  intentRef: string,
): Readonly<SemanticSourceIntentV1> {
  const found = intentSet.intents.filter((intent) => intent.intentRef === intentRef);
  if (found.length !== 1) authorityFailure(`Expected exactly one semantic intent ${intentRef}`);
  return found[0]!;
}

function absentStateV2(
  normalizedLocator: string,
  evidence:
    | "private_scaffold_base_exact_inventory_v2"
    | "private_scaffold_base_source_root_absence_v2",
) {
  return Object.freeze({
    state: "absent" as const,
    absenceHash: hashFileTreePathAbsenceV2("repository", normalizedLocator),
    evidence,
  });
}

function pathEntryV2(
  normalizedLocator: string,
  value: Omit<
    FileTreePathEntryHashPayloadV2,
    | "pathRef"
    | "physicalSpace"
    | "normalizedLocator"
    | "pathIdentityHash"
    | "caseFoldPathIdentityHash"
  >,
): FileTreePathEntryV2 {
  const identity: FileTreePathEntryHashPayloadV2 = {
    pathRef: deriveFileTreePathRefV2("repository", normalizedLocator),
    physicalSpace: "repository",
    normalizedLocator,
    pathIdentityHash: hashPortablePathIdentityV2("repository", normalizedLocator),
    caseFoldPathIdentityHash:
      hashPortablePathCaseFoldIdentityV2("repository", normalizedLocator),
    ...value,
  };
  return FileTreePathEntryV2Schema.parse({
    ...identity,
    entryHash: hashFileTreePathEntryV2(identity),
  });
}

function storyOwnerForIntentV2(
  intent: Readonly<SemanticSourceIntentV1>,
): Extract<FileTreeOwnerV2, { kind: "story" }> {
  if (intent.semanticScope.kind !== "story") {
    authorityFailure(`Semantic path intent ${intent.intentRef} lacks story scope`);
  }
  return {
    ownerRef: deriveFileTreeStoryOwnerRefV2(
      intent.semanticScope.storyId,
      intent.semanticScope.componentHash,
    ),
    kind: "story",
    storyId: intent.semanticScope.storyId,
    componentHash: intent.semanticScope.componentHash,
  };
}

function requirementOwnerForIntentV2(
  intent: Readonly<SemanticSourceIntentV1>,
): Readonly<{ ownerRef: string; storyId: string | null; storyOwner?: FileTreeOwnerV2 }> {
  if (intent.semanticScope.kind === "setup") {
    return Object.freeze({ ownerRef: "OWNER_SETUP_V2", storyId: null });
  }
  if (intent.semanticScope.kind === "story") {
    const owner = storyOwnerForIntentV2(intent);
    return Object.freeze({
      ownerRef: owner.ownerRef,
      storyId: owner.storyId,
      storyOwner: owner,
    });
  }
  return authorityFailure(
    `Entrypoint requirement ${intent.intentRef} has unsupported ${intent.semanticScope.kind} scope`,
  );
}

function assertBaseReceiptJoinsV2(
  fresh: FreshAuthorityV2,
  base: Readonly<ScaffoldBaseMaterializationReceiptV2>,
  admissionScope: "production_host" | "test_fixture",
): void {
  const resolution = fresh.scaffoldResolution;
  if (
    base.admissionScope !== admissionScope
    || base.catalogBinding.catalogHash !== resolution.catalogBinding.catalogHash
    || base.catalogBinding.entryHash !== resolution.catalogBinding.entryHash
    || base.catalogBinding.profileId !== resolution.sourceAuthority.profileId
    || base.baseState.projectNpmrc.state !== "absent"
    || base.baseState.dependencyInstallation.state !== "absent"
    || base.baseState.sourceEntrypoint.sourceDirectoryState !== "absent"
    || base.baseState.sourceEntrypoint.state !== "absent"
  ) {
    authorityFailure("Authenticated F4 base receipt does not join the fresh product scaffold authority");
  }
  for (const binding of resolution.fileBindings) {
    const asset = base.assets.find((candidate) => candidate.role === binding.role);
    if (
      !asset
      || asset.normalizedLocator !== binding.normalizedLocator
      || asset.rawHash !== binding.rawHash
    ) {
      authorityFailure(`Scaffold asset ${binding.role} diverged from its fresh resolution`);
    }
  }
}

function buildConfigEntriesV2(
  fresh: FreshAuthorityV2,
  base: Readonly<ScaffoldBaseMaterializationReceiptV2>,
): FileTreePathEntryV2[] {
  return fresh.scaffoldResolution.fileBindings.map((binding) => {
    const asset = base.assets.find((candidate) => candidate.role === binding.role);
    if (!asset) authorityFailure(`Missing authenticated scaffold asset ${binding.role}`);
    const token = nodePathTokenBySlotV2(fresh.nodePathSet, binding.pathSlotRef);
    if (
      token.pathToken !== binding.pathToken
      || token.bindingHash !== binding.tokenBindingHash
      || token.normalizedLocator !== binding.normalizedLocator
    ) {
      authorityFailure(`Scaffold path authority diverged for ${binding.role}`);
    }
    return pathEntryV2(binding.normalizedLocator, {
      classification: "config",
      ownerRef: "OWNER_SETUP_V2",
      writeGrantOwnerRefs: [],
      access: "setup_readonly",
      currentState: {
        state: "present_file",
        mode: "0444",
        contentHash: asset.rawHash,
        byteLength: asset.rawByteLength,
      },
      authority: {
        kind: "scaffold_asset",
        scaffoldBaseSemanticInputHash: base.semanticInputHash,
        scaffoldBaseStateHash: base.baseStateHash,
        assetRole: binding.role,
        pathSlotRef: binding.pathSlotRef,
        pathToken: binding.pathToken,
        tokenBindingHash: binding.tokenBindingHash,
        deepVerificationReceiptHash: asset.verificationReceiptHash,
        consumerBindingHash: asset.consumerBindingHash,
      },
    });
  });
}

type SemanticBuildV2 = Readonly<{
  paths: readonly FileTreePathEntryV2[];
  storyOwners: readonly FileTreeOwnerV2[];
}>;

function buildSemanticEntriesV2(fresh: FreshAuthorityV2): SemanticBuildV2 {
  const groups = new Map<string, SemanticSourcePathTokenV2[]>();
  for (const token of fresh.semanticPathSet.tokens) {
    const current = groups.get(token.normalizedLocator) ?? [];
    current.push(token);
    groups.set(token.normalizedLocator, current);
  }
  const owners = new Map<string, FileTreeOwnerV2>();
  const paths: FileTreePathEntryV2[] = [];
  for (const [locator, tokens] of groups) {
    const first = tokens[0]!;
    const bindings = tokens.map((token) => {
      const intent = semanticIntentByRefV2(
        fresh.semanticIntentSet,
        token.intentAuthority.intentRef,
      );
      if (
        intent.target.kind !== "source_slot"
        || intent.intentHash !== token.intentAuthority.intentHash
        || intent.semanticScope.scopeRef !== token.intentAuthority.scopeRef
        || intent.subjectKind !== token.intentAuthority.subjectKind
        || intent.subjectRef !== token.intentAuthority.subjectRef
        || intent.ruleSetHash !== token.intentAuthority.ruleSetHash
        || intent.ruleRef !== token.origin.ruleRef
        || intent.responsibility !== token.origin.responsibility
        || canonicalJsonStringify(token.materialization)
          !== canonicalJsonStringify(first.materialization)
      ) {
        authorityFailure(`Semantic token ${token.bindingHash} diverged from its intent authority`);
      }
      const owner = storyOwnerForIntentV2(intent);
      owners.set(owner.ownerRef, owner);
      return {
        intentRef: intent.intentRef,
        intentHash: intent.intentHash,
        ruleSetHash: intent.ruleSetHash,
        ruleRef: intent.ruleRef,
        ruleHash: intent.ruleHash,
        scopeRef: intent.semanticScope.scopeRef,
        subjectKind: intent.subjectKind,
        subjectRef: intent.subjectRef,
        subjectHash: intent.subjectHash,
        responsibility: intent.responsibility,
        storyId: owner.storyId,
        storyComponentHash: owner.componentHash,
        writerOwnerRef: owner.ownerRef,
        accessPolicy: intent.target.accessPolicy,
        tokenBindingHash: token.bindingHash,
      };
    }).sort((left, right) => compareUtf16(left.intentRef, right.intentRef));
    const shared = first.materialization.kind === "shared_catalog_aggregate";
    const writerRefs = [...new Set(bindings.map((binding) =>
      binding.writerOwnerRef))].sort(compareUtf16);
    paths.push(pathEntryV2(locator, {
      classification: "source",
      ownerRef: shared ? "OWNER_SETUP_V2" : bindings[0]!.writerOwnerRef,
      writeGrantOwnerRefs: shared ? writerRefs : [],
      access: shared ? "model_granted_writable" : "model_owned_writable",
      currentState: absentStateV2(
        locator,
        "private_scaffold_base_source_root_absence_v2",
      ),
      authority: {
        kind: "semantic_source_path",
        semanticPathTokenSetHash: fresh.semanticPathSet.setHash,
        semanticPathToken: first.pathToken,
        materialization: structuredClone(first.materialization),
        intentBindingCount: bindings.length,
        intentBindings: bindings,
      },
    }));
  }
  return Object.freeze({
    paths: Object.freeze(paths),
    storyOwners: Object.freeze([...owners.values()]),
  });
}

type EntrypointBuildV2 = Readonly<{
  path: FileTreePathEntryV2;
  storyOwners: readonly FileTreeOwnerV2[];
}>;

function buildEntrypointEntryV2(fresh: FreshAuthorityV2): EntrypointBuildV2 {
  const selected = fresh.scaffoldResolution.selectedEntrypoint;
  const token = nodePathTokenBySlotV2(fresh.nodePathSet, selected.pathSlotRef);
  if (
    token.pathToken !== selected.pathToken
    || token.bindingHash !== selected.tokenBindingHash
    || token.normalizedLocator !== selected.normalizedLocator
  ) {
    authorityFailure("Selected entrypoint diverged from its Node path token");
  }
  const resolutionRequirements = new Map(
    fresh.scaffoldResolution.semanticRequirementBindings.map((binding) =>
      [binding.intentRef, binding] as const),
  );
  const owners = new Map<string, FileTreeOwnerV2>();
  const requirements = fresh.semanticPathSet.externalRequirements.map((requirement) => {
    const intent = semanticIntentByRefV2(fresh.semanticIntentSet, requirement.intentRef);
    const resolution = resolutionRequirements.get(requirement.intentRef);
    const expectation = requirement.expectation;
    if (
      !resolution
      || intent.target.kind !== "source_slot"
      || intent.target.accessPolicy !== "granted_writable"
      || expectation.kind !== "shared_structural_selected_entrypoint"
      || (expectation.entrypointKind !== "cli" && expectation.entrypointKind !== "api")
      || expectation.requiredAuthority !== "node_execution_path_token_v2"
      || requirement.intentHash !== intent.intentHash
      || requirement.ruleSetHash !== intent.ruleSetHash
      || requirement.ruleRef !== intent.ruleRef
      || requirement.responsibility !== intent.responsibility
      || resolution.requirementHash !== requirement.requirementHash
      || resolution.ruleRef !== requirement.ruleRef
      || resolution.responsibility !== requirement.responsibility
      || resolution.resolvedPathToken !== selected.pathToken
      || resolution.resolvedTokenBindingHash !== selected.tokenBindingHash
      || resolution.resolvedPathSlotRef !== selected.pathSlotRef
      || resolution.expectationKind !== expectation.kind
      || resolution.entrypointKind !== expectation.entrypointKind
      || resolution.requiredAuthority !== expectation.requiredAuthority
    ) {
      authorityFailure(`Entrypoint requirement ${requirement.intentRef} failed its exact join`);
    }
    const writer = requirementOwnerForIntentV2(intent);
    if (writer.storyOwner) owners.set(writer.storyOwner.ownerRef, writer.storyOwner);
    return {
      intentRef: intent.intentRef,
      intentHash: intent.intentHash,
      ruleSetHash: intent.ruleSetHash,
      requirementHash: requirement.requirementHash,
      ruleRef: intent.ruleRef,
      ruleHash: intent.ruleHash,
      scopeRef: intent.semanticScope.scopeRef,
      subjectKind: intent.subjectKind,
      subjectRef: intent.subjectRef,
      subjectHash: intent.subjectHash,
      responsibility: intent.responsibility,
      storyId: writer.storyId,
      writerOwnerRef: writer.ownerRef,
      accessPolicy: "granted_writable" as const,
      pathAuthorityProjectionHash: requirement.pathAuthorityProjectionHash,
      expectation: {
        kind: "shared_structural_selected_entrypoint" as const,
        entrypointKind: expectation.entrypointKind,
        requiredAuthority: "node_execution_path_token_v2" as const,
      },
      compatibilityStatus: resolution.compatibilityStatus,
    };
  }).sort((left, right) => compareUtf16(left.intentRef, right.intentRef));
  return Object.freeze({
    path: pathEntryV2(selected.normalizedLocator, {
      classification: "entrypoint_generated",
      ownerRef: "OWNER_NODE_ENTRYPOINT_GENERATOR_V2",
      writeGrantOwnerRefs: [],
      access: "generator_whole_file_future",
      currentState: absentStateV2(
        selected.normalizedLocator,
        "private_scaffold_base_source_root_absence_v2",
      ),
      authority: {
        kind: "node_entrypoint_plan",
        scaffoldResolutionHash: fresh.scaffoldResolution.resolutionHash,
        pathSlotRef: selected.pathSlotRef,
        pathToken: selected.pathToken,
        tokenBindingHash: selected.tokenBindingHash,
        finalOwnerRef: "NODE_ENTRYPOINT_GENERATOR_V2",
        sourceReceiptSchema: "setfarm.node-entrypoint-source-receipt.v2",
        sourceReceiptState: "absent",
        modelWriteAuthority: "forbidden",
        requirementCount: requirements.length,
        requirements,
      },
    }),
    storyOwners: Object.freeze([...owners.values()]),
  });
}

function buildHistoricalEntriesV2(fresh: FreshAuthorityV2): FileTreePathEntryV2[] {
  const entries: FileTreePathEntryV2[] = [];
  for (const slotRef of fresh.layout.topologyBinding.historicalEntrypointPathSlotRefs) {
    const token = nodePathTokenBySlotV2(fresh.nodePathSet, slotRef);
    entries.push(pathEntryV2(token.normalizedLocator, {
      classification: "compatibility_rejected",
      ownerRef: "OWNER_SETUP_V2",
      writeGrantOwnerRefs: [],
      access: "forbidden",
      currentState: absentStateV2(
        token.normalizedLocator,
        "private_scaffold_base_exact_inventory_v2",
      ),
      authority: {
        kind: "historical_entrypoint_rejection",
        layoutHash: fresh.layout.layoutHash,
        pathSlotRef: slotRef,
        pathToken: token.pathToken,
        tokenBindingHash: token.bindingHash,
        disposition: "reject_only",
      },
    }));
  }
  return entries;
}

function buildManifestV2(
  fresh: FreshAuthorityV2,
  base: Readonly<ScaffoldBaseMaterializationReceiptV2>,
): FileTreeManifestV2 {
  assertBaseReceiptJoinsV2(fresh, base, base.admissionScope);
  const configPaths = buildConfigEntriesV2(fresh, base);
  const semantic = buildSemanticEntriesV2(fresh);
  const entrypoint = buildEntrypointEntryV2(fresh);
  const historicalPaths = buildHistoricalEntriesV2(fresh);
  const npmrc = pathEntryV2(".npmrc", {
    classification: "config_absence",
    ownerRef: "OWNER_SETUP_V2",
    writeGrantOwnerRefs: [],
    access: "forbidden",
    currentState: absentStateV2(
      ".npmrc",
      "private_scaffold_base_exact_inventory_v2",
    ),
    authority: {
      kind: "project_npmrc_absence",
      scaffoldBaseSemanticInputHash: base.semanticInputHash,
      scaffoldBaseStateHash: base.baseStateHash,
    },
  });
  const paths = [
    ...configPaths,
    npmrc,
    ...semantic.paths,
    entrypoint.path,
    ...historicalPaths,
  ].sort((left, right) =>
    compareUtf16(
      `${left.physicalSpace}\0${left.normalizedLocator}`,
      `${right.physicalSpace}\0${right.normalizedLocator}`,
    ));
  const ownerMap = new Map<string, FileTreeOwnerV2>([
    ["OWNER_NODE_ENTRYPOINT_GENERATOR_V2", {
      ownerRef: "OWNER_NODE_ENTRYPOINT_GENERATOR_V2",
      kind: "generator",
      generatorRef: "NODE_ENTRYPOINT_GENERATOR_V2",
    }],
    ["OWNER_SETUP_V2", { ownerRef: "OWNER_SETUP_V2", kind: "setup" }],
  ]);
  for (const owner of [...semantic.storyOwners, ...entrypoint.storyOwners]) {
    const prior = ownerMap.get(owner.ownerRef);
    if (prior && canonicalJsonStringify(prior) !== canonicalJsonStringify(owner)) {
      authorityFailure(`Story owner ${owner.ownerRef} has conflicting component authority`);
    }
    ownerMap.set(owner.ownerRef, owner);
  }
  const owners = [...ownerMap.values()].sort((left, right) =>
    compareUtf16(left.ownerRef, right.ownerRef));
  const resolution = fresh.scaffoldResolution;
  const identity: FileTreeManifestHashPayloadV2 = {
    schema: FILE_TREE_MANIFEST_V2_SCHEMA,
    manifestVersion: FILE_TREE_MANIFEST_VERSION_V2,
    contractHash: FILE_TREE_MANIFEST_CONTRACT_HASH_V2,
    stage: "scaffold_base_ready",
    readiness: {
      status: "shadow_blocked",
      productionUse: "forbidden",
      blockerCodes: [...FILE_TREE_MANIFEST_BLOCKER_CODES_V2],
    },
    authority: {
      productRef: fresh.semanticIntentSet.authority.productRef,
      productSpecHash: fresh.semanticIntentSet.authority.productSpecHash,
      deliverySelectionHash:
        fresh.semanticIntentSet.authority.deliverySelection.selectionHash,
      profileId: resolution.sourceAuthority.profileId,
      stackPackId: resolution.sourceAuthority.stackPackId,
      nodeExecutionLayoutHash: fresh.layout.layoutHash,
      nodePathTokenSetHash: fresh.nodePathSet.tokenSetHash,
      semanticRuleSetHash:
        fresh.semanticIntentSet.authority.semanticRuleSet.ruleSetHash,
      semanticIntentSetHash: fresh.semanticIntentSet.intentSetHash,
      semanticPathTokenSetHash: fresh.semanticPathSet.setHash,
      scaffoldResolutionHash: resolution.resolutionHash,
      scaffoldCatalogHash: resolution.catalogBinding.catalogHash,
      scaffoldEntryHash: resolution.catalogBinding.entryHash,
      scaffoldBaseSemanticInputHash: base.semanticInputHash,
      scaffoldBaseStateHash: base.baseStateHash,
      projectInventory: {
        memberNames: [
          "package-lock.json",
          "package.json",
          "tsconfig.json",
        ],
        npmrcState: "absent",
        nodeModulesState: "absent",
        sourceDirectoryState: "absent",
        evidenceAuthority: "authenticated_private_base_fresh_revalidation_v2",
      },
    },
    semanticCoverage: {
      sourceSlotIntentCount:
        fresh.semanticPathSet.sourceAuthority.sourceSlotIntentCount,
      semanticTokenIntentCount: fresh.semanticPathSet.tokenCount,
      externalRequirementIntentCount:
        fresh.semanticPathSet.externalRequirementCount,
      semanticTokenMembershipHash:
        fresh.semanticPathSet.tokenMembershipHash,
      externalRequirementMembershipHash:
        fresh.semanticPathSet.externalRequirementMembershipHash,
      disposition: "every_source_slot_exactly_once",
    },
    ownerCount: owners.length,
    owners,
    ownerMembershipHash: hashFileTreeOwnerMembershipV2(owners),
    pathCount: paths.length,
    paths,
    pathMembershipHash: hashFileTreePathMembershipV2(paths),
  };
  return FileTreeManifestV2Schema.parse({
    ...identity,
    manifestHash: hashFileTreeManifestV2(identity),
  });
}

async function compileInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<FileTreeManifestCompilationResultV2> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      INPUT_MAX_CANONICAL_BYTES_V2,
      INPUT_BOUNDED_WORK_LIMITS_V2,
    );
  } catch (error) {
    return rejected("FILE_TREE_V2_INPUT_INVALID", "/", errorMessage(error));
  }
  const parsed = CompilerInputV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    return rejected(
      "FILE_TREE_V2_INPUT_INVALID",
      `/${parsed.error.issues[0]?.path.map(String).join("/") ?? ""}`
        .replace(/\/$/u, "") || "/",
      parsed.error.issues[0]?.message ?? "File-tree compiler input is invalid",
    );
  }
  let production: boolean;
  try {
    production = isProductionNodeScaffoldPrivateStageV2(handle);
  } catch (error) {
    return rejected("FILE_TREE_V2_PRIVATE_STAGE_INVALID", "/stage", errorMessage(error));
  }
  if (expectedScope === "production_host" && !production) {
    return rejected(
      "FILE_TREE_V2_PRODUCTION_AUTHORITY_REQUIRED",
      "/stage",
      "Production FileTree compiler requires an authenticated production_host F4 stage",
    );
  }
  if (expectedScope === "test_fixture" && production) {
    return rejected(
      "FILE_TREE_V2_TEST_AUTHORITY_REQUIRED",
      "/stage",
      "Test FileTree compiler cannot consume or downgrade production authority",
    );
  }
  try {
    const base = await revalidateNodeScaffoldPrivateStageV2(handle);
    const inspectedBase = inspectScaffoldBaseMaterializationReceiptV2(handle);
    if (
      base.receiptHash !== inspectedBase.receiptHash
      || base.admissionScope !== expectedScope
    ) {
      authorityFailure("Authenticated stage scope changed during FileTree compilation");
    }
    const fresh = reproduceFreshAuthorityV2(parsed.data);
    assertBaseReceiptJoinsV2(fresh, base, expectedScope);
    const value = recursivelyFreezeFileTreeManifestV2(
      buildManifestV2(fresh, base),
    );
    let canonicalBytes: Buffer;
    try {
      canonicalBytes = canonicalJsonBytesBounded(value, {
        maxBytes: FILE_TREE_MANIFEST_MAX_CANONICAL_BYTES_V2,
        ...FILE_TREE_MANIFEST_BOUNDED_WORK_LIMITS_V2,
      });
    } catch (error) {
      return rejected(
        "FILE_TREE_V2_OUTPUT_LIMIT_EXCEEDED",
        "/",
        errorMessage(error),
      );
    }
    return recursivelyFreezeFileTreeManifestV2({
      status: "shadow_compiled" as const,
      diagnostics: EMPTY_DIAGNOSTICS,
      value,
      canonicalBytes: canonicalBytes.toString("utf8"),
    });
  } catch (error) {
    return rejected(
      error instanceof FileTreeUpstreamAuthorityErrorV2
        ? "FILE_TREE_V2_UPSTREAM_AUTHORITY_REJECTED"
        : error instanceof FileTreeCodeAuthorityErrorV2
          ? "FILE_TREE_V2_CODE_AUTHORITY_DRIFT"
          : error instanceof NodeScaffoldPrivateMaterializerErrorV2
            ? "FILE_TREE_V2_PRIVATE_STAGE_INVALID"
          : "FILE_TREE_V2_ARTIFACT_INVALID",
      "/",
      errorMessage(error),
    );
  }
}

export function compileFileTreeManifestV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<FileTreeManifestCompilationResultV2> {
  return compileInternalV2(handle, input, "production_host");
}

export function compileFileTreeManifestV2ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<FileTreeManifestCompilationResultV2> {
  return compileInternalV2(handle, input, "test_fixture");
}

export type FileTreeManifestVerificationErrorCodeV2 =
  | "FILE_TREE_V2_VERIFICATION_AUTHORITY_MISMATCH"
  | "FILE_TREE_V2_VERIFICATION_CANDIDATE_INVALID"
  | "FILE_TREE_V2_VERIFICATION_INPUT_INVALID"
  | "FILE_TREE_V2_VERIFICATION_REPRODUCTION_REJECTED";

export class FileTreeManifestVerificationErrorV2 extends Error {
  readonly code: FileTreeManifestVerificationErrorCodeV2;

  constructor(code: FileTreeManifestVerificationErrorCodeV2, message: string) {
    super(message.slice(0, 1_500));
    this.name = "FileTreeManifestVerificationErrorV2";
    this.code = code;
  }
}

export type VerifiedShadowFileTreeManifestV2 = Readonly<{
  status: "verified_shadow";
  value: Readonly<FileTreeManifestV2>;
  canonicalBytes: string;
}>;

async function verifyInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<VerifiedShadowFileTreeManifestV2> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2,
      VERIFIER_BOUNDED_WORK_LIMITS_V2,
    );
  } catch (error) {
    throw new FileTreeManifestVerificationErrorV2(
      "FILE_TREE_V2_VERIFICATION_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const parsed = VerifierInputV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    throw new FileTreeManifestVerificationErrorV2(
      "FILE_TREE_V2_VERIFICATION_INPUT_INVALID",
      parsed.error.issues[0]?.message ?? "File-tree verifier input is invalid",
    );
  }
  const candidate = FileTreeManifestV2Schema.safeParse(parsed.data.candidate);
  if (!candidate.success) {
    throw new FileTreeManifestVerificationErrorV2(
      "FILE_TREE_V2_VERIFICATION_CANDIDATE_INVALID",
      candidate.error.issues[0]?.message ?? "File-tree candidate is invalid",
    );
  }
  const reproduced = await compileInternalV2(handle, {
    productSpec: parsed.data.productSpec,
    deliverySelection: parsed.data.deliverySelection,
  }, expectedScope);
  if (reproduced.status !== "shadow_compiled") {
    throw new FileTreeManifestVerificationErrorV2(
      "FILE_TREE_V2_VERIFICATION_REPRODUCTION_REJECTED",
      reproduced.diagnostics[0]?.message ?? "Fresh FileTree reproduction was rejected",
    );
  }
  if (canonicalJsonStringify(candidate.data) !== reproduced.canonicalBytes) {
    throw new FileTreeManifestVerificationErrorV2(
      "FILE_TREE_V2_VERIFICATION_AUTHORITY_MISMATCH",
      "FileTree candidate does not equal fresh product, layout, semantic and authenticated F4 authority",
    );
  }
  return recursivelyFreezeFileTreeManifestV2({
    status: "verified_shadow" as const,
    value: reproduced.value,
    canonicalBytes: reproduced.canonicalBytes,
  });
}

async function verifyAtDependencyStageInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<VerifiedShadowFileTreeManifestV2> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2,
      VERIFIER_BOUNDED_WORK_LIMITS_V2,
    );
  } catch (error) {
    throw new FileTreeManifestVerificationErrorV2(
      "FILE_TREE_V2_VERIFICATION_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const parsed = VerifierInputV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    throw new FileTreeManifestVerificationErrorV2(
      "FILE_TREE_V2_VERIFICATION_INPUT_INVALID",
      parsed.error.issues[0]?.message ?? "File-tree verifier input is invalid",
    );
  }
  const candidate = FileTreeManifestV2Schema.safeParse(parsed.data.candidate);
  if (!candidate.success) {
    throw new FileTreeManifestVerificationErrorV2(
      "FILE_TREE_V2_VERIFICATION_CANDIDATE_INVALID",
      candidate.error.issues[0]?.message ?? "File-tree candidate is invalid",
    );
  }
  try {
    const production = isProductionNodeScaffoldPrivateStageV2(handle);
    if (
      (expectedScope === "production_host" && !production)
      || (expectedScope === "test_fixture" && production)
    ) {
      throw new FileTreeUpstreamAuthorityErrorV2(
        "Dependency-stage FileTree verification cannot promote or downgrade authority",
      );
    }
    const dependency = await revalidateNodeScaffoldDependenciesV2(handle);
    const inspectedDependency = inspectBuildDependencyMaterializationReceiptV2(handle);
    const base = inspectScaffoldBaseMaterializationReceiptV2(handle);
    if (
      dependency.receiptHash !== inspectedDependency.receiptHash
      || dependency.admissionScope !== expectedScope
      || dependency.scaffoldBase.receiptHash !== base.receiptHash
      || dependency.scaffoldBase.semanticInputHash !== base.semanticInputHash
      || dependency.scaffoldBase.startBaseStateHash !== base.baseStateHash
      || dependency.scaffoldBase.endBaseFileMembershipHash
        !== base.baseState.fileMembershipHash
      || dependency.scaffoldBase.projectNpmrcState !== "absent"
    ) {
      throw new FileTreeUpstreamAuthorityErrorV2(
        "Dependency receipt does not preserve its exact authenticated scaffold base",
      );
    }
    const fresh = reproduceFreshAuthorityV2({
      productSpec: parsed.data.productSpec,
      deliverySelection: parsed.data.deliverySelection,
    });
    assertBaseReceiptJoinsV2(fresh, base, expectedScope);
    const reproduced = recursivelyFreezeFileTreeManifestV2(
      buildManifestV2(fresh, base),
    );
    const canonicalBytes = canonicalJsonBytesBounded(reproduced, {
      maxBytes: FILE_TREE_MANIFEST_MAX_CANONICAL_BYTES_V2,
      ...FILE_TREE_MANIFEST_BOUNDED_WORK_LIMITS_V2,
    }).toString("utf8");
    if (canonicalJsonStringify(candidate.data) !== canonicalBytes) {
      throw new FileTreeManifestVerificationErrorV2(
        "FILE_TREE_V2_VERIFICATION_AUTHORITY_MISMATCH",
        "FileTree candidate does not equal fresh product, layout, semantic and dependency-stage F4 authority",
      );
    }
    return recursivelyFreezeFileTreeManifestV2({
      status: "verified_shadow" as const,
      value: reproduced,
      canonicalBytes,
    });
  } catch (error) {
    if (error instanceof FileTreeManifestVerificationErrorV2) throw error;
    throw new FileTreeManifestVerificationErrorV2(
      "FILE_TREE_V2_VERIFICATION_REPRODUCTION_REJECTED",
      errorMessage(error),
    );
  }
}

export function verifyFileTreeManifestV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedShadowFileTreeManifestV2> {
  return verifyInternalV2(handle, input, "production_host");
}

export function verifyFileTreeManifestV2ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedShadowFileTreeManifestV2> {
  return verifyInternalV2(handle, input, "test_fixture");
}

export function verifyFileTreeManifestV2AtDependencyStage(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedShadowFileTreeManifestV2> {
  return verifyAtDependencyStageInternalV2(handle, input, "production_host");
}

export function verifyFileTreeManifestV2AtDependencyStageForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedShadowFileTreeManifestV2> {
  return verifyAtDependencyStageInternalV2(handle, input, "test_fixture");
}

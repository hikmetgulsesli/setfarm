import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
  type CanonicalJsonBoundedLimits,
} from "./bounded-canonical-json.js";
import { canonicalJsonStringify } from "./canonical-json.js";
import {
  compileSemanticSourceIntentSetV1,
} from "./semantic-source-intent-set-v1.js";
import {
  SEMANTIC_SOURCE_PATH_PROJECTION_V2_SCHEMA,
  SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V2,
  SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V2,
  SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_VERSION_V2,
  SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_HASH_V2,
  SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2,
  SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_VERSION_V2,
  SEMANTIC_SOURCE_PATH_TOKEN_SET_BLOCKER_CODES_V2,
  SEMANTIC_SOURCE_PATH_TOKEN_SET_MAX_CANONICAL_BYTES_V2,
  SEMANTIC_SOURCE_PATH_TOKEN_SET_V2_SCHEMA,
  SEMANTIC_SOURCE_PATH_TOKEN_V2_SCHEMA,
  SEMANTIC_SOURCE_EXTERNAL_PATH_REQUIREMENT_V2_SCHEMA,
  SemanticSourceExternalPathRequirementV2Schema,
  SemanticSourcePathScopeIdentityV2Schema,
  SemanticSourcePathSubjectIdentityV2Schema,
  SemanticSourcePathProjectionV2Schema,
  SemanticSourcePathTokenSetV2Schema,
  SemanticSourcePathTokenV2Schema,
  hashSemanticSourceExternalPathRequirementV2,
  hashSemanticSourceExternalPathProjectionV2,
  hashSemanticSourceExternalRequirementMembershipV2,
  hashSemanticSourceLegacyFixedReleaseProjectionV2,
  hashSemanticSourcePortableCaseFoldPathIdentityV2,
  hashSemanticSourcePortablePathIdentityV2,
  hashSemanticSourcePathProjectionV2,
  hashSemanticSourcePathTokenBindingV2,
  hashSemanticSourcePathTokenMembershipV2,
  hashSemanticSourcePathTokenOriginV2,
  hashSemanticSourcePathTokenSetV2,
  type ExternalPathRequirementHashPayloadV2,
  type SemanticSourceExternalPathRequirementV2,
  type SemanticSourcePathProjectionHashPayloadV2,
  type SemanticSourcePathScopeIdentityV2,
  type SemanticSourcePathSubjectIdentityV2,
  type SemanticSourcePathTokenBindingHashPayloadV2,
  type SemanticSourcePathTokenSetV2,
  type SemanticSourcePathTokenV2,
} from "./schemas/semantic-source-path-token-set-v2.js";
import {
  recursivelyFreezePathTokenSetV2,
} from "./schemas/path-token-v2.js";
import type {
  SemanticSourceIntentV1,
} from "./schemas/semantic-source-intent-set-v1.js";

const COMPILER_INPUT_MAX_BYTES = 8 * 1024 * 1024;
const VERIFIER_INPUT_MAX_BYTES = 13 * 1024 * 1024;
const MAX_DIAGNOSTICS = 100;
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

const COMPILER_BOUNDED_WORK_LIMITS = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 4,
  maxNodes: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxNodes + 32_768,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxWorkUnits + (4 * 1024 * 1024),
});

const VERIFIER_BOUNDED_WORK_LIMITS = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 8,
  maxNodes:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxNodes
    + SEMANTIC_SOURCE_PATH_TOKEN_SET_MAX_CANONICAL_BYTES_V2
    + 16_384,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxWorkUnits
    + (SEMANTIC_SOURCE_PATH_TOKEN_SET_MAX_CANONICAL_BYTES_V2 * 8)
    + (4 * 1024 * 1024),
});

const EXPECTED_SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V2 =
  "95d3163989013d02135edbba27402fba903e9501451d0dd1bb269ec43a79f78b";
const EXPECTED_SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_HASH_V2 =
  "a6cd5765406a55bcdec4799d002d58405cf2aac6d1d451bc8dd194aebcb66ee1";

const NO_DESIGN_CLOSURE_V2 = Object.freeze({
  schema: "setfarm.design-source-closure.v2" as const,
  kind: "none" as const,
  reason: "product_delivery_design_not_required" as const,
});

function boundedSnapshot(
  value: unknown,
  maxBytes: number,
  workLimits: Omit<CanonicalJsonBoundedLimits, "maxBytes">,
): unknown {
  const bytes = canonicalJsonBytesBounded(value, {
    maxBytes,
    ...workLimits,
  });
  return JSON.parse(bytes.toString("utf8"));
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 1_000)
    : "Invalid bounded canonical JSON input";
}

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireTokenContractAuthority(): void {
  if (
    SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V2
    === EXPECTED_SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V2
  ) return;
  throw new SemanticSourcePathTokenCodeAuthorityErrorV2(
    "Semantic source path-identity contract changed without an intentional version/hash transition",
  );
}

function requireSetContractAuthority(): void {
  if (
    SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_HASH_V2
    === EXPECTED_SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_HASH_V2
  ) return;
  throw new SemanticSourcePathTokenCodeAuthorityErrorV2(
    "Semantic source path-token set contract changed without an intentional version/hash transition",
  );
}

export class SemanticSourcePathTokenCodeAuthorityErrorV2 extends Error {
  readonly code = "SEMANTIC_SOURCE_PATH_TOKEN_V2_CODE_AUTHORITY_DRIFT" as const;

  constructor(message: string) {
    super(message);
    this.name = "SemanticSourcePathTokenCodeAuthorityErrorV2";
  }
}

export function getCodeOwnedSemanticSourcePathTokenContractV2():
  typeof SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V2 {
  requireTokenContractAuthority();
  return SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V2;
}

export function getCodeOwnedSemanticSourcePathTokenSetContractV2():
typeof SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2 {
  requireSetContractAuthority();
  return SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2;
}

const CompilerInputV2Schema = z.object({
  productSpec: z.unknown(),
  deliverySelection: z.unknown(),
}).strict();

const VerificationInputV2Schema = z.object({
  productSpec: z.unknown(),
  deliverySelection: z.unknown(),
  candidate: z.unknown(),
}).strict();

export type SemanticSourcePathTokenCompilationDiagnosticCodeV2 =
  | "SEMANTIC_SOURCE_PATH_TOKEN_V2_INPUT_INVALID"
  | "SEMANTIC_SOURCE_PATH_TOKEN_V2_INTENT_COMPILATION_REJECTED"
  | "SEMANTIC_SOURCE_PATH_TOKEN_V2_CODE_AUTHORITY_DRIFT"
  | "SEMANTIC_SOURCE_PATH_TOKEN_V2_ARTIFACT_INVALID"
  | "SEMANTIC_SOURCE_PATH_TOKEN_V2_OUTPUT_LIMIT_EXCEEDED";

export type SemanticSourcePathTokenCompilationDiagnosticV2 = Readonly<{
  code: SemanticSourcePathTokenCompilationDiagnosticCodeV2;
  path: string;
  message: string;
}>;

export type SemanticSourcePathTokenCompilationResultV2 =
  | Readonly<{
      status: "shadow_compiled";
      diagnostics: readonly [];
      value: Readonly<SemanticSourcePathTokenSetV2>;
      canonicalBytes: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly SemanticSourcePathTokenCompilationDiagnosticV2[];
    }>;

function diagnostic(
  code: SemanticSourcePathTokenCompilationDiagnosticCodeV2,
  path: string,
  message: string,
): SemanticSourcePathTokenCompilationDiagnosticV2 {
  return Object.freeze({
    code,
    path: path.slice(0, 500),
    message: message.slice(0, 1_000),
  });
}

function rejected(
  code: SemanticSourcePathTokenCompilationDiagnosticCodeV2,
  path: string,
  message: string,
): SemanticSourcePathTokenCompilationResultV2 {
  return recursivelyFreezePathTokenSetV2({
    status: "rejected" as const,
    diagnostics: [diagnostic(code, path, message)].slice(0, MAX_DIAGNOSTICS),
  });
}

function stablePathScopeIdentity(
  intent: SemanticSourceIntentV1,
): SemanticSourcePathScopeIdentityV2 {
  if (
    intent.subjectOrigin.originKind === "runtime_data_contract"
    || intent.subjectOrigin.originKind === "persistence_absence"
  ) {
    return SemanticSourcePathScopeIdentityV2Schema.parse({
      schema: "setfarm.semantic-source-path-scope-identity.v2",
      scope: {
        kind: "product",
        productRef: intent.subjectOrigin.productRef,
      },
    });
  }
  const scope = intent.semanticScope;
  const projected = scope.kind === "story" || scope.kind === "product"
    ? { kind: scope.kind, productRef: scope.productRef }
    : scope.kind === "setup"
      ? { kind: scope.kind, stackPackId: scope.stackPackId }
      : {
          kind: scope.kind,
          platformAuthorityRef: scope.platformAuthorityRef,
        };
  return SemanticSourcePathScopeIdentityV2Schema.parse({
    schema: "setfarm.semantic-source-path-scope-identity.v2",
    scope: projected,
  });
}

function stablePathSubjectIdentity(
  intent: SemanticSourceIntentV1,
): SemanticSourcePathSubjectIdentityV2 {
  const origin = intent.subjectOrigin;
  let projected: Record<string, unknown>;
  switch (origin.originKind) {
    case "entrypoint":
      projected = {
        originKind: origin.originKind,
        subjectKind: "entrypoint",
        productRef: origin.productRef,
        entrypointKind: origin.entrypointKind,
      };
      break;
    case "command":
      projected = { originKind: origin.originKind, subjectKind: "command", commandRef: origin.commandRef };
      break;
    case "route":
      projected = { originKind: origin.originKind, subjectKind: "route", routeRef: origin.routeRef };
      break;
    case "surface":
      projected = { originKind: origin.originKind, subjectKind: "surface", surfaceRef: origin.surfaceRef };
      break;
    case "control_slot":
      projected = {
        originKind: origin.originKind,
        subjectKind: "control_slot",
        controlSlotRef: origin.controlSlotRef,
        actionRef: origin.actionRef,
      };
      break;
    case "physical_control":
      projected = {
        originKind: origin.originKind,
        subjectKind: "physical_control",
        physicalControlRef: origin.physicalControlRef,
        controlSlotRef: origin.controlSlotRef,
        actionRef: origin.actionRef,
      };
      break;
    case "action":
      projected = { originKind: origin.originKind, subjectKind: "action", actionRef: origin.actionRef };
      break;
    case "action_input":
      projected = {
        originKind: origin.originKind,
        subjectKind: "action_input",
        actionRef: origin.actionRef,
        fieldName: origin.fieldName,
      };
      break;
    case "state":
      projected = { originKind: origin.originKind, subjectKind: "state", stateRef: origin.stateRef };
      break;
    case "persistence_policy":
      projected = {
        originKind: origin.originKind,
        subjectKind: "persistence_policy",
        persistenceRef: origin.persistenceRef,
      };
      break;
    case "persistence_absence":
      projected = {
        originKind: origin.originKind,
        subjectKind: "persistence_policy",
        productRef: origin.productRef,
        aggregationRef:
          SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V2.sharedAggregation
            .persistenceAbsence,
      };
      break;
    case "entity":
      projected = { originKind: origin.originKind, subjectKind: "entity", entityRef: origin.entityRef };
      break;
    case "observable":
      projected = {
        originKind: origin.originKind,
        subjectKind: "observable",
        observableRef: origin.observableRef,
        actionRef: origin.actionRef,
      };
      break;
    case "evidence_predicate":
      projected = {
        originKind: origin.originKind,
        subjectKind: "evidence_predicate",
        evidenceRef: origin.evidenceRef,
      };
      break;
    case "runtime_data_contract":
      projected = {
        originKind: origin.originKind,
        subjectKind: "runtime_data_contract",
        productRef: origin.productRef,
        aggregationRef:
          SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V2.sharedAggregation.runtimeData,
      };
      break;
  }
  return SemanticSourcePathSubjectIdentityV2Schema.parse({
    schema: "setfarm.semantic-source-path-subject-identity.v2",
    ...projected,
  });
}

function stablePathIdentity(intent: SemanticSourceIntentV1) {
  return {
    scopeIdentity: stablePathScopeIdentity(intent),
    subjectIdentity: stablePathSubjectIdentity(intent),
    responsibility: intent.responsibility,
    ruleRef: intent.ruleRef,
  };
}

function tokenIntentAuthority(intent: SemanticSourceIntentV1) {
  return {
    ruleSetHash: intent.ruleSetHash,
    scopeRef: intent.semanticScope.scopeRef,
    subjectKind: intent.subjectKind,
    subjectRef: intent.subjectRef,
    intentRef: intent.intentRef,
    intentHash: intent.intentHash,
  };
}

function externalIntentAuthorityBinding(intent: SemanticSourceIntentV1) {
  return {
    ruleSetHash: intent.ruleSetHash,
    scopeRef: intent.semanticScope.scopeRef,
    subjectKind: intent.subjectKind,
    subjectRef: intent.subjectRef,
    responsibility: intent.responsibility,
    ruleRef: intent.ruleRef,
    intentRef: intent.intentRef,
    intentHash: intent.intentHash,
  };
}

function semanticPathProjection(
  intent: SemanticSourceIntentV1 & {
    target: Extract<SemanticSourceIntentV1["target"], { kind: "source_slot" }>;
  },
): SemanticSourcePathProjectionHashPayloadV2 {
  const resolution = intent.target.pathResolution;
  const projectionContract =
    SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.semanticProjection;
  if (resolution.kind !== "compiler_semantic_token_path") {
    throw new SemanticSourcePathTokenCodeAuthorityErrorV2(
      `Intent ${intent.intentRef} is not a compiler semantic-token path`,
    );
  }
  if (resolution.root !== projectionContract.root) {
    throw new SemanticSourcePathTokenCodeAuthorityErrorV2(
      `Intent ${intent.intentRef} uses an unsupported semantic source root`,
    );
  }
  return {
    schema: SEMANTIC_SOURCE_PATH_PROJECTION_V2_SCHEMA,
    root: projectionContract.root,
    extension: resolution.extension,
    namespace: projectionContract.namespace,
    physicalSpace: projectionContract.physicalSpace,
    underRootRef: projectionContract.underRootRef,
  };
}

function semanticPathToken(
  intent: SemanticSourceIntentV1 & {
    target: Extract<SemanticSourceIntentV1["target"], { kind: "source_slot" }>;
  },
): SemanticSourcePathTokenV2 {
  const pathProjectionIdentity = semanticPathProjection(intent);
  const pathProjection = SemanticSourcePathProjectionV2Schema.parse({
    ...pathProjectionIdentity,
    projectionHash: hashSemanticSourcePathProjectionV2(pathProjectionIdentity),
  });
  const origin = {
    contractVersion: SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_VERSION_V2,
    contractHash: SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V2,
    ...stablePathIdentity(intent),
    pathProjectionHash: pathProjection.projectionHash,
  };
  const pathToken = hashSemanticSourcePathTokenOriginV2(origin);
  const normalizedLocator =
    `${pathProjection.root}/${pathToken}${pathProjection.extension}`;
  const identity: SemanticSourcePathTokenBindingHashPayloadV2 = {
    schema: SEMANTIC_SOURCE_PATH_TOKEN_V2_SCHEMA,
    origin,
    intentAuthority: tokenIntentAuthority(intent),
    materialization:
      origin.subjectIdentity.originKind === "runtime_data_contract"
      || origin.subjectIdentity.originKind === "persistence_absence"
        ? {
            kind: "shared_catalog_aggregate",
            aggregationRef: origin.subjectIdentity.aggregationRef,
          }
        : { kind: "exclusive_file" },
    pathToken,
    pathProjection,
    namespace: pathProjection.namespace,
    disposition: "planned",
    nodeKind: "file",
    physicalSpace: pathProjection.physicalSpace,
    underRootRef: pathProjection.underRootRef,
    normalizedLocator,
    locatorByteLength: Buffer.byteLength(normalizedLocator, "utf8"),
    segmentCount: normalizedLocator.split("/").length,
    pathIdentityHash: hashSemanticSourcePortablePathIdentityV2(
      pathProjection.physicalSpace,
      normalizedLocator,
    ),
    caseFoldPathIdentityHash: hashSemanticSourcePortableCaseFoldPathIdentityV2(
      pathProjection.physicalSpace,
      normalizedLocator,
    ),
  };
  return SemanticSourcePathTokenV2Schema.parse({
    ...identity,
    bindingHash: hashSemanticSourcePathTokenBindingV2(identity),
  });
}

function externalPathProjection(
  intent: SemanticSourceIntentV1 & {
    target: Extract<SemanticSourceIntentV1["target"], { kind: "source_slot" }>;
  },
): Readonly<{
  pathAuthorityProjectionHash: string;
  expectation: ExternalPathRequirementHashPayloadV2["expectation"];
}> {
  const resolution = intent.target.pathResolution;
  const rules =
    SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.externalProjectionRules;
  if (resolution.kind === rules.selectedEntrypoint.sourceKind) {
    const expectation = {
      kind: rules.selectedEntrypoint.expectationKind,
      entrypointKind: resolution.entrypointKind,
      requiredAuthority: rules.selectedEntrypoint.requiredAuthority,
    };
    return {
      expectation,
      pathAuthorityProjectionHash:
        hashSemanticSourceExternalPathProjectionV2(expectation),
    };
  }
  if (resolution.kind === rules.generatedReceipt.sourceKind) {
    if (resolution.receiptSchema !== rules.generatedReceipt.receiptSchema) {
      throw new SemanticSourcePathTokenCodeAuthorityErrorV2(
        `Intent ${intent.intentRef} uses an unsupported generated receipt schema`,
      );
    }
    const expectation = {
      kind: rules.generatedReceipt.expectationKind,
      receiptSchema: rules.generatedReceipt.receiptSchema,
      requiredAuthority: rules.generatedReceipt.requiredAuthority,
    };
    return {
      expectation,
      pathAuthorityProjectionHash:
        hashSemanticSourceExternalPathProjectionV2(expectation),
    };
  }
  if (resolution.kind === rules.fixedRelease.sourceKind) {
    const legacyProjectionHash =
      hashSemanticSourceLegacyFixedReleaseProjectionV2(resolution.path);
    const expectation = {
      kind: rules.fixedRelease.expectationKind,
      requiredAuthority: rules.fixedRelease.requiredAuthority,
      legacyProjectionHash,
    };
    return {
      expectation,
      pathAuthorityProjectionHash:
        hashSemanticSourceExternalPathProjectionV2(expectation),
    };
  }
  if (resolution.kind === rules.sharedSelectedEntrypoint.sourceKind) {
    if (
      resolution.pathSource.kind
      === rules.sharedSelectedEntrypoint.pathSourceKind
    ) {
      const expectation = {
        kind: rules.sharedSelectedEntrypoint.expectationKind,
        entrypointKind: resolution.pathSource.entrypointKind,
        requiredAuthority: rules.sharedSelectedEntrypoint.requiredAuthority,
      };
      return {
        expectation,
        pathAuthorityProjectionHash:
          hashSemanticSourceExternalPathProjectionV2(expectation),
      };
    }
    if (
      resolution.pathSource.kind
      !== rules.sharedFixedRelease.pathSourceKind
    ) {
      throw new SemanticSourcePathTokenCodeAuthorityErrorV2(
        `Intent ${intent.intentRef} uses an unsupported shared path source`,
      );
    }
    const legacyProjectionHash =
      hashSemanticSourceLegacyFixedReleaseProjectionV2(
        resolution.pathSource.path,
      );
    const expectation = {
      kind: rules.sharedFixedRelease.expectationKind,
      requiredAuthority: rules.sharedFixedRelease.requiredAuthority,
      legacyProjectionHash,
    };
    return {
      expectation,
      pathAuthorityProjectionHash:
        hashSemanticSourceExternalPathProjectionV2(expectation),
    };
  }
  throw new SemanticSourcePathTokenCodeAuthorityErrorV2(
    `Unhandled external semantic path projection ${intent.intentRef}`,
  );
}

function externalRequirement(
  intent: SemanticSourceIntentV1 & {
    target: Extract<SemanticSourceIntentV1["target"], { kind: "source_slot" }>;
  },
): SemanticSourceExternalPathRequirementV2 {
  const projection = externalPathProjection(intent);
  const identity: ExternalPathRequirementHashPayloadV2 = {
    schema: SEMANTIC_SOURCE_EXTERNAL_PATH_REQUIREMENT_V2_SCHEMA,
    ...externalIntentAuthorityBinding(intent),
    ...projection,
  };
  return SemanticSourceExternalPathRequirementV2Schema.parse({
    ...identity,
    requirementHash: hashSemanticSourceExternalPathRequirementV2(identity),
  });
}

function buildSemanticSourcePathTokenSetV2(
  intentSet: Extract<
    ReturnType<typeof compileSemanticSourceIntentSetV1>,
    { status: "shadow_compiled" }
  >["intentSet"],
): SemanticSourcePathTokenSetV2 {
  requireTokenContractAuthority();
  requireSetContractAuthority();
  const sourceSlotIntents = intentSet.intents.filter((intent) =>
    intent.target.kind === "source_slot");
  const tokens = sourceSlotIntents
    .filter((intent) =>
      intent.target.kind === "source_slot"
      && intent.target.pathResolution.kind === "compiler_semantic_token_path")
    .map((intent) => semanticPathToken(intent as SemanticSourceIntentV1 & {
      target: Extract<SemanticSourceIntentV1["target"], { kind: "source_slot" }>;
    }))
    .sort((left, right) =>
      compareUtf16(
        left.intentAuthority.intentRef,
        right.intentAuthority.intentRef,
      ));
  const externalRequirements = sourceSlotIntents
    .filter((intent) =>
      intent.target.kind === "source_slot"
      && intent.target.pathResolution.kind !== "compiler_semantic_token_path")
    .map((intent) => externalRequirement(intent as SemanticSourceIntentV1 & {
      target: Extract<SemanticSourceIntentV1["target"], { kind: "source_slot" }>;
    }))
    .sort((left, right) => compareUtf16(left.intentRef, right.intentRef));
  const authority = intentSet.authority;
  const withoutHash = {
    schema: SEMANTIC_SOURCE_PATH_TOKEN_SET_V2_SCHEMA,
    setVersion: SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_VERSION_V2,
    tokenContractHash: SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V2,
    setContractHash: SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_HASH_V2,
    sourceAuthority: {
      kind: "semantic_source_intent_set_v1" as const,
      productRef: authority.productRef,
      productSpecHash: authority.productSpecHash,
      deliverySelectionHash: authority.deliverySelection.selectionHash,
      profileId: authority.deliverySelection.profileId,
      stackPackId: authority.stackPackBinding.stackPackId,
      semanticRuleSetHash: authority.semanticRuleSet.ruleSetHash,
      semanticIntentSetHash: intentSet.intentSetHash,
      sourceSlotIntentCount: sourceSlotIntents.length,
    },
    readiness: {
      status: "shadow" as const,
      productionUse: "forbidden" as const,
      blockerCodes: [...SEMANTIC_SOURCE_PATH_TOKEN_SET_BLOCKER_CODES_V2],
    },
    tokenCount: tokens.length,
    uniquePathCount: new Set(tokens.map((token) =>
      `${token.physicalSpace}\0${token.normalizedLocator}`)).size,
    tokens,
    tokenMembershipHash: hashSemanticSourcePathTokenMembershipV2(tokens),
    externalRequirementCount: externalRequirements.length,
    externalRequirements,
    externalRequirementMembershipHash:
      hashSemanticSourceExternalRequirementMembershipV2(externalRequirements),
  };
  return SemanticSourcePathTokenSetV2Schema.parse({
    ...withoutHash,
    setHash: hashSemanticSourcePathTokenSetV2(withoutHash as SemanticSourcePathTokenSetV2),
  });
}

export function compileSemanticSourcePathTokenSetV2(
  input: unknown,
): SemanticSourcePathTokenCompilationResultV2 {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      COMPILER_INPUT_MAX_BYTES,
      COMPILER_BOUNDED_WORK_LIMITS,
    );
  } catch (error) {
    return rejected(
      "SEMANTIC_SOURCE_PATH_TOKEN_V2_INPUT_INVALID",
      "/",
      errorMessage(error),
    );
  }
  const outer = CompilerInputV2Schema.safeParse(snapshot);
  if (!outer.success) {
    return rejected(
      "SEMANTIC_SOURCE_PATH_TOKEN_V2_INPUT_INVALID",
      `/${outer.error.issues[0]?.path.map(String).join("/") ?? ""}`
        .replace(/\/$/u, "") || "/",
      outer.error.issues[0]?.message ?? "Semantic source PathTokenV2 input is invalid",
    );
  }
  const intentResult = compileSemanticSourceIntentSetV1({
    productSpec: outer.data.productSpec,
    deliverySelection: outer.data.deliverySelection,
    designSourceClosure: NO_DESIGN_CLOSURE_V2,
  });
  if (intentResult.status !== "shadow_compiled") {
    return rejected(
      "SEMANTIC_SOURCE_PATH_TOKEN_V2_INTENT_COMPILATION_REJECTED",
      intentResult.diagnostics[0]?.path ?? "/",
      intentResult.diagnostics[0]?.message
        ?? "Fresh semantic source intent compilation was rejected",
    );
  }
  try {
    const value = buildSemanticSourcePathTokenSetV2(intentResult.intentSet);
    const canonicalBytes = canonicalJsonStringify(value);
    if (
      Buffer.byteLength(canonicalBytes, "utf8")
      > SEMANTIC_SOURCE_PATH_TOKEN_SET_MAX_CANONICAL_BYTES_V2
    ) {
      return rejected(
        "SEMANTIC_SOURCE_PATH_TOKEN_V2_OUTPUT_LIMIT_EXCEEDED",
        "/",
        "Semantic source path-token set exceeds its canonical byte limit",
      );
    }
    return recursivelyFreezePathTokenSetV2({
      status: "shadow_compiled" as const,
      diagnostics: EMPTY_DIAGNOSTICS,
      value,
      canonicalBytes,
    });
  } catch (error) {
    if (error instanceof SemanticSourcePathTokenCodeAuthorityErrorV2) {
      return rejected(
        "SEMANTIC_SOURCE_PATH_TOKEN_V2_CODE_AUTHORITY_DRIFT",
        "/",
        error.message,
      );
    }
    return rejected(
      "SEMANTIC_SOURCE_PATH_TOKEN_V2_ARTIFACT_INVALID",
      "/",
      errorMessage(error),
    );
  }
}

export type SemanticSourcePathTokenVerificationErrorCodeV2 =
  | "SEMANTIC_SOURCE_PATH_TOKEN_V2_VERIFICATION_INPUT_INVALID"
  | "SEMANTIC_SOURCE_PATH_TOKEN_V2_VERIFICATION_CANDIDATE_INVALID"
  | "SEMANTIC_SOURCE_PATH_TOKEN_V2_VERIFICATION_REPRODUCTION_REJECTED"
  | "SEMANTIC_SOURCE_PATH_TOKEN_V2_VERIFICATION_AUTHORITY_MISMATCH";

export class SemanticSourcePathTokenVerificationErrorV2 extends Error {
  readonly code: SemanticSourcePathTokenVerificationErrorCodeV2;

  constructor(
    code: SemanticSourcePathTokenVerificationErrorCodeV2,
    message: string,
  ) {
    super(message.slice(0, 1_000));
    this.name = "SemanticSourcePathTokenVerificationErrorV2";
    this.code = code;
  }
}

export type VerifiedShadowSemanticSourcePathTokenSetV2 = Readonly<{
  status: "verified_shadow";
  value: Readonly<SemanticSourcePathTokenSetV2>;
  canonicalBytes: string;
}>;

export function verifySemanticSourcePathTokenSetV2(
  input: unknown,
): VerifiedShadowSemanticSourcePathTokenSetV2 {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      VERIFIER_INPUT_MAX_BYTES,
      VERIFIER_BOUNDED_WORK_LIMITS,
    );
  } catch (error) {
    throw new SemanticSourcePathTokenVerificationErrorV2(
      "SEMANTIC_SOURCE_PATH_TOKEN_V2_VERIFICATION_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const outer = VerificationInputV2Schema.safeParse(snapshot);
  if (!outer.success) {
    throw new SemanticSourcePathTokenVerificationErrorV2(
      "SEMANTIC_SOURCE_PATH_TOKEN_V2_VERIFICATION_INPUT_INVALID",
      outer.error.issues[0]?.message ?? "Semantic source PathTokenV2 verifier input is invalid",
    );
  }
  const candidate = SemanticSourcePathTokenSetV2Schema.safeParse(
    outer.data.candidate,
  );
  if (!candidate.success) {
    throw new SemanticSourcePathTokenVerificationErrorV2(
      "SEMANTIC_SOURCE_PATH_TOKEN_V2_VERIFICATION_CANDIDATE_INVALID",
      candidate.error.issues[0]?.message ?? "Semantic source PathTokenV2 candidate is invalid",
    );
  }
  const reproduced = compileSemanticSourcePathTokenSetV2({
    productSpec: outer.data.productSpec,
    deliverySelection: outer.data.deliverySelection,
  });
  if (reproduced.status !== "shadow_compiled") {
    throw new SemanticSourcePathTokenVerificationErrorV2(
      "SEMANTIC_SOURCE_PATH_TOKEN_V2_VERIFICATION_REPRODUCTION_REJECTED",
      reproduced.diagnostics[0]?.message ?? "Fresh semantic path-token reproduction was rejected",
    );
  }
  if (
    canonicalJsonStringify(candidate.data)
    !== canonicalJsonStringify(reproduced.value)
  ) {
    throw new SemanticSourcePathTokenVerificationErrorV2(
      "SEMANTIC_SOURCE_PATH_TOKEN_V2_VERIFICATION_AUTHORITY_MISMATCH",
      "Semantic source PathTokenV2 candidate does not equal fresh ProductSpec/selection/intent authority",
    );
  }
  return recursivelyFreezePathTokenSetV2({
    status: "verified_shadow" as const,
    value: reproduced.value,
    canonicalBytes: reproduced.canonicalBytes,
  });
}

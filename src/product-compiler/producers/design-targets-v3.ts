import { z } from "zod";

import { canonicalJsonStringify, hashCanonicalJson } from "../canonical-json.js";
import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "../diagnostics.js";
import type { CompilationDiagnosticV1 } from "../schemas/compilation-report-v1.js";
import {
  compileActionInputTransportV2,
  type ActionInputTransportV2,
} from "../schemas/action-input-transport-v2.js";
import {
  DESIGN_GENERATION_TARGETS_ARTIFACT_TYPE_V3,
  DesignGenerationTargetsV3Schema,
  deriveActionDependencyClosureV3,
  hashDesignGenerationTargetV3,
  hashDesignGenerationTargetsV3,
  hashRequiredActionInputTransportsV3,
  requiredEvidenceRefsForActionsV3,
  type DesignGenerationTargetHashPayloadV3,
  type DesignGenerationTargetsHashPayloadV3,
  type DesignGenerationTargetsV3,
  type RequiredObservableSelectorV3,
} from "../schemas/design-generation-targets-v3.js";
import {
  ProductSpecV2Schema,
  type ProductActionV2,
  type ProductSpecV2,
} from "../schemas/product-spec-v2.js";

type Rejected = Readonly<{
  status: "rejected";
  rejectionCodes: string[];
  diagnostics: CompilationDiagnosticV1[];
}>;

export type GenerationTargetsV3Result =
  | Readonly<{
      status: "produced";
      generationTargets: DesignGenerationTargetsV3;
      diagnostics: readonly [];
    }>
  | Rejected;

export type GenerationTargetsV3VerificationResult =
  | Readonly<{
      status: "verified";
      generationTargets: DesignGenerationTargetsV3;
      diagnostics: readonly [];
    }>
  | Rejected;

const GenerationTargetsV3VerificationInputSchema = z.object({
  productSpec: ProductSpecV2Schema,
  generationTargets: DesignGenerationTargetsV3Schema,
}).strict();

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function diagnostic(
  code: string,
  message: string,
  reference?: string,
): CompilationDiagnosticV1 {
  return makeCompilationDiagnostic({
    schema: "setfarm.compilation-diagnostic.v1",
    code,
    category: "link",
    severity: "error",
    message: message.slice(0, 2_000),
    ...(reference ? { reference: reference.slice(0, 160) } : {}),
    provenance: [],
    suggestions: [],
  });
}

function reject(diagnostics: CompilationDiagnosticV1[]): Rejected {
  const sorted = sortCompilationDiagnostics(diagnostics);
  return {
    status: "rejected",
    rejectionCodes: uniqueSorted(sorted.map((item) => item.code)),
    diagnostics: sorted,
  };
}

class DesignTargetDependencyErrorV3 extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DesignTargetDependencyErrorV3";
    this.code = code;
  }
}

function targetSuffix(surfaceRef: string): string {
  const readable = surfaceRef.replace(/^SURF_/, "");
  if (`TARGET_${readable}`.length <= 160 && `DSURF_${readable}`.length <= 160) {
    return readable;
  }
  return `HASH_${hashCanonicalJson({
    schema: "setfarm.design-target-surface-identity.v1",
    surfaceRef,
  }).toUpperCase()}`;
}

function observableSurfaceRef(
  action: ProductActionV2,
  observable: ProductActionV2["observableEffects"][number],
): string {
  const selector = renderedObservableSelector(observable);
  if (selector.kind !== "control") return selector.surfaceRef;
  const placement = action.controlPlacements.find((candidate) =>
    candidate.id === selector.controlSlotRef);
  if (!placement) {
    throw new Error(
      `DESIGN_TARGET_V3_INTERNAL_CONTROL_SLOT_UNRESOLVED: ${selector.controlSlotRef}`,
    );
  }
  return placement.surfaceRef;
}

function renderedObservableSelector(
  observable: ProductActionV2["observableEffects"][number],
): RequiredObservableSelectorV3["selector"] {
  const selector = observable.selector;
  if (selector.kind === "invocation_output") {
    throw new Error(
      `DESIGN_TARGET_V3_NON_RENDERED_OBSERVABLE_FORBIDDEN: ${observable.id}`,
    );
  }
  return selector;
}

function requiredObservableSelectors(
  productSpec: ProductSpecV2,
  targetSurfaceRefs: ReadonlySet<string>,
): RequiredObservableSelectorV3[] {
  return productSpec.actions.flatMap((action) =>
    action.observableEffects.flatMap((observable) =>
      targetSurfaceRefs.has(observableSurfaceRef(action, observable))
        ? [{
            observableRef: observable.id,
            actionRef: action.id,
            selector: renderedObservableSelector(observable),
            assertions: observable.assertions,
            evidenceRef: observable.evidenceRef,
          }]
        : []))
    .sort((left, right) => compareUtf16(left.observableRef, right.observableRef));
}

function compileActionInputContracts(
  productSpec: ProductSpecV2,
): Readonly<{
  contractsByAction: ReadonlyMap<string, readonly ActionInputTransportV2[]>;
  diagnostics: CompilationDiagnosticV1[];
}> {
  // TODO(product-compiler): expose a validated-ProductSpec transport compiler
  // from action-input-transport-v2. The public compiler intentionally reparses
  // on every field; duplicating its codec authority here would create drift.
  const contractsByAction = new Map<string, readonly ActionInputTransportV2[]>();
  const diagnostics: CompilationDiagnosticV1[] = [];
  const actions = productSpec.actions
    .filter((action) => action.controlPlacements.length > 0)
    .sort((left, right) => compareUtf16(left.id, right.id));
  for (const action of actions) {
    const contracts: ActionInputTransportV2[] = [];
    const fields = [...action.input.fields].sort((left, right) =>
      compareUtf16(left.name, right.name));
    for (const field of fields) {
      const compiled = compileActionInputTransportV2({
        productSpec,
        actionRef: action.id,
        fieldName: field.name,
      });
      if (compiled.status === "rejected") {
        diagnostics.push(diagnostic(
          compiled.rejectionCode,
          compiled.message,
          `${action.id}.${field.name}`,
        ));
        continue;
      }
      contracts.push(compiled.contract);
    }
    contractsByAction.set(action.id, contracts);
  }
  return { contractsByAction, diagnostics };
}

/**
 * Produces one typed, immutable design target per route-root surface. The only
 * action-input contracts admitted here are compiler outputs derived from this
 * exact ProductSpecV2; callers cannot submit transport payloads.
 */
export function produceDesignGenerationTargetsV3(input: unknown): GenerationTargetsV3Result {
  const parsed = ProductSpecV2Schema.safeParse(input);
  if (!parsed.success) {
    return reject(parsed.error.issues.slice(0, 100).map((issue) => diagnostic(
      "DESIGN_TARGET_V3_PRODUCT_SPEC_INVALID",
      `ProductSpec v2 failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      issue.path.join("/") || "$",
    )));
  }

  const productSpec = parsed.data;
  if (!productSpec.delivery.designRequired) {
    return reject([diagnostic(
      "DESIGN_TARGET_V3_DESIGN_NOT_REQUIRED",
      `ProductSpec delivery ${productSpec.delivery.platform}/${productSpec.delivery.techStack} forbids Stitch generation targets because designRequired=false`,
      "delivery.designRequired",
    )]);
  }
  const globalDependencyClosure = deriveActionDependencyClosureV3(
    productSpec.actions,
    productSpec.actions.map((action) => action.id),
  );
  if (globalDependencyClosure.unresolvedActionRefs.length > 0) {
    return reject([diagnostic(
      "DESIGN_TARGET_V3_PREREQUISITE_ACTION_UNRESOLVED",
      `ProductSpec evidence prerequisites reference unresolved actions: ${globalDependencyClosure.unresolvedActionRefs.join(",")}`,
      globalDependencyClosure.unresolvedActionRefs[0],
    )]);
  }
  if (globalDependencyClosure.cyclePaths.length > 0) {
    return reject(globalDependencyClosure.cyclePaths.map((cyclePath) => diagnostic(
      "DESIGN_TARGET_V3_PREREQUISITE_CYCLE",
      `ProductSpec evidence prerequisite cycle: ${cyclePath.join(" -> ")}`,
      cyclePath[0],
    )));
  }
  const productSpecHash = hashCanonicalJson(productSpec);
  const compiledInputs = compileActionInputContracts(productSpec);
  if (compiledInputs.diagnostics.length > 0) {
    return reject(compiledInputs.diagnostics);
  }

  const rootSurfaces = productSpec.surfaces
    .filter((surface) => surface.composition.kind === "route_root")
    .sort((left, right) => compareUtf16(left.id, right.id));

  let targets: Array<DesignGenerationTargetHashPayloadV3 & { targetHash: string }>;
  try {
    targets = rootSurfaces.map((rootSurface) => {
      const containedSurfaceRefs = productSpec.surfaces
        .filter((surface) =>
          surface.routeRef === rootSurface.routeRef && surface.id !== rootSurface.id)
        .map((surface) => surface.id)
        .sort(compareUtf16);
      const targetSurfaceRefs = new Set([rootSurface.id, ...containedSurfaceRefs]);
      const requiredControlPlacements = productSpec.actions
        .flatMap((action) => action.controlPlacements.flatMap((placement) => {
          if (!targetSurfaceRefs.has(placement.surfaceRef)) return [];
          const actionInputTransports = compiledInputs.contractsByAction.get(action.id);
          if (!actionInputTransports) {
            throw new Error(
              `DESIGN_TARGET_V3_INTERNAL_ACTION_INPUT_SET_UNRESOLVED: ${action.id}`,
            );
          }
          return [{
            controlSlotRef: placement.id,
            actionRef: action.id,
            surfaceRef: placement.surfaceRef,
            controlHint: placement.controlHint,
            actionInputTransports: actionInputTransports.map((contract) => ({ ...contract })),
            actionInputTransportsHash: hashRequiredActionInputTransportsV3(
              actionInputTransports,
            ),
          }];
        }))
        .sort((left, right) => compareUtf16(left.controlSlotRef, right.controlSlotRef));
      const affectingActionRefs = productSpec.actions
        .filter((action) => action.affectedSurfaceRefs.some((surfaceRef) =>
          targetSurfaceRefs.has(surfaceRef)))
        .map((action) => action.id)
        .sort(compareUtf16);
      const observables = requiredObservableSelectors(productSpec, targetSurfaceRefs);
      const directActionRefs = uniqueSorted([
        ...affectingActionRefs,
        ...requiredControlPlacements.map((placement) => placement.actionRef),
        ...observables.map((observable) => observable.actionRef),
      ]);
      const dependencyClosure = deriveActionDependencyClosureV3(
        productSpec.actions,
        directActionRefs,
      );
      if (dependencyClosure.unresolvedActionRefs.length > 0) {
        throw new DesignTargetDependencyErrorV3(
          "DESIGN_TARGET_V3_PREREQUISITE_ACTION_UNRESOLVED",
          `${rootSurface.id} evidence prerequisites reference unresolved actions: ${dependencyClosure.unresolvedActionRefs.join(",")}`,
        );
      }
      if (dependencyClosure.cyclePaths.length > 0) {
        throw new DesignTargetDependencyErrorV3(
          "DESIGN_TARGET_V3_PREREQUISITE_CYCLE",
          `${rootSurface.id} evidence prerequisite cycle: ${dependencyClosure.cyclePaths.map((path) => path.join(" -> ")).join("; ")}`,
        );
      }
      const dependencyActionRefs = dependencyClosure.dependencyActionRefs;
      const requiredActionRefs = dependencyClosure.requiredActionRefs;
      const requiredActionRefSet = new Set(requiredActionRefs);
      const requiredActions = productSpec.actions
        .filter((action) => requiredActionRefSet.has(action.id))
        .sort((left, right) => compareUtf16(left.id, right.id));
      const requiredEvidenceRefSet = new Set(
        requiredEvidenceRefsForActionsV3(requiredActions),
      );
      const requiredEvidencePredicates = productSpec.evidencePredicates
        .filter((predicate) => requiredEvidenceRefSet.has(predicate.id))
        .sort((left, right) => compareUtf16(left.id, right.id));
      if (requiredEvidencePredicates.length !== requiredEvidenceRefSet.size) {
        throw new Error(
          `DESIGN_TARGET_V3_INTERNAL_EVIDENCE_SET_UNRESOLVED: ${rootSurface.id}`,
        );
      }
      const expectedScreenTitle = `${rootSurface.name} - ${productSpec.product.name}`;
      const suffix = targetSuffix(rootSurface.id);
      const requestScreenKey = `route:${rootSurface.routeRef};surface:${rootSurface.id}`;
      const targetPayload: DesignGenerationTargetHashPayloadV3 = {
        targetId: `TARGET_${suffix}`,
        designSurfaceId: `DSURF_${suffix}`,
        productSpecHash,
        routeRef: rootSurface.routeRef,
        surfaceRef: rootSurface.id,
        containedSurfaceRefs,
        requestScreenKey,
        expectedScreenTitle,
        directActionRefs,
        dependencyActionRefs,
        requiredActionRefs,
        requiredActions,
        requiredEvidencePredicates,
        requiredControlPlacements,
        affectingActionRefs,
        requiredObservableSelectors: observables,
      };
      return {
        ...targetPayload,
        targetHash: hashDesignGenerationTargetV3(targetPayload),
      };
    });
  } catch (error) {
    if (error instanceof DesignTargetDependencyErrorV3) {
      return reject([diagnostic(error.code, error.message)]);
    }
    return reject([diagnostic(
      "DESIGN_TARGET_V3_INTERNAL_REFERENCE_INVALID",
      error instanceof Error ? error.message : String(error),
    )]);
  }

  const targetsHash = hashCanonicalJson(targets);
  const hashPayload: DesignGenerationTargetsHashPayloadV3 = {
    schema: DESIGN_GENERATION_TARGETS_ARTIFACT_TYPE_V3,
    productSpecHash,
    targets,
    targetsHash,
  };
  const candidate = DesignGenerationTargetsV3Schema.safeParse({
    ...hashPayload,
    payloadHash: hashDesignGenerationTargetsV3(hashPayload),
  });
  if (!candidate.success) {
    return reject(candidate.error.issues.slice(0, 100).map((issue) => diagnostic(
      "DESIGN_TARGET_V3_OUTPUT_INVALID",
      `Generation targets v3 failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      issue.path.join("/") || "$",
    )));
  }

  return { status: "produced", generationTargets: candidate.data, diagnostics: [] };
}

/**
 * Verifies serialized V3 authority by reproducing it from the exact ProductSpec.
 * Self-consistent caller-authored hashes are insufficient without byte equality.
 */
export function verifyDesignGenerationTargetsV3(
  input: unknown,
): GenerationTargetsV3VerificationResult {
  const parsed = GenerationTargetsV3VerificationInputSchema.safeParse(input);
  if (!parsed.success) {
    return reject(parsed.error.issues.slice(0, 100).map((issue) => diagnostic(
      "DESIGN_TARGET_V3_VERIFICATION_INPUT_INVALID",
      `Generation target verification input failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      issue.path.join("/") || "$",
    )));
  }

  const reproduced = produceDesignGenerationTargetsV3(parsed.data.productSpec);
  if (reproduced.status === "rejected") return reproduced;
  const expected = reproduced.generationTargets;
  const actual = parsed.data.generationTargets;
  if (
    actual.productSpecHash !== expected.productSpecHash
    || actual.targetsHash !== expected.targetsHash
    || actual.payloadHash !== expected.payloadHash
    || hashCanonicalJson(actual) !== hashCanonicalJson(expected)
    || canonicalJsonStringify(actual) !== canonicalJsonStringify(expected)
  ) {
    return reject([diagnostic(
      "DESIGN_TARGET_V3_AUTHORITY_MISMATCH",
      "GenerationTargetsV3 does not equal the canonical bytes reproduced from the exact ProductSpecV2",
      "generationTargets",
    )]);
  }

  return { status: "verified", generationTargets: actual, diagnostics: [] };
}

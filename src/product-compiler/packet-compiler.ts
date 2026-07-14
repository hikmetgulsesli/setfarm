import { z } from "zod";

import {
  SemanticArtifactEnvelopeV1Schema,
  type ArtifactPutResult,
} from "./artifact-store.js";
import { hashCanonicalJson } from "./canonical-json.js";
import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "./diagnostics.js";
import { BuildTopologyV1Schema, type BuildTopologyV1 } from "./schemas/build-topology-v1.js";
import {
  type CompilationDiagnosticV1,
  ProductCompilationReportV1Schema,
  type ProductCompilationReportV1,
} from "./schemas/compilation-report-v1.js";
import {
  CompilerIdentityV1Schema,
  SemanticArtifactProducerV1Schema,
  Sha256Schema,
} from "./schemas/common-v1.js";
import {
  DesignInteractionGraphV1Schema,
  type DesignInteractionGraphV1,
} from "./schemas/design-interaction-graph-v1.js";
import {
  ProductBuildPacketV1Schema,
  type ProductBuildPacketV1,
} from "./schemas/product-build-packet-v1.js";
import {
  ProductSpecV1Schema,
  type ProductActionV1,
  type ProductSpecV1,
} from "./schemas/product-spec-v1.js";
import { StoryPlanV1Schema, type StoryPlanV1 } from "./schemas/story-plan-v1.js";
import { validateRuntimeDataContractClosureV1 } from "./producers/runtime-data-contract.js";

const VALIDATION_IDS = [
  "VALIDATE_ACTION_REACHABILITY",
  "VALIDATE_CONTROL_DISPOSITIONS",
  "VALIDATE_EVIDENCE_COVERAGE",
  "VALIDATE_REFERENCE_COMPLETENESS",
  "VALIDATE_RUNTIME_DATA_CLOSURE",
  "VALIDATE_SCHEMA_STRICT",
  "VALIDATE_STORY_PARTITIONS",
  "VALIDATE_TOPOLOGY_CAPABILITIES",
] as const;

type ArtifactWriter = Readonly<{
  put(value: unknown): Promise<ArtifactPutResult>;
}>;

export type ProductPacketCompilerInput = Readonly<{
  productSpec: unknown;
  designGraph: unknown;
  buildTopology: unknown;
  storyPlan: unknown;
  compiler: unknown;
  producer: unknown;
  parentPacketHashes?: unknown;
  protocol?: "legacy-shadow" | "v3";
  artifactStore: ArtifactWriter;
}>;

export type ProductPacketCompilationResult = Readonly<{
  status: "sealed" | "rejected";
  report: ProductCompilationReportV1;
  reportHash: string;
  artifactHashes: Readonly<Record<string, string>>;
  packet?: ProductBuildPacketV1;
  packetHash?: string;
}>;

function diagnostic(input: {
  code: string;
  category?: CompilationDiagnosticV1["category"];
  severity?: CompilationDiagnosticV1["severity"];
  message: string;
  artifactHash?: string;
  reference?: string;
}): CompilationDiagnosticV1 {
  return makeCompilationDiagnostic({
    schema: "setfarm.compilation-diagnostic.v1",
    code: input.code,
    category: input.category ?? "contract",
    severity: input.severity ?? "error",
    message: input.message,
    ...(input.artifactHash ? { artifactHash: input.artifactHash } : {}),
    ...(input.reference ? { reference: input.reference } : {}),
    provenance: [],
    suggestions: [],
  });
}

function schemaDiagnostics(
  code: string,
  artifactHash: string,
  error: z.ZodError,
): CompilationDiagnosticV1[] {
  return error.issues.slice(0, 200).map((issue) => diagnostic({
    code,
    message: `Strict schema failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
    artifactHash,
    reference: issue.path.join("/") || "$",
  }));
}

function safeInputHash(value: unknown, label: string): string {
  try {
    return hashCanonicalJson(value);
  } catch (error) {
    return hashCanonicalJson({
      schema: "setfarm.unhashable-compiler-input.v1",
      label,
      error: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

function requiredActionStateRefs(action: ProductActionV1): string[] {
  return uniqueSorted([
    ...action.preconditions.map((item) => item.stateRef),
    ...action.stateDeltas.map((item) => item.stateRef),
    ...action.stateDeltas.flatMap((item) =>
      item.valueFrom.kind === "state" ? [item.valueFrom.stateRef] : []),
    ...action.success.stateRefs,
    ...action.failure.stateRefs,
  ]);
}

function requiredActionPersistenceRefs(action: ProductActionV1): string[] {
  return uniqueSorted([
    ...action.persistenceEffects.map((item) => item.policyRef),
    ...(action.success.persistenceRefs ?? []),
    ...(action.failure.persistenceRefs ?? []),
  ]);
}

function validateGraph(
  product: ProductSpecV1,
  graph: DesignInteractionGraphV1,
  artifactHash: string,
): CompilationDiagnosticV1[] {
  const diagnostics: CompilationDiagnosticV1[] = [];
  const surfaces = new Map(product.surfaces.map((item) => [item.id, item]));
  const routes = new Set(product.routes.map((item) => item.id));
  const actions = new Map(product.actions.map((item) => [item.id, item]));
  const states = new Set(product.states.map((item) => item.id));
  const persistence = new Set(product.persistencePolicies.map((item) => item.id));
  const evidence = new Set(product.evidencePredicates.map((item) => item.id));
  const controls = new Map(graph.controls.map((item) => [item.id, item]));

  graph.surfaces.forEach((surface) => {
    if (!surfaces.has(surface.surfaceRef)) {
      diagnostics.push(diagnostic({
        code: "LINK_SURFACE_REF_UNRESOLVED",
        category: "link",
        message: `Design surface ${surface.id} references absent ProductSpec surface`,
        artifactHash,
        reference: surface.surfaceRef,
      }));
    }
  });
  graph.controls.forEach((control) => {
    if (!surfaces.has(control.surfaceRef)) {
      diagnostics.push(diagnostic({
        code: "LINK_CONTROL_SURFACE_UNRESOLVED",
        category: "link",
        message: `Control ${control.id} references absent ProductSpec surface`,
        artifactHash,
        reference: control.surfaceRef,
      }));
    }
  });
  graph.unresolvedBindings.forEach((unresolved) => diagnostics.push(diagnostic({
    code: "LINK_UNRESOLVED_CONTROL",
    category: "link",
    message: `Control ${unresolved.controlRef} remains unresolved (${unresolved.code})`,
    artifactHash,
    reference: unresolved.controlRef,
  })));

  const reachableActions = new Set<string>();
  graph.bindings.forEach((binding) => {
    if (!controls.has(binding.controlRef)) {
      diagnostics.push(diagnostic({
        code: "LINK_BINDING_CONTROL_UNRESOLVED",
        category: "link",
        message: `Binding references absent control ${binding.controlRef}`,
        artifactHash,
        reference: binding.controlRef,
      }));
      return;
    }
    if (binding.disposition !== "action") return;
    const action = actions.get(binding.actionRef);
    if (!action) {
      diagnostics.push(diagnostic({
        code: "LINK_ACTION_REF_UNRESOLVED",
        category: "link",
        message: `Binding references absent ProductSpec action ${binding.actionRef}`,
        artifactHash,
        reference: binding.actionRef,
      }));
      return;
    }
    reachableActions.add(action.id);
    const control = controls.get(binding.controlRef)!;
    const controlSurface = surfaces.get(control.surfaceRef);
    if (!action.surfaceRefs.includes(control.surfaceRef)) {
      diagnostics.push(diagnostic({
        code: "LINK_ACTION_SURFACE_MISMATCH",
        category: "link",
        message: `Action ${action.id} is not allowed on control surface ${control.surfaceRef}`,
        artifactHash,
        reference: `${action.id}->${control.surfaceRef}`,
      }));
    }
    if (!binding.routeRef || binding.routeRef !== controlSurface?.routeRef) {
      diagnostics.push(diagnostic({
        code: "LINK_BINDING_ROUTE_SURFACE_MISMATCH",
        category: "link",
        message: `Action binding route must equal control surface route ${controlSurface?.routeRef ?? "<missing>"}`,
        artifactHash,
        reference: binding.routeRef ?? binding.controlRef,
      }));
    }
    if (binding.routeRef && !routes.has(binding.routeRef)) {
      diagnostics.push(diagnostic({
        code: "LINK_ROUTE_REF_UNRESOLVED",
        category: "link",
        message: `Action binding references absent route ${binding.routeRef}`,
        artifactHash,
        reference: binding.routeRef,
      }));
    }

    const inputCounts = new Map<string, number>();
    binding.inputBindings.forEach((item) => {
      inputCounts.set(item.inputField, (inputCounts.get(item.inputField) ?? 0) + 1);
      if (item.valueFrom.kind === "control_value" && !controls.has(item.valueFrom.controlRef)) {
        diagnostics.push(diagnostic({
          code: "LINK_INPUT_CONTROL_REF_UNRESOLVED",
          category: "link",
          message: `Input ${item.inputField} references absent control ${item.valueFrom.controlRef}`,
          artifactHash,
          reference: item.valueFrom.controlRef,
        }));
      }
      if (item.valueFrom.kind === "state" && !states.has(item.valueFrom.stateRef)) {
        diagnostics.push(diagnostic({
          code: "LINK_INPUT_STATE_REF_UNRESOLVED",
          category: "link",
          message: `Input ${item.inputField} references absent state ${item.valueFrom.stateRef}`,
          artifactHash,
          reference: item.valueFrom.stateRef,
        }));
      }
    });
    action.input.fields.forEach((field) => {
      if ((inputCounts.get(field.name) ?? 0) !== 1) {
        diagnostics.push(diagnostic({
          code: "LINK_ACTION_INPUT_BINDING_MISSING",
          category: "link",
          message: `Action ${action.id} input ${field.name} requires exactly one value binding`,
          artifactHash,
          reference: `${action.id}.${field.name}`,
        }));
      }
    });
    binding.inputBindings.forEach((item) => {
      if (!action.input.fields.some((field) => field.name === item.inputField)) {
        diagnostics.push(diagnostic({
          code: "LINK_UNKNOWN_ACTION_INPUT_BINDING",
          category: "link",
          message: `Binding defines unknown input ${action.id}.${item.inputField}`,
          artifactHash,
          reference: `${action.id}.${item.inputField}`,
        }));
      }
    });

    requiredActionStateRefs(action).forEach((reference) => {
      if (!binding.stateRefs.includes(reference)) {
        diagnostics.push(diagnostic({
          code: "LINK_ACTION_STATE_REF_MISSING",
          category: "link",
          message: `Action binding omits required state ${reference}`,
          artifactHash,
          reference,
        }));
      }
    });
    binding.stateRefs.forEach((reference) => {
      if (!states.has(reference)) {
        diagnostics.push(diagnostic({
          code: "LINK_ACTION_STATE_REF_UNRESOLVED",
          category: "link",
          message: `Action binding references absent state ${reference}`,
          artifactHash,
          reference,
        }));
      }
    });
    requiredActionPersistenceRefs(action).forEach((reference) => {
      if (!binding.persistenceRefs.includes(reference)) {
        diagnostics.push(diagnostic({
          code: "LINK_ACTION_PERSISTENCE_REF_MISSING",
          category: "link",
          message: `Action binding omits required persistence ${reference}`,
          artifactHash,
          reference,
        }));
      }
    });
    binding.persistenceRefs.forEach((reference) => {
      if (!persistence.has(reference)) {
        diagnostics.push(diagnostic({
          code: "LINK_ACTION_PERSISTENCE_REF_UNRESOLVED",
          category: "link",
          message: `Action binding references absent persistence ${reference}`,
          artifactHash,
          reference,
        }));
      }
    });
    action.evidenceRefs.forEach((reference) => {
      if (!binding.evidenceRefs.includes(reference)) {
        diagnostics.push(diagnostic({
          code: "LINK_ACTION_EVIDENCE_REF_MISSING",
          category: "link",
          message: `Action binding omits required evidence ${reference}`,
          artifactHash,
          reference,
        }));
      }
    });
    binding.evidenceRefs.forEach((reference) => {
      if (!evidence.has(reference)) {
        diagnostics.push(diagnostic({
          code: "LINK_ACTION_EVIDENCE_REF_UNRESOLVED",
          category: "link",
          message: `Action binding references absent evidence ${reference}`,
          artifactHash,
          reference,
        }));
      }
    });
  });

  product.actions
    .filter((action) => action.trigger.kind === "user" || action.trigger.kind === "route")
    .forEach((action) => {
      if (!reachableActions.has(action.id)) {
        diagnostics.push(diagnostic({
          code: "LINK_REQUIRED_ACTION_UNREACHABLE",
          category: "link",
          message: `Required action ${action.id} is not reachable from an exact control`,
          artifactHash,
          reference: action.id,
        }));
      }
    });
  return diagnostics;
}

function validateStories(
  product: ProductSpecV1,
  graph: DesignInteractionGraphV1,
  topology: BuildTopologyV1,
  stories: StoryPlanV1,
  artifactHash: string,
): CompilationDiagnosticV1[] {
  const diagnostics: CompilationDiagnosticV1[] = [];
  const surfaceIds = new Set(product.surfaces.map((item) => item.id));
  const controlIds = new Set(graph.controls.map((item) => item.id));
  const actionIds = new Set(product.actions.map((item) => item.id));
  const stateIds = new Set(product.states.map((item) => item.id));
  const persistenceIds = new Set(product.persistencePolicies.map((item) => item.id));
  const evidenceIds = new Set(product.evidencePredicates.map((item) => item.id));
  const pathById = new Map(topology.pathBindings.map((item) => [item.id, item]));
  const grantIds = new Set(topology.sharedGrants.map((item) => item.id));
  const ownerByStory = new Map(
    topology.owners.filter((item) => item.kind === "story").map((item) => [item.storyRef, item]),
  );

  const refSets = {
    surfaceRefs: surfaceIds,
    controlRefs: controlIds,
    actionRefs: actionIds,
    stateRefs: stateIds,
    persistenceRefs: persistenceIds,
    evidenceRefs: evidenceIds,
  } as const;
  const refCodes = {
    surfaceRefs: "CONTRACT_STORY_SURFACE_REF_UNRESOLVED",
    controlRefs: "CONTRACT_STORY_CONTROL_REF_UNRESOLVED",
    actionRefs: "CONTRACT_STORY_ACTION_REF_UNRESOLVED",
    stateRefs: "CONTRACT_STORY_STATE_REF_UNRESOLVED",
    persistenceRefs: "CONTRACT_STORY_PERSISTENCE_REF_UNRESOLVED",
    evidenceRefs: "CONTRACT_STORY_EVIDENCE_REF_UNRESOLVED",
  } as const;

  stories.stories.forEach((story) => {
    (Object.keys(refSets) as Array<keyof typeof refSets>).forEach((field) => {
      story[field].forEach((reference) => {
        if (!refSets[field].has(reference)) {
          diagnostics.push(diagnostic({
            code: refCodes[field],
            message: `Story ${story.id} has unresolved ${field} value ${reference}`,
            artifactHash,
            reference,
          }));
        }
      });
    });
    const owner = ownerByStory.get(story.id);
    if (!owner || owner.id !== story.ownerRef) {
      diagnostics.push(diagnostic({
        code: "CONTRACT_STORY_OWNER_MISMATCH",
        message: `Story ${story.id} owner ${story.ownerRef} does not match topology`,
        artifactHash,
        reference: story.ownerRef,
      }));
    }
    story.ownedPathRefs.forEach((pathRef) => {
      const binding = pathById.get(pathRef);
      if (!binding) {
        diagnostics.push(diagnostic({
          code: "CONTRACT_STORY_PATH_REF_UNRESOLVED",
          message: `Story ${story.id} references absent path ${pathRef}`,
          artifactHash,
          reference: pathRef,
        }));
      } else if (binding.ownerRef !== story.ownerRef) {
        diagnostics.push(diagnostic({
          code: "CONTRACT_STORY_PATH_OWNER_MISMATCH",
          message: `Story ${story.id} does not own path ${pathRef}`,
          artifactHash,
          reference: pathRef,
        }));
      }
    });
    story.sharedGrantRefs.forEach((grantRef) => {
      if (!grantIds.has(grantRef)) {
        diagnostics.push(diagnostic({
          code: "CONTRACT_STORY_GRANT_REF_UNRESOLVED",
          message: `Story ${story.id} references absent shared grant ${grantRef}`,
          artifactHash,
          reference: grantRef,
        }));
      }
    });
    story.evidenceRefs.forEach((evidenceRef) => {
      const predicate = product.evidencePredicates.find((item) => item.id === evidenceRef);
      if (predicate && !predicate.required) {
        diagnostics.push(diagnostic({
          code: "CONTRACT_STORY_EVIDENCE_NOT_REQUIRED",
          message: `Story ${story.id} completion evidence ${evidenceRef} is not required`,
          artifactHash,
          reference: evidenceRef,
        }));
      }
    });
    story.actionRefs.forEach((actionRef) => {
      const action = product.actions.find((item) => item.id === actionRef);
      action?.surfaceRefs.forEach((surfaceRef) => {
        if (!story.surfaceRefs.includes(surfaceRef)) {
          diagnostics.push(diagnostic({
            code: "CONTRACT_STORY_ACTION_SURFACE_MISSING",
            message: `Story ${story.id} owns ${actionRef} but omits its surface ${surfaceRef}`,
            artifactHash,
            reference: `${actionRef}->${surfaceRef}`,
          }));
        }
      });
    });
  });

  const exactPartition = (
    references: readonly string[],
    field: "actionRefs" | "controlRefs" | "surfaceRefs" | "evidenceRefs",
    unownedCode: string,
    multipleCode: string,
  ) => {
    references.forEach((reference) => {
      const owners = stories.stories.filter((story) => story[field].includes(reference));
      if (owners.length === 0) {
        diagnostics.push(diagnostic({
          code: unownedCode,
          message: `${reference} has no story owner`,
          artifactHash,
          reference,
        }));
      } else if (owners.length > 1) {
        diagnostics.push(diagnostic({
          code: multipleCode,
          message: `${reference} is owned by multiple stories`,
          artifactHash,
          reference,
        }));
      }
    });
  };
  exactPartition([...actionIds], "actionRefs", "CONTRACT_ACTION_UNOWNED", "CONTRACT_ACTION_MULTIPLE_STORIES");
  exactPartition([...controlIds], "controlRefs", "CONTRACT_CONTROL_UNOWNED", "CONTRACT_CONTROL_MULTIPLE_STORIES");
  exactPartition(
    product.surfaces.filter((surface) => surface.required).map((surface) => surface.id),
    "surfaceRefs",
    "CONTRACT_REQUIRED_SURFACE_UNOWNED",
    "CONTRACT_REQUIRED_SURFACE_MULTIPLE_STORIES",
  );
  exactPartition(
    product.evidencePredicates.filter((predicate) => predicate.required).map((predicate) => predicate.id),
    "evidenceRefs",
    "CONTRACT_REQUIRED_EVIDENCE_UNOWNED",
    "CONTRACT_REQUIRED_EVIDENCE_MULTIPLE_STORIES",
  );
  const requireSomeOwner = (
    references: readonly string[],
    field: "stateRefs" | "persistenceRefs",
    code: string,
  ) => {
    references.forEach((reference) => {
      if (!stories.stories.some((story) => story[field].includes(reference))) {
        diagnostics.push(diagnostic({
          code,
          message: `${reference} has no story owner`,
          artifactHash,
          reference,
        }));
      }
    });
  };
  requireSomeOwner([...stateIds], "stateRefs", "CONTRACT_STATE_UNOWNED");
  requireSomeOwner([...persistenceIds], "persistenceRefs", "CONTRACT_PERSISTENCE_UNOWNED");
  return diagnostics;
}

function validateTopologyAndEvidence(
  product: ProductSpecV1,
  topology: BuildTopologyV1,
  artifactHash: string,
): CompilationDiagnosticV1[] {
  const diagnostics: CompilationDiagnosticV1[] = [];
  const routeIds = new Set(product.routes.map((item) => item.id));
  const capabilities = new Map(topology.capabilities.map((item) => [item.id, item]));
  topology.entrypoints.forEach((entrypoint) => {
    entrypoint.routeRefs.forEach((routeRef) => {
      if (!routeIds.has(routeRef)) {
        diagnostics.push(diagnostic({
          code: "CONTRACT_ENTRYPOINT_ROUTE_REF_UNRESOLVED",
          message: `Entrypoint ${entrypoint.id} references absent route ${routeRef}`,
          artifactHash,
          reference: routeRef,
        }));
      }
    });
  });
  product.evidencePredicates.filter((item) => item.required).forEach((predicate) => {
    predicate.capabilityRefs.forEach((capabilityRef) => {
      const capability = capabilities.get(capabilityRef);
      if (!capability?.enabled) {
        diagnostics.push(diagnostic({
          code: "CONTRACT_EVIDENCE_CAPABILITY_UNAVAILABLE",
          message: `Required evidence ${predicate.id} needs unavailable capability ${capabilityRef}`,
          artifactHash,
          reference: capabilityRef,
        }));
      }
    });
  });
  return diagnostics;
}

function validateRuntimeDataClosure(
  product: ProductSpecV1,
  topology: BuildTopologyV1,
  artifactHash: string,
  requireV3: boolean,
): CompilationDiagnosticV1[] {
  const hasContract = Boolean(topology.runtimeDataContract);
  const hasHash = Boolean(topology.runtimeDataContractHash);
  if (requireV3 && !product.delivery) {
    return [diagnostic({
      code: "CONTRACT_V3_PRODUCT_DELIVERY_MISSING",
      message: "V3 packet compilation requires ProductSpec delivery authority; historical ProductSpec cannot be upgraded by inference",
      artifactHash,
      reference: "delivery",
    })];
  }
  if (product.delivery && (!hasContract || !hasHash)) {
    return [diagnostic({
      code: "CONTRACT_RUNTIME_DATA_MISSING",
      message: "V3 ProductSpec delivery requires an exact runtime-data contract and canonical hash before implementation",
      artifactHash,
      reference: "runtimeDataContract",
    })];
  }
  if (!product.delivery && (hasContract || hasHash)) {
    return [diagnostic({
      code: "CONTRACT_RUNTIME_DATA_PROTOCOL_AUTHORITY_MISSING",
      message: "Historical ProductSpec without v3 delivery cannot be reinterpreted as runtime-data authority",
      artifactHash,
      reference: "delivery",
    })];
  }
  if (!product.delivery) return [];
  return validateRuntimeDataContractClosureV1({
    productSpec: product,
    commands: topology.commands,
    contract: topology.runtimeDataContract,
    contractHash: topology.runtimeDataContractHash,
  }).map((item) => ({ ...item, artifactHash }));
}

async function storeChild(
  store: ArtifactWriter,
  artifactType: string,
  producer: z.infer<typeof SemanticArtifactProducerV1Schema>,
  payload: unknown,
): Promise<string> {
  const envelope = SemanticArtifactEnvelopeV1Schema.parse({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType,
    producer,
    payload,
  });
  return (await store.put(envelope)).hash;
}

export async function compileProductBuildPacket(
  input: ProductPacketCompilerInput,
): Promise<ProductPacketCompilationResult> {
  if (!input.artifactStore || typeof input.artifactStore.put !== "function") {
    throw new TypeError("Product packet compiler requires an injected artifact writer");
  }
  const compiler = CompilerIdentityV1Schema.parse(input.compiler);
  const producer = SemanticArtifactProducerV1Schema.parse(input.producer);
  const parentPacketHashes = z.array(Sha256Schema).max(100).parse(input.parentPacketHashes ?? []);
  const rawHashes = {
    productSpec: safeInputHash(input.productSpec, "productSpec"),
    designGraph: safeInputHash(input.designGraph, "designGraph"),
    buildTopology: safeInputHash(input.buildTopology, "buildTopology"),
    storyPlan: safeInputHash(input.storyPlan, "storyPlan"),
  };
  const diagnostics: CompilationDiagnosticV1[] = [];
  if (compiler.codeSha !== producer.codeSha) {
    diagnostics.push(diagnostic({
      code: "CONTRACT_COMPILER_PRODUCER_REVISION_MISMATCH",
      message: `Compiler ${compiler.codeSha} and producer ${producer.codeSha} revisions disagree`,
      reference: `${compiler.codeSha}->${producer.codeSha}`,
    }));
  }

  const productResult = ProductSpecV1Schema.safeParse(input.productSpec);
  const graphResult = DesignInteractionGraphV1Schema.safeParse(input.designGraph);
  const topologyResult = BuildTopologyV1Schema.safeParse(input.buildTopology);
  const storiesResult = StoryPlanV1Schema.safeParse(input.storyPlan);
  if (!productResult.success) diagnostics.push(...schemaDiagnostics("CONTRACT_PRODUCT_SPEC_SCHEMA_INVALID", rawHashes.productSpec, productResult.error));
  if (!graphResult.success) diagnostics.push(...schemaDiagnostics("CONTRACT_DESIGN_GRAPH_SCHEMA_INVALID", rawHashes.designGraph, graphResult.error));
  if (!topologyResult.success) diagnostics.push(...schemaDiagnostics("CONTRACT_BUILD_TOPOLOGY_SCHEMA_INVALID", rawHashes.buildTopology, topologyResult.error));
  if (!storiesResult.success) diagnostics.push(...schemaDiagnostics("CONTRACT_STORY_PLAN_SCHEMA_INVALID", rawHashes.storyPlan, storiesResult.error));

  const artifactHashes: Record<string, string> = {};
  if (productResult.success) {
    artifactHashes.productSpec = await storeChild(input.artifactStore, "setfarm.product-spec.v1", producer, productResult.data);
  }
  if (graphResult.success) {
    artifactHashes.designGraph = await storeChild(input.artifactStore, "setfarm.design-interaction-graph.v1", producer, graphResult.data);
  }
  if (topologyResult.success) {
    artifactHashes.buildTopology = await storeChild(input.artifactStore, "setfarm.build-topology.v1", producer, topologyResult.data);
  }
  if (storiesResult.success) {
    artifactHashes.storyPlan = await storeChild(input.artifactStore, "setfarm.story-plan.v1", producer, storiesResult.data);
  }

  if (productResult.success && graphResult.success && topologyResult.success && storiesResult.success) {
    diagnostics.push(...validateGraph(productResult.data, graphResult.data, rawHashes.designGraph));
    diagnostics.push(...validateStories(
      productResult.data,
      graphResult.data,
      topologyResult.data,
      storiesResult.data,
      rawHashes.storyPlan,
    ));
    diagnostics.push(...validateTopologyAndEvidence(
      productResult.data,
      topologyResult.data,
      rawHashes.buildTopology,
    ));
    diagnostics.push(...validateRuntimeDataClosure(
      productResult.data,
      topologyResult.data,
      rawHashes.buildTopology,
      input.protocol === "v3",
    ));
  }

  const sortedDiagnostics = sortCompilationDiagnostics(diagnostics);
  const rejectionCodes = uniqueSorted(
    sortedDiagnostics.filter((item) => item.severity === "error").map((item) => item.code),
  );
  const inputHashes = uniqueSorted(Object.values(rawHashes));
  let packet: ProductBuildPacketV1 | undefined;
  let packetHash: string | undefined;
  const runtimeDataContractHash = topologyResult.success
    ? topologyResult.data.runtimeDataContractHash
    : undefined;

  if (rejectionCodes.length === 0) {
    packet = ProductBuildPacketV1Schema.parse({
      schema: "setfarm.product-build-packet.v1",
      packetVersion: 1,
      parentPacketHashes: uniqueSorted(parentPacketHashes),
      productSpecHash: artifactHashes.productSpec,
      designGraphHash: artifactHashes.designGraph,
      buildTopologyHash: artifactHashes.buildTopology,
      storyPlanHash: artifactHashes.storyPlan,
      ...(runtimeDataContractHash
        ? { runtimeDataContractHash }
        : {}),
      compiler,
      validationIds: [...VALIDATION_IDS],
    });
    packetHash = await storeChild(
      input.artifactStore,
      "setfarm.product-build-packet.v1",
      producer,
      packet,
    );
  }

  const report = ProductCompilationReportV1Schema.parse(rejectionCodes.length > 0 ? {
    schema: "setfarm.product-compilation-report.v1",
    status: "rejected",
    compiler,
    inputHashes,
    artifactHashes,
    diagnostics: sortedDiagnostics,
    validationIds: [...VALIDATION_IDS],
    rejectionCodes,
  } : {
    schema: "setfarm.product-compilation-report.v1",
    status: "sealed",
    compiler,
    inputHashes,
    artifactHashes,
    diagnostics: sortedDiagnostics,
    validationIds: [...VALIDATION_IDS],
    packetHash,
  });
  const reportHash = await storeChild(
    input.artifactStore,
    "setfarm.product-compilation-report.v1",
    producer,
    report,
  );

  return {
    status: report.status,
    report,
    reportHash,
    artifactHashes,
    ...(packet ? { packet } : {}),
    ...(packetHash ? { packetHash } : {}),
  };
}

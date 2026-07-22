import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  BuildTopologyVerificationErrorV3,
  verifyBuildTopologyV3,
  verifyBuildTopologyV3ForTest,
} from "./build-topology-v3.js";
import {
  compileInvocationInputTransportSetV2,
} from "./invocation-input-transport-v2.js";
import {
  isProductionNodeScaffoldPrivateStageV2,
  type MaterializedNodeScaffoldPrivateStageV2,
} from "./node-scaffold-private-materializer-v2.js";
import { verifyProductRuntimeBehaviorContractV1 } from
  "./product-runtime-behavior-contract-v1.js";
import {
  hashProductDeliverySelectionV2,
  verifyProductDeliverySelectionV2,
} from "./product-delivery-profile-catalog-v2.js";
import {
  SemanticRealizationPlanVerificationErrorV2,
  verifySemanticRealizationPlanV2,
} from "./semantic-realization-plan-v2.js";
import type { BuildTopologyV3 } from "./schemas/build-topology-v3.js";
import {
  FileTreeManifestV3Schema,
  hashFileTreeRuntimeBindingMembershipV3,
  type FileTreeManifestV3,
} from "./schemas/file-tree-manifest-v3.js";
import type { InvocationInputTransportSetV2 } from
  "./schemas/invocation-input-transport-set-v2.js";
import {
  NODE_PRODUCT_RUNTIME_PROGRAM_CONTRACT_HASH_V2,
  NODE_PRODUCT_RUNTIME_SOURCE_MAX_BYTES_V2,
  NodeProductRuntimeSourceReceiptV2Schema,
  deriveNodeProductRuntimeGeneratedMemberSymbolRefV2,
  hashNodeProductRuntimeGeneratedMemberMembershipV2,
  hashNodeProductRuntimeSourceIdentityV2,
  hashNodeProductRuntimeSourceLogicalReceiptV2,
  hashNodeProductRuntimeSourceReceiptV2,
  hashRuntimeBehaviorAssertionSourceMembershipV2,
  hashRuntimeBehaviorEntityFieldSourceMembershipV2,
  recursivelyFreezeNodeProductRuntimeSourceV2,
  type NodeProductRuntimeGeneratedMemberBindingV2,
  type NodeProductRuntimeSourceReceiptHashPayloadV2,
  type NodeProductRuntimeSourceReceiptLogicalIdentityV2,
  type NodeProductRuntimeSourceReceiptV2,
  type RuntimeBehaviorAssertionSourceBindingV2,
  type RuntimeBehaviorEntityFieldSourceBindingV2,
} from "./schemas/node-product-runtime-source-v2.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "./schemas/product-spec-v2.js";
import {
  PRODUCT_RUNTIME_BEHAVIOR_EVALUATOR_CONTRACT_V1,
  type ProductRuntimeBehaviorContractV1,
  type ProductRuntimeBehaviorPredicateV1,
  type ProductRuntimeBehaviorSubjectV1,
  type ProductRuntimeEntitySnapshotV1,
} from "./schemas/product-runtime-behavior-contract-v1.js";
import {
  NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2,
  NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2,
  NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA,
  hashNodeProductRuntimeGeneratorProfileV2,
  type SemanticRealizationPlanV2,
} from "./schemas/semantic-realization-plan-v2.js";

const INPUT_MAX_CANONICAL_BYTES_V2 = 24 * 1024 * 1024;
const VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 = 44 * 1024 * 1024;
const INPUT_BOUNDED_WORK_LIMITS_V2 = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 24,
  maxNodes: INPUT_MAX_CANONICAL_BYTES_V2 + 120_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits: (INPUT_MAX_CANONICAL_BYTES_V2 * 8) + (6 * 1024 * 1024),
});
const VERIFIER_BOUNDED_WORK_LIMITS_V2 = Object.freeze({
  ...INPUT_BOUNDED_WORK_LIMITS_V2,
  maxNodes: VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 + 120_000,
  maxWorkUnits:
    (VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 * 8) + (8 * 1024 * 1024),
});
const MAX_DIAGNOSTICS_V2 = 100;
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

const GeneratorInputV2Schema = z.object({
  productSpec: z.unknown(),
  deliverySelection: z.unknown(),
  runtimeBehaviorProposal: z.unknown(),
  runtimeBehaviorContract: z.unknown(),
  realizationPlan: z.unknown(),
  fileTree: z.unknown(),
  buildTopology: z.unknown(),
}).strict();

const VerifierInputV2Schema = GeneratorInputV2Schema.extend({
  candidateReceipt: z.unknown(),
  candidateSourceText: z.string().min(1).max(
    NODE_PRODUCT_RUNTIME_SOURCE_MAX_BYTES_V2,
  ),
}).strict();

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function rawSha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
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

export type NodeProductRuntimeSourceDiagnosticCodeV2 =
  | "NODE_RUNTIME_SOURCE_V2_ARTIFACT_INVALID"
  | "NODE_RUNTIME_SOURCE_V2_BUILD_TOPOLOGY_REJECTED"
  | "NODE_RUNTIME_SOURCE_V2_INPUT_INVALID"
  | "NODE_RUNTIME_SOURCE_V2_UNSUPPORTED_BEHAVIOR_REJECTED"
  | "NODE_RUNTIME_SOURCE_V2_OUTPUT_LIMIT_EXCEEDED"
  | "NODE_RUNTIME_SOURCE_V2_PRODUCTION_AUTHORITY_REQUIRED"
  | "NODE_RUNTIME_SOURCE_V2_REALIZATION_PLAN_REJECTED"
  | "NODE_RUNTIME_SOURCE_V2_TRANSPORT_REJECTED"
  | "NODE_RUNTIME_SOURCE_V2_UPSTREAM_AUTHORITY_MISMATCH";

export type NodeProductRuntimeSourceDiagnosticV2 = Readonly<{
  code: NodeProductRuntimeSourceDiagnosticCodeV2;
  path: string;
  message: string;
}>;

export type NodeProductRuntimeSourceGenerationResultV2 =
  | Readonly<{
      status: "shadow_generated";
      diagnostics: readonly [];
      sourceText: string;
      sourceContentHash: string;
      runtimeProgramHash: string;
      receipt: Readonly<NodeProductRuntimeSourceReceiptV2>;
      canonicalReceiptBytes: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly NodeProductRuntimeSourceDiagnosticV2[];
    }>;

function diagnostic(
  code: NodeProductRuntimeSourceDiagnosticCodeV2,
  path: string,
  message: string,
): NodeProductRuntimeSourceDiagnosticV2 {
  return Object.freeze({
    code,
    path: path.slice(0, 1_000),
    message: message.slice(0, 1_500),
  });
}

function rejected(
  diagnostics: readonly NodeProductRuntimeSourceDiagnosticV2[],
): NodeProductRuntimeSourceGenerationResultV2 {
  return Object.freeze({
    status: "rejected" as const,
    diagnostics: Object.freeze([...diagnostics].slice(0, MAX_DIAGNOSTICS_V2)),
  });
}

function singleRejected(
  code: NodeProductRuntimeSourceDiagnosticCodeV2,
  path: string,
  message: string,
): NodeProductRuntimeSourceGenerationResultV2 {
  return rejected([diagnostic(code, path, message)]);
}

function pointerSegments(pointer: string): readonly string[] {
  if (pointer === "") return [];
  return pointer.slice(1).split("/").map((segment) =>
    segment.replace(/~1/gu, "/").replace(/~0/gu, "~"));
}

function pointersOverlap(left: string, right: string): boolean {
  const leftSegments = pointerSegments(left);
  const rightSegments = pointerSegments(right);
  const common = Math.min(leftSegments.length, rightSegments.length);
  for (let index = 0; index < common; index += 1) {
    if (leftSegments[index] !== rightSegments[index]) return false;
  }
  return true;
}

function unsupportedBehaviorDiagnosticsV2(
  productSpec: ProductSpecV2,
): readonly NodeProductRuntimeSourceDiagnosticV2[] {
  const diagnostics: NodeProductRuntimeSourceDiagnosticV2[] = [];
  productSpec.actions.forEach((action, actionIndex) => {
    if (action.navigation.kind !== "stay") {
      diagnostics.push(diagnostic(
        "NODE_RUNTIME_SOURCE_V2_UNSUPPORTED_BEHAVIOR_REJECTED",
        `/productSpec/actions/${actionIndex}/navigation`,
        `${action.id} declares ${action.navigation.kind} navigation but the selected CLI/API runtime owns no navigation environment`,
      ));
    }
    const projections = action.observableEffects.flatMap((effect, effectIndex) =>
      effect.selector.kind === "invocation_output"
        ? [{ pointer: effect.selector.pointer, effectIndex }]
        : []);
    for (let left = 0; left < projections.length; left += 1) {
      for (let right = left + 1; right < projections.length; right += 1) {
        if (!pointersOverlap(
          projections[left]!.pointer,
          projections[right]!.pointer,
        )) continue;
        diagnostics.push(diagnostic(
          "NODE_RUNTIME_SOURCE_V2_UNSUPPORTED_BEHAVIOR_REJECTED",
          `/productSpec/actions/${actionIndex}/observableEffects/${projections[right]!.effectIndex}/selector/pointer`,
          `${action.id} output pointer ${projections[right]!.pointer} overlaps ${projections[left]!.pointer}`,
        ));
      }
    }
    action.observableEffects.forEach((effect, effectIndex) => {
      if (effect.assertions.every((assertion) => assertion.phase === "after")) return;
      diagnostics.push(diagnostic(
        "NODE_RUNTIME_SOURCE_V2_UNSUPPORTED_BEHAVIOR_REJECTED",
        `/productSpec/actions/${actionIndex}/observableEffects/${effectIndex}/assertions`,
        `${action.id} invocation output contains a before-phase assertion with no pre-invocation output coordinate`,
      ));
    });
  });
  return Object.freeze(diagnostics.slice(0, MAX_DIAGNOSTICS_V2));
}

type RuntimeProgramV2 = Readonly<{
  schema: "setfarm.node-product-runtime-program.v2";
  programVersion: "2.0.0";
  runtimeProgramContractHash: string;
  productRef: string;
  profileId:
    | "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    | "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2";
  states: readonly Readonly<{
    stateRef: string;
    initialValue: unknown;
  }>[];
  persistencePolicies: Readonly<ProductSpecV2["persistencePolicies"]>;
  runtimeBehavior: Readonly<{
    schema: "setfarm.node-product-runtime-behavior-program.v1";
    contractHash: string;
    evaluatorContractHash: string;
    bounds: Readonly<{
      maxCollectionItemsPerAssertion: number;
      maxSubjectVisits: number;
    }>;
    assertions: readonly Readonly<{
      invariantRef: string;
      assertionRef: string;
      assertionHash: string;
      stateRef: string;
      subject: Readonly<ProductRuntimeBehaviorSubjectV1>;
      predicate: Readonly<ProductRuntimeBehaviorPredicateV1>;
    }>[];
    entityFieldBindings: readonly Readonly<{
      occurrenceRef: string;
      snapshotBindingHash: string;
      actionRef: string;
      deltaOrdinal: number;
      entityRef: string;
      fieldRef: string;
      snapshot: Readonly<ProductRuntimeEntitySnapshotV1>;
      projectedField: Readonly<{
        name: string;
        valueType: string;
        enumValues: readonly string[] | null;
      }>;
      matchField: Readonly<{
        name: string;
        valueType: string;
        enumValues: readonly string[] | null;
      }> | null;
    }>[];
  }>;
  actions: readonly Readonly<{
    actionRef: string;
    affectedSurfaceRefs: readonly string[];
    trigger: ProductSpecV2["actions"][number]["trigger"];
    transport: InvocationInputTransportSetV2["contracts"][number];
    preconditions: Readonly<ProductSpecV2["actions"][number]["preconditions"]>;
    stateDeltas: Readonly<ProductSpecV2["actions"][number]["stateDeltas"]>;
    persistenceEffects: Readonly<
      ProductSpecV2["actions"][number]["persistenceEffects"]
    >;
    outputProjections: readonly Readonly<{
      observableRef: string;
      pointer: string;
      valueType: string;
      valueFrom: Readonly<
        | { kind: "input"; fieldName: string }
        | { kind: "literal"; value: unknown }
      >;
    }>[];
  }>[];
}>;

function buildRuntimeProgramV2(
  productSpec: ProductSpecV2,
  runtimeBehaviorContract: Readonly<ProductRuntimeBehaviorContractV1>,
  transportSet: Readonly<InvocationInputTransportSetV2>,
  profileId: RuntimeProgramV2["profileId"],
): RuntimeProgramV2 {
  const transportByAction = new Map(transportSet.contracts.map((contract) =>
    [contract.actionRef, contract] as const));
  const assertions = runtimeBehaviorContract.invariantBindings.flatMap((binding) =>
    binding.disposition.kind === "runtime_assertions"
      ? binding.disposition.assertions.map((assertion) => Object.freeze({
          invariantRef: binding.invariantRef,
          assertionRef: assertion.assertionRef,
          assertionHash: assertion.assertionHash,
          stateRef: binding.stateRef,
          subject: Object.freeze(structuredClone(assertion.subject)),
          predicate: Object.freeze(structuredClone(assertion.predicate)),
        }))
      : []).sort((left, right) => compareUtf16(left.assertionRef, right.assertionRef));
  const entityFieldBindings = runtimeBehaviorContract.entityFieldBindings.map((binding) => {
    const entity = productSpec.entities.find((candidate) =>
      candidate.id === binding.entityRef);
    const projectedField = entity?.fields.find((candidate) =>
      candidate.id === binding.fieldRef);
    const selection = binding.snapshot.selection;
    const matchField = selection.kind === "match_input"
      ? entity?.fields.find((candidate) =>
          candidate.id === selection.matchFieldRef)
      : undefined;
    if (!entity || !projectedField || (
      selection.kind === "match_input" && !matchField
    )) {
      throw new Error(`Verified entity snapshot ${binding.occurrenceRef} lost ProductSpec field authority`);
    }
    const fieldProjection = (field: typeof projectedField) => Object.freeze({
      name: field.name,
      valueType: field.valueType,
      enumValues: field.enumValues
        ? Object.freeze([...field.enumValues])
        : null,
    });
    return Object.freeze({
      occurrenceRef: binding.occurrenceRef,
      snapshotBindingHash: binding.snapshotBindingHash,
      actionRef: binding.actionRef,
      deltaOrdinal: binding.deltaOrdinal,
      entityRef: binding.entityRef,
      fieldRef: binding.fieldRef,
      snapshot: Object.freeze(structuredClone(binding.snapshot)),
      projectedField: fieldProjection(projectedField),
      matchField: matchField ? fieldProjection(matchField) : null,
    });
  }).sort((left, right) => compareUtf16(left.occurrenceRef, right.occurrenceRef));
  if (
    assertions.length !== runtimeBehaviorContract.coverage.runtimeAssertionCount
    || entityFieldBindings.length
      !== runtimeBehaviorContract.coverage.entityFieldBindingCount
  ) {
    throw new Error("Verified runtime behavior coverage does not close over its executable projection");
  }
  return Object.freeze({
    schema: "setfarm.node-product-runtime-program.v2" as const,
    programVersion: "2.0.0" as const,
    runtimeProgramContractHash: NODE_PRODUCT_RUNTIME_PROGRAM_CONTRACT_HASH_V2,
    productRef: productSpec.product.id,
    profileId,
    states: Object.freeze([...productSpec.states]
      .sort((left, right) => compareUtf16(left.id, right.id))
      .map((state) => Object.freeze({
        stateRef: state.id,
        initialValue: structuredClone(state.initialValue),
      }))),
    persistencePolicies: Object.freeze([...productSpec.persistencePolicies]
      .sort((left, right) => compareUtf16(left.id, right.id))
      .map((policy) => Object.freeze(structuredClone(policy)))),
    runtimeBehavior: Object.freeze({
      schema: "setfarm.node-product-runtime-behavior-program.v1" as const,
      contractHash: runtimeBehaviorContract.contractHash,
      evaluatorContractHash:
        runtimeBehaviorContract.authority.evaluatorContractHash,
      bounds: Object.freeze({
        maxCollectionItemsPerAssertion:
          PRODUCT_RUNTIME_BEHAVIOR_EVALUATOR_CONTRACT_V1.bounds
            .maxCollectionItemsPerAssertion,
        maxSubjectVisits:
          PRODUCT_RUNTIME_BEHAVIOR_EVALUATOR_CONTRACT_V1.bounds.maxSubjectVisits,
      }),
      assertions: Object.freeze(assertions),
      entityFieldBindings: Object.freeze(entityFieldBindings),
    }),
    actions: Object.freeze([...productSpec.actions]
      .sort((left, right) => compareUtf16(left.id, right.id))
      .map((action) => {
        const transport = transportByAction.get(action.id);
        if (!transport) throw new Error(`Missing transport for ${action.id}`);
        return Object.freeze({
          actionRef: action.id,
          affectedSurfaceRefs: Object.freeze([...action.affectedSurfaceRefs]),
          trigger: Object.freeze(structuredClone(action.trigger)),
          transport,
          preconditions: Object.freeze(structuredClone(action.preconditions)),
          stateDeltas: Object.freeze(structuredClone(action.stateDeltas)),
          persistenceEffects: Object.freeze(
            structuredClone(action.persistenceEffects),
          ),
          outputProjections: Object.freeze(action.observableEffects.map((effect) => {
            if (effect.selector.kind !== "invocation_output") {
              throw new Error(`${action.id} has a non-invocation output selector`);
            }
            return Object.freeze({
              observableRef: effect.id,
              pointer: effect.selector.pointer,
              valueType: effect.selector.valueContract.valueType,
              valueFrom: Object.freeze(structuredClone(
                effect.selector.valueContract.expectedFrom,
              )),
            });
          }).sort((left, right) => compareUtf16(left.pointer, right.pointer))),
        });
      })),
  });
}

const COMMON_RUNTIME_SOURCE_V2 = String.raw`
type RuntimeFailureKindV2 = "input_validation" | "precondition" | "action_failure";
type JsonRecordV2 = Record<string, any>;

class RuntimeFailureV2 extends Error {
  readonly kind: RuntimeFailureKindV2;
  constructor(kind: RuntimeFailureKindV2, message: string) {
    super(message);
    this.name = "RuntimeFailureV2";
    this.kind = kind;
  }
}

const PROGRAM_V2: any = JSON.parse(PROGRAM_JSON_V2);

function ownV2(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function recordV2(value: unknown): value is JsonRecordV2 {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function wellFormedV2(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0) return false;
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}

function canonicalV2(value: any, ancestors: Set<object> = new Set<object>()): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RuntimeFailureV2("action_failure", "Non-finite JSON number");
    return JSON.stringify(value);
  }
  if (!recordV2(value) && !Array.isArray(value)) {
    throw new RuntimeFailureV2("action_failure", "Non-JSON runtime value");
  }
  if (ancestors.has(value)) throw new RuntimeFailureV2("action_failure", "Cyclic JSON value");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) throw new RuntimeFailureV2("action_failure", "Array subclass is not JSON");
      const ownKeys = Reflect.ownKeys(value);
      for (const key of ownKeys) {
        if (typeof key === "symbol") throw new RuntimeFailureV2("action_failure", "Symbol property is not JSON");
        if (key === "length") continue;
        const numeric = Number(key);
        if (!Number.isInteger(numeric) || numeric < 0 || numeric >= value.length || String(numeric) !== key) {
          throw new RuntimeFailureV2("action_failure", "Array property is not a JSON index");
        }
      }
      const parts: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
          throw new RuntimeFailureV2("action_failure", "Sparse or accessor array is not JSON");
        }
        parts.push(canonicalV2(descriptor.value, ancestors));
      }
      return "[" + parts.join(",") + "]";
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new RuntimeFailureV2("action_failure", "Object prototype is not JSON");
    }
    const keys: string[] = [];
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === "symbol") throw new RuntimeFailureV2("action_failure", "Symbol property is not JSON");
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
        throw new RuntimeFailureV2("action_failure", "Accessor or hidden property is not JSON");
      }
      keys.push(key);
    }
    keys.sort();
    return "{" + keys.map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      return JSON.stringify(key) + ":" + canonicalV2(descriptor.value, ancestors);
    }).join(",") + "}";
  } finally {
    ancestors.delete(value);
  }
}

function cloneV2<T>(value: T): T {
  return JSON.parse(canonicalV2(value)) as T;
}

function deepEqualV2(left: unknown, right: unknown): boolean {
  return canonicalV2(left) === canonicalV2(right);
}

function segmentsV2(pointer: string): string[] {
  if (pointer === "") return [];
  return pointer.slice(1).split("/").map((segment) =>
    segment.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function arrayIndexV2(segment: string, length: number): number | null {
  if (!/^(?:0|[1-9][0-9]*)$/.test(segment)) return null;
  const index = Number(segment);
  return Number.isSafeInteger(index) && index < length ? index : null;
}

function readPointerV2(root: any, pointer: string): any {
  let current = root;
  for (const segment of segmentsV2(pointer)) {
    if (Array.isArray(current)) {
      const index = arrayIndexV2(segment, current.length);
      if (index === null) return undefined;
      current = current[index];
    } else if (recordV2(current) && ownV2(current, segment)) {
      current = current[segment];
    } else return undefined;
  }
  return current;
}

function defineV2(target: JsonRecordV2, key: string, value: any): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function replacePointerV2(root: any, pointer: string, value: any): any {
  const segments = segmentsV2(pointer);
  if (segments.length === 0) return cloneV2(value);
  const copy = cloneV2(root);
  let current: any = copy;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]!;
    if (Array.isArray(current)) {
      const childIndex = arrayIndexV2(segment, current.length);
      if (childIndex === null) throw new RuntimeFailureV2("action_failure", "State pointer parent is absent");
      current = current[childIndex];
    } else if (recordV2(current) && ownV2(current, segment)) current = current[segment];
    else throw new RuntimeFailureV2("action_failure", "State pointer parent is absent");
  }
  const leaf = segments[segments.length - 1]!;
  if (Array.isArray(current)) {
    const leafIndex = arrayIndexV2(leaf, current.length);
    if (leafIndex === null) throw new RuntimeFailureV2("action_failure", "State pointer target is absent");
    current[leafIndex] = cloneV2(value);
  } else if (recordV2(current)) defineV2(current, leaf, cloneV2(value));
  else throw new RuntimeFailureV2("action_failure", "State pointer parent is not a container");
  return copy;
}

function documentV2(entries: Array<{ pointer: string; value: any }>): any {
  if (entries.length === 0) return null;
  if (entries.length === 1 && entries[0]!.pointer === "") return cloneV2(entries[0]!.value);
  const root: JsonRecordV2 = {};
  for (const entry of entries) {
    const segments = segmentsV2(entry.pointer);
    if (segments.length === 0) throw new RuntimeFailureV2("action_failure", "Root pointer overlaps another projection");
    let current = root;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index]!;
      if (!ownV2(current, segment)) defineV2(current, segment, {});
      if (!recordV2(current[segment])) throw new RuntimeFailureV2("action_failure", "Projection pointer collision");
      current = current[segment] as JsonRecordV2;
    }
    defineV2(current, segments[segments.length - 1]!, cloneV2(entry.value));
  }
  return root;
}

function validateValueV2(field: any, value: any): void {
  let valid = false;
  if (field.valueType === "string") valid = typeof value === "string" && wellFormedV2(value);
  else if (field.valueType === "number") valid = typeof value === "number" && Number.isFinite(value);
  else if (field.valueType === "boolean") valid = typeof value === "boolean";
  else if (field.valueType === "enum") valid = typeof value === "string" && wellFormedV2(value) && field.enumValues.includes(value);
  else if (field.valueType === "object") valid = recordV2(value);
  else if (field.valueType === "array") valid = Array.isArray(value);
  if (!valid) throw new RuntimeFailureV2("input_validation", field.actionInputRef + " has an invalid typed value");
  try { canonicalV2(value); }
  catch { throw new RuntimeFailureV2("input_validation", field.actionInputRef + " is not a canonical JSON value"); }
}

function decodeTextV2(field: any, text: string): any {
  if (!wellFormedV2(text)) throw new RuntimeFailureV2("input_validation", field.actionInputRef + " has invalid transport text");
  if (field.valueType === "string" || field.valueType === "enum") {
    validateValueV2(field, text);
    return text;
  }
  let value: any;
  try { value = JSON.parse(text); }
  catch { throw new RuntimeFailureV2("input_validation", field.actionInputRef + " is not canonical JSON text"); }
  validateValueV2(field, value);
  if (canonicalV2(value) !== text) throw new RuntimeFailureV2("input_validation", field.actionInputRef + " is not canonical transport text");
  return value;
}

const INITIAL_STATE_V2: JsonRecordV2 = Object.fromEntries(
  PROGRAM_V2.states.map((state: any) => [state.stateRef, cloneV2(state.initialValue)]),
);
let runtimeStateV2: JsonRecordV2 = cloneV2(INITIAL_STATE_V2);

function preconditionsPassV2(action: any, before: JsonRecordV2): boolean {
  for (const condition of action.preconditions) {
    if (!ownV2(before, condition.stateRef)) return false;
    const actual = readPointerV2(before[condition.stateRef], condition.path);
    let passed = false;
    if (condition.operator === "equals") passed = actual !== undefined && deepEqualV2(actual, condition.expected);
    else if (condition.operator === "not_equals") passed = actual === undefined || !deepEqualV2(actual, condition.expected);
    else if (condition.operator === "exists") passed = actual !== undefined && actual !== null;
    else if (condition.operator === "not_exists") passed = actual === undefined || actual === null;
    else if (condition.operator === "truthy") passed = Boolean(actual);
    else if (condition.operator === "falsy") passed = !actual;
    if (!passed) return false;
  }
  return true;
}

type BehaviorResolutionV2 = { exists: true; value: any } | { exists: false };

function behaviorResolutionV2(root: any, pointer: string): BehaviorResolutionV2 {
  let current = root;
  for (const segment of segmentsV2(pointer)) {
    if (current === null || typeof current !== "object" || !ownV2(current, segment)) {
      return { exists: false };
    }
    current = current[segment];
  }
  return { exists: true, value: current };
}

function behaviorJsonTypeV2(value: any): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function behaviorTruthyV2(value: any): boolean {
  return !(value === null || value === false || value === 0 || value === "");
}

function behaviorPredicatePassesV2(resolution: BehaviorResolutionV2, predicate: any): boolean {
  if (predicate.operator === "exists") return resolution.exists;
  if (predicate.operator === "not_exists") return !resolution.exists;
  if (!resolution.exists) return false;
  const value = resolution.value;
  if (predicate.operator === "equals") return deepEqualV2(value, predicate.expected);
  if (predicate.operator === "not_equals") return !deepEqualV2(value, predicate.expected);
  if (predicate.operator === "truthy") return behaviorTruthyV2(value);
  if (predicate.operator === "falsy") return !behaviorTruthyV2(value);
  if (predicate.operator === "type_is") return behaviorJsonTypeV2(value) === predicate.expected;
  if (predicate.operator === "one_of") {
    return predicate.expected.some((expected: any) => deepEqualV2(value, expected));
  }
  if (predicate.operator === "min_length") return typeof value === "string" && value.length >= predicate.expected;
  if (predicate.operator === "max_length") return typeof value === "string" && value.length <= predicate.expected;
  if (predicate.operator === "minimum") return typeof value === "number" && value >= predicate.expected;
  if (predicate.operator === "maximum") return typeof value === "number" && value <= predicate.expected;
  if (predicate.operator === "min_items") return Array.isArray(value) && value.length >= predicate.expected;
  if (predicate.operator === "max_items") return Array.isArray(value) && value.length <= predicate.expected;
  throw new RuntimeFailureV2("action_failure", "RUNTIME_BEHAVIOR_PREDICATE_UNKNOWN");
}

function behaviorFailureV2(code: string, reference: string): never {
  throw new RuntimeFailureV2("action_failure", code + ":" + reference);
}

function assertBehaviorCheckpointV2(checkpoint: "initial" | "after_action", actionRef: string | null, snapshot: JsonRecordV2): void {
  let visits = 0;
  for (const assertion of PROGRAM_V2.runtimeBehavior.assertions) {
    let passed = false;
    let assertionVisits = 1;
    if (assertion.subject.kind === "state_path") {
      const state = ownV2(snapshot, assertion.subject.stateRef)
        ? { exists: true as const, value: snapshot[assertion.subject.stateRef] }
        : { exists: false as const };
      const resolution = state.exists
        ? behaviorResolutionV2(state.value, assertion.subject.path)
        : state;
      passed = behaviorPredicatePassesV2(resolution, assertion.predicate);
    } else {
      const state = ownV2(snapshot, assertion.subject.stateRef)
        ? { exists: true as const, value: snapshot[assertion.subject.stateRef] }
        : { exists: false as const };
      const collection = state.exists
        ? behaviorResolutionV2(state.value, assertion.subject.collectionPath)
        : state;
      if (!collection.exists || !Array.isArray(collection.value)) {
        passed = false;
      } else {
        if (collection.value.length > PROGRAM_V2.runtimeBehavior.bounds.maxCollectionItemsPerAssertion) {
          behaviorFailureV2("RUNTIME_BEHAVIOR_COLLECTION_LIMIT_EXCEEDED", assertion.assertionRef);
        }
        assertionVisits = Math.max(1, collection.value.length);
        passed = collection.value.every((item: any) =>
          behaviorPredicatePassesV2(
            behaviorResolutionV2(item, assertion.subject.itemPath),
            assertion.predicate,
          ));
      }
    }
    visits += assertionVisits;
    if (visits > PROGRAM_V2.runtimeBehavior.bounds.maxSubjectVisits) {
      behaviorFailureV2("RUNTIME_BEHAVIOR_VISIT_LIMIT_EXCEEDED", assertion.assertionRef);
    }
    if (!passed) {
      behaviorFailureV2(
        "RUNTIME_INVARIANT_ASSERTION_FAILED_" + checkpoint.toUpperCase()
          + (actionRef === null ? "" : "_" + actionRef),
        assertion.assertionRef,
      );
    }
  }
}

function validGregorianDateBehaviorV2(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || year < 1 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maximum = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
  return day <= maximum;
}

function behaviorFieldValuePassesV2(field: any, value: any): boolean {
  let valid = false;
  if (field.valueType === "number") valid = typeof value === "number" && Number.isFinite(value);
  else if (field.valueType === "boolean") valid = typeof value === "boolean";
  else if (field.valueType === "object") valid = recordV2(value);
  else if (field.valueType === "array") valid = Array.isArray(value);
  else if (field.valueType === "date") valid = typeof value === "string" && validGregorianDateBehaviorV2(value);
  else if (field.valueType === "datetime") {
    if (typeof value === "string") {
      const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
      if (match) {
        const [, year, month, day, hour, minute, second, offsetHour, offsetMinute] = match;
        valid = validGregorianDateBehaviorV2(year + "-" + month + "-" + day)
          && Number(hour) <= 23
          && Number(minute) <= 59
          && Number(second) <= 59
          && (offsetHour === undefined || Number(offsetHour) <= 23)
          && (offsetMinute === undefined || Number(offsetMinute) <= 59)
          && !Number.isNaN(Date.parse(value));
      }
    }
  } else valid = typeof value === "string" && wellFormedV2(value);
  return valid && (
    field.valueType !== "enum"
    || (Array.isArray(field.enumValues) && field.enumValues.includes(value))
  );
}

function entityFieldValueV2(binding: any, inputs: JsonRecordV2, before: JsonRecordV2): any {
  if (!ownV2(before, binding.snapshot.stateRef)) {
    behaviorFailureV2("ENTITY_SNAPSHOT_STATE_MISSING", binding.occurrenceRef);
  }
  const collection = behaviorResolutionV2(
    before[binding.snapshot.stateRef],
    binding.snapshot.collectionPath,
  );
  let selected: any;
  if (binding.snapshot.selection.kind === "singleton") {
    if (!collection.exists || !recordV2(collection.value)) {
      behaviorFailureV2("ENTITY_SNAPSHOT_SINGLETON_MISSING", binding.occurrenceRef);
    }
    selected = collection.value;
  } else {
    if (!collection.exists || !Array.isArray(collection.value)) {
      behaviorFailureV2("ENTITY_SNAPSHOT_COLLECTION_MISSING", binding.occurrenceRef);
    }
    if (collection.value.length > PROGRAM_V2.runtimeBehavior.bounds.maxCollectionItemsPerAssertion) {
      behaviorFailureV2("ENTITY_SNAPSHOT_COLLECTION_LIMIT_EXCEEDED", binding.occurrenceRef);
    }
    const matches: any[] = [];
    for (const candidate of collection.value) {
      if (!recordV2(candidate)) {
        behaviorFailureV2("ENTITY_SNAPSHOT_MEMBER_INVALID", binding.occurrenceRef);
      }
      if (!ownV2(candidate, binding.matchField.name)
        || !behaviorFieldValuePassesV2(binding.matchField, candidate[binding.matchField.name])) {
        behaviorFailureV2("ENTITY_SNAPSHOT_MATCH_FIELD_INVALID", binding.occurrenceRef);
      }
      if (!ownV2(candidate, binding.projectedField.name)
        || !behaviorFieldValuePassesV2(binding.projectedField, candidate[binding.projectedField.name])) {
        behaviorFailureV2("ENTITY_SNAPSHOT_FIELD_TYPE_INVALID", binding.occurrenceRef);
      }
      if (deepEqualV2(
        candidate[binding.matchField.name],
        inputs[binding.snapshot.selection.inputField],
      )) matches.push(candidate);
    }
    if (matches.length !== 1) {
      behaviorFailureV2(
        matches.length === 0
          ? "ENTITY_SNAPSHOT_MATCH_MISSING"
          : "ENTITY_SNAPSHOT_MATCH_AMBIGUOUS",
        binding.occurrenceRef,
      );
    }
    selected = matches[0];
  }
  if (!recordV2(selected) || !ownV2(selected, binding.projectedField.name)) {
    behaviorFailureV2("ENTITY_SNAPSHOT_FIELD_MISSING", binding.occurrenceRef);
  }
  const value = selected[binding.projectedField.name];
  if (!behaviorFieldValuePassesV2(binding.projectedField, value)) {
    behaviorFailureV2("ENTITY_SNAPSHOT_FIELD_TYPE_INVALID", binding.occurrenceRef);
  }
  return cloneV2(value);
}

function sourceValueV2(source: any, inputs: JsonRecordV2, before: JsonRecordV2, actionRef: string, deltaOrdinal: number): any {
  if (source.kind === "literal") return cloneV2(source.value);
  if (source.kind === "input") return cloneV2(inputs[source.field]);
  if (source.kind === "inputs") {
    const value: JsonRecordV2 = Object.create(null) as JsonRecordV2;
    for (const field of source.fields) defineV2(value, field, cloneV2(inputs[field]));
    return value;
  }
  if (source.kind === "state") {
    if (!ownV2(before, source.stateRef)) throw new RuntimeFailureV2("action_failure", "State source is absent");
    const value = readPointerV2(before[source.stateRef], source.path);
    if (value === undefined) throw new RuntimeFailureV2("action_failure", "State source pointer is absent");
    return cloneV2(value);
  }
  if (source.kind === "entity_field") {
    const binding = PROGRAM_V2.runtimeBehavior.entityFieldBindings.find((candidate: any) =>
      candidate.actionRef === actionRef && candidate.deltaOrdinal === deltaOrdinal);
    if (!binding) behaviorFailureV2("ENTITY_SNAPSHOT_BINDING_MISSING", actionRef + ":" + deltaOrdinal);
    return entityFieldValueV2(binding, inputs, before);
  }
  throw new RuntimeFailureV2("action_failure", "Unsupported opaque value source");
}

function applyDeltaV2(delta: any, deltaOrdinal: number, actionRef: string, inputs: JsonRecordV2, before: JsonRecordV2, draft: JsonRecordV2): void {
  if (!ownV2(draft, delta.stateRef)) throw new RuntimeFailureV2("action_failure", "State delta target is absent");
  const expected = sourceValueV2(delta.valueFrom, inputs, before, actionRef, deltaOrdinal);
  const current = readPointerV2(draft[delta.stateRef], delta.path);
  let next: any;
  if (delta.operation === "set" || delta.operation === "clear") next = expected;
  else if (delta.operation === "merge") {
    if (!recordV2(current) || !recordV2(expected)) throw new RuntimeFailureV2("action_failure", "Merge requires two objects");
    next = cloneV2(current);
    for (const key of Object.keys(expected)) defineV2(next, key, cloneV2(expected[key]));
  } else if (delta.operation === "append") {
    if (!Array.isArray(current)) throw new RuntimeFailureV2("action_failure", "Append requires an array");
    next = [...current, cloneV2(expected)];
  } else if (delta.operation === "remove") {
    if (!Array.isArray(current)) throw new RuntimeFailureV2("action_failure", "Remove requires an array");
    next = current.filter((item: any) => {
      if (!delta.matchField) return !deepEqualV2(item, expected);
      if (!recordV2(item)) return true;
      const expectedKey = recordV2(expected) ? expected[delta.matchField] : expected;
      return !deepEqualV2(item[delta.matchField], expectedKey);
    });
  } else if (delta.operation === "upsert") {
    if (!Array.isArray(current) || !recordV2(expected) || !delta.matchField || !ownV2(expected, delta.matchField)) {
      throw new RuntimeFailureV2("action_failure", "Upsert requires an object and match field");
    }
    next = cloneV2(current);
    const found = next.findIndex((item: any) =>
      recordV2(item) && deepEqualV2(item[delta.matchField], expected[delta.matchField]));
    if (found === -1) next.push(cloneV2(expected));
    else next[found] = cloneV2(expected);
  } else throw new RuntimeFailureV2("action_failure", "Unknown state operation");
  draft[delta.stateRef] = replacePointerV2(draft[delta.stateRef], delta.path, next);
}

function outputValueV2(projection: any, inputs: JsonRecordV2): any {
  if (projection.valueFrom.kind === "input") return cloneV2(inputs[projection.valueFrom.fieldName]);
  return cloneV2(projection.valueFrom.value);
}

function executeActionV2(action: any, inputs: JsonRecordV2): any {
  for (const field of action.transport.fields) {
    if (!ownV2(inputs, field.fieldName)) throw new RuntimeFailureV2("input_validation", "Input field closure mismatch");
    validateValueV2(field, inputs[field.fieldName]);
  }
  if (Object.keys(inputs).length !== action.transport.fields.length) {
    throw new RuntimeFailureV2("input_validation", "Input field closure mismatch");
  }
  const before = cloneV2(runtimeStateV2);
  if (!preconditionsPassV2(action, before)) throw new RuntimeFailureV2("precondition", "Action precondition failed");
  const draft = cloneV2(before);
  action.stateDeltas.forEach((delta: any, deltaOrdinal: number) =>
    applyDeltaV2(delta, deltaOrdinal, action.actionRef, inputs, before, draft));
  assertBehaviorCheckpointV2("after_action", action.actionRef, draft);
  runtimeStateV2 = draft;
  const resultValue = documentV2(action.outputProjections.map((projection: any) => ({
    pointer: projection.pointer,
    value: outputValueV2(projection, inputs),
  })));
  return documentV2([{ pointer: action.transport.result.valuePointer, value: resultValue }]);
}

assertBehaviorCheckpointV2("initial", null, runtimeStateV2);

function failureForV2(action: any, kind: RuntimeFailureKindV2, message: string): { code: number; body: any } {
  const failure = action.transport.result.failureCases.find((candidate: any) => candidate.kind === kind)
    || action.transport.result.failureCases.find((candidate: any) => candidate.kind === "action_failure");
  if (!failure) throw new Error("Runtime program lacks a declared failure case");
  return {
    code: (failure.exitCodes || failure.statusCodes)[0],
    body: documentV2([
      { pointer: failure.codePointer, value: failure.errorCode },
      { pointer: failure.messagePointer, value: message },
    ]),
  };
}
`;

const CLI_RUNTIME_SOURCE_V2 = String.raw`
async function stdinDocumentV2(required: boolean): Promise<any> {
  if (!required) return null;
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.byteLength;
    if (total > 8 * 1024 * 1024) throw new RuntimeFailureV2("input_validation", "stdin exceeds the runtime input bound");
    chunks.push(bytes);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  let value: any;
  try { value = JSON.parse(text); }
  catch { throw new RuntimeFailureV2("input_validation", "stdin is not canonical JSON"); }
  if (canonicalV2(value) !== text) throw new RuntimeFailureV2("input_validation", "stdin is not exact canonical JSON");
  return value;
}

async function cliInputsV2(action: any, argv: string[]): Promise<JsonRecordV2> {
  const fields = action.transport.fields;
  const positional = fields.filter((field: any) => field.channel.kind === "argv_position")
    .sort((left: any, right: any) => left.channel.position - right.channel.position);
  const flags = fields.filter((field: any) => field.channel.kind === "argv_flag")
    .sort((left: any, right: any) => left.channel.flag < right.channel.flag ? -1 : left.channel.flag > right.channel.flag ? 1 : 0);
  const values: JsonRecordV2 = Object.create(null) as JsonRecordV2;
  let cursor = action.transport.subcommandTokens.length;
  for (const field of positional) {
    if (cursor >= argv.length) throw new RuntimeFailureV2("input_validation", "Missing positional input " + field.fieldName);
    defineV2(values, field.fieldName, decodeTextV2(field, argv[cursor++]!));
  }
  for (const field of flags) {
    const flag = field.channel.flag;
    if (field.channel.style === "separate") {
      if (argv[cursor] !== flag || cursor + 1 >= argv.length) throw new RuntimeFailureV2("input_validation", "Missing flag " + flag);
      defineV2(values, field.fieldName, decodeTextV2(field, argv[cursor + 1]!));
      cursor += 2;
    } else {
      const prefix = flag + "=";
      if (!argv[cursor] || !argv[cursor]!.startsWith(prefix)) throw new RuntimeFailureV2("input_validation", "Missing flag " + flag);
      defineV2(values, field.fieldName, decodeTextV2(field, argv[cursor]!.slice(prefix.length)));
      cursor += 1;
    }
  }
  if (cursor !== argv.length) throw new RuntimeFailureV2("input_validation", "Unexpected CLI arguments");
  const stdinFields = fields.filter((field: any) => field.channel.kind === "stdin_json_pointer");
  const stdin = await stdinDocumentV2(stdinFields.length > 0);
  for (const field of stdinFields) {
    const value = readPointerV2(stdin, field.channel.pointer);
    if (value === undefined) throw new RuntimeFailureV2("input_validation", "Missing stdin field " + field.fieldName);
    validateValueV2(field, value);
    defineV2(values, field.fieldName, cloneV2(value));
  }
  if (stdinFields.length > 0) {
    const expected = documentV2(stdinFields.map((field: any) => ({
      pointer: field.channel.pointer,
      value: values[field.fieldName],
    })));
    if (!deepEqualV2(stdin, expected)) throw new RuntimeFailureV2("input_validation", "stdin field closure mismatch");
  }
  return values;
}

async function mainV2(): Promise<void> {
  const argv = process.argv.slice(2);
  const action = PROGRAM_V2.actions.find((candidate: any) =>
    candidate.transport.subcommandTokens.every((token: string, index: number) => argv[index] === token));
  const failureOwner = action || PROGRAM_V2.actions[0];
  try {
    if (!action) throw new RuntimeFailureV2("input_validation", "Unknown command");
    const inputs = await cliInputsV2(action, argv);
    const body = executeActionV2(action, inputs);
    process.stdout.write(canonicalV2(body) + "\n");
    process.exitCode = action.transport.result.successExitCodes[0];
  } catch (error) {
    const kind: RuntimeFailureKindV2 = error instanceof RuntimeFailureV2 ? error.kind : "action_failure";
    const message = error instanceof Error ? error.message : "Action failed";
    const failure = failureForV2(failureOwner, kind, message);
    process.stderr.write(canonicalV2(failure.body) + "\n");
    process.exitCode = failure.code;
  }
}

await mainV2();
`;

const API_RUNTIME_SOURCE_V2 = String.raw`
import type { RequestHandler } from "express";

function decodeRfc3986V2(raw: string): string {
  let decoded: string;
  try { decoded = decodeURIComponent(raw); }
  catch { throw new RuntimeFailureV2("input_validation", "Invalid RFC3986 component"); }
  const encoded = encodeURIComponent(decoded).replace(/[!'()*]/g, (character) =>
    "%" + character.charCodeAt(0).toString(16).toUpperCase());
  if (encoded !== raw) throw new RuntimeFailureV2("input_validation", "Non-canonical RFC3986 component");
  return decoded;
}

function routeCapturesV2(template: string, rawPath: string): JsonRecordV2 | null {
  const expected = template === "/" ? [] : template.slice(1).split("/");
  const observed = rawPath === "/" ? [] : rawPath.slice(1).split("/");
  if (expected.length !== observed.length) return null;
  const captures: JsonRecordV2 = Object.create(null) as JsonRecordV2;
  for (let index = 0; index < expected.length; index += 1) {
    const segment = expected[index]!;
    if (segment.startsWith(":")) defineV2(captures, segment.slice(1), observed[index]!);
    else if (segment !== observed[index]) return null;
  }
  return captures;
}

function rawRequestPartsV2(url: string): { path: string; query: Array<[string, string]> } {
  const separator = url.indexOf("?");
  const path = separator === -1 ? url : url.slice(0, separator);
  const rawQuery = separator === -1 ? "" : url.slice(separator + 1);
  const query: Array<[string, string]> = [];
  if (rawQuery !== "") {
    for (const pair of rawQuery.split("&")) {
      const equals = pair.indexOf("=");
      if (equals < 1) throw new RuntimeFailureV2("input_validation", "Malformed query parameter");
      query.push([pair.slice(0, equals), pair.slice(equals + 1)]);
    }
  }
  return { path, query };
}

function httpInputsV2(action: any, captures: JsonRecordV2, query: Array<[string, string]>, body: any): JsonRecordV2 {
  const values: JsonRecordV2 = Object.create(null) as JsonRecordV2;
  const expectedQuery = action.transport.fields.filter((field: any) => field.channel.kind === "query_parameter")
    .sort((left: any, right: any) => left.channel.name < right.channel.name ? -1 : left.channel.name > right.channel.name ? 1 : 0);
  if (query.length !== expectedQuery.length) throw new RuntimeFailureV2("input_validation", "Query field closure mismatch");
  for (let index = 0; index < expectedQuery.length; index += 1) {
    const field = expectedQuery[index]!;
    const pair = query[index]!;
    if (pair[0] !== field.channel.name) throw new RuntimeFailureV2("input_validation", "Query order or name mismatch");
    defineV2(values, field.fieldName, decodeTextV2(field, decodeRfc3986V2(pair[1])));
  }
  for (const field of action.transport.fields) {
    if (field.channel.kind === "path_parameter") {
      if (!ownV2(captures, field.channel.name)) throw new RuntimeFailureV2("input_validation", "Missing path parameter");
      defineV2(values, field.fieldName, decodeTextV2(field, decodeRfc3986V2(captures[field.channel.name])));
    }
  }
  const bodyFields = action.transport.fields.filter((field: any) => field.channel.kind === "json_body_pointer");
  for (const field of bodyFields) {
    const value = readPointerV2(body, field.channel.pointer);
    if (value === undefined) throw new RuntimeFailureV2("input_validation", "Missing body field " + field.fieldName);
    validateValueV2(field, value);
    defineV2(values, field.fieldName, cloneV2(value));
  }
  const expectedBody = bodyFields.length === 0 ? null : documentV2(bodyFields.map((field: any) => ({
    pointer: field.channel.pointer,
    value: values[field.fieldName],
  })));
  if (bodyFields.length === 0 ? body !== undefined && body !== null : !deepEqualV2(body, expectedBody)) {
    throw new RuntimeFailureV2("input_validation", "Body field closure mismatch");
  }
  return values;
}

export const setfarmHttpHandlerV2: RequestHandler = (request, response, next): void => {
  let action: any;
  try {
    const parts = rawRequestPartsV2(request.originalUrl || request.url);
    let captures: JsonRecordV2 | null = null;
    for (const candidate of PROGRAM_V2.actions) {
      if (candidate.transport.method !== request.method) continue;
      const matched = routeCapturesV2(candidate.transport.routeTemplate, parts.path);
      if (matched === null) continue;
      action = candidate;
      captures = matched;
      break;
    }
    if (!action || captures === null) {
      next();
      return;
    }
    const inputs = httpInputsV2(action, captures, parts.query, request.body);
    const result = executeActionV2(action, inputs);
    response.status(action.transport.result.successStatusCodes[0]).json(result);
  } catch (error) {
    if (!action) {
      next(error);
      return;
    }
    const kind: RuntimeFailureKindV2 = error instanceof RuntimeFailureV2 ? error.kind : "action_failure";
    const message = error instanceof Error ? error.message : "Action failed";
    const failure = failureForV2(action, kind, message);
    response.status(failure.code).json(failure.body);
  }
};
`;

type SourceMemberDraftV2 = Omit<
  NodeProductRuntimeGeneratedMemberBindingV2,
  "sourceSpan"
>;

function sourceMembersV2(
  realizationPlan: Readonly<SemanticRealizationPlanV2>,
): readonly SourceMemberDraftV2[] {
  return Object.freeze(realizationPlan.realizations.flatMap((realization) =>
    realization.target.kind === "node_product_runtime_generator_member"
      ? [Object.freeze({
          realizationRef: realization.realizationRef,
          realizationHash: realization.realizationHash,
          intentRef: realization.sourceIntent.intentRef,
          intentHash: realization.sourceIntent.intentHash,
          subjectKind: realization.sourceIntent.subjectKind,
          subjectRef: realization.sourceIntent.subjectRef,
          subjectHash: realization.sourceIntent.subjectHash,
          responsibility: realization.sourceIntent.responsibility,
          storyId: realization.sourceIntent.storyId,
          memberKind: realization.target.memberKind,
          generatedSymbolRef:
            deriveNodeProductRuntimeGeneratedMemberSymbolRefV2({
              realizationRef: realization.realizationRef,
              realizationHash: realization.realizationHash,
              memberKind: realization.target.memberKind,
            }),
        })]
      : []).sort((left, right) =>
    compareUtf16(left.realizationRef, right.realizationRef)));
}

function runtimeBehaviorSourceCoverageV2(
  contract: Readonly<ProductRuntimeBehaviorContractV1>,
): Readonly<{
  runtimeAssertions: readonly RuntimeBehaviorAssertionSourceBindingV2[];
  entityFieldBindings: readonly RuntimeBehaviorEntityFieldSourceBindingV2[];
}> {
  const runtimeAssertions = contract.invariantBindings.flatMap((binding) =>
    binding.disposition.kind === "runtime_assertions"
      ? binding.disposition.assertions.map((assertion) => Object.freeze({
          invariantRef: binding.invariantRef,
          assertionRef: assertion.assertionRef,
          assertionHash: assertion.assertionHash,
          stateRef: binding.stateRef,
        }))
      : []).sort((left, right) => compareUtf16(left.assertionRef, right.assertionRef));
  const entityFieldBindings = contract.entityFieldBindings.map((binding) =>
    Object.freeze({
      occurrenceRef: binding.occurrenceRef,
      snapshotBindingHash: binding.snapshotBindingHash,
      actionRef: binding.actionRef,
      deltaOrdinal: binding.deltaOrdinal,
      entityRef: binding.entityRef,
      fieldRef: binding.fieldRef,
    })).sort((left, right) => compareUtf16(left.occurrenceRef, right.occurrenceRef));
  if (
    runtimeAssertions.length !== contract.coverage.runtimeAssertionCount
    || entityFieldBindings.length !== contract.coverage.entityFieldBindingCount
  ) {
    throw new Error("Runtime behavior source coverage differs from verified contract counts");
  }
  return Object.freeze({
    runtimeAssertions: Object.freeze(runtimeAssertions),
    entityFieldBindings: Object.freeze(entityFieldBindings),
  });
}

function generatedSourceV2(
  program: RuntimeProgramV2,
  memberDrafts: readonly SourceMemberDraftV2[],
): Readonly<{
  sourceText: string;
  members: readonly NodeProductRuntimeGeneratedMemberBindingV2[];
}> {
  const lines = [
    "/* Code-owned Setfarm NodeProductRuntimeGeneratorV2 output. */",
    "/* Model writes and semantic auxiliary source files are forbidden. */",
  ];
  const spans = new Map<string, Readonly<{
    markerLine: number;
    startByte: number;
    endByteExclusive: number;
    markerHash: string;
  }>>();
  let byteOffset = Buffer.byteLength(`${lines.join("\n")}\n`, "utf8");
  memberDrafts.forEach((member) => {
    const marker = `// @setfarm-realization-v2 ${member.generatedSymbolRef} ${member.realizationRef} ${member.realizationHash} ${member.memberKind}`;
    const markerBytes = Buffer.byteLength(marker, "utf8");
    lines.push(marker);
    spans.set(member.realizationRef, Object.freeze({
      markerLine: lines.length,
      startByte: byteOffset,
      endByteExclusive: byteOffset + markerBytes,
      markerHash: rawSha256(marker),
    }));
    byteOffset += markerBytes + 1;
  });
  const programJson = canonicalJsonStringify(program);
  lines.push(`const PROGRAM_JSON_V2 = ${JSON.stringify(programJson)};`);
  const sourceText = `${lines.join("\n")}\n${COMMON_RUNTIME_SOURCE_V2}${
    program.profileId === "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
      ? CLI_RUNTIME_SOURCE_V2
      : API_RUNTIME_SOURCE_V2
  }`;
  const members = memberDrafts.map((member) => Object.freeze({
    ...member,
    sourceSpan: spans.get(member.realizationRef)!,
  }));
  return Object.freeze({ sourceText, members: Object.freeze(members) });
}

function exactRuntimeTargetV2(fileTree: Readonly<FileTreeManifestV3>) {
  const targets = fileTree.paths.filter((entry) =>
    entry.authority.kind === "generated_runtime_source_target");
  if (targets.length !== 1) {
    throw new Error("FileTreeV3 must contain one exact runtime source target");
  }
  return targets[0]!;
}

function assertAuthorityJoinsV2(input: Readonly<{
  productSpec: ProductSpecV2;
  deliverySelectionHash: string;
  runtimeBehaviorContract: Readonly<ProductRuntimeBehaviorContractV1>;
  realizationPlan: Readonly<SemanticRealizationPlanV2>;
  fileTree: Readonly<FileTreeManifestV3>;
  buildTopology: Readonly<BuildTopologyV3>;
  transportSet: Readonly<InvocationInputTransportSetV2>;
}>): void {
  const runtimeTarget = exactRuntimeTargetV2(input.fileTree);
  if (runtimeTarget.authority.kind !== "generated_runtime_source_target") {
    throw new Error("Runtime source target authority kind changed");
  }
  const members = sourceMembersV2(input.realizationPlan);
  const projectedBindings = members.map((member) => ({
    realizationRef: member.realizationRef,
    realizationHash: member.realizationHash,
    intentRef: member.intentRef,
    intentHash: member.intentHash,
    subjectKind: member.subjectKind,
    subjectRef: member.subjectRef,
    subjectHash: member.subjectHash,
    responsibility: member.responsibility,
    storyId: member.storyId,
    memberKind: member.memberKind,
  }));
  const runtimeBuildPath = input.buildTopology.paths.find((entry) =>
    entry.pathRef === runtimeTarget.pathRef);
  const joins = [
    ["behavior_product_spec", input.runtimeBehaviorContract.authority.productSpecHash
      === input.realizationPlan.authority.productSpecHash],
    ["behavior_proposal", input.runtimeBehaviorContract.authority.proposalHash
      === input.realizationPlan.authority.runtimeBehavior.proposalHash],
    ["behavior_contract", input.runtimeBehaviorContract.contractHash
      === input.realizationPlan.authority.runtimeBehavior.contractHash],
    ["behavior_evaluator",
      input.runtimeBehaviorContract.authority.evaluatorContractHash
        === input.realizationPlan.authority.runtimeBehavior.evaluatorContractHash],
    ["realization_product_spec", input.realizationPlan.authority.productSpecHash
      === input.buildTopology.authority.productSpecHash],
    ["realization_delivery", input.realizationPlan.authority.deliverySelectionHash
      === input.deliverySelectionHash],
    ["file_tree_product_spec", input.fileTree.authority.productSpecHash
      === input.buildTopology.authority.productSpecHash],
    ["file_tree_delivery", input.fileTree.authority.deliverySelectionHash
      === input.deliverySelectionHash],
    ["file_tree_realization_plan",
      input.fileTree.authority.semanticRealizationPlan.planHash
        === input.realizationPlan.planHash],
    ["file_tree_behavior_proposal",
      input.fileTree.authority.semanticRealizationPlan.runtimeBehaviorProposalHash
        === input.realizationPlan.authority.runtimeBehavior.proposalHash],
    ["file_tree_behavior_contract",
      input.fileTree.authority.semanticRealizationPlan.runtimeBehaviorContractHash
        === input.realizationPlan.authority.runtimeBehavior.contractHash],
    ["topology_file_tree", input.buildTopology.authority.fileTree.manifestHash
      === input.fileTree.manifestHash],
    ["topology_behavior_proposal",
      input.buildTopology.authority.fileTree.runtimeBehaviorProposalHash
        === input.realizationPlan.authority.runtimeBehavior.proposalHash],
    ["topology_behavior_contract",
      input.buildTopology.authority.fileTree.runtimeBehaviorContractHash
        === input.realizationPlan.authority.runtimeBehavior.contractHash],
    ["transport_product_spec", input.transportSet.productSpecHash
      === input.buildTopology.authority.productSpecHash],
    ["transport_delivery", input.transportSet.deliverySelectionHash
      === input.deliverySelectionHash],
    ["transport_action_count", input.transportSet.contractCount
      === input.productSpec.actions.length],
    ["runtime_realization_count",
      runtimeTarget.authority.realizationBindingCount === members.length],
    ["runtime_realization_bindings",
      canonicalJsonStringify(runtimeTarget.authority.realizationBindings)
        === canonicalJsonStringify(projectedBindings)],
    ["runtime_realization_membership",
      runtimeTarget.authority.realizationBindingMembershipHash
        === hashFileTreeRuntimeBindingMembershipV3(projectedBindings)],
    ["topology_runtime_path_present", runtimeBuildPath !== undefined],
    ["topology_runtime_entry_hash",
      runtimeBuildPath?.authority.kind === "file_tree_v3_path"
      && runtimeBuildPath.authority.fileTreeEntryHash === runtimeTarget.entryHash],
    ["topology_runtime_projection_state",
      runtimeBuildPath?.currentState.state === "file_tree_v3_projection"],
    ["topology_runtime_projection_absence",
      runtimeBuildPath?.currentState.state === "file_tree_v3_projection"
      && runtimeBuildPath.currentState.projectedState === "absent"],
    ["compilation_runtime_path",
      input.buildTopology.compilation.runtime.sourcePathRef
        === runtimeTarget.pathRef],
    ["compilation_runtime_locator",
      input.buildTopology.compilation.runtime.sourceNormalizedLocator
        === runtimeTarget.normalizedLocator],
  ] as const;
  const failedJoins = joins.filter(([, joined]) => !joined).map(([name]) => name);
  if (failedJoins.length > 0) {
    throw new Error(
      `ProductSpec, transport, realization, FileTreeV3 and BuildTopologyV3 authority do not join exactly: ${failedJoins.join(",")}`,
    );
  }
}

async function generateInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<NodeProductRuntimeSourceGenerationResultV2> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      INPUT_MAX_CANONICAL_BYTES_V2,
      INPUT_BOUNDED_WORK_LIMITS_V2,
    );
  } catch (error) {
    return singleRejected(
      "NODE_RUNTIME_SOURCE_V2_INPUT_INVALID",
      "/",
      errorMessage(error),
    );
  }
  const parsed = GeneratorInputV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    return singleRejected(
      "NODE_RUNTIME_SOURCE_V2_INPUT_INVALID",
      `/${parsed.error.issues[0]?.path.map(String).join("/") ?? ""}`
        .replace(/\/$/u, "") || "/",
      parsed.error.issues[0]?.message ?? "Runtime-source generator input is invalid",
    );
  }
  if (
    expectedScope === "production_host"
    && !isProductionNodeScaffoldPrivateStageV2(handle)
  ) {
    return singleRejected(
      "NODE_RUNTIME_SOURCE_V2_PRODUCTION_AUTHORITY_REQUIRED",
      "/stage",
      "Production runtime-source generation requires production private-stage authority",
    );
  }
  if (
    expectedScope === "test_fixture"
    && isProductionNodeScaffoldPrivateStageV2(handle)
  ) {
    return singleRejected(
      "NODE_RUNTIME_SOURCE_V2_INPUT_INVALID",
      "/stage",
      "Test runtime-source generation cannot consume or downgrade production authority",
    );
  }

  const productSpecResult = ProductSpecV2Schema.safeParse(parsed.data.productSpec);
  if (!productSpecResult.success) {
    return singleRejected(
      "NODE_RUNTIME_SOURCE_V2_INPUT_INVALID",
      `/productSpec/${productSpecResult.error.issues[0]?.path.join("/") ?? ""}`
        .replace(/\/$/u, ""),
      productSpecResult.error.issues[0]?.message ?? "ProductSpecV2 is invalid",
    );
  }
  const productSpec = productSpecResult.data;
  const unsupportedDiagnostics = unsupportedBehaviorDiagnosticsV2(productSpec);
  if (unsupportedDiagnostics.length > 0) return rejected(unsupportedDiagnostics);

  try {
    const verifiedBehaviorContract = verifyProductRuntimeBehaviorContractV1({
      productSpec,
      proposal: parsed.data.runtimeBehaviorProposal,
      candidate: parsed.data.runtimeBehaviorContract,
    });
    const selection = verifyProductDeliverySelectionV2({
      productSpec,
      requestedStackPackId: parsed.data.deliverySelection
        && typeof parsed.data.deliverySelection === "object"
        && "requestedStackPackId" in parsed.data.deliverySelection
        ? (parsed.data.deliverySelection as { requestedStackPackId: unknown })
          .requestedStackPackId
        : undefined,
      candidate: parsed.data.deliverySelection,
    });
    const deliverySelectionHash = hashProductDeliverySelectionV2(selection);
    const verifiedPlan = verifySemanticRealizationPlanV2({
      productSpec,
      deliverySelection: selection,
      runtimeBehaviorProposal: parsed.data.runtimeBehaviorProposal,
      runtimeBehaviorContract: parsed.data.runtimeBehaviorContract,
      candidate: parsed.data.realizationPlan,
    });
    const verifiedTopology = expectedScope === "production_host"
      ? await verifyBuildTopologyV3(handle, {
          productSpec,
          deliverySelection: selection,
          runtimeBehaviorProposal: parsed.data.runtimeBehaviorProposal,
          runtimeBehaviorContract: parsed.data.runtimeBehaviorContract,
          fileTree: parsed.data.fileTree,
          candidate: parsed.data.buildTopology,
        })
      : await verifyBuildTopologyV3ForTest(handle, {
          productSpec,
          deliverySelection: selection,
          runtimeBehaviorProposal: parsed.data.runtimeBehaviorProposal,
          runtimeBehaviorContract: parsed.data.runtimeBehaviorContract,
          fileTree: parsed.data.fileTree,
          candidate: parsed.data.buildTopology,
        });
    const fileTree = FileTreeManifestV3Schema.parse(parsed.data.fileTree);
    const transportResult = compileInvocationInputTransportSetV2({
      productSpec,
      deliverySelection: selection,
    });
    if (transportResult.status !== "shadow_compiled") {
      return singleRejected(
        "NODE_RUNTIME_SOURCE_V2_TRANSPORT_REJECTED",
        transportResult.diagnostics[0]?.path ?? "/",
        transportResult.diagnostics[0]?.message
          ?? "Fresh invocation transport compilation was rejected",
      );
    }
    assertAuthorityJoinsV2({
      productSpec,
      deliverySelectionHash,
      runtimeBehaviorContract: verifiedBehaviorContract,
      realizationPlan: verifiedPlan.value,
      fileTree,
      buildTopology: verifiedTopology.value,
      transportSet: transportResult.contractSet,
    });

    const program = buildRuntimeProgramV2(
      productSpec,
      verifiedBehaviorContract,
      transportResult.contractSet,
      selection.profileId,
    );
    const runtimeProgramHash = hashCanonicalJson({
      schema: "setfarm.node-product-runtime-program-hash.v2",
      program,
    });
    const memberDrafts = sourceMembersV2(verifiedPlan.value);
    const runtimeBehaviorCoverage = runtimeBehaviorSourceCoverageV2(
      verifiedBehaviorContract,
    );
    const generated = generatedSourceV2(program, memberDrafts);
    const sourceBytes = Buffer.from(generated.sourceText, "utf8");
    if (
      sourceBytes.byteLength > NODE_PRODUCT_RUNTIME_SOURCE_MAX_BYTES_V2
      || !generated.sourceText.endsWith("\n")
      || generated.sourceText.includes("\r")
      || generated.sourceText.includes("\0")
    ) {
      return singleRejected(
        "NODE_RUNTIME_SOURCE_V2_OUTPUT_LIMIT_EXCEEDED",
        "/sourceText",
        "Generated runtime source violates byte, UTF-8 or LF-only bounds",
      );
    }
    for (const member of generated.members) {
      const markerBytes = sourceBytes.subarray(
        member.sourceSpan.startByte,
        member.sourceSpan.endByteExclusive,
      );
      if (rawSha256(markerBytes) !== member.sourceSpan.markerHash) {
        throw new Error(`Generated member marker drifted for ${member.realizationRef}`);
      }
    }
    const runtimeTarget = exactRuntimeTargetV2(fileTree);
    if (runtimeTarget.authority.kind !== "generated_runtime_source_target") {
      throw new Error("Runtime target authority changed after verification");
    }
    const profile = NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2.profiles.find(
      (candidate) => candidate.profileId === selection.profileId,
    );
    if (!profile) throw new Error("Runtime generator profile is absent");
    const normalizedLocator = selection.profileId
      === "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
      ? "src/cli.ts" as const
      : "src/app.ts" as const;
    if (runtimeTarget.normalizedLocator !== normalizedLocator) {
      throw new Error("Runtime source locator differs from the exact generator profile");
    }
    const sourceWithoutHash = {
      pathRef: runtimeTarget.pathRef,
      normalizedLocator,
      mediaType: "text/typescript" as const,
      encoding: "utf-8" as const,
      newline: "lf" as const,
      finalNewline: true as const,
      moduleSystem: "node_esm" as const,
      contentHash: rawSha256(sourceBytes),
      byteLength: sourceBytes.byteLength,
      lineCount: generated.sourceText.split("\n").length - 1,
      runtimeProgramHash,
    };
    const source = Object.freeze({
      ...sourceWithoutHash,
      sourceIdentityHash: hashNodeProductRuntimeSourceIdentityV2(
        sourceWithoutHash,
      ),
    });
    const logicalIdentity: NodeProductRuntimeSourceReceiptLogicalIdentityV2 = {
      schema: NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA,
      receiptVersion: "2.0.0",
      readiness: {
        status: "shadow_generated",
        productionUse: "forbidden",
      },
      authority: {
        productRef: productSpec.product.id,
        productSpecHash: selection.productSpecHash,
        deliverySelectionHash,
        profileId: selection.profileId,
        stackPackId: selection.requestedStackPackId,
        generatorRef: "NODE_PRODUCT_RUNTIME_GENERATOR_V2",
        generatorContractHash: NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2,
        generatorProfileHash: hashNodeProductRuntimeGeneratorProfileV2(profile),
        runtimeProgramContractHash:
          NODE_PRODUCT_RUNTIME_PROGRAM_CONTRACT_HASH_V2,
        invocationTransportSet: {
          schema: "setfarm.invocation-input-transport-set.v2",
          contractSetHash: transportResult.contractSetHash,
          membershipHash: transportResult.membershipHash,
          contractCount: transportResult.contractSet.contractCount,
        },
        runtimeBehavior: {
          proposalHash: verifiedBehaviorContract.authority.proposalHash,
          contractHash: verifiedBehaviorContract.contractHash,
          evaluatorContractHash:
            verifiedBehaviorContract.authority.evaluatorContractHash,
        },
        semanticRealizationPlan: {
          schema: "setfarm.semantic-realization-plan.v2",
          planHash: verifiedPlan.value.planHash,
          realizationMembershipHash:
            verifiedPlan.value.realizationMembershipHash,
          generatorMemberCount:
            verifiedPlan.value.coverage.generatorMemberCount,
        },
        fileTree: {
          schema: "setfarm.file-tree-manifest.v3",
          manifestHash: fileTree.manifestHash,
          runtimePathEntryHash: runtimeTarget.entryHash,
          runtimeRealizationMembershipHash:
            runtimeTarget.authority.realizationBindingMembershipHash,
        },
        buildTopology: {
          schema: "setfarm.build-topology.v3",
          logicalBuildHash: verifiedTopology.value.logicalBuildHash,
          compilationContractHash:
            verifiedTopology.value.authority.compilationContractHash,
        },
      },
      source,
      coverage: {
        generatorMemberCount: generated.members.length,
        members: [...generated.members],
        realizationBindingMembershipHash:
          hashFileTreeRuntimeBindingMembershipV3(generated.members.map((member) => ({
            realizationRef: member.realizationRef,
            realizationHash: member.realizationHash,
            intentRef: member.intentRef,
            intentHash: member.intentHash,
            subjectKind: member.subjectKind,
            subjectRef: member.subjectRef,
            subjectHash: member.subjectHash,
            responsibility: member.responsibility,
            storyId: member.storyId,
            memberKind: member.memberKind,
          }))),
        generatedMemberMembershipHash:
          hashNodeProductRuntimeGeneratedMemberMembershipV2(generated.members),
        opaqueBehaviorCount: 0,
        runtimeBehavior: {
          contractHash: verifiedBehaviorContract.contractHash,
          runtimeAssertionCount:
            runtimeBehaviorCoverage.runtimeAssertions.length,
          runtimeAssertions: [...runtimeBehaviorCoverage.runtimeAssertions],
          runtimeAssertionMembershipHash:
            hashRuntimeBehaviorAssertionSourceMembershipV2(
              runtimeBehaviorCoverage.runtimeAssertions,
            ),
          entityFieldBindingCount:
            runtimeBehaviorCoverage.entityFieldBindings.length,
          entityFieldBindings: [...runtimeBehaviorCoverage.entityFieldBindings],
          entityFieldBindingMembershipHash:
            hashRuntimeBehaviorEntityFieldSourceMembershipV2(
              runtimeBehaviorCoverage.entityFieldBindings,
            ),
          checkpoints: {
            initial: "generated_before_public_runtime_entrypoint",
            afterAction: "generated_before_transaction_commit",
            afterRehydration:
              "not_applicable_selected_profiles_forbid_durable_rehydration",
          },
          failureAbi: {
            invariant:
              "declared_action_failure_with_assertion_ref_message",
            entitySnapshot:
              "declared_action_failure_with_occurrence_ref_message",
          },
          disposition:
            "every_runtime_assertion_and_entity_snapshot_binding_projected_into_hashed_runtime_program",
        },
        disposition:
          "every_generator_realization_bound_to_exact_generated_source_marker",
      },
    };
    const receiptWithoutHash: NodeProductRuntimeSourceReceiptHashPayloadV2 = {
      ...logicalIdentity,
      logicalReceiptHash:
        hashNodeProductRuntimeSourceLogicalReceiptV2(logicalIdentity),
      operationalEvidence: {
        admissionScope: verifiedTopology.value.operationalEvidence.admissionScope,
        buildTopologyManifestHash: verifiedTopology.value.manifestHash,
        evidenceAuthority:
          "authenticated_private_dependency_stage_fresh_revalidation_v3",
      },
    };
    const receipt = recursivelyFreezeNodeProductRuntimeSourceV2(
      NodeProductRuntimeSourceReceiptV2Schema.parse({
        ...receiptWithoutHash,
        receiptHash: hashNodeProductRuntimeSourceReceiptV2(receiptWithoutHash),
      }),
    );
    return recursivelyFreezeNodeProductRuntimeSourceV2({
      status: "shadow_generated" as const,
      diagnostics: EMPTY_DIAGNOSTICS,
      sourceText: generated.sourceText,
      sourceContentHash: source.contentHash,
      runtimeProgramHash,
      receipt,
      canonicalReceiptBytes: canonicalJsonStringify(receipt),
    });
  } catch (error) {
    return singleRejected(
      error instanceof BuildTopologyVerificationErrorV3
        ? "NODE_RUNTIME_SOURCE_V2_BUILD_TOPOLOGY_REJECTED"
        : error instanceof SemanticRealizationPlanVerificationErrorV2
          ? "NODE_RUNTIME_SOURCE_V2_REALIZATION_PLAN_REJECTED"
          : "NODE_RUNTIME_SOURCE_V2_UPSTREAM_AUTHORITY_MISMATCH",
      "/",
      errorMessage(error),
    );
  }
}

export function generateNodeProductRuntimeSourceV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<NodeProductRuntimeSourceGenerationResultV2> {
  return generateInternalV2(handle, input, "production_host");
}

export function generateNodeProductRuntimeSourceV2ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<NodeProductRuntimeSourceGenerationResultV2> {
  return generateInternalV2(handle, input, "test_fixture");
}

export type NodeProductRuntimeSourceVerificationErrorCodeV2 =
  | "NODE_RUNTIME_SOURCE_V2_VERIFICATION_AUTHORITY_MISMATCH"
  | "NODE_RUNTIME_SOURCE_V2_VERIFICATION_CANDIDATE_INVALID"
  | "NODE_RUNTIME_SOURCE_V2_VERIFICATION_INPUT_INVALID"
  | "NODE_RUNTIME_SOURCE_V2_VERIFICATION_REPRODUCTION_REJECTED";

export class NodeProductRuntimeSourceVerificationErrorV2 extends Error {
  readonly code: NodeProductRuntimeSourceVerificationErrorCodeV2;

  constructor(
    code: NodeProductRuntimeSourceVerificationErrorCodeV2,
    message: string,
  ) {
    super(message.slice(0, 1_500));
    this.name = "NodeProductRuntimeSourceVerificationErrorV2";
    this.code = code;
  }
}

export type VerifiedShadowNodeProductRuntimeSourceV2 = Readonly<{
  status: "verified_shadow";
  sourceText: string;
  receipt: Readonly<NodeProductRuntimeSourceReceiptV2>;
  canonicalReceiptBytes: string;
}>;

async function verifyInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<VerifiedShadowNodeProductRuntimeSourceV2> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2,
      VERIFIER_BOUNDED_WORK_LIMITS_V2,
    );
  } catch (error) {
    throw new NodeProductRuntimeSourceVerificationErrorV2(
      "NODE_RUNTIME_SOURCE_V2_VERIFICATION_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const parsed = VerifierInputV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    throw new NodeProductRuntimeSourceVerificationErrorV2(
      "NODE_RUNTIME_SOURCE_V2_VERIFICATION_INPUT_INVALID",
      parsed.error.issues[0]?.message ?? "Runtime-source verifier input is invalid",
    );
  }
  const candidateReceipt = NodeProductRuntimeSourceReceiptV2Schema.safeParse(
    parsed.data.candidateReceipt,
  );
  if (!candidateReceipt.success) {
    throw new NodeProductRuntimeSourceVerificationErrorV2(
      "NODE_RUNTIME_SOURCE_V2_VERIFICATION_CANDIDATE_INVALID",
      candidateReceipt.error.issues[0]?.message
        ?? "Runtime-source receipt candidate is invalid",
    );
  }
  const reproduced = await generateInternalV2(handle, {
    productSpec: parsed.data.productSpec,
    deliverySelection: parsed.data.deliverySelection,
    runtimeBehaviorProposal: parsed.data.runtimeBehaviorProposal,
    runtimeBehaviorContract: parsed.data.runtimeBehaviorContract,
    realizationPlan: parsed.data.realizationPlan,
    fileTree: parsed.data.fileTree,
    buildTopology: parsed.data.buildTopology,
  }, expectedScope);
  if (reproduced.status !== "shadow_generated") {
    throw new NodeProductRuntimeSourceVerificationErrorV2(
      "NODE_RUNTIME_SOURCE_V2_VERIFICATION_REPRODUCTION_REJECTED",
      reproduced.diagnostics[0]?.message
        ?? "Fresh runtime-source reproduction was rejected",
    );
  }
  if (
    parsed.data.candidateSourceText !== reproduced.sourceText
    || canonicalJsonStringify(candidateReceipt.data)
      !== reproduced.canonicalReceiptBytes
  ) {
    throw new NodeProductRuntimeSourceVerificationErrorV2(
      "NODE_RUNTIME_SOURCE_V2_VERIFICATION_AUTHORITY_MISMATCH",
      "Runtime source or receipt differs from fresh ProductSpec, transport, realization and topology authority",
    );
  }
  return recursivelyFreezeNodeProductRuntimeSourceV2({
    status: "verified_shadow" as const,
    sourceText: reproduced.sourceText,
    receipt: reproduced.receipt,
    canonicalReceiptBytes: reproduced.canonicalReceiptBytes,
  });
}

export function verifyNodeProductRuntimeSourceV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedShadowNodeProductRuntimeSourceV2> {
  return verifyInternalV2(handle, input, "production_host");
}

export function verifyNodeProductRuntimeSourceV2ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedShadowNodeProductRuntimeSourceV2> {
  return verifyInternalV2(handle, input, "test_fixture");
}

import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
  type CanonicalJsonBoundedLimits,
} from "./bounded-canonical-json.js";
import { canonicalJsonStringify } from "./canonical-json.js";
import {
  resolveNodeExecutionLayoutV2,
} from "./node-execution-layout-catalog-v2.js";
import {
  NodeExecutionLayoutV2Schema,
  hashNodeExecutionPathSlotSetV2,
  type NodeExecutionLayoutV2,
} from "./schemas/node-execution-layout-catalog-v2.js";
import {
  NODE_EXECUTION_PATH_TOKEN_SET_V2_SCHEMA,
  PATH_CONSUMER_BINDING_V2_SCHEMA,
  PATH_ROOT_BINDING_V2_SCHEMA,
  PATH_TOKEN_CONTRACT_HASH_V2,
  PATH_TOKEN_CONTRACT_V2,
  PATH_TOKEN_CONTRACT_VERSION_V2,
  PATH_TOKEN_SET_BLOCKER_CODES_V2,
  PATH_TOKEN_SET_MAX_CANONICAL_BYTES_V2,
  PATH_TOKEN_SET_VERSION_V2,
  PATH_TOKEN_V2_SCHEMA,
  NodeExecutionPathTokenSetV2Schema,
  PathRootBindingV2Schema,
  PathConsumerBindingV2Schema,
  PathTokenV2Schema,
  asciiCaseFoldPathV2,
  hashNodeExecutionPathTokenSetV2,
  hashPathRootBindingV2,
  hashPathRootMembershipV2,
  hashPathConsumerBindingV2,
  hashPathConsumerMembershipV2,
  hashPathTokenBindingV2,
  hashPathTokenMembershipV2,
  hashPathTokenOriginV2,
  hashPortablePathCaseFoldIdentityV2,
  hashPortablePathIdentityV2,
  isPathContainedByRootV2,
  portablePathIssuesV2,
  recursivelyFreezePathTokenSetV2,
  type NodeExecutionPathTokenSetV2,
  type PathConsumerBindingHashPayloadV2,
  type PathConsumerBindingV2,
  type PathRootBindingHashPayloadV2,
  type PathRootBindingV2,
  type PathTokenBindingHashPayloadV2,
  type PathTokenV2,
} from "./schemas/path-token-v2.js";

const COMPILER_INPUT_MAX_BYTES = 8 * 1024 * 1024;
const CLOSURE_INPUT_MAX_BYTES = 1024 * 1024;
const VERIFIER_INPUT_MAX_BYTES = 9 * 1024 * 1024;
const MAX_DIAGNOSTICS = 100;
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

const COMPILER_BOUNDED_WORK_LIMITS = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 4,
  maxNodes: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxNodes + 16_384,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxWorkUnits + (2 * 1024 * 1024),
});

const VERIFIER_BOUNDED_WORK_LIMITS = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 8,
  maxNodes:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxNodes
    + PATH_TOKEN_SET_MAX_CANONICAL_BYTES_V2
    + 8_192,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxWorkUnits
    + (PATH_TOKEN_SET_MAX_CANONICAL_BYTES_V2 * 8)
    + (2 * 1024 * 1024),
});

const EXPECTED_PATH_TOKEN_CONTRACT_HASH_V2 =
  "7721d9bd64f6d989d9ec84a5ed9ff457a53cae09ed9c56a927431729ce8efca6";

const EXPECTED_NODE_EXECUTION_PATH_TOKEN_SET_IDENTITIES_V2 = Object.freeze([
  Object.freeze({
    slotSetHash: "519c28c28125c0705234d251952445d465cfe5f0306cf01231a9bd5984992bd3",
    rootCount: 4,
    tokenCount: 6,
    consumerBindingCount: 20,
    rootMembershipHash: "4dce3320599b0ceb5ef7eecbb4029e0c642f8161f530fe5eed399797f830fab1",
    tokenMembershipHash: "c25b499c851a66ef44a4a607eb9b424c8d06d5043ac56d3eb132926ad60189b3",
    consumerMembershipHash: "0cae856c4eb0fc4478338cf31d86d939a3906b09ab4bcd91c0f5cf56c3a6aba2",
    tokenSetHash: "2d0c83f1f10247cf3a45e0248831a15af3786c891a0250c3a015a449503c9209",
  }),
  Object.freeze({
    slotSetHash: "65709b7c8d55d098d3e1e13dcc8cebd419c826fc4523c68c53a2ebe4dc650426",
    rootCount: 4,
    tokenCount: 7,
    consumerBindingCount: 22,
    rootMembershipHash: "4dce3320599b0ceb5ef7eecbb4029e0c642f8161f530fe5eed399797f830fab1",
    tokenMembershipHash: "429335392411ad8ea80846490ec82505a241cecbff45e4edc33dc248451041ca",
    consumerMembershipHash: "af4c43dfdaa00985162ceb9017b1fab091c8ef85993f17546dd48661d28b87a8",
    tokenSetHash: "b019e4e5eea594e64ee229d901a81055c884b039979e309155777234891ffcdc",
  }),
]);

function boundedSnapshot(
  value: unknown,
  maxBytes: number,
  workLimits: Omit<CanonicalJsonBoundedLimits, "maxBytes"> =
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
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

function requireContractAuthority(): void {
  if (PATH_TOKEN_CONTRACT_HASH_V2 === EXPECTED_PATH_TOKEN_CONTRACT_HASH_V2) return;
  throw new PathTokenCodeAuthorityErrorV2(
    "PathTokenV2 contract changed without an intentional version/hash transition",
  );
}

function requireTokenSetVersionAuthority(
  value: NodeExecutionPathTokenSetV2,
): void {
  const expected = EXPECTED_NODE_EXECUTION_PATH_TOKEN_SET_IDENTITIES_V2.find(
    (candidate) => candidate.slotSetHash === value.sourceAuthority.slotSetHash,
  );
  const actual = {
    slotSetHash: value.sourceAuthority.slotSetHash,
    rootCount: value.rootCount,
    tokenCount: value.tokenCount,
    consumerBindingCount: value.consumerBindingCount,
    rootMembershipHash: value.rootMembershipHash,
    tokenMembershipHash: value.tokenMembershipHash,
    consumerMembershipHash: value.consumerMembershipHash,
    tokenSetHash: value.tokenSetHash,
  };
  if (expected && canonicalJsonStringify(actual) === canonicalJsonStringify(expected)) {
    return;
  }
  throw new PathTokenCodeAuthorityErrorV2(
    "PathTokenV2 set identity changed without an intentional version/hash transition",
  );
}

export class PathTokenCodeAuthorityErrorV2 extends Error {
  readonly code = "PATH_TOKEN_V2_CODE_AUTHORITY_DRIFT" as const;

  constructor(message: string) {
    super(message);
    this.name = "PathTokenCodeAuthorityErrorV2";
  }
}

export function getCodeOwnedPathTokenContractV2(): typeof PATH_TOKEN_CONTRACT_V2 {
  requireContractAuthority();
  return PATH_TOKEN_CONTRACT_V2;
}

const AuthorityRefV2Schema = z.string()
  .min(1)
  .max(200)
  .regex(/^[A-Z][A-Z0-9_]*$/u);
const NamespaceV2Schema = z.string()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9_]*$/u);
const PhysicalSpaceV2Schema = z.string()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9_]*$/u);
const ConsumerPathV2Schema = z.string().min(1).max(500).regex(/^\//u);

const PathClosureRootV2Schema = z.object({
  rootRef: AuthorityRefV2Schema,
  physicalSpace: PhysicalSpaceV2Schema,
  parentRootRef: AuthorityRefV2Schema.nullable(),
  locatorPrefix: z.string().max(1_024),
}).strict();

const PathClosureSlotV2Schema = z.object({
  slotRef: AuthorityRefV2Schema,
  namespace: NamespaceV2Schema,
  disposition: z.enum(["planned", "reject_only"]),
  nodeKind: z.literal("file"),
  locator: z.string().min(1).max(1_024),
  underRootRef: AuthorityRefV2Schema,
}).strict();

const RootConsumerV2Schema = z.object({
  consumerPath: ConsumerPathV2Schema,
  role: z.enum([
    "root_parent",
    "slot_containment",
    "compiler_source_root",
    "compiler_output_root",
    "build_cwd_root",
  ]),
  targetKind: z.literal("root"),
  targetRef: AuthorityRefV2Schema,
  expectedTargetRef: AuthorityRefV2Schema,
  requiredPhysicalSpace: PhysicalSpaceV2Schema,
}).strict();

const SlotConsumerV2Schema = z.object({
  consumerPath: ConsumerPathV2Schema,
  role: z.enum([
    "compiler_package_manifest",
    "compiler_argument",
    "compiler_config",
    "canonical_entrypoint",
    "historical_entrypoint_rejection",
    "source_input",
    "build_output",
    "candidate_module",
    "runtime_module",
  ]),
  targetKind: z.literal("slot"),
  targetRef: AuthorityRefV2Schema,
  expectedTargetRef: AuthorityRefV2Schema,
  requiredNamespace: NamespaceV2Schema,
  requiredDisposition: z.enum(["planned", "reject_only"]),
}).strict();

const PathClosureConsumerV2Schema = z.discriminatedUnion("targetKind", [
  RootConsumerV2Schema,
  SlotConsumerV2Schema,
]);

const PathClosureModelV2Schema = z.object({
  slotSetHash: z.string().regex(/^[a-f0-9]{64}$/u),
  declaredSlotCount: z.number().int().positive().max(4_096),
  roots: z.array(PathClosureRootV2Schema).min(1).max(256),
  slots: z.array(PathClosureSlotV2Schema).min(1).max(4_096),
  consumers: z.array(PathClosureConsumerV2Schema).min(1).max(16_384),
}).strict();

type PathClosureModelV2 = z.infer<typeof PathClosureModelV2Schema>;
type PathClosureConsumerV2 = z.infer<typeof PathClosureConsumerV2Schema>;

export type PathClosureVerificationErrorCodeV2 =
  | "PATH_TOKEN_V2_CLOSURE_INPUT_INVALID"
  | "PATH_TOKEN_V2_SLOT_SET_HASH_MISMATCH"
  | "PATH_TOKEN_V2_ROOT_ORDER_INVALID"
  | "PATH_TOKEN_V2_ROOT_REF_DUPLICATE"
  | "PATH_TOKEN_V2_ROOT_PATH_INVALID"
  | "PATH_TOKEN_V2_ROOT_PARENT_MISSING"
  | "PATH_TOKEN_V2_ROOT_PARENT_CYCLE"
  | "PATH_TOKEN_V2_ROOT_PHYSICAL_SPACE_MISMATCH"
  | "PATH_TOKEN_V2_ROOT_CONTAINMENT_INVALID"
  | "PATH_TOKEN_V2_ROOT_PARENT_NOT_DEEPEST"
  | "PATH_TOKEN_V2_ROOT_COLLISION"
  | "PATH_TOKEN_V2_ROOT_CASE_COLLISION"
  | "PATH_TOKEN_V2_PHYSICAL_SPACE_ANCHOR_INVALID"
  | "PATH_TOKEN_V2_SLOT_COUNT_MISMATCH"
  | "PATH_TOKEN_V2_SLOT_ORDER_INVALID"
  | "PATH_TOKEN_V2_SLOT_REF_DUPLICATE"
  | "PATH_TOKEN_V2_SLOT_PATH_INVALID"
  | "PATH_TOKEN_V2_SLOT_ROOT_MISSING"
  | "PATH_TOKEN_V2_SLOT_CONTAINMENT_INVALID"
  | "PATH_TOKEN_V2_SLOT_ROOT_NOT_DEEPEST"
  | "PATH_TOKEN_V2_EXACT_COLLISION"
  | "PATH_TOKEN_V2_ASCII_CASE_COLLISION"
  | "PATH_TOKEN_V2_DIRECTORY_CASE_COLLISION"
  | "PATH_TOKEN_V2_FILE_ANCESTOR_CONFLICT"
  | "PATH_TOKEN_V2_CONSUMER_ORDER_INVALID"
  | "PATH_TOKEN_V2_CONSUMER_PATH_DUPLICATE"
  | "PATH_TOKEN_V2_CONSUMER_TARGET_MISSING"
  | "PATH_TOKEN_V2_CONSUMER_ROLE_MISMATCH"
  | "PATH_TOKEN_V2_ROLE_DISPOSITION_CONFLICT"
  | "PATH_TOKEN_V2_ORPHAN_SLOT"
  | "PATH_TOKEN_V2_UNKNOWN_CONSUMER_REF";

export class PathClosureVerificationErrorV2 extends Error {
  readonly code: PathClosureVerificationErrorCodeV2;
  readonly path: string;

  constructor(
    code: PathClosureVerificationErrorCodeV2,
    path: string,
    message: string,
  ) {
    super(message.slice(0, 1_000));
    this.name = "PathClosureVerificationErrorV2";
    this.code = code;
    this.path = path.slice(0, 500);
  }
}

function closureFailure(
  code: PathClosureVerificationErrorCodeV2,
  path: string,
  message: string,
): never {
  throw new PathClosureVerificationErrorV2(code, path, message);
}

export type LocallyValidatedPathClosureV2 = Readonly<{
  status: "locally_validated_shadow_closure";
  authority: "none";
  productionUse: "forbidden";
  slotSetHash: string;
  rootCount: number;
  slotCount: number;
  plannedSlotCount: number;
  rejectOnlySlotCount: number;
  consumerCount: number;
}>;

function verifyRootClosure(model: PathClosureModelV2): void {
  const sortedRootRefs = model.roots.map((root) => root.rootRef)
    .sort(compareUtf16);
  if (model.roots.some((root, index) => root.rootRef !== sortedRootRefs[index])) {
    closureFailure(
      "PATH_TOKEN_V2_ROOT_ORDER_INVALID",
      "/roots",
      "roots must be canonically ordered by rootRef",
    );
  }
  const roots = new Map<string, PathClosureModelV2["roots"][number]>();
  const exactPaths = new Set<string>();
  const foldedPaths = new Set<string>();
  const anchorCounts = new Map<string, number>();
  for (let index = 0; index < model.roots.length; index += 1) {
    const root = model.roots[index]!;
    if (roots.has(root.rootRef)) {
      closureFailure(
        "PATH_TOKEN_V2_ROOT_REF_DUPLICATE",
        `/roots/${index}/rootRef`,
        "rootRef must be unique",
      );
    }
    roots.set(root.rootRef, root);
    const issues = portablePathIssuesV2(root.locatorPrefix, { allowEmpty: true });
    if (issues.length > 0) {
      closureFailure(
        "PATH_TOKEN_V2_ROOT_PATH_INVALID",
        `/roots/${index}/locatorPrefix`,
        issues[0]!,
      );
    }
    const exactKey = `${root.physicalSpace}\u0000${root.locatorPrefix}`;
    const foldedKey = `${root.physicalSpace}\u0000${asciiCaseFoldPathV2(root.locatorPrefix)}`;
    if (exactPaths.has(exactKey)) {
      closureFailure(
        "PATH_TOKEN_V2_ROOT_COLLISION",
        `/roots/${index}/locatorPrefix`,
        "root locator collides inside one physical space",
      );
    }
    if (foldedPaths.has(foldedKey)) {
      closureFailure(
        "PATH_TOKEN_V2_ROOT_CASE_COLLISION",
        `/roots/${index}/locatorPrefix`,
        "root locator has an ASCII-casefold collision inside one physical space",
      );
    }
    exactPaths.add(exactKey);
    foldedPaths.add(foldedKey);
    if (root.parentRootRef === null) {
      if (root.locatorPrefix !== "") {
        closureFailure(
          "PATH_TOKEN_V2_PHYSICAL_SPACE_ANCHOR_INVALID",
          `/roots/${index}/locatorPrefix`,
          "parentless physical-space root must use the empty prefix",
        );
      }
      anchorCounts.set(root.physicalSpace, (anchorCounts.get(root.physicalSpace) ?? 0) + 1);
    }
  }
  for (const physicalSpace of new Set(model.roots.map((root) => root.physicalSpace))) {
    if (anchorCounts.get(physicalSpace) !== 1) {
      closureFailure(
        "PATH_TOKEN_V2_PHYSICAL_SPACE_ANCHOR_INVALID",
        "/roots",
        "each physical space must have exactly one empty parentless root",
      );
    }
  }
  for (let index = 0; index < model.roots.length; index += 1) {
    const visited = new Set<string>();
    let current: PathClosureModelV2["roots"][number] | undefined = model.roots[index];
    while (current) {
      if (visited.has(current.rootRef)) {
        closureFailure(
          "PATH_TOKEN_V2_ROOT_PARENT_CYCLE",
          `/roots/${index}/parentRootRef`,
          "root parent graph must be acyclic",
        );
      }
      visited.add(current.rootRef);
      current = current.parentRootRef === null
        ? undefined
        : roots.get(current.parentRootRef);
    }
  }
  for (let index = 0; index < model.roots.length; index += 1) {
    const root = model.roots[index]!;
    if (root.parentRootRef === null) continue;
    const parent = roots.get(root.parentRootRef);
    if (!parent) {
      closureFailure(
        "PATH_TOKEN_V2_ROOT_PARENT_MISSING",
        `/roots/${index}/parentRootRef`,
        "root parent must resolve inside the closure",
      );
    }
    if (parent.physicalSpace !== root.physicalSpace) {
      closureFailure(
        "PATH_TOKEN_V2_ROOT_PHYSICAL_SPACE_MISMATCH",
        `/roots/${index}/parentRootRef`,
        "root and parent must share one physical space",
      );
    }
    if (!isPathContainedByRootV2(root.locatorPrefix, parent.locatorPrefix, false)) {
      closureFailure(
        "PATH_TOKEN_V2_ROOT_CONTAINMENT_INVALID",
        `/roots/${index}/locatorPrefix`,
        "root prefix must be a strict segment-boundary descendant of its parent",
      );
    }
    const containingRoots = model.roots.filter((candidate) =>
      candidate.rootRef !== root.rootRef
      && candidate.physicalSpace === root.physicalSpace
      && isPathContainedByRootV2(root.locatorPrefix, candidate.locatorPrefix, false));
    const foldedContainingRoots = model.roots.filter((candidate) =>
      candidate.rootRef !== root.rootRef
      && candidate.physicalSpace === root.physicalSpace
      && isPathContainedByRootV2(
        asciiCaseFoldPathV2(root.locatorPrefix),
        asciiCaseFoldPathV2(candidate.locatorPrefix),
        false,
      ));
    if (
      canonicalJsonStringify(containingRoots.map((candidate) => candidate.rootRef).sort())
      !== canonicalJsonStringify(
        foldedContainingRoots.map((candidate) => candidate.rootRef).sort(),
      )
    ) {
      closureFailure(
        "PATH_TOKEN_V2_ROOT_CASE_COLLISION",
        `/roots/${index}/locatorPrefix`,
        "root ancestry must not change under ASCII case folding",
      );
    }
    const deepestPrefixLength = containingRoots.reduce(
      (deepest, candidate) => Math.max(deepest, candidate.locatorPrefix.length),
      -1,
    );
    if (parent.locatorPrefix.length !== deepestPrefixLength) {
      closureFailure(
        "PATH_TOKEN_V2_ROOT_PARENT_NOT_DEEPEST",
        `/roots/${index}/parentRootRef`,
        "root parent must be the deepest declared containing root",
      );
    }
  }
}

function verifySlotClosure(model: PathClosureModelV2): void {
  if (model.declaredSlotCount !== model.slots.length) {
    closureFailure(
      "PATH_TOKEN_V2_SLOT_COUNT_MISMATCH",
      "/declaredSlotCount",
      "declared slot count must equal the complete flattened slot set",
    );
  }
  const sortedSlotRefs = model.slots.map((slot) => slot.slotRef)
    .sort(compareUtf16);
  if (model.slots.some((slot, index) => slot.slotRef !== sortedSlotRefs[index])) {
    closureFailure(
      "PATH_TOKEN_V2_SLOT_ORDER_INVALID",
      "/slots",
      "slots must be canonically ordered by slotRef",
    );
  }
  const roots = new Map(model.roots.map((root) => [root.rootRef, root]));
  const slots = new Map<string, PathClosureModelV2["slots"][number]>();
  const exactPaths = new Set<string>();
  const foldedPaths = new Set<string>();
  for (let index = 0; index < model.slots.length; index += 1) {
    const slot = model.slots[index]!;
    if (slots.has(slot.slotRef)) {
      closureFailure(
        "PATH_TOKEN_V2_SLOT_REF_DUPLICATE",
        `/slots/${index}/slotRef`,
        "slotRef must be unique",
      );
    }
    slots.set(slot.slotRef, slot);
    const issues = portablePathIssuesV2(slot.locator, { allowEmpty: false });
    if (issues.length > 0) {
      closureFailure(
        "PATH_TOKEN_V2_SLOT_PATH_INVALID",
        `/slots/${index}/locator`,
        issues[0]!,
      );
    }
    const root = roots.get(slot.underRootRef);
    if (!root) {
      closureFailure(
        "PATH_TOKEN_V2_SLOT_ROOT_MISSING",
        `/slots/${index}/underRootRef`,
        "slot containment root must resolve inside the closure",
      );
    }
    if (!isPathContainedByRootV2(slot.locator, root.locatorPrefix, false)) {
      closureFailure(
        "PATH_TOKEN_V2_SLOT_CONTAINMENT_INVALID",
        `/slots/${index}/locator`,
        "slot locator must be a strict segment-boundary descendant of its root",
      );
    }
    const foldedLocator = asciiCaseFoldPathV2(slot.locator);
    const conflictsWithDeclaredRoot = model.roots.some((candidate) => {
      if (candidate.physicalSpace !== root.physicalSpace) return false;
      const foldedRoot = asciiCaseFoldPathV2(candidate.locatorPrefix);
      return candidate.locatorPrefix === slot.locator
        || foldedRoot === foldedLocator
        || isPathContainedByRootV2(candidate.locatorPrefix, slot.locator, false)
        || isPathContainedByRootV2(foldedRoot, foldedLocator, false);
    });
    if (conflictsWithDeclaredRoot) {
      closureFailure(
        "PATH_TOKEN_V2_FILE_ANCESTOR_CONFLICT",
        `/slots/${index}/locator`,
        "a tokenized file must not equal or contain a declared root path",
      );
    }
    const containingRoots = model.roots.filter((candidate) =>
      candidate.physicalSpace === root.physicalSpace
      && isPathContainedByRootV2(slot.locator, candidate.locatorPrefix, false));
    const foldedContainingRoots = model.roots.filter((candidate) =>
      candidate.physicalSpace === root.physicalSpace
      && isPathContainedByRootV2(
        asciiCaseFoldPathV2(slot.locator),
        asciiCaseFoldPathV2(candidate.locatorPrefix),
        false,
      ));
    if (
      canonicalJsonStringify(containingRoots.map((candidate) => candidate.rootRef).sort())
      !== canonicalJsonStringify(
        foldedContainingRoots.map((candidate) => candidate.rootRef).sort(),
      )
    ) {
      closureFailure(
        "PATH_TOKEN_V2_ASCII_CASE_COLLISION",
        `/slots/${index}/locator`,
        "slot root ancestry must not change under ASCII case folding",
      );
    }
    const deepestPrefixLength = containingRoots.reduce(
      (deepest, candidate) => Math.max(deepest, candidate.locatorPrefix.length),
      -1,
    );
    if (root.locatorPrefix.length !== deepestPrefixLength) {
      closureFailure(
        "PATH_TOKEN_V2_SLOT_ROOT_NOT_DEEPEST",
        `/slots/${index}/underRootRef`,
        "slot must bind the deepest declared containing root",
      );
    }
    const exactKey = `${root.physicalSpace}\u0000${slot.locator}`;
    const foldedKey = `${root.physicalSpace}\u0000${asciiCaseFoldPathV2(slot.locator)}`;
    if (exactPaths.has(exactKey)) {
      closureFailure(
        "PATH_TOKEN_V2_EXACT_COLLISION",
        `/slots/${index}/locator`,
        "slot locator collides inside one physical space",
      );
    }
    if (foldedPaths.has(foldedKey)) {
      closureFailure(
        "PATH_TOKEN_V2_ASCII_CASE_COLLISION",
        `/slots/${index}/locator`,
        "slot locator has an ASCII-casefold collision inside one physical space",
      );
    }
    exactPaths.add(exactKey);
    foldedPaths.add(foldedKey);
  }
  for (let index = 0; index < model.slots.length; index += 1) {
    const slot = model.slots[index]!;
    const root = roots.get(slot.underRootRef)!;
    const segments = slot.locator.split("/");
    for (let length = 1; length < segments.length; length += 1) {
      const exactPrefix = segments.slice(0, length).join("/");
      const foldedPrefix = asciiCaseFoldPathV2(exactPrefix);
      if (
        exactPaths.has(`${root.physicalSpace}\u0000${exactPrefix}`)
        || foldedPaths.has(`${root.physicalSpace}\u0000${foldedPrefix}`)
      ) {
        closureFailure(
          "PATH_TOKEN_V2_FILE_ANCESTOR_CONFLICT",
          `/slots/${index}/locator`,
          "one tokenized file must not be an exact or ASCII-casefold ancestor of another",
        );
      }
    }
  }
}

function verifyConsumerClosure(model: PathClosureModelV2): void {
  const sortedConsumers = [...model.consumers]
    .sort((left, right) => compareUtf16(left.consumerPath, right.consumerPath));
  if (model.consumers.some((consumer, index) =>
    consumer.consumerPath !== sortedConsumers[index]!.consumerPath)) {
    closureFailure(
      "PATH_TOKEN_V2_CONSUMER_ORDER_INVALID",
      "/consumers",
      "consumer refs must be canonically ordered by JSON pointer",
    );
  }
  const roots = new Map(model.roots.map((root) => [root.rootRef, root]));
  const slots = new Map(model.slots.map((slot) => [slot.slotRef, slot]));
  const consumerPaths = new Set<string>();
  const consumedSlots = new Set<string>();
  for (let index = 0; index < model.consumers.length; index += 1) {
    const consumer = model.consumers[index]!;
    if (consumerPaths.has(consumer.consumerPath)) {
      closureFailure(
        "PATH_TOKEN_V2_CONSUMER_PATH_DUPLICATE",
        `/consumers/${index}/consumerPath`,
        "consumer JSON pointer must be unique",
      );
    }
    consumerPaths.add(consumer.consumerPath);
    if (consumer.targetRef !== consumer.expectedTargetRef) {
      closureFailure(
        "PATH_TOKEN_V2_CONSUMER_ROLE_MISMATCH",
        `/consumers/${index}/targetRef`,
        "consumer target does not equal its code-owned role target",
      );
    }
    if (consumer.targetKind === "root") {
      const root = roots.get(consumer.targetRef);
      if (!root) {
        closureFailure(
          "PATH_TOKEN_V2_CONSUMER_TARGET_MISSING",
          `/consumers/${index}/targetRef`,
          "root consumer target must resolve inside the closure",
        );
      }
      if (root.physicalSpace !== consumer.requiredPhysicalSpace) {
        closureFailure(
          "PATH_TOKEN_V2_CONSUMER_ROLE_MISMATCH",
          `/consumers/${index}/requiredPhysicalSpace`,
          "root consumer physical-space role does not match its target",
        );
      }
      continue;
    }
    const slot = slots.get(consumer.targetRef);
    if (!slot) {
      closureFailure(
        "PATH_TOKEN_V2_CONSUMER_TARGET_MISSING",
        `/consumers/${index}/targetRef`,
        "slot consumer target must resolve inside the closure",
      );
    }
    if (slot.namespace !== consumer.requiredNamespace) {
      closureFailure(
        "PATH_TOKEN_V2_CONSUMER_ROLE_MISMATCH",
        `/consumers/${index}/requiredNamespace`,
        "slot consumer namespace role does not match its target",
      );
    }
    if (slot.disposition !== consumer.requiredDisposition) {
      closureFailure(
        "PATH_TOKEN_V2_ROLE_DISPOSITION_CONFLICT",
        `/consumers/${index}/requiredDisposition`,
        "only historical consumers may select reject-only slots",
      );
    }
    consumedSlots.add(slot.slotRef);
  }
  for (const [slotRef] of slots) {
    if (!consumedSlots.has(slotRef)) {
      closureFailure(
        "PATH_TOKEN_V2_ORPHAN_SLOT",
        "/slots",
        `slot ${slotRef} has no exact operational or rejection consumer`,
      );
    }
  }
}

function verifyDirectorySpellingClosure(model: PathClosureModelV2): void {
  const exactPrefixByFoldedIdentity = new Map<string, string>();
  const record = (
    physicalSpace: string,
    exactPrefix: string,
    path: string,
  ): void => {
    const key = `${physicalSpace}\u0000${asciiCaseFoldPathV2(exactPrefix)}`;
    const existing = exactPrefixByFoldedIdentity.get(key);
    if (existing !== undefined && existing !== exactPrefix) {
      closureFailure(
        "PATH_TOKEN_V2_DIRECTORY_CASE_COLLISION",
        path,
        "directory prefixes must have one exact ASCII casing within a physical space",
      );
    }
    exactPrefixByFoldedIdentity.set(key, exactPrefix);
  };
  for (let index = 0; index < model.roots.length; index += 1) {
    const root = model.roots[index]!;
    const segments = root.locatorPrefix === ""
      ? []
      : root.locatorPrefix.split("/");
    for (let length = 1; length <= segments.length; length += 1) {
      record(
        root.physicalSpace,
        segments.slice(0, length).join("/"),
        `/roots/${index}/locatorPrefix`,
      );
    }
  }
  const roots = new Map(model.roots.map((root) => [root.rootRef, root]));
  for (let index = 0; index < model.slots.length; index += 1) {
    const slot = model.slots[index]!;
    const root = roots.get(slot.underRootRef)!;
    const segments = slot.locator.split("/");
    for (let length = 1; length < segments.length; length += 1) {
      record(
        root.physicalSpace,
        segments.slice(0, length).join("/"),
        `/slots/${index}/locator`,
      );
    }
  }
}

function validateParsedPathClosureModelV2(
  model: PathClosureModelV2,
): LocallyValidatedPathClosureV2 {
  verifyRootClosure(model);
  verifySlotClosure(model);
  verifyDirectorySpellingClosure(model);
  verifyConsumerClosure(model);
  return Object.freeze({
    status: "locally_validated_shadow_closure" as const,
    authority: "none" as const,
    productionUse: "forbidden" as const,
    slotSetHash: model.slotSetHash,
    rootCount: model.roots.length,
    slotCount: model.slots.length,
    plannedSlotCount: model.slots.filter((slot) => slot.disposition === "planned").length,
    rejectOnlySlotCount: model.slots.filter((slot) => slot.disposition === "reject_only").length,
    consumerCount: model.consumers.length,
  });
}

type GenericRootV2 = Readonly<{
  rootRef: string;
  physicalSpace: string;
  parentRootRef?: string;
  locatorPrefix: string;
}>;

type GenericSlotV2 = Readonly<{
  slotRef: string;
  namespace: string;
  disposition: "planned" | "reject_only";
  nodeKind: "file";
  locator: string;
  underRootRef: string;
}>;

function rootConsumer(
  consumerPath: string,
  role: z.infer<typeof RootConsumerV2Schema>["role"],
  targetRef: string,
  expectedTargetRef: string,
  requiredPhysicalSpace: string,
): z.infer<typeof RootConsumerV2Schema> {
  return {
    consumerPath,
    role,
    targetKind: "root",
    targetRef,
    expectedTargetRef,
    requiredPhysicalSpace,
  };
}

function slotConsumer(
  consumerPath: string,
  role: z.infer<typeof SlotConsumerV2Schema>["role"],
  targetRef: string,
  expectedTargetRef: string,
  requiredNamespace: string,
  requiredDisposition: "planned" | "reject_only",
): z.infer<typeof SlotConsumerV2Schema> {
  return {
    consumerPath,
    role,
    targetKind: "slot",
    targetRef,
    expectedTargetRef,
    requiredNamespace,
    requiredDisposition,
  };
}

function collectOperationalRefStrings(
  value: unknown,
  pointer: string,
  output: Array<Readonly<{ consumerPath: string; targetRef: string }>>,
): void {
  if (pointer === "/pathSlots" || pointer === "/legacyInstallerObservation") return;
  if (typeof value === "string") {
    if (value.startsWith("PATH_ROOT_") || value.startsWith("PATH_SLOT_")) {
      output.push(Object.freeze({ consumerPath: pointer || "/", targetRef: value }));
    }
    return;
  }
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectOperationalRefStrings(item, `${pointer}/${index}`, output));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    collectOperationalRefStrings(child, `${pointer}/${key}`, output);
  }
}

function extractPathClosureModelV2(layout: NodeExecutionLayoutV2): PathClosureModelV2 {
  const pathSlots = layout.pathSlots;
  if (pathSlots.slotSetHash !== hashNodeExecutionPathSlotSetV2(pathSlots)) {
    closureFailure(
      "PATH_TOKEN_V2_SLOT_SET_HASH_MISMATCH",
      "/pathSlots/slotSetHash",
      "layout path-slot hash must bind the exact source closure",
    );
  }
  const namedRoots = pathSlots.roots as unknown as Readonly<{
    repository: GenericRootV2;
    source: GenericRootV2;
    buildOutput: GenericRootV2;
    candidateRuntime: GenericRootV2;
  }>;
  const roots = Object.values(namedRoots).map((root) => ({
    rootRef: root.rootRef,
    physicalSpace: root.physicalSpace,
    parentRootRef: root.parentRootRef ?? null,
    locatorPrefix: root.locatorPrefix,
  })).sort((left, right) => compareUtf16(left.rootRef, right.rootRef));

  const historicalSlots = (
    [...pathSlots.historicalRejectedEntrypoints] as unknown
  ) as GenericSlotV2[];
  const namedSlots = {
    packageJson: pathSlots.packageJson as GenericSlotV2,
    tsconfigJson: pathSlots.tsconfigJson as GenericSlotV2,
    sourceEntrypoint: pathSlots.sourceEntrypoint as GenericSlotV2,
    buildOutput: pathSlots.buildOutput as GenericSlotV2,
    candidateModule: pathSlots.candidateModule as GenericSlotV2,
  };
  const slots = [
    ...Object.values(namedSlots),
    ...historicalSlots,
  ].map((slot) => ({ ...slot })).sort((left, right) =>
    compareUtf16(left.slotRef, right.slotRef));

  const consumers: PathClosureConsumerV2[] = [];
  consumers.push(
    rootConsumer(
      "/pathSlots/roots/source/parentRootRef",
      "root_parent",
      namedRoots.source.parentRootRef!,
      namedRoots.repository.rootRef,
      "repository",
    ),
    rootConsumer(
      "/pathSlots/roots/buildOutput/parentRootRef",
      "root_parent",
      namedRoots.buildOutput.parentRootRef!,
      namedRoots.repository.rootRef,
      "repository",
    ),
  );
  const slotContainmentRoles: Array<Readonly<{
    path: string;
    slot: GenericSlotV2;
    expectedRoot: GenericRootV2;
  }>> = [
    { path: "/pathSlots/packageJson/underRootRef", slot: namedSlots.packageJson, expectedRoot: namedRoots.repository },
    { path: "/pathSlots/tsconfigJson/underRootRef", slot: namedSlots.tsconfigJson, expectedRoot: namedRoots.repository },
    { path: "/pathSlots/sourceEntrypoint/underRootRef", slot: namedSlots.sourceEntrypoint, expectedRoot: namedRoots.source },
    { path: "/pathSlots/buildOutput/underRootRef", slot: namedSlots.buildOutput, expectedRoot: namedRoots.buildOutput },
    { path: "/pathSlots/candidateModule/underRootRef", slot: namedSlots.candidateModule, expectedRoot: namedRoots.candidateRuntime },
    ...historicalSlots.map((slot, index) => ({
      path: `/pathSlots/historicalRejectedEntrypoints/${index}/underRootRef`,
      slot,
      expectedRoot: layout.kind === "http_handler" && index === 0
        ? namedRoots.repository
        : namedRoots.source,
    })),
  ];
  for (const role of slotContainmentRoles) {
    consumers.push(rootConsumer(
      role.path,
      "slot_containment",
      role.slot.underRootRef,
      role.expectedRoot.rootRef,
      role.expectedRoot.physicalSpace,
    ));
  }

  consumers.push(
    slotConsumer(
      "/compilerContract/packageJsonPathSlotRef",
      "compiler_package_manifest",
      layout.compilerContract.packageJsonPathSlotRef,
      namedSlots.packageJson.slotRef,
      "repository_config",
      "planned",
    ),
    slotConsumer(
      "/compilerContract/compilerArguments/1/pathSlotRef",
      "compiler_argument",
      layout.compilerContract.compilerArguments[1].pathSlotRef,
      namedSlots.tsconfigJson.slotRef,
      "repository_config",
      "planned",
    ),
    slotConsumer(
      "/compilerContract/tsconfigPathSlotRef",
      "compiler_config",
      layout.compilerContract.tsconfigPathSlotRef,
      namedSlots.tsconfigJson.slotRef,
      "repository_config",
      "planned",
    ),
    rootConsumer(
      "/compilerContract/sourceRootRef",
      "compiler_source_root",
      layout.compilerContract.sourceRootRef,
      namedRoots.source.rootRef,
      "repository",
    ),
    rootConsumer(
      "/compilerContract/outputRootRef",
      "compiler_output_root",
      layout.compilerContract.outputRootRef,
      namedRoots.buildOutput.rootRef,
      "repository",
    ),
    slotConsumer(
      "/topologyBinding/canonicalEntrypointPathSlotRef",
      "canonical_entrypoint",
      layout.topologyBinding.canonicalEntrypointPathSlotRef,
      namedSlots.sourceEntrypoint.slotRef,
      "repository_source",
      "planned",
    ),
    rootConsumer(
      "/topologyBinding/buildCommand/cwdRootRef",
      "build_cwd_root",
      layout.topologyBinding.buildCommand.cwdRootRef,
      namedRoots.repository.rootRef,
      "repository",
    ),
    slotConsumer(
      "/sourceToRuntime/sourcePathSlotRef",
      "source_input",
      layout.sourceToRuntime.sourcePathSlotRef,
      namedSlots.sourceEntrypoint.slotRef,
      "repository_source",
      "planned",
    ),
    slotConsumer(
      "/sourceToRuntime/buildOutputPathSlotRef",
      "build_output",
      layout.sourceToRuntime.buildOutputPathSlotRef,
      namedSlots.buildOutput.slotRef,
      "repository_build_output",
      "planned",
    ),
    slotConsumer(
      "/sourceToRuntime/candidateModulePathSlotRef",
      "candidate_module",
      layout.sourceToRuntime.candidateModulePathSlotRef,
      namedSlots.candidateModule.slotRef,
      "candidate_application",
      "planned",
    ),
  );
  layout.topologyBinding.historicalEntrypointPathSlotRefs.forEach(
    (targetRef, index) => consumers.push(slotConsumer(
      `/topologyBinding/historicalEntrypointPathSlotRefs/${index}`,
      "historical_entrypoint_rejection",
      targetRef,
      historicalSlots[index]!.slotRef,
      "repository_source",
      "reject_only",
    )),
  );
  if (layout.runtimeTarget.kind === "cli") {
    consumers.push(slotConsumer(
      "/runtimeTarget/moduleArgumentPathSlotRef",
      "runtime_module",
      layout.runtimeTarget.moduleArgumentPathSlotRef,
      namedSlots.candidateModule.slotRef,
      "candidate_application",
      "planned",
    ));
  } else {
    consumers.push(slotConsumer(
      "/runtimeTarget/modulePathSlotRef",
      "runtime_module",
      layout.runtimeTarget.modulePathSlotRef,
      namedSlots.candidateModule.slotRef,
      "candidate_application",
      "planned",
    ));
  }
  consumers.sort((left, right) => compareUtf16(left.consumerPath, right.consumerPath));

  const scanned: Array<Readonly<{ consumerPath: string; targetRef: string }>> = [];
  collectOperationalRefStrings(layout, "", scanned);
  scanned.sort((left, right) => compareUtf16(left.consumerPath, right.consumerPath));
  const expectedOperationalRefs = consumers
    .filter((consumer) => !consumer.consumerPath.startsWith("/pathSlots/"))
    .map((consumer) => ({
      consumerPath: consumer.consumerPath,
      targetRef: consumer.targetRef,
    }))
    .sort((left, right) => compareUtf16(left.consumerPath, right.consumerPath));
  if (canonicalJsonStringify(scanned) !== canonicalJsonStringify(expectedOperationalRefs)) {
    closureFailure(
      "PATH_TOKEN_V2_UNKNOWN_CONSUMER_REF",
      "/",
      "layout contains a missing, extra, or unclassified operational PATH_ROOT/PATH_SLOT consumer ref",
    );
  }

  const model = PathClosureModelV2Schema.parse({
    slotSetHash: pathSlots.slotSetHash,
    declaredSlotCount: pathSlots.slotCount,
    roots,
    slots,
    consumers,
  });
  validateParsedPathClosureModelV2(model);
  return model;
}

export function validateNodeExecutionPathClosureCandidateV2(
  candidate: unknown,
): LocallyValidatedPathClosureV2 {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(candidate, CLOSURE_INPUT_MAX_BYTES, {
      maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 8,
      maxNodes: CLOSURE_INPUT_MAX_BYTES + 16_384,
      maxContainerEntries:
        DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
      maxWorkUnits: (CLOSURE_INPUT_MAX_BYTES * 8) + 1_048_576,
    });
  } catch (error) {
    closureFailure(
      "PATH_TOKEN_V2_CLOSURE_INPUT_INVALID",
      "/",
      errorMessage(error),
    );
  }
  const parsed = NodeExecutionLayoutV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    closureFailure(
      "PATH_TOKEN_V2_CLOSURE_INPUT_INVALID",
      `/${parsed.error.issues[0]?.path.map(String).join("/") ?? ""}`.replace(/\/$/u, "") || "/",
      parsed.error.issues[0]?.message ?? "Node execution layout is invalid",
    );
  }
  const model = extractPathClosureModelV2(parsed.data);
  return validateParsedPathClosureModelV2(model);
}

function pathRootBindingV2(
  root: PathClosureModelV2["roots"][number],
): PathRootBindingV2 {
  const identity: PathRootBindingHashPayloadV2 = {
    schema: PATH_ROOT_BINDING_V2_SCHEMA,
    rootRef: root.rootRef,
    physicalSpace: root.physicalSpace,
    parentRootRef: root.parentRootRef,
    normalizedPrefix: root.locatorPrefix,
    prefixByteLength: Buffer.byteLength(root.locatorPrefix, "utf8"),
    segmentCount: root.locatorPrefix.length === 0
      ? 0
      : root.locatorPrefix.split("/").length,
    pathIdentityHash: hashPortablePathIdentityV2(
      root.physicalSpace,
      root.locatorPrefix,
    ),
    caseFoldPathIdentityHash: hashPortablePathCaseFoldIdentityV2(
      root.physicalSpace,
      root.locatorPrefix,
    ),
  };
  return PathRootBindingV2Schema.parse({
    ...identity,
    bindingHash: hashPathRootBindingV2(identity),
  });
}

function pathTokenV2(
  slotSetHash: string,
  slot: PathClosureModelV2["slots"][number],
  roots: ReadonlyMap<string, PathClosureModelV2["roots"][number]>,
): PathTokenV2 {
  const root = roots.get(slot.underRootRef);
  if (!root) {
    throw new PathTokenCodeAuthorityErrorV2(
      `Verified slot ${slot.slotRef} lost its containment root`,
    );
  }
  const origin = {
    pathTokenContractVersion: PATH_TOKEN_CONTRACT_VERSION_V2,
    pathTokenContractHash: PATH_TOKEN_CONTRACT_HASH_V2,
    slotSetHash,
    slotRef: slot.slotRef,
  } as const;
  const identity: PathTokenBindingHashPayloadV2 = {
    schema: PATH_TOKEN_V2_SCHEMA,
    origin,
    pathToken: hashPathTokenOriginV2(origin),
    namespace: slot.namespace,
    disposition: slot.disposition,
    nodeKind: slot.nodeKind,
    physicalSpace: root.physicalSpace,
    underRootRef: slot.underRootRef,
    normalizedLocator: slot.locator,
    locatorByteLength: Buffer.byteLength(slot.locator, "utf8"),
    segmentCount: slot.locator.split("/").length,
    pathIdentityHash: hashPortablePathIdentityV2(root.physicalSpace, slot.locator),
    caseFoldPathIdentityHash: hashPortablePathCaseFoldIdentityV2(
      root.physicalSpace,
      slot.locator,
    ),
  };
  return PathTokenV2Schema.parse({
    ...identity,
    bindingHash: hashPathTokenBindingV2(identity),
  });
}

function pathConsumerBindingV2(
  consumer: PathClosureConsumerV2,
  roots: ReadonlyMap<string, PathRootBindingV2>,
  tokens: ReadonlyMap<string, PathTokenV2>,
): PathConsumerBindingV2 {
  let identity: PathConsumerBindingHashPayloadV2;
  if (consumer.targetKind === "root") {
    const root = roots.get(consumer.targetRef);
    if (!root) {
      throw new PathTokenCodeAuthorityErrorV2(
        `Verified root consumer ${consumer.consumerPath} lost ${consumer.targetRef}`,
      );
    }
    identity = {
      schema: PATH_CONSUMER_BINDING_V2_SCHEMA,
      consumerRef: consumer.consumerPath,
      consumerRole: consumer.role,
      target: {
        kind: "root",
        rootRef: root.rootRef,
        rootBindingHash: root.bindingHash,
        requiredPhysicalSpace: consumer.requiredPhysicalSpace,
      },
    };
  } else {
    const token = tokens.get(consumer.targetRef);
    if (!token) {
      throw new PathTokenCodeAuthorityErrorV2(
        `Verified slot consumer ${consumer.consumerPath} lost ${consumer.targetRef}`,
      );
    }
    identity = {
      schema: PATH_CONSUMER_BINDING_V2_SCHEMA,
      consumerRef: consumer.consumerPath,
      consumerRole: consumer.role,
      target: {
        kind: "slot",
        slotRef: token.origin.slotRef,
        pathToken: token.pathToken,
        tokenBindingHash: token.bindingHash,
        requiredNamespace: consumer.requiredNamespace,
        requiredDisposition: consumer.requiredDisposition,
      },
    };
  }
  return PathConsumerBindingV2Schema.parse({
    ...identity,
    bindingHash: hashPathConsumerBindingV2(identity),
  });
}

function buildPathTokenSetFromFreshLayoutV2(
  layout: NodeExecutionLayoutV2,
): NodeExecutionPathTokenSetV2 {
  requireContractAuthority();
  const closure = extractPathClosureModelV2(layout);
  const roots = closure.roots.map(pathRootBindingV2);
  const rootIndex = new Map(closure.roots.map((root) => [root.rootRef, root]));
  const tokens = closure.slots.map((slot) =>
    pathTokenV2(closure.slotSetHash, slot, rootIndex));
  const rootBindingIndex = new Map(roots.map((root) => [root.rootRef, root]));
  const tokenIndex = new Map(tokens.map((token) => [token.origin.slotRef, token]));
  const consumerBindings = closure.consumers.map((consumer) =>
    pathConsumerBindingV2(consumer, rootBindingIndex, tokenIndex));
  const withoutHash = {
    schema: NODE_EXECUTION_PATH_TOKEN_SET_V2_SCHEMA,
    tokenSetVersion: PATH_TOKEN_SET_VERSION_V2,
    pathTokenContractVersion: PATH_TOKEN_CONTRACT_VERSION_V2,
    pathTokenContractHash: PATH_TOKEN_CONTRACT_HASH_V2,
    sourceAuthority: {
      kind: "node_execution_path_slot_set" as const,
      pathSlotSetSchema: "setfarm.node-execution-path-slot-set.v2" as const,
      slotContractVersion: "2.0.0" as const,
      slotSetHash: closure.slotSetHash,
    },
    readiness: {
      status: "shadow" as const,
      productionUse: "forbidden" as const,
      blockerCodes: [...PATH_TOKEN_SET_BLOCKER_CODES_V2],
    },
    rootCount: roots.length,
    roots,
    tokenCount: tokens.length,
    tokens,
    consumerBindingCount: consumerBindings.length,
    consumerBindings,
    rootMembershipHash: hashPathRootMembershipV2(roots),
    tokenMembershipHash: hashPathTokenMembershipV2(tokens),
    consumerMembershipHash: hashPathConsumerMembershipV2(consumerBindings),
  };
  const parsed = NodeExecutionPathTokenSetV2Schema.parse({
    ...withoutHash,
    tokenSetHash: hashNodeExecutionPathTokenSetV2(withoutHash),
  });
  requireTokenSetVersionAuthority(parsed);
  return recursivelyFreezePathTokenSetV2(parsed);
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

export type PathTokenCompilationDiagnosticCodeV2 =
  | "PATH_TOKEN_V2_INPUT_INVALID"
  | "PATH_TOKEN_V2_LAYOUT_RESOLUTION_REJECTED"
  | "PATH_TOKEN_V2_CODE_AUTHORITY_DRIFT"
  | "PATH_TOKEN_V2_LAYOUT_CLOSURE_INVALID"
  | "PATH_TOKEN_V2_ARTIFACT_INVALID";

export type PathTokenCompilationDiagnosticV2 = Readonly<{
  code: PathTokenCompilationDiagnosticCodeV2;
  path: string;
  message: string;
}>;

export type PathTokenCompilationResultV2 =
  | Readonly<{
      status: "shadow_compiled";
      diagnostics: readonly [];
      value: Readonly<NodeExecutionPathTokenSetV2>;
      canonicalBytes: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly PathTokenCompilationDiagnosticV2[];
    }>;

function compilationDiagnostic(
  code: PathTokenCompilationDiagnosticCodeV2,
  path: string,
  message: string,
): PathTokenCompilationDiagnosticV2 {
  return Object.freeze({
    code,
    path: path.slice(0, 500),
    message: message.slice(0, 1_000),
  });
}

function compilationRejected(
  code: PathTokenCompilationDiagnosticCodeV2,
  path: string,
  message: string,
): PathTokenCompilationResultV2 {
  return recursivelyFreezePathTokenSetV2({
    status: "rejected" as const,
    diagnostics: [compilationDiagnostic(code, path, message)]
      .slice(0, MAX_DIAGNOSTICS),
  });
}

export function compileNodeExecutionPathTokenSetV2(
  input: unknown,
): PathTokenCompilationResultV2 {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      COMPILER_INPUT_MAX_BYTES,
      COMPILER_BOUNDED_WORK_LIMITS,
    );
  } catch (error) {
    return compilationRejected(
      "PATH_TOKEN_V2_INPUT_INVALID",
      "/",
      errorMessage(error),
    );
  }
  const outer = CompilerInputV2Schema.safeParse(snapshot);
  if (!outer.success) {
    return compilationRejected(
      "PATH_TOKEN_V2_INPUT_INVALID",
      `/${outer.error.issues[0]?.path.map(String).join("/") ?? ""}`.replace(/\/$/u, "") || "/",
      outer.error.issues[0]?.message ?? "PathTokenV2 compiler input is invalid",
    );
  }
  const layout = resolveNodeExecutionLayoutV2({
    productSpec: outer.data.productSpec,
    deliverySelection: outer.data.deliverySelection,
  });
  if (layout.status !== "shadow_resolved") {
    return compilationRejected(
      "PATH_TOKEN_V2_LAYOUT_RESOLUTION_REJECTED",
      layout.diagnostics[0]?.path ?? "/",
      layout.diagnostics[0]?.message ?? "Fresh Node execution layout resolution was rejected",
    );
  }
  try {
    const value = buildPathTokenSetFromFreshLayoutV2(layout.layout);
    return recursivelyFreezePathTokenSetV2({
      status: "shadow_compiled" as const,
      diagnostics: EMPTY_DIAGNOSTICS,
      value,
      canonicalBytes: canonicalJsonStringify(value),
    });
  } catch (error) {
    if (error instanceof PathClosureVerificationErrorV2) {
      return compilationRejected(
        "PATH_TOKEN_V2_LAYOUT_CLOSURE_INVALID",
        error.path,
        error.message,
      );
    }
    if (error instanceof PathTokenCodeAuthorityErrorV2) {
      return compilationRejected(
        "PATH_TOKEN_V2_CODE_AUTHORITY_DRIFT",
        "/",
        error.message,
      );
    }
    return compilationRejected(
      "PATH_TOKEN_V2_ARTIFACT_INVALID",
      "/",
      errorMessage(error),
    );
  }
}

export type PathTokenVerificationErrorCodeV2 =
  | "PATH_TOKEN_V2_VERIFICATION_INPUT_INVALID"
  | "PATH_TOKEN_V2_VERIFICATION_CANDIDATE_INVALID"
  | "PATH_TOKEN_V2_VERIFICATION_REPRODUCTION_REJECTED"
  | "PATH_TOKEN_V2_VERIFICATION_AUTHORITY_MISMATCH";

export class PathTokenVerificationErrorV2 extends Error {
  readonly code: PathTokenVerificationErrorCodeV2;

  constructor(code: PathTokenVerificationErrorCodeV2, message: string) {
    super(message.slice(0, 1_000));
    this.name = "PathTokenVerificationErrorV2";
    this.code = code;
  }
}

export type VerifiedShadowPathTokenSetV2 = Readonly<{
  status: "verified_shadow";
  value: Readonly<NodeExecutionPathTokenSetV2>;
  canonicalBytes: string;
}>;

export function verifyNodeExecutionPathTokenSetV2(
  input: unknown,
): VerifiedShadowPathTokenSetV2 {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      VERIFIER_INPUT_MAX_BYTES,
      VERIFIER_BOUNDED_WORK_LIMITS,
    );
  } catch (error) {
    throw new PathTokenVerificationErrorV2(
      "PATH_TOKEN_V2_VERIFICATION_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const outer = VerificationInputV2Schema.safeParse(snapshot);
  if (!outer.success) {
    throw new PathTokenVerificationErrorV2(
      "PATH_TOKEN_V2_VERIFICATION_INPUT_INVALID",
      outer.error.issues[0]?.message ?? "PathTokenV2 verification input is invalid",
    );
  }
  const candidate = NodeExecutionPathTokenSetV2Schema.safeParse(
    outer.data.candidate,
  );
  if (!candidate.success) {
    throw new PathTokenVerificationErrorV2(
      "PATH_TOKEN_V2_VERIFICATION_CANDIDATE_INVALID",
      candidate.error.issues[0]?.message ?? "PathTokenV2 candidate is invalid",
    );
  }
  const reproduced = compileNodeExecutionPathTokenSetV2({
    productSpec: outer.data.productSpec,
    deliverySelection: outer.data.deliverySelection,
  });
  if (reproduced.status !== "shadow_compiled") {
    throw new PathTokenVerificationErrorV2(
      "PATH_TOKEN_V2_VERIFICATION_REPRODUCTION_REJECTED",
      reproduced.diagnostics[0]?.message ?? "Fresh PathTokenV2 reproduction was rejected",
    );
  }
  if (
    canonicalJsonStringify(candidate.data)
    !== canonicalJsonStringify(reproduced.value)
  ) {
    throw new PathTokenVerificationErrorV2(
      "PATH_TOKEN_V2_VERIFICATION_AUTHORITY_MISMATCH",
      "PathTokenV2 candidate does not equal fresh ProductSpec/selection/layout slot authority",
    );
  }
  return recursivelyFreezePathTokenSetV2({
    status: "verified_shadow" as const,
    value: reproduced.value,
    canonicalBytes: reproduced.canonicalBytes,
  });
}

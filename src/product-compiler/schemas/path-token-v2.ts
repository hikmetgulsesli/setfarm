import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../bounded-canonical-json.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema, hasUniqueStrings } from "./common-v1.js";
import {
  NODE_EXECUTION_PATH_SLOT_CONTRACT_VERSION_V2,
} from "./node-execution-layout-catalog-v2.js";

export const PATH_TOKEN_CONTRACT_V2_SCHEMA =
  "setfarm.path-token-contract.v2" as const;
export const PATH_TOKEN_V2_SCHEMA = "setfarm.path-token.v2" as const;
export const PATH_ROOT_BINDING_V2_SCHEMA =
  "setfarm.path-root-binding.v2" as const;
export const PATH_CONSUMER_BINDING_V2_SCHEMA =
  "setfarm.path-consumer-binding.v2" as const;
export const NODE_EXECUTION_PATH_TOKEN_SET_V2_SCHEMA =
  "setfarm.node-execution-path-token-set.v2" as const;
export const PATH_TOKEN_CONTRACT_VERSION_V2 = "2.0.0" as const;
export const PATH_TOKEN_SET_VERSION_V2 = "2.1.0" as const;
export const PATH_TOKEN_MAX_LOCATOR_BYTES_V2 = 1_024 as const;
export const PATH_TOKEN_MAX_SEGMENT_BYTES_V2 = 255 as const;
export const PATH_TOKEN_MAX_SEGMENTS_V2 = 64 as const;
export const PATH_TOKEN_SET_MAX_CANONICAL_BYTES_V2 = 512 * 1024;

export const WINDOWS_RESERVED_PATH_BASENAMES_V2 = Object.freeze([
  "AUX",
  "CLOCK$",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "CON",
  "CONIN$",
  "CONOUT$",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
  "NUL",
  "PRN",
] as const);

export const PATH_TOKEN_CONTRACT_V2 = Object.freeze({
  schema: PATH_TOKEN_CONTRACT_V2_SCHEMA,
  contractRef: "PATH_TOKEN_CONTRACT_V2",
  contractVersion: PATH_TOKEN_CONTRACT_VERSION_V2,
  originKind: "node_execution_path_slot",
  originFields: Object.freeze([
    "pathTokenContractVersion",
    "pathTokenContractHash",
    "slotSetHash",
    "slotRef",
  ]),
  algorithm: "sha256",
  encoding: "canonical_json",
  outputEncoding: "lowercase_hex_full_64",
  locatorSemantics: "full_logical_locator_relative_to_physical_space",
  rootSemantics: "segment_boundary_containment_not_join_base",
  characterEncoding: "ascii",
  separator: "/",
  segmentAlphabet: "[A-Za-z0-9._@+-]+",
  normalization: "identity_after_validation",
  caseFolding: "ascii_lowercase_for_collision_only",
  maxLocatorBytes: PATH_TOKEN_MAX_LOCATOR_BYTES_V2,
  maxSegmentBytes: PATH_TOKEN_MAX_SEGMENT_BYTES_V2,
  maxSegments: PATH_TOKEN_MAX_SEGMENTS_V2,
  forbiddenAbsoluteForms: Object.freeze([
    "posix_rooted",
    "windows_drive_qualified",
    "windows_unc",
    "windows_device_namespace",
  ]),
  forbiddenSegmentForms: Object.freeze([
    "empty",
    "dot",
    "dot_dot",
    "trailing_dot",
    "trailing_space",
    "windows_reserved_basename",
  ]),
  forbiddenCharacters: Object.freeze([
    "nul",
    "ascii_control",
    "delete",
    "backslash",
    "colon",
    "less_than",
    "greater_than",
    "double_quote",
    "vertical_bar",
    "question_mark",
    "asterisk",
    "percent",
    "space_and_other_non_alphabet_ascii",
  ]),
  windowsReservedBasenames: WINDOWS_RESERVED_PATH_BASENAMES_V2,
  percentEncoding: "forbidden_never_decoded",
  unicodePolicy: "reject_non_ascii_no_normalization",
  collisionScope: "physical_space_plus_full_locator",
  symlinkPolicy:
    "lexical_identity_only_materializer_must_reject_symlink_traversal",
  filesystemRealization: "not_authorized_by_path_token",
} as const);

export const PATH_TOKEN_CONTRACT_HASH_V2 = hashCanonicalJson(
  PATH_TOKEN_CONTRACT_V2,
);

export const PATH_TOKEN_SET_BLOCKER_CODES_V2 = Object.freeze([
  "PATH_TOKEN_V2_SOURCE_LAYOUT_SHADOW",
  "PATH_TOKEN_V2_FILE_TREE_UNVERIFIED",
  "PATH_TOKEN_V2_BUILD_TOPOLOGY_UNVERIFIED",
  "PATH_TOKEN_V2_MATERIALIZER_UNVERIFIED",
  "PATH_TOKEN_V2_RELEASE_ACTIVATION_UNVERIFIED",
] as const);

const PathTokenSetBlockerCodeV2Schema = z.enum(
  PATH_TOKEN_SET_BLOCKER_CODES_V2,
);

const PathTokenSetReadinessV2Schema = z.object({
  status: z.literal("shadow"),
  productionUse: z.literal("forbidden"),
  blockerCodes: z.array(PathTokenSetBlockerCodeV2Schema)
    .length(PATH_TOKEN_SET_BLOCKER_CODES_V2.length),
}).strict().superRefine((value, context) => {
  if (
    canonicalJsonStringify(value.blockerCodes)
    === canonicalJsonStringify(PATH_TOKEN_SET_BLOCKER_CODES_V2)
  ) return;
  context.addIssue({
    code: "custom",
    path: ["blockerCodes"],
    message: "PathTokenV2 blockers must equal the exact code-owned set",
  });
});

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

const WINDOWS_INVALID_PATH_CHARACTERS = new Set([
  "<",
  ">",
  ":",
  "\"",
  "\\",
  "|",
  "?",
  "*",
  "%",
]);
const PORTABLE_PATH_SEGMENT_V2 = /^[A-Za-z0-9._@+-]+$/u;
const WINDOWS_RESERVED_PATH_BASENAME_SET = new Set<string>(
  WINDOWS_RESERVED_PATH_BASENAMES_V2.map((value) =>
    asciiCaseFoldPathV2(value)),
);

export type PortablePathValidationOptionsV2 = Readonly<{
  allowEmpty: boolean;
}>;

export function asciiCaseFoldPathV2(value: string): string {
  let folded = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    folded += code >= 0x41 && code <= 0x5a
      ? String.fromCharCode(code + 0x20)
      : value[index]!;
  }
  return folded;
}

function windowsReservedBasenameV2(segment: string): string {
  const firstDot = segment.indexOf(".");
  const stem = (firstDot === -1 ? segment : segment.slice(0, firstDot))
    .replace(/[ .]+$/u, "");
  return asciiCaseFoldPathV2(stem);
}

export function portablePathIssuesV2(
  value: string,
  options: PortablePathValidationOptionsV2,
): string[] {
  const issues: string[] = [];
  const bytes = Buffer.byteLength(value, "utf8");
  if ((!options.allowEmpty && value.length === 0) || bytes > PATH_TOKEN_MAX_LOCATOR_BYTES_V2) {
    issues.push(
      `locator must contain ${options.allowEmpty ? "0" : "1"}..${PATH_TOKEN_MAX_LOCATOR_BYTES_V2} ASCII bytes`,
    );
  }
  if (value.length === 0) return issues;

  if (value.startsWith("/") || /^[A-Za-z]:/u.test(value) || value.startsWith("\\")) {
    issues.push("locator must be relative and must not use POSIX, drive, UNC, or device absolute forms");
  }
  let nonAsciiOrControl = false;
  let invalidPortableCharacter = false;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const character = value[index]!;
    if (code < 0x20 || code === 0x7f || code > 0x7f) {
      nonAsciiOrControl = true;
    }
    if (WINDOWS_INVALID_PATH_CHARACTERS.has(character)) {
      invalidPortableCharacter = true;
    }
  }
  if (nonAsciiOrControl) {
    issues.push("locator must contain printable ASCII only; controls, DEL, and non-ASCII are forbidden");
  }
  if (invalidPortableCharacter) {
    issues.push("locator contains a character forbidden by the portable Windows/POSIX contract");
  }

  const segments = value.split("/");
  if (value.endsWith("/") || segments.some((segment) => segment.length === 0)) {
    issues.push("locator must use single forward-slash separators without empty segments");
  }
  if (segments.length > PATH_TOKEN_MAX_SEGMENTS_V2) {
    issues.push(`locator exceeds ${PATH_TOKEN_MAX_SEGMENTS_V2} segments`);
  }
  for (const segment of segments) {
    if (segment === "." || segment === "..") {
      issues.push("dot and traversal segments are forbidden");
      continue;
    }
    if (!PORTABLE_PATH_SEGMENT_V2.test(segment)) {
      issues.push("locator segments must match portable ASCII [A-Za-z0-9._@+-]+");
    }
    if (Buffer.byteLength(segment, "utf8") > PATH_TOKEN_MAX_SEGMENT_BYTES_V2) {
      issues.push(`locator segment exceeds ${PATH_TOKEN_MAX_SEGMENT_BYTES_V2} ASCII bytes`);
    }
    if (segment.endsWith(".") || segment.endsWith(" ")) {
      issues.push("locator segments must not end in a dot or space");
    }
    if (WINDOWS_RESERVED_PATH_BASENAME_SET.has(windowsReservedBasenameV2(segment))) {
      issues.push("locator segment uses a Windows reserved device basename");
    }
  }
  return [...new Set(issues)];
}

export function isPathContainedByRootV2(
  fullLocator: string,
  rootPrefix: string,
  allowEqual: boolean,
): boolean {
  if (rootPrefix.length === 0) return fullLocator.length > 0 || allowEqual;
  if (allowEqual && fullLocator === rootPrefix) return true;
  return fullLocator.startsWith(`${rootPrefix}/`);
}

export function hashPortablePathIdentityV2(
  physicalSpace: string,
  normalizedLocator: string,
): string {
  return hashCanonicalJson({
    schema: "setfarm.portable-path-identity-hash.v2",
    physicalSpace,
    normalizedLocator,
  });
}

export function hashPortablePathCaseFoldIdentityV2(
  physicalSpace: string,
  normalizedLocator: string,
): string {
  return hashCanonicalJson({
    schema: "setfarm.portable-path-ascii-casefold-identity-hash.v2",
    physicalSpace,
    asciiCaseFoldedLocator: asciiCaseFoldPathV2(normalizedLocator),
  });
}

const PathTokenOriginV2Schema = z.object({
  pathTokenContractVersion: z.literal(PATH_TOKEN_CONTRACT_VERSION_V2),
  pathTokenContractHash: z.literal(PATH_TOKEN_CONTRACT_HASH_V2),
  slotSetHash: Sha256Schema,
  slotRef: AuthorityRefV2Schema,
}).strict();

export type PathTokenOriginV2 = z.infer<typeof PathTokenOriginV2Schema>;

export function hashPathTokenOriginV2(origin: PathTokenOriginV2): string {
  return hashCanonicalJson({
    schema: "setfarm.path-token-origin-hash.v2",
    origin,
  });
}

const PathRootBindingIdentityV2Schema = z.object({
  schema: z.literal(PATH_ROOT_BINDING_V2_SCHEMA),
  rootRef: AuthorityRefV2Schema,
  physicalSpace: PhysicalSpaceV2Schema,
  parentRootRef: AuthorityRefV2Schema.nullable(),
  normalizedPrefix: z.string().max(PATH_TOKEN_MAX_LOCATOR_BYTES_V2),
  prefixByteLength: z.number().int().nonnegative().max(PATH_TOKEN_MAX_LOCATOR_BYTES_V2),
  segmentCount: z.number().int().nonnegative().max(PATH_TOKEN_MAX_SEGMENTS_V2),
  pathIdentityHash: Sha256Schema,
  caseFoldPathIdentityHash: Sha256Schema,
}).strict();

export type PathRootBindingHashPayloadV2 = z.infer<
  typeof PathRootBindingIdentityV2Schema
>;

export function hashPathRootBindingV2(
  value: PathRootBindingHashPayloadV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.path-root-binding-hash.v2",
    rootBinding: value,
  });
}

const PathRootBindingCandidateV2Schema = PathRootBindingIdentityV2Schema.extend({
  bindingHash: Sha256Schema,
}).strict();

const PathRootBindingV2ContentSchema =
  PathRootBindingCandidateV2Schema.superRefine((value, context) => {
    for (const issue of portablePathIssuesV2(value.normalizedPrefix, { allowEmpty: true })) {
      context.addIssue({ code: "custom", path: ["normalizedPrefix"], message: issue });
    }
    const expectedSegments = value.normalizedPrefix.length === 0
      ? 0
      : value.normalizedPrefix.split("/").length;
    if (value.prefixByteLength !== Buffer.byteLength(value.normalizedPrefix, "utf8")) {
      context.addIssue({
        code: "custom",
        path: ["prefixByteLength"],
        message: "root prefix byte length must match the exact normalized prefix",
      });
    }
    if (value.segmentCount !== expectedSegments) {
      context.addIssue({
        code: "custom",
        path: ["segmentCount"],
        message: "root segment count must match the exact normalized prefix",
      });
    }
    if (
      value.pathIdentityHash
      !== hashPortablePathIdentityV2(value.physicalSpace, value.normalizedPrefix)
    ) {
      context.addIssue({
        code: "custom",
        path: ["pathIdentityHash"],
        message: "root path identity hash must bind physical space and exact prefix",
      });
    }
    if (
      value.caseFoldPathIdentityHash
      !== hashPortablePathCaseFoldIdentityV2(value.physicalSpace, value.normalizedPrefix)
    ) {
      context.addIssue({
        code: "custom",
        path: ["caseFoldPathIdentityHash"],
        message: "root case-fold identity hash must bind physical space and ASCII-folded prefix",
      });
    }
    const { bindingHash: _bindingHash, ...identity } = value;
    if (value.bindingHash !== hashPathRootBindingV2(identity)) {
      context.addIssue({
        code: "custom",
        path: ["bindingHash"],
        message: "root binding hash must bind the complete root identity",
      });
    }
  });

export const PathRootBindingV2Schema = PathRootBindingV2ContentSchema;
export type PathRootBindingV2 = z.infer<typeof PathRootBindingV2Schema>;

const PathTokenIdentityV2Schema = z.object({
  schema: z.literal(PATH_TOKEN_V2_SCHEMA),
  origin: PathTokenOriginV2Schema,
  pathToken: Sha256Schema,
  namespace: NamespaceV2Schema,
  disposition: z.enum(["planned", "reject_only"]),
  nodeKind: z.literal("file"),
  physicalSpace: PhysicalSpaceV2Schema,
  underRootRef: AuthorityRefV2Schema,
  normalizedLocator: z.string().min(1).max(PATH_TOKEN_MAX_LOCATOR_BYTES_V2),
  locatorByteLength: z.number().int().positive().max(PATH_TOKEN_MAX_LOCATOR_BYTES_V2),
  segmentCount: z.number().int().positive().max(PATH_TOKEN_MAX_SEGMENTS_V2),
  pathIdentityHash: Sha256Schema,
  caseFoldPathIdentityHash: Sha256Schema,
}).strict();

export type PathTokenBindingHashPayloadV2 = z.infer<
  typeof PathTokenIdentityV2Schema
>;

export function hashPathTokenBindingV2(
  value: PathTokenBindingHashPayloadV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.path-token-binding-hash.v2",
    pathTokenBinding: value,
  });
}

const PathTokenCandidateV2Schema = PathTokenIdentityV2Schema.extend({
  bindingHash: Sha256Schema,
}).strict();

const PathTokenV2ContentSchema =
  PathTokenCandidateV2Schema.superRefine((value, context) => {
    for (const issue of portablePathIssuesV2(value.normalizedLocator, { allowEmpty: false })) {
      context.addIssue({ code: "custom", path: ["normalizedLocator"], message: issue });
    }
    if (value.pathToken !== hashPathTokenOriginV2(value.origin)) {
      context.addIssue({
        code: "custom",
        path: ["pathToken"],
        message: "path token must bind only the exact versioned slot origin",
      });
    }
    if (value.locatorByteLength !== Buffer.byteLength(value.normalizedLocator, "utf8")) {
      context.addIssue({
        code: "custom",
        path: ["locatorByteLength"],
        message: "locator byte length must match the exact normalized locator",
      });
    }
    if (value.segmentCount !== value.normalizedLocator.split("/").length) {
      context.addIssue({
        code: "custom",
        path: ["segmentCount"],
        message: "locator segment count must match the exact normalized locator",
      });
    }
    if (
      value.pathIdentityHash
      !== hashPortablePathIdentityV2(value.physicalSpace, value.normalizedLocator)
    ) {
      context.addIssue({
        code: "custom",
        path: ["pathIdentityHash"],
        message: "path identity hash must bind physical space and exact locator",
      });
    }
    if (
      value.caseFoldPathIdentityHash
      !== hashPortablePathCaseFoldIdentityV2(value.physicalSpace, value.normalizedLocator)
    ) {
      context.addIssue({
        code: "custom",
        path: ["caseFoldPathIdentityHash"],
        message: "case-fold path identity hash must bind physical space and ASCII-folded locator",
      });
    }
    const { bindingHash: _bindingHash, ...identity } = value;
    if (value.bindingHash !== hashPathTokenBindingV2(identity)) {
      context.addIssue({
        code: "custom",
        path: ["bindingHash"],
        message: "path token binding hash must bind the complete token identity",
      });
    }
  });

export const PathTokenV2Schema = PathTokenV2ContentSchema;
export type PathTokenV2 = z.infer<typeof PathTokenV2Schema>;

export const PATH_CONSUMER_ROLES_V2 = Object.freeze([
  "root_parent",
  "slot_containment",
  "compiler_source_root",
  "compiler_output_root",
  "build_cwd_root",
  "compiler_package_manifest",
  "dependency_lock_manifest",
  "compiler_argument",
  "compiler_config",
  "canonical_entrypoint",
  "historical_entrypoint_rejection",
  "source_input",
  "build_output",
  "candidate_module",
  "runtime_module",
] as const);

const PathConsumerRoleV2Schema = z.enum(PATH_CONSUMER_ROLES_V2);

const PathRootConsumerTargetV2Schema = z.object({
  kind: z.literal("root"),
  rootRef: AuthorityRefV2Schema,
  rootBindingHash: Sha256Schema,
  requiredPhysicalSpace: PhysicalSpaceV2Schema,
}).strict();

const PathSlotConsumerTargetV2Schema = z.object({
  kind: z.literal("slot"),
  slotRef: AuthorityRefV2Schema,
  pathToken: Sha256Schema,
  tokenBindingHash: Sha256Schema,
  requiredNamespace: NamespaceV2Schema,
  requiredDisposition: z.enum(["planned", "reject_only"]),
}).strict();

const PathConsumerBindingIdentityV2Schema = z.object({
  schema: z.literal(PATH_CONSUMER_BINDING_V2_SCHEMA),
  consumerRef: z.string().min(1).max(500).regex(/^\//u),
  consumerRole: PathConsumerRoleV2Schema,
  target: z.discriminatedUnion("kind", [
    PathRootConsumerTargetV2Schema,
    PathSlotConsumerTargetV2Schema,
  ]),
}).strict();

export type PathConsumerBindingHashPayloadV2 = z.infer<
  typeof PathConsumerBindingIdentityV2Schema
>;

export function hashPathConsumerBindingV2(
  value: PathConsumerBindingHashPayloadV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.path-consumer-binding-hash.v2",
    consumerBinding: value,
  });
}

const PathConsumerBindingCandidateV2Schema =
  PathConsumerBindingIdentityV2Schema.extend({
    bindingHash: Sha256Schema,
  }).strict();

export const PathConsumerBindingV2Schema =
  PathConsumerBindingCandidateV2Schema.superRefine((value, context) => {
    const { bindingHash: _bindingHash, ...identity } = value;
    if (value.bindingHash !== hashPathConsumerBindingV2(identity)) {
      context.addIssue({
        code: "custom",
        path: ["bindingHash"],
        message: "consumer binding hash must bind the exact role and target",
      });
    }
  });

export type PathConsumerBindingV2 = z.infer<
  typeof PathConsumerBindingV2Schema
>;

export function hashPathRootMembershipV2(
  roots: readonly Readonly<{ rootRef: string; bindingHash: string }>[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.path-root-membership-hash.v2",
    roots: roots.map((root) => ({
      rootRef: root.rootRef,
      bindingHash: root.bindingHash,
    })),
  });
}

export function hashPathTokenMembershipV2(
  tokens: readonly Readonly<{
    origin: Readonly<{ slotRef: string }>;
    pathToken: string;
    bindingHash: string;
  }>[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.path-token-membership-hash.v2",
    tokens: tokens.map((token) => ({
      slotRef: token.origin.slotRef,
      pathToken: token.pathToken,
      bindingHash: token.bindingHash,
    })),
  });
}

export function hashPathConsumerMembershipV2(
  consumers: readonly Readonly<{
    consumerRef: string;
    bindingHash: string;
  }>[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.path-consumer-membership-hash.v2",
    consumers: consumers.map((consumer) => ({
      consumerRef: consumer.consumerRef,
      bindingHash: consumer.bindingHash,
    })),
  });
}

const NodeExecutionPathTokenSetCandidateV2Schema = z.object({
  schema: z.literal(NODE_EXECUTION_PATH_TOKEN_SET_V2_SCHEMA),
  tokenSetVersion: z.literal(PATH_TOKEN_SET_VERSION_V2),
  pathTokenContractVersion: z.literal(PATH_TOKEN_CONTRACT_VERSION_V2),
  pathTokenContractHash: z.literal(PATH_TOKEN_CONTRACT_HASH_V2),
  sourceAuthority: z.object({
    kind: z.literal("node_execution_path_slot_set"),
    pathSlotSetSchema: z.literal("setfarm.node-execution-path-slot-set.v2"),
    slotContractVersion: z.literal(NODE_EXECUTION_PATH_SLOT_CONTRACT_VERSION_V2),
    slotSetHash: Sha256Schema,
  }).strict(),
  readiness: PathTokenSetReadinessV2Schema,
  rootCount: z.number().int().positive().max(256),
  roots: z.array(PathRootBindingV2Schema).min(1).max(256),
  tokenCount: z.number().int().positive().max(4_096),
  tokens: z.array(PathTokenV2Schema).min(1).max(4_096),
  consumerBindingCount: z.number().int().positive().max(16_384),
  consumerBindings: z.array(PathConsumerBindingV2Schema).min(1).max(16_384),
  rootMembershipHash: Sha256Schema,
  tokenMembershipHash: Sha256Schema,
  consumerMembershipHash: Sha256Schema,
  tokenSetHash: Sha256Schema,
}).strict();

export type NodeExecutionPathTokenSetV2 = z.infer<
  typeof NodeExecutionPathTokenSetCandidateV2Schema
>;

export function hashNodeExecutionPathTokenSetV2(
  value:
    | Omit<NodeExecutionPathTokenSetV2, "tokenSetHash">
    | NodeExecutionPathTokenSetV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.tokenSetHash;
  return hashCanonicalJson({
    schema: "setfarm.node-execution-path-token-set-hash.v2",
    tokenSet: payload,
  });
}

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function addRootClosureIssues(
  value: NodeExecutionPathTokenSetV2,
  context: z.RefinementCtx,
): void {
  const rootRefs = value.roots.map((root) => root.rootRef);
  if (
    value.rootCount !== value.roots.length
    || !hasUniqueStrings(rootRefs)
    || value.roots.some((root, index) =>
      index > 0 && compareUtf16(value.roots[index - 1]!.rootRef, root.rootRef) >= 0)
  ) {
    context.addIssue({
      code: "custom",
      path: ["roots"],
      message: "root bindings must be complete, unique, and canonically ordered by rootRef",
    });
  }
  const roots = new Map(value.roots.map((root) => [root.rootRef, root]));
  const anchorCounts = new Map<string, number>();
  const exactPaths = new Set<string>();
  const foldedPaths = new Set<string>();
  for (let index = 0; index < value.roots.length; index += 1) {
    const root = value.roots[index]!;
    const exactKey = `${root.physicalSpace}\u0000${root.normalizedPrefix}`;
    const foldedKey = `${root.physicalSpace}\u0000${asciiCaseFoldPathV2(root.normalizedPrefix)}`;
    if (exactPaths.has(exactKey)) {
      context.addIssue({
        code: "custom",
        path: ["roots", index, "normalizedPrefix"],
        message: "root locators must be unique within one physical space",
      });
    }
    if (foldedPaths.has(foldedKey)) {
      context.addIssue({
        code: "custom",
        path: ["roots", index, "normalizedPrefix"],
        message: "root locators must be ASCII-casefold unique within one physical space",
      });
    }
    exactPaths.add(exactKey);
    foldedPaths.add(foldedKey);
    if (root.parentRootRef === null) {
      anchorCounts.set(root.physicalSpace, (anchorCounts.get(root.physicalSpace) ?? 0) + 1);
      if (root.normalizedPrefix !== "") {
        context.addIssue({
          code: "custom",
          path: ["roots", index, "normalizedPrefix"],
          message: "a parentless physical-space root must use the empty prefix",
        });
      }
      continue;
    }
    const parent = roots.get(root.parentRootRef);
    if (!parent) {
      context.addIssue({
        code: "custom",
        path: ["roots", index, "parentRootRef"],
        message: "root parent must resolve inside the same root closure",
      });
      continue;
    }
    if (parent.physicalSpace !== root.physicalSpace) {
      context.addIssue({
        code: "custom",
        path: ["roots", index, "physicalSpace"],
        message: "root and parent must share one physical space",
      });
    }
    if (!isPathContainedByRootV2(root.normalizedPrefix, parent.normalizedPrefix, false)) {
      context.addIssue({
        code: "custom",
        path: ["roots", index, "normalizedPrefix"],
        message: "child root prefix must be a strict segment-boundary descendant of its parent",
      });
    }
    const containingRoots = value.roots.filter((candidate) =>
      candidate.rootRef !== root.rootRef
      && candidate.physicalSpace === root.physicalSpace
      && isPathContainedByRootV2(root.normalizedPrefix, candidate.normalizedPrefix, false));
    const foldedContainingRoots = value.roots.filter((candidate) =>
      candidate.rootRef !== root.rootRef
      && candidate.physicalSpace === root.physicalSpace
      && isPathContainedByRootV2(
        asciiCaseFoldPathV2(root.normalizedPrefix),
        asciiCaseFoldPathV2(candidate.normalizedPrefix),
        false,
      ));
    if (
      canonicalJsonStringify(containingRoots.map((candidate) => candidate.rootRef).sort())
      !== canonicalJsonStringify(
        foldedContainingRoots.map((candidate) => candidate.rootRef).sort(),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["roots", index, "normalizedPrefix"],
        message: "root ancestry must not change under ASCII case folding",
      });
    }
    const deepestContainingSegments = containingRoots.reduce(
      (deepest, candidate) => Math.max(deepest, candidate.segmentCount),
      -1,
    );
    if (parent.segmentCount !== deepestContainingSegments) {
      context.addIssue({
        code: "custom",
        path: ["roots", index, "parentRootRef"],
        message: "root parent must be the deepest declared containing root",
      });
    }
  }
  for (const physicalSpace of new Set(value.roots.map((root) => root.physicalSpace))) {
    if (anchorCounts.get(physicalSpace) !== 1) {
      context.addIssue({
        code: "custom",
        path: ["roots"],
        message: "each physical space must have exactly one empty parentless root",
      });
    }
  }
  for (let index = 0; index < value.roots.length; index += 1) {
    const visited = new Set<string>();
    let current: PathRootBindingV2 | undefined = value.roots[index];
    while (current) {
      if (visited.has(current.rootRef)) {
        context.addIssue({
          code: "custom",
          path: ["roots", index, "parentRootRef"],
          message: "root parent graph must be acyclic",
        });
        break;
      }
      visited.add(current.rootRef);
      current = current.parentRootRef === null
        ? undefined
        : roots.get(current.parentRootRef);
    }
  }
}

function addTokenClosureIssues(
  value: NodeExecutionPathTokenSetV2,
  context: z.RefinementCtx,
): void {
  const slotRefs = value.tokens.map((token) => token.origin.slotRef);
  if (
    value.tokenCount !== value.tokens.length
    || !hasUniqueStrings(slotRefs)
    || value.tokens.some((token, index) =>
      index > 0
      && compareUtf16(value.tokens[index - 1]!.origin.slotRef, token.origin.slotRef) >= 0)
  ) {
    context.addIssue({
      code: "custom",
      path: ["tokens"],
      message: "path tokens must be complete, unique, and canonically ordered by slotRef",
    });
  }
  const roots = new Map(value.roots.map((root) => [root.rootRef, root]));
  const exactPaths = new Set<string>();
  const foldedPaths = new Set<string>();
  const physicalSpaceByNamespace = new Map<string, string>([
    ["repository_config", "repository"],
    ["repository_source", "repository"],
    ["repository_build_output", "repository"],
    ["candidate_application", "candidate_runtime"],
  ]);
  for (let index = 0; index < value.tokens.length; index += 1) {
    const token = value.tokens[index]!;
    if (physicalSpaceByNamespace.get(token.namespace) !== token.physicalSpace) {
      context.addIssue({
        code: "custom",
        path: ["tokens", index, "physicalSpace"],
        message: "token namespace must bind its exact physical-space role",
      });
    }
    if (
      token.origin.pathTokenContractVersion !== value.pathTokenContractVersion
      || token.origin.pathTokenContractHash !== value.pathTokenContractHash
      || token.origin.slotSetHash !== value.sourceAuthority.slotSetHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["tokens", index, "origin"],
        message: "every token origin must bind the set contract and exact source slot-set hash",
      });
    }
    const root = roots.get(token.underRootRef);
    if (!root) {
      context.addIssue({
        code: "custom",
        path: ["tokens", index, "underRootRef"],
        message: "token containment root must resolve inside the exact root closure",
      });
    } else {
      if (root.physicalSpace !== token.physicalSpace) {
        context.addIssue({
          code: "custom",
          path: ["tokens", index, "physicalSpace"],
          message: "token and containment root must share one physical space",
        });
      }
      if (!isPathContainedByRootV2(token.normalizedLocator, root.normalizedPrefix, false)) {
        context.addIssue({
          code: "custom",
          path: ["tokens", index, "normalizedLocator"],
          message: "token locator must be a strict segment-boundary descendant of its root",
        });
      }
      const foldedLocator = asciiCaseFoldPathV2(token.normalizedLocator);
      const conflictsWithDeclaredRoot = value.roots.some((candidate) => {
        if (candidate.physicalSpace !== token.physicalSpace) return false;
        const foldedRoot = asciiCaseFoldPathV2(candidate.normalizedPrefix);
        return candidate.normalizedPrefix === token.normalizedLocator
          || foldedRoot === foldedLocator
          || isPathContainedByRootV2(
            candidate.normalizedPrefix,
            token.normalizedLocator,
            false,
          )
          || isPathContainedByRootV2(foldedRoot, foldedLocator, false);
      });
      if (conflictsWithDeclaredRoot) {
        context.addIssue({
          code: "custom",
          path: ["tokens", index, "normalizedLocator"],
          message: "a tokenized file must not equal or contain a declared root path",
        });
      }
      const containingRoots = value.roots.filter((candidate) =>
        candidate.physicalSpace === token.physicalSpace
        && isPathContainedByRootV2(token.normalizedLocator, candidate.normalizedPrefix, false));
      const foldedContainingRoots = value.roots.filter((candidate) =>
        candidate.physicalSpace === token.physicalSpace
        && isPathContainedByRootV2(
          asciiCaseFoldPathV2(token.normalizedLocator),
          asciiCaseFoldPathV2(candidate.normalizedPrefix),
          false,
        ));
      if (
        canonicalJsonStringify(containingRoots.map((candidate) => candidate.rootRef).sort())
        !== canonicalJsonStringify(
          foldedContainingRoots.map((candidate) => candidate.rootRef).sort(),
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["tokens", index, "normalizedLocator"],
          message: "token root ancestry must not change under ASCII case folding",
        });
      }
      const deepestContainingSegments = containingRoots.reduce(
        (deepest, candidate) => Math.max(deepest, candidate.segmentCount),
        -1,
      );
      if (root.segmentCount !== deepestContainingSegments) {
        context.addIssue({
          code: "custom",
          path: ["tokens", index, "underRootRef"],
          message: "token containment root must be the deepest declared containing root",
        });
      }
    }
    const exactKey = `${token.physicalSpace}\u0000${token.normalizedLocator}`;
    const foldedKey = `${token.physicalSpace}\u0000${asciiCaseFoldPathV2(token.normalizedLocator)}`;
    if (exactPaths.has(exactKey)) {
      context.addIssue({
        code: "custom",
        path: ["tokens", index, "normalizedLocator"],
        message: "token locators must be unique within one physical space",
      });
    }
    if (foldedPaths.has(foldedKey)) {
      context.addIssue({
        code: "custom",
        path: ["tokens", index, "normalizedLocator"],
        message: "token locators must be ASCII-casefold unique within one physical space",
      });
    }
    exactPaths.add(exactKey);
    foldedPaths.add(foldedKey);
  }
  const exactFileKeys = new Set(
    value.tokens.map((token) => `${token.physicalSpace}\u0000${token.normalizedLocator}`),
  );
  const foldedFileKeys = new Set(
    value.tokens.map((token) =>
      `${token.physicalSpace}\u0000${asciiCaseFoldPathV2(token.normalizedLocator)}`),
  );
  for (let index = 0; index < value.tokens.length; index += 1) {
    const token = value.tokens[index]!;
    const segments = token.normalizedLocator.split("/");
    for (let length = 1; length < segments.length; length += 1) {
      const prefix = segments.slice(0, length).join("/");
      if (exactFileKeys.has(`${token.physicalSpace}\u0000${prefix}`)) {
        context.addIssue({
          code: "custom",
          path: ["tokens", index, "normalizedLocator"],
          message: "a tokenized file must not be an exact ancestor of another tokenized file",
        });
        break;
      }
      if (
        foldedFileKeys.has(
          `${token.physicalSpace}\u0000${asciiCaseFoldPathV2(prefix)}`,
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["tokens", index, "normalizedLocator"],
          message: "a tokenized file must not be an ASCII-casefold ancestor of another tokenized file",
        });
        break;
      }
    }
  }
}

function addDirectorySpellingClosureIssues(
  value: NodeExecutionPathTokenSetV2,
  context: z.RefinementCtx,
): void {
  const exactPrefixByFoldedIdentity = new Map<string, string>();
  const record = (
    physicalSpace: string,
    exactPrefix: string,
    path: (string | number)[],
  ): void => {
    const key = `${physicalSpace}\u0000${asciiCaseFoldPathV2(exactPrefix)}`;
    const existing = exactPrefixByFoldedIdentity.get(key);
    if (existing !== undefined && existing !== exactPrefix) {
      context.addIssue({
        code: "custom",
        path,
        message:
          "directory prefixes must have one exact ASCII casing within a physical space",
      });
      return;
    }
    exactPrefixByFoldedIdentity.set(key, exactPrefix);
  };
  for (let index = 0; index < value.roots.length; index += 1) {
    const root = value.roots[index]!;
    const segments = root.normalizedPrefix === ""
      ? []
      : root.normalizedPrefix.split("/");
    for (let length = 1; length <= segments.length; length += 1) {
      record(
        root.physicalSpace,
        segments.slice(0, length).join("/"),
        ["roots", index, "normalizedPrefix"],
      );
    }
  }
  const roots = new Map(value.roots.map((root) => [root.rootRef, root]));
  for (let index = 0; index < value.tokens.length; index += 1) {
    const token = value.tokens[index]!;
    const root = roots.get(token.underRootRef);
    if (!root) continue;
    const segments = token.normalizedLocator.split("/");
    for (let length = 1; length < segments.length; length += 1) {
      record(
        root.physicalSpace,
        segments.slice(0, length).join("/"),
        ["tokens", index, "normalizedLocator"],
      );
    }
  }
}

function addConsumerClosureIssues(
  value: NodeExecutionPathTokenSetV2,
  context: z.RefinementCtx,
): void {
  const consumerRefs = value.consumerBindings.map((consumer) =>
    consumer.consumerRef);
  if (
    value.consumerBindingCount !== value.consumerBindings.length
    || !hasUniqueStrings(consumerRefs)
    || value.consumerBindings.some((consumer, index) =>
      index > 0
      && compareUtf16(
        value.consumerBindings[index - 1]!.consumerRef,
        consumer.consumerRef,
      ) >= 0)
  ) {
    context.addIssue({
      code: "custom",
      path: ["consumerBindings"],
      message: "consumer bindings must be complete, unique, and canonically ordered by consumerRef",
    });
  }
  const roots = new Map(value.roots.map((root) => [root.rootRef, root]));
  const tokens = new Map(value.tokens.map((token) => [token.origin.slotRef, token]));
  const consumedSlots = new Set<string>();
  const rootRoles = new Set<string>([
    "root_parent",
    "slot_containment",
    "compiler_source_root",
    "compiler_output_root",
    "build_cwd_root",
  ]);
  const slotRolePolicies = new Map<string, Readonly<{
    namespace: string;
    disposition: "planned" | "reject_only";
  }>>([
    ["compiler_package_manifest", { namespace: "repository_config", disposition: "planned" }],
    ["dependency_lock_manifest", { namespace: "repository_config", disposition: "planned" }],
    ["compiler_argument", { namespace: "repository_config", disposition: "planned" }],
    ["compiler_config", { namespace: "repository_config", disposition: "planned" }],
    ["canonical_entrypoint", { namespace: "repository_source", disposition: "planned" }],
    ["historical_entrypoint_rejection", { namespace: "repository_source", disposition: "reject_only" }],
    ["source_input", { namespace: "repository_source", disposition: "planned" }],
    ["build_output", { namespace: "repository_build_output", disposition: "planned" }],
    ["candidate_module", { namespace: "candidate_application", disposition: "planned" }],
    ["runtime_module", { namespace: "candidate_application", disposition: "planned" }],
  ]);
  for (let index = 0; index < value.consumerBindings.length; index += 1) {
    const consumer = value.consumerBindings[index]!;
    if (consumer.target.kind === "root") {
      if (!rootRoles.has(consumer.consumerRole)) {
        context.addIssue({
          code: "custom",
          path: ["consumerBindings", index, "consumerRole"],
          message: "root consumer target requires an exact root consumer role",
        });
      }
      const exactRootRefByRole = new Map<string, string>([
        ["root_parent", "PATH_ROOT_NODE_REPOSITORY_V2"],
        ["compiler_source_root", "PATH_ROOT_NODE_SOURCE_V2"],
        ["compiler_output_root", "PATH_ROOT_NODE_BUILD_OUTPUT_V2"],
        ["build_cwd_root", "PATH_ROOT_NODE_REPOSITORY_V2"],
      ]);
      const exactRootRef = exactRootRefByRole.get(consumer.consumerRole);
      if (exactRootRef && consumer.target.rootRef !== exactRootRef) {
        context.addIssue({
          code: "custom",
          path: ["consumerBindings", index, "target", "rootRef"],
          message: "root consumer role must bind its exact code-owned structural root",
        });
      }
      const root = roots.get(consumer.target.rootRef);
      if (
        !root
        || root.bindingHash !== consumer.target.rootBindingHash
        || root.physicalSpace !== consumer.target.requiredPhysicalSpace
      ) {
        context.addIssue({
          code: "custom",
          path: ["consumerBindings", index, "target"],
          message: "root consumer must bind an exact root identity and physical-space role",
        });
      }
      continue;
    }
    if (rootRoles.has(consumer.consumerRole)) {
      context.addIssue({
        code: "custom",
        path: ["consumerBindings", index, "consumerRole"],
        message: "slot consumer target requires an exact slot consumer role",
      });
    }
    const rolePolicy = slotRolePolicies.get(consumer.consumerRole);
    if (
      !rolePolicy
      || consumer.target.requiredNamespace !== rolePolicy.namespace
      || consumer.target.requiredDisposition !== rolePolicy.disposition
    ) {
      context.addIssue({
        code: "custom",
        path: ["consumerBindings", index, "consumerRole"],
        message: "slot consumer role must carry its exact namespace and disposition policy",
      });
    }
    const token = tokens.get(consumer.target.slotRef);
    if (
      !token
      || token.pathToken !== consumer.target.pathToken
      || token.bindingHash !== consumer.target.tokenBindingHash
      || token.namespace !== consumer.target.requiredNamespace
      || token.disposition !== consumer.target.requiredDisposition
    ) {
      context.addIssue({
        code: "custom",
        path: ["consumerBindings", index, "target"],
        message: "slot consumer must bind an exact token, namespace, and disposition role",
      });
    } else {
      consumedSlots.add(token.origin.slotRef);
    }
    if (
      consumer.consumerRole === "historical_entrypoint_rejection"
      ? consumer.target.requiredDisposition !== "reject_only"
      : consumer.target.requiredDisposition !== "planned"
    ) {
      context.addIssue({
        code: "custom",
        path: ["consumerBindings", index, "consumerRole"],
        message: "only historical entrypoint consumers may bind reject-only tokens",
      });
    }
  }
  for (let index = 0; index < value.tokens.length; index += 1) {
    if (!consumedSlots.has(value.tokens[index]!.origin.slotRef)) {
      context.addIssue({
        code: "custom",
        path: ["tokens", index],
        message: "every planned or reject-only token must have an exact consumer binding",
      });
    }
  }
}

const NodeExecutionPathTokenSetContentV2Schema =
  NodeExecutionPathTokenSetCandidateV2Schema.superRefine((value, context) => {
    addRootClosureIssues(value, context);
    addTokenClosureIssues(value, context);
    addDirectorySpellingClosureIssues(value, context);
    addConsumerClosureIssues(value, context);
    if (value.rootMembershipHash !== hashPathRootMembershipV2(value.roots)) {
      context.addIssue({
        code: "custom",
        path: ["rootMembershipHash"],
        message: "root membership hash must bind the exact ordered root closure",
      });
    }
    if (value.tokenMembershipHash !== hashPathTokenMembershipV2(value.tokens)) {
      context.addIssue({
        code: "custom",
        path: ["tokenMembershipHash"],
        message: "token membership hash must bind the exact ordered slot/token closure",
      });
    }
    if (
      value.consumerMembershipHash
      !== hashPathConsumerMembershipV2(value.consumerBindings)
    ) {
      context.addIssue({
        code: "custom",
        path: ["consumerMembershipHash"],
        message: "consumer membership hash must bind the exact ordered operational closure",
      });
    }
    if (value.tokenSetHash !== hashNodeExecutionPathTokenSetV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["tokenSetHash"],
        message: "path token set hash must bind the complete canonical artifact",
      });
    }
  });

const BoundedNodeExecutionPathTokenSetV2Schema = z.unknown()
  .superRefine((value, context) => {
    try {
      canonicalJsonBytesBounded(value, {
        maxBytes: PATH_TOKEN_SET_MAX_CANONICAL_BYTES_V2,
        maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 8,
        maxNodes: PATH_TOKEN_SET_MAX_CANONICAL_BYTES_V2 + 8_192,
        maxContainerEntries:
          DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
        maxWorkUnits: (PATH_TOKEN_SET_MAX_CANONICAL_BYTES_V2 * 8) + 1_048_576,
      });
    } catch {
      context.addIssue({
        code: "custom",
        message: `PathTokenV2 set must fit ${PATH_TOKEN_SET_MAX_CANONICAL_BYTES_V2} canonical bytes and bounded work`,
      });
    }
  });

export const NodeExecutionPathTokenSetV2Schema =
  BoundedNodeExecutionPathTokenSetV2Schema.pipe(
    NodeExecutionPathTokenSetContentV2Schema,
  );

export function recursivelyFreezePathTokenSetV2<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const pending: object[] = [value as object];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
        pending.push(child);
      }
    }
    Object.freeze(current);
  }
  return value;
}

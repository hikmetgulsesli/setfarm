import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import type postgres from "postgres";
import { z } from "zod";

import { createRunProtocolRepository } from "../execution/run-protocol.js";
import {
  produceRuntimeEvidenceContractV1,
  RUNTIME_EVIDENCE_CONTRACT_PRODUCER_VERSION,
} from "../evidence/runtime-evidence-contract-producer-v1.js";
import { hashRuntimeEvidenceContractV1 } from "../evidence/runtime-evidence-contract-v1.js";
import {
  adaptExactSetupTopologyV1,
  FileTreeManifestV1Schema,
  SetupCertificateV1Schema,
  SharedGrantsArtifactV1Schema,
} from "./adapters/setup-topology.js";
import {
  produceDesignGraphFromExactStitchScreenIndexV4,
} from "./adapters/stitch-screen-index-v3.js";
import type { ArtifactCapacityLimits } from "./artifact-capacity.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import type { StitchDesignSourceInputV1 } from "./design-source-closure-compiler.js";
import { compileRuntimeStoryPlanV1 } from "./runtime-story-plan-compiler.js";
import { createRuntimePacketCompiler } from "./runtime-packet-compiler.js";
import { resolveCanonicalProductSpecFromPlan } from "./runtime-plan-source.js";
import { selectStitchTargetCandidatesV1 } from "./producers/stitch-target-candidate-selection.js";
import {
  DesignGenerationTargetsV1Schema,
  StitchTargetResponseBindingsV1Schema,
} from "./schemas/design-generation-targets-v1.js";
import {
  StitchDirectResponseEvidenceSchema,
  StitchDirectResponseEvidenceV2Schema,
} from "./schemas/stitch-direct-response-evidence-v2.js";
import { StitchRenderedSemanticsV1Schema } from "./schemas/stitch-rendered-semantics-v1.js";
import {
  StitchTargetCandidateSelectionV1Schema,
  StitchTargetResponseBindingsV2Schema,
} from "./schemas/stitch-target-candidate-selection-v1.js";
import {
  NormalizedRelativeLocatorSchema,
  type SourceArtifactRefV1,
} from "./schemas/common-v1.js";
import {
  BuildTopologyV1Schema,
  topologyPathAbsenceHash,
  type BuildEntrypointV1,
  type BuildTopologyV1,
  type TopologyOwnerV1,
  type TopologyPathBindingV1,
} from "./schemas/build-topology-v1.js";
import type { DesignInteractionGraphV1 } from "./schemas/design-interaction-graph-v1.js";
import type { ProductSpecV1 } from "./schemas/product-spec-v1.js";
import type { StoryPlanV1 } from "./schemas/story-plan-v1.js";
import {
  PRODUCT_DELIVERY_PROFILE_CATALOG_VERSION,
  resolveProductDeliverySelectionV1,
  type ProductDeliverySelectionV1,
} from "./product-delivery-profile-catalog.js";
import {
  getStackTopologyCatalogContract,
  matchesStackEntrypointRule,
  STACK_TOPOLOGY_CATALOG_VERSION,
} from "./stack-topology-catalog.js";
import { PRODUCT_EVIDENCE_CAPABILITY_POLICY_VERSION } from "./product-evidence-capability-policy.js";

export const PRODUCT_COMPILER_RUNTIME_VERSION = "3.5.0";

export type SetupBuildPacketErrorCode =
  | "SETUP_PACKET_ACTIVATION_REJECTED"
  | "SETUP_PACKET_DESIGN_GRAPH_REJECTED"
  | "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED"
  | "SETUP_PACKET_DELIVERY_PROFILE_REJECTED"
  | "SETUP_PACKET_ENTRYPOINT_AMBIGUOUS"
  | "SETUP_PACKET_ENTRYPOINT_MISSING"
  | "SETUP_PACKET_FILE_INVALID"
  | "SETUP_PACKET_GENERATED_SOURCE_AMBIGUOUS"
  | "SETUP_PACKET_GENERATED_SOURCE_MISSING"
  | "SETUP_PACKET_GENERATED_SOURCE_TOPOLOGY_MISSING"
  | "SETUP_PACKET_JSON_INVALID"
  | "SETUP_PACKET_PLAN_REJECTED"
  | "SETUP_PACKET_PROTOCOL_MISMATCH"
  | "SETUP_PACKET_REPO_DIRTY"
  | "SETUP_PACKET_REPO_IDENTITY_INVALID"
  | "SETUP_PACKET_RUNTIME_EVIDENCE_REJECTED"
  | "SETUP_PACKET_RUN_ID_MISMATCH"
  | "SETUP_PACKET_SOURCE_NON_CANONICAL"
  | "SETUP_PACKET_STORY_PLAN_REJECTED"
  | "SETUP_PACKET_TOPOLOGY_OWNER_AMBIGUOUS"
  | "SETUP_PACKET_TOPOLOGY_REJECTED";

export class SetupBuildPacketError extends Error {
  readonly code: SetupBuildPacketErrorCode;
  readonly evidence: Readonly<Record<string, unknown>>;

  constructor(
    code: SetupBuildPacketErrorCode,
    message: string,
    evidence: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "SetupBuildPacketError";
    this.code = code;
    this.evidence = evidence;
  }
}

type ExactSource = Readonly<{
  source: SourceArtifactRefV1;
  bytes: Buffer;
  text: string;
}>;

const ScreenIndexProjectionSchema = z.array(z.object({
  screenId: z.string().min(1).max(500),
  file: NormalizedRelativeLocatorSchema,
}).passthrough()).min(1).max(1_000);

type SetupCertificate = z.infer<typeof SetupCertificateV1Schema>;
type FileTreeManifest = z.infer<typeof FileTreeManifestV1Schema>;
type SharedGrantsArtifact = z.infer<typeof SharedGrantsArtifactV1Schema>;

export type SetupBuildPacketContracts = Readonly<{
  productSpec: ProductSpecV1;
  deliverySelection?: ProductDeliverySelectionV1;
  designGraph: DesignInteractionGraphV1;
  buildTopology: BuildTopologyV1;
  storyPlan: StoryPlanV1;
  designSource?: StitchDesignSourceInputV1;
  sourceHashes: Readonly<{
    plan: string;
    deliverySelection?: string;
    generationTargets: string;
    directResponseEvidence?: string;
    renderedSemantics?: string;
    candidateSelection?: string;
    responseBindings: string;
    screenIndex: string;
    generatedSources: string[];
    setupCertificate: string;
    fileTreeManifest: string;
    sharedGrants: string;
  }>;
}>;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function resolveV3DeliverySelection(input: Readonly<{
  productSpec: ProductSpecV1;
  expectedSelectionHash?: string;
  requestedStackPackId?: string;
}>): Readonly<{ selection: ProductDeliverySelectionV1; selectionHash: string }> {
  const selected = resolveProductDeliverySelectionV1({
    productClass: input.productSpec.product.class,
    ...(input.requestedStackPackId ? { requestedStackPackId: input.requestedStackPackId } : {}),
  });
  if (selected.status !== "selected") {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_DELIVERY_PROFILE_REJECTED",
      "ProductSpec class has no activated Product Compiler delivery profile",
      { diagnostics: selected.diagnostics },
    );
  }
  const delivery = input.productSpec.delivery;
  const expected = selected.selection.delivery;
  const mismatch = !delivery
    || delivery.platform !== expected.platform
    || delivery.techStack !== expected.techStack
    || delivery.designRequired !== expected.designRequired
    || !expected.allowedDatabases.includes(delivery.database);
  if (mismatch) {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_DELIVERY_PROFILE_REJECTED",
      "ProductSpec delivery does not equal its compiler-owned Product Delivery Profile",
      {
        profileId: selected.selection.profileId,
        expected,
        observed: delivery ?? null,
      },
    );
  }
  if (input.expectedSelectionHash && input.expectedSelectionHash !== selected.selectionHash) {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_DELIVERY_PROFILE_REJECTED",
      "Setup-build selection hash does not equal the PLAN-sealed Product Delivery selection",
      {
        expectedSelectionHash: input.expectedSelectionHash,
        actualSelectionHash: selected.selectionHash,
      },
    );
  }
  return { selection: selected.selection, selectionHash: selected.selectionHash };
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isWithinRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === ""
    || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function mediaTypeFor(locator: string): string {
  const extension = path.extname(locator).toLowerCase();
  if (extension === ".json") return "application/json";
  if (extension === ".md") return "text/markdown";
  if ([".ts", ".tsx"].includes(extension)) return "text/typescript";
  if ([".js", ".jsx", ".mjs", ".cjs"].includes(extension)) return "text/javascript";
  if (extension === ".html") return "text/html";
  if (extension === ".css") return "text/css";
  return "application/octet-stream";
}

function readExactSource(repo: string, locatorInput: string): ExactSource {
  const locator = NormalizedRelativeLocatorSchema.parse(locatorInput);
  const root = fs.realpathSync(repo);
  const candidate = path.resolve(root, locator);
  let resolved: string;
  try {
    resolved = fs.realpathSync(candidate);
  } catch (error) {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_FILE_INVALID",
      `Required packet source is missing or unreadable: ${locator}`,
      { locator, cause: error instanceof Error ? error.message : String(error) },
    );
  }
  if (!isWithinRoot(root, resolved)) {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_FILE_INVALID",
      `Packet source resolves outside the repository: ${locator}`,
      { locator },
    );
  }
  const stat = fs.lstatSync(candidate);
  if (stat.isSymbolicLink() || !fs.statSync(resolved).isFile()) {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_FILE_INVALID",
      `Packet source must be a regular in-repository file: ${locator}`,
      { locator },
    );
  }
  const bytes = fs.readFileSync(resolved);
  return {
    source: {
      schema: "setfarm.source-artifact-ref.v1",
      hash: sha256(bytes),
      mediaType: mediaTypeFor(locator),
      locator,
      byteLength: bytes.byteLength,
    },
    bytes,
    text: bytes.toString("utf8"),
  };
}

function readJsonSource<T>(input: Readonly<{
  repo: string;
  locator: string;
  schema: z.ZodType<T>;
  canonical: boolean;
}>): Readonly<{ source: SourceArtifactRefV1; value: T; text: string }> {
  const exact = readExactSource(input.repo, input.locator);
  let value: unknown;
  try {
    value = JSON.parse(exact.text);
  } catch {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_JSON_INVALID",
      `Packet source is not JSON: ${input.locator}`,
      { locator: input.locator, sourceHash: exact.source.hash },
    );
  }
  const parsed = input.schema.safeParse(value);
  if (!parsed.success) {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_JSON_INVALID",
      `Packet source failed its strict schema: ${input.locator}`,
      {
        locator: input.locator,
        sourceHash: exact.source.hash,
        issues: parsed.error.issues.slice(0, 100).map((issue) => ({
          path: issue.path.join("/") || "$",
          message: issue.message,
        })),
      },
    );
  }
  if (input.canonical && canonicalJsonStringify(parsed.data) !== exact.text.trim()) {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_SOURCE_NON_CANONICAL",
      `Packet source is not Setfarm Canonical JSON v1: ${input.locator}`,
      { locator: input.locator, sourceHash: exact.source.hash },
    );
  }
  return { source: exact.source, value: parsed.data, text: exact.text };
}

function gitText(repo: string, args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd: repo,
      encoding: "utf8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_REPO_IDENTITY_INVALID",
      `Cannot resolve exact repository identity with git ${args.join(" ")}`,
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
}

function exactRepoIdentity(repo: string, repoId: string): BuildTopologyV1["repo"] {
  const dirty = gitText(repo, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--",
    ".",
    ":(exclude).setfarm/**",
    ":(exclude)stitch/**",
  ]);
  if (dirty) {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_REPO_DIRTY",
      "Product source differs from the Git tree that would seal the packet",
      { status: dirty.split("\n").slice(0, 100) },
    );
  }
  return {
    id: repoId,
    baseSha: gitText(repo, ["rev-parse", "HEAD"]),
    treeHash: gitText(repo, ["rev-parse", "HEAD^{tree}"]),
  };
}

function safeDeclaredPath(value: string): string | undefined {
  if (/[*?[\]{}]/.test(value)) return undefined;
  const parsed = NormalizedRelativeLocatorSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function inventoryFiles(repo: string): string[] {
  const ignored = new Set([".git", ".setfarm", "stitch", "node_modules", "dist", "build", "coverage"]);
  const files: string[] = [];
  const root = fs.realpathSync(repo);
  const walk = (relative: string): void => {
    const absolute = relative ? path.join(root, relative) : root;
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })
      .sort((left, right) => compareUtf16(left.name, right.name))) {
      if (!relative && ignored.has(entry.name)) continue;
      const locator = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        walk(locator);
      } else if (entry.isFile()) {
        files.push(NormalizedRelativeLocatorSchema.parse(locator));
        if (files.length > 50_000) {
          throw new SetupBuildPacketError(
            "SETUP_PACKET_FILE_INVALID",
            "Repository inventory exceeds the bounded packet topology limit",
            { limit: 50_000 },
          );
        }
      }
    }
  };
  walk("");
  return files;
}

function stableRef(prefix: "OWNER" | "PATH" | "ENTRY", value: string): string {
  if (prefix === "OWNER") {
    const normalized = value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return `OWNER_${normalized || sha256(value).slice(0, 16).toUpperCase()}`;
  }
  return `${prefix}_${sha256(value).slice(0, 20).toUpperCase()}`;
}

function roleForPath(input: Readonly<{
  locator: string;
  entrypointPaths: ReadonlySet<string>;
  targetRoles: readonly string[];
  generatedDesignFiles: ReadonlySet<string>;
}>): TopologyPathBindingV1["role"] {
  if (input.entrypointPaths.has(input.locator)) return "entrypoint";
  if (input.targetRoles.some((role) => role === "fixture_data" || role === "test_bridge")) return "test";
  if (input.generatedDesignFiles.has(input.locator)) return "asset";
  if (/(?:^|\/)(?:package(?:-lock)?\.json|requirements\.txt|pyproject\.toml)$/.test(input.locator)) return "dependency";
  if (/\.(?:json|ya?ml|toml|gradle|config\.[cm]?[jt]s)$/.test(input.locator)) return "config";
  if (/\.(?:ts|tsx|js|jsx|mjs|cjs|py|kt|java|swift|html|css)$/.test(input.locator)) return "source";
  return "asset";
}

function contentIdentity(repo: string, locator: string): Pick<TopologyPathBindingV1, "presence" | "knownContentHash"> {
  const absolute = path.join(repo, locator);
  if (!fs.existsSync(absolute)) {
    return { presence: "absent", knownContentHash: topologyPathAbsenceHash(locator) };
  }
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_FILE_INVALID",
      `Topology path is present but not a regular file: ${locator}`,
      { locator },
    );
  }
  return { presence: "present", knownContentHash: sha256(fs.readFileSync(absolute)) };
}

function selectEntrypoints(input: Readonly<{
  repoFiles: readonly string[];
  stackPackId: string;
  routeRefs: readonly string[];
}>): BuildEntrypointV1[] {
  const catalog = getStackTopologyCatalogContract(input.stackPackId);
  if (!catalog) {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_TOPOLOGY_REJECTED",
      `No versioned topology catalog exists for ${input.stackPackId}`,
      { stackPackId: input.stackPackId },
    );
  }
  const entrypoints: BuildEntrypointV1[] = [];
  for (const kind of catalog.descriptor.requiredEntrypointKinds) {
    const candidates = input.repoFiles.flatMap((locator) => {
      const rules = catalog.descriptor.entrypointRules.filter((rule) =>
        rule.entrypointKind === kind && matchesStackEntrypointRule(locator, rule.matcher));
      if (rules.length > 1) {
        throw new SetupBuildPacketError(
          "SETUP_PACKET_ENTRYPOINT_AMBIGUOUS",
          `Repository path matches multiple ${kind} entrypoint rules: ${locator}`,
          { locator, rules: rules.map((rule) => rule.id) },
        );
      }
      return rules.length === 1 ? [{ locator, rule: rules[0]! }] : [];
    });
    if (candidates.length === 0) {
      throw new SetupBuildPacketError(
        "SETUP_PACKET_ENTRYPOINT_MISSING",
        `No repository file satisfies the ${kind} entrypoint contract for ${input.stackPackId}`,
        { stackPackId: input.stackPackId, kind },
      );
    }
    const winningPriority = Math.min(...candidates.map(({ rule }) => rule.selectionPriority));
    const selected = candidates.filter(({ rule }) => rule.selectionPriority === winningPriority);
    if (selected.length !== 1) {
      throw new SetupBuildPacketError(
        "SETUP_PACKET_ENTRYPOINT_AMBIGUOUS",
        `More than one repository file has winning ${kind} entrypoint priority ${winningPriority}`,
        {
          stackPackId: input.stackPackId,
          kind,
          winningPriority,
          candidates: selected.map(({ locator, rule }) => ({ locator, ruleId: rule.id })),
        },
      );
    }
    const { locator, rule } = selected[0]!;
    entrypoints.push({
      id: stableRef("ENTRY", `${kind}\0${locator}`),
      kind,
      pathRef: stableRef("PATH", locator),
      mountPoint: rule.mountPoint,
      routeRefs: uniqueSorted(input.routeRefs),
    });
  }
  return entrypoints.sort((left, right) => compareUtf16(left.id, right.id));
}

function buildExactSetupSnapshot(input: Readonly<{
  repo: string;
  productSpec: ProductSpecV1;
  certificate: Readonly<{ source: SourceArtifactRefV1; value: SetupCertificate }>;
  manifest: Readonly<{ source: SourceArtifactRefV1; value: FileTreeManifest }>;
  sharedGrants: Readonly<{ source: SourceArtifactRefV1; value: SharedGrantsArtifact }>;
}>): unknown {
  const certificate = input.certificate.value;
  const manifest = input.manifest.value;
  const repoFiles = inventoryFiles(input.repo);
  const entrypoints = selectEntrypoints({
    repoFiles,
    stackPackId: certificate.stackPackId,
    routeRefs: input.productSpec.routes.map((route) => route.id),
  });
  const entrypointPaths = new Set(entrypoints.map((entrypoint) => {
    const suffix = entrypoint.pathRef.slice("PATH_".length);
    return repoFiles.find((locator) => sha256(locator).slice(0, 20).toUpperCase() === suffix)!;
  }));
  const targetsByPath = new Map<string, FileTreeManifest["resolvedTargets"]>();
  manifest.resolvedTargets.forEach((target) => {
    const current = targetsByPath.get(target.path) ?? [];
    current.push(target);
    targetsByPath.set(target.path, current);
  });

  const candidatePaths = new Set<string>([
    ...targetsByPath.keys(),
    ...entrypointPaths,
  ]);
  const optionalDeclared = [
    ...certificate.setupOwnedFiles,
    ...certificate.sharedFiles,
    ...certificate.scaffoldSnapshot,
    ...certificate.generatedDesignFiles,
  ];
  optionalDeclared.forEach((value) => {
    const locator = safeDeclaredPath(value);
    if (!locator) return;
    const absolute = path.join(input.repo, locator);
    if (fs.existsSync(absolute) && fs.lstatSync(absolute).isDirectory()) return;
    candidatePaths.add(locator);
  });

  const setupOwner = "OWNER_SETUP";
  const storyOwner = (storyId: string) => stableRef("OWNER", storyId);
  const generatedDesignFiles = new Set(certificate.generatedDesignFiles.flatMap((value) => {
    const locator = safeDeclaredPath(value);
    return locator ? [locator] : [];
  }));
  const pathBindings: TopologyPathBindingV1[] = [...candidatePaths]
    .sort(compareUtf16)
    .map((locator) => {
      const targets = targetsByPath.get(locator) ?? [];
      const directOwners = uniqueSorted(targets
        .filter((target) => !target.sharedGrantRequestId)
        .map((target) => target.storyId));
      if (directOwners.length > 1) {
        throw new SetupBuildPacketError(
          "SETUP_PACKET_TOPOLOGY_OWNER_AMBIGUOUS",
          `Topology path has multiple ungranted story owners: ${locator}`,
          { locator, storyIds: directOwners },
        );
      }
      const ownerRef = directOwners.length === 1 ? storyOwner(directOwners[0]!) : setupOwner;
      return {
        id: stableRef("PATH", locator),
        path: locator,
        role: roleForPath({
          locator,
          entrypointPaths,
          targetRoles: targets.map((target) => target.role),
          generatedDesignFiles,
        }),
        ownerRef,
        ...contentIdentity(input.repo, locator),
      };
    });
  const ownerIds = new Set(pathBindings.map((binding) => binding.ownerRef));
  const storyIds = uniqueSorted(manifest.resolvedTargets.map((target) => target.storyId));
  const owners: TopologyOwnerV1[] = [
    ...(ownerIds.has(setupOwner) ? [{ id: setupOwner, kind: "setup" as const }] : []),
    ...storyIds.map((storyId) => ({
      id: storyOwner(storyId),
      kind: "story" as const,
      storyRef: storyId,
    })),
  ];

  return {
    schema: "setfarm.setup-topology-snapshot.v1",
    certificate: { source: input.certificate.source, value: input.certificate.value },
    manifest: { source: input.manifest.source, value: input.manifest.value },
    sharedGrants: { source: input.sharedGrants.source, value: input.sharedGrants.value },
    productSpec: input.productSpec,
    repo: exactRepoIdentity(input.repo, certificate.projectSlug),
    owners,
    pathBindings,
    entrypoints,
  };
}

/**
 * Reads only canonical PLAN/design outputs and strict setup source files. The
 * DB story rows and setup command prose are deliberately outside this input.
 */
export function assembleSetupBuildPacketContracts(input: Readonly<{
  runId: string;
  repo: string;
  planText: string;
  requireV3Proposal?: boolean;
  expectedDeliverySelectionHash?: string;
  requestedStackPackId?: string;
}>): SetupBuildPacketContracts {
  const plan = resolveCanonicalProductSpecFromPlan({
    text: input.planText,
    locator: "pipeline/plan.md",
    requireV3Proposal: input.requireV3Proposal,
  });
  if (plan.status !== "resolved") {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_PLAN_REJECTED",
      `Canonical PLAN ProductSpec was rejected: ${plan.rejectionCodes.join(",")}`,
      { rejectionCodes: plan.rejectionCodes, diagnostics: plan.diagnostics },
    );
  }
  const deliverySelection = input.requireV3Proposal
    ? resolveV3DeliverySelection({
        productSpec: plan.productSpec,
        ...(input.expectedDeliverySelectionHash
          ? { expectedSelectionHash: input.expectedDeliverySelectionHash }
          : {}),
        ...(input.requestedStackPackId
          ? { requestedStackPackId: input.requestedStackPackId }
          : {}),
      })
    : undefined;

  const generationTargets = readJsonSource({
    repo: input.repo,
    locator: "stitch/GENERATION_TARGETS.json",
    schema: DesignGenerationTargetsV1Schema,
    canonical: true,
  });
  const responseBindings = readJsonSource({
    repo: input.repo,
    locator: "stitch/STITCH_RESPONSE_BINDINGS.json",
    schema: z.union([
      StitchTargetResponseBindingsV2Schema,
      StitchTargetResponseBindingsV1Schema,
    ]),
    canonical: true,
  });
  if (input.requireV3Proposal && responseBindings.value.schema !== "setfarm.stitch-target-response-bindings.v2") {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED",
      "Product Compiler v3 requires response bindings v2 produced by canonical candidate selection",
      { observedSchema: responseBindings.value.schema },
    );
  }
  const candidateSelectionPath = path.join(input.repo, "stitch", "STITCH_TARGET_CANDIDATE_SELECTION.json");
  if (
    (input.requireV3Proposal || responseBindings.value.schema === "setfarm.stitch-target-response-bindings.v2")
    && !fs.existsSync(candidateSelectionPath)
  ) {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED",
      "Selected Stitch response bindings require canonical candidate-selection authority",
      { locator: "stitch/STITCH_TARGET_CANDIDATE_SELECTION.json" },
    );
  }
  const candidateSelection = fs.existsSync(candidateSelectionPath)
    ? readJsonSource({
        repo: input.repo,
        locator: "stitch/STITCH_TARGET_CANDIDATE_SELECTION.json",
        schema: StitchTargetCandidateSelectionV1Schema,
        canonical: true,
      })
    : undefined;
  const directResponseEvidencePath = path.join(input.repo, "stitch", "STITCH_DIRECT_RESPONSE_EVIDENCE.json");
  if (input.requireV3Proposal && !fs.existsSync(directResponseEvidencePath)) {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED",
      "Product Compiler v3 requires canonical direct Stitch response evidence",
      { locator: "stitch/STITCH_DIRECT_RESPONSE_EVIDENCE.json" },
    );
  }
  const directResponseEvidence = fs.existsSync(directResponseEvidencePath)
    ? readJsonSource({
        repo: input.repo,
        locator: "stitch/STITCH_DIRECT_RESPONSE_EVIDENCE.json",
        schema: StitchDirectResponseEvidenceSchema,
        canonical: true,
      })
    : undefined;
  const renderedSemanticsPath = path.join(input.repo, "stitch", "STITCH_RENDERED_SEMANTICS.json");
  if (
    (input.requireV3Proposal || responseBindings.value.schema === "setfarm.stitch-target-response-bindings.v2")
    && !fs.existsSync(renderedSemanticsPath)
  ) {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED",
      "Product Compiler v3 requires canonical browser-rendered Stitch semantics",
      { locator: "stitch/STITCH_RENDERED_SEMANTICS.json" },
    );
  }
  const renderedSemantics = fs.existsSync(renderedSemanticsPath)
    ? readJsonSource({
        repo: input.repo,
        locator: "stitch/STITCH_RENDERED_SEMANTICS.json",
        schema: StitchRenderedSemanticsV1Schema,
        canonical: true,
      })
    : undefined;
  if (responseBindings.value.schema === "setfarm.stitch-target-response-bindings.v2") {
    if (!candidateSelection || !directResponseEvidence || !renderedSemantics) {
      throw new SetupBuildPacketError(
        "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED",
        "Response bindings v2 require rendered semantics, candidate selection, and direct response evidence",
      );
    }
    if (
      directResponseEvidence.value.schema !== "setfarm.stitch-direct-response-evidence.v2"
      ||
      candidateSelection.value.generationTargetsHash !== hashCanonicalJson(generationTargets.value)
      || candidateSelection.value.directResponseEvidenceHash !== hashCanonicalJson(directResponseEvidence.value)
      || renderedSemantics.value.generationTargetsHash !== hashCanonicalJson(generationTargets.value)
      || renderedSemantics.value.directResponseEvidenceHash !== hashCanonicalJson(directResponseEvidence.value)
      || candidateSelection.value.renderedSemanticsHash !== hashCanonicalJson(renderedSemantics.value)
      || responseBindings.value.candidateSelectionHash !== hashCanonicalJson(candidateSelection.value)
      || responseBindings.value.renderedSemanticsHash !== hashCanonicalJson(renderedSemantics.value)
      || candidateSelection.value.downloadReceiptPolicy !== "required"
      || candidateSelection.value.semanticEvidencePolicy !== "browser_rendered_v1"
    ) {
      throw new SetupBuildPacketError(
        "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED",
        "Stitch generation targets, direct evidence, candidate selection, and v2 bindings do not form one hash chain",
      );
    }
    const directResponseEvidenceV2 = StitchDirectResponseEvidenceV2Schema.parse(directResponseEvidence.value);
    for (const resource of renderedSemantics.value.resources) {
      const source = readExactSource(input.repo, resource.locator);
      if (source.source.hash !== resource.contentHash || source.source.byteLength !== resource.byteLength) {
        throw new SetupBuildPacketError(
          "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED",
          `Rendered-semantics resource sidecar differs from sealed evidence: ${resource.urlHash}`,
        );
      }
    }
    for (const candidate of renderedSemantics.value.candidates) {
      if (candidate.status !== "rendered" || !candidate.semanticDom) continue;
      const source = readExactSource(input.repo, candidate.semanticDom.locator);
      if (source.source.hash !== candidate.semanticDom.hash || source.source.byteLength !== candidate.semanticDom.byteLength) {
        throw new SetupBuildPacketError(
          "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED",
          `Rendered semantic DOM sidecar differs from sealed evidence: ${candidate.screenId}`,
        );
      }
    }
    const recomputedArtifacts = directResponseEvidenceV2.batches.flatMap((batch) =>
      batch.candidates.map((candidate) => {
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,499}$/.test(candidate.screenId)) {
          return { screenId: candidate.screenId };
        }
        const archivedHtmlLocator = `stitch/candidates/${candidate.screenId}.html`;
        const archivedScreenshotLocator = `stitch/candidates/${candidate.screenId}.png`;
        const htmlLocator = fs.existsSync(path.join(input.repo, archivedHtmlLocator))
          ? archivedHtmlLocator
          : `stitch/${candidate.screenId}.html`;
        const screenshotLocator = fs.existsSync(path.join(input.repo, archivedScreenshotLocator))
          ? archivedScreenshotLocator
          : `stitch/${candidate.screenId}.png`;
        return {
          screenId: candidate.screenId,
          ...(fs.existsSync(path.join(input.repo, htmlLocator)) ? { htmlBytes: readExactSource(input.repo, htmlLocator).bytes } : {}),
          ...(fs.existsSync(path.join(input.repo, screenshotLocator)) ? { screenshotBytes: readExactSource(input.repo, screenshotLocator).bytes } : {}),
        };
      }));
    const recomputedSelection = selectStitchTargetCandidatesV1({
      generationTargets: generationTargets.value,
      directResponseEvidence: directResponseEvidenceV2,
      renderedSemantics: renderedSemantics.value,
      artifacts: recomputedArtifacts,
      authorityMode: "clean_v3",
    });
    if (
      recomputedSelection.status !== "produced"
      || canonicalJsonStringify(recomputedSelection.candidateSelection) !== canonicalJsonStringify(candidateSelection.value)
    ) {
      throw new SetupBuildPacketError(
        "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED",
        "Candidate selection does not equal the deterministic producer result over current exact artifact bytes",
        { rejectionCodes: "rejectionCodes" in recomputedSelection ? recomputedSelection.rejectionCodes : [] },
      );
    }
    const evidenceCandidateById = new Map(directResponseEvidenceV2.batches.flatMap((batch) =>
      batch.candidates.map((candidate) => [candidate.screenId, { batch, candidate }] as const)));
    for (const candidate of candidateSelection.value.candidates) {
      const evidence = evidenceCandidateById.get(candidate.screenId);
      if (
        !evidence
        || evidence.batch.stageId !== candidate.stageId
        || canonicalJsonStringify([...evidence.batch.targetRefs].sort(compareUtf16)) !== canonicalJsonStringify(candidate.targetRefs)
        || evidence.candidate.title !== candidate.title
        || canonicalJsonStringify([...evidence.candidate.responsePaths].sort(compareUtf16)) !== canonicalJsonStringify(candidate.responsePaths)
        || evidence.candidate.disposition !== candidate.renderDisposition
        || canonicalJsonStringify(evidence.candidate.identityConflicts) !== canonicalJsonStringify(candidate.identityConflicts)
        || canonicalJsonStringify(evidence.candidate.missingEvidence) !== canonicalJsonStringify(candidate.missingEvidence)
        || (evidence.candidate.htmlSourceRefHash ?? null) !== candidate.htmlSourceRefHash
        || (evidence.candidate.screenshotSourceRefHash ?? null) !== candidate.screenshotSourceRefHash
        || (evidence.candidate.htmlDownloadedArtifactHash ?? null) !== candidate.htmlDownloadedArtifactHash
        || (evidence.candidate.screenshotDownloadedArtifactHash ?? null) !== candidate.screenshotDownloadedArtifactHash
      ) {
        throw new SetupBuildPacketError(
          "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED",
          `Candidate selection rewrites or loses direct response evidence: ${candidate.screenId}`,
          { candidate, evidence },
        );
      }
      if (candidate.htmlArtifactHash) {
        const archivedLocator = `stitch/candidates/${candidate.screenId}.html`;
        const html = readExactSource(
          input.repo,
          fs.existsSync(path.join(input.repo, archivedLocator)) ? archivedLocator : `stitch/${candidate.screenId}.html`,
        );
        if (html.source.hash !== candidate.htmlArtifactHash) {
          throw new SetupBuildPacketError(
            "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED",
            `Candidate HTML bytes differ from sealed selection: ${candidate.screenId}`,
          );
        }
      }
      if (candidate.screenshotArtifactHash) {
        const archivedLocator = `stitch/candidates/${candidate.screenId}.png`;
        const screenshot = readExactSource(
          input.repo,
          fs.existsSync(path.join(input.repo, archivedLocator)) ? archivedLocator : `stitch/${candidate.screenId}.png`,
        );
        if (screenshot.source.hash !== candidate.screenshotArtifactHash) {
          throw new SetupBuildPacketError(
            "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED",
            `Candidate screenshot bytes differ from sealed selection: ${candidate.screenId}`,
          );
        }
      }
    }
    if (candidateSelection.value.candidates.length !== evidenceCandidateById.size) {
      throw new SetupBuildPacketError(
        "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED",
        "Candidate selection must preserve the complete direct response candidate set",
      );
    }
    const selectionByTarget = new Map(candidateSelection.value.selections.map((selection) => [selection.targetRef, selection]));
    const candidateById = new Map(candidateSelection.value.candidates.map((candidate) => [candidate.screenId, candidate]));
    const renderedById = new Map(renderedSemantics.value.candidates.map((candidate) => [candidate.screenId, candidate]));
    for (const binding of responseBindings.value.bindings) {
      const selection = selectionByTarget.get(binding.targetRef);
      const candidate = candidateById.get(binding.responseScreenId);
      const rendered = renderedById.get(binding.responseScreenId);
      const operationalHtml = readExactSource(input.repo, `stitch/${binding.responseScreenId}.html`);
      const operationalScreenshot = readExactSource(input.repo, `stitch/${binding.responseScreenId}.png`);
      if (
        selection?.status !== "selected"
        || selection.selectedScreenId !== binding.responseScreenId
        || selection.stageId !== binding.stageId
        || !candidate
        || candidate.title !== binding.responseTitle
        || candidate.htmlArtifactValidity !== "valid"
        || candidate.screenshotArtifactValidity !== "valid"
        || candidate.htmlArtifactHash !== binding.htmlArtifactHash
        || candidate.screenshotArtifactHash !== binding.screenshotArtifactHash
        || candidate.semanticDomHash !== binding.semanticDomHash
        || candidate.semanticObservationHash !== binding.semanticObservationHash
        || rendered?.status !== "rendered"
        || rendered.semanticDom?.hash !== binding.semanticDomHash
        || rendered.observationHash !== binding.semanticObservationHash
        || binding.contractElementRefs.some((elementRef) =>
          !rendered.elements.some((element) => element.elementRef === elementRef))
        || operationalHtml.source.hash !== binding.htmlArtifactHash
        || operationalScreenshot.source.hash !== binding.screenshotArtifactHash
      ) {
        throw new SetupBuildPacketError(
          "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED",
          `Response binding does not equal the canonical selected candidate: ${binding.targetRef}`,
        );
      }
    }
    if (
      responseBindings.value.bindings.length !== generationTargets.value.targets.length
      || candidateSelection.value.selections.some((selection) => selection.status !== "selected")
    ) {
      throw new SetupBuildPacketError(
        "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED",
        "Every generation target requires exactly one selected candidate and v2 response binding",
      );
    }
  } else if (directResponseEvidence) {
    const directCandidateById = new Map(directResponseEvidence.value.batches.flatMap((batch) =>
      batch.candidates.map((candidate) => [candidate.screenId, { batch, candidate }] as const)));
    const admittedCandidates = directResponseEvidence.value.batches.flatMap((batch) =>
      batch.candidates.filter((candidate) => candidate.disposition === "admitted_renderable_screen"));
    for (const binding of responseBindings.value.bindings) {
      const evidence = directCandidateById.get(binding.responseScreenId);
      if (
        !evidence ||
        evidence.candidate.disposition !== "admitted_renderable_screen" ||
        evidence.candidate.title !== binding.responseTitle ||
        evidence.batch.stageId !== binding.stageId
      ) {
        throw new SetupBuildPacketError(
          "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED",
          `Exact Stitch binding lacks matching admitted direct response evidence: ${binding.responseScreenId}`,
          {
            responseScreenId: binding.responseScreenId,
            responseTitle: binding.responseTitle,
            stageId: binding.stageId,
            observed: evidence,
          },
        );
      }
    }
    if (admittedCandidates.length !== responseBindings.value.bindings.length) {
      throw new SetupBuildPacketError(
        "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED",
        "Admitted direct Stitch response evidence must equal the exact binding set",
        {
          admittedScreenIds: admittedCandidates.map((candidate) => candidate.screenId).sort(compareUtf16),
          boundScreenIds: responseBindings.value.bindings.map((binding) => binding.responseScreenId).sort(compareUtf16),
        },
      );
    }
  }
  const screenIndex = readJsonSource({
    repo: input.repo,
    locator: "src/screens/SCREEN_INDEX.json",
    schema: ScreenIndexProjectionSchema,
    canonical: false,
  });
  const indexByScreen = new Map<string, z.infer<typeof ScreenIndexProjectionSchema>[number]>();
  screenIndex.value.forEach((entry) => {
    if (indexByScreen.has(entry.screenId)) {
      throw new SetupBuildPacketError(
        "SETUP_PACKET_GENERATED_SOURCE_AMBIGUOUS",
        `SCREEN_INDEX repeats response screen ${entry.screenId}`,
        { screenId: entry.screenId },
      );
    }
    indexByScreen.set(entry.screenId, entry);
  });
  const generatedLocators = new Set<string>();
  const generatedSources = responseBindings.value.bindings.map((binding) => {
    const indexed = indexByScreen.get(binding.responseScreenId);
    if (!indexed) {
      throw new SetupBuildPacketError(
        "SETUP_PACKET_GENERATED_SOURCE_MISSING",
        `Exact Stitch response is absent from SCREEN_INDEX: ${binding.responseScreenId}`,
        { targetRef: binding.targetRef, responseScreenId: binding.responseScreenId },
      );
    }
    if (generatedLocators.has(indexed.file)) {
      throw new SetupBuildPacketError(
        "SETUP_PACKET_GENERATED_SOURCE_AMBIGUOUS",
        `More than one Stitch target resolves to generated file ${indexed.file}`,
        { locator: indexed.file },
      );
    }
    generatedLocators.add(indexed.file);
    const exact = readExactSource(input.repo, indexed.file);
    return { targetRef: binding.targetRef, source: exact.source, text: exact.text };
  });
  if (indexByScreen.size !== generatedSources.length) {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_GENERATED_SOURCE_AMBIGUOUS",
      "SCREEN_INDEX contains an entry without an exact direct Stitch response binding",
      { indexedScreens: [...indexByScreen.keys()].sort(compareUtf16) },
    );
  }
  const design = produceDesignGraphFromExactStitchScreenIndexV4({
    productSpec: plan.productSpec,
    generationTargets: generationTargets.value,
    ...(candidateSelection ? { candidateSelection: candidateSelection.value } : {}),
    ...(renderedSemantics ? { renderedSemantics: renderedSemantics.value } : {}),
    authoritySourceHashes: [
      generationTargets.source.hash,
      responseBindings.source.hash,
      ...(candidateSelection ? [candidateSelection.source.hash] : []),
      ...(directResponseEvidence ? [
        directResponseEvidence.source.hash,
        hashCanonicalJson(directResponseEvidence.value),
      ] : []),
      ...(renderedSemantics ? [
        renderedSemantics.source.hash,
        hashCanonicalJson(renderedSemantics.value),
      ] : []),
    ].sort(compareUtf16),
    responseBindings: responseBindings.value,
    screenIndex: { source: screenIndex.source, text: screenIndex.text },
    generatedSources,
  });
  if (design.status !== "produced") {
    const rejectionCodes = "rejectionCodes" in design
      ? design.rejectionCodes
      : ["DESIGN_GRAPH_PRODUCER_NOT_EXECUTED"];
    throw new SetupBuildPacketError(
      "SETUP_PACKET_DESIGN_GRAPH_REJECTED",
      `Exact Stitch DesignGraph was rejected: ${rejectionCodes.join(",")}`,
      { rejectionCodes, diagnostics: design.diagnostics },
    );
  }

  const certificate = readJsonSource({
    repo: input.repo,
    locator: ".setfarm/setup/SETUP_CERTIFICATE.json",
    schema: SetupCertificateV1Schema,
    canonical: false,
  });
  const manifest = readJsonSource({
    repo: input.repo,
    locator: ".setfarm/setup/FILE_TREE_MANIFEST.json",
    schema: FileTreeManifestV1Schema,
    canonical: false,
  });
  const sharedGrants = readJsonSource({
    repo: input.repo,
    locator: ".setfarm/setup/SHARED_GRANTS.json",
    schema: SharedGrantsArtifactV1Schema,
    canonical: false,
  });
  if (deliverySelection && (
    certificate.value.stackPackId !== deliverySelection.selection.stackPackId
    || certificate.value.platform !== deliverySelection.selection.delivery.platform
    || certificate.value.techStack !== deliverySelection.selection.delivery.techStack
    || certificate.value.designAuthority.conversionPolicy !== deliverySelection.selection.design.conversionPolicy
  )) {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_DELIVERY_PROFILE_REJECTED",
      "Setup certificate topology does not equal the PLAN-sealed Product Delivery selection",
      {
        profileId: deliverySelection.selection.profileId,
        expected: {
          stackPackId: deliverySelection.selection.stackPackId,
          platform: deliverySelection.selection.delivery.platform,
          techStack: deliverySelection.selection.delivery.techStack,
          conversionPolicy: deliverySelection.selection.design.conversionPolicy,
        },
        observed: {
          stackPackId: certificate.value.stackPackId,
          platform: certificate.value.platform,
          techStack: certificate.value.techStack,
          conversionPolicy: certificate.value.designAuthority.conversionPolicy,
        },
      },
    );
  }
  const sourceRunIds = [
    certificate.value.runId,
    manifest.value.runId,
    sharedGrants.value.runId,
  ];
  if (sourceRunIds.some((runId) => runId !== input.runId)) {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_RUN_ID_MISMATCH",
      "Setup sources do not belong to the packet compilation run",
      { expectedRunId: input.runId, sourceRunIds },
    );
  }
  const targetById = new Map(generationTargets.value.targets.map((target) => [target.targetId, target]));
  const responseByTarget = new Map(responseBindings.value.bindings.map((binding) => [binding.targetRef, binding]));
  generatedSources.forEach((source) => {
    const target = targetById.get(source.targetRef);
    const response = responseByTarget.get(source.targetRef);
    const exactTargets = manifest.value.resolvedTargets.filter((candidate) =>
      candidate.role === "surface_component"
      && candidate.path === source.source.locator
      && candidate.surfaceId === target?.surfaceRef
      && candidate.screenId === response?.responseScreenId);
    if (exactTargets.length !== 1) {
      throw new SetupBuildPacketError(
        "SETUP_PACKET_GENERATED_SOURCE_TOPOLOGY_MISSING",
        `Generated source must have one exact surface/path/screen topology target: ${source.source.locator}`,
        {
          targetRef: source.targetRef,
          surfaceRef: target?.surfaceRef,
          responseScreenId: response?.responseScreenId,
          locator: source.source.locator,
          observedTargets: exactTargets.length,
        },
      );
    }
  });
  const topology = adaptExactSetupTopologyV1(buildExactSetupSnapshot({
    repo: input.repo,
    productSpec: plan.productSpec,
    certificate,
    manifest,
    sharedGrants,
  }));
  if (!topology.candidate) {
    const diagnosticSummary = topology.diagnostics
      .slice(0, 20)
      .map((item) => `${item.code}:${item.reference ?? "$"}:${item.message}`)
      .join(";");
    throw new SetupBuildPacketError(
      "SETUP_PACKET_TOPOLOGY_REJECTED",
      `Exact setup BuildTopology was rejected: ${diagnosticSummary}`,
      { diagnostics: topology.diagnostics },
    );
  }
  const deliveryBoundTopology = deliverySelection
    ? BuildTopologyV1Schema.parse({
        ...topology.candidate,
        deliveryProfile: {
          schema: "setfarm.product-delivery-selection-ref.v1",
          profileId: deliverySelection.selection.profileId,
          catalogVersion: deliverySelection.selection.catalogVersion,
          catalogHash: deliverySelection.selection.catalogHash,
          selectionHash: deliverySelection.selectionHash,
          productClass: deliverySelection.selection.productClass,
          stackPackId: deliverySelection.selection.stackPackId,
          designProjection: deliverySelection.selection.design.projection,
          topologyDescriptorHash: deliverySelection.selection.topology.descriptorHash,
        },
      })
    : topology.candidate;
  const runtimeEvidence = deliverySelection
    ? produceRuntimeEvidenceContractV1({
        productSpec: plan.productSpec,
        buildTopology: deliveryBoundTopology,
      })
    : undefined;
  if (runtimeEvidence?.status === "unsupported") {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_RUNTIME_EVIDENCE_REJECTED",
      `Product Compiler v3 cannot seal unsupported runtime evidence stack ${runtimeEvidence.stackPackId}`,
      { stackPackId: runtimeEvidence.stackPackId },
    );
  }
  if (runtimeEvidence?.status === "rejected") {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_RUNTIME_EVIDENCE_REJECTED",
      `Product Compiler v3 runtime evidence projection was rejected: ${runtimeEvidence.rejectionCode}`,
      { rejectionCode: runtimeEvidence.rejectionCode },
    );
  }
  const buildTopology = runtimeEvidence?.status === "produced"
    ? BuildTopologyV1Schema.parse({
        ...deliveryBoundTopology,
        runtimeEvidenceContract: runtimeEvidence.contract,
        runtimeEvidenceContractHash: hashRuntimeEvidenceContractV1(runtimeEvidence.contract),
      })
    : deliveryBoundTopology;
  const stories = compileRuntimeStoryPlanV1({
    productSpec: plan.productSpec,
    designGraph: design.designGraph,
    buildTopology,
  });
  if (stories.status !== "compiled") {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_STORY_PLAN_REJECTED",
      `Runtime StoryPlan was rejected: ${stories.rejectionCodes.join(",")}`,
      { rejectionCodes: stories.rejectionCodes, diagnostics: stories.diagnostics },
    );
  }
  const designSource = responseBindings.value.schema === "setfarm.stitch-target-response-bindings.v2"
    && directResponseEvidence?.value.schema === "setfarm.stitch-direct-response-evidence.v2"
    && renderedSemantics
    && candidateSelection
    ? {
        kind: "stitch" as const,
        generationTargets: generationTargets.value,
        directResponseEvidence: directResponseEvidence.value,
        renderedSemantics: renderedSemantics.value,
        candidateSelection: candidateSelection.value,
        responseBindings: responseBindings.value,
      }
    : undefined;
  if (input.requireV3Proposal && !designSource) {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED",
      "Product Compiler v3 requires one typed Stitch design-source closure input",
    );
  }
  return {
    productSpec: plan.productSpec,
    ...(deliverySelection ? { deliverySelection: deliverySelection.selection } : {}),
    designGraph: design.designGraph,
    buildTopology,
    storyPlan: stories.storyPlan,
    ...(designSource ? { designSource } : {}),
    sourceHashes: {
      plan: plan.sourceHash,
      ...(deliverySelection ? { deliverySelection: deliverySelection.selectionHash } : {}),
      generationTargets: generationTargets.source.hash,
      ...(directResponseEvidence ? { directResponseEvidence: directResponseEvidence.source.hash } : {}),
      ...(renderedSemantics ? { renderedSemantics: renderedSemantics.source.hash } : {}),
      ...(candidateSelection ? { candidateSelection: candidateSelection.source.hash } : {}),
      responseBindings: responseBindings.source.hash,
      screenIndex: screenIndex.source.hash,
      generatedSources: generatedSources.map((source) => source.source.hash).sort(compareUtf16),
      setupCertificate: certificate.source.hash,
      fileTreeManifest: manifest.source.hash,
      sharedGrants: sharedGrants.source.hash,
    },
  };
}

export async function orchestrateSetupBuildProductPacket(input: Readonly<{
  sql: postgres.Sql;
  artifactRoot: string;
  artifactLimits: ArtifactCapacityLimits;
  runId: string;
  expectedMode: "shadow" | "v3";
  repo: string;
  planText: string;
  expectedDeliverySelectionHash?: string;
  requestedStackPackId?: string;
  ownerInstanceId?: string;
}>) {
  const protocol = await createRunProtocolRepository(input.sql).read(input.runId);
  if (protocol.mode !== input.expectedMode || !protocol.compilerReleaseSha) {
    throw new SetupBuildPacketError(
      "SETUP_PACKET_PROTOCOL_MISMATCH",
      `Run ${input.runId} protocol/release does not authorize ${input.expectedMode} packet compilation`,
      { storedMode: protocol.mode, expectedMode: input.expectedMode },
    );
  }
  const contracts = assembleSetupBuildPacketContracts({
    runId: input.runId,
    repo: input.repo,
    planText: input.planText,
    requireV3Proposal: input.expectedMode === "v3",
    ...(input.expectedDeliverySelectionHash
      ? { expectedDeliverySelectionHash: input.expectedDeliverySelectionHash }
      : {}),
    ...(input.requestedStackPackId
      ? { requestedStackPackId: input.requestedStackPackId }
      : {}),
  });
  const compiler = createRuntimePacketCompiler({
    sql: input.sql,
    artifactRoot: input.artifactRoot,
    artifactLimits: input.artifactLimits,
    ownerInstanceId: input.ownerInstanceId,
  });
  const compilation = await compiler.compile({
    runId: input.runId,
    expectedMode: input.expectedMode,
    productSpec: contracts.productSpec,
    designGraph: contracts.designGraph,
    buildTopology: contracts.buildTopology,
    storyPlan: contracts.storyPlan,
    ...(input.expectedMode === "v3" && contracts.designSource
      ? { designSource: contracts.designSource }
      : {}),
    compiler: {
      version: PRODUCT_COMPILER_RUNTIME_VERSION,
      codeSha: protocol.compilerReleaseSha,
    },
    producer: {
      pass: "setup-build-product-packet-v3",
      codeSha: protocol.compilerReleaseSha,
      toolVersions: {
        node: process.versions.node,
        productCompiler: PRODUCT_COMPILER_RUNTIME_VERSION,
        stackTopologyCatalog: STACK_TOPOLOGY_CATALOG_VERSION,
        productDeliveryProfileCatalog: PRODUCT_DELIVERY_PROFILE_CATALOG_VERSION,
        productEvidenceCapabilityPolicy: PRODUCT_EVIDENCE_CAPABILITY_POLICY_VERSION,
        runtimeEvidenceContractProducer: RUNTIME_EVIDENCE_CONTRACT_PRODUCER_VERSION,
      },
    },
  });
  return Object.freeze({ contracts, compilation });
}

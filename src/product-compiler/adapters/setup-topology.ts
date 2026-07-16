import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { produceBuildTopologyV1 } from "../producers/build-topology.js";
import {
  BuildEntrypointV1Schema,
  BuildTopologyV1Schema,
  TopologyOwnerV1Schema,
  TopologyPathBindingV1Schema,
  type BuildTopologyV1,
} from "../schemas/build-topology-v1.js";
import {
  NormalizedRelativeLocatorSchema,
  SharedGrantIdSchema,
  SourceArtifactRefV1Schema,
  StoryIdSchema,
} from "../schemas/common-v1.js";
import { ProductSpecV1OrV2Schema } from "../schemas/product-spec-v2.js";
import { RuntimeDataProvisioningV1Schema } from "../schemas/runtime-data-contract-v1.js";
import {
  getStackTopologyCatalogContract,
  matchesStackEntrypointRule,
} from "../stack-topology-catalog.js";
import {
  adapterDiagnostic,
  finalizeAdapterResult,
  invalidCandidateDiagnostics,
  provenanceFromSource,
  type AdapterResult,
} from "./types.js";

const SetupTopologyAdapterInputSchema = z
  .object({
    sources: z.array(SourceArtifactRefV1Schema).min(1).max(100),
    topology: z.unknown(),
  })
  .strict();

export function adaptSetupTopology(input: unknown): AdapterResult<BuildTopologyV1> {
  const parsed = SetupTopologyAdapterInputSchema.safeParse(input);
  if (!parsed.success) {
    return finalizeAdapterResult({
      diagnostics: parsed.error.issues.slice(0, 100).map((issue) => adapterDiagnostic({
        code: "ADAPTER_TOPOLOGY_INPUT_INVALID",
        severity: "error",
        message: `Setup topology input failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      })),
    });
  }
  const provenance = parsed.data.sources.map((source) =>
    provenanceFromSource(source, "derived_with_provenance"));
  const result = BuildTopologyV1Schema.safeParse(parsed.data.topology);
  if (!result.success) {
    return finalizeAdapterResult({
      diagnostics: invalidCandidateDiagnostics(
        "ADAPTER_TOPOLOGY_CONTRACT_INVALID",
        parsed.data.sources[0],
        result.error,
      ),
      provenance,
    });
  }
  return finalizeAdapterResult({ candidate: result.data, provenance });
}

const ScopeTargetRoleSchema = z.enum([
  "app_shell",
  "route_registration",
  "surface_component",
  "action_handler",
  "state_store",
  "fixture_data",
  "persistence_adapter",
  "test_bridge",
  "style_integration",
  "game_runtime",
  "api_route",
  "cli_command",
]);

const StringRecordSchema = z.record(z.string(), z.string());
const UnknownRecordSchema = z.record(z.string(), z.unknown());

const DependencyRequestSchema = z
  .object({
    name: z.string().min(1).max(500),
    ecosystem: z.string().min(1).max(100).optional(),
    reason: z.string().max(2_000).optional(),
    requested_by_action_ids: z.array(z.string().min(1).max(160)).max(5_000).optional(),
  })
  .strict();

const RejectedDependencyRequestSchema = DependencyRequestSchema.extend({
  reason: z.string().min(1).max(2_000),
});

const DependencyEvidenceSchema = z
  .object({
    requested: z.array(DependencyRequestSchema).max(5_000),
    approved: z.array(DependencyRequestSchema).max(5_000),
    installed: z.array(DependencyRequestSchema).max(5_000),
    rejected: z.array(RejectedDependencyRequestSchema).max(5_000),
  })
  .strict();

const DesignAuthoritySchema = z
  .object({
    required: z.boolean(),
    source: z.enum(["stitch", "none"]),
    screenMap: z.string().max(1_024),
    rules: z.array(z.string().min(1).max(2_000)).max(1_000),
    conversionPolicy: z.string().min(1).max(160),
    conversionNote: z.string().max(2_000),
  })
  .strict();

export const SetupCertificateV1Schema = z
  .object({
    schema: z.literal("setfarm.setup-certificate.v1"),
    runId: z.string().min(1).max(200),
    projectName: z.string().min(1).max(500),
    projectSlug: z.string().min(1).max(200),
    platform: z.string().min(1).max(200),
    techStack: z.string().min(1).max(500),
    stackPackId: z.string().min(1).max(160),
    commands: StringRecordSchema,
    entrypoints: z.array(z.string().min(1).max(1_024)).max(1_000),
    setupOwnedFiles: z.array(z.string().min(1).max(1_024)).max(20_000),
    forbiddenDuringImplement: z.array(z.string().min(1).max(1_024)).max(20_000),
    sharedFiles: z.array(z.string().min(1).max(1_024)).max(20_000),
    scaffoldSnapshot: z.array(NormalizedRelativeLocatorSchema).max(20_000),
    generatedDesignFiles: z.array(NormalizedRelativeLocatorSchema).max(20_000),
    designAuthority: DesignAuthoritySchema,
    fileTreeManifestPath: NormalizedRelativeLocatorSchema,
    sharedGrantsPath: NormalizedRelativeLocatorSchema,
    targetResolutionRules: UnknownRecordSchema,
    routerParadigm: z.string().min(1).max(160).optional(),
    slugRules: StringRecordSchema.optional(),
    slugRuleTests: z.array(StringRecordSchema).max(1_000).optional(),
    sharedEditValidationPolicy: z.string().min(1).max(160).optional(),
    patchWindowMarkers: z.array(StringRecordSchema).max(1_000).optional(),
    utilityFilePolicy: UnknownRecordSchema.optional(),
    buildStrippingPolicy: UnknownRecordSchema.optional(),
    sandboxPrewarm: UnknownRecordSchema.optional(),
    prewarmEvidencePath: z.string().min(1).max(1_024).optional(),
    mockInjectionContract: UnknownRecordSchema.optional(),
    designImportValidate: UnknownRecordSchema.optional(),
    designVisualSmoke: UnknownRecordSchema.optional(),
    dependencyEvidence: DependencyEvidenceSchema,
    dependencyResolutionPolicy: UnknownRecordSchema.optional(),
    buildEvidence: StringRecordSchema,
    runtimeDataProvisioning: RuntimeDataProvisioningV1Schema.optional(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

const ResolvedTargetV1Schema = z
  .object({
    storyId: StoryIdSchema,
    role: ScopeTargetRoleSchema,
    surfaceId: z.string().min(1).max(160).optional(),
    screenId: z.string().min(1).max(200).optional(),
    domainSlug: z.string().min(1).max(200),
    targetSlug: z.string().min(1).max(200),
    path: NormalizedRelativeLocatorSchema,
    resolvedPath: NormalizedRelativeLocatorSchema,
    ruleId: z.string().min(1).max(500),
    sharedEdit: z.boolean().optional(),
    editScope: z.string().min(1).max(2_000).optional(),
    collisionStatus: z.enum(["unique", "pending_shared_grant", "shared"]).optional(),
    sharedGrantRequestId: SharedGrantIdSchema.optional(),
    source: z.enum(["scope_target", "shared_edit_request"]),
  })
  .strict();

export const FileTreeManifestV1Schema = z
  .object({
    schema: z.literal("setfarm.file-tree-manifest.v1"),
    runId: z.string().min(1).max(200),
    stackPackId: z.string().min(1).max(160),
    resolvedTargets: z.array(ResolvedTargetV1Schema).max(20_000),
    dependencyPlan: DependencyEvidenceSchema,
    mockInjectionPoints: z.array(UnknownRecordSchema).max(1_000),
    routeRegistrationPlan: z.array(ResolvedTargetV1Schema).max(20_000),
  })
  .strict();

const SetupSharedGrantV1Schema = z
  .object({
    grantId: SharedGrantIdSchema,
    runId: z.string().min(1).max(200),
    storyId: StoryIdSchema,
    path: NormalizedRelativeLocatorSchema,
    role: ScopeTargetRoleSchema,
    editScope: z.string().min(1).max(2_000),
    status: z.enum(["granted", "denied"]),
    reason: z.string().min(1).max(2_000),
    source: z.enum(["shared_edit_request", "stack_shared_file"]),
  })
  .strict();

export const SharedGrantsArtifactV1Schema = z
  .object({
    schema: z.literal("setfarm.shared-grants.v1"),
    version: z.literal(1),
    runId: z.string().min(1).max(200),
    grants: z.array(SetupSharedGrantV1Schema).max(20_000),
  })
  .strict();

function artifactSnapshot<T extends z.ZodType>(value: T) {
  return z.object({ source: SourceArtifactRefV1Schema, value }).strict();
}

export const ExactSetupTopologySnapshotV1Schema = z
  .object({
    schema: z.literal("setfarm.setup-topology-snapshot.v1"),
    certificate: artifactSnapshot(SetupCertificateV1Schema),
    manifest: artifactSnapshot(FileTreeManifestV1Schema),
    sharedGrants: artifactSnapshot(SharedGrantsArtifactV1Schema),
    productSpec: ProductSpecV1OrV2Schema.optional(),
    repo: BuildTopologyV1Schema.shape.repo,
    owners: z.array(TopologyOwnerV1Schema).min(1).max(2_000),
    pathBindings: z.array(TopologyPathBindingV1Schema).min(1).max(20_000),
    entrypoints: z.array(BuildEntrypointV1Schema).min(1).max(1_000),
  })
  .strict();

export type ExactSetupTopologySnapshotV1 = z.infer<typeof ExactSetupTopologySnapshotV1Schema>;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function exactSetupDiagnostic(input: {
  code: string;
  message: string;
  reference?: string;
  source?: z.infer<typeof SourceArtifactRefV1Schema>;
}) {
  return adapterDiagnostic({
    code: input.code,
    category: "contract",
    severity: "error",
    message: input.message,
    ...(input.reference ? { reference: input.reference } : {}),
    ...(input.source ? { source: input.source } : {}),
  });
}

export function adaptExactSetupTopologyV1(input: unknown): AdapterResult<BuildTopologyV1> {
  const parsed = ExactSetupTopologySnapshotV1Schema.safeParse(input);
  if (!parsed.success) {
    return finalizeAdapterResult({
      diagnostics: parsed.error.issues.slice(0, 200).map((issue) => exactSetupDiagnostic({
        code: "ADAPTER_SETUP_SNAPSHOT_INPUT_INVALID",
        message: `Exact setup snapshot failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
        reference: issue.path.join("/") || "$",
      })),
    });
  }

  const value = parsed.data;
  const certificate = value.certificate.value;
  const manifest = value.manifest.value;
  const sharedGrantsArtifact = value.sharedGrants.value;
  const provenance = [value.certificate.source, value.manifest.source, value.sharedGrants.source]
    .map((source) => provenanceFromSource(source, "derived_with_provenance"));
  const diagnostics = [] as ReturnType<typeof exactSetupDiagnostic>[];
  const source = value.certificate.source;

  const runIds = new Set([certificate.runId, manifest.runId, sharedGrantsArtifact.runId]);
  if (runIds.size !== 1) {
    diagnostics.push(exactSetupDiagnostic({
      code: "ADAPTER_SETUP_RUN_ID_MISMATCH",
      message: "Setup certificate, file manifest, and shared grants do not identify one exact run",
      source,
    }));
  }

  const packIds = new Set([certificate.stackPackId, manifest.stackPackId]);
  if (packIds.size !== 1) {
    diagnostics.push(exactSetupDiagnostic({
      code: "ADAPTER_SETUP_STACK_PACK_MISMATCH",
      message: "Setup certificate and file manifest disagree on stack pack identity",
      source,
    }));
  }
  const catalog = getStackTopologyCatalogContract(certificate.stackPackId);
  if (!catalog) {
    diagnostics.push(exactSetupDiagnostic({
      code: "ADAPTER_SETUP_STACK_PACK_UNKNOWN",
      message: `No versioned topology catalog exists for ${certificate.stackPackId}`,
      reference: certificate.stackPackId,
      source,
    }));
  }

  if (certificate.projectSlug !== value.repo.id) {
    diagnostics.push(exactSetupDiagnostic({
      code: "ADAPTER_SETUP_REPO_ID_MISMATCH",
      message: `Repository identity ${value.repo.id} does not equal setup project slug ${certificate.projectSlug}`,
      reference: value.repo.id,
      source,
    }));
  }
  if (certificate.fileTreeManifestPath !== value.manifest.source.locator) {
    diagnostics.push(exactSetupDiagnostic({
      code: "ADAPTER_SETUP_MANIFEST_SOURCE_MISMATCH",
      message: "Setup certificate manifest locator does not equal the captured manifest source",
      reference: certificate.fileTreeManifestPath,
      source,
    }));
  }
  if (certificate.sharedGrantsPath !== value.sharedGrants.source.locator) {
    diagnostics.push(exactSetupDiagnostic({
      code: "ADAPTER_SETUP_GRANTS_SOURCE_MISMATCH",
      message: "Setup certificate grants locator does not equal the captured grants source",
      reference: certificate.sharedGrantsPath,
      source,
    }));
  }
  if (hashCanonicalJson(certificate.dependencyEvidence) !== hashCanonicalJson(manifest.dependencyPlan)) {
    diagnostics.push(exactSetupDiagnostic({
      code: "ADAPTER_SETUP_DEPENDENCY_PLAN_MISMATCH",
      message: "Setup certificate and file manifest carry conflicting dependency evidence",
      source,
    }));
  }

  const ownersById = new Map(value.owners.map((owner) => [owner.id, owner]));
  const storyOwners = new Map<string, (typeof value.owners)[number]>();
  value.owners.forEach((owner) => {
    if (owner.kind !== "story") return;
    if (storyOwners.has(owner.storyRef)) {
      diagnostics.push(exactSetupDiagnostic({
        code: "ADAPTER_SETUP_STORY_OWNER_AMBIGUOUS",
        message: `Story ${owner.storyRef} has more than one topology owner`,
        reference: owner.storyRef,
        source,
      }));
    }
    storyOwners.set(owner.storyRef, owner);
  });
  const pathsById = new Map(value.pathBindings.map((binding) => [binding.id, binding]));
  const pathsByPath = new Map(value.pathBindings.map((binding) => [binding.path, binding]));

  const authorizedPaths = new Set([
    ...manifest.resolvedTargets.map((target) => target.path),
    ...certificate.scaffoldSnapshot,
    ...certificate.generatedDesignFiles,
    ...certificate.setupOwnedFiles,
    ...certificate.sharedFiles,
    ...value.entrypoints.flatMap((entrypoint) => {
      const pathBinding = pathsById.get(entrypoint.pathRef);
      return pathBinding ? [pathBinding.path] : [];
    }),
  ]);
  value.pathBindings.forEach((binding) => {
    if (!authorizedPaths.has(binding.path)) {
      diagnostics.push(exactSetupDiagnostic({
        code: "ADAPTER_SETUP_PATH_UNAUTHORIZED",
        message: `Exact path ${binding.path} is absent from setup artifacts and entrypoint selections`,
        reference: binding.id,
        source,
      }));
    }
  });

  const grantsById = new Map<string, (typeof sharedGrantsArtifact.grants)[number]>();
  const grantsByStoryPath = new Map<string, (typeof sharedGrantsArtifact.grants)[number]>();
  sharedGrantsArtifact.grants.forEach((grant) => {
    if (grantsById.has(grant.grantId)) {
      diagnostics.push(exactSetupDiagnostic({
        code: "ADAPTER_SETUP_GRANT_ID_AMBIGUOUS",
        message: `Grant ID ${grant.grantId} occurs more than once`,
        reference: grant.grantId,
        source: value.sharedGrants.source,
      }));
    }
    grantsById.set(grant.grantId, grant);
    const key = `${grant.storyId}\0${grant.path}`;
    if (grantsByStoryPath.has(key)) {
      diagnostics.push(exactSetupDiagnostic({
        code: "ADAPTER_SETUP_GRANT_AMBIGUOUS",
        message: `More than one grant targets ${grant.storyId} at ${grant.path}`,
        reference: grant.grantId,
        source: value.sharedGrants.source,
      }));
    }
    grantsByStoryPath.set(key, grant);
    if (grant.runId !== certificate.runId) {
      diagnostics.push(exactSetupDiagnostic({
        code: "ADAPTER_SETUP_GRANT_RUN_MISMATCH",
        message: `Grant ${grant.grantId} belongs to a different run`,
        reference: grant.grantId,
        source: value.sharedGrants.source,
      }));
    }
    if (grant.status !== "granted") {
      diagnostics.push(exactSetupDiagnostic({
        code: "ADAPTER_SETUP_GRANT_DENIED",
        message: `Denied grant ${grant.grantId} cannot enter a sealed BuildTopology`,
        reference: grant.grantId,
        source: value.sharedGrants.source,
      }));
    }
    const targets = manifest.resolvedTargets.filter((target) => target.sharedGrantRequestId === grant.grantId);
    if (targets.length !== 1) {
      diagnostics.push(exactSetupDiagnostic({
        code: targets.length === 0 ? "ADAPTER_SETUP_GRANT_TARGET_MISSING" : "ADAPTER_SETUP_GRANT_TARGET_AMBIGUOUS",
        message: `Grant ${grant.grantId} must resolve to exactly one manifest target, found ${targets.length}`,
        reference: grant.grantId,
        source: value.sharedGrants.source,
      }));
    } else {
      const target = targets[0]!;
      if (target.storyId !== grant.storyId || target.path !== grant.path || target.role !== grant.role) {
        diagnostics.push(exactSetupDiagnostic({
          code: "ADAPTER_SETUP_GRANT_TARGET_MISMATCH",
          message: `Grant ${grant.grantId} identity does not equal its manifest target`,
          reference: grant.grantId,
          source: value.sharedGrants.source,
        }));
      }
    }
  });

  const targetIdentities = new Set<string>();
  manifest.resolvedTargets.forEach((target) => {
    const targetIdentity = `${target.storyId}\0${target.role}\0${target.path}\0${target.source}`;
    if (targetIdentities.has(targetIdentity)) {
      diagnostics.push(exactSetupDiagnostic({
        code: "ADAPTER_SETUP_TARGET_AMBIGUOUS",
        message: `Manifest target occurs more than once: ${target.storyId}/${target.role}/${target.path}`,
        reference: target.path,
        source: value.manifest.source,
      }));
    }
    targetIdentities.add(targetIdentity);
    if (target.path !== target.resolvedPath) {
      diagnostics.push(exactSetupDiagnostic({
        code: "ADAPTER_SETUP_TARGET_PATH_MISMATCH",
        message: `Target ${target.storyId}/${target.role} has conflicting path and resolvedPath`,
        reference: target.path,
        source: value.manifest.source,
      }));
    }
    const storyOwner = storyOwners.get(target.storyId);
    if (!storyOwner) {
      diagnostics.push(exactSetupDiagnostic({
        code: "ADAPTER_SETUP_TARGET_OWNER_MISSING",
        message: `Target ${target.storyId}/${target.role} has no exact story owner`,
        reference: target.storyId,
        source: value.manifest.source,
      }));
      return;
    }
    const binding = pathsByPath.get(target.path);
    if (!binding) {
      diagnostics.push(exactSetupDiagnostic({
        code: "ADAPTER_SETUP_TARGET_PATH_MISSING",
        message: `Target ${target.storyId}/${target.role} has no presence/hash path binding`,
        reference: target.path,
        source: value.manifest.source,
      }));
      return;
    }
    const grant = grantsByStoryPath.get(`${target.storyId}\0${target.path}`);
    if (binding.ownerRef !== storyOwner.id && !grant) {
      diagnostics.push(exactSetupDiagnostic({
        code: "ADAPTER_SETUP_TARGET_OWNER_UNGRANTED",
        message: `Target ${target.storyId}/${target.role} does not own ${target.path} and has no exact grant`,
        reference: target.path,
        source: value.manifest.source,
      }));
    }
    if (target.sharedGrantRequestId) {
      const exactGrant = grantsById.get(target.sharedGrantRequestId);
      if (!exactGrant || exactGrant.storyId !== target.storyId || exactGrant.path !== target.path || exactGrant.role !== target.role) {
        diagnostics.push(exactSetupDiagnostic({
          code: "ADAPTER_SETUP_TARGET_GRANT_MISMATCH",
          message: `Target ${target.storyId}/${target.role} does not resolve to its exact grant request`,
          reference: target.sharedGrantRequestId,
          source: value.manifest.source,
        }));
      }
    } else if (grant) {
      diagnostics.push(exactSetupDiagnostic({
        code: "ADAPTER_SETUP_TARGET_GRANT_REF_MISSING",
        message: `Grant ${grant.grantId} is not referenced by its manifest target`,
        reference: grant.grantId,
        source: value.manifest.source,
      }));
    }
  });

  const topologyGrants = sharedGrantsArtifact.grants.flatMap((grant) => {
    const binding = pathsByPath.get(grant.path);
    const storyOwner = storyOwners.get(grant.storyId);
    const target = manifest.resolvedTargets.find((candidate) => candidate.sharedGrantRequestId === grant.grantId);
    if (!binding || !storyOwner || !target || grant.status !== "granted") return [];
    if (!ownersById.has(binding.ownerRef)) return [];
    if (binding.ownerRef === storyOwner.id) {
      diagnostics.push(exactSetupDiagnostic({
        code: "ADAPTER_SETUP_GRANT_OWNER_NOT_CROSS_BOUNDARY",
        message: `Grant ${grant.grantId} does not cross an ownership boundary`,
        reference: grant.grantId,
        source: value.sharedGrants.source,
      }));
      return [];
    }
    return [{
      id: grant.grantId,
      fromOwnerRef: binding.ownerRef,
      toOwnerRef: storyOwner.id,
      pathRefs: [binding.id],
      permissions: ["read" as const, "write" as const],
    }];
  });

  if (catalog) {
    const selectedKinds = new Set(value.entrypoints.map((entrypoint) => entrypoint.kind));
    catalog.descriptor.requiredEntrypointKinds.forEach((kind) => {
      if (!selectedKinds.has(kind)) {
        diagnostics.push(exactSetupDiagnostic({
          code: "ADAPTER_SETUP_ENTRYPOINT_KIND_MISSING",
          message: `Stack ${catalog.identity.id} requires an exact ${kind} entrypoint`,
          reference: kind,
          source,
        }));
      }
    });
    const selectedPathRefs = new Set<string>();
    value.entrypoints.forEach((entrypoint) => {
      if (selectedPathRefs.has(entrypoint.pathRef)) {
        diagnostics.push(exactSetupDiagnostic({
          code: "ADAPTER_SETUP_ENTRYPOINT_PATH_AMBIGUOUS",
          message: `Path ${entrypoint.pathRef} is selected as more than one entrypoint`,
          reference: entrypoint.pathRef,
          source,
        }));
      }
      selectedPathRefs.add(entrypoint.pathRef);
      const binding = pathsById.get(entrypoint.pathRef);
      if (!binding) return;
      if (binding.role !== "entrypoint") {
        diagnostics.push(exactSetupDiagnostic({
          code: "ADAPTER_SETUP_ENTRYPOINT_ROLE_MISMATCH",
          message: `Entrypoint ${entrypoint.id} path is not explicitly bound as entrypoint`,
          reference: entrypoint.pathRef,
          source,
        }));
      }
      if (binding.presence !== "present") {
        diagnostics.push(exactSetupDiagnostic({
          code: "ADAPTER_SETUP_ENTRYPOINT_ABSENT",
          message: `Entrypoint ${entrypoint.id} is explicitly absent at the sealed source revision`,
          reference: entrypoint.pathRef,
          source,
        }));
      }
      const matchingRules = catalog.descriptor.entrypointRules.filter((rule) =>
        rule.entrypointKind === entrypoint.kind
        && rule.mountPoint === entrypoint.mountPoint
        && matchesStackEntrypointRule(binding.path, rule.matcher));
      if (matchingRules.length === 0) {
        diagnostics.push(exactSetupDiagnostic({
          code: "ADAPTER_SETUP_ENTRYPOINT_UNAUTHORIZED",
          message: `Entrypoint ${entrypoint.id} has no exact catalog rule for ${binding.path}`,
          reference: entrypoint.id,
          source,
        }));
      } else if (matchingRules.length > 1) {
        diagnostics.push(exactSetupDiagnostic({
          code: "ADAPTER_SETUP_ENTRYPOINT_RULE_AMBIGUOUS",
          message: `Entrypoint ${entrypoint.id} matches more than one catalog rule`,
          reference: entrypoint.id,
          source,
        }));
      }
    });
  }

  const routePlanKeys = new Set(manifest.resolvedTargets
    .filter((target) => target.role === "route_registration")
    .map((target) => `${target.storyId}\0${target.path}\0${target.ruleId}`));
  manifest.routeRegistrationPlan.forEach((target) => {
    const key = `${target.storyId}\0${target.path}\0${target.ruleId}`;
    if (target.role !== "route_registration" || !routePlanKeys.has(key)) {
      diagnostics.push(exactSetupDiagnostic({
        code: "ADAPTER_SETUP_ROUTE_PLAN_MISMATCH",
        message: `Route registration plan contains a target absent from resolvedTargets: ${target.storyId}/${target.path}`,
        reference: target.path,
        source: value.manifest.source,
      }));
    }
  });
  const suppliedRoutePlanKeys = new Set(manifest.routeRegistrationPlan
    .map((target) => `${target.storyId}\0${target.path}\0${target.ruleId}`));
  routePlanKeys.forEach((key) => {
    if (!suppliedRoutePlanKeys.has(key)) {
      const [, path = key] = key.split("\0");
      diagnostics.push(exactSetupDiagnostic({
        code: "ADAPTER_SETUP_ROUTE_PLAN_INCOMPLETE",
        message: `Resolved route registration is absent from routeRegistrationPlan: ${path}`,
        reference: path,
        source: value.manifest.source,
      }));
    }
  });

  if (diagnostics.length > 0 || !catalog) {
    return finalizeAdapterResult({ diagnostics, provenance });
  }

  const commandKinds = [...new Set(catalog.descriptor.commands.map((command) => command.kind))]
    .sort(compareUtf16);
  const producerResult = produceBuildTopologyV1({
    stackContract: {
      identity: catalog.identity,
      capabilities: catalog.descriptor.capabilities.map((capability) => ({
        id: capability.id,
        kind: capability.kind,
        required: capability.required,
        providers: capability.providers,
      })),
      entrypointKinds: catalog.descriptor.entrypointKinds,
      commandKinds,
      requiredCommandKinds: catalog.descriptor.requiredCommandKinds,
      requiredPathRoles: catalog.descriptor.requiredPathRoles,
      packageManagers: [catalog.descriptor.packageManager],
    },
    repo: value.repo,
    owners: value.owners,
    pathBindings: value.pathBindings,
    sharedGrants: topologyGrants,
    entrypoints: value.entrypoints,
    commands: catalog.descriptor.commands,
    capabilities: catalog.descriptor.capabilities.map((capability) => ({
      id: capability.id,
      kind: capability.kind,
      enabled: capability.enabled,
      ...(capability.provider ? { provider: capability.provider } : {}),
    })),
    policies: {
      packageManager: catalog.descriptor.packageManager,
      allowedRoots: [...new Set(value.pathBindings.map((binding) => binding.path))].sort(compareUtf16),
      deniedGlobs: [...catalog.descriptor.deniedGlobs],
      buildOutputPaths: [...catalog.descriptor.buildOutputPaths],
    },
    ...(value.productSpec ? { productSpec: value.productSpec } : {}),
    ...(certificate.runtimeDataProvisioning
      ? { runtimeDataProvisioning: certificate.runtimeDataProvisioning }
      : {}),
  });
  if (producerResult.status === "rejected") {
    return finalizeAdapterResult({ diagnostics: producerResult.diagnostics, provenance });
  }
  return finalizeAdapterResult({ candidate: producerResult.buildTopology, provenance });
}

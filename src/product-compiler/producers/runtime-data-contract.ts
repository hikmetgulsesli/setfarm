import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "../diagnostics.js";
import type { CompilationDiagnosticV1 } from "../schemas/compilation-report-v1.js";
import {
  CommandIdSchema,
  hasUniqueStrings,
} from "../schemas/common-v1.js";
import {
  ProductSpecV1Schema,
  validatePersistenceDeliveryCompatibilityV1,
  type PersistencePolicyV1,
} from "../schemas/product-spec-v1.js";
import {
  RuntimeDataContractV1Schema,
  RuntimeDataProvisioningV1Schema,
  hashRuntimeDataContractV1,
  type RuntimeDataAuthorityV1,
  type RuntimeDataContractV1,
  type RuntimeDataProvisioningV1,
  type RuntimeWritableVolumeV1,
} from "../schemas/runtime-data-contract-v1.js";

const RuntimeCommandReferenceV1Schema = z
  .object({
    id: CommandIdSchema,
    kind: z.string().min(1).max(100),
    envRefs: z.array(z.string().min(1).max(160)).max(500).optional(),
  })
  .passthrough();

const RuntimeDataContractProducerInputSchema = z
  .object({
    productSpec: ProductSpecV1Schema,
    commands: z.array(RuntimeCommandReferenceV1Schema).min(1).max(1_000),
    provisioning: RuntimeDataProvisioningV1Schema.optional(),
  })
  .strict();

export type RuntimeDataContractProducerInput = z.input<
  typeof RuntimeDataContractProducerInputSchema
>;

export type RuntimeDataContractProducerResult =
  | Readonly<{
      status: "produced";
      contract: RuntimeDataContractV1;
      contractHash: string;
      diagnostics: readonly [];
    }>
  | Readonly<{
      status: "rejected";
      rejectionCodes: string[];
      diagnostics: CompilationDiagnosticV1[];
    }>;

const EMPTY_PROVISIONING: RuntimeDataProvisioningV1 = {
  schema: "setfarm.runtime-data-provisioning.v1",
  writableVolumes: [],
  externalDatabases: [],
  scratch: { kind: "none" },
};

const STATELESS_NONE_AUTHORITY_ID = "AUTH_DATA_STATELESS_NONE";
const STATELESS_SESSION_AUTHORITY_ID = "AUTH_DATA_STATELESS_SESSION";
const BROWSER_AUTHORITY_ID = "AUTH_DATA_BROWSER_ORIGIN";
const RESERVED_AUTHORITY_IDS = new Set([
  "AUTH_DATA_STATELESS",
  STATELESS_NONE_AUTHORITY_ID,
  STATELESS_SESSION_AUTHORITY_ID,
  BROWSER_AUTHORITY_ID,
]);

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function diagnostic(input: Readonly<{
  code: string;
  message: string;
  reference?: string;
  category?: CompilationDiagnosticV1["category"];
}>): CompilationDiagnosticV1 {
  return makeCompilationDiagnostic({
    schema: "setfarm.compilation-diagnostic.v1",
    code: input.code,
    category: input.category ?? "contract",
    severity: "error",
    message: input.message.slice(0, 2_000),
    ...(input.reference ? { reference: input.reference.slice(0, 160) } : {}),
    provenance: [],
    suggestions: [],
  });
}

function reject(diagnostics: readonly CompilationDiagnosticV1[]): RuntimeDataContractProducerResult {
  const sorted = sortCompilationDiagnostics(diagnostics).slice(0, 10_000);
  return {
    status: "rejected",
    rejectionCodes: uniqueSorted(sorted.map((item) => item.code)),
    diagnostics: sorted,
  };
}

function inputDiagnostics(error: z.ZodError): CompilationDiagnosticV1[] {
  return error.issues.slice(0, 200).map((issue) => diagnostic({
    code: "RUNTIME_DATA_INPUT_INVALID",
    category: "configuration",
    message: `Runtime-data input failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
    reference: issue.path.join("/") || "$",
  }));
}

function volumeDurability(policy: PersistencePolicyV1): RuntimeWritableVolumeV1["durability"] {
  if (policy.durability === "durable") return "durable";
  if (policy.durability === "reload" || policy.durability === "restart") return "restart";
  return "session";
}

const DURABILITY_RANK: Readonly<Record<RuntimeWritableVolumeV1["durability"], number>> = {
  session: 0,
  restart: 1,
  durable: 2,
};

function expectedVolumeDurability(
  policies: readonly PersistencePolicyV1[],
): RuntimeWritableVolumeV1["durability"] {
  return policies
    .map(volumeDurability)
    .sort((left, right) => DURABILITY_RANK[right] - DURABILITY_RANK[left])[0] ?? "session";
}

function validateVolumeClass(
  volume: RuntimeWritableVolumeV1,
  diagnostics: CompilationDiagnosticV1[],
): void {
  const valid = volume.durability === "session"
    ? volume.persistenceClass === "ephemeral"
    : volume.durability === "restart"
      ? volume.persistenceClass === "run" || volume.persistenceClass === "project"
      : volume.persistenceClass === "project";
  if (!valid) {
    diagnostics.push(diagnostic({
      code: "RUNTIME_DATA_VOLUME_CLASS_DURABILITY_MISMATCH",
      message: `Volume ${volume.volumeId} class ${volume.persistenceClass} cannot satisfy ${volume.durability} durability`,
      reference: volume.volumeId,
    }));
  }
}

function validateMigrationCommand(input: Readonly<{
  commandRef: string;
  requiredEnvRefs: readonly string[];
  commands: readonly z.infer<typeof RuntimeCommandReferenceV1Schema>[];
  ownerRef: string;
  diagnostics: CompilationDiagnosticV1[];
}>): void {
  const commands = input.commands.filter((command) => command.id === input.commandRef);
  if (commands.length !== 1) {
    input.diagnostics.push(diagnostic({
      code: commands.length === 0
        ? "RUNTIME_DATA_MIGRATION_COMMAND_MISSING"
        : "RUNTIME_DATA_MIGRATION_COMMAND_AMBIGUOUS",
      message: `${input.ownerRef} requires exactly one migration command ${input.commandRef}, found ${commands.length}`,
      reference: input.commandRef,
    }));
    return;
  }
  const command = commands[0]!;
  if (command.kind !== "migrate") {
    input.diagnostics.push(diagnostic({
      code: "RUNTIME_DATA_MIGRATION_COMMAND_KIND_INVALID",
      message: `Runtime-data migration command ${input.commandRef} must have kind migrate, not ${command.kind}`,
      reference: input.commandRef,
    }));
  }
  const envRefs = new Set(command.envRefs ?? []);
  input.requiredEnvRefs.forEach((envRef) => {
    if (!envRefs.has(envRef)) {
      input.diagnostics.push(diagnostic({
        code: "RUNTIME_DATA_MIGRATION_ENV_BINDING_MISSING",
        message: `Migration command ${input.commandRef} omits required environment binding ${envRef}`,
        reference: `${input.commandRef}:${envRef}`,
      }));
    }
  });
}

export function produceRuntimeDataContractV1(input: unknown): RuntimeDataContractProducerResult {
  const parsed = RuntimeDataContractProducerInputSchema.safeParse(input);
  if (!parsed.success) return reject(inputDiagnostics(parsed.error));
  const { productSpec, commands } = parsed.data;
  const provisioning = parsed.data.provisioning ?? EMPTY_PROVISIONING;
  const diagnostics: CompilationDiagnosticV1[] = [];
  if (!productSpec.delivery) {
    return reject([diagnostic({
      code: "RUNTIME_DATA_PRODUCT_DELIVERY_MISSING",
      message: "Runtime-data authority can be produced only from a v3 ProductSpec with exact delivery",
      reference: "delivery",
    })]);
  }
  if (!hasUniqueStrings(commands.map((command) => command.id))) {
    diagnostics.push(diagnostic({
      code: "RUNTIME_DATA_COMMAND_ID_AMBIGUOUS",
      message: "Runtime-data command references require unique topology command IDs",
      reference: "commands",
    }));
  }
  validatePersistenceDeliveryCompatibilityV1({
    delivery: productSpec.delivery,
    policies: productSpec.persistencePolicies,
  }).forEach((issue) => diagnostics.push(diagnostic({
    code: issue.code,
    message: issue.message,
    reference: issue.policyRef ?? issue.path.join("."),
  })));

  const policies = new Map(productSpec.persistencePolicies.map((policy) => [policy.id, policy]));
  const statelessPolicies = productSpec.persistencePolicies.filter((policy) =>
    policy.kind === "none" || policy.kind === "memory");
  const browserPolicies = productSpec.persistencePolicies.filter((policy) =>
    policy.kind === "local_storage");
  const filePolicies = productSpec.persistencePolicies.filter((policy) => policy.kind === "file");
  const databasePolicies = productSpec.persistencePolicies.filter((policy) => policy.kind === "database");
  productSpec.persistencePolicies.filter((policy) => policy.kind === "remote_api").forEach((policy) => {
    diagnostics.push(diagnostic({
      code: "RUNTIME_DATA_POLICY_KIND_UNSUPPORTED",
      message: `Runtime-data contract v1 does not support remote_api persistence ${policy.id}`,
      reference: policy.id,
    }));
  });

  browserPolicies.forEach((policy) => {
    if (!policy.key) {
      diagnostics.push(diagnostic({
        code: "RUNTIME_DATA_BROWSER_KEY_MISSING",
        message: `Browser-origin persistence ${policy.id} requires an exact storage key`,
        reference: policy.id,
      }));
    }
    if (policy.durability === "none") {
      diagnostics.push(diagnostic({
        code: "RUNTIME_DATA_BROWSER_DURABILITY_INVALID",
        message: `Browser-origin persistence ${policy.id} must declare at least session durability`,
        reference: policy.id,
      }));
    }
  });
  if (databasePolicies.length > 0 && productSpec.delivery.database === "none") {
    diagnostics.push(diagnostic({
      code: "RUNTIME_DATA_DATABASE_DELIVERY_MISSING",
      message: "ProductSpec database policies require a non-none delivery database",
      reference: "delivery.database",
    }));
  }
  if (databasePolicies.length === 0 && productSpec.delivery.database !== "none") {
    diagnostics.push(diagnostic({
      code: "RUNTIME_DATA_DATABASE_POLICY_MISSING",
      message: `Delivery database ${productSpec.delivery.database} has no ProductSpec database persistence owner`,
      reference: "delivery.database",
    }));
  }

  const serverPolicyIds = new Set([
    ...filePolicies.map((policy) => policy.id),
    ...(productSpec.delivery.database === "sqlite"
      ? databasePolicies.map((policy) => policy.id)
      : []),
  ]);
  const externalPolicyIds = new Set(
    productSpec.delivery.database === "postgres"
      ? databasePolicies.map((policy) => policy.id)
      : [],
  );

  const declaredPolicyOwners = new Map<string, string[]>();
  const addDeclaredOwner = (persistenceRef: string, ownerRef: string) => {
    const owners = declaredPolicyOwners.get(persistenceRef) ?? [];
    owners.push(ownerRef);
    declaredPolicyOwners.set(persistenceRef, owners);
  };
  provisioning.writableVolumes.forEach((volume) =>
    volume.dataPaths.forEach((binding) => addDeclaredOwner(binding.persistenceRef, volume.authorityId)));
  provisioning.externalDatabases.forEach((database) =>
    database.persistenceRefs.forEach((persistenceRef) => addDeclaredOwner(persistenceRef, database.authorityId)));

  declaredPolicyOwners.forEach((owners, persistenceRef) => {
    if (!policies.has(persistenceRef)) {
      diagnostics.push(diagnostic({
        code: "RUNTIME_DATA_DECLARATION_POLICY_UNOWNED",
        message: `Runtime-data resource binds absent ProductSpec persistence ${persistenceRef}`,
        reference: persistenceRef,
      }));
    }
    if (owners.length !== 1) {
      diagnostics.push(diagnostic({
        code: "RUNTIME_DATA_DECLARATION_POLICY_AMBIGUOUS",
        message: `Persistence ${persistenceRef} is declared by ${owners.length} runtime-data resources`,
        reference: persistenceRef,
      }));
    }
  });

  const mountEnvRefs = provisioning.writableVolumes.map((volume) => volume.mountEnvRef);
  if (!hasUniqueStrings(mountEnvRefs)) {
    diagnostics.push(diagnostic({
      code: "RUNTIME_DATA_VOLUME_MOUNT_ENV_AMBIGUOUS",
      message: "Each writable volume requires a unique mount environment binding",
      reference: "writableVolumes",
    }));
  }
  const serverPolicyKindsByAuthority = new Map<string, Set<PersistencePolicyV1["kind"]>>();
  provisioning.writableVolumes.forEach((volume) => {
    if (RESERVED_AUTHORITY_IDS.has(volume.authorityId)) {
      diagnostics.push(diagnostic({
        code: "RUNTIME_DATA_AUTHORITY_ID_RESERVED",
        message: `Writable volume cannot use reserved authority ${volume.authorityId}`,
        reference: volume.authorityId,
      }));
    }
    const boundPolicies = volume.dataPaths.flatMap((binding) => {
      const policy = policies.get(binding.persistenceRef);
      if (!policy || !serverPolicyIds.has(binding.persistenceRef)) {
        diagnostics.push(diagnostic({
          code: "RUNTIME_DATA_VOLUME_POLICY_UNSUPPORTED",
          message: `Volume ${volume.volumeId} cannot own persistence ${binding.persistenceRef}`,
          reference: binding.persistenceRef,
        }));
        return [];
      }
      return [policy];
    });
    if (boundPolicies.length > 0) {
      const authorityKinds = serverPolicyKindsByAuthority.get(volume.authorityId) ?? new Set();
      boundPolicies.forEach((policy) => authorityKinds.add(policy.kind));
      serverPolicyKindsByAuthority.set(volume.authorityId, authorityKinds);
      const expectedDurability = expectedVolumeDurability(boundPolicies);
      if (volume.durability !== expectedDurability) {
        diagnostics.push(diagnostic({
          code: "RUNTIME_DATA_VOLUME_DURABILITY_MISMATCH",
          message: `Volume ${volume.volumeId} declares ${volume.durability}; bound policies require ${expectedDurability}`,
          reference: volume.volumeId,
        }));
      }
      const sqlite = boundPolicies.some((policy) => policy.kind === "database");
      if (sqlite && volume.purpose !== "database") {
        diagnostics.push(diagnostic({
          code: "RUNTIME_DATA_VOLUME_PURPOSE_MISMATCH",
          message: `SQLite volume ${volume.volumeId} must declare database purpose`,
          reference: volume.volumeId,
        }));
      }
      if (!sqlite && volume.purpose === "database") {
        diagnostics.push(diagnostic({
          code: "RUNTIME_DATA_VOLUME_PURPOSE_MISMATCH",
          message: `Non-database volume ${volume.volumeId} cannot declare database purpose`,
          reference: volume.volumeId,
        }));
      }
    }
    validateVolumeClass(volume, diagnostics);
    validateMigrationCommand({
      commandRef: volume.migrationCommandRef,
      requiredEnvRefs: [volume.mountEnvRef],
      commands,
      ownerRef: volume.volumeId,
      diagnostics,
    });
  });
  serverPolicyKindsByAuthority.forEach((kinds, authorityId) => {
    if (kinds.has("file") && kinds.has("database")) {
      diagnostics.push(diagnostic({
        code: "RUNTIME_DATA_AUTHORITY_ENGINE_MIXED",
        message: `Runtime-data authority ${authorityId} cannot mix file and SQLite persistence engines`,
        reference: authorityId,
      }));
    }
  });

  provisioning.externalDatabases.forEach((database) => {
    if (RESERVED_AUTHORITY_IDS.has(database.authorityId)) {
      diagnostics.push(diagnostic({
        code: "RUNTIME_DATA_AUTHORITY_ID_RESERVED",
        message: `External database cannot use reserved authority ${database.authorityId}`,
        reference: database.authorityId,
      }));
    }
    if (database.databaseKind !== productSpec.delivery!.database) {
      diagnostics.push(diagnostic({
        code: "RUNTIME_DATA_EXTERNAL_DATABASE_KIND_MISMATCH",
        message: `External authority ${database.authorityId} declares ${database.databaseKind}; ProductSpec delivery declares ${productSpec.delivery!.database}`,
        reference: database.authorityId,
      }));
    }
    database.persistenceRefs.forEach((persistenceRef) => {
      if (!externalPolicyIds.has(persistenceRef)) {
        diagnostics.push(diagnostic({
          code: "RUNTIME_DATA_EXTERNAL_POLICY_UNSUPPORTED",
          message: `External authority ${database.authorityId} cannot own persistence ${persistenceRef}`,
          reference: persistenceRef,
        }));
      }
    });
    validateMigrationCommand({
      commandRef: database.migrationCommandRef,
      requiredEnvRefs: database.credentialEnvRefs,
      commands,
      ownerRef: database.authorityId,
      diagnostics,
    });
  });

  [...serverPolicyIds].forEach((persistenceRef) => {
    if ((declaredPolicyOwners.get(persistenceRef) ?? []).length !== 1) {
      diagnostics.push(diagnostic({
        code: "RUNTIME_DATA_SERVER_DECLARATION_MISSING",
        message: `Server persistence ${persistenceRef} requires exactly one writable-volume binding`,
        reference: persistenceRef,
      }));
    }
  });
  [...externalPolicyIds].forEach((persistenceRef) => {
    if ((declaredPolicyOwners.get(persistenceRef) ?? []).length !== 1) {
      diagnostics.push(diagnostic({
        code: "RUNTIME_DATA_EXTERNAL_DECLARATION_MISSING",
        message: `External persistence ${persistenceRef} requires exactly one external-database authority`,
        reference: persistenceRef,
      }));
    }
  });
  if (serverPolicyIds.size === 0 && provisioning.writableVolumes.length > 0) {
    diagnostics.push(diagnostic({
      code: "RUNTIME_DATA_VOLUME_EXTRA",
      message: "ProductSpec has no server-filesystem persistence but setup declared writable volumes",
      reference: "writableVolumes",
    }));
  }
  if (externalPolicyIds.size === 0 && provisioning.externalDatabases.length > 0) {
    diagnostics.push(diagnostic({
      code: "RUNTIME_DATA_EXTERNAL_AUTHORITY_EXTRA",
      message: "ProductSpec has no external database persistence but setup declared an external authority",
      reference: "externalDatabases",
    }));
  }
  if (diagnostics.length > 0) return reject(diagnostics);

  const policyAuthority = new Map<string, string>();
  statelessPolicies.forEach((policy) => policyAuthority.set(
    policy.id,
    policy.kind === "none" ? STATELESS_NONE_AUTHORITY_ID : STATELESS_SESSION_AUTHORITY_ID,
  ));
  browserPolicies.forEach((policy) => policyAuthority.set(policy.id, BROWSER_AUTHORITY_ID));
  provisioning.writableVolumes.forEach((volume) =>
    volume.dataPaths.forEach((binding) => policyAuthority.set(binding.persistenceRef, volume.authorityId)));
  provisioning.externalDatabases.forEach((database) =>
    database.persistenceRefs.forEach((persistenceRef) => policyAuthority.set(persistenceRef, database.authorityId)));

  const authorities: RuntimeDataAuthorityV1[] = [];
  const nonePolicies = statelessPolicies.filter((policy) => policy.kind === "none");
  const memoryPolicies = statelessPolicies.filter((policy) => policy.kind === "memory");
  if (nonePolicies.length > 0 || productSpec.persistencePolicies.length === 0) {
    authorities.push({
      id: STATELESS_NONE_AUTHORITY_ID,
      kind: "stateless",
      durability: "none",
      persistenceRefs: uniqueSorted(nonePolicies.map((policy) => policy.id)),
    });
  }
  if (memoryPolicies.length > 0) {
    authorities.push({
      id: STATELESS_SESSION_AUTHORITY_ID,
      kind: "stateless",
      durability: "session",
      persistenceRefs: uniqueSorted(memoryPolicies.map((policy) => policy.id)),
    });
  }
  if (browserPolicies.length > 0) {
    authorities.push({
      id: BROWSER_AUTHORITY_ID,
      kind: "browser-origin",
      originScope: "application",
      persistenceRefs: uniqueSorted(browserPolicies.map((policy) => policy.id)),
      keyBindings: browserPolicies
        .map((policy) => ({
          persistenceRef: policy.id,
          key: policy.key!,
          durability: policy.durability as "session" | "reload" | "restart" | "durable",
        }))
        .sort((left, right) => compareUtf16(left.persistenceRef, right.persistenceRef)),
    });
  }
  const volumesByAuthority = new Map<string, RuntimeWritableVolumeV1[]>();
  provisioning.writableVolumes.forEach((volume) => {
    const volumes = volumesByAuthority.get(volume.authorityId) ?? [];
    volumes.push({
      ...volume,
      dataPaths: [...volume.dataPaths]
        .sort((left, right) => compareUtf16(left.persistenceRef, right.persistenceRef)),
    });
    volumesByAuthority.set(volume.authorityId, volumes);
  });
  volumesByAuthority.forEach((volumes, authorityId) => {
    const persistenceRefs = uniqueSorted(volumes.flatMap((volume) =>
      volume.dataPaths.map((binding) => binding.persistenceRef)));
    const engine = persistenceRefs.some((persistenceRef) =>
      policies.get(persistenceRef)?.kind === "database") ? "sqlite" : "files";
    authorities.push({
      id: authorityId,
      kind: "server-filesystem",
      engine,
      persistenceRefs,
      volumeRefs: uniqueSorted(volumes.map((volume) => volume.volumeId)),
    });
  });
  provisioning.externalDatabases.forEach((database) => authorities.push({
    id: database.authorityId,
    kind: "external-database",
    databaseKind: database.databaseKind,
    durability: "durable",
    persistenceRefs: uniqueSorted(database.persistenceRefs),
    credentialEnvRefs: uniqueSorted(database.credentialEnvRefs),
    migrationCommandRef: database.migrationCommandRef,
  }));

  const missingAuthorityRefs = productSpec.persistencePolicies
    .map((policy) => policy.id)
    .filter((persistenceRef) => !policyAuthority.has(persistenceRef));
  if (missingAuthorityRefs.length > 0) {
    return reject(missingAuthorityRefs.map((persistenceRef) => diagnostic({
      code: "RUNTIME_DATA_POLICY_AUTHORITY_MISSING",
      message: `ProductSpec persistence has no runtime-data authority: ${persistenceRef}`,
      reference: persistenceRef,
    })));
  }

  const contractCandidate = {
    schema: "setfarm.runtime-data-contract.v1" as const,
    contractVersion: 1 as const,
    sourceProductSpecHash: hashCanonicalJson(productSpec),
    delivery: {
      platform: productSpec.delivery.platform,
      techStack: productSpec.delivery.techStack,
      database: productSpec.delivery.database,
    },
    policyBindings: productSpec.persistencePolicies
      .map((policy) => ({
        persistenceRef: policy.id,
        authorityRef: policyAuthority.get(policy.id)!,
      }))
      .sort((left, right) => compareUtf16(left.persistenceRef, right.persistenceRef)),
    authorities: authorities.sort((left, right) => compareUtf16(left.id, right.id)),
    writableVolumes: [...volumesByAuthority.values()]
      .flat()
      .sort((left, right) => compareUtf16(left.volumeId, right.volumeId)),
    scratch: provisioning.scratch.kind === "none" ? { kind: "none" as const } : {
      kind: "platform-managed" as const,
      lifecycle: "attempt" as const,
      persistenceAllowed: false as const,
      envBindings: [
        { envRef: "HOME" as const, purpose: "home" as const },
        { envRef: "TMPDIR" as const, purpose: "temporary" as const },
        { envRef: "XDG_CACHE_HOME" as const, purpose: "cache" as const },
      ] as const,
      quota: provisioning.scratch.quota,
    },
  };
  const contract = RuntimeDataContractV1Schema.safeParse(contractCandidate);
  if (!contract.success) {
    return reject(contract.error.issues.slice(0, 200).map((issue) => diagnostic({
      code: "RUNTIME_DATA_CONTRACT_INVALID",
      message: `Produced runtime-data contract failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      reference: issue.path.join("/") || "$",
    })));
  }
  return {
    status: "produced",
    contract: contract.data,
    contractHash: hashRuntimeDataContractV1(contract.data),
    diagnostics: [],
  };
}

export function validateRuntimeDataContractClosureV1(input: Readonly<{
  productSpec: unknown;
  commands: unknown;
  contract: unknown;
  contractHash: unknown;
}>): CompilationDiagnosticV1[] {
  const productSpec = ProductSpecV1Schema.safeParse(input.productSpec);
  const commands = z.array(RuntimeCommandReferenceV1Schema).min(1).max(1_000).safeParse(input.commands);
  const contract = RuntimeDataContractV1Schema.safeParse(input.contract);
  const contractHash = z.string().regex(/^[a-f0-9]{64}$/).safeParse(input.contractHash);
  const diagnostics: CompilationDiagnosticV1[] = [];
  if (!productSpec.success || !commands.success || !contract.success || !contractHash.success) {
    return [diagnostic({
      code: "RUNTIME_DATA_CLOSURE_INPUT_INVALID",
      message: "Runtime-data closure requires a strict ProductSpec, command list, contract, and SHA-256 hash",
      reference: "runtimeDataContract",
    })];
  }
  if (hashRuntimeDataContractV1(contract.data) !== contractHash.data) {
    diagnostics.push(diagnostic({
      code: "RUNTIME_DATA_CONTRACT_HASH_MISMATCH",
      message: "Runtime-data contract hash differs from its exact canonical payload",
      reference: "runtimeDataContractHash",
    }));
  }
  const provisioning: RuntimeDataProvisioningV1 = {
    schema: "setfarm.runtime-data-provisioning.v1",
    writableVolumes: contract.data.writableVolumes,
    externalDatabases: contract.data.authorities.flatMap((authority) =>
      authority.kind === "external-database" ? [{
        authorityId: authority.id,
        databaseKind: authority.databaseKind,
        persistenceRefs: authority.persistenceRefs,
        credentialEnvRefs: authority.credentialEnvRefs,
        migrationCommandRef: authority.migrationCommandRef,
      }] : []),
    scratch: contract.data.scratch.kind === "none" ? { kind: "none" } : {
      kind: "platform-managed",
      quota: contract.data.scratch.quota,
    },
  };
  const reproduced = produceRuntimeDataContractV1({
    productSpec: productSpec.data,
    commands: commands.data,
    provisioning,
  });
  if (reproduced.status === "rejected") return [...diagnostics, ...reproduced.diagnostics];
  if (
    reproduced.contractHash !== contractHash.data
    || hashCanonicalJson(reproduced.contract) !== hashCanonicalJson(contract.data)
  ) {
    diagnostics.push(diagnostic({
      code: "RUNTIME_DATA_CONTRACT_PRODUCT_DRIFT",
      message: "Embedded runtime-data contract is not the exact deterministic projection of ProductSpec and topology resources",
      reference: "runtimeDataContract",
    }));
  }
  return sortCompilationDiagnostics(diagnostics);
}

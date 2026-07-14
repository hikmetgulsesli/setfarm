import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import {
  CommandIdSchema,
  NormalizedRelativeLocatorSchema,
  PersistenceIdSchema,
  Sha256Schema,
  hasUniqueStrings,
} from "./common-v1.js";
import { ProductDeliveryV1Schema } from "./product-spec-v1.js";

const EnvironmentRefSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Z_][A-Z0-9_]*$/);

const RESERVED_RUNTIME_ENV_REFS = new Set([
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "TMPDIR",
  "LANG",
  "LC_ALL",
  "HOST",
  "PORT",
  "XDG_CACHE_HOME",
]);

function relativePathsOverlap(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

export const RuntimeDataAuthorityIdSchema = z
  .string()
  .min(11)
  .max(160)
  .regex(/^AUTH_DATA_[A-Z0-9]+(?:_[A-Z0-9]+)*$/);

export const RuntimeVolumeIdSchema = z
  .string()
  .min(8)
  .max(160)
  .regex(/^VOLUME_[A-Z0-9]+(?:_[A-Z0-9]+)*$/);

const RuntimeResourceQuotaV1Schema = z
  .object({
    maxBytes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    maxFiles: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

const RuntimeDataPathBindingV1Schema = z
  .object({
    persistenceRef: PersistenceIdSchema,
    relativePath: NormalizedRelativeLocatorSchema,
  })
  .strict();

export const RuntimeWritableVolumeDeclarationV1Schema = z
  .object({
    volumeId: RuntimeVolumeIdSchema,
    authorityId: RuntimeDataAuthorityIdSchema,
    persistenceClass: z.enum(["project", "run", "ephemeral"]),
    purpose: z.enum(["application-data", "database", "uploads"]),
    mountEnvRef: EnvironmentRefSchema,
    durability: z.enum(["session", "restart", "durable"]),
    dataPaths: z.array(RuntimeDataPathBindingV1Schema).min(1).max(2_000),
    quota: RuntimeResourceQuotaV1Schema,
    migrationCommandRef: CommandIdSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (!hasUniqueStrings(value.dataPaths.map((binding) => binding.persistenceRef))) {
      context.addIssue({
        code: "custom",
        path: ["dataPaths"],
        message: "Writable-volume persistence refs must be unique",
      });
    }
    if (!hasUniqueStrings(value.dataPaths.map((binding) => binding.relativePath))) {
      context.addIssue({
        code: "custom",
        path: ["dataPaths"],
        message: "Writable-volume relative data paths must be unique",
      });
    }
    value.dataPaths.forEach((binding, index) => {
      const conflictingIndex = value.dataPaths.findIndex((candidate, candidateIndex) =>
        candidateIndex < index && relativePathsOverlap(candidate.relativePath, binding.relativePath));
      if (conflictingIndex >= 0) {
        context.addIssue({
          code: "custom",
          path: ["dataPaths", index, "relativePath"],
          message: `Writable-volume data path overlaps ancestor or descendant path at index ${conflictingIndex}`,
        });
      }
    });
  });

export type RuntimeWritableVolumeDeclarationV1 = z.infer<
  typeof RuntimeWritableVolumeDeclarationV1Schema
>;

export const RuntimeExternalDatabaseDeclarationV1Schema = z
  .object({
    authorityId: RuntimeDataAuthorityIdSchema,
    databaseKind: z.literal("postgres"),
    persistenceRefs: z.array(PersistenceIdSchema).min(1).max(2_000).refine(hasUniqueStrings, {
      message: "External-database persistence refs must be unique",
    }),
    credentialEnvRefs: z.array(EnvironmentRefSchema).min(1).max(100).refine(hasUniqueStrings, {
      message: "External-database credential environment refs must be unique",
    }),
    migrationCommandRef: CommandIdSchema,
  })
  .strict();

export type RuntimeExternalDatabaseDeclarationV1 = z.infer<
  typeof RuntimeExternalDatabaseDeclarationV1Schema
>;

export const RuntimeScratchDeclarationV1Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z.object({
    kind: z.literal("platform-managed"),
    quota: RuntimeResourceQuotaV1Schema,
  }).strict(),
]);

export const RuntimeDataProvisioningV1Schema = z
  .object({
    schema: z.literal("setfarm.runtime-data-provisioning.v1"),
    writableVolumes: z.array(RuntimeWritableVolumeDeclarationV1Schema).max(1_000),
    externalDatabases: z.array(RuntimeExternalDatabaseDeclarationV1Schema).max(1_000),
    scratch: RuntimeScratchDeclarationV1Schema,
  })
  .strict()
  .superRefine((value, context) => {
    if (!hasUniqueStrings(value.writableVolumes.map((volume) => volume.volumeId))) {
      context.addIssue({
        code: "custom",
        path: ["writableVolumes"],
        message: "Writable-volume IDs must be unique",
      });
    }
    const serverAuthorityIds = value.writableVolumes.map((volume) => volume.authorityId);
    const externalAuthorityIds = value.externalDatabases.map((database) => database.authorityId);
    const mountEnvRefs = value.writableVolumes.map((volume) => volume.mountEnvRef);
    const credentialEnvRefs = value.externalDatabases.flatMap((database) => database.credentialEnvRefs);
    if (!hasUniqueStrings(mountEnvRefs)) {
      context.addIssue({
        code: "custom",
        path: ["writableVolumes"],
        message: "Writable-volume mount environment refs must be globally unique",
      });
    }
    if (!hasUniqueStrings(credentialEnvRefs)) {
      context.addIssue({
        code: "custom",
        path: ["externalDatabases"],
        message: "External-database credential environment refs must be globally unique",
      });
    }
    value.writableVolumes.forEach((volume, index) => {
      if (RESERVED_RUNTIME_ENV_REFS.has(volume.mountEnvRef)) {
        context.addIssue({
          code: "custom",
          path: ["writableVolumes", index, "mountEnvRef"],
          message: `Writable-volume mount environment ref is platform-reserved: ${volume.mountEnvRef}`,
        });
      }
    });
    value.externalDatabases.forEach((database, databaseIndex) => {
      database.credentialEnvRefs.forEach((envRef, envIndex) => {
        if (RESERVED_RUNTIME_ENV_REFS.has(envRef)) {
          context.addIssue({
            code: "custom",
            path: ["externalDatabases", databaseIndex, "credentialEnvRefs", envIndex],
            message: `External credential environment ref is platform-reserved: ${envRef}`,
          });
        }
        if (mountEnvRefs.includes(envRef)) {
          context.addIssue({
            code: "custom",
            path: ["externalDatabases", databaseIndex, "credentialEnvRefs", envIndex],
            message: `Environment ref cannot be both a writable mount and a database credential: ${envRef}`,
          });
        }
      });
    });
    if (!hasUniqueStrings(externalAuthorityIds)) {
      context.addIssue({
        code: "custom",
        path: ["externalDatabases"],
        message: "External-database authority IDs must be unique",
      });
    }
    const crossKindIds = new Set(serverAuthorityIds);
    externalAuthorityIds.forEach((authorityId, index) => {
      if (crossKindIds.has(authorityId)) {
        context.addIssue({
          code: "custom",
          path: ["externalDatabases", index, "authorityId"],
          message: "One runtime-data authority cannot be both filesystem and external database",
        });
      }
    });
  });

export type RuntimeDataProvisioningV1 = z.infer<typeof RuntimeDataProvisioningV1Schema>;

const RuntimeDataPolicyBindingV1Schema = z
  .object({
    persistenceRef: PersistenceIdSchema,
    authorityRef: RuntimeDataAuthorityIdSchema,
  })
  .strict();

const StatelessDataAuthorityV1Schema = z
  .object({
    id: RuntimeDataAuthorityIdSchema,
    kind: z.literal("stateless"),
    durability: z.enum(["none", "session"]),
    persistenceRefs: z.array(PersistenceIdSchema).max(2_000).refine(hasUniqueStrings),
  })
  .strict();

const BrowserOriginKeyBindingV1Schema = z
  .object({
    persistenceRef: PersistenceIdSchema,
    key: z.string().min(1).max(500),
    durability: z.enum(["session", "reload", "restart", "durable"]),
  })
  .strict();

const BrowserOriginDataAuthorityV1Schema = z
  .object({
    id: RuntimeDataAuthorityIdSchema,
    kind: z.literal("browser-origin"),
    originScope: z.literal("application"),
    persistenceRefs: z.array(PersistenceIdSchema).min(1).max(2_000).refine(hasUniqueStrings),
    keyBindings: z.array(BrowserOriginKeyBindingV1Schema).min(1).max(2_000),
  })
  .strict();

const ServerFilesystemDataAuthorityV1Schema = z
  .object({
    id: RuntimeDataAuthorityIdSchema,
    kind: z.literal("server-filesystem"),
    engine: z.enum(["files", "sqlite"]),
    persistenceRefs: z.array(PersistenceIdSchema).min(1).max(2_000).refine(hasUniqueStrings),
    volumeRefs: z.array(RuntimeVolumeIdSchema).min(1).max(1_000).refine(hasUniqueStrings),
  })
  .strict();

const ExternalDatabaseDataAuthorityV1Schema = z
  .object({
    id: RuntimeDataAuthorityIdSchema,
    kind: z.literal("external-database"),
    databaseKind: z.literal("postgres"),
    durability: z.literal("durable"),
    persistenceRefs: z.array(PersistenceIdSchema).min(1).max(2_000).refine(hasUniqueStrings),
    credentialEnvRefs: z.array(EnvironmentRefSchema).min(1).max(100).refine(hasUniqueStrings),
    migrationCommandRef: CommandIdSchema,
  })
  .strict();

export const RuntimeDataAuthorityV1Schema = z.discriminatedUnion("kind", [
  StatelessDataAuthorityV1Schema,
  BrowserOriginDataAuthorityV1Schema,
  ServerFilesystemDataAuthorityV1Schema,
  ExternalDatabaseDataAuthorityV1Schema,
]);

export type RuntimeDataAuthorityV1 = z.infer<typeof RuntimeDataAuthorityV1Schema>;

export const RuntimeWritableVolumeV1Schema = RuntimeWritableVolumeDeclarationV1Schema;
export type RuntimeWritableVolumeV1 = z.infer<typeof RuntimeWritableVolumeV1Schema>;

const RuntimeScratchPolicyV1Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z.object({
    kind: z.literal("platform-managed"),
    lifecycle: z.literal("attempt"),
    persistenceAllowed: z.literal(false),
    envBindings: z.tuple([
      z.object({ envRef: z.literal("HOME"), purpose: z.literal("home") }).strict(),
      z.object({ envRef: z.literal("TMPDIR"), purpose: z.literal("temporary") }).strict(),
      z.object({ envRef: z.literal("XDG_CACHE_HOME"), purpose: z.literal("cache") }).strict(),
    ]),
    quota: RuntimeResourceQuotaV1Schema,
  }).strict(),
]);

function canonicalOrder(values: readonly string[]): boolean {
  return values.every((value, index) => value === [...values].sort()[index]);
}

export const RuntimeDataContractV1Schema = z
  .object({
    schema: z.literal("setfarm.runtime-data-contract.v1"),
    contractVersion: z.literal(1),
    sourceProductSpecHash: Sha256Schema,
    delivery: z.object({
      platform: ProductDeliveryV1Schema.shape.platform,
      techStack: ProductDeliveryV1Schema.shape.techStack,
      database: ProductDeliveryV1Schema.shape.database,
    }).strict(),
    policyBindings: z.array(RuntimeDataPolicyBindingV1Schema).max(2_000),
    authorities: z.array(RuntimeDataAuthorityV1Schema).min(1).max(1_000),
    writableVolumes: z.array(RuntimeWritableVolumeV1Schema).max(1_000),
    scratch: RuntimeScratchPolicyV1Schema,
  })
  .strict()
  .superRefine((value, context) => {
    const policyRefs = value.policyBindings.map((binding) => binding.persistenceRef);
    const authorityIds = value.authorities.map((authority) => authority.id);
    const volumeIds = value.writableVolumes.map((volume) => volume.volumeId);
    if (!hasUniqueStrings(policyRefs) || !canonicalOrder(policyRefs)) {
      context.addIssue({
        code: "custom",
        path: ["policyBindings"],
        message: "Runtime-data policy bindings must be unique and canonically sorted",
      });
    }
    if (!hasUniqueStrings(authorityIds) || !canonicalOrder(authorityIds)) {
      context.addIssue({
        code: "custom",
        path: ["authorities"],
        message: "Runtime-data authorities must be unique and canonically sorted",
      });
    }
    if (!hasUniqueStrings(volumeIds) || !canonicalOrder(volumeIds)) {
      context.addIssue({
        code: "custom",
        path: ["writableVolumes"],
        message: "Runtime-data volumes must be unique and canonically sorted",
      });
    }

    const authorityById = new Map(value.authorities.map((authority) => [authority.id, authority]));
    const bindingAuthorityByPolicy = new Map(
      value.policyBindings.map((binding) => [binding.persistenceRef, binding.authorityRef]),
    );
    value.policyBindings.forEach((binding, index) => {
      if (!authorityById.has(binding.authorityRef)) {
        context.addIssue({
          code: "custom",
          path: ["policyBindings", index, "authorityRef"],
          message: `Policy binding references absent runtime-data authority: ${binding.authorityRef}`,
        });
      }
    });
    value.authorities.forEach((authority, authorityIndex) => {
      if (!canonicalOrder(authority.persistenceRefs)) {
        context.addIssue({
          code: "custom",
          path: ["authorities", authorityIndex, "persistenceRefs"],
          message: "Authority persistence refs must be canonically sorted",
        });
      }
      authority.persistenceRefs.forEach((persistenceRef, persistenceIndex) => {
        if (bindingAuthorityByPolicy.get(persistenceRef) !== authority.id) {
          context.addIssue({
            code: "custom",
            path: ["authorities", authorityIndex, "persistenceRefs", persistenceIndex],
            message: `Authority persistence ref is absent or bound elsewhere: ${persistenceRef}`,
          });
        }
      });
      const boundRefs = value.policyBindings
        .filter((binding) => binding.authorityRef === authority.id)
        .map((binding) => binding.persistenceRef);
      if (
        boundRefs.length !== authority.persistenceRefs.length
        || boundRefs.some((persistenceRef) => !authority.persistenceRefs.includes(persistenceRef))
      ) {
        context.addIssue({
          code: "custom",
          path: ["authorities", authorityIndex, "persistenceRefs"],
          message: "Authority persistence refs must exactly equal its policy bindings",
        });
      }
      if (authority.kind === "browser-origin") {
        const keyRefs = authority.keyBindings.map((binding) => binding.persistenceRef);
        const storageKeys = authority.keyBindings.map((binding) => binding.key);
        if (
          !hasUniqueStrings(keyRefs)
          || !canonicalOrder(keyRefs)
          || keyRefs.length !== authority.persistenceRefs.length
          || keyRefs.some((persistenceRef) => !authority.persistenceRefs.includes(persistenceRef))
        ) {
          context.addIssue({
            code: "custom",
            path: ["authorities", authorityIndex, "keyBindings"],
            message: "Browser key bindings must exactly and canonically cover authority policies",
          });
        }
        if (!hasUniqueStrings(storageKeys)) {
          context.addIssue({
            code: "custom",
            path: ["authorities", authorityIndex, "keyBindings"],
            message: "Browser-origin storage keys must be unique",
          });
        }
      }
      if (authority.kind === "external-database") {
        if (!canonicalOrder(authority.credentialEnvRefs)) {
          context.addIssue({
            code: "custom",
            path: ["authorities", authorityIndex, "credentialEnvRefs"],
            message: "External credential refs must be canonically sorted",
          });
        }
        authority.credentialEnvRefs.forEach((envRef, envIndex) => {
          if (RESERVED_RUNTIME_ENV_REFS.has(envRef)) {
            context.addIssue({
              code: "custom",
              path: ["authorities", authorityIndex, "credentialEnvRefs", envIndex],
              message: `External credential environment ref is platform-reserved: ${envRef}`,
            });
          }
        });
      }
    });

    const mountEnvRefs = value.writableVolumes.map((volume) => volume.mountEnvRef);
    const credentialEnvRefs = value.authorities.flatMap((authority) =>
      authority.kind === "external-database" ? authority.credentialEnvRefs : []);
    if (!hasUniqueStrings(mountEnvRefs)) {
      context.addIssue({
        code: "custom",
        path: ["writableVolumes"],
        message: "Writable-volume mount environment refs must be globally unique",
      });
    }
    if (!hasUniqueStrings(credentialEnvRefs)) {
      context.addIssue({
        code: "custom",
        path: ["authorities"],
        message: "External credential environment refs must be globally unique",
      });
    }
    value.writableVolumes.forEach((volume, volumeIndex) => {
      if (RESERVED_RUNTIME_ENV_REFS.has(volume.mountEnvRef)) {
        context.addIssue({
          code: "custom",
          path: ["writableVolumes", volumeIndex, "mountEnvRef"],
          message: `Writable-volume mount environment ref is platform-reserved: ${volume.mountEnvRef}`,
        });
      }
      if (credentialEnvRefs.includes(volume.mountEnvRef)) {
        context.addIssue({
          code: "custom",
          path: ["writableVolumes", volumeIndex, "mountEnvRef"],
          message: `Environment ref cannot be both a writable mount and a database credential: ${volume.mountEnvRef}`,
        });
      }
    });

    const volumesByAuthority = new Map<string, typeof value.writableVolumes>();
    value.writableVolumes.forEach((volume, volumeIndex) => {
      const authority = authorityById.get(volume.authorityId);
      if (authority?.kind !== "server-filesystem") {
        context.addIssue({
          code: "custom",
          path: ["writableVolumes", volumeIndex, "authorityId"],
          message: `Writable volume must belong to a server-filesystem authority: ${volume.authorityId}`,
        });
      }
      const current = volumesByAuthority.get(volume.authorityId) ?? [];
      current.push(volume);
      volumesByAuthority.set(volume.authorityId, current);
      const dataPathRefs = volume.dataPaths.map((binding) => binding.persistenceRef);
      if (!canonicalOrder(dataPathRefs)) {
        context.addIssue({
          code: "custom",
          path: ["writableVolumes", volumeIndex, "dataPaths"],
          message: "Volume data paths must be canonically sorted by persistence ref",
        });
      }
      dataPathRefs.forEach((persistenceRef, persistenceIndex) => {
        if (bindingAuthorityByPolicy.get(persistenceRef) !== volume.authorityId) {
          context.addIssue({
            code: "custom",
            path: ["writableVolumes", volumeIndex, "dataPaths", persistenceIndex, "persistenceRef"],
            message: `Volume data path is not owned by its authority: ${persistenceRef}`,
          });
        }
      });
    });
    value.authorities.forEach((authority, authorityIndex) => {
      const volumes = volumesByAuthority.get(authority.id) ?? [];
      if (authority.kind === "server-filesystem") {
        const observedVolumeRefs = volumes.map((volume) => volume.volumeId).sort();
        if (
          !canonicalOrder(authority.volumeRefs)
          || observedVolumeRefs.length !== authority.volumeRefs.length
          || observedVolumeRefs.some((volumeRef, index) => volumeRef !== authority.volumeRefs[index])
        ) {
          context.addIssue({
            code: "custom",
            path: ["authorities", authorityIndex, "volumeRefs"],
            message: "Server authority volume refs must exactly equal its writable volumes",
          });
        }
        const volumePolicies = volumes.flatMap((volume) =>
          volume.dataPaths.map((binding) => binding.persistenceRef));
        if (
          !hasUniqueStrings(volumePolicies)
          || volumePolicies.length !== authority.persistenceRefs.length
          || volumePolicies.some((persistenceRef) => !authority.persistenceRefs.includes(persistenceRef))
        ) {
          context.addIssue({
            code: "custom",
            path: ["authorities", authorityIndex, "persistenceRefs"],
            message: "Server volumes must exactly cover authority persistence refs once",
          });
        }
      } else if (volumes.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["authorities", authorityIndex],
          message: `${authority.kind} authority cannot own host writable volumes`,
        });
      }
    });
    if (value.policyBindings.length === 0) {
      const only = value.authorities.length === 1 ? value.authorities[0] : undefined;
      if (only?.kind !== "stateless" || only.persistenceRefs.length !== 0) {
        context.addIssue({
          code: "custom",
          path: ["authorities"],
          message: "A no-policy product must declare exactly one empty stateless authority",
        });
      }
    } else {
      value.authorities.forEach((authority, index) => {
        if (authority.persistenceRefs.length === 0) {
          context.addIssue({
            code: "custom",
            path: ["authorities", index, "persistenceRefs"],
            message: "A runtime-data authority cannot be unowned by ProductSpec persistence",
          });
        }
      });
    }
  });

export type RuntimeDataContractV1 = z.infer<typeof RuntimeDataContractV1Schema>;

export function hashRuntimeDataContractV1(value: unknown): string {
  return hashCanonicalJson(RuntimeDataContractV1Schema.parse(value));
}

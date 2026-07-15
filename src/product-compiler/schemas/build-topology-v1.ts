import { z } from "zod";
import { createHash } from "node:crypto";

import {
  CapabilityIdSchema,
  CommandIdSchema,
  EntrypointIdSchema,
  GitObjectHashSchema,
  NormalizedRelativeLocatorSchema,
  OwnerIdSchema,
  PathBindingIdSchema,
  RepoRelativePathSchema,
  RouteIdSchema,
  Sha256Schema,
  SharedGrantIdSchema,
  StoryIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import {
  RuntimeDataContractV1Schema,
  hashRuntimeDataContractV1,
} from "./runtime-data-contract-v1.js";

const StackPackV1Schema = z
  .object({
    id: z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    version: z.string().min(1).max(100),
    contentHash: Sha256Schema,
  })
  .strict();

export const ProductDeliverySelectionRefV1Schema = z.object({
  schema: z.literal("setfarm.product-delivery-selection-ref.v1"),
  profileId: z.string().min(1).max(160).regex(/^[A-Z0-9_]+$/),
  catalogVersion: z.string().min(1).max(100),
  catalogHash: Sha256Schema,
  selectionHash: Sha256Schema,
  productClass: z.string().min(1).max(160),
  stackPackId: z.string().min(1).max(160),
  designProjection: z.string().min(1).max(160),
  topologyDescriptorHash: Sha256Schema,
}).strict();

export type ProductDeliverySelectionRefV1 = z.infer<typeof ProductDeliverySelectionRefV1Schema>;

const RepoIdentityV1Schema = z
  .object({
    id: z.string().min(1).max(200).regex(/^[A-Za-z0-9._-]+$/),
    baseSha: GitObjectHashSchema,
    treeHash: GitObjectHashSchema,
  })
  .strict();

const StoryTopologyOwnerV1Schema = z
  .object({
    id: OwnerIdSchema,
    kind: z.literal("story"),
    storyRef: StoryIdSchema,
  })
  .strict();

const SetupTopologyOwnerV1Schema = z
  .object({
    id: OwnerIdSchema,
    kind: z.literal("setup"),
  })
  .strict();

export const TopologyOwnerV1Schema = z.discriminatedUnion("kind", [
  StoryTopologyOwnerV1Schema,
  SetupTopologyOwnerV1Schema,
]);

export type TopologyOwnerV1 = z.infer<typeof TopologyOwnerV1Schema>;

const ABSENT_PATH_HASH_DOMAIN = "setfarm.path-absence.v1\0";

export function topologyPathAbsenceHash(path: string): string {
  return createHash("sha256").update(`${ABSENT_PATH_HASH_DOMAIN}${path}`, "utf8").digest("hex");
}

export const TopologyPathBindingV1Schema = z
  .object({
    id: PathBindingIdSchema,
    path: NormalizedRelativeLocatorSchema,
    role: z.enum(["source", "test", "config", "asset", "entrypoint", "generated", "dependency"]),
    ownerRef: OwnerIdSchema,
    presence: z.enum(["present", "absent"]),
    knownContentHash: Sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.presence === "absent" && value.knownContentHash !== topologyPathAbsenceHash(value.path)) {
      context.addIssue({
        code: "custom",
        path: ["knownContentHash"],
        message: "Absent paths must use the canonical path-specific absence hash",
      });
    }
  });

export type TopologyPathBindingV1 = z.infer<typeof TopologyPathBindingV1Schema>;

export const SharedGrantV1Schema = z
  .object({
    id: SharedGrantIdSchema,
    fromOwnerRef: OwnerIdSchema,
    toOwnerRef: OwnerIdSchema,
    pathRefs: z.array(PathBindingIdSchema).min(1).max(1_000).refine(hasUniqueStrings, {
      message: "Shared grant path refs must be unique",
    }),
    permissions: z.array(z.enum(["read", "write"])).min(1).max(2).refine(hasUniqueStrings, {
      message: "Shared grant permissions must be unique",
    }),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.fromOwnerRef === value.toOwnerRef) {
      context.addIssue({
        code: "custom",
        path: ["toOwnerRef"],
        message: "A shared grant must cross ownership boundaries",
      });
    }
  });

export type SharedGrantV1 = z.infer<typeof SharedGrantV1Schema>;

export const BuildEntrypointV1Schema = z
  .object({
    id: EntrypointIdSchema,
    kind: z.enum(["web", "cli", "api", "worker", "native", "game"]),
    pathRef: PathBindingIdSchema,
    mountPoint: z.string().min(1).max(500),
    routeRefs: z.array(RouteIdSchema).max(1_000).refine(hasUniqueStrings, {
      message: "Entrypoint route refs must be unique",
    }),
  })
  .strict();

export type BuildEntrypointV1 = z.infer<typeof BuildEntrypointV1Schema>;

export const BuildCommandV1Schema = z
  .object({
    id: CommandIdSchema,
    kind: z.enum(["install", "build", "test", "dev", "preview", "lint", "evidence", "migrate"]),
    argv: z.array(z.string().min(1).max(12_000)).min(1).max(100),
    cwd: RepoRelativePathSchema,
    timeoutMs: z.number().int().positive().max(86_400_000),
    capabilityRefs: z.array(CapabilityIdSchema).max(500).refine(hasUniqueStrings, {
      message: "Command capability refs must be unique",
    }),
    envRefs: z.array(
      z.string().min(1).max(160).regex(/^[A-Z_][A-Z0-9_]*$/),
    ).max(500).refine(hasUniqueStrings, {
      message: "Command environment refs must be unique",
    }).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const totalArgumentBytes = value.argv.reduce(
      (total, argument) => total + Buffer.byteLength(argument, "utf8"),
      0,
    );
    if (totalArgumentBytes > 64 * 1024) {
      context.addIssue({
        code: "custom",
        path: ["argv"],
        message: "Command arguments exceed the bounded command contract",
      });
    }
  });

export type BuildCommandV1 = z.infer<typeof BuildCommandV1Schema>;

export const BuildCapabilityV1Schema = z
  .object({
    id: CapabilityIdSchema,
    kind: z.enum([
      "browser_interaction",
      "local_persistence",
      "database",
      "filesystem",
      "network",
      "visual_capture",
      "download",
      "cli_interaction",
      "native_runtime",
      "test_runner",
      "other",
    ]),
    enabled: z.boolean(),
    provider: z.string().min(1).max(200).optional(),
  })
  .strict();

export type BuildCapabilityV1 = z.infer<typeof BuildCapabilityV1Schema>;

const BuildPoliciesV1Schema = z
  .object({
    packageManager: z.enum(["npm", "pnpm", "yarn", "bun", "pip", "poetry", "gradle", "xcode", "none"]),
    allowedRoots: z.array(NormalizedRelativeLocatorSchema).min(1).max(500).refine(hasUniqueStrings, {
      message: "Allowed roots must be unique",
    }),
    deniedGlobs: z.array(z.string().min(1).max(500)).max(500).refine(hasUniqueStrings, {
      message: "Denied globs must be unique",
    }),
    buildOutputPaths: z.array(NormalizedRelativeLocatorSchema).max(500).refine(hasUniqueStrings, {
      message: "Build output paths must be unique",
    }),
  })
  .strict();

export const BuildTopologyV1Schema = z
  .object({
    schema: z.literal("setfarm.build-topology.v1"),
    stackPack: StackPackV1Schema,
    deliveryProfile: ProductDeliverySelectionRefV1Schema.optional(),
    repo: RepoIdentityV1Schema,
    owners: z.array(TopologyOwnerV1Schema).min(1).max(2_000),
    pathBindings: z.array(TopologyPathBindingV1Schema).min(1).max(20_000),
    sharedGrants: z.array(SharedGrantV1Schema).max(20_000),
    entrypoints: z.array(BuildEntrypointV1Schema).min(1).max(1_000),
    commands: z.array(BuildCommandV1Schema).min(1).max(1_000),
    capabilities: z.array(BuildCapabilityV1Schema).max(1_000),
    policies: BuildPoliciesV1Schema,
    runtimeDataContract: RuntimeDataContractV1Schema.optional(),
    runtimeDataContractHash: Sha256Schema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const unique = (items: readonly string[], path: PropertyKey[], label: string) => {
      if (!hasUniqueStrings(items)) {
        context.addIssue({ code: "custom", path, message: `${label} must be unique` });
      }
    };
    unique(value.owners.map((item) => item.id), ["owners"], "Owner IDs");
    unique(
      value.owners.filter((item) => item.kind === "story").map((item) => item.storyRef),
      ["owners"],
      "Story owner refs",
    );
    unique(value.pathBindings.map((item) => item.id), ["pathBindings"], "Path binding IDs");
    unique(value.pathBindings.map((item) => item.path), ["pathBindings"], "Owned paths");
    unique(value.sharedGrants.map((item) => item.id), ["sharedGrants"], "Shared grant IDs");
    unique(value.entrypoints.map((item) => item.id), ["entrypoints"], "Entrypoint IDs");
    unique(value.commands.map((item) => item.id), ["commands"], "Command IDs");
    unique(value.capabilities.map((item) => item.id), ["capabilities"], "Capability IDs");
    if (value.deliveryProfile) {
      if (value.deliveryProfile.stackPackId !== value.stackPack.id) {
        context.addIssue({
          code: "custom",
          path: ["deliveryProfile", "stackPackId"],
          message: "Delivery profile stack pack must equal BuildTopology stack pack",
        });
      }
      if (value.deliveryProfile.topologyDescriptorHash !== value.stackPack.contentHash) {
        context.addIssue({
          code: "custom",
          path: ["deliveryProfile", "topologyDescriptorHash"],
          message: "Delivery profile topology descriptor hash must equal BuildTopology stack content hash",
        });
      }
    }

    const ownerIds = new Set(value.owners.map((item) => item.id));
    const pathIds = new Set(value.pathBindings.map((item) => item.id));
    const capabilityIds = new Set(value.capabilities.map((item) => item.id));
    value.pathBindings.forEach((binding, index) => {
      if (!ownerIds.has(binding.ownerRef)) {
        context.addIssue({
          code: "custom",
          path: ["pathBindings", index, "ownerRef"],
          message: `Path binding references absent owner: ${binding.ownerRef}`,
        });
      }
    });
    value.sharedGrants.forEach((grant, index) => {
      for (const [field, ownerRef] of [["fromOwnerRef", grant.fromOwnerRef], ["toOwnerRef", grant.toOwnerRef]] as const) {
        if (!ownerIds.has(ownerRef)) {
          context.addIssue({
            code: "custom",
            path: ["sharedGrants", index, field],
            message: `Shared grant references absent owner: ${ownerRef}`,
          });
        }
      }
      grant.pathRefs.forEach((pathRef, pathIndex) => {
        if (!pathIds.has(pathRef)) {
          context.addIssue({
            code: "custom",
            path: ["sharedGrants", index, "pathRefs", pathIndex],
            message: `Shared grant references absent path: ${pathRef}`,
          });
        }
      });
    });
    value.entrypoints.forEach((entrypoint, index) => {
      if (!pathIds.has(entrypoint.pathRef)) {
        context.addIssue({
          code: "custom",
          path: ["entrypoints", index, "pathRef"],
          message: `Entrypoint references absent path: ${entrypoint.pathRef}`,
        });
      }
    });
    value.commands.forEach((command, commandIndex) => {
      command.capabilityRefs.forEach((capabilityRef, capabilityIndex) => {
        if (!capabilityIds.has(capabilityRef)) {
          context.addIssue({
            code: "custom",
            path: ["commands", commandIndex, "capabilityRefs", capabilityIndex],
            message: `Command references absent capability: ${capabilityRef}`,
          });
        }
      });
    });
    if (!value.commands.some((command) => command.kind === "build")) {
      context.addIssue({
        code: "custom",
        path: ["commands"],
        message: "Build topology requires a typed build command",
      });
    }
    const runtimeDataPresence = [value.runtimeDataContract, value.runtimeDataContractHash]
      .filter((item) => item !== undefined).length;
    if (runtimeDataPresence === 1) {
      context.addIssue({
        code: "custom",
        path: ["runtimeDataContract"],
        message: "Legacy compatibility permits runtime-data contract and hash only together or both absent",
      });
    }
    if (
      value.runtimeDataContract
      && value.runtimeDataContractHash
      && hashRuntimeDataContractV1(value.runtimeDataContract) !== value.runtimeDataContractHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["runtimeDataContractHash"],
        message: "Runtime-data contract hash must equal the exact canonical embedded contract",
      });
    }
  });

export type BuildTopologyV1 = z.infer<typeof BuildTopologyV1Schema>;

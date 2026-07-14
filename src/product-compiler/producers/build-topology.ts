import { z } from "zod";

import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "../diagnostics.js";
import {
  BuildCapabilityV1Schema,
  BuildCommandV1Schema,
  BuildEntrypointV1Schema,
  BuildTopologyV1Schema,
  SharedGrantV1Schema,
  TopologyOwnerV1Schema,
  TopologyPathBindingV1Schema,
  type BuildTopologyV1,
} from "../schemas/build-topology-v1.js";
import type { CompilationDiagnosticV1 } from "../schemas/compilation-report-v1.js";
import { hasUniqueStrings } from "../schemas/common-v1.js";
import { ProductSpecV1Schema } from "../schemas/product-spec-v1.js";
import { RuntimeDataProvisioningV1Schema } from "../schemas/runtime-data-contract-v1.js";
import {
  produceRuntimeDataContractV1,
  type RuntimeDataContractProducerResult,
} from "./runtime-data-contract.js";

const CapabilityKindSchema = BuildCapabilityV1Schema.shape.kind;
const EntrypointKindSchema = BuildEntrypointV1Schema.shape.kind;
const CommandKindSchema = BuildCommandV1Schema.shape.kind;
const PathRoleSchema = TopologyPathBindingV1Schema.shape.role;
const PackageManagerSchema = BuildTopologyV1Schema.shape.policies.shape.packageManager;

const StackCapabilityContractSchema = z
  .object({
    id: BuildCapabilityV1Schema.shape.id,
    kind: CapabilityKindSchema,
    required: z.boolean(),
    providers: z.array(z.string().min(1).max(200)).max(100).refine(hasUniqueStrings, {
      message: "Capability providers must be unique",
    }),
  })
  .strict();

const StackTopologyContractSchema = z
  .object({
    identity: BuildTopologyV1Schema.shape.stackPack,
    capabilities: z.array(StackCapabilityContractSchema).max(1_000),
    entrypointKinds: z.array(EntrypointKindSchema).min(1).max(10).refine(hasUniqueStrings, {
      message: "Supported entrypoint kinds must be unique",
    }),
    commandKinds: z.array(CommandKindSchema).min(1).max(10).refine(hasUniqueStrings, {
      message: "Supported command kinds must be unique",
    }),
    requiredCommandKinds: z.array(CommandKindSchema).min(1).max(10).refine(hasUniqueStrings, {
      message: "Required command kinds must be unique",
    }),
    requiredPathRoles: z.array(PathRoleSchema).min(1).max(20).refine(hasUniqueStrings, {
      message: "Required path roles must be unique",
    }),
    packageManagers: z.array(PackageManagerSchema).min(1).max(20).refine(hasUniqueStrings, {
      message: "Supported package managers must be unique",
    }),
  })
  .strict()
  .superRefine((value, context) => {
    if (!hasUniqueStrings(value.capabilities.map((capability) => capability.id))) {
      context.addIssue({
        code: "custom",
        path: ["capabilities"],
        message: "Stack capability IDs must be unique",
      });
    }
    const commandKinds = new Set(value.commandKinds);
    value.requiredCommandKinds.forEach((kind, index) => {
      if (!commandKinds.has(kind)) {
        context.addIssue({
          code: "custom",
          path: ["requiredCommandKinds", index],
          message: `Required command kind is not supported: ${kind}`,
        });
      }
    });
    if (!value.requiredCommandKinds.includes("build")) {
      context.addIssue({
        code: "custom",
        path: ["requiredCommandKinds"],
        message: "A stack topology contract must require a build command",
      });
    }
  });

const BuildTopologyProducerInputSchema = z
  .object({
    stackContract: StackTopologyContractSchema,
    repo: BuildTopologyV1Schema.shape.repo,
    owners: z.array(TopologyOwnerV1Schema).min(1).max(2_000),
    pathBindings: z.array(TopologyPathBindingV1Schema).min(1).max(20_000),
    sharedGrants: z.array(SharedGrantV1Schema).max(20_000),
    entrypoints: z.array(BuildEntrypointV1Schema).min(1).max(1_000),
    commands: z.array(BuildCommandV1Schema).min(1).max(1_000),
    capabilities: z.array(BuildCapabilityV1Schema).max(1_000),
    policies: BuildTopologyV1Schema.shape.policies,
    productSpec: ProductSpecV1Schema.optional(),
    runtimeDataProvisioning: RuntimeDataProvisioningV1Schema.optional(),
  })
  .strict();

export type BuildTopologyProducerInput = z.input<typeof BuildTopologyProducerInputSchema>;

export type BuildTopologyProducerResult =
  | Readonly<{
      status: "produced";
      buildTopology: BuildTopologyV1;
      diagnostics: readonly [];
    }>
  | Readonly<{
      status: "rejected";
      rejectionCodes: string[];
      diagnostics: CompilationDiagnosticV1[];
    }>;

type ParsedInput = z.infer<typeof BuildTopologyProducerInputSchema>;

function diagnostic(input: {
  code: string;
  category?: CompilationDiagnosticV1["category"];
  message: string;
  reference?: string;
}): CompilationDiagnosticV1 {
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

function reject(diagnostics: readonly CompilationDiagnosticV1[]): BuildTopologyProducerResult {
  const sorted = sortCompilationDiagnostics(diagnostics).slice(0, 10_000);
  return {
    status: "rejected",
    rejectionCodes: [...new Set(sorted.map((item) => item.code))].sort(),
    diagnostics: sorted,
  };
}

function inputDiagnostics(error: z.ZodError): CompilationDiagnosticV1[] {
  return error.issues.slice(0, 200).map((issue) => diagnostic({
    code: "BUILD_TOPOLOGY_INPUT_INVALID",
    category: "configuration",
    message: `Typed topology input failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
    reference: issue.path.join("/") || "$",
  }));
}

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function isWithinRoot(locator: string, root: string): boolean {
  return locator === root || locator.startsWith(`${root}/`);
}

function pathsOverlap(left: string, right: string): boolean {
  return isWithinRoot(left, right) || isWithinRoot(right, left);
}

function validateOwnership(value: ParsedInput): CompilationDiagnosticV1[] {
  const diagnostics: CompilationDiagnosticV1[] = [];
  const owners = new Map(value.owners.map((owner) => [owner.id, owner]));
  const bindingsByOwner = new Map<string, ParsedInput["pathBindings"]>();
  for (const binding of value.pathBindings) {
    const bindings = bindingsByOwner.get(binding.ownerRef) ?? [];
    bindings.push(binding);
    bindingsByOwner.set(binding.ownerRef, bindings);
    if (!owners.has(binding.ownerRef)) {
      diagnostics.push(diagnostic({
        code: "BUILD_TOPOLOGY_PATH_OWNER_MISSING",
        message: `Path ${binding.id} references absent owner ${binding.ownerRef}`,
        reference: binding.id,
      }));
    }
  }
  value.owners.forEach((owner) => {
    if ((bindingsByOwner.get(owner.id) ?? []).length === 0) {
      diagnostics.push(diagnostic({
        code: "BUILD_TOPOLOGY_OWNER_PATH_MISSING",
        message: `Owner ${owner.id} has no exact path binding`,
        reference: owner.id,
      }));
    }
  });

  const bindingsByPath = new Map<string, ParsedInput["pathBindings"]>();
  value.pathBindings.forEach((binding) => {
    const bindings = bindingsByPath.get(binding.path) ?? [];
    bindings.push(binding);
    bindingsByPath.set(binding.path, bindings);
  });
  bindingsByPath.forEach((bindings, path) => {
    if (bindings.length > 1) {
      for (let index = 1; index < bindings.length; index += 1) {
        const left = bindings[0]!;
        const right = bindings[index]!;
        diagnostics.push(diagnostic({
          code: "BUILD_TOPOLOGY_PATH_COLLISION",
          message: `Path bindings ${left.id} and ${right.id} collide at ${path}`,
          reference: path,
        }));
      }
    }
  });
  value.pathBindings.forEach((binding) => {
    const segments = binding.path.split("/");
    for (let length = 1; length < segments.length; length += 1) {
      const ancestorPath = segments.slice(0, length).join("/");
      const ancestors = bindingsByPath.get(ancestorPath) ?? [];
      ancestors.forEach((ancestor) => {
        if (pathsOverlap(ancestor.path, binding.path)) {
          diagnostics.push(diagnostic({
            code: "BUILD_TOPOLOGY_PATH_OVERLAP",
            message: `Path bindings ${ancestor.id} and ${binding.id} overlap at ${ancestor.path} and ${binding.path}`,
            reference: `${ancestor.id}->${binding.id}`,
          }));
        }
      });
    }
  });

  const pathById = new Map(value.pathBindings.map((binding) => [binding.id, binding]));
  value.sharedGrants.forEach((grant) => {
    grant.pathRefs.forEach((pathRef) => {
      const binding = pathById.get(pathRef);
      if (binding && binding.ownerRef !== grant.fromOwnerRef) {
        diagnostics.push(diagnostic({
          code: "BUILD_TOPOLOGY_GRANT_SOURCE_OWNER_MISMATCH",
          message: `Grant ${grant.id} can only grant paths owned by ${grant.fromOwnerRef}`,
          reference: pathRef,
        }));
      }
    });
  });
  return diagnostics;
}

function validateRolesAndPolicies(value: ParsedInput): CompilationDiagnosticV1[] {
  const diagnostics: CompilationDiagnosticV1[] = [];
  const roles = new Set(value.pathBindings.map((binding) => binding.role));
  value.stackContract.requiredPathRoles.forEach((role) => {
    if (!roles.has(role)) {
      diagnostics.push(diagnostic({
        code: "BUILD_TOPOLOGY_REQUIRED_ROLE_MISSING",
        message: `Stack contract requires at least one ${role} path binding`,
        reference: role,
      }));
    }
  });

  value.pathBindings.forEach((binding) => {
    if (!value.policies.allowedRoots.some((root) => isWithinRoot(binding.path, root))) {
      diagnostics.push(diagnostic({
        code: "BUILD_TOPOLOGY_PATH_OUTSIDE_ALLOWED_ROOT",
        message: `Path ${binding.path} is outside the exact allowed roots`,
        reference: binding.id,
      }));
    }
  });

  const pathById = new Map(value.pathBindings.map((binding) => [binding.id, binding]));
  const supportedEntrypoints = new Set(value.stackContract.entrypointKinds);
  value.entrypoints.forEach((entrypoint) => {
    if (!supportedEntrypoints.has(entrypoint.kind)) {
      diagnostics.push(diagnostic({
        code: "BUILD_TOPOLOGY_ENTRYPOINT_KIND_UNSUPPORTED",
        message: `Stack contract does not support ${entrypoint.kind} entrypoints`,
        reference: entrypoint.id,
      }));
    }
    const binding = pathById.get(entrypoint.pathRef);
    if (binding && binding.role !== "entrypoint") {
      diagnostics.push(diagnostic({
        code: "BUILD_TOPOLOGY_ENTRYPOINT_ROLE_MISMATCH",
        message: `Entrypoint ${entrypoint.id} requires an entrypoint-role path, not ${binding.role}`,
        reference: entrypoint.pathRef,
      }));
    }
  });

  if (!value.stackContract.packageManagers.includes(value.policies.packageManager)) {
    diagnostics.push(diagnostic({
      code: "BUILD_TOPOLOGY_PACKAGE_MANAGER_UNSUPPORTED",
      message: `Stack contract does not support package manager ${value.policies.packageManager}`,
      reference: value.policies.packageManager,
    }));
  }
  return diagnostics;
}

function validateCommandsAndCapabilities(value: ParsedInput): CompilationDiagnosticV1[] {
  const diagnostics: CompilationDiagnosticV1[] = [];
  const supportedCommands = new Set(value.stackContract.commandKinds);
  const observedCommands = new Set(value.commands.map((command) => command.kind));
  value.commands.forEach((command) => {
    if (!supportedCommands.has(command.kind)) {
      diagnostics.push(diagnostic({
        code: "BUILD_TOPOLOGY_COMMAND_KIND_UNSUPPORTED",
        message: `Stack contract does not support ${command.kind} commands`,
        reference: command.id,
      }));
    }
  });
  value.stackContract.requiredCommandKinds.forEach((kind) => {
    if (!observedCommands.has(kind)) {
      diagnostics.push(diagnostic({
        code: "BUILD_TOPOLOGY_REQUIRED_COMMAND_MISSING",
        message: `Stack contract requires a typed ${kind} command`,
        reference: kind,
      }));
    }
  });

  const catalog = new Map(value.stackContract.capabilities.map((item) => [item.id, item]));
  const actual = new Map(value.capabilities.map((item) => [item.id, item]));
  value.capabilities.forEach((capability) => {
    const contract = catalog.get(capability.id);
    if (!contract) {
      diagnostics.push(diagnostic({
        code: "BUILD_TOPOLOGY_CAPABILITY_UNSUPPORTED",
        message: `Capability ${capability.id} is absent from the stack contract`,
        reference: capability.id,
      }));
      return;
    }
    if (contract.kind !== capability.kind) {
      diagnostics.push(diagnostic({
        code: "BUILD_TOPOLOGY_CAPABILITY_KIND_MISMATCH",
        message: `Capability ${capability.id} kind ${capability.kind} does not equal stack kind ${contract.kind}`,
        reference: capability.id,
      }));
    }
    if (contract.providers.length > 0 && !capability.provider) {
      diagnostics.push(diagnostic({
        code: "BUILD_TOPOLOGY_CAPABILITY_PROVIDER_MISSING",
        message: `Capability ${capability.id} requires one exact stack-authorized provider`,
        reference: capability.id,
      }));
    } else if (capability.provider && !contract.providers.includes(capability.provider)) {
      diagnostics.push(diagnostic({
        code: "BUILD_TOPOLOGY_CAPABILITY_PROVIDER_UNSUPPORTED",
        message: `Provider ${capability.provider} is not authorized for ${capability.id}`,
        reference: capability.id,
      }));
    }
  });
  value.stackContract.capabilities.filter((item) => item.required).forEach((contract) => {
    const capability = actual.get(contract.id);
    if (!capability?.enabled) {
      diagnostics.push(diagnostic({
        code: "BUILD_TOPOLOGY_REQUIRED_CAPABILITY_UNAVAILABLE",
        message: `Required stack capability ${contract.id} is absent or disabled`,
        reference: contract.id,
      }));
    }
  });
  value.commands.forEach((command) => {
    command.capabilityRefs.forEach((capabilityRef) => {
      if (!actual.get(capabilityRef)?.enabled) {
        diagnostics.push(diagnostic({
          code: "BUILD_TOPOLOGY_COMMAND_CAPABILITY_UNAVAILABLE",
          message: `Command ${command.id} requires absent or disabled capability ${capabilityRef}`,
          reference: capabilityRef,
        }));
      }
    });
  });
  return diagnostics;
}

function deterministicTopology(
  value: ParsedInput,
  runtimeData: Extract<RuntimeDataContractProducerResult, { status: "produced" }> | undefined,
): BuildTopologyV1 {
  return {
    schema: "setfarm.build-topology.v1",
    stackPack: value.stackContract.identity,
    repo: value.repo,
    owners: [...value.owners].sort((left, right) => compareUtf16(left.id, right.id)),
    pathBindings: [...value.pathBindings]
      .sort((left, right) => compareUtf16(left.id, right.id)),
    sharedGrants: value.sharedGrants
      .map((grant) => ({
        ...grant,
        pathRefs: uniqueSorted(grant.pathRefs),
        permissions: [...grant.permissions].sort(compareUtf16),
      }))
      .sort((left, right) => compareUtf16(left.id, right.id)),
    entrypoints: value.entrypoints
      .map((entrypoint) => ({ ...entrypoint, routeRefs: uniqueSorted(entrypoint.routeRefs) }))
      .sort((left, right) => compareUtf16(left.id, right.id)),
    commands: value.commands
      .map((command) => ({
        ...command,
        capabilityRefs: uniqueSorted(command.capabilityRefs),
        ...(command.envRefs ? { envRefs: uniqueSorted(command.envRefs) } : {}),
      }))
      .sort((left, right) => compareUtf16(left.id, right.id)),
    capabilities: [...value.capabilities].sort((left, right) => compareUtf16(left.id, right.id)),
    policies: {
      ...value.policies,
      allowedRoots: uniqueSorted(value.policies.allowedRoots),
      deniedGlobs: uniqueSorted(value.policies.deniedGlobs),
      buildOutputPaths: uniqueSorted(value.policies.buildOutputPaths),
    },
    ...(runtimeData ? {
      runtimeDataContract: runtimeData.contract,
      runtimeDataContractHash: runtimeData.contractHash,
    } : {}),
  };
}

export function produceBuildTopologyV1(input: unknown): BuildTopologyProducerResult {
  const parsed = BuildTopologyProducerInputSchema.safeParse(input);
  if (!parsed.success) return reject(inputDiagnostics(parsed.error));

  let runtimeData: Extract<RuntimeDataContractProducerResult, { status: "produced" }> | undefined;
  if (parsed.data.productSpec?.delivery) {
    const result = produceRuntimeDataContractV1({
      productSpec: parsed.data.productSpec,
      commands: parsed.data.commands,
      ...(parsed.data.runtimeDataProvisioning
        ? { provisioning: parsed.data.runtimeDataProvisioning }
        : {}),
    });
    if (result.status === "rejected") return reject(result.diagnostics);
    runtimeData = result;
  } else if (parsed.data.runtimeDataProvisioning) {
    return reject([diagnostic({
      code: "BUILD_TOPOLOGY_RUNTIME_DATA_PROTOCOL_INVALID",
      category: "configuration",
      message: "Runtime-data provisioning requires a v3 ProductSpec delivery authority",
      reference: "runtimeDataProvisioning",
    })]);
  }

  const diagnostics = [
    ...validateOwnership(parsed.data),
    ...validateRolesAndPolicies(parsed.data),
    ...validateCommandsAndCapabilities(parsed.data),
  ];
  if (diagnostics.length > 0) return reject(diagnostics);

  const candidate = deterministicTopology(parsed.data, runtimeData);
  const result = BuildTopologyV1Schema.safeParse(candidate);
  if (!result.success) {
    return reject(result.error.issues.slice(0, 200).map((issue) => diagnostic({
      code: "BUILD_TOPOLOGY_CONTRACT_INVALID",
      message: `Produced topology failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      reference: issue.path.join("/") || "$",
    })));
  }
  return { status: "produced", buildTopology: result.data, diagnostics: [] };
}

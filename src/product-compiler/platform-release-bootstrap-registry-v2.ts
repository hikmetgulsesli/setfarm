import { z } from "zod";

import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
  PLATFORM_RELEASE_BOOTSTRAP_PARENT_V2,
} from "../execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PlatformReleaseBootstrapPackageRefV2Schema,
} from "../execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  deepFreezePlatformReleaseJsonV2,
} from "../execution/schemas/platform-release-common-v2.js";
import { hashCanonicalJson } from "./canonical-json.js";
import { Sha256Schema } from "./schemas/common-v1.js";

export const PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CLASSIFICATION_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-namespace-classification.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-namespace-census.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2 =
  16_384;

const REGISTRY_REF_V2 = "BOOTSTRAP_PACKAGE_REGISTRY_V2" as const;
const NAMESPACE_POLICY_V2 =
  "exact_registered_siblings_unknown_and_ambiguous_fail_v2" as const;
const SHA256_BASENAME_SUFFIX_V2 = "[a-f0-9]{64}";

const RegistryNamespaceCategoryV2Schema = z.enum([
  "activation_receipt",
  "epoch_claim",
  "epoch_floor_state",
  "shared_parent_lock",
]);

const PackageNamespaceCategoryV2Schema = z.enum([
  "active_claim",
  "active_receipt",
  "generation_staging",
  "package_lock",
  "package_root",
  "rollback_claim",
  "rollback_receipt",
]);

const NamespaceMatchKindV2Schema = z.enum([
  "exact_basename",
  "generation_staging_pattern",
  "rollback_receipt_pattern",
]);

const BasenameV2Schema = z.string().min(1).max(255)
  .refine((value) =>
    !value.includes("/")
    && !value.includes("\\")
    && !value.includes("\0")
    && value !== "."
    && value !== "..", {
    message: "Expected one exact bootstrap-parent basename",
  });

const classificationCommonFieldsV2 = {
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CLASSIFICATION_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  namespaceContractHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash,
  ),
  basename: BasenameV2Schema,
  matchKind: NamespaceMatchKindV2Schema,
  classificationHash: Sha256Schema,
} as const;

export const PlatformReleaseBootstrapNamespaceClassificationV2Schema =
  z.discriminatedUnion("ownerKind", [
    z.object({
      ...classificationCommonFieldsV2,
      ownerKind: z.literal("registry"),
      ownerRef: z.literal(REGISTRY_REF_V2),
      category: RegistryNamespaceCategoryV2Schema,
    }).strict(),
    z.object({
      ...classificationCommonFieldsV2,
      ownerKind: z.literal("package"),
      ownerRef: PlatformReleaseBootstrapPackageRefV2Schema,
      category: PackageNamespaceCategoryV2Schema,
    }).strict(),
  ]).superRefine((value, context) => {
    const matches = matchingNamespaceEntriesV2(value.basename);
    const expected = matches.length === 1 ? matches[0] : undefined;
    if (
      !expected
      || expected.ownerKind !== value.ownerKind
      || expected.ownerRef !== value.ownerRef
      || expected.category !== value.category
      || expected.matchKind !== value.matchKind
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Namespace classification must equal the exact code-owned registry match",
      });
    }
    if (
      value.classificationHash
        !== hashPlatformReleaseBootstrapNamespaceClassificationV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["classificationHash"],
        message: "Namespace classification hash mismatch",
      });
    }
  });

export type PlatformReleaseBootstrapNamespaceClassificationV2 =
  z.infer<
    typeof PlatformReleaseBootstrapNamespaceClassificationV2Schema
  >;

export type PlatformReleaseBootstrapNamespaceClassificationHashPayloadV2 =
  Omit<
    PlatformReleaseBootstrapNamespaceClassificationV2,
    "classificationHash"
  >;

export function hashPlatformReleaseBootstrapNamespaceClassificationV2(
  value:
    | PlatformReleaseBootstrapNamespaceClassificationHashPayloadV2
    | PlatformReleaseBootstrapNamespaceClassificationV2,
): string {
  const classification = { ...value } as Record<string, unknown>;
  delete classification.classificationHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-namespace-classification-hash.v2",
    classification,
  });
}

export const PlatformReleaseBootstrapNamespaceCensusV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  registryRef: z.literal(REGISTRY_REF_V2),
  parent: z.literal(PLATFORM_RELEASE_BOOTSTRAP_PARENT_V2),
  namespacePolicy: z.literal(NAMESPACE_POLICY_V2),
  namespaceContractHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash,
  ),
  entryCount: z.number().int().nonnegative()
    .max(PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2),
  orderedEntries: z.array(
    PlatformReleaseBootstrapNamespaceClassificationV2Schema,
  ).max(PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2),
  censusHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (value.entryCount !== value.orderedEntries.length) {
    context.addIssue({
      code: "custom",
      path: ["entryCount"],
      message: "Namespace census entry count mismatch",
    });
  }
  for (let index = 1; index < value.orderedEntries.length; index += 1) {
    const prior = value.orderedEntries[index - 1]!;
    const current = value.orderedEntries[index]!;
    if (compareUtf16V2(prior.basename, current.basename) >= 0) {
      context.addIssue({
        code: "custom",
        path: ["orderedEntries", index, "basename"],
        message:
          "Namespace census basenames must be unique and strictly ordered",
      });
    }
  }
  if (value.censusHash !== hashPlatformReleaseBootstrapNamespaceCensusV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["censusHash"],
      message: "Namespace census hash mismatch",
    });
  }
});

export type PlatformReleaseBootstrapNamespaceCensusV2 =
  z.infer<typeof PlatformReleaseBootstrapNamespaceCensusV2Schema>;

export type PlatformReleaseBootstrapNamespaceCensusHashPayloadV2 =
  Omit<PlatformReleaseBootstrapNamespaceCensusV2, "censusHash">;

export function hashPlatformReleaseBootstrapNamespaceCensusV2(
  value:
    | PlatformReleaseBootstrapNamespaceCensusHashPayloadV2
    | PlatformReleaseBootstrapNamespaceCensusV2,
): string {
  const census = { ...value } as Record<string, unknown>;
  delete census.censusHash;
  return hashCanonicalJson({
    schema: "setfarm.platform-release-bootstrap-namespace-census-hash.v2",
    census,
  });
}

export type PlatformReleaseBootstrapNamespaceClassificationErrorCodeV2 =
  | "PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_V2_AMBIGUOUS_BASENAME"
  | "PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_V2_CENSUS_TOO_LARGE"
  | "PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_V2_DUPLICATE_BASENAME"
  | "PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_V2_MALFORMED_BASENAME"
  | "PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_V2_REGISTRY_INVALID"
  | "PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_V2_UNKNOWN_BASENAME";

export class PlatformReleaseBootstrapNamespaceClassificationErrorV2
  extends TypeError {
  readonly code:
    PlatformReleaseBootstrapNamespaceClassificationErrorCodeV2;
  readonly basename?: string;

  constructor(
    code: PlatformReleaseBootstrapNamespaceClassificationErrorCodeV2,
    message: string,
    basename?: string,
  ) {
    super(message);
    this.name =
      "PlatformReleaseBootstrapNamespaceClassificationErrorV2";
    this.code = code;
    this.basename = basename;
  }
}

type PackageRefV2 = z.infer<
  typeof PlatformReleaseBootstrapPackageRefV2Schema
>;

type NamespaceEntryMatchV2 =
  | Readonly<{
      ownerKind: "registry";
      ownerRef: typeof REGISTRY_REF_V2;
      category: z.infer<typeof RegistryNamespaceCategoryV2Schema>;
      matchKind: "exact_basename";
    }>
  | Readonly<{
      ownerKind: "package";
      ownerRef: PackageRefV2;
      category: z.infer<typeof PackageNamespaceCategoryV2Schema>;
      matchKind:
        | "exact_basename"
        | "generation_staging_pattern"
        | "rollback_receipt_pattern";
    }>;

type NamespaceMatcherV2 = NamespaceEntryMatchV2 & Readonly<{
  matches: (basename: string) => boolean;
  sampleBasename: string;
}>;

function compareUtf16V2(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function escapeRegexV2(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function exactMatcherV2(
  basename: string,
  identity: NamespaceEntryMatchV2,
): NamespaceMatcherV2 {
  return Object.freeze({
    ...identity,
    matches: (candidate: string): boolean => candidate === basename,
    sampleBasename: basename,
  });
}

function patternMatcherV2(
  pattern: RegExp,
  sampleBasename: string,
  identity: NamespaceEntryMatchV2,
): NamespaceMatcherV2 {
  return Object.freeze({
    ...identity,
    matches: (candidate: string): boolean => pattern.test(candidate),
    sampleBasename,
  });
}

function rollbackSampleBasenameV2(patternSource: string): string {
  const sample = patternSource
    .slice(1, -1)
    .replaceAll("\\.", ".")
    .replace(SHA256_BASENAME_SUFFIX_V2, "0".repeat(64));
  if (
    patternSource[0] !== "^"
    || patternSource.at(-1) !== "$"
    || !new RegExp(patternSource).test(sample)
    || BasenameV2Schema.safeParse(sample).success === false
  ) {
    throw new PlatformReleaseBootstrapNamespaceClassificationErrorV2(
      "PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_V2_REGISTRY_INVALID",
      "Code-owned rollback receipt namespace cannot produce one exact sample",
    );
  }
  return sample;
}

function buildNamespaceMatchersV2(): readonly NamespaceMatcherV2[] {
  const contract = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2;
  const matchers: NamespaceMatcherV2[] = [
    exactMatcherV2(contract.registry.sharedLockBasename, {
      ownerKind: "registry",
      ownerRef: REGISTRY_REF_V2,
      category: "shared_parent_lock",
      matchKind: "exact_basename",
    }),
    exactMatcherV2(contract.registry.activationReceiptBasename, {
      ownerKind: "registry",
      ownerRef: REGISTRY_REF_V2,
      category: "activation_receipt",
      matchKind: "exact_basename",
    }),
    exactMatcherV2(contract.registry.epochFloorBasename, {
      ownerKind: "registry",
      ownerRef: REGISTRY_REF_V2,
      category: "epoch_floor_state",
      matchKind: "exact_basename",
    }),
    exactMatcherV2(contract.registry.epochClaimBasename, {
      ownerKind: "registry",
      ownerRef: REGISTRY_REF_V2,
      category: "epoch_claim",
      matchKind: "exact_basename",
    }),
  ];

  for (const packageContract of contract.packages) {
    const ownerRef = packageContract.packageRef;
    const packageEntries = [
      [packageContract.rootBasename, "package_root"],
      [
        packageContract.lifecycle.activeReceiptBasename,
        "active_receipt",
      ],
      [packageContract.lifecycle.activeClaimBasename, "active_claim"],
      [packageContract.lifecycle.packageLockBasename, "package_lock"],
      [packageContract.lifecycle.rollbackClaimBasename, "rollback_claim"],
    ] as const;
    for (const [basename, category] of packageEntries) {
      matchers.push(exactMatcherV2(basename, {
        ownerKind: "package",
        ownerRef,
        category,
        matchKind: "exact_basename",
      }));
    }

    const stagingPattern = new RegExp(
      `^${escapeRegexV2(packageContract.lifecycle.stagingPrefix)}\\.${SHA256_BASENAME_SUFFIX_V2}$`,
    );
    matchers.push(patternMatcherV2(
      stagingPattern,
      `${packageContract.lifecycle.stagingPrefix}.${"0".repeat(64)}`,
      {
        ownerKind: "package",
        ownerRef,
        category: "generation_staging",
        matchKind: "generation_staging_pattern",
      },
    ));

    const rollbackPattern = new RegExp(
      packageContract.lifecycle.rollbackReceiptBasenameRegex,
    );
    matchers.push(patternMatcherV2(
      rollbackPattern,
      rollbackSampleBasenameV2(
        packageContract.lifecycle.rollbackReceiptBasenameRegex,
      ),
      {
        ownerKind: "package",
        ownerRef,
        category: "rollback_receipt",
        matchKind: "rollback_receipt_pattern",
      },
    ));
  }
  return Object.freeze(matchers);
}

const NAMESPACE_MATCHERS_V2 = buildNamespaceMatchersV2();

function matchingNamespaceEntriesV2(
  basename: string,
): readonly NamespaceEntryMatchV2[] {
  return NAMESPACE_MATCHERS_V2
    .filter((matcher) => matcher.matches(basename))
    .map((matcher) => Object.freeze({
      ownerKind: matcher.ownerKind,
      ownerRef: matcher.ownerRef,
      category: matcher.category,
      matchKind: matcher.matchKind,
    }) as NamespaceEntryMatchV2);
}

function assertCodeOwnedNamespaceIsDisjointV2(): void {
  for (const matcher of NAMESPACE_MATCHERS_V2) {
    const matches = matchingNamespaceEntriesV2(matcher.sampleBasename);
    const expected = matches.length === 1 ? matches[0] : undefined;
    if (
      !expected
      || expected.ownerKind !== matcher.ownerKind
      || expected.ownerRef !== matcher.ownerRef
      || expected.category !== matcher.category
      || expected.matchKind !== matcher.matchKind
    ) {
      throw new PlatformReleaseBootstrapNamespaceClassificationErrorV2(
        "PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_V2_REGISTRY_INVALID",
        "Code-owned bootstrap namespace matchers overlap or are incomplete",
        matcher.sampleBasename,
      );
    }
  }
  for (const packageContract of PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages) {
    if (
      matchingNamespaceEntriesV2(
        packageContract.lifecycle.stagingPrefix,
      ).length !== 0
    ) {
      throw new PlatformReleaseBootstrapNamespaceClassificationErrorV2(
        "PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_V2_REGISTRY_INVALID",
        "Bare staging prefixes must not classify as physical state",
        packageContract.lifecycle.stagingPrefix,
      );
    }
  }
}

assertCodeOwnedNamespaceIsDisjointV2();

export function classifyPlatformReleaseBootstrapNamespaceBasenameV2(
  basename: string,
): PlatformReleaseBootstrapNamespaceClassificationV2 {
  const parsedBasename = BasenameV2Schema.safeParse(basename);
  if (!parsedBasename.success) {
    throw new PlatformReleaseBootstrapNamespaceClassificationErrorV2(
      "PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_V2_MALFORMED_BASENAME",
      "Bootstrap parent entry is not one exact basename",
      typeof basename === "string" ? basename : undefined,
    );
  }
  const matches = matchingNamespaceEntriesV2(parsedBasename.data);
  if (matches.length === 0) {
    throw new PlatformReleaseBootstrapNamespaceClassificationErrorV2(
      "PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_V2_UNKNOWN_BASENAME",
      "Bootstrap parent entry is outside the code-owned registry namespace",
      parsedBasename.data,
    );
  }
  if (matches.length !== 1) {
    throw new PlatformReleaseBootstrapNamespaceClassificationErrorV2(
      "PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_V2_AMBIGUOUS_BASENAME",
      "Bootstrap parent entry matches more than one registry owner",
      parsedBasename.data,
    );
  }
  const classificationWithoutHash = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CLASSIFICATION_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    namespaceContractHash:
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash,
    basename: parsedBasename.data,
    ...matches[0]!,
  } as const;
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapNamespaceClassificationV2Schema.parse({
      ...classificationWithoutHash,
      classificationHash:
        hashPlatformReleaseBootstrapNamespaceClassificationV2(
          classificationWithoutHash,
        ),
    }),
  );
}

export function classifyPlatformReleaseBootstrapNamespaceCensusV2(
  basenames: Iterable<string>,
): PlatformReleaseBootstrapNamespaceCensusV2 {
  const names: string[] = [];
  for (const basename of basenames) {
    if (
      names.length
        >= PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2
    ) {
      throw new PlatformReleaseBootstrapNamespaceClassificationErrorV2(
        "PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_V2_CENSUS_TOO_LARGE",
        "Bootstrap parent census exceeds the fixed entry limit",
      );
    }
    names.push(basename);
  }
  names.sort(compareUtf16V2);
  for (let index = 1; index < names.length; index += 1) {
    if (names[index - 1] === names[index]) {
      throw new PlatformReleaseBootstrapNamespaceClassificationErrorV2(
        "PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_V2_DUPLICATE_BASENAME",
        "Bootstrap parent census contains a duplicate basename",
        names[index],
      );
    }
  }
  const orderedEntries = names.map((basename) =>
    classifyPlatformReleaseBootstrapNamespaceBasenameV2(basename));
  const censusWithoutHash = {
    schema: PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    registryRef: REGISTRY_REF_V2,
    parent: PLATFORM_RELEASE_BOOTSTRAP_PARENT_V2,
    namespacePolicy: NAMESPACE_POLICY_V2,
    namespaceContractHash:
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash,
    entryCount: orderedEntries.length,
    orderedEntries,
  } as const;
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapNamespaceCensusV2Schema.parse({
      ...censusWithoutHash,
      censusHash:
        hashPlatformReleaseBootstrapNamespaceCensusV2(censusWithoutHash),
    }),
  );
}

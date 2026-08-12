import { isProxy } from "node:util/types";

import { z } from "zod";

import {
  PlatformReleaseBootstrapDarwinSystemAnchorObservationV2Schema,
} from "../execution/schemas/platform-release-bootstrap-darwin-system-anchor-observation-v2.js";
import { deepFreezePlatformReleaseJsonV2 } from "../execution/schemas/platform-release-common-v2.js";
import { Sha256Schema } from "./schemas/common-v1.js";

/**
 * Test-only relation adapter. It consumes one fully parsed S observation and
 * deliberately publishes only a hash relation; no system path or capability
 * crosses this boundary.
 */
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_HASH_ONLY_TEST_RELATION_V2 =
  "external_system_anchor_observation_hash_only_test_relation_v2" as const;

const RelationIdentityV2Schema = z.object({
  relation: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_HASH_ONLY_TEST_RELATION_V2,
  ),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  observationHash: Sha256Schema,
}).strict();

export const PlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2Schema =
  RelationIdentityV2Schema;

export type PlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2 =
  z.infer<typeof RelationIdentityV2Schema>;

export type PlatformReleaseBootstrapDarwinSystemAnchorRelationTestErrorCodeV2 =
  | "SYSTEM_ANCHOR_RELATION_INPUT_INVALID"
  | "SYSTEM_ANCHOR_RELATION_OBSERVATION_INVALID";

export class PlatformReleaseBootstrapDarwinSystemAnchorRelationTestErrorV2
  extends TypeError {
  constructor(
    readonly code:
      PlatformReleaseBootstrapDarwinSystemAnchorRelationTestErrorCodeV2,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseBootstrapDarwinSystemAnchorRelationTestErrorV2";
  }
}

function failV2(
  code: PlatformReleaseBootstrapDarwinSystemAnchorRelationTestErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBootstrapDarwinSystemAnchorRelationTestErrorV2(
    code,
    message,
    cause === undefined ? {} : { cause },
  );
}

function assertPlainObservationRecordV2(input: unknown): asserts input is Record<string, unknown> {
  if (
    typeof input !== "object"
    || input === null
    || Array.isArray(input)
    || isProxy(input)
    || Object.getPrototypeOf(input) !== Object.prototype
  ) {
    return failV2(
      "SYSTEM_ANCHOR_RELATION_INPUT_INVALID",
      "System-anchor relation requires one non-proxy plain observation record",
    );
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      return failV2(
        "SYSTEM_ANCHOR_RELATION_INPUT_INVALID",
        `System-anchor observation field ${key} must be one enumerable data field`,
      );
    }
  }
  const probeHash = descriptors.probeHash?.value;
  if (typeof probeHash !== "string" || !/^[a-f0-9]{64}$/u.test(probeHash)) {
    return failV2(
      "SYSTEM_ANCHOR_RELATION_OBSERVATION_INVALID",
      "System-anchor observation must include its serialized probe hash",
    );
  }
}

/**
 * Convert one complete S observation into the only relation form accepted by
 * the package snapshot. The observation parser remains the source of truth for
 * topology, pre/post equality, self-hashes, and false-authority markers.
 */
export function derivePlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2(
  input: unknown,
): PlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2 {
  assertPlainObservationRecordV2(input);
  try {
    const observation =
      PlatformReleaseBootstrapDarwinSystemAnchorObservationV2Schema.parse(input);
    if (
      observation.probeHash !== input.probeHash
      || observation.authorityState !== "observed_test_fixture_unverified"
      || observation.admissionScope !== "test_fixture"
      || observation.productionAuthority !== false
      || observation.productionAdmission !== "forbidden"
      || observation.credentialUse !== "none"
      || observation.mutationAuthority !== false
    ) {
      return failV2(
        "SYSTEM_ANCHOR_RELATION_OBSERVATION_INVALID",
        "System-anchor observation is not one exact false-authority test observation",
      );
    }
    return deepFreezePlatformReleaseJsonV2(
      RelationIdentityV2Schema.parse({
        relation:
          PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_HASH_ONLY_TEST_RELATION_V2,
        admissionScope: "test_fixture",
        productionAuthority: false,
        productionAdmission: "forbidden",
        observationHash: observation.observationHash,
      }),
    );
  } catch (error) {
    if (
      error
        instanceof PlatformReleaseBootstrapDarwinSystemAnchorRelationTestErrorV2
    ) {
      throw error;
    }
    return failV2(
      "SYSTEM_ANCHOR_RELATION_OBSERVATION_INVALID",
      "System-anchor observation failed its code-owned parser/schema",
      error,
    );
  }
}

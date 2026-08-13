import {
  fixedAncestorIdentitySatisfiesPolicyForInternalUseV2,
  observePlatformReleaseProductionAdmissionReadinessWithFiniteModeForInternalUseV2,
  type PlatformReleaseReadinessTestModeV2,
} from "../execution/private-platform-release-production-admission-readiness-v2.js";
import type {
  PlatformReleaseProductionAdmissionReadinessV2,
} from "../execution/schemas/platform-release-production-admission-readiness-v2.js";

export type { PlatformReleaseReadinessTestModeV2 };

export function fixedAncestorIdentitySatisfiesPolicyForTestV2(input: Readonly<{
  kind: "directory" | "symbolic_link" | "special";
  mode: bigint;
  ownerUid: bigint;
}>): boolean {
  return fixedAncestorIdentitySatisfiesPolicyForInternalUseV2(input);
}

export async function observePlatformReleaseProductionAdmissionReadinessForTestV2(
  mode: PlatformReleaseReadinessTestModeV2,
): Promise<PlatformReleaseProductionAdmissionReadinessV2> {
  return observePlatformReleaseProductionAdmissionReadinessWithFiniteModeForInternalUseV2(mode);
}

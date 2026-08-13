import {
  observePlatformReleaseProductionAdmissionReadinessWithFiniteModeForInternalUseV2,
} from "./private-platform-release-production-admission-readiness-v2.js";
import type {
  PlatformReleaseProductionAdmissionReadinessV2,
} from "./schemas/platform-release-production-admission-readiness-v2.js";

export async function observePlatformReleaseProductionAdmissionReadinessV2(): Promise<
  PlatformReleaseProductionAdmissionReadinessV2
> {
  return observePlatformReleaseProductionAdmissionReadinessWithFiniteModeForInternalUseV2(
    Object.freeze({ purpose: "production" }),
  );
}

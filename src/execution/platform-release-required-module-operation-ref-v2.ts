import {
  StableReferenceSchema,
} from "../product-compiler/schemas/common-v1.js";
import type {
  PlatformReleaseRequiredModuleRoleV2,
} from
  "./schemas/platform-release-required-module-closure-v2.js";

export function getPlatformReleaseRequiredModuleOperationRefV2(
  role: PlatformReleaseRequiredModuleRoleV2,
): string {
  return StableReferenceSchema.parse(
    `PLATFORM_RELEASE_REQUIRED_MODULE_${role.toUpperCase()}_V2`,
  );
}

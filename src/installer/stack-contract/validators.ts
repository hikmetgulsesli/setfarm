import { listStackPacks } from "./packs.js";
import { SCOPE_TARGET_ROLES, type ScopeTargetRole, type StackPack } from "./types.js";

export interface StackPackValidationIssue {
  packId: string;
  code: string;
  message: string;
}

const REQUIRED_SLUG_RULES = ["surface_slug", "screen_file", "action_file", "entity_file"] as const;

export function validateStackPack(pack: StackPack): StackPackValidationIssue[] {
  const issues: StackPackValidationIssue[] = [];
  const fail = (code: string, message: string) => issues.push({ packId: pack.id, code, message });

  if (!pack.targetResolutionRules || Object.keys(pack.targetResolutionRules).length === 0) {
    fail("TARGET_RESOLUTION_RULES_MISSING", "targetResolutionRules must be present and non-empty.");
  } else {
    for (const role of SCOPE_TARGET_ROLES) {
      const rule = pack.targetResolutionRules[role];
      if (!rule) {
        fail("TARGET_RESOLUTION_RULE_MISSING", `Missing targetResolutionRule for ${role}.`);
      } else {
        if (!rule.ruleId) fail("TARGET_RESOLUTION_RULE_ID_MISSING", `${role} rule must have ruleId.`);
        if (!rule.template) fail("TARGET_RESOLUTION_TEMPLATE_MISSING", `${role} rule must have template.`);
        if (!rule.allowedRoles?.includes(role)) fail("TARGET_RESOLUTION_ROLE_MISMATCH", `${role} rule must include itself in allowedRoles.`);
      }
    }
  }

  for (const key of REQUIRED_SLUG_RULES) {
    if (!pack.slugRules?.[key]) fail("SLUG_RULE_MISSING", `slugRules.${key} is required.`);
  }
  const minSlugTests = ["python-cli", "python-web", "android-app", "ios-app"].includes(pack.id) ? 3 : 2;
  if (!pack.slugRuleTests || pack.slugRuleTests.length < minSlugTests) {
    fail("SLUG_RULE_TESTS_MISSING", `At least ${minSlugTests} slugRuleTests are required for this stack pack.`);
  }

  if (pack.conversionPolicy === "native_equivalent" && !pack.nativeEquivalentContract) {
    fail("NATIVE_EQUIVALENT_CONTRACT_MISSING", "native_equivalent requires nativeEquivalentContract.");
  }

  if (!pack.dependencyResolutionPolicy) fail("DEPENDENCY_RESOLUTION_POLICY_MISSING", "dependencyResolutionPolicy is required.");
  if (!pack.sharedEditValidationPolicy) fail("SHARED_EDIT_VALIDATION_POLICY_MISSING", "sharedEditValidationPolicy is required.");
  if (pack.sharedEditValidationPolicy === "patch_window" && (!pack.patchWindowMarkers || pack.patchWindowMarkers.length === 0)) {
    fail("PATCH_WINDOW_MARKER_MISSING", "patch_window stacks must define patchWindowMarkers.");
  }
  if (!pack.utilityFilePolicy?.allowedRoots?.length) fail("UTILITY_FILE_POLICY_MISSING", "utilityFilePolicy.allowedRoots is required.");
  if (!pack.buildStrippingPolicy) fail("BUILD_STRIPPING_POLICY_MISSING", "buildStrippingPolicy is required.");
  if (!pack.sandboxPrewarm) {
    fail("SANDBOX_PREWARM_POLICY_MISSING", "sandboxPrewarm policy is required.");
  } else if (pack.sandboxPrewarm.successCheck !== "not_required" && pack.sandboxPrewarm.timeoutMs <= 0) {
    fail("SANDBOX_PREWARM_TIMEOUT_INVALID", "sandboxPrewarm timeoutMs must be positive.");
  }

  validateSharedFilesHavePatchMarkers(pack, fail);
  return issues;
}

export function validateAllStackPacks(): StackPackValidationIssue[] {
  return listStackPacks().flatMap(validateStackPack);
}

function validateSharedFilesHavePatchMarkers(
  pack: StackPack,
  fail: (code: string, message: string) => void,
): void {
  if (pack.sharedEditValidationPolicy !== "patch_window") return;
  const markerFiles = new Set((pack.patchWindowMarkers || []).map((marker) => marker.file));
  for (const role of ["route_registration", "style_integration", "test_bridge"] as ScopeTargetRole[]) {
    const template = pack.targetResolutionRules?.[role]?.template;
    if (template && (pack.implementationBoundaries?.sharedFiles || []).includes(template) && !markerFiles.has(template)) {
      fail("PATCH_WINDOW_MARKER_MISSING", `Shared template ${template} needs a patch window marker.`);
    }
  }
}

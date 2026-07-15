import type { ClaimContext } from "../types.js";
import { canonicalJsonStringify } from "../../../product-compiler/canonical-json.js";
import { extractTaskRequirementLedgerV1 } from "../../../product-compiler/requirements/task-requirements-v1.js";
import {
  canonicalProductDeliveryProfileCatalogV1,
  productDeliveryProfileCatalogHashV1,
} from "../../../product-compiler/product-delivery-profile-catalog.js";

const FIRST_ATTEMPT_REMINDER =
  "REMINDER: PLAN is a product contract only. Output CONTRACT_SCHEMA_VERSION, STATUS, PROJECT_NAME, PROJECT_SLUG, PLATFORM, TECH_STACK, UI_LANGUAGE, DB_REQUIRED, DESIGN_REQUIRED, UI_VISION_SUMMARY, and PRD. " +
  "Do not emit REPO, BRANCH, GITHUB_REPO, RUN_SLUG, PACKAGE_NAME, APP_TITLE, PRD_SCREEN_COUNT, or a physical Screens table. " +
  "PRD must use Product Surfaces and Action Contracts; runtime identity, env values, paths, package names, and executable ownership decisions are resolved by MC/Setfarm after PLAN.";

export async function injectContext(ctx: ClaimContext): Promise<void> {
  ctx.context["task"] = ctx.task;
  const protocol = ctx.claimEnvelope?.protocol ?? "legacy";
  ctx.context["plan_protocol"] = protocol;
  if (protocol === "v3") {
    const ledger = extractTaskRequirementLedgerV1(ctx.task);
    ctx.context["v3_requirement_ledger"] = canonicalJsonStringify(ledger);
    ctx.context["v3_delivery_profile_catalog"] = canonicalProductDeliveryProfileCatalogV1();
    ctx.context["v3_delivery_profile_catalog_hash"] = productDeliveryProfileCatalogHashV1();
    ctx.context["v3_requested_stack_pack_id"] = ctx.context["requested_stack_prefix"]
      ? (ctx.context["stack_pack_id"] || "")
      : "";
    if (ctx.retryCount === 0 && !ctx.context["previous_failure"]) {
      ctx.context["previous_failure"] =
        "V3 PLAN requires exactly one typed ProductSpec proposal. Copy every source-owned requirement exactly, classify and bind it without inventing semantics, and bind delivery byte-for-byte to the Setfarm-owned delivery profile for the proposed product class. Emit a typed rejection when the task or activated delivery is ambiguous or unsupported.";
    }
    return;
  }
  if (ctx.retryCount === 0 && !ctx.context["previous_failure"]) {
    ctx.context["previous_failure"] = FIRST_ATTEMPT_REMINDER;
  }
}

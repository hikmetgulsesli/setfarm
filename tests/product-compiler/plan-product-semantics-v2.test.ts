import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  projectCanonicalV3PlanParsedOutputV2,
  resolveV3PlanOutputAuthorityV2,
} from "../../src/execution/v3-plan-output-authority-v2.js";
import { validateOutput } from "../../src/installer/steps/01-plan/guards.js";
import { buildPrompt } from "../../src/installer/steps/01-plan/module.js";
import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import { extractTaskRequirementLedgerV1 } from "../../src/product-compiler/requirements/task-requirements-v1.js";
import {
  CONTAINED_GAME_TASK,
  containedGamePlanProposalV2,
} from "./fixtures/product-semantics-v2.js";

describe("PLAN product semantics v2 integration", () => {
  it("prompts for placement/effect separation and the exact v2 schema", () => {
    const ledger = extractTaskRequirementLedgerV1(CONTAINED_GAME_TASK);
    const prompt = buildPrompt({
      runId: "run-plan-v2",
      task: CONTAINED_GAME_TASK,
      context: {
        plan_protocol: "v3",
        product_semantics_version: "v2",
        task: CONTAINED_GAME_TASK,
        v3_requirement_ledger: canonicalJsonStringify(ledger),
      },
    });
    assert.match(prompt, /plan-semantic-proposal-v2/);
    assert.match(prompt, /controlPlacements/);
    assert.match(prompt, /affectedSurfaceKeys are behavior\/effect context and never imply a rendered control/);
    assert.match(prompt, /exactly one route_root surface/);
    assert.doesNotMatch(prompt, /Emit exactly one plan-semantic-proposal-v1 JSON fence/);
  });

  it("accepts only the compiler-owned canonical ProductSpec v2 projection", () => {
    const parsed = {
      status: "done",
      prd: `\`\`\`plan-semantic-proposal-v2\n${JSON.stringify(containedGamePlanProposalV2(), null, 2)}\n\`\`\``,
    };
    const authority = resolveV3PlanOutputAuthorityV2({
      task: CONTAINED_GAME_TASK,
      parsed,
    });
    assert.equal(authority.status, "proposal");
    if (authority.status !== "proposal") return;
    const projected = projectCanonicalV3PlanParsedOutputV2({ parsed, authority });
    assert.deepEqual(validateOutput(projected), { ok: true, errors: [] });

    const forged = {
      ...projected,
      prd: `\`\`\`product-spec-v2\n${JSON.stringify(authority.productSpec, null, 2)}\n\`\`\``,
    };
    const result = validateOutput(forged);
    assert.equal(result.ok, false);
    assert.equal(result.errors.some((error) => error.includes("not canonicalized")), true);
  });

  it("rejects mixed v1/v2 compiler projections", () => {
    const authority = resolveV3PlanOutputAuthorityV2({
      task: CONTAINED_GAME_TASK,
      parsed: {
        prd: `\`\`\`plan-semantic-proposal-v2\n${JSON.stringify(containedGamePlanProposalV2())}\n\`\`\``,
      },
    });
    assert.equal(authority.status, "proposal");
    if (authority.status !== "proposal") return;
    const v2 = `\`\`\`product-spec-v2\n${authority.canonicalBytes}\n\`\`\``;
    const v1 = "```product-spec-v1\n{}\n```";
    const result = validateOutput({ status: "done", prd: `${v2}\n${v1}` });
    assert.equal(result.ok, false);
    assert.match(result.errors[0]!, /exactly one typed ProductSpec/);
  });
});

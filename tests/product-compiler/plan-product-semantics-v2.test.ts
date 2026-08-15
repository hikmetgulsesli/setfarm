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
  containedGamePlanProductBuildProposalV1,
} from "./fixtures/product-semantics-v2.js";

describe("PLAN product semantics v2 integration", () => {
  it("prompts for placement/effect separation and exact invocation authority", () => {
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
    assert.match(prompt, /plan-product-build-proposal-v1/);
    assert.match(prompt, /runtimeBehavior/);
    assert.match(prompt, /every semantics\.states\[\]\.invariants occurrence exactly once/i);
    assert.match(prompt, /entity_field state-delta occurrence exactly once/i);
    assert.match(prompt, /Prose invariants remain provenance, not executable instructions/);
    assert.match(prompt, /controlPlacements/);
    assert.match(prompt, /affectedSurfaceKeys are behavior\/effect scope and never imply a rendered control/);
    assert.match(prompt, /exactly one route_root surface/);
    assert.match(prompt, /Every action declares exactly one invocationInterface/);
    assert.match(prompt, /every-and-only input fieldBindings/);
    assert.match(prompt, /Every V1 CLI\/HTTP input is required=true/);
    assert.match(prompt, /rendered date\/datetime inputs are unsupported/);
    assert.match(prompt, /Timer\/system invocation is unsupported/);
    assert.match(prompt, /subcommand token sequences are prefix-free/);
    assert.match(prompt, /argv_position values are distinct and contiguous from zero/);
    assert.match(prompt, /containerPolicy=object_intermediates/);
    assert.match(prompt, /JSON pointers may not duplicate or overlap/);
    assert.match(prompt, /Each HTTP path :parameter has exactly one same-name path_parameter binding/);
    assert.match(prompt, /endpoint templates may not overlap/);
    assert.match(prompt, /100000 pair-comparison budget/);
    assert.match(prompt, /failureCases contain every-and-only input_validation/);
    assert.match(prompt, /distinct stable errorCode/);
    assert.match(prompt, /Setfarm canonicalizes their non-semantic ordering/);
    assert.match(prompt, /coordinate=result_value/);
    assert.match(prompt, /An all-CLI\/HTTP product may be stateless/);
    assert.match(prompt, /environment variables and HTTP headers are unsupported/);
    assert.doesNotMatch(prompt, /Every user action declares exact controlPlacements/);
    assert.doesNotMatch(prompt, /Declare an input only when an input or inputs valueFrom consumes it/);
    assert.doesNotMatch(prompt, /Emit exactly one plan-semantic-proposal-v1 JSON fence/);
    assert.doesNotMatch(prompt, /Emit exactly one plan-semantic-proposal-v2 JSON fence/);
    assert.ok(
      Buffer.byteLength(prompt, "utf8") < 192_000,
      `atomic PLAN prompt exceeds budget: ${Buffer.byteLength(prompt, "utf8")}`,
    );
  });

  it("prompts for occurrence-complete atomic proposal rules", () => {
    const ledger = extractTaskRequirementLedgerV1(CONTAINED_GAME_TASK);
    const prompt = buildPrompt({
      runId: "run-plan-v2-occurrence-rules",
      task: CONTAINED_GAME_TASK,
      context: {
        plan_protocol: "v3",
        product_semantics_version: "v2",
        task: CONTAINED_GAME_TASK,
        v3_requirement_ledger: canonicalJsonStringify(ledger),
      },
    });

    assert.match(prompt, /enumValues is valid only when valueType is exactly enum/i);
    assert.match(prompt, /Every individual observable needs an after assertion/i);
    assert.match(
      prompt,
      /entityFieldBindings contains every-and-only state delta occurrences whose valueFrom\.kind is entity_field/i,
    );
    assert.match(prompt, /literal and input state deltas do not appear in entityFieldBindings/i);
  });

  it("accepts the atomic envelope and validates its compiler-owned projection", () => {
    const parsed = {
      status: "done",
      prd: `\`\`\`plan-product-build-proposal-v1\n${JSON.stringify(containedGamePlanProductBuildProposalV1(), null, 2)}\n\`\`\``,
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
        prd: `\`\`\`plan-product-build-proposal-v1\n${JSON.stringify(containedGamePlanProductBuildProposalV1())}\n\`\`\``,
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

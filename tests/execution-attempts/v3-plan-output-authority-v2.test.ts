import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  projectCanonicalV3PlanParsedOutputV2,
  resolveV3PlanOutputAuthorityV2,
  shouldRunLegacyProductSupervisorV2,
  V3PlanOutputV2RejectedError,
} from "../../src/execution/v3-plan-output-authority-v2.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { canonicalizeProductSpecRejectionV1 } from "../../src/product-compiler/producers/plan-product-spec-proposal.js";
import { extractTaskRequirementLedgerV1 } from "../../src/product-compiler/requirements/task-requirements-v1.js";
import {
  CONTAINED_GAME_TASK,
  containedGamePlanProductBuildProposalV1,
  containedGamePlanProposalV2,
} from "../product-compiler/fixtures/product-semantics-v2.js";

function block(kind: string, value: unknown): string {
  return `\`\`\`${kind}\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

function typedRejection(overrides: Record<string, unknown> = {}): any {
  const ledger = extractTaskRequirementLedgerV1(CONTAINED_GAME_TASK);
  return {
    schema: "setfarm.product-spec-rejection.v1",
    sourceTaskHash: ledger.sourceHash,
    reasons: [{
      code: "PRODUCT_SPEC_REQUIRED_INFORMATION_MISSING",
      requirementRefs: ledger.requirements.map((requirement) => requirement.id),
      message: "The requested external runtime owner is unspecified.",
    }],
    ...overrides,
  };
}

describe("PLAN v3 product semantics v2 output authority", () => {
  for (const code of [
    "PRODUCT_SPEC_TASK_AMBIGUOUS",
    "PRODUCT_SPEC_SEMANTIC_UNSUPPORTED",
  ] as const) {
    it(`accepts exact bare V2 refusal ${code} without PRD`, () => {
      const ledger = extractTaskRequirementLedgerV1(CONTAINED_GAME_TASK);
      const rejection = typedRejection({
        reasons: [{
          code,
          requirementRefs: ledger.requirements.map(item => item.id),
          message: "The exact requested runtime authority cannot be determined.",
        }],
      });
      const fence = block("product-spec-rejection-v1", rejection);
      const input = {
        task: CONTAINED_GAME_TASK,
        parsed: { status: `done\n${fence}` },
        rawOutput: `STATUS: done\n${fence}`,
      };
      const before = structuredClone(input);
      const actual = resolveV3PlanOutputAuthorityV2(input);
      assert.equal(actual.status, "rejection");
      if (actual.status !== "rejection") throw new Error("expected typed rejection");
      const canonical = canonicalizeProductSpecRejectionV1({
        task: input.task, rejection,
      });
      assert.deepEqual(actual.rejection, canonical);
      assert.equal(hashCanonicalJson(actual.rejection), hashCanonicalJson(canonical));
      assert.deepEqual(input, before);
    });
  }

  it("keeps bare and legacy PRD refusals byte-equivalent across whitespace transports without mutation", () => {
    const ledger = extractTaskRequirementLedgerV1(CONTAINED_GAME_TASK);
    const rejection = typedRejection({
      reasons: ["PRODUCT_SPEC_SEMANTIC_UNSUPPORTED", "PRODUCT_SPEC_TASK_AMBIGUOUS"].map((code) => ({
        code,
        requirementRefs: ledger.requirements.map((item) => item.id).reverse(),
        message: "The requested runtime authority is unspecified.",
      })),
    });
    const fence = block("product-spec-rejection-v1", rejection);
    const legacy = resolveV3PlanOutputAuthorityV2({
      task: CONTAINED_GAME_TASK, parsed: { status: "done", prd: fence },
    });
    assert.equal(legacy.status, "rejection");
    if (legacy.status !== "rejection") throw new Error("expected legacy rejection");
    for (const rawOutput of [
      `STATUS: done\n${fence}`,
      `STATUS: done\r\n${fence.replace(/\n/g, "\r\n")}`,
      ` \t\nSTATUS: done\n \t\n${fence}\n\t `,
      `\u2003STATUS: done\r\n\u00a0\r\n${fence.replace(/\n/g, "\r\n")}\u2003`,
    ]) {
      const input = {
        task: CONTAINED_GAME_TASK,
        parsed: { status: `done\n${fence}`, prd: "" },
        rawOutput,
      };
      const before = structuredClone(input);
      const actual = resolveV3PlanOutputAuthorityV2(input);
      assert.equal(actual.status, "rejection");
      if (actual.status !== "rejection") throw new Error("expected bare rejection");
      assert.deepEqual(actual.rejection, legacy.rejection);
      assert.equal(canonicalJsonStringify(actual.rejection), canonicalJsonStringify(legacy.rejection));
      assert.equal(hashCanonicalJson(actual.rejection), hashCanonicalJson(legacy.rejection));
      assert.deepEqual(input, before);
    }
  });

  it("uses strict JSON, rejection schema, task hash and known ledger references for bare refusal", () => {
    const ledger = extractTaskRequirementLedgerV1(CONTAINED_GAME_TASK);
    assert.equal(ledger.requirements.some((item) => item.id === "REQ_0000000000000000"), false);
    const cases = [
      {
        name: "invalid JSON",
        fence: "```product-spec-rejection-v1\n{\n```",
        error: /V3_PLAN_V2_REJECTION_JSON_INVALID/u,
      },
      {
        name: "wrong source hash",
        fence: block("product-spec-rejection-v1", typedRejection({ sourceTaskHash: "0".repeat(64) })),
        error: /PRODUCT_SPEC_REJECTION_TASK_HASH_MISMATCH/u,
      },
      {
        name: "unknown requirement reference",
        fence: block("product-spec-rejection-v1", typedRejection({
          reasons: [{
            code: "PRODUCT_SPEC_TASK_AMBIGUOUS",
            requirementRefs: ["REQ_0000000000000000"],
            message: "The requested authority is unspecified.",
          }],
        })),
        error: /PRODUCT_SPEC_REJECTION_REQUIREMENT_UNKNOWN:REQ_0000000000000000/u,
      },
    ];
    for (const item of cases) {
      const input = {
        task: CONTAINED_GAME_TASK, parsed: { status: `done\n${item.fence}` },
        rawOutput: `STATUS: done\n${item.fence}`,
      };
      const before = structuredClone(input);
      assert.throws(() => resolveV3PlanOutputAuthorityV2(input), item.error, item.name);
      assert.deepEqual(input, before);
    }
    for (const rejection of [
      typedRejection({ extra: true }),
      typedRejection({ reasons: [] }),
      typedRejection({ reasons: [{
        code: "PRODUCT_SPEC_TASK_AMBIGUOUS",
        requirementRefs: ledger.requirements.map((item) => item.id),
        message: "x".repeat(4_001),
      }] }),
    ]) {
      const fence = block("product-spec-rejection-v1", rejection);
      assert.throws(() => resolveV3PlanOutputAuthorityV2({
        task: CONTAINED_GAME_TASK, parsed: { status: `done\n${fence}` },
        rawOutput: `STATUS: done\n${fence}`,
      }), (error: unknown) => error instanceof Error && error.name === "ZodError");
    }
  });

  it("rejects every selected bare refusal with trailing material or a competing fence before PRD fallback", () => {
    const fence = block("product-spec-rejection-v1", typedRejection());
    const build = containedGamePlanProductBuildProposalV1();
    const buildFence = block("plan-product-build-proposal-v1", build);
    for (const suffix of [
      "\nPlanner suffix",
      "\nCHANGES: claimed completion",
      `\nPRD:\n${buildFence}`,
      `\n${fence}`,
      `\n${buildFence}`,
      `\n${block("plan-semantic-proposal-v2", containedGamePlanProposalV2())}`,
      `\n${block("plan-runtime-behavior-proposal-v1", build.runtimeBehavior)}`,
      `\n${block("product-spec-v2", {})}`,
      `\n${block("product-runtime-behavior-contract-v1", {})}`,
      `\n${block("plan-product-build-authority-v1", {})}`,
      `\n${block("plan-semantic-proposal-v1", {})}`,
      `\n${block("product-spec-v1", {})}`,
    ]) {
      const input = {
        task: CONTAINED_GAME_TASK,
        parsed: { status: `done\n${fence}`, prd: buildFence },
        rawOutput: `STATUS: done\n${fence}${suffix}`,
      };
      const before = structuredClone(input);
      assert.throws(() => resolveV3PlanOutputAuthorityV2(input),
        /V3_PLAN_V2_BARE_REJECTION_TRANSPORT_INVALID/u);
      assert.deepEqual(input, before);
    }
  });

  it("rejects parsed siblings even when raw refusal alone is exact", () => {
    const fence = block("product-spec-rejection-v1", typedRejection());
    const parsedCases: Record<string, string | undefined>[] = [
      { status: `done\n${fence}`, prd: fence },
      { status: `done\n${fence}`, changes: "another claim" },
      { status: `done\n${fence}`, changes: undefined },
    ];
    for (const parsed of parsedCases) {
      const input = { task: CONTAINED_GAME_TASK, parsed, rawOutput: `STATUS: done\n${fence}` };
      const before = structuredClone(input);
      assert.throws(() => resolveV3PlanOutputAuthorityV2(input),
        /V3_PLAN_V2_BARE_REJECTION_PARSED_SIBLING_FORBIDDEN/u);
      assert.deepEqual(input, before);
    }
  });

  it("does not invent PRD for malformed or unsupported raw transports", () => {
    const rejection = typedRejection();
    const fence = block("product-spec-rejection-v1", rejection);
    for (const rawOutput of [
      undefined,
      fence,
      `STATUS: failed\n${fence}`,
      `status: done\n${fence}`,
      `STATUS: Done\n${fence}`,
      `STATUS: done\n${fence.replace("product-spec-rejection-v1", "Product-spec-rejection-v1")}`,
      `Planner preface\nSTATUS: done\n${fence}`,
      `STATUS: done\nCHANGES: competing key\n${fence}`,
      "STATUS: done\n```product-spec-rejection-v1",
      `STATUS: done\n${block("plan-product-build-proposal-v1", containedGamePlanProductBuildProposalV1())}`,
      `STATUS: done\n${block("plan-semantic-proposal-v2", containedGamePlanProposalV2())}`,
      JSON.stringify({ STATUS: "done", rejection }),
    ]) {
      const input = { task: CONTAINED_GAME_TASK, parsed: { status: "done" }, rawOutput };
      const before = structuredClone(input);
      assert.throws(() => resolveV3PlanOutputAuthorityV2(input),
        /V3_PLAN_V2_TYPED_ARTIFACT_REQUIRED:0:0/u);
      assert.deepEqual(input, before);
    }
    assert.throws(() => resolveV3PlanOutputAuthorityV2({
      task: CONTAINED_GAME_TASK, parsed: { status: "done" },
      rawOutput: "STATUS: done\n```product-spec-rejection-v1\n{}",
    }), /V3_PLAN_V2_BARE_REJECTION_TRANSPORT_INVALID/u);
  });

  it("bounds selected and absent-PRD raw UTF-8 before body parsing, including long whitespace mixed with valid PRD", () => {
    const cap = 4 * 1024 * 1024;
    const fence = block("product-spec-rejection-v1", typedRejection());
    const bare = `STATUS: done\n${fence}`;
    const buildFence = block("plan-product-build-proposal-v1", containedGamePlanProductBuildProposalV1());
    const multibyte = `STATUS: done\n\`\`\`product-spec-rejection-v1\n${"\u00e9".repeat((cap / 2) + 1)}\n\`\`\``;
    assert.ok(multibyte.length < cap);
    assert.ok(Buffer.byteLength(multibyte, "utf8") > cap);
    const cases = [
      { rawOutput: `STATUS: done\n\`\`\`product-spec-rejection-v1\n${"x".repeat(cap)}\n\`\`\``, parsed: { status: "done" } },
      { rawOutput: multibyte, parsed: { status: "done" } },
      { rawOutput: `${bare}\n${"x".repeat(cap)}\nPRD:\n${buildFence}`, parsed: { status: "done", prd: buildFence } },
      { rawOutput: `${" ".repeat(cap + 1)}${bare}\nPRD:\n${buildFence}`, parsed: { status: "done", prd: buildFence } },
      { rawOutput: `STATUS: done\n${" ".repeat(cap + 1)}${fence}\nPRD:\n${buildFence}`, parsed: { status: "done", prd: buildFence } },
      { rawOutput: "x".repeat(cap + 1), parsed: { status: "done" } },
    ];
    for (const input of cases) {
      assert.throws(() => resolveV3PlanOutputAuthorityV2({ task: CONTAINED_GAME_TASK, ...input }),
        /V3_PLAN_V2_RAW_OUTPUT_TOO_LARGE/u);
    }
  });

  it("preserves an atomic positive PRD at exactly 4 MiB plus raw envelope overhead", () => {
    const cap = 4 * 1024 * 1024;
    const fence = block("plan-product-build-proposal-v1", containedGamePlanProductBuildProposalV1());
    const prd = `${" ".repeat(cap - Buffer.byteLength(fence, "utf8"))}${fence}`;
    const input = {
      task: CONTAINED_GAME_TASK, parsed: { status: "done", prd },
      rawOutput: `STATUS: done\nPRD:\n${prd}`,
    };
    assert.equal(Buffer.byteLength(prd, "utf8"), cap);
    assert.ok(Buffer.byteLength(input.rawOutput, "utf8") > cap);
    const before = structuredClone(input);
    const actual = resolveV3PlanOutputAuthorityV2(input);
    assert.equal(actual.status, "proposal");
    if (actual.status !== "proposal") throw new Error("expected atomic proposal");
    assert.equal(actual.sourceTransport, "product_build_proposal_v1");
    assert.equal(actual.canonicalBytes, canonicalJsonStringify(actual.productSpec));
    assert.deepEqual(input, before);
  });

  it("keeps semantic-only authorization explicit when exact raw output is supplied", () => {
    const prd = block("plan-semantic-proposal-v2", containedGamePlanProposalV2());
    const input = {
      task: CONTAINED_GAME_TASK, parsed: { status: "done", prd },
      rawOutput: `STATUS: done\nPRD:\n${prd}`,
    };
    assert.throws(() => resolveV3PlanOutputAuthorityV2(input),
      /V3_PLAN_V2_SEMANTIC_ONLY_COMPATIBILITY_NOT_AUTHORIZED/u);
    const actual = resolveV3PlanOutputAuthorityV2({ ...input, allowSemanticOnlyCompatibility: true });
    assert.equal(actual.status, "proposal");
    if (actual.status !== "proposal") throw new Error("expected compatibility proposal");
    assert.equal(actual.sourceTransport, "semantic_proposal_v2");
    assert.equal("runtimeBehaviorContract" in actual, false);
  });

  it("compiles one atomic build proposal and projects all compiler-owned authority bytes", () => {
    const proposal = containedGamePlanProductBuildProposalV1();
    const parsed = {
      status: "done",
      prd: `Planner preface\n${block("plan-product-build-proposal-v1", proposal)}\nPlanner suffix`,
    };
    const original = structuredClone(parsed);

    const authority = resolveV3PlanOutputAuthorityV2({
      task: CONTAINED_GAME_TASK,
      parsed,
    });
    assert.equal(authority.status, "proposal");
    if (authority.status !== "proposal") return;
    assert.equal(authority.sourceTransport, "product_build_proposal_v1");
    assert.equal(authority.sourceProposalHash.length, 64);
    if (authority.sourceTransport !== "product_build_proposal_v1") return;
    assert.equal(authority.sourceSemanticProposalHash.length, 64);
    assert.equal(
      authority.runtimeBehaviorProposalCanonicalBytes,
      canonicalJsonStringify(authority.runtimeBehaviorProposal),
    );
    assert.equal(
      authority.runtimeBehaviorProposalHash,
      authority.runtimeBehaviorContract.authority.proposalHash,
    );
    assert.equal(authority.runtimeBehaviorContract.schema,
      "setfarm.product-runtime-behavior-contract.v1");
    assert.equal(authority.planProductBuildAuthority.schema,
      "setfarm.plan-product-build-authority.v1");
    assert.equal(
      authority.planProductBuildAuthority.outputs.runtimeBehaviorContractHash,
      authority.runtimeBehaviorContract.contractHash,
    );
    assert.equal(authority.productSpec.schema, "setfarm.product-spec.v2");
    assert.equal(authority.productSpec.routes[0]?.rootSurfaceRef, "SURF_PLAY_PAGE");
    assert.deepEqual(authority.productSpec.actions[0]?.controlPlacements, [{
      id: "CSLOT_START_GAME_PRIMARY_START",
      surfaceRef: "SURF_PLAY_PAGE",
      controlHint: "primary_button",
    }]);
    assert.deepEqual(
      authority.productSpec.actions[0]?.affectedSurfaceRefs,
      ["SURF_GAME_CANVAS", "SURF_STATUS_PANEL"],
    );
    assert.equal(authority.canonicalBytes, canonicalJsonStringify(authority.productSpec));

    const projected = projectCanonicalV3PlanParsedOutputV2({ parsed, authority });
    assert.doesNotMatch(projected.prd, /plan-product-build-proposal-v1/);
    assert.match(projected.prd, /```product-spec-v2/);
    assert.match(projected.prd, /```product-runtime-behavior-contract-v1/);
    assert.match(projected.prd, /```plan-product-build-authority-v1/);
    assert.match(projected.prd, new RegExp(
      authority.canonicalBytes.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    ));
    assert.match(projected.prd, new RegExp(
      authority.runtimeBehaviorCanonicalBytes.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    ));
    assert.match(projected.prd, new RegExp(
      authority.planProductBuildAuthorityCanonicalBytes.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    ));
    assert.deepEqual(parsed, original);
    assert.throws(
      () => projectCanonicalV3PlanParsedOutputV2({
        parsed: {
          ...parsed,
          prd: `${parsed.prd}\n${block("product-spec-v2", authority.productSpec)}`,
        },
        authority,
      }),
      /V3_PLAN_V2_CANONICAL_PROJECTION_SOURCE_MISMATCH/u,
    );
  });

  it("reads semantic-only v2 as explicit compatibility without fabricating behavior", () => {
    const parsed = {
      status: "done",
      prd: block("plan-semantic-proposal-v2", containedGamePlanProposalV2()),
    };
    assert.throws(
      () => resolveV3PlanOutputAuthorityV2({ task: CONTAINED_GAME_TASK, parsed }),
      /V3_PLAN_V2_SEMANTIC_ONLY_COMPATIBILITY_NOT_AUTHORIZED/u,
    );
    const authority = resolveV3PlanOutputAuthorityV2({
      task: CONTAINED_GAME_TASK,
      parsed,
      allowSemanticOnlyCompatibility: true,
    });
    assert.equal(authority.status, "proposal");
    if (authority.status !== "proposal") return;
    assert.equal(authority.sourceTransport, "semantic_proposal_v2");
    assert.equal("runtimeBehaviorContract" in authority, false);
    const projected = projectCanonicalV3PlanParsedOutputV2({ parsed, authority });
    assert.match(projected.prd, /```product-spec-v2/);
    assert.doesNotMatch(projected.prd, /product-runtime-behavior-contract-v1/);
  });

  it("rejects lossy v1 semantics instead of inventing control placement authority", () => {
    const legacy = {
      ...containedGamePlanProposalV2(),
      schema: "setfarm.plan-semantic-proposal.v1",
    };
    assert.throws(
      () => resolveV3PlanOutputAuthorityV2({
        task: CONTAINED_GAME_TASK,
        parsed: { prd: block("plan-semantic-proposal-v1", legacy) },
      }),
      (error: unknown) => {
        assert.ok(error instanceof V3PlanOutputV2RejectedError);
        assert.equal(error.message, "V3_PLAN_V2_LEGACY_SEMANTICS_FORBIDDEN");
        return true;
      },
    );
  });

  it("rejects planner-owned ProductSpec v2 even when its bytes were previously compiled", () => {
    const proposalAuthority = resolveV3PlanOutputAuthorityV2({
      task: CONTAINED_GAME_TASK,
      parsed: {
        prd: block(
          "plan-product-build-proposal-v1",
          containedGamePlanProductBuildProposalV1(),
        ),
      },
    });
    assert.equal(proposalAuthority.status, "proposal");
    if (proposalAuthority.status !== "proposal") return;

    assert.throws(
      () => resolveV3PlanOutputAuthorityV2({
        task: CONTAINED_GAME_TASK,
        parsed: { prd: block("product-spec-v2", proposalAuthority.productSpec) },
      }),
      /V3_PLAN_V2_COMPILER_PROJECTION_FORBIDDEN/,
    );
  });

  it("accepts and task-binds one typed refusal without invoking the product compiler", () => {
    const authority = resolveV3PlanOutputAuthorityV2({
      task: CONTAINED_GAME_TASK,
      parsed: { prd: block("product-spec-rejection-v1", typedRejection()) },
    });
    assert.equal(authority.status, "rejection");
    if (authority.status !== "rejection") return;
    assert.equal(authority.rejection.reasons[0]?.code, "PRODUCT_SPEC_REQUIRED_INFORMATION_MISSING");

    assert.throws(
      () => resolveV3PlanOutputAuthorityV2({
        task: CONTAINED_GAME_TASK,
        parsed: {
          prd: [
            block("product-spec-rejection-v1", typedRejection()),
            block("product-spec-rejection-v1", typedRejection()),
          ].join("\n"),
        },
      }),
      /V3_PLAN_V2_TYPED_ARTIFACT_REQUIRED:0:2/,
    );
  });

  it("rejects missing or mixed typed transports before retry classification", () => {
    assert.throws(
      () => resolveV3PlanOutputAuthorityV2({
        task: CONTAINED_GAME_TASK,
        parsed: { prd: "No typed artifact" },
      }),
      /V3_PLAN_V2_TYPED_ARTIFACT_REQUIRED:0:0/,
    );
    assert.throws(
      () => resolveV3PlanOutputAuthorityV2({
        task: CONTAINED_GAME_TASK,
        parsed: {
          prd: `${block("plan-semantic-proposal-v2", containedGamePlanProposalV2())}\n${block("product-spec-rejection-v1", typedRejection())}`,
        },
      }),
      /V3_PLAN_V2_TYPED_ARTIFACT_REQUIRED:1:1/,
    );
    assert.throws(
      () => resolveV3PlanOutputAuthorityV2({
        task: CONTAINED_GAME_TASK,
        parsed: {
          prd: [
            block("plan-product-build-proposal-v1", containedGamePlanProductBuildProposalV1()),
            block("plan-semantic-proposal-v2", containedGamePlanProposalV2()),
          ].join("\n"),
        },
      }),
      /V3_PLAN_V2_TYPED_ARTIFACT_REQUIRED:2:0/,
    );
    assert.throws(
      () => resolveV3PlanOutputAuthorityV2({
        task: CONTAINED_GAME_TASK,
        parsed: {
          prd: block(
            "plan-runtime-behavior-proposal-v1",
            containedGamePlanProductBuildProposalV1().runtimeBehavior,
          ),
        },
      }),
      /V3_PLAN_V2_SPLIT_BEHAVIOR_FORBIDDEN/,
    );
  });

  it("bounds PLAN prose before regex and JSON parsing and saturates cardinality", () => {
    assert.throws(
      () => resolveV3PlanOutputAuthorityV2({
        task: CONTAINED_GAME_TASK,
        parsed: { prd: "x".repeat((4 * 1024 * 1024) + 1) },
      }),
      /V3_PLAN_V2_PRD_TOO_LARGE/,
    );
    assert.throws(
      () => resolveV3PlanOutputAuthorityV2({
        task: CONTAINED_GAME_TASK,
        parsed: { prd: 42 } as any,
      }),
      /V3_PLAN_V2_PRD_TYPE_INVALID/,
    );

    const many = Array.from({ length: 1_000 }, () =>
      block("plan-semantic-proposal-v2", {})).join("\n");
    assert.throws(
      () => resolveV3PlanOutputAuthorityV2({
        task: CONTAINED_GAME_TASK,
        parsed: { prd: many },
      }),
      /V3_PLAN_V2_TYPED_ARTIFACT_REQUIRED:2:0/,
    );

    const authority = resolveV3PlanOutputAuthorityV2({
      task: CONTAINED_GAME_TASK,
      parsed: {
        prd: block(
          "plan-product-build-proposal-v1",
          containedGamePlanProductBuildProposalV1(),
        ),
      },
    });
    assert.equal(authority.status, "proposal");
    if (authority.status === "proposal") {
      assert.throws(
        () => projectCanonicalV3PlanParsedOutputV2({
          parsed: { prd: "x".repeat((4 * 1024 * 1024) + 1) },
          authority,
        }),
        /V3_PLAN_V2_PRD_TOO_LARGE/,
      );
    }
  });

  it("bypasses the legacy supervisor only for an accepted v2 PLAN proposal", () => {
    const proposal = resolveV3PlanOutputAuthorityV2({
      task: CONTAINED_GAME_TASK,
      parsed: {
        prd: block(
          "plan-product-build-proposal-v1",
          containedGamePlanProductBuildProposalV1(),
        ),
      },
    });
    const refusal = resolveV3PlanOutputAuthorityV2({
      task: CONTAINED_GAME_TASK,
      parsed: { prd: block("product-spec-rejection-v1", typedRejection()) },
    });
    assert.equal(shouldRunLegacyProductSupervisorV2({
      protocol: "v3",
      stepId: "plan",
      planAuthority: proposal,
    }), false);
    assert.equal(shouldRunLegacyProductSupervisorV2({
      protocol: "v3",
      stepId: "plan",
      planAuthority: refusal,
    }), true);
    assert.equal(shouldRunLegacyProductSupervisorV2({
      protocol: "shadow",
      stepId: "plan",
      planAuthority: proposal,
    }), true);
    assert.equal(shouldRunLegacyProductSupervisorV2({
      protocol: "v3",
      stepId: "design",
      planAuthority: proposal,
    }), true);
  });
});

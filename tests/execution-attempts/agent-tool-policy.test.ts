import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AgentToolPolicyDeniedError,
  AgentToolPolicyV1Schema,
  claimBoundStepCompleteStdinTransportV1,
  compareAgentToolPolicies,
  createAgentToolPolicyV1,
  legacyOutputFileTransportV1,
  requireAgentToolPolicySubset,
  type AgentToolPolicyProfile,
  type AgentToolPolicyV1,
} from "../../src/execution/agent-tool-policy.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";

const ALL_PROFILES: AgentToolPolicyProfile[] = [
  "artifact-only",
  "verification",
  "browser-verification",
  "source-scoped",
  "workspace-bootstrap",
  "repository-operator",
  "platform-operator",
  "scanner",
];

function rehash(policy: AgentToolPolicyV1): AgentToolPolicyV1 {
  const { policyHash: _policyHash, ...payload } = policy;
  return {
    ...payload,
    policyHash: hashCanonicalJson(payload),
  };
}

describe("declarative agent tool policy", () => {
  it("creates every explicit profile with a deterministic canonical policy hash", () => {
    const outputTransport = claimBoundStepCompleteStdinTransportV1();
    const hashes = new Set<string>();

    for (const profile of ALL_PROFILES) {
      const first = createAgentToolPolicyV1({ profile, outputTransport });
      const second = createAgentToolPolicyV1({
        outputTransport: structuredClone(outputTransport),
        profile,
      });

      assert.equal(AgentToolPolicyV1Schema.safeParse(first).success, true, profile);
      assert.equal(first.policyHash, second.policyHash, profile);
      assert.match(first.policyHash, /^[a-f0-9]{64}$/);
      hashes.add(first.policyHash);
    }

    assert.equal(hashes.size, ALL_PROFILES.length);
  });

  it("keeps artifact submission independent from generic filesystem mutation", () => {
    const stdinPolicy = createAgentToolPolicyV1({
      profile: "artifact-only",
      outputTransport: claimBoundStepCompleteStdinTransportV1(),
    });
    assert.deepEqual(stdinPolicy.toolAuthority.filesystemMutation, {
      scope: "none",
      genericWrite: false,
      edit: false,
      applyPatch: false,
    });
    assert.equal(stdinPolicy.artifactSubmission.allowed, true);
    assert.equal(
      stdinPolicy.artifactSubmission.transport.kind,
      "claim-bound-step-complete-stdin",
    );

    const legacyPolicy = createAgentToolPolicyV1({
      profile: "artifact-only",
      outputTransport: legacyOutputFileTransportV1("/tmp/setfarm-output-plan.txt"),
    });
    assert.deepEqual(legacyPolicy.toolAuthority.filesystemMutation, {
      scope: "none",
      genericWrite: false,
      edit: false,
      applyPatch: false,
    });
    assert.deepEqual(legacyPolicy.artifactSubmission.transport, {
      schema: "setfarm.stage-output-transport.v1",
      kind: "legacy-output-file",
      outputFile: "/tmp/setfarm-output-plan.txt",
      pathAuthority: "exact-output-file",
    });
    assert.throws(
      () => legacyOutputFileTransportV1("relative-output.txt"),
      /absolute path/,
    );
    assert.throws(
      () => legacyOutputFileTransportV1("/tmp/nested/../setfarm-output-plan.txt"),
      /normalized absolute path/,
    );
  });

  it("seals profile capability identity as well as the policy payload", () => {
    const policy = createAgentToolPolicyV1({
      profile: "artifact-only",
      outputTransport: claimBoundStepCompleteStdinTransportV1(),
    });

    const changedWithoutRehash = structuredClone(policy);
    changedWithoutRehash.toolAuthority.browser = true;
    assert.equal(AgentToolPolicyV1Schema.safeParse(changedWithoutRehash).success, false);

    const forgedProfile = structuredClone(policy);
    forgedProfile.toolAuthority.browser = true;
    const rehashedForgery = rehash(forgedProfile);
    assert.equal(
      AgentToolPolicyV1Schema.safeParse(rehashedForgery).success,
      false,
      "a matching payload hash must not authorize non-canonical profile capabilities",
    );

    const changedHash = { ...policy, policyHash: "f".repeat(64) };
    assert.equal(AgentToolPolicyV1Schema.safeParse(changedHash).success, false);
  });

  it("allows only capability subsets under the exact output transport", () => {
    const outputTransport = claimBoundStepCompleteStdinTransportV1();
    const requested = createAgentToolPolicyV1({
      profile: "artifact-only",
      outputTransport,
    });
    const authority = createAgentToolPolicyV1({
      profile: "source-scoped",
      outputTransport,
    });

    const comparison = compareAgentToolPolicies(requested, authority);
    assert.deepEqual(comparison, {
      allowed: true,
      requestedPolicyHash: requested.policyHash,
      authorityPolicyHash: authority.policyHash,
    });
    assert.equal(requireAgentToolPolicySubset(requested, authority).policyHash, requested.policyHash);

    const repositoryEscalation = compareAgentToolPolicies(
      createAgentToolPolicyV1({ profile: "verification", outputTransport }),
      requested,
    );
    assert.equal(repositoryEscalation.allowed, false);
    if (!repositoryEscalation.allowed) {
      assert.equal(repositoryEscalation.code, "AGENT_TOOL_POLICY_ESCALATION");
      assert.deepEqual(repositoryEscalation.reasons, [
        "requested capability is not authorized: repository:read",
      ]);
    }

    const browserEscalation = compareAgentToolPolicies(
      createAgentToolPolicyV1({ profile: "browser-verification", outputTransport }),
      createAgentToolPolicyV1({ profile: "verification", outputTransport }),
    );
    assert.equal(browserEscalation.allowed, false);
    if (!browserEscalation.allowed) {
      assert.equal(browserEscalation.code, "AGENT_TOOL_POLICY_ESCALATION");
      assert.deepEqual(browserEscalation.reasons, [
        "requested capability is not authorized: browser",
        "requested capability is not authorized: web",
      ]);
    }
  });

  it("fails closed for invalid policies, mutation-scope drift, and output drift", () => {
    const stdin = claimBoundStepCompleteStdinTransportV1();
    const sourcePolicy = createAgentToolPolicyV1({
      profile: "source-scoped",
      outputTransport: stdin,
    });
    const platformPolicy = createAgentToolPolicyV1({
      profile: "platform-operator",
      outputTransport: stdin,
    });

    const scopeMismatch = compareAgentToolPolicies(sourcePolicy, platformPolicy);
    assert.equal(scopeMismatch.allowed, false);
    if (!scopeMismatch.allowed) {
      assert.equal(scopeMismatch.code, "AGENT_TOOL_POLICY_MUTATION_SCOPE_MISMATCH");
    }

    const outputMismatch = compareAgentToolPolicies(
      createAgentToolPolicyV1({ profile: "artifact-only", outputTransport: stdin }),
      createAgentToolPolicyV1({
        profile: "artifact-only",
        outputTransport: legacyOutputFileTransportV1("/tmp/output-a.txt"),
      }),
    );
    assert.equal(outputMismatch.allowed, false);
    if (!outputMismatch.allowed) {
      assert.equal(outputMismatch.code, "AGENT_TOOL_POLICY_OUTPUT_TRANSPORT_MISMATCH");
    }

    const legacyPathMismatch = compareAgentToolPolicies(
      createAgentToolPolicyV1({
        profile: "artifact-only",
        outputTransport: legacyOutputFileTransportV1("/tmp/output-a.txt"),
      }),
      createAgentToolPolicyV1({
        profile: "artifact-only",
        outputTransport: legacyOutputFileTransportV1("/tmp/output-b.txt"),
      }),
    );
    assert.equal(legacyPathMismatch.allowed, false);
    if (!legacyPathMismatch.allowed) {
      assert.equal(legacyPathMismatch.code, "AGENT_TOOL_POLICY_OUTPUT_TRANSPORT_MISMATCH");
    }

    const invalid = compareAgentToolPolicies(
      { schema: "setfarm.agent-tool-policy.v1", profile: "unknown" },
      platformPolicy,
    );
    assert.deepEqual(invalid, {
      allowed: false,
      code: "AGENT_TOOL_POLICY_INVALID",
      reasons: ["requested policy is invalid"],
      requestedPolicyHash: null,
      authorityPolicyHash: platformPolicy.policyHash,
    });

    assert.throws(
      () => requireAgentToolPolicySubset(sourcePolicy, platformPolicy),
      (error: unknown) => error instanceof AgentToolPolicyDeniedError
        && error.code === "AGENT_TOOL_POLICY_MUTATION_SCOPE_MISMATCH",
    );
  });
});

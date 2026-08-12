import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as bindingModule from "../../src/product-compiler/schemas/executable-invocation-transport-binding-v2.js";
import {
  EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_MAX_CANONICAL_BYTES,
  EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_SCHEMA,
  EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_VERSION,
  ExecutableInvocationTransportBindingCandidateV2Schema,
  hashExecutableInvocationTransportBindingV2,
  parseExecutableInvocationTransportBindingCandidateV2,
  type ExecutableInvocationTransportBindingCandidateV2,
  type ExecutableInvocationTransportBindingHashPayloadV2,
} from "../../src/product-compiler/schemas/executable-invocation-transport-binding-v2.js";
import {
  compileInvocationInputTransportV2,
} from "../../src/product-compiler/invocation-input-transport-v2.js";
import {
  hashProductDeliverySelectionV2,
  resolveProductDeliverySelectionV2,
  type ProductDeliverySelectionV2,
} from "../../src/product-compiler/product-delivery-profile-catalog-v2.js";
import {
  hashInvocationInputTransportV2,
  type InvocationInputTransportV2,
} from "../../src/product-compiler/schemas/invocation-input-transport-v2.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "../../src/product-compiler/schemas/product-spec-v2.js";
import {
  genuineNodeCliProductSpecV2,
  genuineNodeExpressApiProductSpecV2,
} from "./fixtures/no-design-product-semantics-v2.js";

const CLI_BINDING_HASH_GOLDEN_V2 =
  "0787e4609095a57c0ecc7a7e0f17253be64e538de344fd8371afe616aa66fc2c";
const API_BINDING_HASH_GOLDEN_V2 =
  "5b382ec08ee77975f8d65b73b214e657ab8464f728e01384b2e71b8229099d17";

const VERIFIED_RELEASE_PROJECTION_FIXTURE_V2 = Object.freeze({
  platformReleaseManifestHash: "01".repeat(32),
  runtimePayloadHash: "02".repeat(32),
  externalResolutionHash: "03".repeat(32),
  environmentCapsuleHash: "04".repeat(32),
  launcherDefinitionHash: "05".repeat(32),
  launcherModuleHash: "06".repeat(32),
  launcherAbiHash: "07".repeat(32),
  runnerDefinitionHash: "08".repeat(32),
  runnerModuleHash: "09".repeat(32),
  runnerAbiHash: "0a".repeat(32),
  receiptSchemaHash: "0b".repeat(32),
  toolchainHash: "0c".repeat(32),
});

function deliverySelection(
  productSpec: ProductSpecV2,
  requestedStackPackId: "node-cli" | "node-express-api",
): ProductDeliverySelectionV2 {
  const result = resolveProductDeliverySelectionV2({
    productSpec,
    requestedStackPackId,
  });
  assert.equal(
    result.status,
    "shadow_selected",
    result.status === "rejected" ? JSON.stringify(result.diagnostics) : undefined,
  );
  if (result.status !== "shadow_selected") throw new Error("Expected shadow selection");
  return result.selection;
}

function compileTransport(
  productSpec: ProductSpecV2,
  requestedStackPackId: "node-cli" | "node-express-api",
  actionRef: string,
): InvocationInputTransportV2 {
  const selection = deliverySelection(productSpec, requestedStackPackId);
  const result = compileInvocationInputTransportV2({
    productSpec,
    deliverySelection: selection,
    actionRef,
  });
  assert.equal(
    result.status,
    "shadow_compiled",
    result.status === "rejected" ? JSON.stringify(result.diagnostics) : undefined,
  );
  if (result.status !== "shadow_compiled") throw new Error("Expected compiled transport");
  assert.equal(result.contract.deliverySelectionHash, hashProductDeliverySelectionV2(selection));
  return result.contract;
}

function cliTransport(): InvocationInputTransportV2 {
  return compileTransport(genuineNodeCliProductSpecV2(), "node-cli", "ACT_ADD_TASK");
}

function apiTransport(): InvocationInputTransportV2 {
  return compileTransport(
    genuineNodeExpressApiProductSpecV2(),
    "node-express-api",
    "ACT_CREATE_TASK",
  );
}

function bindingIdentity(
  transport: InvocationInputTransportV2,
): ExecutableInvocationTransportBindingHashPayloadV2 {
  return {
    schema: EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_SCHEMA,
    bindingVersion: EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_VERSION,
    bindingState: "candidate_unverified",
    productionUse: "forbidden",
    invocationTransport: structuredClone(transport),
    transportAuthority: {
      transportSchema: transport.schema,
      transportKind: transport.kind,
      transportContractHash: transport.contractHash,
      actionInvocationIntentHash: transport.actionInvocationIntentHash,
      productSpecHash: transport.productSpecHash,
      selectionHash: transport.deliverySelectionHash,
      profileBinding: structuredClone(transport.profileBinding),
      stackTopologyBinding: structuredClone(transport.stackPackBinding),
      evidenceCapabilityPolicyBinding: structuredClone(
        transport.evidenceCapabilityPolicyBinding,
      ),
      semanticSourceRuleBinding: structuredClone(transport.semanticSourceRuleBinding),
      launcherRef: transport.runtimeBinding.launcherRef,
      codecCatalogBinding: structuredClone(transport.codecCatalogBinding),
    },
    verifiedReleaseProjection: structuredClone(VERIFIED_RELEASE_PROJECTION_FIXTURE_V2),
  };
}

function bindingCandidate(
  transport: InvocationInputTransportV2,
): ExecutableInvocationTransportBindingCandidateV2 {
  const identity = bindingIdentity(transport);
  return {
    ...identity,
    bindingHash: hashExecutableInvocationTransportBindingV2(identity),
  };
}

function assertDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
}

function allKeys(value: unknown, output = new Set<string>()): Set<string> {
  if (value === null || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    value.forEach((entry) => allKeys(entry, output));
    return output;
  }
  for (const [key, child] of Object.entries(value)) {
    output.add(key);
    allKeys(child, output);
  }
  return output;
}

describe("ExecutableInvocationTransportBindingV2 candidate DTO", () => {
  it("binds genuine fresh CLI and API transports with literal deterministic identities", () => {
    const cli = parseExecutableInvocationTransportBindingCandidateV2(
      bindingCandidate(cliTransport()),
    );
    const api = parseExecutableInvocationTransportBindingCandidateV2(
      bindingCandidate(apiTransport()),
    );

    assert.equal(cli.bindingState, "candidate_unverified");
    assert.equal(cli.productionUse, "forbidden");
    assert.equal(cli.transportAuthority.transportContractHash, cli.invocationTransport.contractHash);
    assert.equal(cli.transportAuthority.selectionHash, cli.invocationTransport.deliverySelectionHash);
    assert.deepEqual(cli.transportAuthority.profileBinding, cli.invocationTransport.profileBinding);
    assert.deepEqual(
      cli.transportAuthority.stackTopologyBinding,
      cli.invocationTransport.stackPackBinding,
    );
    assert.equal(api.transportAuthority.transportKind, "http_request");
    assert.equal(
      api.transportAuthority.launcherRef,
      api.invocationTransport.runtimeBinding.launcherRef,
    );
    assert.equal(cli.bindingHash, CLI_BINDING_HASH_GOLDEN_V2);
    assert.equal(api.bindingHash, API_BINDING_HASH_GOLDEN_V2);
    assert.notEqual(cli.bindingHash, api.bindingHash);
    assert.equal(cli.bindingHash, hashExecutableInvocationTransportBindingV2(cli));
    assert.equal(api.bindingHash, hashExecutableInvocationTransportBindingV2(api));
    assertDeepFrozen(cli);
    assertDeepFrozen(api);
  });

  it("kills fixture hardcoding with independent fresh CLI commands and API routes", () => {
    const cliHashes = [
      ["task", "create"],
      ["work", "enqueue"],
    ].map((subcommandTokens) => {
      const candidate = structuredClone(genuineNodeCliProductSpecV2());
      const invocation = candidate.actions[0]!.invocationInterface;
      assert.equal(invocation.kind, "cli_command");
      if (invocation.kind !== "cli_command") throw new Error("Expected CLI intent");
      invocation.subcommandTokens = subcommandTokens;
      const transport = compileTransport(
        ProductSpecV2Schema.parse(candidate),
        "node-cli",
        "ACT_ADD_TASK",
      );
      return parseExecutableInvocationTransportBindingCandidateV2(
        bindingCandidate(transport),
      ).bindingHash;
    });
    const apiHashes = [
      "/projects/:project/tasks",
      "/workspaces/:project/queue",
    ].map((route) => {
      const candidate = structuredClone(genuineNodeExpressApiProductSpecV2());
      candidate.routes[0]!.path = route;
      const transport = compileTransport(
        ProductSpecV2Schema.parse(candidate),
        "node-express-api",
        "ACT_CREATE_TASK",
      );
      return parseExecutableInvocationTransportBindingCandidateV2(
        bindingCandidate(transport),
      ).bindingHash;
    });

    assert.equal(new Set([...cliHashes, ...apiHashes]).size, 4);
    assert.equal(cliHashes.includes(CLI_BINDING_HASH_GOLDEN_V2), false);
    assert.equal(apiHashes.includes(API_BINDING_HASH_GOLDEN_V2), false);
  });

  it("rejects every self-consistently rehashed duplicate join tamper", () => {
    type Mutation = Readonly<[
      label: string,
      mutate: (value: ExecutableInvocationTransportBindingCandidateV2) => void,
    ]>;
    const mutations: readonly Mutation[] = [
      ["transport schema", (value) => Object.assign(value.transportAuthority, {
        transportSchema: "setfarm.invocation-input-transport.v1",
      })],
      ["transport kind", (value) => Object.assign(value.transportAuthority, {
        transportKind: "http_request",
      })],
      ["transport hash", (value) => Object.assign(value.transportAuthority, {
        transportContractHash: "10".repeat(32),
      })],
      ["intent hash", (value) => Object.assign(value.transportAuthority, {
        actionInvocationIntentHash: "11".repeat(32),
      })],
      ["product hash", (value) => Object.assign(value.transportAuthority, {
        productSpecHash: "12".repeat(32),
      })],
      ["selection hash", (value) => Object.assign(value.transportAuthority, {
        selectionHash: "13".repeat(32),
      })],
      ["profile catalog version", (value) => Object.assign(
        value.transportAuthority.profileBinding,
        { catalogVersion: "9.0.0" },
      )],
      ["profile catalog hash", (value) => Object.assign(
        value.transportAuthority.profileBinding,
        { catalogHash: "14".repeat(32) },
      )],
      ["profile id", (value) => Object.assign(value.transportAuthority.profileBinding, {
        profileId: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
      })],
      ["profile hash", (value) => Object.assign(value.transportAuthority.profileBinding, {
        profileHash: "15".repeat(32),
      })],
      ["stack pack", (value) => Object.assign(value.transportAuthority.stackTopologyBinding, {
        stackPackId: "node-express-api",
      })],
      ["stack version", (value) => Object.assign(
        value.transportAuthority.stackTopologyBinding,
        { stackPackVersion: "999.0.0" },
      )],
      ["topology hash", (value) => Object.assign(
        value.transportAuthority.stackTopologyBinding,
        { stackPackContentHash: "16".repeat(32) },
      )],
      ["policy schema", (value) => Object.assign(
        value.transportAuthority.evidenceCapabilityPolicyBinding,
        { policySchema: "setfarm.product-evidence-capability-policy.v1" },
      )],
      ["policy version", (value) => Object.assign(
        value.transportAuthority.evidenceCapabilityPolicyBinding,
        { policyVersion: "9.0.0" },
      )],
      ["policy hash", (value) => Object.assign(
        value.transportAuthority.evidenceCapabilityPolicyBinding,
        { policyHash: "17".repeat(32) },
      )],
      ["rule catalog version", (value) => Object.assign(
        value.transportAuthority.semanticSourceRuleBinding,
        { catalogVersion: "9.0.0" },
      )],
      ["rule set", (value) => Object.assign(
        value.transportAuthority.semanticSourceRuleBinding,
        { ruleSetRef: "RULESET_NODE_EXPRESS_API_STATELESS_V1" },
      )],
      ["rule version", (value) => Object.assign(
        value.transportAuthority.semanticSourceRuleBinding,
        { ruleSetVersion: "9.0.0" },
      )],
      ["rule hash", (value) => Object.assign(
        value.transportAuthority.semanticSourceRuleBinding,
        { ruleSetHash: "18".repeat(32) },
      )],
      ["rule readiness", (value) => Object.assign(
        value.transportAuthority.semanticSourceRuleBinding.readiness,
        { status: "active" },
      )],
      ["rule blockers", (value) => Object.assign(
        value.transportAuthority.semanticSourceRuleBinding.readiness,
        { blockerCodes: ["SEMANTIC_SOURCE_RELEASE_MANIFEST_UNVERIFIED"] },
      )],
      ["launcher", (value) => Object.assign(value.transportAuthority, {
        launcherRef: "LAUNCH_NODE_EXPRESS_API_V2",
      })],
      ["codec schema", (value) => Object.assign(
        value.transportAuthority.codecCatalogBinding,
        { schema: "setfarm.invocation-transport-codec-catalog.v1" },
      )],
      ["codec version", (value) => Object.assign(
        value.transportAuthority.codecCatalogBinding,
        { catalogVersion: "9.0.0" },
      )],
      ["codec hash", (value) => Object.assign(
        value.transportAuthority.codecCatalogBinding,
        { catalogHash: "19".repeat(32) },
      )],
    ];
    const baseline = bindingCandidate(cliTransport());
    for (const [label, mutate] of mutations) {
      const candidate = structuredClone(baseline);
      mutate(candidate);
      candidate.bindingHash = hashExecutableInvocationTransportBindingV2(candidate);
      assert.equal(
        ExecutableInvocationTransportBindingCandidateV2Schema.safeParse(candidate).success,
        false,
        label,
      );
    }
  });

  it("rejects a rehashed nested transport when its duplicate contract join stays unchanged", () => {
    const candidate = structuredClone(bindingCandidate(cliTransport()));
    assert.equal(candidate.invocationTransport.kind, "cli_command");
    if (candidate.invocationTransport.kind !== "cli_command") {
      throw new Error("Expected CLI transport");
    }
    candidate.invocationTransport.subcommandTokens = ["different"];
    candidate.invocationTransport.contractHash = hashInvocationInputTransportV2(
      candidate.invocationTransport,
    );
    candidate.bindingHash = hashExecutableInvocationTransportBindingV2(candidate);
    assert.equal(
      ExecutableInvocationTransportBindingCandidateV2Schema.safeParse(candidate).success,
      false,
    );
  });

  it("keeps bilateral self-consistent transport forgery explicitly candidate-only", () => {
    const candidate = structuredClone(bindingCandidate(cliTransport()));
    candidate.invocationTransport.productSpecHash = "21".repeat(32);
    candidate.invocationTransport.contractHash = hashInvocationInputTransportV2(
      candidate.invocationTransport,
    );
    candidate.transportAuthority.productSpecHash =
      candidate.invocationTransport.productSpecHash;
    candidate.transportAuthority.transportContractHash =
      candidate.invocationTransport.contractHash;
    candidate.bindingHash = hashExecutableInvocationTransportBindingV2(candidate);

    const parsed = ExecutableInvocationTransportBindingCandidateV2Schema.parse(candidate);
    assert.equal(parsed.bindingState, "candidate_unverified");
    assert.equal(parsed.productionUse, "forbidden");
    assert.equal("verified" in parsed, false);
    assert.equal("activation" in parsed, false);
  });

  it("keeps release hashes inert but hash-bound and rejects unknown authority fields", () => {
    const baseline = bindingCandidate(apiTransport());
    const staleHash = structuredClone(baseline);
    staleHash.verifiedReleaseProjection.toolchainHash = "20".repeat(32);
    assert.equal(
      ExecutableInvocationTransportBindingCandidateV2Schema.safeParse(staleHash).success,
      false,
    );

    const inertCandidate = structuredClone(staleHash);
    inertCandidate.bindingHash = hashExecutableInvocationTransportBindingV2(inertCandidate);
    assert.equal(
      ExecutableInvocationTransportBindingCandidateV2Schema.safeParse(inertCandidate).success,
      true,
    );
    assert.equal(inertCandidate.bindingState, "candidate_unverified");
    assert.equal(inertCandidate.productionUse, "forbidden");

    for (const field of ["executablePath", "env", "command", "origin"]) {
      for (const location of ["root", "transportAuthority", "releaseProjection"] as const) {
        const candidate = structuredClone(baseline) as unknown as Record<string, unknown>;
        const target = location === "root"
          ? candidate
          : location === "transportAuthority"
            ? candidate.transportAuthority as Record<string, unknown>
            : candidate.verifiedReleaseProjection as Record<string, unknown>;
        target[field] = "/caller/authored";
        candidate.bindingHash = hashExecutableInvocationTransportBindingV2(
          candidate as ExecutableInvocationTransportBindingCandidateV2,
        );
        assert.equal(
          ExecutableInvocationTransportBindingCandidateV2Schema.safeParse(candidate).success,
          false,
          `${location}.${field}`,
        );
      }
    }
  });

  it("bounds canonical parsing and rejects hostile proxies without invoking traps", () => {
    const baseline = bindingCandidate(cliTransport());
    const oversized = {
      ...structuredClone(baseline),
      padding: "x".repeat(EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_MAX_CANONICAL_BYTES),
    };
    assert.equal(
      ExecutableInvocationTransportBindingCandidateV2Schema.safeParse(oversized).success,
      false,
    );
    assert.throws(() => parseExecutableInvocationTransportBindingCandidateV2(oversized));

    let traps = 0;
    const hostile = new Proxy({}, {
      ownKeys() {
        traps += 1;
        throw new Error("proxy trap must not execute");
      },
    });
    assert.equal(
      ExecutableInvocationTransportBindingCandidateV2Schema.safeParse(hostile).success,
      false,
    );
    assert.throws(() => parseExecutableInvocationTransportBindingCandidateV2(hostile));
    assert.equal(traps, 0);
  });

  it("exports no verifier, issuer, brand, activation, or runnable authority", () => {
    assert.deepEqual(Object.keys(bindingModule).sort(), [
      "EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_MAX_CANONICAL_BYTES",
      "EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_SCHEMA",
      "EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_VERSION",
      "ExecutableInvocationTransportBindingCandidateV2Schema",
      "hashExecutableInvocationTransportBindingV2",
      "parseExecutableInvocationTransportBindingCandidateV2",
    ]);
    const candidate = bindingCandidate(apiTransport());
    const forbiddenKeys = new Set([
      "executable",
      "executablePath",
      "env",
      "environment",
      "command",
      "cwd",
      "origin",
      "baseUrl",
      "runnerRef",
      "releaseRef",
    ]);
    for (const key of allKeys(candidate)) assert.equal(forbiddenKeys.has(key), false, key);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  STACK_SEMANTIC_SOURCE_RULES_CATALOG_PACK_IDS_V1,
  compileStackSemanticSourceRulesCatalogV1,
  verifyStackSemanticSourceRulesCatalogV1,
} from "../../src/product-compiler/stack-semantic-source-rules-catalog-v1.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  SEMANTIC_SOURCE_RESPONSIBILITIES_BY_SUBJECT_V1,
  SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V1,
  SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V1,
  SEMANTIC_SOURCE_STRUCTURAL_POSTCONDITION_BY_RESPONSIBILITY_V1,
  GENERATED_SOURCE_RECEIPT_ARTIFACT_TYPE_V2,
  STACK_SEMANTIC_SOURCE_RULES_CATALOG_ARTIFACT_TYPE_V1,
  STACK_SEMANTIC_SOURCE_RULE_SCHEMA_V1,
  STITCH_GENERATED_SOURCE_CONTRACT_HASH_V2,
  STITCH_GENERATED_SOURCE_CONTRACT_V2,
  TYPESCRIPT_SEMANTIC_SOURCE_PARSER_CONTRACT_HASH_V1,
  TYPESCRIPT_SEMANTIC_SOURCE_PARSER_CONTRACT_V1,
  SemanticSourceRuleCandidateV1Schema,
  StackSemanticSourceRuleSetV1Schema,
  StackSemanticSourceRulesCatalogV1Schema,
  hashSemanticSourceRuleV1,
  hashStackSemanticSourceRuleSetV1,
  hashStackSemanticSourceRulesCatalogPayloadV1,
  type SemanticSourceRuleCandidateV1,
  type SemanticSourceRuleV1,
  type StackSemanticSourceRulesCatalogCompilerInputV1,
} from "../../src/product-compiler/schemas/stack-semantic-source-rules-v1.js";
import { getStackTopologyCatalogContract } from "../../src/product-compiler/stack-topology-catalog.js";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);

function clone<T>(value: T): T {
  return structuredClone(value);
}

function compilerInput(): StackSemanticSourceRulesCatalogCompilerInputV1 {
  return {
    producer: {
      pass: "stack-semantic-source-rules-catalog-v1",
      codeSha: SHA_A,
      model: "kimi-k2.5-\u015fema",
      toolVersions: {
        node: "22.18.0",
        typescript: "5.9.2",
      },
    },
    releaseAuthority: {
      codeSha: SHA_A,
      platformBundleHash: SHA_B,
    },
  };
}

function compiledCatalog() {
  const result = compileStackSemanticSourceRulesCatalogV1(compilerInput());
  assert.equal(result.status, "compiled", result.status === "rejected"
    ? JSON.stringify(result.diagnostics)
    : undefined);
  return result;
}

function candidateFromRule(rule: SemanticSourceRuleV1): SemanticSourceRuleCandidateV1 {
  const { schema: _schema, ruleHash: _ruleHash, ...candidate } = clone(rule);
  return SemanticSourceRuleCandidateV1Schema.parse(candidate);
}

function finalRule(candidate: SemanticSourceRuleCandidateV1): SemanticSourceRuleV1 {
  return {
    schema: STACK_SEMANTIC_SOURCE_RULE_SCHEMA_V1,
    ...candidate,
    ruleHash: hashSemanticSourceRuleV1(candidate),
  } as SemanticSourceRuleV1;
}

function selfConsistentForgedEnvelope(
  mutate: (catalog: any) => void,
): ReturnType<typeof compiledCatalog>["envelope"] {
  const compiled = compiledCatalog();
  const catalog = clone(compiled.catalog) as any;
  mutate(catalog);
  for (const ruleSet of catalog.ruleSets) {
    ruleSet.rules = ruleSet.rules.map((rule: SemanticSourceRuleV1) =>
      finalRule(candidateFromRule(rule)));
    ruleSet.ruleSetHash = hashStackSemanticSourceRuleSetV1(ruleSet);
  }
  catalog.catalogPayloadHash = hashStackSemanticSourceRulesCatalogPayloadV1(catalog);
  assert.deepEqual(StackSemanticSourceRulesCatalogV1Schema.parse(catalog), catalog);
  const envelope = clone(compiled.envelope) as any;
  envelope.payload = catalog;
  return envelope;
}

describe("StackSemanticSourceRulesCatalogV1", () => {
  it("compiles four exact cross-class shadow rule sets with domain and CAS identities", () => {
    const result = compiledCatalog();

    assert.equal(result.envelope.artifactType, STACK_SEMANTIC_SOURCE_RULES_CATALOG_ARTIFACT_TYPE_V1);
    assert.equal(result.catalog.catalogPayloadHash, result.catalogPayloadHash);
    assert.equal(
      result.catalogPayloadHash,
      hashStackSemanticSourceRulesCatalogPayloadV1(result.catalog),
    );
    assert.equal(result.catalogArtifactHash, hashCanonicalJson(result.envelope));
    assert.equal(
      result.catalogArtifactByteLength,
      Buffer.byteLength(canonicalJsonStringify(result.envelope), "utf8"),
    );
    assert.deepEqual(
      result.catalog.ruleSets.map((ruleSet) => ruleSet.stackPackBinding.stackPackId),
      STACK_SEMANTIC_SOURCE_RULES_CATALOG_PACK_IDS_V1,
    );
    for (const ruleSet of result.catalog.ruleSets) {
      assert.equal(ruleSet.readiness.status, "shadow");
      assert.equal(ruleSet.ruleSetHash, hashStackSemanticSourceRuleSetV1(ruleSet));
      const topology = getStackTopologyCatalogContract(ruleSet.stackPackBinding.stackPackId);
      assert.ok(topology);
      assert.deepEqual(ruleSet.stackPackBinding, {
        stackPackId: topology.identity.id,
        stackPackVersion: topology.identity.version,
        stackPackContentHash: topology.identity.contentHash,
      });
      for (const rule of ruleSet.rules) {
        assert.equal(rule.ruleHash, hashSemanticSourceRuleV1(candidateFromRule(rule)));
      }
    }
    assert.deepEqual(StackSemanticSourceRulesCatalogV1Schema.parse(result.catalog), result.catalog);
  });

  it("is deterministic across producer map ordering and does not mutate input", () => {
    const firstInput = compilerInput();
    const firstSnapshot = clone(firstInput);
    const secondInput = compilerInput();
    secondInput.producer.toolVersions = {
      typescript: "5.9.2",
      node: "22.18.0",
    };

    const first = compileStackSemanticSourceRulesCatalogV1(firstInput);
    const second = compileStackSemanticSourceRulesCatalogV1(secondInput);
    assert.equal(first.status, "compiled");
    assert.equal(second.status, "compiled");
    if (first.status !== "compiled" || second.status !== "compiled") return;
    assert.equal(first.catalogPayloadHash, second.catalogPayloadHash);
    assert.equal(first.catalogArtifactHash, second.catalogArtifactHash);
    assert.equal(canonicalJsonStringify(first.envelope), canonicalJsonStringify(second.envelope));
    assert.deepEqual(firstInput, firstSnapshot);
  });

  it("fresh-verifies only the exact compiler-owned envelope", () => {
    const compiled = compiledCatalog();
    const result = verifyStackSemanticSourceRulesCatalogV1({
      compilerInput: compilerInput(),
      candidateEnvelope: compiled.envelope,
    });

    assert.equal(result.status, "verified");
    if (result.status !== "verified") return;
    assert.equal(result.catalogPayloadHash, compiled.catalogPayloadHash);
    assert.equal(result.catalogArtifactHash, compiled.catalogArtifactHash);
    assert.equal(canonicalJsonStringify(result.envelope), canonicalJsonStringify(compiled.envelope));
  });

  it("rejects a self-consistent forged rule against fresh code authority", () => {
    const compiled = compiledCatalog();
    const forgedEnvelope = clone(compiled.envelope) as any;
    const catalog = clone(compiled.catalog) as any;
    const ruleSet = catalog.ruleSets[0];
    const rule = ruleSet.rules[0];
    rule.ruleVersion = "1.0.1";
    rule.ruleHash = hashSemanticSourceRuleV1(candidateFromRule(rule));
    ruleSet.ruleSetHash = hashStackSemanticSourceRuleSetV1(ruleSet);
    catalog.catalogPayloadHash = hashStackSemanticSourceRulesCatalogPayloadV1(catalog);
    forgedEnvelope.payload = catalog;
    assert.deepEqual(StackSemanticSourceRulesCatalogV1Schema.parse(catalog), catalog);

    const result = verifyStackSemanticSourceRulesCatalogV1({
      compilerInput: compilerInput(),
      candidateEnvelope: forgedEnvelope,
    });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.diagnostics[0]?.code, "STACK_SEMANTIC_SOURCE_RULES_V1_AUTHORITY_MISMATCH");
  });

  it("accepts no caller-authored rule bodies and rejects release identity disagreement", () => {
    const withRules = {
      ...compilerInput(),
      ruleSets: [],
    };
    const injected = compileStackSemanticSourceRulesCatalogV1(withRules);
    assert.equal(injected.status, "rejected");
    if (injected.status === "rejected") {
      assert.equal(injected.diagnostics[0]?.code, "STACK_SEMANTIC_SOURCE_RULES_V1_INPUT_INVALID");
    }

    const mismatched = compilerInput();
    mismatched.releaseAuthority.codeSha = SHA_C;
    const release = compileStackSemanticSourceRulesCatalogV1(mismatched);
    assert.equal(release.status, "rejected");
    if (release.status === "rejected") {
      assert.match(release.diagnostics[0]?.message ?? "", /must equal/i);
    }
  });

  it("rejects release drift when verifying an older otherwise valid envelope", () => {
    const compiled = compiledCatalog();
    const drifted = compilerInput();
    drifted.releaseAuthority.platformBundleHash = SHA_C;
    const result = verifyStackSemanticSourceRulesCatalogV1({
      compilerInput: drifted,
      candidateEnvelope: compiled.envelope,
    });
    assert.equal(result.status, "rejected");
    if (result.status === "rejected") {
      assert.equal(result.diagnostics[0]?.code, "STACK_SEMANTIC_SOURCE_RULES_V1_AUTHORITY_MISMATCH");
    }
  });

  it("rejects proxies, cycles, accessors, and oversized public input without invoking traps", () => {
    const proxied = compileStackSemanticSourceRulesCatalogV1(new Proxy({}, {}));
    assert.equal(proxied.status, "rejected");

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const cycle = compileStackSemanticSourceRulesCatalogV1(cyclic);
    assert.equal(cycle.status, "rejected");

    let getterInvoked = false;
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, "producer", {
      enumerable: true,
      get() {
        getterInvoked = true;
        throw new Error("must not run");
      },
    });
    const accessorResult = compileStackSemanticSourceRulesCatalogV1(accessor);
    assert.equal(accessorResult.status, "rejected");
    assert.equal(getterInvoked, false);

    const oversized = compilerInput();
    oversized.producer.model = "\u00fc".repeat(600_000);
    const size = compileStackSemanticSourceRulesCatalogV1(oversized);
    assert.equal(size.status, "rejected");
    if (size.status === "rejected") {
      assert.equal(size.diagnostics[0]?.code, "STACK_SEMANTIC_SOURCE_RULES_V1_INPUT_INVALID");
    }
  });

  it("bounds schema diagnostics to 100 entries including an overflow sentinel", () => {
    const input = compilerInput();
    input.producer.toolVersions = Object.fromEntries(
      Array.from({ length: 250 }, (_, index) => [`tool_${index}`, ""]),
    );
    const result = compileStackSemanticSourceRulesCatalogV1(input);
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.diagnostics.length, 100);
    assert.ok(result.diagnostics.some((entry) => /retained the first 99/.test(entry.message)));
  });

  it("returns recursively immutable catalog authority and code-owned constants", () => {
    const compiled = compiledCatalog();
    assert.ok(Object.isFrozen(compiled));
    assert.ok(Object.isFrozen(compiled.catalog));
    assert.ok(Object.isFrozen(compiled.catalog.ruleSets));
    assert.ok(Object.isFrozen(compiled.catalog.ruleSets[0]!.rules[0]));
    assert.ok(Object.isFrozen(TYPESCRIPT_SEMANTIC_SOURCE_PARSER_CONTRACT_V1));
    assert.ok(Object.isFrozen(TYPESCRIPT_SEMANTIC_SOURCE_PARSER_CONTRACT_V1.supportedSlotKinds));
    assert.ok(Object.isFrozen(SEMANTIC_SOURCE_RESPONSIBILITIES_BY_SUBJECT_V1));
    assert.ok(Object.isFrozen(SEMANTIC_SOURCE_RESPONSIBILITIES_BY_SUBJECT_V1.action));
    assert.ok(Object.isFrozen(STITCH_GENERATED_SOURCE_CONTRACT_V2));
    assert.ok(Object.isFrozen(STITCH_GENERATED_SOURCE_CONTRACT_V2.requiredAuthority));
    assert.ok(Object.isFrozen(STITCH_GENERATED_SOURCE_CONTRACT_V2.semanticIdentityFields));
    assert.ok(Object.isFrozen(
      SEMANTIC_SOURCE_STRUCTURAL_POSTCONDITION_BY_RESPONSIBILITY_V1,
    ));
    assert.throws(() => {
      (compiled.catalog.ruleSets as any[]).push("forged");
    });
  });

  it("exposes only canonical shadow blockers and never an active catalog label", () => {
    const compiled = compiledCatalog();
    for (const ruleSet of compiled.catalog.ruleSets) {
      const expected = [
        ...(ruleSet.stackPackBinding.stackPackId === "vite-react-web-app"
          || ruleSet.stackPackBinding.stackPackId === "browser-game-canvas"
          ? [
              "SEMANTIC_SOURCE_GENERATED_RECEIPT_UNVERIFIED",
              "SEMANTIC_SOURCE_GENERATOR_EXECUTION_UNVERIFIED",
            ]
          : ["SEMANTIC_SOURCE_INVOCATION_INPUT_TRANSPORT_UNVERIFIED"]),
        "SEMANTIC_SOURCE_PARSER_IMPLEMENTATION_UNVERIFIED",
        "SEMANTIC_SOURCE_RELEASE_MANIFEST_UNVERIFIED",
      ].sort();
      assert.deepEqual(ruleSet.readiness.blockerCodes, expected);
    }
    assert.doesNotMatch(canonicalJsonStringify(compiled.catalog), /"status":"active"/);

    const active = clone(compiled.catalog.ruleSets[0]) as any;
    active.readiness.status = "active";
    active.readiness.blockerCodes = [];
    assert.equal(StackSemanticSourceRuleSetV1Schema.safeParse(active).success, false);
  });

  it("rejects self-consistent blocker, domain, and topology-projection forgeries", () => {
    const blockerForgery = selfConsistentForgedEnvelope((catalog) => {
      catalog.ruleSets[0].readiness.blockerCodes = catalog.ruleSets[0]
        .readiness.blockerCodes.slice(1);
    });
    const blockerResult = verifyStackSemanticSourceRulesCatalogV1({
      compilerInput: compilerInput(),
      candidateEnvelope: blockerForgery,
    });
    assert.equal(blockerResult.status, "rejected");
    if (blockerResult.status === "rejected") {
      assert.equal(
        blockerResult.diagnostics[0]?.code,
        "STACK_SEMANTIC_SOURCE_RULES_V1_AUTHORITY_MISMATCH",
      );
    }

    const domainForgery = selfConsistentForgedEnvelope((catalog) => {
      catalog.ruleSets[0].rules = catalog.ruleSets[0].rules.filter(
        (rule: SemanticSourceRuleV1) => rule.responsibility !== "action_handler",
      );
    });
    const domainResult = verifyStackSemanticSourceRulesCatalogV1({
      compilerInput: compilerInput(),
      candidateEnvelope: domainForgery,
    });
    assert.equal(domainResult.status, "rejected");
    if (domainResult.status === "rejected") {
      assert.equal(
        domainResult.diagnostics[0]?.code,
        "STACK_SEMANTIC_SOURCE_RULES_V1_AUTHORITY_MISMATCH",
      );
    }

    const projectionForgery = selfConsistentForgedEnvelope((catalog) => {
      const platformRule = catalog.ruleSets[0].rules.find(
        (rule: SemanticSourceRuleV1) => rule.ruleKind === "platform_contract",
      );
      platformRule.platformContractProjectionHash = SHA_C;
    });
    const projectionResult = verifyStackSemanticSourceRulesCatalogV1({
      compilerInput: compilerInput(),
      candidateEnvelope: projectionForgery,
    });
    assert.equal(projectionResult.status, "rejected");
    if (projectionResult.status === "rejected") {
      assert.equal(
        projectionResult.diagnostics[0]?.code,
        "STACK_SEMANTIC_SOURCE_RULES_V1_AUTHORITY_MISMATCH",
      );
    }

    const transportForgery = selfConsistentForgedEnvelope((catalog) => {
      const actionInputRule = catalog.ruleSets[0].rules.find(
        (rule: SemanticSourceRuleV1) => rule.responsibility === "action_input_transport",
      );
      actionInputRule.subjectContractResolution = {
        kind: "cli_invocation_input_transport",
        artifactType: "setfarm.invocation-input-transport.v2",
        contractVersion: 2,
        contractHashField: "contractHash",
        resolutionContractRef: "ACTION_INPUT_CLI_INVOCATION_V2",
      };
    });
    const transportResult = verifyStackSemanticSourceRulesCatalogV1({
      compilerInput: compilerInput(),
      candidateEnvelope: transportForgery,
    });
    assert.equal(transportResult.status, "rejected");
    if (transportResult.status === "rejected") {
      assert.equal(
        transportResult.diagnostics[0]?.code,
        "STACK_SEMANTIC_SOURCE_RULES_V1_AUTHORITY_MISMATCH",
      );
    }
  });

  it("rejects repeated activation fact kinds and incoherent source authorities", () => {
    const compiled = compiledCatalog();
    const entrypointRule = compiled.catalog.ruleSets[0]!.rules.find((rule) =>
      rule.responsibility === "entrypoint_registration")!;
    const duplicateFact = candidateFromRule(entrypointRule) as any;
    duplicateFact.activation.atoms.push({
      kind: "entrypoint_kind",
      values: ["web"],
    });
    assert.equal(SemanticSourceRuleCandidateV1Schema.safeParse(duplicateFact).success, false);

    const sourceRule = compiled.catalog.ruleSets[0]!.rules.find((rule) =>
      rule.ruleKind === "source_slot" && rule.accessPolicy === "owned_writable")!;
    const incoherent = candidateFromRule(sourceRule) as any;
    incoherent.accessPolicy = "granted_writable";
    const incoherentResult = SemanticSourceRuleCandidateV1Schema.safeParse(incoherent);
    assert.equal(incoherentResult.success, false);
    if (!incoherentResult.success) {
      assert.ok(incoherentResult.error.issues.some((issue) => /physical owner/i.test(issue.message)));
    }

    const wrongPostcondition = candidateFromRule(sourceRule) as any;
    wrongPostcondition.outputPolicy.structuralPostconditionRefs = [
      "POSTCONDITION_STATE_STORE_V1",
    ];
    const postconditionResult = SemanticSourceRuleCandidateV1Schema.safeParse(wrongPostcondition);
    assert.equal(postconditionResult.success, false);
    if (!postconditionResult.success) {
      assert.ok(postconditionResult.error.issues.some((issue) =>
        /one exact code-owned structural postcondition/i.test(issue.message)));
    }

    const sharedRule = compiled.catalog.ruleSets[0]!.rules.find((rule) =>
      rule.ruleKind === "source_slot"
      && rule.locatorContract.kind === "versioned_ast_slot")!;
    const parserDrift = candidateFromRule(sharedRule) as any;
    parserDrift.locatorContract.parserContractHash = SHA_C;
    const parserResult = SemanticSourceRuleCandidateV1Schema.safeParse(parserDrift);
    assert.equal(parserResult.success, false);
    if (!parserResult.success) {
      assert.ok(parserResult.error.issues.some((issue) => /exact code-owned parser/i.test(issue.message)));
    }
  });

  it("rejects receipt schema disagreement and non-exact persistence exemptions", () => {
    const compiled = compiledCatalog();
    const generated = compiled.catalog.ruleSets[0]!.rules.find((rule) =>
      rule.ruleKind === "source_slot" && rule.targetKind === "generated_source")!;
    const receiptMismatch = candidateFromRule(generated) as any;
    receiptMismatch.locatorContract.receiptSchema = "setfarm.generated-screen-receipt.v2";
    const receipt = SemanticSourceRuleCandidateV1Schema.safeParse(receiptMismatch);
    assert.equal(receipt.success, false);
    if (!receipt.success) {
      assert.ok(receipt.error.issues.some((issue) =>
        issue.path.join(".").includes("receiptSchema")));
    }

    const contractRefMismatch = candidateFromRule(generated) as any;
    contractRefMismatch.outputPolicy.generatorContractRef =
      "GENERATOR_STITCH_GENERATED_SOURCE_V1";
    assert.equal(
      SemanticSourceRuleCandidateV1Schema.safeParse(contractRefMismatch).success,
      false,
    );

    const contractHashMismatch = candidateFromRule(generated) as any;
    contractHashMismatch.outputPolicy.generatorContractHash = SHA_C;
    assert.equal(
      SemanticSourceRuleCandidateV1Schema.safeParse(contractHashMismatch).success,
      false,
    );

    const exemption = compiled.catalog.ruleSets[0]!.rules.find((rule) =>
      rule.ruleKind === "typed_exemption"
      && rule.exemptionCode === "PERSISTENCE_NONE_NO_SOURCE_REQUIRED")!;
    const broadExemption = candidateFromRule(exemption) as any;
    broadExemption.activation.atoms[0].values = ["memory", "none"];
    const parsed = SemanticSourceRuleCandidateV1Schema.safeParse(broadExemption);
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.ok(parsed.error.issues.some((issue) => /singleton persistence-kind/i.test(issue.message)));
    }
  });

  it("rejects rule-kind/cardinality nonsense and unreachable activation facts", () => {
    const compiled = compiledCatalog();
    const rules = compiled.catalog.ruleSets.flatMap((ruleSet) => ruleSet.rules);

    const platform = candidateFromRule(rules.find((rule) =>
      rule.ruleKind === "platform_contract"
      && rule.platformAuthorityRef === "PLATFORM_BUILD_COMMAND_V1")!) as any;
    platform.subjectKind = "action";
    platform.responsibility = "action_handler";
    platform.activation = { kind: "always" };
    platform.cardinality = {
      kind: "catalog_bounded_aggregate",
      maxMembers: 2,
      slotKeyDomainRef: "SLOT_DOMAIN_ACTION_HANDLER_V1",
    };
    const platformResult = SemanticSourceRuleCandidateV1Schema.safeParse(platform);
    assert.equal(platformResult.success, false);
    if (!platformResult.success) {
      assert.ok(platformResult.error.issues.some((issue) =>
        /exact subject, activation, and per-subject cardinality/i.test(issue.message)));
    }

    const action = candidateFromRule(rules.find((rule) =>
      rule.ruleKind === "source_slot" && rule.responsibility === "action_handler")!) as any;
    action.cardinality = { kind: "exactly_one_per_entrypoint" };
    const actionResult = SemanticSourceRuleCandidateV1Schema.safeParse(action);
    assert.equal(actionResult.success, false);
    if (!actionResult.success) {
      assert.ok(actionResult.error.issues.some((issue) =>
        /requires exactly_one_per_subject cardinality/i.test(issue.message)));
    }

    const designActivatedAction = candidateFromRule(rules.find((rule) =>
      rule.ruleKind === "source_slot" && rule.responsibility === "action_handler")!) as any;
    designActivatedAction.activation = {
      kind: "all",
      atoms: [{ kind: "design_source_kind", values: ["stitch"] }],
    };
    const designActivatedActionResult = SemanticSourceRuleCandidateV1Schema.safeParse(
      designActivatedAction,
    );
    assert.equal(designActivatedActionResult.success, false);
    if (!designActivatedActionResult.success) {
      assert.ok(designActivatedActionResult.error.issues.some((issue) =>
        /incompatible with the rule subject kind/i.test(issue.message)));
    }

    const missingTransport = candidateFromRule(rules.find((rule) =>
      rule.ruleKind === "source_slot"
      && rule.responsibility === "action_input_transport")!) as any;
    missingTransport.subjectContractResolution = { kind: "none" };
    assert.equal(SemanticSourceRuleCandidateV1Schema.safeParse(missingTransport).success, false);

    const transportOnAction = candidateFromRule(rules.find((rule) =>
      rule.ruleKind === "source_slot" && rule.responsibility === "action_handler")!) as any;
    transportOnAction.subjectContractResolution = {
      kind: "dom_action_input_transport",
      artifactType: "setfarm.action-input-transport.v2",
      contractVersion: 2,
      contractHashField: "contractHash",
      resolutionContractRef: "ACTION_INPUT_DOM_TRANSPORT_V2",
    };
    assert.equal(SemanticSourceRuleCandidateV1Schema.safeParse(transportOnAction).success, false);

    const persistence = candidateFromRule(rules.find((rule) =>
      rule.ruleKind === "source_slot"
      && rule.responsibility === "persistence_adapter"
      && rule.activation.kind === "all"
      && rule.activation.atoms.some((atom) =>
        atom.kind === "persistence_kind" && atom.values.includes("local_storage")))!) as any;
    persistence.activation.atoms.push({
      kind: "persistence_durability",
      values: ["session"],
    });
    persistence.activation.atoms.sort((left: unknown, right: unknown) =>
      hashCanonicalJson(left).localeCompare(hashCanonicalJson(right)));
    const persistenceResult = SemanticSourceRuleCandidateV1Schema.safeParse(persistence);
    assert.equal(persistenceResult.success, false);
    if (!persistenceResult.success) {
      assert.ok(persistenceResult.error.issues.some((issue) =>
        /unreachable or partial ProductSpecV2 domain/i.test(issue.message)));
    }

    const partialPersistence = candidateFromRule(rules.find((rule) =>
      rule.ruleKind === "source_slot"
      && rule.responsibility === "persistence_adapter"
      && rule.activation.kind === "all"
      && rule.activation.atoms.some((atom) =>
        atom.kind === "persistence_kind" && atom.values.includes("database")))!) as any;
    partialPersistence.activation.atoms.push({
      kind: "persistence_durability",
      values: ["durable", "reload"],
    });
    partialPersistence.activation.atoms.sort((left: unknown, right: unknown) =>
      hashCanonicalJson(left).localeCompare(hashCanonicalJson(right)));
    const partialPersistenceResult = SemanticSourceRuleCandidateV1Schema.safeParse(
      partialPersistence,
    );
    assert.equal(partialPersistenceResult.success, false);
    if (!partialPersistenceResult.success) {
      assert.ok(partialPersistenceResult.error.issues.some((issue) =>
        /unreachable or partial ProductSpecV2 domain/i.test(issue.message)));
    }
  });

  it("rejects overlapping ownership rules even when every hash is self-consistent", () => {
    const compiled = compiledCatalog();
    const ruleSet = clone(compiled.catalog.ruleSets[0]) as any;
    const actionRule = ruleSet.rules.find((rule: SemanticSourceRuleV1) =>
      rule.responsibility === "action_handler");
    const overlappingCandidate = candidateFromRule(actionRule);
    overlappingCandidate.ruleRef = "RULE_BROWSER_GAME_ACTION_HANDLER_ALTERNATE_V1";
    ruleSet.rules.push(finalRule(overlappingCandidate));
    ruleSet.rules.sort((left: SemanticSourceRuleV1, right: SemanticSourceRuleV1) =>
      left.ruleRef.localeCompare(right.ruleRef));
    ruleSet.ruleSetHash = hashStackSemanticSourceRuleSetV1(ruleSet);
    const result = StackSemanticSourceRuleSetV1Schema.safeParse(ruleSet);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.some((issue) => /activation overlaps/i.test(issue.message)));
    }
  });

  it("uses only exact source tokens, selected entrypoints, receipts, and versioned slots", () => {
    const compiled = compiledCatalog();
    assert.equal(
      TYPESCRIPT_SEMANTIC_SOURCE_PARSER_CONTRACT_HASH_V1,
      hashCanonicalJson(TYPESCRIPT_SEMANTIC_SOURCE_PARSER_CONTRACT_V1),
    );
    assert.equal(
      SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V1,
      hashCanonicalJson(SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V1),
    );
    assert.equal(
      STITCH_GENERATED_SOURCE_CONTRACT_HASH_V2,
      hashCanonicalJson(STITCH_GENERATED_SOURCE_CONTRACT_V2),
    );
    const serialized = canonicalJsonStringify(compiled.catalog);
    assert.doesNotMatch(serialized, /title|slug|regex|glob|basename|first[_-]?existing|allowed[_-]?root/i);

    for (const rule of compiled.catalog.ruleSets.flatMap((ruleSet) => ruleSet.rules)) {
      if (rule.ruleKind !== "source_slot") continue;
      if (rule.pathResolution.kind === "compiler_semantic_token_path") {
        assert.equal(rule.pathResolution.tokenAlgorithm, "sha256_full");
        assert.equal(
          rule.pathResolution.tokenContractHash,
          SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V1,
        );
        assert.equal(rule.locatorContract.kind, "exclusive_file");
        assert.equal(rule.accessPolicy, "owned_writable");
      }
      if (rule.pathResolution.kind === "shared_structural_slot_path") {
        assert.equal(rule.cardinality.kind, "catalog_bounded_aggregate");
        assert.equal(rule.accessPolicy, "granted_writable");
        assert.equal(rule.locatorContract.kind, "versioned_ast_slot");
        if (rule.locatorContract.kind === "versioned_ast_slot") {
          assert.equal(
            rule.locatorContract.parserContractHash,
            TYPESCRIPT_SEMANTIC_SOURCE_PARSER_CONTRACT_HASH_V1,
          );
        }
      }
      if (rule.targetKind === "generated_source") {
        assert.equal(rule.pathResolution.kind, "generated_receipt_path");
        assert.equal(rule.locatorContract.kind, "generated_receipt");
        assert.equal(rule.accessPolicy, "generated_readonly");
        if (rule.pathResolution.kind === "generated_receipt_path") {
          assert.equal(
            rule.pathResolution.receiptSchema,
            GENERATED_SOURCE_RECEIPT_ARTIFACT_TYPE_V2,
          );
        }
        assert.equal(rule.outputPolicy.kind, "deterministic_generated");
        if (rule.outputPolicy.kind === "deterministic_generated") {
          assert.equal(
            rule.outputPolicy.generatorContractHash,
            STITCH_GENERATED_SOURCE_CONTRACT_HASH_V2,
          );
        }
      }
    }
  });

  it("covers the canonical semantic responsibilities without an active or fallback rule set", () => {
    const compiled = compiledCatalog();
    const commonResponsibilities = [
      "action_handler",
      "action_input_transport",
      "entity_model",
      "entrypoint_registration",
      "observable_projection",
      "persistence_exemption",
      "platform_command",
      "platform_registration",
      "predicate_source_binding",
      "route_registration",
      "runtime_data_fixture",
      "runtime_registration",
      "state_store",
      "surface_primary",
    ];
    for (const ruleSet of compiled.catalog.ruleSets) {
      const responsibilities = [...new Set(ruleSet.rules.map((rule) => rule.responsibility))].sort();
      const expected = [...commonResponsibilities];
      if (ruleSet.stackPackBinding.stackPackId === "node-cli") expected.push("cli_output_adapter");
      if (ruleSet.stackPackBinding.stackPackId === "node-express-api") {
        expected.push("api_response_adapter", "persistence_adapter");
      }
      if (["vite-react-web-app", "browser-game-canvas"].includes(
        ruleSet.stackPackBinding.stackPackId,
      )) {
        expected.push("control_binding", "persistence_adapter", "physical_control_binding");
      }
      assert.deepEqual(responsibilities, expected.sort());
      assert.equal(ruleSet.rules.some((rule) => rule.ruleRef.includes("FALLBACK")), false);
      assert.equal(ruleSet.readiness.status, "shadow");
    }
  });

  it("binds command and entrypoint facts while requiring exact adapter-signature resolution", () => {
    const compiled = compiledCatalog();
    for (const ruleSet of compiled.catalog.ruleSets) {
      const topology = getStackTopologyCatalogContract(ruleSet.stackPackBinding.stackPackId)!;
      const commandRule = ruleSet.rules.find((rule) => rule.responsibility === "platform_command")!;
      assert.equal(commandRule.activation.kind, "all");
      if (commandRule.activation.kind === "all") {
        const commandAtom = commandRule.activation.atoms.find((atom) => atom.kind === "command_kind");
        assert.deepEqual(
          commandAtom?.values,
          [...new Set(topology.descriptor.commands.map((command) => command.kind))].sort(),
        );
      }
      const entrypointRule = ruleSet.rules.find((rule) =>
        rule.responsibility === "entrypoint_registration")!;
      assert.equal(entrypointRule.ruleKind, "source_slot");
      if (entrypointRule.ruleKind === "source_slot"
        && entrypointRule.pathResolution.kind === "shared_structural_slot_path"
        && entrypointRule.pathResolution.pathSource.kind === "selected_entrypoint_path") {
        assert.ok(topology.descriptor.entrypointRules.some((rule) =>
          rule.entrypointKind === entrypointRule.pathResolution.pathSource.entrypointKind));
      } else {
        assert.fail("entrypoint rule did not bind a selected structural slot");
      }
      const predicateRule = ruleSet.rules.find((rule) =>
        rule.ruleKind === "predicate_relation")!;
      assert.equal(predicateRule.ruleKind, "predicate_relation");
      if (predicateRule.ruleKind === "predicate_relation") {
        assert.deepEqual(predicateRule.bindingResolution, {
          kind: "exact_evidence_adapter_support_signature",
          registryArtifactType: "setfarm.evidence-adapter-registry.v1",
          supportSignatureSchema: "setfarm.evidence-adapter-support-signature.v1",
          resolutionContractRef: "EVIDENCE_ADAPTER_EXACT_SUPPORT_SIGNATURE_V1",
        });
      }
      const actionInputRule = ruleSet.rules.find((rule) =>
        rule.responsibility === "action_input_transport")!;
      assert.equal(actionInputRule.ruleKind, "source_slot");
      if (actionInputRule.ruleKind === "source_slot") {
        const expectedTransportKind = ["vite-react-web-app", "browser-game-canvas"].includes(
          ruleSet.stackPackBinding.stackPackId,
        )
          ? "dom_action_input_transport"
          : ruleSet.stackPackBinding.stackPackId === "node-cli"
            ? "cli_invocation_input_transport"
            : "http_invocation_input_transport";
        assert.equal(actionInputRule.subjectContractResolution.kind, expectedTransportKind);
      }
      for (const sourceRule of ruleSet.rules.filter((rule) =>
        rule.ruleKind === "source_slot"
        && rule.responsibility !== "action_input_transport")) {
        assert.equal(sourceRule.ruleKind, "source_slot");
        if (sourceRule.ruleKind === "source_slot") {
          assert.equal(sourceRule.subjectContractResolution.kind, "none");
        }
      }
      const persistenceRule = ruleSet.rules.find((rule) =>
        rule.responsibility === "persistence_adapter");
      const expectedPersistenceKinds = ruleSet.stackPackBinding.stackPackId === "node-express-api"
        ? ["database", "file"]
        : ["vite-react-web-app", "browser-game-canvas"].includes(
            ruleSet.stackPackBinding.stackPackId,
          )
          ? ["local_storage"]
          : [];
      if (expectedPersistenceKinds.length === 0) {
        assert.equal(persistenceRule, undefined);
      } else {
        assert.equal(persistenceRule?.activation.kind, "all");
        if (persistenceRule?.activation.kind === "all") {
          const atom = persistenceRule.activation.atoms.find((candidate) =>
            candidate.kind === "persistence_kind");
          assert.deepEqual(atom?.values, expectedPersistenceKinds);
        }
      }
    }
  });
});

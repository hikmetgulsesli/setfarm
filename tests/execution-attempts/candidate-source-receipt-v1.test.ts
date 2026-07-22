import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  CANDIDATE_SOURCE_ABSENCE_ENTRY_V1_SCHEMA,
  CANDIDATE_SOURCE_ARTIFACT_TYPE_V1,
  CANDIDATE_SOURCE_CONTENT_ENTRY_V1_SCHEMA,
  CANDIDATE_SOURCE_CONTENT_TREE_V1_SCHEMA,
  CANDIDATE_SOURCE_RECEIPT_CONTRACT_HASH_V1,
  CANDIDATE_SOURCE_RECEIPT_V1_BLOCKER_CODES,
  CANDIDATE_SOURCE_RECEIPT_V1_SCHEMA,
  CANDIDATE_SOURCE_RECEIPT_VERSION_V1,
  CANDIDATE_SOURCE_SEMANTIC_REVISION_V1_SCHEMA,
  CandidateSourceEnvelopeV1Schema,
  CandidateSourceReceiptV1Schema,
  hashCandidateSourceAbsenceEntryV1,
  hashCandidateSourceAbsenceMembershipV1,
  hashCandidateSourceContentEntryV1,
  hashCandidateSourceContentTreeV1,
  hashCandidateSourceEntryMembershipV1,
  hashCandidateSourceReceiptV1,
  hashCandidateSourceSemanticRevisionV1,
  recursivelyFreezeCandidateSourceReceiptV1,
  type CandidateSourceAbsenceEntryHashPayloadV1,
  type CandidateSourceContentEntryHashPayloadV1,
  type CandidateSourceContentEntryV1,
  type CandidateSourceContentTreeHashPayloadV1,
  type CandidateSourceEnvelopeV1,
  type CandidateSourceReceiptHashPayloadV1,
  type CandidateSourceReceiptV1,
  type CandidateSourceSemanticRevisionHashPayloadV1,
} from "../../src/execution/schemas/candidate-source-receipt-v1.js";
import { deriveFileTreePathRefV3 } from
  "../../src/product-compiler/schemas/file-tree-manifest-v3.js";

const CONTRACT_HASH_GOLDEN =
  "4eef53d4e352264e433599fe6e6f02b56e4a6322ce29e4d371d3f62b3a48d9b7";

function sha(label: string): string {
  return createHash("sha256").update(label).digest("hex");
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function entry(
  role: CandidateSourceContentEntryHashPayloadV1["role"],
  locator: CandidateSourceContentEntryHashPayloadV1["normalizedLocator"],
  ownerRef: CandidateSourceContentEntryHashPayloadV1["ownerRef"],
): CandidateSourceContentEntryV1 {
  const source = role === "runtime_source" || role === "test_source";
  const identity: CandidateSourceContentEntryHashPayloadV1 = {
    schema: CANDIDATE_SOURCE_CONTENT_ENTRY_V1_SCHEMA,
    role,
    pathRef: deriveFileTreePathRefV3("repository", locator),
    ownerRef,
    normalizedLocator: locator,
    mediaType: source ? "text/typescript" : "application/json",
    mode: "0444",
    contentHash: sha(`content:${locator}`),
    byteLength: 100 + locator.length,
    sourceIdentityHash: source ? sha(`source:${locator}`) : null,
  };
  return { ...identity, entryHash: hashCandidateSourceContentEntryV1(identity) };
}

function createReceipt(physicalLabel = "attempt-a"): CandidateSourceReceiptV1 {
  const entries = [
    entry("dependency_lock_manifest", "package-lock.json", "OWNER_SETUP_V3"),
    entry("package_manifest", "package.json", "OWNER_SETUP_V3"),
    entry(
      "test_source",
      "src/cli.setfarm.test.ts",
      "OWNER_NODE_PRODUCT_TEST_GENERATOR_V2",
    ),
    entry("runtime_source", "src/cli.ts", "OWNER_NODE_PRODUCT_RUNTIME_GENERATOR_V2"),
    entry("typescript_compiler_config", "tsconfig.json", "OWNER_SETUP_V3"),
  ];
  const absenceIdentity: CandidateSourceAbsenceEntryHashPayloadV1 = {
    schema: CANDIDATE_SOURCE_ABSENCE_ENTRY_V1_SCHEMA,
    role: "project_npmrc",
    pathRef: deriveFileTreePathRefV3("repository", ".npmrc"),
    ownerRef: "OWNER_SETUP_V3",
    normalizedLocator: ".npmrc",
    absenceHash: sha("npmrc-absence"),
  };
  const absences = [{
    ...absenceIdentity,
    entryHash: hashCandidateSourceAbsenceEntryV1(absenceIdentity),
  }] as const;
  const treeIdentity: CandidateSourceContentTreeHashPayloadV1 = {
    schema: CANDIDATE_SOURCE_CONTENT_TREE_V1_SCHEMA,
    profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
    logicalRoot: "repository",
    entryCount: 5,
    entries,
    entryMembershipHash: hashCandidateSourceEntryMembershipV1(entries),
    absenceCount: 1,
    absences,
    absenceMembershipHash: hashCandidateSourceAbsenceMembershipV1(absences),
  };
  const contentTree = {
    ...treeIdentity,
    contentTreeHash: hashCandidateSourceContentTreeV1(treeIdentity),
  };
  const runtime = entries.find((item) => item.role === "runtime_source")!;
  const test = entries.find((item) => item.role === "test_source")!;
  const revisionIdentity: CandidateSourceSemanticRevisionHashPayloadV1 = {
    schema: CANDIDATE_SOURCE_SEMANTIC_REVISION_V1_SCHEMA,
    revisionVersion: CANDIDATE_SOURCE_RECEIPT_VERSION_V1,
    origin: "generated_private_materialization_v1",
    authority: {
      productRef: "PROD_CANDIDATE_SOURCE_TEST",
      profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
      packet: {
        envelopeHash: sha("packet-envelope"),
        packetHash: sha("packet"),
      },
      implementationClosure: {
        artifactType: "setfarm.implementation-closure.v2",
        schema: "setfarm.implementation-closure.v2",
        version: "2.0.0",
        envelopeHash: sha("implementation-closure-envelope"),
        closureHash: sha("implementation-closure"),
        producerCodeSha: "a".repeat(40),
        storyCount: 3,
        storyIdSetHash: sha("story-id-set"),
        storyMembershipHash: sha("story-membership"),
        dispositionHash: sha("product-disposition"),
        implementationMode: "generated_sources_complete_no_model_dispatch",
        modelDispatch: "forbidden",
      },
      fileTree: {
        schema: "setfarm.file-tree-manifest.v3",
        manifestHash: sha("file-tree"),
        pathMembershipHash: sha("file-tree-paths"),
      },
      buildTopology: {
        schema: "setfarm.build-topology.v3",
        version: "3.2.0",
        logicalBuildHash: sha("logical-build"),
        commandContractHash: sha("command-contract"),
        compilationContractHash: sha("compilation-contract"),
      },
      runtimeSource: {
        schema: "setfarm.node-product-runtime-source-receipt.v2",
        logicalReceiptHash: sha("runtime-logical"),
        sourceIdentityHash: runtime.sourceIdentityHash!,
        contentHash: runtime.contentHash,
      },
      testSource: {
        schema: "setfarm.node-product-test-source-receipt.v2",
        logicalReceiptHash: sha("test-logical"),
        sourceIdentityHash: test.sourceIdentityHash!,
        contentHash: test.contentHash,
      },
    },
    contentTree,
  };
  const semanticRevision = {
    ...revisionIdentity,
    revisionHash: hashCandidateSourceSemanticRevisionV1(revisionIdentity),
  };
  const receiptIdentity: CandidateSourceReceiptHashPayloadV1 = {
    schema: CANDIDATE_SOURCE_RECEIPT_V1_SCHEMA,
    receiptVersion: CANDIDATE_SOURCE_RECEIPT_VERSION_V1,
    contractHash: CANDIDATE_SOURCE_RECEIPT_CONTRACT_HASH_V1,
    stage: "final_generated_source_verified_before_private_build",
    readiness: {
      status: "verified_private_shadow",
      productionUse: "forbidden",
      blockerCodes: [...CANDIDATE_SOURCE_RECEIPT_V1_BLOCKER_CODES],
    },
    semanticRevision,
    materialization: {
      admissionScope: "test_fixture",
      pathDisclosure: "forbidden",
      sourceMaterialization: {
        schema: "setfarm.node-product-source-materialization-receipt.v1",
        receiptHash: sha(`materialization:${physicalLabel}`),
        sourceMembershipHash: sha("source-membership"),
        sourceDirectoryPhysicalIdentityHash: sha(`source-dir:${physicalLabel}`),
        privateRootIdentityHash: sha(`private-root:${physicalLabel}`),
      },
      scaffoldBase: {
        schema: "setfarm.scaffold-base-materialization-receipt.v2",
        receiptHash: sha(`scaffold:${physicalLabel}`),
        semanticInputHash: sha("scaffold-semantic"),
      },
      dependency: {
        schema: "setfarm.build-dependency-materialization-receipt.v2",
        receiptHash: sha(`dependency:${physicalLabel}`),
        dependencyIdentityHash: sha("dependency-identity"),
      },
      publicationReceiptSetCommitmentHash: sha("publication-set"),
      sourceCount: 2,
      sources: [
        {
          sourceRole: "runtime",
          sourceReceiptHash: sha("runtime-receipt"),
          sourceCasVerificationReceiptHash: sha("runtime-cas"),
          publicationReceiptHash: sha("runtime-publication"),
          publicationCasVerificationReceiptHash: sha("runtime-publication-cas"),
          deepVerificationReceiptHash: sha("runtime-deep"),
          consumerBindingHash: sha("runtime-consumer"),
        },
        {
          sourceRole: "test",
          sourceReceiptHash: sha("test-receipt"),
          sourceCasVerificationReceiptHash: sha("test-cas"),
          publicationReceiptHash: sha("test-publication"),
          publicationCasVerificationReceiptHash: sha("test-publication-cas"),
          deepVerificationReceiptHash: sha("test-deep"),
          consumerBindingHash: sha("test-consumer"),
        },
      ],
    },
  };
  return CandidateSourceReceiptV1Schema.parse({
    ...receiptIdentity,
    receiptHash: hashCandidateSourceReceiptV1(receiptIdentity),
  });
}

function createEnvelope(receipt = createReceipt()): CandidateSourceEnvelopeV1 {
  return CandidateSourceEnvelopeV1Schema.parse({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType: CANDIDATE_SOURCE_ARTIFACT_TYPE_V1,
    producer: {
      pass: "candidate-source-authority-v1",
      codeSha: receipt.semanticRevision.authority.implementationClosure
        .producerCodeSha,
      toolVersions: {
        candidateSource: CANDIDATE_SOURCE_RECEIPT_VERSION_V1,
        implementationClosure: "2.0.0",
      },
    },
    payload: receipt,
  });
}

describe("CandidateSourceReceiptV1 schema authority", () => {
  it("pins one strict content-first source contract", () => {
    assert.equal(CANDIDATE_SOURCE_RECEIPT_CONTRACT_HASH_V1, CONTRACT_HASH_GOLDEN);
    const receipt = createReceipt();
    assert.equal(receipt.semanticRevision.contentTree.entryCount, 5);
    assert.equal(receipt.semanticRevision.contentTree.absenceCount, 1);
    assert.equal(receipt.semanticRevision.contentTree.absences[0].normalizedLocator, ".npmrc");
    assert.equal(
      receipt.semanticRevision.authority.implementationClosure.storyCount,
      3,
    );
    assert.equal(JSON.stringify(receipt).includes("storyProofHash"), false);
    assert.equal(CandidateSourceEnvelopeV1Schema.safeParse(createEnvelope()).success, true);
  });

  it("keeps retry identity stable while physical attempt evidence changes", () => {
    const first = createReceipt("attempt-a");
    const second = createReceipt("attempt-b");
    assert.equal(
      first.semanticRevision.contentTree.contentTreeHash,
      second.semanticRevision.contentTree.contentTreeHash,
    );
    assert.equal(first.semanticRevision.revisionHash, second.semanticRevision.revisionHash);
    assert.notEqual(first.receiptHash, second.receiptHash);
  });

  it("rejects role reordering, Git placeholders, extra fields and producer drift", () => {
    const receipt = createReceipt();
    const reordered = clone(receipt) as unknown as Record<string, unknown>;
    const revision = (reordered.semanticRevision as Record<string, unknown>);
    const tree = revision.contentTree as Record<string, unknown>;
    (tree.entries as unknown[]).reverse();
    assert.equal(CandidateSourceReceiptV1Schema.safeParse(reordered).success, false);

    const git = clone(receipt) as unknown as Record<string, unknown>;
    (git.semanticRevision as Record<string, unknown>).sourceRevision = {
      sha: "a".repeat(40),
      treeHash: "b".repeat(40),
    };
    assert.equal(CandidateSourceReceiptV1Schema.safeParse(git).success, false);

    const extra = { ...clone(receipt), recoveryInstruction: "retry" };
    assert.equal(CandidateSourceReceiptV1Schema.safeParse(extra).success, false);

    const envelope = clone(createEnvelope());
    envelope.producer.codeSha = "b".repeat(40);
    assert.equal(CandidateSourceEnvelopeV1Schema.safeParse(envelope).success, false);
  });

  it("rejects self-rehashed content that breaks exact semantic source joins", () => {
    const receipt = clone(createReceipt());
    const runtime = receipt.semanticRevision.contentTree.entries.find(
      (item) => item.role === "runtime_source",
    )!;
    runtime.contentHash = sha("forged-runtime");
    runtime.entryHash = hashCandidateSourceContentEntryV1(runtime);
    receipt.semanticRevision.contentTree.entryMembershipHash =
      hashCandidateSourceEntryMembershipV1(receipt.semanticRevision.contentTree.entries);
    receipt.semanticRevision.contentTree.contentTreeHash =
      hashCandidateSourceContentTreeV1(receipt.semanticRevision.contentTree);
    receipt.semanticRevision.revisionHash =
      hashCandidateSourceSemanticRevisionV1(receipt.semanticRevision);
    receipt.receiptHash = hashCandidateSourceReceiptV1(receipt);
    assert.equal(CandidateSourceReceiptV1Schema.safeParse(receipt).success, false);

    const pathDrift = clone(createReceipt());
    const test = pathDrift.semanticRevision.contentTree.entries.find(
      (item) => item.role === "test_source",
    )!;
    test.pathRef = `PATH_${sha("wrong-test-path").toUpperCase()}`;
    test.entryHash = hashCandidateSourceContentEntryV1(test);
    pathDrift.semanticRevision.contentTree.entryMembershipHash =
      hashCandidateSourceEntryMembershipV1(
        pathDrift.semanticRevision.contentTree.entries,
      );
    pathDrift.semanticRevision.contentTree.contentTreeHash =
      hashCandidateSourceContentTreeV1(pathDrift.semanticRevision.contentTree);
    pathDrift.semanticRevision.revisionHash =
      hashCandidateSourceSemanticRevisionV1(pathDrift.semanticRevision);
    pathDrift.receiptHash = hashCandidateSourceReceiptV1(pathDrift);
    assert.equal(CandidateSourceReceiptV1Schema.safeParse(pathDrift).success, false);
  });

  it("returns recursively immutable schema output when sealed", () => {
    const receipt = recursivelyFreezeCandidateSourceReceiptV1(createReceipt());
    const pending: unknown[] = [receipt];
    while (pending.length > 0) {
      const current = pending.pop();
      if (current === null || typeof current !== "object") continue;
      assert.equal(Object.isFrozen(current), true);
      pending.push(...Object.values(current));
    }
  });
});

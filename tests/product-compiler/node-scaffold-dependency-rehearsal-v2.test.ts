import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  NODE_SCAFFOLD_DEPENDENCY_REHEARSAL_AUTHORITY_REF_V2,
  NODE_SCAFFOLD_DEPENDENCY_REHEARSAL_RECEIPT_V2_SCHEMA,
  NODE_SCAFFOLD_DEPENDENCY_REHEARSAL_VERSION_V2,
  NodeScaffoldDependencyRehearsalReceiptV2Schema,
  hashNodeScaffoldDependencyRehearsalReceiptV2,
  type NodeScaffoldDependencyRehearsalReceiptHashPayloadV2,
} from "../../src/product-compiler/schemas/node-scaffold-dependency-rehearsal-v2.js";

const HASH = "a".repeat(64);

function identity(): NodeScaffoldDependencyRehearsalReceiptHashPayloadV2 {
  const common = {
    graphHash: HASH,
    hostToolchainReceiptHash: HASH,
    environmentReceiptHash: HASH,
    effectiveConfigHash: HASH,
    scaffoldBaseReceiptHash: HASH,
    scaffoldSemanticInputHash: HASH,
    dependencyReceiptHash: HASH,
    dependencyIdentityHash: HASH,
    install: {
      projectScopeHash: HASH,
      stdoutHash: HASH,
      stdoutBytes: 24,
      stderrHash: HASH,
      stderrBytes: 0,
    },
    rawInstall: {
      fileCount: 10,
      directoryCount: 5,
      symbolicLinkCount: 2,
      totalBytes: 10_000,
      membershipHash: HASH,
    },
    installedBinCount: 2,
    capsule: {
      treeHash: HASH,
      payloadHash: HASH,
      fileCount: 9,
      directoryCount: 4,
      totalBytes: 9_000,
      metadataProbe: "code_owned_darwin_acl_nonprovenance_xattr_probe_v2" as const,
      metadataNormalization:
        "code_owned_darwin_writable_copy_acl_xattr_clear_provenance_exclusion_readonly_seal_fsync_v2" as const,
      hostMetadataExclusion:
        "com.apple.provenance_only_not_in_canonical_tree_v2" as const,
    },
    revalidationReceiptHash: HASH,
    cleanup: {
      stageRoot: "absent_after_authenticated_destroy" as const,
      environmentRoot: "absent_after_authenticated_destroy" as const,
    },
  };
  return {
    schema: NODE_SCAFFOLD_DEPENDENCY_REHEARSAL_RECEIPT_V2_SCHEMA,
    receiptVersion: NODE_SCAFFOLD_DEPENDENCY_REHEARSAL_VERSION_V2,
    authorityRef: NODE_SCAFFOLD_DEPENDENCY_REHEARSAL_AUTHORITY_REF_V2,
    status: "rehearsal_passed",
    admissionScope: "test_fixture",
    architecture: "arm64",
    officialSource: {
      manifestHash: HASH,
      artifactHash: HASH,
      verificationReceiptHash: HASH,
      archiveSha256: HASH,
      archiveByteLength: 25_962_500,
    },
    provisioning: {
      receiptHash: HASH,
      treeHash: HASH,
      targetRef: "SETFARM_ROOT_NODE_22_23_1_NPM_10_9_8_ARM64_V2",
    },
    profiles: [{
      ...common,
      profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
      entryRef: "NODE_SCAFFOLD_TOOLCHAIN_NODE_CLI_V2",
      entryHash: HASH,
      nodeCount: 3,
      edgeCount: 3,
    }, {
      ...common,
      profileId: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
      entryRef: "NODE_SCAFFOLD_TOOLCHAIN_NODE_EXPRESS_API_V2",
      entryHash: HASH,
      nodeCount: 79,
      edgeCount: 141,
    }],
    finalState: {
      rehearsalRoot: "removed_exactly",
      productionToolchainRoot: "untouched",
      profileCount: 2,
    },
  };
}

describe("Node scaffold dependency rehearsal V2 receipt", () => {
  it("binds exact profile replay, ordering and disclosed host metadata exclusion", () => {
    const payload = identity();
    const receipt = {
      ...payload,
      receiptHash: hashNodeScaffoldDependencyRehearsalReceiptV2(payload),
    };
    assert.equal(
      NodeScaffoldDependencyRehearsalReceiptV2Schema.parse(receipt).receiptHash,
      receipt.receiptHash,
    );

    const mismatchedReplay = {
      ...payload,
      profiles: [
        { ...payload.profiles[0], revalidationReceiptHash: "b".repeat(64) },
        payload.profiles[1],
      ],
    };
    assert.equal(NodeScaffoldDependencyRehearsalReceiptV2Schema.safeParse({
      ...mismatchedReplay,
      receiptHash: hashNodeScaffoldDependencyRehearsalReceiptV2(
        mismatchedReplay as NodeScaffoldDependencyRehearsalReceiptHashPayloadV2,
      ),
    }).success, false);

    const reversedProfiles = {
      ...payload,
      profiles: [payload.profiles[1], payload.profiles[0]],
    };
    assert.equal(NodeScaffoldDependencyRehearsalReceiptV2Schema.safeParse({
      ...reversedProfiles,
      receiptHash: hashNodeScaffoldDependencyRehearsalReceiptV2(
        reversedProfiles as NodeScaffoldDependencyRehearsalReceiptHashPayloadV2,
      ),
    }).success, false);

    assert.equal(NodeScaffoldDependencyRehearsalReceiptV2Schema.safeParse({
      ...receipt,
      profiles: [{
        ...receipt.profiles[0],
        capsule: {
          ...receipt.profiles[0].capsule,
          hostMetadataExclusion: "undisclosed",
        },
      }, receipt.profiles[1]],
    }).success, false);
  });
});

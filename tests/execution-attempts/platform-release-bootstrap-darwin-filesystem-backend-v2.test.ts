import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_AUTHORITY_REF_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_BLOCKER_CODES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_CAPABILITY_RECEIPT_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_FIXED_OPERAND_CATALOG_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_FIXED_OPERAND_REFS_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_MEMBER_BINDINGS_PER_FRAME_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_NO_REPLACE_MAPPINGS_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_OPERATION_REFS_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_REQUEST_FRAME_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_SUCCESS_FRAME_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_WIRE_CONTRACT_CATALOG_V2,
  getPlatformReleaseBootstrapDarwinFilesystemBackendAbiSetV2,
  hashPlatformReleaseBootstrapDarwinFilesystemBackendAbiSetV2,
  hashPlatformReleaseBootstrapDarwinCapabilityProofBindingV2,
  hashPlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptV2,
  hashPlatformReleaseBootstrapDarwinExpectedAbsenceV2,
  hashPlatformReleaseBootstrapDarwinFilesystemBackendOperationSetV2,
  hashPlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameV2,
  hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2,
  hashPlatformReleaseBootstrapDarwinFilesystemBackendWireContractCatalogV2,
  hashPlatformReleaseBootstrapDarwinDistributionCatalogBindingV2,
  hashPlatformReleaseBootstrapDarwinSelfAttestationBindingV2,
  hashPlatformReleaseBootstrapDarwinSessionBindingV2,
  parsePlatformReleaseBootstrapDarwinFilesystemBackendAbiSetCandidateV2,
  parsePlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptCandidateV2,
  parsePlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameCandidateV2,
  parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2,
  parsePlatformReleaseBootstrapDarwinFilesystemBackendWireContractCatalogCandidateV2,
} from "../../src/execution/schemas/platform-release-bootstrap-darwin-filesystem-backend-v2.js";
import { PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2 } from "../../src/execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_PRODUCTION_ERROR_CODE_V2,
  PlatformReleaseBootstrapDarwinFilesystemBackendAuthorityErrorV2,
  PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityV2,
  inspectPlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptV2,
  openProductionAuthenticatedDarwinFilesystemBackendV2,
} from "../../src/execution/platform-release-bootstrap-darwin-filesystem-backend-authority-v2.js";
import { PLATFORM_RELEASE_COMPONENT_VERSION_V2 } from "../../src/execution/schemas/platform-release-common-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_PRODUCTION_ERROR_CODE_V2,
  activatePlatformReleaseBootstrapRegistryProductionV2,
} from "../../src/product-compiler/platform-release-bootstrap-registry-activation-v2.js";
import {
  buildBootstrapFilesystemScopeIdentityV2,
  buildDirectoryMembershipIdentityV2,
  buildFsObservationFingerprintV2,
  buildStableFsObjectIdentityV2,
} from "../../src/product-compiler/platform-release-bootstrap-physical-census-v2.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_CAPTURE_CHUNK_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_CAPTURE_PAGE_V2_SCHEMA,
} from "../../src/execution/schemas/platform-release-bootstrap-darwin-capture-transcripts-v2.js";

function hashV2(label: string): string {
  return createHash("sha256").update(label).digest("hex");
}

function validReceiptCandidateV2() {
  const evidence = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_CAPABILITY_RECEIPT_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    authorityRef:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_AUTHORITY_REF_V2,
    admissionScope: "production_host",
    productionUse:
      "live_private_capability_required_serialized_receipt_is_not_authority_v2",
    backendAbiHash:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.backendAbiHash,
    registryContractHash: PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash,
    platform: "darwin",
    architecture: "arm64",
    hostIdentityHash: hashV2("host"),
    nativeDistributionReceiptHash: hashV2("distribution"),
    signedCatalogEntryHash: hashV2("catalog"),
    distributionEpoch: 1,
    distributionEpochFloor: 1,
    distributionEpochFloorStateHash: hashV2("floor"),
    executableContentHash: hashV2("content"),
    executablePhysicalIdentityHash: hashV2("physical"),
    buildAttestationHash: hashV2("build"),
    designatedRequirementHash: hashV2("requirement"),
    developerTeamIdentityHash: hashV2("team"),
    codeDirectoryHash: hashV2("code-directory"),
    hardenedRuntimePolicyHash: hashV2("hardened-runtime"),
    libraryValidationPolicyHash: hashV2("library-validation"),
    selfAttestationChallengeHash: hashV2("challenge"),
    selfAttestationReceiptHash: hashV2("self-attestation"),
    nativeSyscallSupportReceiptHash: hashV2("syscalls"),
    allComponentResolutionProofHash: hashV2("resolution"),
    conditionalReplaceProofHash: hashV2("conditional-replace"),
    directoryDurabilityProofHash: hashV2("directory-durability"),
    supportedOperationSetHash:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.operationSetHash,
    sessionOccurrenceHash: hashV2("session"),
    transcriptHash: hashV2("transcript"),
  } as const;
  const catalogEvidence = {
    ...evidence,
    distributionCatalogBindingHash:
      hashPlatformReleaseBootstrapDarwinDistributionCatalogBindingV2(evidence),
  } as const;
  const selfAttestedEvidence = {
    ...catalogEvidence,
    selfAttestationBindingHash:
      hashPlatformReleaseBootstrapDarwinSelfAttestationBindingV2(
        catalogEvidence,
      ),
  } as const;
  const joinedEvidence = {
    ...selfAttestedEvidence,
    capabilityProofBindingHash:
      hashPlatformReleaseBootstrapDarwinCapabilityProofBindingV2(
        selfAttestedEvidence,
      ),
  } as const;
  const identity = {
    ...joinedEvidence,
    sessionLifecycle: "open_fresh",
    initialSequence: 0,
    sessionBindingHash: hashPlatformReleaseBootstrapDarwinSessionBindingV2({
      ...joinedEvidence,
      sessionLifecycle: "open_fresh",
      initialSequence: 0,
    }),
  } as const;
  return {
    ...identity,
    receiptHash:
      hashPlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptV2(
        identity,
      ),
  };
}

function publicFieldNamesV2(value: unknown): string[] {
  const names: string[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    Object.entries(node).forEach(([key, child]) => {
      names.push(key);
      visit(child);
    });
  };
  visit(value);
  return names;
}

async function expectAuthorityCodeV2(
  action: () => Promise<unknown> | unknown,
  code:
    | "DARWIN_FILESYSTEM_BACKEND_UNAVAILABLE"
    | "DARWIN_FILESYSTEM_BACKEND_HANDLE_UNAUTHENTICATED",
): Promise<void> {
  await assert.rejects(
    async () => action(),
    (error: unknown) => {
      assert.ok(
        error instanceof
          PlatformReleaseBootstrapDarwinFilesystemBackendAuthorityErrorV2,
      );
      assert.equal(error.code, code);
      return true;
    },
  );
}

describe("platform release bootstrap Darwin filesystem backend v2", () => {
  it("freezes one exact ordered self-hashed semantic ABI without raw filesystem operands", () => {
    const abi = getPlatformReleaseBootstrapDarwinFilesystemBackendAbiSetV2();
    assert.deepEqual(
      abi,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2,
    );
    assert.notEqual(
      abi,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2,
    );
    assert.equal(Object.isFrozen(abi), true);
    assert.equal(Object.isFrozen(abi.operations), true);
    assert.deepEqual(
      abi.operations.map((operation) => operation.operationRef),
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_OPERATION_REFS_V2,
    );
    assert.deepEqual(
      abi.fixedOperandRefs,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_FIXED_OPERAND_REFS_V2,
    );
    assert.deepEqual(
      abi.fixedOperandCatalog,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_FIXED_OPERAND_CATALOG_V2,
    );
    assert.deepEqual(
      abi.noReplacePublicationMappings,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_NO_REPLACE_MAPPINGS_V2,
    );
    assert.deepEqual(
      abi.blockerCodes,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_BLOCKER_CODES_V2,
    );
    assert.equal(
      abi.operationSetHash,
      hashPlatformReleaseBootstrapDarwinFilesystemBackendOperationSetV2(
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_OPERATION_REFS_V2,
      ),
    );
    assert.equal(
      abi.backendAbiHash,
      hashPlatformReleaseBootstrapDarwinFilesystemBackendAbiSetV2(abi),
    );
    assert.equal(
      abi.atomicReplacePolicy,
      "expected_prior_identity_or_no_mutation_semantic_required_v2",
    );
    assert.equal(
      abi.renameSwapPolicy,
      "forbidden_unmodeled_fourth_crash_state_v2",
    );
    for (const operation of abi.operations) {
      assert.ok(operation.requestFields.length > 0);
      assert.ok(operation.resultFields.length > 0);
      assert.ok(operation.errorCodes.length > 0);
      assert.match(operation.preconditionPolicy, /_v2$/);
      assert.match(operation.slotTransitionPolicy, /_v2$/);
      assert.match(operation.postconditionPolicy, /_v2$/);
    }
    const operationByRef = new Map(
      abi.operations.map((operation) => [operation.operationRef, operation]),
    );
    assert.deepEqual(
      operationByRef
        .get("SELF_ATTEST_AND_OPEN_FIXED_BOOTSTRAP_SESSION_V2")
        ?.resultFields.map((field) => field.name),
      [
        "sessionSlot",
        "attestationReceiptHash",
        "bootstrapParentSlot",
        "bootstrapParentIdentity",
        "bootstrapParentFingerprint",
        "filesystemScopeSlot",
        "filesystemScopeIdentity",
        "filesystemScopeContentHash",
      ],
    );
    assert.equal(
      abi.maxMemberBindingsPerFrame,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_MEMBER_BINDINGS_PER_FRAME_V2,
    );
    assert.equal(
      abi.captureTranscriptContractHash,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2.captureTranscriptContractHash,
    );
    assert.deepEqual(
      abi.captureTranscriptSchemas,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_WIRE_CONTRACT_CATALOG_V2.captureTranscriptSchemas,
    );
    assert.equal(
      abi.captureTranscriptSchemas.directoryPage,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_CAPTURE_PAGE_V2_SCHEMA,
    );
    assert.equal(
      abi.captureTranscriptSchemas.contentChunk,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_CAPTURE_CHUNK_V2_SCHEMA,
    );
    assert.equal(abi.captureTranscriptCaps.maxDirectoryTotalBindings, 16_384);
    assert.equal(abi.captureTranscriptCaps.maxContentTotalRawBytes, 1024 * 1024);
    assert.ok(
      abi.blockerCodes.includes("PAGINATED_CAPTURE_LIVE_LEDGER_UNAVAILABLE"),
    );
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_WIRE_CONTRACT_CATALOG_V2.fieldKindBindings.find(
        (binding) => binding.fieldKind === "filesystem_scope_identity",
      )?.dtoSchemaRef,
      "setfarm.platform-release-bootstrap-filesystem-scope-identity.v2",
    );
    assert.deepEqual(
      operationByRef
        .get("CAPTURE_DIRECTORY_EVERY_ONLY_TWICE_V2")
        ?.resultFields.map((field) => field.name),
      [
        "directoryIdentity",
        "directoryFingerprint",
        "firstMembership",
        "secondMembership",
        "memberBindings",
      ],
    );
    assert.deepEqual(
      operationByRef
        .get("CAPTURE_EXACT_ENTRY_TWICE_V2")
        ?.resultFields.map((field) => field.name),
      [
        "entrySlot",
        "entryIdentity",
        "entryFingerprint",
        "contentEvidence",
      ],
    );
    assert.deepEqual(
      operationByRef.get("CAPTURE_DIRECTORY_EVERY_ONLY_TWICE_V2")
        ?.allowedOperandRefs,
      [],
    );
    assert.deepEqual(
      operationByRef.get("CAPTURE_EXACT_ENTRY_TWICE_V2")?.allowedOperandRefs,
      [],
    );
    assert.deepEqual(
      operationByRef
        .get("UNLINK_EXACT_OBSERVED_ENTRY_V2")
        ?.allowedOperandRefs.slice(-2),
      ["ACTIVATION_CLAIM_V2", "EPOCH_CLAIM_V2"],
    );
    assert.deepEqual(
      operationByRef
        .get("LINK_FIXED_STAGED_FILE_NO_REPLACE_V2")
        ?.requestFields.slice(-3)
        .map((field) => field.name),
      [
        "expectedSourceFingerprint",
        "expectedSourceContentHash",
        "expectedTargetAbsence",
      ],
    );
    assert.deepEqual(
      operationByRef
        .get("RENAME_EPOCH_TARGET_OVER_EXACT_PRIOR_V2")
        ?.requestFields.slice(-4)
        .map((field) => field.name),
      [
        "expectedSourceContentHash",
        "expectedPriorIdentity",
        "expectedPriorFingerprint",
        "expectedPriorContentHash",
      ],
    );
    assert.deepEqual(
      parsePlatformReleaseBootstrapDarwinFilesystemBackendAbiSetCandidateV2(
        structuredClone(abi),
      ),
      abi,
    );
    const forbiddenPublicField =
      /(?:path|locator|fd|descriptor|argv|env|cwd|command|callback|flags)/i;
    assert.deepEqual(
      publicFieldNamesV2(abi).filter((field) =>
        forbiddenPublicField.test(field),
      ),
      [],
    );
  });

  it("rejects reordered, extended, rehashed, proxied, accessor, and cyclic ABI candidates", () => {
    const mutated = structuredClone(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2,
    ) as unknown as Record<string, unknown>;
    mutated.atomicReplacePolicy = "renameatx_np_is_sufficient_v2";
    mutated.backendAbiHash =
      hashPlatformReleaseBootstrapDarwinFilesystemBackendAbiSetV2(mutated);
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendAbiSetCandidateV2(
        mutated,
      ),
    );

    const operationMutated = structuredClone(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2,
    ) as unknown as {
      operations: Array<{ postconditionPolicy: string }>;
      backendAbiHash: string;
    };
    operationMutated.operations[0]!.postconditionPolicy =
      "attacker_weakened_postcondition_v2";
    operationMutated.backendAbiHash =
      hashPlatformReleaseBootstrapDarwinFilesystemBackendAbiSetV2(
        operationMutated as unknown as Record<string, unknown>,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendAbiSetCandidateV2(
        operationMutated,
      ),
    );

    const reordered = structuredClone(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2,
    ) as unknown as {
      operations: unknown[];
      operationSetHash: string;
      backendAbiHash: string;
    };
    reordered.operations.reverse();
    reordered.operationSetHash =
      hashPlatformReleaseBootstrapDarwinFilesystemBackendOperationSetV2(
        reordered.operations.map(
          (operation) => (operation as { operationRef: string }).operationRef,
        ),
      );
    reordered.backendAbiHash =
      hashPlatformReleaseBootstrapDarwinFilesystemBackendAbiSetV2(
        reordered as unknown as Record<string, unknown>,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendAbiSetCandidateV2(
        reordered,
      ),
    );

    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendAbiSetCandidateV2({
        ...structuredClone(
          PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2,
        ),
        extra: true,
      }),
    );

    let accessorReads = 0;
    const accessor = Object.defineProperty({}, "schema", {
      enumerable: true,
      get: () => {
        accessorReads += 1;
        return "unreachable";
      },
    });
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendAbiSetCandidateV2(
        accessor,
      ),
    );
    assert.equal(accessorReads, 0);

    let proxyReads = 0;
    const proxy = new Proxy(
      {},
      {
        get: () => {
          proxyReads += 1;
          return undefined;
        },
      },
    );
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendAbiSetCandidateV2(
        proxy,
      ),
    );
    assert.equal(proxyReads, 0);

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendAbiSetCandidateV2(
        cyclic,
      ),
    );
  });

  it("parses exact bounded request, success, and closed failure wire frames", () => {
    const operation =
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.operations.find(
        (candidate) =>
          candidate.operationRef === "GENERATE_FILESYSTEM_SCOPE_NONCE_V2",
      )!;
    const requestIdentity = {
      schema:
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_REQUEST_FRAME_V2_SCHEMA,
      version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
      backendAbiHash:
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.backendAbiHash,
      sessionOccurrenceHash: hashV2("wire-session"),
      operationRef: operation.operationRef,
      operationSchemaRef: operation.requestSchemaRef,
      sequence: 1,
      payload: {
        sessionSlot: `slot_${hashV2("wire-slot")}`,
        sequence: 1,
      },
    } as const;
    const request = {
      ...requestIdentity,
      requestHash:
        hashPlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameV2(
          requestIdentity,
        ),
    };
    assert.deepEqual(
      parsePlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameCandidateV2(
        request,
      ),
      request,
    );

    const successIdentity = {
      schema:
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_SUCCESS_FRAME_V2_SCHEMA,
      version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
      backendAbiHash:
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.backendAbiHash,
      sessionOccurrenceHash: request.sessionOccurrenceHash,
      operationRef: operation.operationRef,
      operationSchemaRef: operation.successSchemaRef,
      sequence: request.sequence,
      requestHash: request.requestHash,
      status: "success",
      payload: {
        scopeNonce: hashV2("wire-scope-nonce"),
      },
      transcriptHash: hashV2("wire-transcript"),
    } as const;
    const success = {
      ...successIdentity,
      responseHash:
        hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
          successIdentity,
        ),
    };
    assert.deepEqual(
      parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2(
        success,
        request,
      ),
      success,
    );

    const badSequence = structuredClone(request);
    badSequence.payload.sequence = 2;
    badSequence.requestHash =
      hashPlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameV2(
        badSequence,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameCandidateV2(
        badSequence,
      ),
    );

    const scope = buildBootstrapFilesystemScopeIdentityV2({
      scopeNonce: hashV2("wire-physical-scope"),
    });
    const directoryIdentity = buildStableFsObjectIdentityV2({
      filesystemScope: scope,
      objectKind: "directory",
      device: "7",
      inode: "11",
    });
    const directoryFingerprint = buildFsObservationFingerprintV2({
      objectIdentity: directoryIdentity,
      ownerUid: 0,
      ownerGid: 0,
      mode: "0755",
      linkCount: 1,
      byteLength: 512,
      modifiedTimeNanoseconds: "100",
      changedTimeNanoseconds: "101",
    });
    const captureOperation =
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.operations.find(
        (candidate) =>
          candidate.operationRef === "CAPTURE_DIRECTORY_EVERY_ONLY_TWICE_V2",
      )!;
    const confusedPhysicalRequestIdentity = {
      ...requestIdentity,
      operationRef: captureOperation.operationRef,
      operationSchemaRef: captureOperation.requestSchemaRef,
      sequence: 2,
      payload: {
        sessionSlot: request.payload.sessionSlot,
        sequence: 2,
        directorySlot: `slot_${hashV2("directory-slot")}`,
        expectedIdentity: directoryFingerprint,
      },
    } as const;
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameCandidateV2(
        {
          ...confusedPhysicalRequestIdentity,
          requestHash:
            hashPlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameV2(
              confusedPhysicalRequestIdentity,
            ),
        },
      ),
    );

    const boundDirectoryIdentity = buildStableFsObjectIdentityV2({
      filesystemScope: scope,
      objectKind: "directory",
      device: "7",
      inode: "20",
    });
    const boundFileIdentity = buildStableFsObjectIdentityV2({
      filesystemScope: scope,
      objectKind: "ordinary_file",
      device: "7",
      inode: "21",
    });
    const directoryMembership = buildDirectoryMembershipIdentityV2({
      orderedEntries: [
        { basename: "a-directory", objectKind: "directory" },
        { basename: "b-file", objectKind: "ordinary_file" },
      ],
    });
    const captureDirectoryRequestIdentity = {
      ...requestIdentity,
      operationRef: captureOperation.operationRef,
      operationSchemaRef: captureOperation.requestSchemaRef,
      sequence: 2,
      payload: {
        sessionSlot: request.payload.sessionSlot,
        sequence: 2,
        directorySlot: `slot_${hashV2("directory-slot")}`,
        expectedIdentity: directoryIdentity,
      },
    } as const;
    const captureDirectoryRequest = {
      ...captureDirectoryRequestIdentity,
      requestHash:
        hashPlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameV2(
          captureDirectoryRequestIdentity,
        ),
    };
    assert.deepEqual(
      parsePlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameCandidateV2(
        captureDirectoryRequest,
      ),
      captureDirectoryRequest,
    );
    const memberBindingsIdentity = {
      schema:
        "setfarm.platform-release-bootstrap-darwin-opaque-member-slot-bindings.v2",
      filesystemScopeIdentityHash: scope.scopeIdentityHash,
      entryCount: 2,
      orderedEntries: [
        {
          membershipIndex: 0,
          basename: "a-directory",
          objectKind: "directory",
          slot: `slot_${hashV2("bound-directory-slot")}`,
          objectIdentity: boundDirectoryIdentity,
        },
        {
          membershipIndex: 1,
          basename: "b-file",
          objectKind: "ordinary_file",
          slot: `slot_${hashV2("bound-file-slot")}`,
          objectIdentity: boundFileIdentity,
        },
      ],
    } as const;
    const memberBindings = {
      ...memberBindingsIdentity,
      bindingsHash: hashCanonicalJson({
        schema:
          "setfarm.platform-release-bootstrap-darwin-opaque-member-slot-bindings-hash.v2",
        identity: memberBindingsIdentity,
      }),
    };
    const captureDirectoryResponseIdentity = {
      ...successIdentity,
      operationRef: captureOperation.operationRef,
      operationSchemaRef: captureOperation.successSchemaRef,
      sequence: captureDirectoryRequest.sequence,
      requestHash: captureDirectoryRequest.requestHash,
      payload: {
        directoryIdentity,
        directoryFingerprint,
        firstMembership: directoryMembership,
        secondMembership: directoryMembership,
        memberBindings,
      },
      transcriptHash: hashV2("capture-directory-transcript"),
    } as const;
    const captureDirectoryResponse = {
      ...captureDirectoryResponseIdentity,
      responseHash:
        hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
          captureDirectoryResponseIdentity,
        ),
    };
    assert.deepEqual(
      parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2(
        captureDirectoryResponse,
        captureDirectoryRequest,
      ),
      captureDirectoryResponse,
    );
    const mismatchedMemberBinding = structuredClone(
      captureDirectoryResponse,
    );
    mismatchedMemberBinding.payload.memberBindings.orderedEntries[0]!.basename =
      "a-different-directory";
    const mismatchedBindingsIdentity = {
      ...mismatchedMemberBinding.payload.memberBindings,
    } as Record<string, unknown>;
    delete mismatchedBindingsIdentity.bindingsHash;
    mismatchedMemberBinding.payload.memberBindings.bindingsHash =
      hashCanonicalJson({
        schema:
          "setfarm.platform-release-bootstrap-darwin-opaque-member-slot-bindings-hash.v2",
        identity: mismatchedBindingsIdentity,
      });
    mismatchedMemberBinding.responseHash =
      hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
        mismatchedMemberBinding,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2(
        mismatchedMemberBinding,
        captureDirectoryRequest,
      ),
    );
    const aliasedMemberSlot = structuredClone(captureDirectoryResponse);
    aliasedMemberSlot.payload.memberBindings.orderedEntries[0]!.slot =
      captureDirectoryRequest.payload.directorySlot;
    const aliasedBindingsIdentity = {
      ...aliasedMemberSlot.payload.memberBindings,
    } as Record<string, unknown>;
    delete aliasedBindingsIdentity.bindingsHash;
    aliasedMemberSlot.payload.memberBindings.bindingsHash = hashCanonicalJson({
      schema:
        "setfarm.platform-release-bootstrap-darwin-opaque-member-slot-bindings-hash.v2",
      identity: aliasedBindingsIdentity,
    });
    aliasedMemberSlot.responseHash =
      hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
        aliasedMemberSlot,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2(
        aliasedMemberSlot,
        captureDirectoryRequest,
      ),
    );
    const foreignMemberScope = buildBootstrapFilesystemScopeIdentityV2({
      scopeNonce: hashV2("foreign-member-scope"),
    });
    const foreignMemberIdentity = buildStableFsObjectIdentityV2({
      filesystemScope: foreignMemberScope,
      objectKind: "directory",
      device: "7",
      inode: "20",
    });
    const transplantedMemberIdentity = structuredClone(
      captureDirectoryResponse,
    );
    transplantedMemberIdentity.payload.memberBindings.orderedEntries[0]!.objectIdentity =
      foreignMemberIdentity;
    const transplantedBindingsIdentity = {
      ...transplantedMemberIdentity.payload.memberBindings,
    } as Record<string, unknown>;
    delete transplantedBindingsIdentity.bindingsHash;
    transplantedMemberIdentity.payload.memberBindings.bindingsHash =
      hashCanonicalJson({
        schema:
          "setfarm.platform-release-bootstrap-darwin-opaque-member-slot-bindings-hash.v2",
        identity: transplantedBindingsIdentity,
      });
    transplantedMemberIdentity.responseHash =
      hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
        transplantedMemberIdentity,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2(
        transplantedMemberIdentity,
        captureDirectoryRequest,
      ),
    );

    const foreignDeviceMemberIdentity = buildStableFsObjectIdentityV2({
      filesystemScope: scope,
      objectKind: "directory",
      device: "8",
      inode: "20",
    });
    const transplantedMemberDevice = structuredClone(
      captureDirectoryResponse,
    );
    transplantedMemberDevice.payload.memberBindings.orderedEntries[0]!.objectIdentity =
      foreignDeviceMemberIdentity;
    const transplantedDeviceBindingsIdentity = {
      ...transplantedMemberDevice.payload.memberBindings,
    } as Record<string, unknown>;
    delete transplantedDeviceBindingsIdentity.bindingsHash;
    transplantedMemberDevice.payload.memberBindings.bindingsHash =
      hashCanonicalJson({
        schema:
          "setfarm.platform-release-bootstrap-darwin-opaque-member-slot-bindings-hash.v2",
        identity: transplantedDeviceBindingsIdentity,
      });
    transplantedMemberDevice.responseHash =
      hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
        transplantedMemberDevice,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2(
        transplantedMemberDevice,
        captureDirectoryRequest,
      ),
    );

    const entryIdentity = memberBindings.orderedEntries[1]!.objectIdentity;
    const entryFingerprint = buildFsObservationFingerprintV2({
      objectIdentity: entryIdentity,
      ownerUid: 0,
      ownerGid: 0,
      mode: "0600",
      linkCount: 1,
      byteLength: 1,
      modifiedTimeNanoseconds: "200",
      changedTimeNanoseconds: "201",
    });
    const entryBytes = Buffer.from("x", "utf8");
    const entryContentHash = createHash("sha256")
      .update(entryBytes)
      .digest("hex");
    const captureEntryOperation =
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.operations.find(
        (candidate) =>
          candidate.operationRef === "CAPTURE_EXACT_ENTRY_TWICE_V2",
      )!;
    const captureEntryRequestIdentity = {
      ...requestIdentity,
      operationRef: captureEntryOperation.operationRef,
      operationSchemaRef: captureEntryOperation.requestSchemaRef,
      sequence: 3,
      payload: {
        sessionSlot: request.payload.sessionSlot,
        sequence: 3,
        entrySlot: memberBindings.orderedEntries[1]!.slot,
        expectedIdentity: entryIdentity,
      },
    } as const;
    const captureEntryRequest = {
      ...captureEntryRequestIdentity,
      requestHash:
        hashPlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameV2(
          captureEntryRequestIdentity,
        ),
    };
    const captureEntryResponseIdentity = {
      ...successIdentity,
      operationRef: captureEntryOperation.operationRef,
      operationSchemaRef: captureEntryOperation.successSchemaRef,
      sequence: 3,
      requestHash: captureEntryRequest.requestHash,
      payload: {
        entrySlot: captureEntryRequest.payload.entrySlot,
        entryIdentity,
        entryFingerprint,
        contentEvidence: {
          kind: "bounded_regular_file_bytes",
          contentHash: entryContentHash,
          contentBytes: {
            encoding: "base64",
            byteLength: entryBytes.byteLength,
            contentBase64: entryBytes.toString("base64"),
            contentHash: entryContentHash,
          },
        },
      },
      transcriptHash: hashV2("capture-entry-transcript"),
    } as const;
    const captureEntryResponse = {
      ...captureEntryResponseIdentity,
      responseHash:
        hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
          captureEntryResponseIdentity,
        ),
    };
    assert.deepEqual(
      parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2(
        captureEntryResponse,
        captureEntryRequest,
      ),
      captureEntryResponse,
    );
    const replacementIdentity = buildStableFsObjectIdentityV2({
      filesystemScope: scope,
      objectKind: "ordinary_file",
      device: "7",
      inode: "22",
    });
    const replacementFingerprint = buildFsObservationFingerprintV2({
      objectIdentity: replacementIdentity,
      ownerUid: 0,
      ownerGid: 0,
      mode: "0600",
      linkCount: 1,
      byteLength: 1,
      modifiedTimeNanoseconds: "202",
      changedTimeNanoseconds: "203",
    });
    const splicedResponse = structuredClone(captureEntryResponse);
    splicedResponse.payload.entrySlot = `slot_${hashV2("attacker-entry-slot")}`;
    splicedResponse.payload.entryIdentity = replacementIdentity;
    splicedResponse.payload.entryFingerprint = replacementFingerprint;
    splicedResponse.responseHash =
      hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
        splicedResponse,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2(
        splicedResponse,
        captureEntryRequest,
      ),
    );
    const mismatchedRegularEvidence = structuredClone(captureEntryResponse);
    mismatchedRegularEvidence.payload.contentEvidence.contentHash =
      hashV2("wrong-entry-content");
    mismatchedRegularEvidence.responseHash =
      hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
        mismatchedRegularEvidence,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2(
        mismatchedRegularEvidence,
        captureEntryRequest,
      ),
    );

    const boundDirectoryFingerprint = buildFsObservationFingerprintV2({
      objectIdentity: boundDirectoryIdentity,
      ownerUid: 0,
      ownerGid: 0,
      mode: "0555",
      linkCount: 2,
      byteLength: 128,
      modifiedTimeNanoseconds: "210",
      changedTimeNanoseconds: "211",
    });
    const captureDirectoryEntryRequestIdentity = {
      ...requestIdentity,
      operationRef: captureEntryOperation.operationRef,
      operationSchemaRef: captureEntryOperation.requestSchemaRef,
      sequence: 4,
      payload: {
        sessionSlot: request.payload.sessionSlot,
        sequence: 4,
        entrySlot: memberBindings.orderedEntries[0]!.slot,
        expectedIdentity: boundDirectoryIdentity,
      },
    } as const;
    const captureDirectoryEntryRequest = {
      ...captureDirectoryEntryRequestIdentity,
      requestHash:
        hashPlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameV2(
          captureDirectoryEntryRequestIdentity,
        ),
    };
    assert.deepEqual(
      parsePlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameCandidateV2(
        captureDirectoryEntryRequest,
      ),
      captureDirectoryEntryRequest,
    );
    const innerDirectoryMembership = buildDirectoryMembershipIdentityV2({
      orderedEntries: [
        { basename: "manifest.json", objectKind: "ordinary_file" },
      ],
    });
    const captureDirectoryEntryResponseIdentity = {
      ...successIdentity,
      operationRef: captureEntryOperation.operationRef,
      operationSchemaRef: captureEntryOperation.successSchemaRef,
      sequence: captureDirectoryEntryRequest.sequence,
      requestHash: captureDirectoryEntryRequest.requestHash,
      payload: {
        entrySlot: captureDirectoryEntryRequest.payload.entrySlot,
        entryIdentity: boundDirectoryIdentity,
        entryFingerprint: boundDirectoryFingerprint,
        contentEvidence: {
          kind: "directory_membership",
          membership: innerDirectoryMembership,
        },
      },
      transcriptHash: hashV2("capture-directory-entry-transcript"),
    } as const;
    const captureDirectoryEntryResponse = {
      ...captureDirectoryEntryResponseIdentity,
      responseHash:
        hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
          captureDirectoryEntryResponseIdentity,
        ),
    };
    assert.deepEqual(
      parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2(
        captureDirectoryEntryResponse,
        captureDirectoryEntryRequest,
      ),
      captureDirectoryEntryResponse,
    );
    const wrongDirectoryEvidenceKind = {
      ...captureDirectoryEntryResponse,
      payload: {
        ...captureDirectoryEntryResponse.payload,
        contentEvidence:
          captureEntryResponse.payload.contentEvidence,
      },
    };
    const wrongDirectoryEvidenceKindFrame = {
      ...wrongDirectoryEvidenceKind,
      responseHash:
        hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
          wrongDirectoryEvidenceKind,
        ),
    };
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2(
        wrongDirectoryEvidenceKindFrame,
        captureDirectoryEntryRequest,
      ),
    );

    const writeOperation =
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.operations.find(
        (candidate) => candidate.operationRef === "WRITE_EXACT_BOUNDED_FILE_V2",
      )!;
    const writeRequestIdentity = {
      ...requestIdentity,
      operationRef: writeOperation.operationRef,
      operationSchemaRef: writeOperation.requestSchemaRef,
      sequence: 4,
      payload: {
        sessionSlot: request.payload.sessionSlot,
        sequence: 4,
        fileSlot: captureEntryRequest.payload.entrySlot,
        expectedIdentity: entryIdentity,
        expectedPriorFingerprint: entryFingerprint,
        contentBytes:
          captureEntryResponse.payload.contentEvidence.contentBytes,
        contentHash: entryContentHash,
      },
    } as const;
    const writeRequest = {
      ...writeRequestIdentity,
      requestHash:
        hashPlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameV2(
          writeRequestIdentity,
        ),
    };
    const writeResponseIdentity = {
      ...successIdentity,
      operationRef: writeOperation.operationRef,
      operationSchemaRef: writeOperation.successSchemaRef,
      sequence: writeRequest.sequence,
      requestHash: writeRequest.requestHash,
      payload: {
        fileIdentity: entryIdentity,
        fileFingerprint: entryFingerprint,
        observedContentHash: entryContentHash,
      },
      transcriptHash: hashV2("write-transcript"),
    } as const;
    const writeResponse = {
      ...writeResponseIdentity,
      responseHash:
        hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
          writeResponseIdentity,
        ),
    };
    assert.deepEqual(
      parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2(
        writeResponse,
        writeRequest,
      ),
      writeResponse,
    );
    const splicedWriteResponse = structuredClone(writeResponse);
    splicedWriteResponse.payload.fileIdentity = replacementIdentity;
    splicedWriteResponse.payload.fileFingerprint = replacementFingerprint;
    splicedWriteResponse.responseHash =
      hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
        splicedWriteResponse,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2(
        splicedWriteResponse,
        writeRequest,
      ),
    );

    const renameOperation =
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.operations.find(
        (candidate) =>
          candidate.operationRef === "RENAME_EPOCH_TARGET_OVER_EXACT_PRIOR_V2",
      )!;
    const renameRequestIdentity = {
      ...requestIdentity,
      operationRef: renameOperation.operationRef,
      operationSchemaRef: renameOperation.requestSchemaRef,
      sequence: 6,
      payload: {
        sessionSlot: request.payload.sessionSlot,
        sequence: 6,
        sourceSlot: `slot_${hashV2("rename-source-slot")}`,
        targetSlot: `slot_${hashV2("rename-target-slot")}`,
        expectedSourceIdentity: entryIdentity,
        expectedSourceFingerprint: entryFingerprint,
        expectedSourceContentHash: entryContentHash,
        expectedPriorIdentity: replacementIdentity,
        expectedPriorFingerprint: replacementFingerprint,
        expectedPriorContentHash: hashV2("rename-prior-content"),
      },
    } as const;
    const renameRequest = {
      ...renameRequestIdentity,
      requestHash:
        hashPlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameV2(
          renameRequestIdentity,
        ),
    };
    assert.deepEqual(
      parsePlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameCandidateV2(
        renameRequest,
      ),
      renameRequest,
    );
    const aliasedRenameSlotRequest = structuredClone(renameRequest);
    aliasedRenameSlotRequest.payload.sourceSlot =
      aliasedRenameSlotRequest.payload.targetSlot;
    aliasedRenameSlotRequest.requestHash =
      hashPlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameV2(
        aliasedRenameSlotRequest,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameCandidateV2(
        aliasedRenameSlotRequest,
      ),
    );
    const aliasedRenameIdentityRequest = structuredClone(renameRequest);
    aliasedRenameIdentityRequest.payload.expectedPriorIdentity = entryIdentity;
    aliasedRenameIdentityRequest.payload.expectedPriorFingerprint =
      entryFingerprint;
    aliasedRenameIdentityRequest.requestHash =
      hashPlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameV2(
        aliasedRenameIdentityRequest,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameCandidateV2(
        aliasedRenameIdentityRequest,
      ),
    );

    const stagingDirectoryIdentity = buildStableFsObjectIdentityV2({
      filesystemScope: scope,
      objectKind: "directory",
      device: "7",
      inode: "12",
    });
    const emptyMembership = buildDirectoryMembershipIdentityV2({
      orderedEntries: [],
    });
    const removeOperation =
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.operations.find(
        (candidate) =>
          candidate.operationRef === "REMOVE_EXACT_EMPTY_DIRECTORY_V2",
      )!;
    const removeRequestIdentity = {
      ...requestIdentity,
      operationRef: removeOperation.operationRef,
      operationSchemaRef: removeOperation.requestSchemaRef,
      sequence: 5,
      payload: {
        sessionSlot: request.payload.sessionSlot,
        sequence: 5,
        parentSlot: `slot_${hashV2("remove-parent-slot")}`,
        expectedParentIdentity: directoryIdentity,
        directorySlot: `slot_${hashV2("remove-directory-slot")}`,
        directoryOperand: "TRANSACTION_STAGING_DIRECTORY_V2",
        expectedIdentity: stagingDirectoryIdentity,
        expectedMembership: emptyMembership,
      },
    } as const;
    const removeRequest = {
      ...removeRequestIdentity,
      requestHash:
        hashPlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameV2(
          removeRequestIdentity,
        ),
    };
    const removeAbsenceIdentity = {
      schema: "setfarm.platform-release-bootstrap-darwin-expected-absence.v2",
      parentIdentity: directoryIdentity,
      targetOperandRef: "TRANSACTION_STAGING_DIRECTORY_V2",
      firstObservationHash: hashV2("remove-absence-first"),
      secondObservationHash: hashV2("remove-absence-second"),
    } as const;
    const observedRemoveAbsence = {
      ...removeAbsenceIdentity,
      absenceHash: hashPlatformReleaseBootstrapDarwinExpectedAbsenceV2(
        removeAbsenceIdentity,
      ),
    };
    const removeResponseIdentity = {
      ...successIdentity,
      operationRef: removeOperation.operationRef,
      operationSchemaRef: removeOperation.successSchemaRef,
      sequence: removeRequest.sequence,
      requestHash: removeRequest.requestHash,
      payload: {
        parentMembership: emptyMembership,
        observedAbsence: observedRemoveAbsence,
      },
      transcriptHash: hashV2("remove-transcript"),
    } as const;
    const removeResponse = {
      ...removeResponseIdentity,
      responseHash:
        hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
          removeResponseIdentity,
        ),
    };
    assert.deepEqual(
      parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2(
        removeResponse,
        removeRequest,
      ),
      removeResponse,
    );
    const splicedRemoveResponse = structuredClone(
      removeResponse,
    ) as unknown as {
      payload: {
        observedAbsence: {
          targetOperandRef: string;
          absenceHash: string;
        };
      };
      responseHash: string;
    };
    splicedRemoveResponse.payload.observedAbsence.targetOperandRef =
      "FILESYSTEM_SCOPE_STAGE_V2";
    splicedRemoveResponse.payload.observedAbsence.absenceHash =
      hashPlatformReleaseBootstrapDarwinExpectedAbsenceV2(
        splicedRemoveResponse.payload.observedAbsence as unknown as Record<
          string,
          unknown
        >,
      );
    splicedRemoveResponse.responseHash =
      hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
        splicedRemoveResponse as unknown as Record<string, unknown>,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2(
        splicedRemoveResponse,
        removeRequest,
      ),
    );

    const selfAttestOperation =
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.operations.find(
        (candidate) =>
          candidate.operationRef ===
          "SELF_ATTEST_AND_OPEN_FIXED_BOOTSTRAP_SESSION_V2",
      )!;
    const selfAttestRequestIdentity = {
      ...requestIdentity,
      operationRef: selfAttestOperation.operationRef,
      operationSchemaRef: selfAttestOperation.requestSchemaRef,
      sequence: 0,
      payload: {
        challengeHash: hashV2("self-attest-challenge"),
        initialSequence: 0,
      },
    } as const;
    const selfAttestRequest = {
      ...selfAttestRequestIdentity,
      requestHash:
        hashPlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameV2(
          selfAttestRequestIdentity,
        ),
    };
    const selfAttestResponseIdentity = {
      ...successIdentity,
      operationRef: selfAttestOperation.operationRef,
      operationSchemaRef: selfAttestOperation.successSchemaRef,
      sequence: selfAttestRequest.sequence,
      requestHash: selfAttestRequest.requestHash,
      payload: {
        sessionSlot: `slot_${hashV2("self-attest-session-slot")}`,
        attestationReceiptHash: hashV2("self-attest-receipt"),
        bootstrapParentSlot: `slot_${hashV2("bootstrap-parent-slot")}`,
        bootstrapParentIdentity: directoryIdentity,
        bootstrapParentFingerprint: directoryFingerprint,
        filesystemScopeSlot: `slot_${hashV2("filesystem-scope-slot")}`,
        filesystemScopeIdentity: scope,
        filesystemScopeContentHash: hashCanonicalJson(scope),
      },
      transcriptHash: hashV2("self-attest-transcript"),
    } as const;
    const selfAttestResponse = {
      ...selfAttestResponseIdentity,
      responseHash:
        hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
          selfAttestResponseIdentity,
        ),
    };
    assert.deepEqual(
      parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2(
        selfAttestResponse,
        selfAttestRequest,
      ),
      selfAttestResponse,
    );
    const attackerParentIdentity = buildStableFsObjectIdentityV2({
      filesystemScope: scope,
      objectKind: "directory",
      device: "7",
      inode: "99",
    });
    const attackerParentFingerprint = buildFsObservationFingerprintV2({
      objectIdentity: attackerParentIdentity,
      ownerUid: 0,
      ownerGid: 0,
      mode: "0755",
      linkCount: 1,
      byteLength: 512,
      modifiedTimeNanoseconds: "300",
      changedTimeNanoseconds: "301",
    });
    const splicedSelfAttestResponse = structuredClone(selfAttestResponse);
    splicedSelfAttestResponse.payload.bootstrapParentFingerprint =
      attackerParentFingerprint;
    splicedSelfAttestResponse.responseHash =
      hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
        splicedSelfAttestResponse,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2(
        splicedSelfAttestResponse,
        selfAttestRequest,
      ),
    );
    const aliasedScopeSlot = structuredClone(selfAttestResponse);
    aliasedScopeSlot.payload.filesystemScopeSlot =
      aliasedScopeSlot.payload.bootstrapParentSlot;
    aliasedScopeSlot.responseHash =
      hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
        aliasedScopeSlot,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2(
        aliasedScopeSlot,
        selfAttestRequest,
      ),
    );
    const wrongScopeContent = structuredClone(selfAttestResponse);
    wrongScopeContent.payload.filesystemScopeContentHash =
      hashV2("wrong-scope-document");
    wrongScopeContent.responseHash =
      hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
        wrongScopeContent,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2(
        wrongScopeContent,
        selfAttestRequest,
      ),
    );
    const foreignScope = buildBootstrapFilesystemScopeIdentityV2({
      scopeNonce: hashV2("foreign-wire-physical-scope"),
    });
    const transplantedScope = structuredClone(selfAttestResponse);
    transplantedScope.payload.filesystemScopeIdentity = foreignScope;
    transplantedScope.payload.filesystemScopeContentHash =
      hashCanonicalJson(foreignScope);
    transplantedScope.responseHash =
      hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
        transplantedScope,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2(
        transplantedScope,
        selfAttestRequest,
      ),
    );

    const disallowedFailureIdentity = {
      schema:
        "setfarm.platform-release-bootstrap-darwin-filesystem-backend-failure-frame.v2",
      version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
      backendAbiHash: request.backendAbiHash,
      sessionOccurrenceHash: request.sessionOccurrenceHash,
      operationRef: operation.operationRef,
      operationSchemaRef: operation.failureSchemaRef,
      sequence: request.sequence,
      requestHash: request.requestHash,
      status: "failure",
      errorCode: "IDENTITY_MISMATCH",
      nativeErrno: null,
      errorMessage: "disallowed closed-domain error",
      transcriptHash: hashV2("wire-failure-transcript"),
    } as const;
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2(
        {
          ...disallowedFailureIdentity,
          responseHash:
            hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
              disallowedFailureIdentity,
            ),
        },
        request,
      ),
    );
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_WIRE_CONTRACT_CATALOG_V2.wireContractCatalogHash,
      hashPlatformReleaseBootstrapDarwinFilesystemBackendWireContractCatalogV2(
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_WIRE_CONTRACT_CATALOG_V2,
      ),
    );
    assert.deepEqual(
      parsePlatformReleaseBootstrapDarwinFilesystemBackendWireContractCatalogCandidateV2(
        structuredClone(
          PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_WIRE_CONTRACT_CATALOG_V2,
        ),
      ),
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_WIRE_CONTRACT_CATALOG_V2,
    );
    const wireCatalogTampered = structuredClone(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_WIRE_CONTRACT_CATALOG_V2,
    ) as unknown as {
      fieldKindBindings: Array<{ dtoSchemaRef: string }>;
      wireContractCatalogHash: string;
    };
    wireCatalogTampered.fieldKindBindings[0]!.dtoSchemaRef = "attacker.dto.v2";
    wireCatalogTampered.wireContractCatalogHash =
      hashPlatformReleaseBootstrapDarwinFilesystemBackendWireContractCatalogV2(
        wireCatalogTampered as unknown as Record<string, unknown>,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendWireContractCatalogCandidateV2(
        wireCatalogTampered,
      ),
    );
  });

  it("parses a strict pathless receipt but never treats serialized receipt data as a live capability", async () => {
    const receipt =
      parsePlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptCandidateV2(
        validReceiptCandidateV2(),
      );
    assert.equal(Object.isFrozen(receipt), true);
    assert.equal(
      receipt.receiptHash,
      hashPlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptV2(
        receipt,
      ),
    );
    assert.equal(
      receipt.distributionCatalogBindingHash,
      hashPlatformReleaseBootstrapDarwinDistributionCatalogBindingV2(receipt),
    );
    assert.equal(
      receipt.selfAttestationBindingHash,
      hashPlatformReleaseBootstrapDarwinSelfAttestationBindingV2(receipt),
    );
    assert.equal(
      receipt.capabilityProofBindingHash,
      hashPlatformReleaseBootstrapDarwinCapabilityProofBindingV2(receipt),
    );
    assert.equal(
      receipt.sessionBindingHash,
      hashPlatformReleaseBootstrapDarwinSessionBindingV2(receipt),
    );
    const detachedEvidence = structuredClone(receipt) as unknown as Record<
      string,
      unknown
    >;
    detachedEvidence.nativeDistributionReceiptHash = hashV2(
      "detached-distribution",
    );
    detachedEvidence.receiptHash =
      hashPlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptV2(
        detachedEvidence as never,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptCandidateV2(
        detachedEvidence,
      ),
    );
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptCandidateV2(
        {
          ...validReceiptCandidateV2(),
          distributionEpochFloor: 2,
        },
      ),
    );
    const forbiddenPublicField =
      /(?:path|locator|fd|descriptor|argv|env|cwd|command|callback|flags)/i;
    assert.deepEqual(
      publicFieldNamesV2(receipt).filter((field) =>
        forbiddenPublicField.test(field),
      ),
      [],
    );
    await expectAuthorityCodeV2(
      () =>
        inspectPlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptV2(
          receipt as unknown as PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityV2,
        ),
      "DARWIN_FILESYSTEM_BACKEND_HANDLE_UNAUTHENTICATED",
    );
    await expectAuthorityCodeV2(
      () =>
        new PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityV2(
          {},
          {
            receipt,
            admissionScope: "production_host",
            liveSession: {
              liveBridge: {},
              lifecycle: "open",
              nextSequence: 1,
              sessionBindingHash: receipt.sessionBindingHash,
              openingTranscriptHash: receipt.transcriptHash,
              currentTranscriptHash: receipt.transcriptHash,
            },
          },
        ),
      "DARWIN_FILESYSTEM_BACKEND_HANDLE_UNAUTHENTICATED",
    );
    const forged = Object.create(
      PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityV2.prototype,
    ) as PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityV2;
    await expectAuthorityCodeV2(
      () =>
        inspectPlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptV2(
          forged,
        ),
      "DARWIN_FILESYSTEM_BACKEND_HANDLE_UNAUTHENTICATED",
    );
  });

  it("keeps the zero-input production backend and registry activator physically inert", async () => {
    assert.equal(
      openProductionAuthenticatedDarwinFilesystemBackendV2.length,
      0,
    );
    let hostileReads = 0;
    const hostile = new Proxy(
      {},
      {
        get: () => {
          hostileReads += 1;
          return undefined;
        },
      },
    );
    await expectAuthorityCodeV2(
      () =>
        Reflect.apply(
          openProductionAuthenticatedDarwinFilesystemBackendV2,
          undefined,
          [hostile],
        ),
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_PRODUCTION_ERROR_CODE_V2,
    );
    assert.equal(hostileReads, 0);
    assert.equal(
      activatePlatformReleaseBootstrapRegistryProductionV2.length,
      0,
    );
    await assert.rejects(
      async () =>
        Reflect.apply(
          activatePlatformReleaseBootstrapRegistryProductionV2,
          undefined,
          [hostile],
        ),
      (error: unknown) => {
        assert.equal(
          (
            error as {
              code?: string;
            }
          ).code,
          PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_PRODUCTION_ERROR_CODE_V2,
        );
        return true;
      },
    );
    assert.equal(hostileReads, 0);

    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const authoritySource = await readFile(
      path.resolve(
        testDirectory,
        "../../src/execution/platform-release-bootstrap-darwin-filesystem-backend-authority-v2.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(
      authoritySource,
      /node:(?:fs|child_process|net|http|https)|cooperative|darwin-parent-descriptor-lease|publication-v2/,
    );
  });
});

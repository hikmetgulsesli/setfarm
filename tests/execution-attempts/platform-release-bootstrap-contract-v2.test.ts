import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";

import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_STAGING_PREFIX_V2,
} from
  "../../src/product-compiler/schemas/node-toolchain-provisioner-bootstrap-installation-state-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_CLAIM_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_RECEIPT_BASENAME_REGEX_V2,
} from
  "../../src/product-compiler/schemas/node-toolchain-provisioner-bootstrap-rollback-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2,
} from
  "../../src/product-compiler/schemas/node-toolchain-provisioner-bootstrap-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_COUNT_V2,
  PLATFORM_RELEASE_BOOTSTRAP_PARENT_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_COUNT_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_RECEIPT_BASENAME_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_CLAIM_BASENAME_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_FLOOR_BASENAME_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_SHARED_LOCK_BASENAME_V2,
  PLATFORM_RELEASE_COMPOSITION_PACKAGE_ROOT_V2,
  PLATFORM_RELEASE_HOST_VERIFIER_ROOT_V2,
  PLATFORM_RELEASE_RUNTIME_ACCOUNT_PROVISIONER_ROOT_V2,
  PlatformReleaseBootstrapContractV2Schema,
  PlatformReleaseBootstrapRegistryDocumentProtocolCatalogV2Schema,
  getPlatformReleaseBootstrapContractV2,
  getPlatformReleaseBootstrapRegistryDocumentProtocolCatalogV2,
  getPlatformReleaseBootstrapRegistryDocumentProtocolV2,
  hashPlatformReleaseBootstrapContractV2,
  hashPlatformReleaseBootstrapRegistryDocumentProtocolCatalogV2,
  hashPlatformReleaseBootstrapRegistryDocumentProtocolV2,
  parsePlatformReleaseBootstrapContractCandidateV2,
  parsePlatformReleaseBootstrapRegistryDocumentProtocolCatalogCandidateV2,
} from
  "../../src/execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_COUNT_V2,
  PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2,
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
  PlatformReleaseBootstrapOperationAbiSetV2Schema,
  getPlatformReleaseBootstrapOperationAbiSetV2,
  hashPlatformReleaseBootstrapOperationAbiSetV2,
  hashPlatformReleaseBootstrapOperationAbiV2,
  parsePlatformReleaseBootstrapOperationAbiSetCandidateV2,
} from
  "../../src/execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_OPERATION_FAILURE_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2,
  PLATFORM_RELEASE_BOOTSTRAP_WIRE_SCHEMA_COUNT_V2,
  PlatformReleaseBootstrapWireContractSetV2Schema,
  getPlatformReleaseBootstrapWireContractSetV2,
  getPlatformReleaseBootstrapWireSchemaContractV2,
  hashPlatformReleaseBootstrapWireContractSetV2,
  hashPlatformReleaseBootstrapWireMessageV2,
  hashPlatformReleaseBootstrapWireSchemaContractV2,
  parsePlatformReleaseBootstrapWireContractSetCandidateV2,
  parsePlatformReleaseBootstrapWireMessageV2,
} from
  "../../src/execution/schemas/platform-release-bootstrap-wire-contracts-v2.js";
import {
  PLATFORM_RELEASE_HOST_COMPOSITION_REQUIREMENT_V2,
} from
  "../../src/execution/schemas/platform-release-host-composition-v2.js";

function mutableClone<T>(value: T): T {
  return structuredClone(value);
}

describe("platform release bootstrap contract v2", () => {
  it("publishes one strict frozen code-owned topology and ABI contract", () => {
    assert.equal(
      PlatformReleaseBootstrapContractV2Schema.safeParse(
        PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
      ).success,
      true,
    );
    assert.equal(
      PlatformReleaseBootstrapOperationAbiSetV2Schema.safeParse(
        PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2,
      ).success,
      true,
    );
    assert.equal(
      PlatformReleaseBootstrapWireContractSetV2Schema.safeParse(
        PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2,
      ).success,
      true,
    );
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash,
      hashPlatformReleaseBootstrapContractV2(
        PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
      ),
    );
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2.abiSetHash,
      hashPlatformReleaseBootstrapOperationAbiSetV2(
        PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2,
      ),
    );
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2.contractSetHash,
      hashPlatformReleaseBootstrapWireContractSetV2(
        PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2,
      ),
    );
    for (
      const wireContract
      of PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2.schemas
    ) {
      assert.equal(
        wireContract.wireSchemaHash,
        hashPlatformReleaseBootstrapWireSchemaContractV2(
          wireContract,
        ),
      );
    }
    for (
      const operation
      of PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2.operations
    ) {
      assert.equal(
        operation.operationHash,
        hashPlatformReleaseBootstrapOperationAbiV2(operation),
      );
    }
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.operationAbiSetHash,
      PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2.abiSetHash,
    );
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.length,
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_COUNT_V2,
    );
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2.operations.length,
      PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_COUNT_V2,
    );
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2.schemas.length,
      PLATFORM_RELEASE_BOOTSTRAP_WIRE_SCHEMA_COUNT_V2,
    );
    assert.ok(Object.isFrozen(PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2));
    assert.ok(
      Object.isFrozen(
        PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages[0]!.members,
      ),
    );
    assert.ok(
      Object.isFrozen(
        PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2.operations,
      ),
    );
    assert.ok(
      Object.isFrozen(
        PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2.schemas,
      ),
    );

    const first = getPlatformReleaseBootstrapContractV2();
    const second = getPlatformReleaseBootstrapContractV2();
    assert.notEqual(first, second);
    assert.deepEqual(first, second);
    assert.ok(Object.isFrozen(first));
    assert.ok(Object.isFrozen(first.packages));

    const firstAbis = getPlatformReleaseBootstrapOperationAbiSetV2();
    const secondAbis = getPlatformReleaseBootstrapOperationAbiSetV2();
    assert.notEqual(firstAbis, secondAbis);
    assert.deepEqual(firstAbis, secondAbis);
    assert.ok(Object.isFrozen(firstAbis.operations));

    const firstWireContracts =
      getPlatformReleaseBootstrapWireContractSetV2();
    const secondWireContracts =
      getPlatformReleaseBootstrapWireContractSetV2();
    assert.notEqual(firstWireContracts, secondWireContracts);
    assert.deepEqual(firstWireContracts, secondWireContracts);
    assert.ok(Object.isFrozen(firstWireContracts.schemas));
  });

  it("binds four direct-child package roots and preserves the exact Node namespace", () => {
    const packages = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages;
    const packageRefs = packages.map((entry) => entry.packageRef);
    assert.deepEqual(packageRefs, [...packageRefs].sort());
    assert.deepEqual(packageRefs, [
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.platformReleaseComposition,
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.runtimeAccountProvisioner,
    ]);
    assert.deepEqual(packages.map((entry) => entry.root), [
      PLATFORM_RELEASE_HOST_VERIFIER_ROOT_V2,
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2,
      PLATFORM_RELEASE_COMPOSITION_PACKAGE_ROOT_V2,
      PLATFORM_RELEASE_RUNTIME_ACCOUNT_PROVISIONER_ROOT_V2,
    ]);
    for (const packageContract of packages) {
      assert.equal(
        path.posix.dirname(packageContract.root),
        PLATFORM_RELEASE_BOOTSTRAP_PARENT_V2,
      );
      assert.equal(
        path.posix.basename(packageContract.root),
        packageContract.rootBasename,
      );
      const directoryRefs = new Set(
        packageContract.directories.map((entry) =>
          entry.directoryRef),
      );
      const memberRefs = new Set(
        packageContract.members.map((entry) => entry.memberRef),
      );
      assert.equal(
        packageContract.members.every((entry) =>
          directoryRefs.has(entry.parentDirectoryRef)),
        true,
      );
      assert.equal(
        packageContract.directories.every((directory) =>
          directory.orderedEntryRefs.every((entryRef) =>
            directoryRefs.has(entryRef) || memberRefs.has(entryRef))),
        true,
      );
    }

    const node = packages.find((entry) =>
      entry.packageRef
        === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2
          .nodeToolchainProvisioner)!;
    assert.equal(
      node.lifecycle.activeReceiptBasename,
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_BASENAME_V2,
    );
    assert.equal(
      node.lifecycle.activeClaimBasename,
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_BASENAME_V2,
    );
    assert.equal(
      node.lifecycle.packageLockBasename,
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_BASENAME_V2,
    );
    assert.equal(
      node.lifecycle.stagingPrefix,
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_STAGING_PREFIX_V2,
    );
    assert.equal(
      node.lifecycle.rollbackClaimBasename,
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_CLAIM_BASENAME_V2,
    );
    assert.equal(
      node.lifecycle.rollbackReceiptBasenameRegex,
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_RECEIPT_BASENAME_REGEX_V2,
    );
  });

  it("owns one collision-free shared namespace and disjoint rollback receipt families", () => {
    const contract = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2;
    assert.equal(
      contract.registry.parent,
      PLATFORM_RELEASE_BOOTSTRAP_PARENT_V2,
    );
    assert.deepEqual(
      [
        contract.registry.sharedLockBasename,
        contract.registry.activationReceiptBasename,
        contract.registry.epochFloorBasename,
        contract.registry.epochClaimBasename,
      ],
      [
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_SHARED_LOCK_BASENAME_V2,
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_RECEIPT_BASENAME_V2,
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_FLOOR_BASENAME_V2,
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_CLAIM_BASENAME_V2,
      ],
    );
    const exactNames = [
      contract.registry.sharedLockBasename,
      contract.registry.activationReceiptBasename,
      contract.registry.epochFloorBasename,
      contract.registry.epochClaimBasename,
      ...contract.packages.flatMap((entry) => [
        entry.rootBasename,
        entry.lifecycle.activeReceiptBasename,
        entry.lifecycle.activeClaimBasename,
        entry.lifecycle.packageLockBasename,
        entry.lifecycle.stagingPrefix,
        entry.lifecycle.rollbackClaimBasename,
      ]),
    ];
    assert.equal(new Set(exactNames).size, exactNames.length);

    const rollbackSamples = contract.packages.map((entry) => ({
      packageRef: entry.packageRef,
      regex: new RegExp(entry.lifecycle.rollbackReceiptBasenameRegex),
      sample: entry.lifecycle.rollbackReceiptBasenameRegex
        .match(/node-toolchain-provisioner/) !== null
        ? `.setfarm-node-toolchain-provisioner-installation-v2.rollback.${"a".repeat(64)}.receipt.json`
        : `.setfarm-${entry.rootBasename}.rollback.${"a".repeat(64)}.receipt.json`,
    }));
    for (const candidate of rollbackSamples) {
      assert.equal(candidate.regex.test(candidate.sample), true);
      for (const other of rollbackSamples) {
        assert.equal(
          other.regex.test(candidate.sample),
          other.packageRef === candidate.packageRef,
        );
      }
    }
  });

  it("freezes strict registry activation, floor, claim and rollback document protocols", () => {
    const catalog =
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_V2;
    assert.equal(
      PlatformReleaseBootstrapRegistryDocumentProtocolCatalogV2Schema
        .safeParse(catalog).success,
      true,
    );
    assert.equal(
      catalog.catalogHash,
      hashPlatformReleaseBootstrapRegistryDocumentProtocolCatalogV2(
        catalog,
      ),
    );
    assert.equal(
      catalog.documents.length,
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_COUNT_V2,
    );
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry
        .documentProtocolCatalogHash,
      catalog.catalogHash,
    );
    assert.deepEqual(
      catalog.documents.map((entry) => entry.schemaRef),
      [...catalog.documents.map((entry) => entry.schemaRef)].sort(),
    );
    for (const document of catalog.documents) {
      assert.equal(
        document.documentSchemaHash,
        hashPlatformReleaseBootstrapRegistryDocumentProtocolV2(
          document,
        ),
      );
      assert.equal(document.productionUse, "forbidden");
      assert.ok(document.maxCanonicalBytes <= 256 * 1024);
      assert.equal(document.fields[0]!.name, "schema");
      assert.equal(document.fields[1]!.name, "version");
      assert.ok(document.fields.at(-1)!.name.endsWith("Hash"));
    }

    const first = getPlatformReleaseBootstrapRegistryDocumentProtocolCatalogV2();
    const second = getPlatformReleaseBootstrapRegistryDocumentProtocolCatalogV2();
    assert.notEqual(first, second);
    assert.deepEqual(first, second);
    assert.ok(Object.isFrozen(first.documents));
    const epochFloor =
      getPlatformReleaseBootstrapRegistryDocumentProtocolV2(
        "setfarm.platform-release-bootstrap-registry-epoch-floor-state.v2",
      );
    assert.equal(
      epochFloor.fields.find((entry) =>
        entry.name === "transactionIdentityHash")?.kind,
      "nullable_sha256",
    );
    assert.equal(
      epochFloor.fields.find((entry) =>
        entry.name === "packageEpochArtifactMap")?.kind,
      "exact_package_epoch_artifact_map",
    );
    assert.throws(() =>
      getPlatformReleaseBootstrapRegistryDocumentProtocolV2(
        "setfarm.platform-release-bootstrap-registry-unknown.v2",
      ));
  });

  it("freezes the complete native and release operation ABI set before package installation", () => {
    const abiSet = PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2;
    const refs = abiSet.operations.map((entry) => entry.abiRef);
    assert.deepEqual(refs, [...refs].sort());
    assert.equal(new Set(refs).size, refs.length);
    assert.equal(
      abiSet.operations.every((entry) =>
        entry.directArgvTemplate[0] === entry.command
        && entry.inputTransport
          === "preopened_read_only_fd3_exactly_once_v2"
        && entry.stdin === "closed"
        && entry.shell === "forbidden"
        && entry.inheritAmbientEnvironment === false
        && entry.environmentPolicy === "exact_empty_environment_v2"
        && entry.workingDirectoryPolicy
          === "installed_owner_package_root_v2"
        && entry.processEvidencePolicy
          ===
            "outer_host_owner_binds_exit_termination_stdout_stderr_and_occurrence_v2"),
      true,
    );
    assert.deepEqual(
      abiSet.operations
        .filter((entry) =>
          entry.ownerPackageRef
            === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier)
        .map((entry) => entry.abiRef),
      [
        "ABI_PLATFORM_RELEASE_LOOKUP_LOCAL_ACCOUNT_V2",
        "ABI_PLATFORM_RELEASE_SELF_ATTEST_V2",
        "ABI_PLATFORM_RELEASE_VERIFY_PACKAGE_V2",
        "ABI_PLATFORM_RELEASE_VERIFY_SYSTEM_ANCHORS_V2",
      ],
    );
    assert.deepEqual(
      abiSet.operations
        .filter((entry) =>
          entry.ownerPackageRef
            === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2
              .runtimeAccountProvisioner)
        .map((entry) => entry.abiRef),
      [
        "ABI_PLATFORM_RELEASE_APPLY_LOCAL_ACCOUNT_V2",
        "ABI_PLATFORM_RELEASE_PLAN_LOCAL_ACCOUNT_V2",
        "ABI_PLATFORM_RELEASE_ROLLBACK_LOCAL_ACCOUNT_V2",
      ],
    );
    const compatibilityHashes = new Set(
      abiSet.operations
        .map((entry) => entry.compatibilityBindingHash)
        .filter((entry): entry is string => entry !== null),
    );
    assert.deepEqual(
      compatibilityHashes,
      new Set([
        PLATFORM_RELEASE_HOST_COMPOSITION_REQUIREMENT_V2
          .operationBindings.releaseBootstrapAbiHash,
        PLATFORM_RELEASE_HOST_COMPOSITION_REQUIREMENT_V2
          .operationBindings.metadataOperationAbiHash,
        PLATFORM_RELEASE_HOST_COMPOSITION_REQUIREMENT_V2
          .operationBindings.moduleExportOperationAbiHash,
        PLATFORM_RELEASE_HOST_COMPOSITION_REQUIREMENT_V2
          .operationBindings.networkOperationAbiHash,
        PLATFORM_RELEASE_HOST_COMPOSITION_REQUIREMENT_V2
          .operationBindings.verifierAbiHash,
      ]),
    );
  });

  it("binds every ABI input and output to exactly one wire contract", () => {
    const abiSet = PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2;
    const wireSet = PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2;
    assert.equal(
      abiSet.wireContractSetHash,
      wireSet.contractSetHash,
    );

    const wireBySchemaRef = new Map(
      wireSet.schemas.map((entry) => [entry.schemaRef, entry]),
    );
    const usedSchemaRefs = new Set<string>();
    for (const operation of abiSet.operations) {
      const inputContract = wireBySchemaRef.get(operation.inputSchema);
      const outputContract = wireBySchemaRef.get(operation.outputSchema);
      const ownerPackage =
        PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages
          .find((entry) =>
            entry.packageRef === operation.ownerPackageRef)!;
      const executableMember = ownerPackage.members.find((entry) =>
        entry.memberRef === operation.processExecutableMemberRef)!;
      const implementationMember = ownerPackage.members.find((entry) =>
        entry.memberRef === operation.implementationMemberRef)!;
      assert.ok(executableMember);
      assert.ok(implementationMember);
      assert.equal(
        executableMember.role === "signed_native_executable"
          || executableMember.role === "release_executable",
        true,
      );
      assert.equal(
        operation.moduleExport === null
          ? implementationMember.memberRef
            === executableMember.memberRef
          : implementationMember.requiredExports
            .includes(operation.moduleExport),
        true,
      );
      if (operation.implementationKind === "signed_native_executable") {
        assert.equal(
          operation.processLaunchPolicy,
          "exact_native_executable_then_fixed_application_argv_v2",
        );
        assert.equal(operation.interpreterPackageRef, null);
        assert.equal(operation.interpreterMemberRef, null);
      } else {
        assert.equal(
          operation.processLaunchPolicy,
          "exact_node_runtime_then_release_executable_then_fixed_application_argv_v2",
        );
        const interpreterPackage =
          PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages
            .find((entry) =>
              entry.packageRef === operation.interpreterPackageRef)!;
        assert.equal(
          interpreterPackage.members.find((entry) =>
            entry.memberRef === operation.interpreterMemberRef)?.role,
          "node_runtime",
        );
      }
      assert.equal(inputContract?.messageKind, "operation_input");
      assert.equal(
        inputContract?.transport,
        "preopened_read_only_fd3_exactly_once_v2",
      );
      assert.equal(outputContract?.messageKind, "operation_success");
      assert.equal(
        outputContract?.transport,
        "single_canonical_json_stdout_line_v2",
      );
      assert.equal(usedSchemaRefs.has(operation.inputSchema), false);
      assert.equal(usedSchemaRefs.has(operation.outputSchema), false);
      usedSchemaRefs.add(operation.inputSchema);
      usedSchemaRefs.add(operation.outputSchema);
    }

    assert.deepEqual(
      wireSet.schemas.map((entry) => entry.schemaRef),
      [
        ...usedSchemaRefs,
        PLATFORM_RELEASE_BOOTSTRAP_OPERATION_FAILURE_V2_SCHEMA,
      ].sort(),
    );
    const failureContract = getPlatformReleaseBootstrapWireSchemaContractV2(
      PLATFORM_RELEASE_BOOTSTRAP_OPERATION_FAILURE_V2_SCHEMA,
    );
    assert.equal(failureContract.messageKind, "operation_failure");
    assert.equal(
      failureContract.transport,
      "single_canonical_json_stdout_line_v2",
    );
    assert.ok(Object.isFrozen(failureContract.fields));
    assert.throws(() =>
      getPlatformReleaseBootstrapWireSchemaContractV2(
        "setfarm.platform-release-unknown-input.v2",
      ));
  });

  it("parses only strict self-hashed wire messages and enforces field relations", () => {
    const schemaRef =
      "setfarm.platform-release-lookup-local-account-receipt.v2";
    const absentIdentity = {
      schema: schemaRef,
      version: "2.0.0",
      occurrenceId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
      accountRef: "SETFARM_PLATFORM_RELEASE_RUNTIME_V2",
      recordState: "absent",
      uid: null,
      gid: null,
      userRecordUuid: null,
      groupRecordUuid: null,
      recordIdentityHash: null,
      hostIdentityHash: "a".repeat(64),
      observationHash: "b".repeat(64),
    };
    const absent = {
      ...absentIdentity,
      messageHash:
        hashPlatformReleaseBootstrapWireMessageV2(
          schemaRef,
          absentIdentity,
        ),
    };
    const parsed =
      parsePlatformReleaseBootstrapWireMessageV2(schemaRef, absent);
    assert.deepEqual(parsed, absent);
    assert.ok(Object.isFrozen(parsed));

    const inconsistent = {
      ...absent,
      uid: "601",
    };
    inconsistent.messageHash =
      hashPlatformReleaseBootstrapWireMessageV2(
        schemaRef,
        inconsistent,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapWireMessageV2(
        schemaRef,
        inconsistent,
      ));

    assert.throws(() =>
      parsePlatformReleaseBootstrapWireMessageV2(schemaRef, {
        ...absent,
        messageHash: "c".repeat(64),
      }));
    assert.throws(() =>
      parsePlatformReleaseBootstrapWireMessageV2(schemaRef, {
        ...absent,
        unexpected: true,
      }));
    assert.throws(() =>
      parsePlatformReleaseBootstrapWireMessageV2(
        "setfarm.platform-release-unknown-input.v2",
        absent,
      ));

    const outOfRangeIdentity = {
      ...absentIdentity,
      recordState: "present_exact",
      uid: "99999999999999999999",
      gid: "99999999999999999999",
      userRecordUuid: "BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB",
      groupRecordUuid: "CCCCCCCC-CCCC-4CCC-8CCC-CCCCCCCCCCCC",
      recordIdentityHash: "d".repeat(64),
    };
    assert.throws(() =>
      parsePlatformReleaseBootstrapWireMessageV2(schemaRef, {
        ...outOfRangeIdentity,
        messageHash:
          hashPlatformReleaseBootstrapWireMessageV2(
            schemaRef,
            outOfRangeIdentity,
          ),
      }));

    const applyContract =
      getPlatformReleaseBootstrapWireSchemaContractV2(
        "setfarm.platform-release-apply-local-account-input.v2",
      );
    const applyFields = applyContract.fields.map((entry) => entry.name);
    assert.equal(applyFields.includes("uid"), false);
    assert.equal(applyFields.includes("gid"), false);
    assert.equal(applyFields.includes("userRecordUuid"), false);
    assert.equal(applyFields.includes("groupRecordUuid"), false);
    assert.equal(applyFields.includes("planReceiptHash"), true);

    const planSchemaRef =
      "setfarm.platform-release-plan-local-account-input.v2";
    const planIdentity = {
      schema: planSchemaRef,
      version: "2.0.0",
      occurrenceId: "DDDDDDDD-DDDD-4DDD-8DDD-DDDDDDDDDDDD",
      accountRef: "SETFARM_PLATFORM_RELEASE_RUNTIME_V2",
      accountPolicyHash: "e".repeat(64),
      verifierPackageVerificationHash: "f".repeat(64),
      verifierSelfAttestationHash: "3".repeat(64),
      hostIdentityHash: "4".repeat(64),
    };
    const parsedPlan = parsePlatformReleaseBootstrapWireMessageV2(
      planSchemaRef,
      {
        ...planIdentity,
        messageHash:
          hashPlatformReleaseBootstrapWireMessageV2(
            planSchemaRef,
            planIdentity,
          ),
      },
    );
    assert.ok(Object.isFrozen(parsedPlan));

    const planReceiptSchemaRef =
      "setfarm.platform-release-plan-local-account-receipt.v2";
    const planReceiptIdentity = {
      schema: planReceiptSchemaRef,
      version: "2.0.0",
      occurrenceId: "EEEEEEEE-EEEE-4EEE-8EEE-EEEEEEEEEEEE",
      accountRef: "SETFARM_PLATFORM_RELEASE_RUNTIME_V2",
      uid: "601",
      gid: "601",
      userRecordUuid: "FFFFFFFF-FFFF-4FFF-8FFF-FFFFFFFFFFFF",
      groupRecordUuid: "11111111-1111-4111-8111-111111111111",
      absenceObservationBeforeReceiptHash: "5".repeat(64),
      absenceObservationAfterReceiptHash: "6".repeat(64),
      absenceObservationBeforeStateHash: "7".repeat(64),
      absenceObservationAfterStateHash: "7".repeat(64),
      absenceObservationSetHash: "8".repeat(64),
      intentHash: "9".repeat(64),
      hostIdentityHash: "a".repeat(64),
    };
    const parsedPlanReceipt =
      parsePlatformReleaseBootstrapWireMessageV2(
        planReceiptSchemaRef,
        {
          ...planReceiptIdentity,
          messageHash:
            hashPlatformReleaseBootstrapWireMessageV2(
              planReceiptSchemaRef,
              planReceiptIdentity,
            ),
        },
      );
    assert.ok(Object.isFrozen(parsedPlanReceipt));

    const repeatedObservationIdentity = {
      ...planReceiptIdentity,
      absenceObservationAfterReceiptHash:
        planReceiptIdentity.absenceObservationBeforeReceiptHash,
    };
    assert.throws(() =>
      parsePlatformReleaseBootstrapWireMessageV2(
        planReceiptSchemaRef,
        {
        ...repeatedObservationIdentity,
        messageHash:
          hashPlatformReleaseBootstrapWireMessageV2(
            planReceiptSchemaRef,
            repeatedObservationIdentity,
          ),
        },
      ));

    const unequalStateIdentity = {
      ...planReceiptIdentity,
      absenceObservationAfterStateHash: "b".repeat(64),
    };
    assert.throws(() =>
      parsePlatformReleaseBootstrapWireMessageV2(
        planReceiptSchemaRef,
        {
          ...unequalStateIdentity,
          messageHash:
            hashPlatformReleaseBootstrapWireMessageV2(
              planReceiptSchemaRef,
              unequalStateIdentity,
            ),
        },
      ));
  });

  it("models two physical system parents and one aliased xattr file", () => {
    const system =
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.systemAnchors;
    assert.deepEqual(
      system.parents.map((entry) => entry.absoluteLocator),
      ["/bin", "/usr/bin"],
    );
    assert.deepEqual(
      system.files.map((entry) => entry.absoluteLocator),
      [
        "/bin/chmod",
        "/bin/ls",
        "/usr/bin/sandbox-exec",
        "/usr/bin/xattr",
      ],
    );
    for (const file of system.files) {
      const parent = system.parents.find((entry) =>
        entry.parentRef === file.parentRef)!;
      assert.equal(
        path.posix.dirname(file.absoluteLocator),
        parent.absoluteLocator,
      );
    }
    const xattrBindings = system.logicalBindings.filter((entry) =>
      entry.roleRef.includes("XATTR_"));
    assert.equal(xattrBindings.length, 2);
    assert.equal(xattrBindings[0]!.fileRef, xattrBindings[1]!.fileRef);
    assert.equal(
      new Set(system.logicalBindings.map((entry) =>
        entry.fileRef)).size,
      4,
    );
  });

  it("keeps runtime identity code-owned while production signing truth remains honestly unavailable", () => {
    const contract = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2;
    assert.deepEqual(contract.runtimeAccount, {
      accountRef: "SETFARM_PLATFORM_RELEASE_RUNTIME_V2",
      userRecordName: "_setfarmrelease",
      groupRecordName: "_setfarmrelease",
      realName: "Setfarm Platform Release Runtime",
      homeDirectory: "/var/empty",
      userShell: "/usr/bin/false",
      passwordPolicy: "disabled_non_empty_marker_v2",
      hidden: true,
      uidGidPolicy:
        "lowest_equal_free_uid_gid_in_code_owned_range_v2",
      minimumUidGid: 600,
      maximumUidGid: 699,
      lookupAbiRef:
        "ABI_PLATFORM_RELEASE_LOOKUP_LOCAL_ACCOUNT_V2",
      mutationAbiRefs: [
        "ABI_PLATFORM_RELEASE_APPLY_LOCAL_ACCOUNT_V2",
        "ABI_PLATFORM_RELEASE_PLAN_LOCAL_ACCOUNT_V2",
        "ABI_PLATFORM_RELEASE_ROLLBACK_LOCAL_ACCOUNT_V2",
      ],
      lifecyclePolicy:
        "double_absence_preclaim_native_mutation_double_observation_receipt_last_v2",
      adoptionPolicy:
        "receipt_or_matching_active_preclaim_only_v2",
    });
    assert.equal(
      contract.productionTrust.authorityState,
      "production_trust_configuration_unavailable",
    );
    assert.equal(
      contract.productionTrust.productionAdmission,
      "forbidden",
    );
    assert.deepEqual(contract.productionTrust.blockerCodes, [
      "DEVELOPER_ID_TEAM_UNCONFIGURED",
      "DESIGNATED_REQUIREMENT_UNCONFIGURED",
      "INSTALLER_PACKAGE_ID_UNCONFIGURED",
      "OFFLINE_RELEASE_PUBLIC_KEY_UNCONFIGURED",
      "SIGNED_NATIVE_DISTRIBUTION_CATALOG_EMPTY",
    ]);
    const serialized = JSON.stringify(contract.productionTrust);
    assert.equal(serialized.includes("developerTeamId\":"), false);
    assert.equal(serialized.includes("offlineReleasePublicKey\":"), false);
  });

  it("rejects rehashed topology edits, unknown fields and attempted production promotion", () => {
    const moved = mutableClone(
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
    );
    moved.packages[0]!.root =
      "/Library/Application Support/Setfarm/bootstrap/forged-verifier";
    moved.contractHash = hashPlatformReleaseBootstrapContractV2(moved);
    assert.equal(
      PlatformReleaseBootstrapContractV2Schema.safeParse(moved).success,
      false,
    );

    const promoted = mutableClone(
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
    );
    (promoted.productionTrust as {
      productionAdmission: string;
    }).productionAdmission = "allowed";
    promoted.contractHash =
      hashPlatformReleaseBootstrapContractV2(promoted);
    assert.equal(
      PlatformReleaseBootstrapContractV2Schema.safeParse(promoted).success,
      false,
    );

    const unknown = {
      ...mutableClone(PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2),
      pathOverride: "/tmp/forged",
    };
    assert.equal(
      PlatformReleaseBootstrapContractV2Schema.safeParse(unknown)
        .success,
      false,
    );

    const changedAbi = mutableClone(
      PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2,
    );
    changedAbi.operations[0]!.timeoutMs = 1;
    changedAbi.operations[0]!.operationHash =
      hashPlatformReleaseBootstrapOperationAbiV2(
        changedAbi.operations[0]!,
      );
    changedAbi.abiSetHash =
      hashPlatformReleaseBootstrapOperationAbiSetV2(changedAbi);
    assert.equal(
      PlatformReleaseBootstrapOperationAbiSetV2Schema.safeParse(
        changedAbi,
      ).success,
      false,
    );

    const changedWire = mutableClone(
      PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2,
    );
    changedWire.schemas[0]!.maxCanonicalBytes = 1;
    changedWire.schemas[0]!.wireSchemaHash =
      hashPlatformReleaseBootstrapWireSchemaContractV2(
        changedWire.schemas[0]!,
      );
    changedWire.contractSetHash =
      hashPlatformReleaseBootstrapWireContractSetV2(changedWire);
    assert.equal(
      PlatformReleaseBootstrapWireContractSetV2Schema.safeParse(
        changedWire,
      ).success,
      false,
    );

    const changedRegistryProtocols = mutableClone(
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_V2,
    );
    changedRegistryProtocols.documents[0]!.maxCanonicalBytes = 1;
    changedRegistryProtocols.documents[0]!.documentSchemaHash =
      hashPlatformReleaseBootstrapRegistryDocumentProtocolV2(
        changedRegistryProtocols.documents[0]!,
      );
    changedRegistryProtocols.catalogHash =
      hashPlatformReleaseBootstrapRegistryDocumentProtocolCatalogV2(
        changedRegistryProtocols,
      );
    assert.equal(
      PlatformReleaseBootstrapRegistryDocumentProtocolCatalogV2Schema
        .safeParse(changedRegistryProtocols).success,
      false,
    );
  });

  it("takes bounded plain-data snapshots without executing proxy or accessor traps", () => {
    let proxyTrapExecuted = false;
    const proxy = new Proxy({}, {
      ownKeys() {
        proxyTrapExecuted = true;
        throw new Error("proxy trap must not execute");
      },
    });
    assert.throws(() =>
      parsePlatformReleaseBootstrapContractCandidateV2(proxy));
    assert.equal(proxyTrapExecuted, false);
    assert.throws(() =>
      parsePlatformReleaseBootstrapWireContractSetCandidateV2(proxy));
    assert.equal(proxyTrapExecuted, false);
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryDocumentProtocolCatalogCandidateV2(
        proxy,
      ));
    assert.equal(proxyTrapExecuted, false);

    let getterExecuted = false;
    const accessor = {};
    Object.defineProperty(accessor, "schema", {
      enumerable: true,
      get() {
        getterExecuted = true;
        throw new Error("getter must not execute");
      },
    });
    assert.throws(() =>
      parsePlatformReleaseBootstrapContractCandidateV2(accessor));
    assert.equal(getterExecuted, false);
    assert.throws(() =>
      parsePlatformReleaseBootstrapWireMessageV2(
        "setfarm.platform-release-self-attest-input.v2",
        accessor,
      ));
    assert.equal(getterExecuted, false);

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    assert.throws(() =>
      parsePlatformReleaseBootstrapContractCandidateV2(cyclic));
    assert.throws(() =>
      parsePlatformReleaseBootstrapOperationAbiSetCandidateV2({
        ...mutableClone(
          PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2,
        ),
        oversized: "x".repeat(300 * 1024),
      }));
  });
});

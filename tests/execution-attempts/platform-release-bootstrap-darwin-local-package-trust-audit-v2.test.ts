import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  buildPlatformReleaseBootstrapDarwinLocalPackageTrustAuditFixtureForTestV2,
  observePlatformReleaseBootstrapDarwinLocalPackageTrustAuditForTestV2,
  PlatformReleaseBootstrapDarwinLocalPackageTrustAuditErrorV2,
} from "../../src/product-compiler/platform-release-bootstrap-darwin-local-package-trust-audit-test-support-v2.js";
import {
  hashPlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2,
  PlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2Schema,
  parsePlatformReleaseBootstrapDarwinLocalPackageTrustAuditCandidateV2,
} from "../../src/execution/schemas/platform-release-bootstrap-darwin-local-package-trust-audit-v2.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";

describe("Darwin local unsigned package trust audit v2", () => {
  it("observes signature, install assessment, local notarization, and receipt absence without authority", {
    skip: process.platform !== "darwin",
  }, async () => {
    const fixture = buildPlatformReleaseBootstrapDarwinLocalPackageTrustAuditFixtureForTestV2();
    try {
      const audit = await observePlatformReleaseBootstrapDarwinLocalPackageTrustAuditForTestV2(
        fixture,
        {
          challenge: Buffer.alloc(32, 0x31),
          hostIdentityHash: createHash("sha256").update("live-host-scope-v2").digest("hex"),
        },
      );
      assert.equal(audit.admissionScope, "test_fixture");
      assert.equal(audit.authorityScope, "diagnostic_observation_only");
      assert.equal(audit.productionAuthority, false);
      assert.equal(audit.productionAdmission, "forbidden");
      assert.equal(audit.credentialUse, "none");
      assert.equal(audit.mutationAuthority, false);
      assert.equal(audit.trustConclusion, "characterization_only");
      assert.equal(audit.targetBinding, "pathname_only_unproven");
      assert.equal(
        audit.amfiRuntimeAdmission.reason,
        "requires_authenticated_running_helper",
      );
      assert.equal(audit.packageIdentifier, fixture.packageIdentifier);
      assert.equal(audit.fixtureSetup.kind, "pkgbuild_fixture");
      assert.deepEqual(
        audit.commands.map((command) => command.kind),
        [
          "pkgutil_receipt_before",
          "pkgutil_check_signature",
          "spctl_install_assessment",
          "stapler_validate",
          "pkgutil_receipt_after",
        ],
      );
      assert.equal(audit.packageBefore.observationHash, audit.packageAfter.observationHash);
      assert.equal(audit.packageBefore.stableIdentity.device, audit.packageAfter.stableIdentity.device);
      assert.equal(audit.packageBefore.stableIdentity.inode, audit.packageAfter.stableIdentity.inode);
      assert.equal(audit.packageBefore.mutableFingerprint.contentHash, audit.packageAfter.mutableFingerprint.contentHash);
      assert.equal(audit.installerReceipt.before, "absent");
      assert.equal(audit.installerReceipt.after, "absent");
      assert.notEqual(audit.packageSignature.conclusion, "accepted");
      assert.notEqual(audit.gatekeeperInstallAssessment.conclusion, "accepted");
      assert.notEqual(audit.notarization.conclusion, "accepted");
      assert.ok(audit.blockerCodes.includes("DEVELOPER_ID_INSTALLER_UNPROVEN"));
      assert.ok(audit.blockerCodes.includes("INSTALLER_RECEIPT_ABSENT"));
      assert.ok(audit.blockerCodes.includes("AMFI_RUNTIME_ADMISSION_UNAVAILABLE_REQUIRES_RUNNING_HELPER"));
      assert.ok(audit.blockerCodes.includes("GATEKEEPER_INSTALL_ASSESSMENT_UNPROVEN"));
      assert.ok(audit.blockerCodes.includes("COMMAND_TARGET_EXACT_OBJECT_UNPROVEN"));
      assert.equal(
        PlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2Schema.safeParse(audit).success,
        true,
      );
      assert.equal(
        parsePlatformReleaseBootstrapDarwinLocalPackageTrustAuditCandidateV2(audit).auditHash,
        audit.auditHash,
      );
    } finally {
      fixture.dispose();
    }
  });

  it("rejects malformed challenge and authority-bearing or reordered audit receipts", {
    skip: process.platform !== "darwin",
  }, async () => {
    const fixture = buildPlatformReleaseBootstrapDarwinLocalPackageTrustAuditFixtureForTestV2();
    try {
      await assert.rejects(
        observePlatformReleaseBootstrapDarwinLocalPackageTrustAuditForTestV2(
          fixture,
          { challenge: Buffer.alloc(31) },
        ),
        (error: unknown) =>
          error instanceof PlatformReleaseBootstrapDarwinLocalPackageTrustAuditErrorV2
          && error.code === "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_PROBE_FAILED",
      );
      const audit = await observePlatformReleaseBootstrapDarwinLocalPackageTrustAuditForTestV2(
        fixture,
        { challenge: Buffer.alloc(32, 0x41) },
      );
      const forged = structuredClone(audit) as Record<string, unknown>;
      forged.productionAuthority = true;
      assert.equal(
        PlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2Schema.safeParse(forged).success,
        false,
      );
      const forgedConclusion = structuredClone(audit) as Record<string, any>;
      forgedConclusion.packageSignature.conclusion = "accepted";
      delete forgedConclusion.auditHash;
      forgedConclusion.auditHash = hashPlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2(
        forgedConclusion as never,
      );
      assert.equal(
        PlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2Schema.safeParse(forgedConclusion).success,
        false,
      );
      const forgedExecutable = structuredClone(audit) as Record<string, any>;
      forgedExecutable.commands[1].executable = "/usr/bin/pkgbuild";
      const command = forgedExecutable.commands[1];
      const commandIdentity = {
        kind: command.kind,
        executable: command.executable,
        argvRef: command.argvRef,
        argvHash: command.argvHash,
        cwdLocator: command.cwdLocator,
        environmentPolicy: command.environmentPolicy,
        status: command.status,
        exitCode: command.exitCode,
        signal: command.signal,
        stdoutByteLength: command.stdoutByteLength,
        stderrByteLength: command.stderrByteLength,
        stdoutHash: command.stdoutHash,
        stderrHash: command.stderrHash,
      };
      command.observationHash = hashCanonicalJson({
        schema: "setfarm.platform-release-bootstrap-darwin-local-package-trust-audit-command-observation-hash.v2",
        ...commandIdentity,
      });
      delete forgedExecutable.auditHash;
      forgedExecutable.auditHash = hashPlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2(
        forgedExecutable as never,
      );
      assert.equal(
        PlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2Schema.safeParse(forgedExecutable).success,
        false,
      );
      const reordered = structuredClone(audit) as Record<string, unknown>;
      reordered.commands = [audit.commands[0], audit.commands[2], audit.commands[1], audit.commands[3], audit.commands[4]];
      assert.equal(
        PlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2Schema.safeParse(reordered).success,
        false,
      );
      const drifted = structuredClone(audit) as Record<string, any>;
      drifted.packageAfter.stableIdentity.inode = "999999999";
      assert.equal(
        PlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2Schema.safeParse(drifted).success,
        false,
      );
      const forgedReceiptHash = structuredClone(audit) as Record<string, any>;
      forgedReceiptHash.commands[0].stdoutHash = "0".repeat(64);
      const forgedReceiptHashCommand = forgedReceiptHash.commands[0];
      forgedReceiptHashCommand.observationHash = hashCanonicalJson({
        schema: "setfarm.platform-release-bootstrap-darwin-local-package-trust-audit-command-observation-hash.v2",
        kind: forgedReceiptHashCommand.kind,
        executable: forgedReceiptHashCommand.executable,
        argvRef: forgedReceiptHashCommand.argvRef,
        argvHash: forgedReceiptHashCommand.argvHash,
        cwdLocator: forgedReceiptHashCommand.cwdLocator,
        environmentPolicy: forgedReceiptHashCommand.environmentPolicy,
        status: forgedReceiptHashCommand.status,
        exitCode: forgedReceiptHashCommand.exitCode,
        signal: forgedReceiptHashCommand.signal,
        stdoutByteLength: forgedReceiptHashCommand.stdoutByteLength,
        stderrByteLength: forgedReceiptHashCommand.stderrByteLength,
        stdoutHash: forgedReceiptHashCommand.stdoutHash,
        stderrHash: forgedReceiptHashCommand.stderrHash,
      });
      forgedReceiptHash.installerReceipt.beforeCommandHash = forgedReceiptHashCommand.observationHash;
      delete forgedReceiptHash.auditHash;
      forgedReceiptHash.auditHash = hashPlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2(
        forgedReceiptHash as never,
      );
      assert.equal(
        PlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2Schema.safeParse(forgedReceiptHash).success,
        false,
      );
      const forgedReceiptLength = structuredClone(audit) as Record<string, any>;
      forgedReceiptLength.commands[0].stderrByteLength = 999;
      const forgedReceiptLengthCommand = forgedReceiptLength.commands[0];
      forgedReceiptLengthCommand.observationHash = hashCanonicalJson({
        schema: "setfarm.platform-release-bootstrap-darwin-local-package-trust-audit-command-observation-hash.v2",
        kind: forgedReceiptLengthCommand.kind,
        executable: forgedReceiptLengthCommand.executable,
        argvRef: forgedReceiptLengthCommand.argvRef,
        argvHash: forgedReceiptLengthCommand.argvHash,
        cwdLocator: forgedReceiptLengthCommand.cwdLocator,
        environmentPolicy: forgedReceiptLengthCommand.environmentPolicy,
        status: forgedReceiptLengthCommand.status,
        exitCode: forgedReceiptLengthCommand.exitCode,
        signal: forgedReceiptLengthCommand.signal,
        stdoutByteLength: forgedReceiptLengthCommand.stdoutByteLength,
        stderrByteLength: forgedReceiptLengthCommand.stderrByteLength,
        stdoutHash: forgedReceiptLengthCommand.stdoutHash,
        stderrHash: forgedReceiptLengthCommand.stderrHash,
      });
      forgedReceiptLength.installerReceipt.beforeCommandHash = forgedReceiptLengthCommand.observationHash;
      delete forgedReceiptLength.auditHash;
      forgedReceiptLength.auditHash = hashPlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2(
        forgedReceiptLength as never,
      );
      assert.equal(
        PlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2Schema.safeParse(forgedReceiptLength).success,
        false,
      );
      const forgedLinkCount = structuredClone(audit) as Record<string, any>;
      forgedLinkCount.packageBefore.mutableFingerprint.linkCount = 2;
      forgedLinkCount.packageBefore.observationHash = hashCanonicalJson({
        schema: "setfarm.platform-release-bootstrap-darwin-local-package-trust-audit-target-observation-hash.v2",
        stableIdentity: forgedLinkCount.packageBefore.stableIdentity,
        mutableFingerprint: forgedLinkCount.packageBefore.mutableFingerprint,
      });
      forgedLinkCount.packageAfter = structuredClone(forgedLinkCount.packageBefore);
      delete forgedLinkCount.auditHash;
      forgedLinkCount.auditHash = hashPlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2(
        forgedLinkCount as never,
      );
      assert.equal(
        PlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2Schema.safeParse(forgedLinkCount).success,
        false,
      );
      const forgedPresentReceiptOutput = structuredClone(audit) as Record<string, any>;
      const emptyHash = createHash("sha256").update(Buffer.alloc(0)).digest("hex");
      const rehashCommand = (command: Record<string, any>): void => {
        command.observationHash = hashCanonicalJson({
          schema: "setfarm.platform-release-bootstrap-darwin-local-package-trust-audit-command-observation-hash.v2",
          kind: command.kind,
          executable: command.executable,
          argvRef: command.argvRef,
          argvHash: command.argvHash,
          cwdLocator: command.cwdLocator,
          environmentPolicy: command.environmentPolicy,
          status: command.status,
          exitCode: command.exitCode,
          signal: command.signal,
          stdoutByteLength: command.stdoutByteLength,
          stderrByteLength: command.stderrByteLength,
          stdoutHash: command.stdoutHash,
          stderrHash: command.stderrHash,
        });
      };
      for (const [index, marker] of [[0, "before"], [4, "after"]] as const) {
        const command = forgedPresentReceiptOutput.commands[index];
        command.exitCode = 0;
        command.signal = null;
        command.stdoutByteLength = 1;
        command.stdoutHash = createHash("sha256").update(`receipt-${marker}`).digest("hex");
        command.stderrByteLength = 0;
        command.stderrHash = emptyHash;
        rehashCommand(command);
      }
      forgedPresentReceiptOutput.installerReceipt.before = "present";
      forgedPresentReceiptOutput.installerReceipt.after = "present";
      forgedPresentReceiptOutput.installerReceipt.beforeCommandHash =
        forgedPresentReceiptOutput.commands[0].observationHash;
      forgedPresentReceiptOutput.installerReceipt.afterCommandHash =
        forgedPresentReceiptOutput.commands[4].observationHash;
      forgedPresentReceiptOutput.blockerCodes = forgedPresentReceiptOutput.blockerCodes
        .filter((code: string) => code !== "INSTALLER_RECEIPT_ABSENT")
        .concat("INSTALLER_RECEIPT_PAYLOAD_UNBOUND")
        .sort();
      delete forgedPresentReceiptOutput.auditHash;
      forgedPresentReceiptOutput.auditHash = hashPlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2(
        forgedPresentReceiptOutput as never,
      );
      assert.equal(
        PlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2Schema.safeParse(forgedPresentReceiptOutput).success,
        false,
      );
    } finally {
      fixture.dispose();
    }
  });

  it("rejects a fixture handle not issued by the code-owned builder", {
    skip: process.platform !== "darwin",
  }, async () => {
    const fixture = buildPlatformReleaseBootstrapDarwinLocalPackageTrustAuditFixtureForTestV2();
    try {
      const forgedHandle = {
        packageIdentifier: fixture.packageIdentifier,
        dispose: fixture.dispose,
      };
      await assert.rejects(
        observePlatformReleaseBootstrapDarwinLocalPackageTrustAuditForTestV2(
          forgedHandle as never,
          { challenge: Buffer.alloc(32, 0x51) },
        ),
        (error: unknown) =>
          error instanceof PlatformReleaseBootstrapDarwinLocalPackageTrustAuditErrorV2
          && error.code === "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_FIXTURE_HANDLE_UNAUTHENTICATED",
      );
    } finally {
      fixture.dispose();
    }
  });
});

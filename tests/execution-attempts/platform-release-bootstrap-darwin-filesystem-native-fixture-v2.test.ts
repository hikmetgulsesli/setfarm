import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  closeSync,
  constants,
  linkSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import { buildBootstrapFilesystemScopeIdentityV2 } from "../../src/product-compiler/platform-release-bootstrap-physical-census-v2.js";

const repositoryRoot = realpathSync(path.resolve(import.meta.dirname, "../.."));
const builder = path.join(
  repositoryRoot,
  "scripts/build-platform-release-bootstrap-darwin-filesystem-fixture-v2.mjs",
);
const stageBasename = ".setfarm-bootstrap-filesystem-scope-v2.stage";
const targetBasename = "setfarm-bootstrap-filesystem-scope-v2.json";
const checkpoints = Object.freeze([
  "after_stage_write",
  "after_stage_fullsync",
  "after_parent_fullsync_before_link",
  "after_link",
  "after_target_fullsync",
  "after_parent_fullsync_before_unlink",
  "after_unlink",
  "after_final_parent_fullsync",
] as const);

type NativeInvocationV2 = Readonly<{
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timing: string;
}>;

type TimingReceiptV2 = Readonly<{
  admissionScope: "test_fixture";
  characterizationClaim: "syscall_return_latency_not_power_loss_proof";
  checkpoint: string;
  clock: "CLOCK_MONOTONIC_RAW";
  completedFullSyncCount: number;
  elapsedNanoseconds: string;
  fullSyncSamples: ReadonlyArray<Readonly<{
    durationNanoseconds: string;
    ordinal: number;
    replayState: string;
    role: string;
  }>>;
  payloadByteLength: number;
  productionAuthority: false;
  recordingTruncated: false;
  schema: "setfarm.platform-release-bootstrap-filesystem-fixture-timing.v2";
  timingAuthority: "characterization_only_no_sla";
}>;

let buildRootAlias = "";
let buildRoot = "";
let fixtureBinary = "";

function exactScopeBytes(character: string): Buffer {
  return Buffer.from(
    canonicalJsonStringify(
      buildBootstrapFilesystemScopeIdentityV2({
        scopeNonce: character.repeat(64),
      }),
    ),
    "utf8",
  );
}

function maximumFixturePayload(): Buffer {
  return Buffer.from(`"${"x".repeat(65_534)}"`, "utf8");
}

function privateParent(): Readonly<{
  alias: string;
  parent: string;
  stage: string;
  target: string;
}> {
  const alias = mkdtempSync(
    path.join(os.tmpdir(), "setfarm-darwin-native-scope-v2-"),
  );
  const parent = realpathSync(alias);
  chmodSync(parent, 0o700);
  return Object.freeze({
    alias,
    parent,
    stage: path.join(parent, stageBasename),
    target: path.join(parent, targetBasename),
  });
}

async function invokeNative(
  parent: string,
  checkpoint:
    | "none"
    | (typeof checkpoints)[number]
    | `timing_${"none" | (typeof checkpoints)[number]}`,
  bytes: Uint8Array,
  closeTimingReader = false,
): Promise<NativeInvocationV2> {
  const parentDescriptor = openSync(
    parent,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    const child = spawn(fixtureBinary, [], {
      cwd: buildRoot,
      env: { LANG: "C", LC_ALL: "C", TZ: "UTC" },
      shell: false,
      stdio: ["pipe", "pipe", "pipe", parentDescriptor, "pipe"],
      windowsHide: true,
    });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let timing = Buffer.alloc(0);
    child.stdout!.on("data", (chunk: Buffer) => {
      stdout = Buffer.concat([stdout, chunk]);
      if (stdout.byteLength > 64 * 1024) child.kill("SIGKILL");
    });
    child.stderr!.on("data", (chunk: Buffer) => {
      stderr = Buffer.concat([stderr, chunk]);
      if (stderr.byteLength > 64 * 1024) child.kill("SIGKILL");
    });
    child.stdio[4]!.on("data", (chunk: Buffer) => {
      timing = Buffer.concat([timing, chunk]);
      if (timing.byteLength > 64 * 1024) child.kill("SIGKILL");
    });
    if (closeTimingReader) child.stdio[4]!.destroy();
    child.stdin!.end(
      Buffer.concat([
        Buffer.from(`${checkpoint}\n`, "utf8"),
        Buffer.from(bytes),
      ]),
    );
    const exit = await new Promise<Readonly<{
      code: number | null;
      signal: NodeJS.Signals | null;
    }>>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => resolve({ code, signal }));
    });
    return Object.freeze({
      ...exit,
      stdout: stdout.toString("utf8"),
      stderr: stderr.toString("utf8"),
      timing: timing.toString("utf8"),
    });
  } finally {
    closeSync(parentDescriptor);
  }
}

function parseTimingReceipt(
  output: string,
  checkpoint: string,
  payloadByteLength: number,
  expectedRoles: readonly string[],
): TimingReceiptV2 {
  assert.equal(Buffer.byteLength(output, "utf8") <= 8 * 1024, true);
  assert.equal(output.endsWith("\n"), true);
  assert.equal(output.indexOf("\n"), output.length - 1);
  const receipt = JSON.parse(output) as TimingReceiptV2;
  assert.equal(output.slice(0, -1), canonicalJsonStringify(receipt));
  assert.deepEqual(Object.keys(receipt), [
    "admissionScope",
    "characterizationClaim",
    "checkpoint",
    "clock",
    "completedFullSyncCount",
    "elapsedNanoseconds",
    "fullSyncSamples",
    "payloadByteLength",
    "productionAuthority",
    "recordingTruncated",
    "schema",
    "timingAuthority",
  ]);
  assert.equal(receipt.admissionScope, "test_fixture");
  assert.equal(
    receipt.characterizationClaim,
    "syscall_return_latency_not_power_loss_proof",
  );
  assert.equal(receipt.checkpoint, checkpoint);
  assert.equal(receipt.clock, "CLOCK_MONOTONIC_RAW");
  assert.equal(receipt.completedFullSyncCount, expectedRoles.length);
  assert.equal(receipt.payloadByteLength, payloadByteLength);
  assert.equal(receipt.productionAuthority, false);
  assert.equal(receipt.recordingTruncated, false);
  assert.equal(
    receipt.schema,
    "setfarm.platform-release-bootstrap-filesystem-fixture-timing.v2",
  );
  assert.equal(receipt.timingAuthority, "characterization_only_no_sla");
  assert.match(receipt.elapsedNanoseconds, /^(?:0|[1-9][0-9]*)$/);
  const elapsedNanoseconds = BigInt(receipt.elapsedNanoseconds);
  let totalFullSyncNanoseconds = 0n;
  const replayStateByRole: Readonly<Record<string, string>> = Object.freeze({
    stage_after_write: "stage_only",
    stage_before_link: "stage_only",
    parent_before_link: "stage_only",
    target_before_unlink: "overlap",
    parent_before_unlink: "overlap",
    parent_after_unlink: "overlap",
    target_final_revalidation: "final_only",
    parent_final_revalidation: "final_only",
  });
  assert.deepEqual(
    receipt.fullSyncSamples.map((sample) => sample.role),
    expectedRoles,
  );
  for (const [ordinal, sample] of receipt.fullSyncSamples.entries()) {
    assert.deepEqual(Object.keys(sample), [
      "durationNanoseconds",
      "ordinal",
      "replayState",
      "role",
    ]);
    assert.equal(sample.ordinal, ordinal);
    assert.match(sample.durationNanoseconds, /^(?:0|[1-9][0-9]*)$/);
    assert.equal(sample.replayState, replayStateByRole[sample.role]);
    totalFullSyncNanoseconds += BigInt(sample.durationNanoseconds);
  }
  assert.equal(elapsedNanoseconds >= totalFullSyncNanoseconds, true);
  return receipt;
}

function assertMissing(target: string): void {
  assert.throws(
    () => lstatSync(target),
    (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "ENOENT",
  );
}

before(() => {
  if (process.platform !== "darwin") return;
  buildRootAlias = mkdtempSync(
    path.join(os.tmpdir(), "setfarm-darwin-native-scope-build-v2-"),
  );
  buildRoot = realpathSync(buildRootAlias);
  chmodSync(buildRoot, 0o700);
  fixtureBinary = path.join(buildRoot, "fixture");
  const built = spawnSync(
    process.execPath,
    [builder, "--out-file", fixtureBinary],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin", TZ: "UTC" },
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  assert.equal(built.status, 0, built.stderr);
  const receipt = JSON.parse(built.stdout) as {
    admissionScope: string;
    productionAuthority: boolean;
    signingAuthority: string;
  };
  assert.deepEqual(receipt, {
    ...receipt,
    admissionScope: "test_fixture",
    productionAuthority: false,
    signingAuthority: "adhoc_or_unsigned_test_fixture",
  });
});

after(() => {
  if (buildRootAlias !== "") {
    rmSync(buildRootAlias, { recursive: true, force: true });
  }
});

describe("Darwin fixed-scope native publication fixture v2", () => {
  for (const checkpoint of checkpoints) {
    it(`converges through a real SIGKILL at ${checkpoint}`, {
      skip: process.platform !== "darwin",
    }, async () => {
      const fixture = privateParent();
      const bytes = exactScopeBytes("a");
      try {
        const killed = await invokeNative(
          fixture.parent,
          checkpoint,
          bytes,
        );
        assert.equal(killed.code, null, killed.stderr);
        assert.equal(killed.signal, "SIGKILL", killed.stderr);

        const replay = await invokeNative(fixture.parent, "none", bytes);
        assert.equal(replay.code, 0, replay.stderr);
        assert.equal(replay.signal, null);
        assert.equal(replay.stdout.endsWith("\n"), true);
        const result = JSON.parse(replay.stdout) as Record<string, unknown>;
        assert.deepEqual(Object.keys(result).sort(), [
          "admissionScope",
          "byteLength",
          "capability",
          "changedNanoseconds",
          "changedSeconds",
          "device",
          "finalState",
          "initialState",
          "inode",
          "linkCount",
          "mode",
          "modifiedNanoseconds",
          "modifiedSeconds",
          "objectKind",
          "ownerGid",
          "ownerUid",
          "productionAuthority",
          "schema",
          "signingAuthority",
        ]);
        assert.equal(
          result.schema,
          "setfarm.platform-release-bootstrap-filesystem-fixture-result.v2",
        );
        assert.equal(result.admissionScope, "test_fixture");
        assert.equal(
          result.capability,
          "darwin_fixed_scope_publication_fixture_v2",
        );
        assert.equal(result.productionAuthority, false);
        assert.equal(
          result.signingAuthority,
          "adhoc_or_unsigned_test_fixture",
        );
        assert.equal(result.finalState, "final_only");
        assert.equal(result.objectKind, "ordinary_file");
        assert.equal(result.linkCount, 1);
        assert.equal(result.byteLength, bytes.byteLength);
        assert.equal(result.mode, "0600");
        assert.deepEqual(readFileSync(fixture.target), bytes);
        assertMissing(fixture.stage);
        const target = lstatSync(fixture.target, { bigint: true });
        assert.equal(result.device, target.dev.toString());
        assert.equal(result.inode, target.ino.toString());
        assert.equal(target.nlink, 1n);

        const stableReplay = await invokeNative(
          fixture.parent,
          "none",
          bytes,
        );
        assert.equal(stableReplay.code, 0, stableReplay.stderr);
        const stableResult = JSON.parse(stableReplay.stdout) as Record<string, unknown>;
        assert.equal(stableResult.initialState, "final_only");
        assert.equal(stableResult.inode, result.inode);
      } finally {
        bytes.fill(0);
        rmSync(fixture.alias, { recursive: true, force: true });
      }
    });
  }

  it("characterizes every F_FULLFSYNC and whole-run latency at the exact payload cap without asserting an SLA", {
    skip: process.platform !== "darwin",
  }, async () => {
    const fullRoles = Object.freeze([
      "stage_after_write",
      "stage_before_link",
      "parent_before_link",
      "target_before_unlink",
      "parent_before_unlink",
      "parent_after_unlink",
      "target_final_revalidation",
      "parent_final_revalidation",
    ] as const);
    const killedRoles: Readonly<Record<
      (typeof checkpoints)[number],
      readonly string[]
    >> = Object.freeze({
      after_stage_write: fullRoles.slice(0, 0),
      after_stage_fullsync: fullRoles.slice(0, 1),
      after_parent_fullsync_before_link: fullRoles.slice(0, 3),
      after_link: fullRoles.slice(0, 3),
      after_target_fullsync: fullRoles.slice(0, 4),
      after_parent_fullsync_before_unlink: fullRoles.slice(0, 5),
      after_unlink: fullRoles.slice(0, 5),
      after_final_parent_fullsync: fullRoles.slice(0, 6),
    });
    const recoveryRoles: Readonly<Record<
      (typeof checkpoints)[number],
      readonly string[]
    >> = Object.freeze({
      after_stage_write: fullRoles.slice(1),
      after_stage_fullsync: fullRoles.slice(1),
      after_parent_fullsync_before_link: fullRoles.slice(1),
      after_link: fullRoles.slice(3),
      after_target_fullsync: fullRoles.slice(3),
      after_parent_fullsync_before_unlink: fullRoles.slice(3),
      after_unlink: fullRoles.slice(6),
      after_final_parent_fullsync: fullRoles.slice(6),
    });
    const bytes = maximumFixturePayload();
    assert.equal(bytes.byteLength, 65_536);
    try {
      for (const checkpoint of checkpoints) {
        const fixture = privateParent();
        try {
          const killed = await invokeNative(
            fixture.parent,
            `timing_${checkpoint}`,
            bytes,
          );
          assert.equal(killed.code, null, killed.stderr);
          assert.equal(killed.signal, "SIGKILL", killed.stderr);
          assert.equal(killed.stdout, "");
          assert.equal(killed.stderr, "");
          parseTimingReceipt(
            killed.timing,
            checkpoint,
            bytes.byteLength,
            killedRoles[checkpoint],
          );

          const recovery = await invokeNative(
            fixture.parent,
            "timing_none",
            bytes,
          );
          assert.equal(recovery.code, 0, recovery.stderr);
          assert.equal(recovery.signal, null);
          assert.equal(recovery.stderr, "");
          parseTimingReceipt(
            recovery.timing,
            "completed",
            bytes.byteLength,
            recoveryRoles[checkpoint],
          );
          const result = JSON.parse(recovery.stdout) as Record<string, unknown>;
          assert.equal(result.productionAuthority, false);
          assert.equal(result.finalState, "final_only");
          assert.equal(result.byteLength, bytes.byteLength);
          assert.deepEqual(readFileSync(fixture.target), bytes);
          assertMissing(fixture.stage);
        } finally {
          rmSync(fixture.alias, { recursive: true, force: true });
        }
      }

      const fresh = privateParent();
      try {
        const completed = await invokeNative(
          fresh.parent,
          "timing_none",
          bytes,
        );
        assert.equal(completed.code, 0, completed.stderr);
        assert.equal(completed.signal, null);
        assert.equal(completed.stderr, "");
        parseTimingReceipt(
          completed.timing,
          "completed",
          bytes.byteLength,
          fullRoles,
        );
        assert.deepEqual(readFileSync(fresh.target), bytes);
        assertMissing(fresh.stage);
      } finally {
        rmSync(fresh.alias, { recursive: true, force: true });
      }

      const oversized = privateParent();
      const oversizedBytes = Buffer.concat([bytes, Buffer.from("x", "utf8")]);
      try {
        assert.equal(oversizedBytes.byteLength, 65_537);
        const rejected = await invokeNative(
          oversized.parent,
          "timing_none",
          oversizedBytes,
        );
        assert.equal(rejected.code, 65, rejected.stderr);
        assert.equal(rejected.signal, null);
        assert.equal(rejected.stdout, "");
        assert.equal(rejected.timing, "");
        assert.match(rejected.stderr, /^fixture_stdin_frame_invalid\n$/);
        assertMissing(oversized.stage);
        assertMissing(oversized.target);
      } finally {
        oversizedBytes.fill(0);
        rmSync(oversized.alias, { recursive: true, force: true });
      }

      const closedTimingChannel = privateParent();
      try {
        const rejected = await invokeNative(
          closedTimingChannel.parent,
          "timing_after_stage_write",
          bytes,
          true,
        );
        assert.equal(rejected.code, 74, rejected.stderr);
        assert.equal(rejected.signal, null);
        assert.equal(rejected.stdout, "");
        assert.equal(rejected.stderr, "");
        assert.equal(rejected.timing, "");
        assert.equal(lstatSync(closedTimingChannel.stage).size, bytes.byteLength);
        assertMissing(closedTimingChannel.target);

        const recovery = await invokeNative(
          closedTimingChannel.parent,
          "none",
          bytes,
        );
        assert.equal(recovery.code, 0, recovery.stderr);
        assert.equal(recovery.signal, null);
        assert.deepEqual(readFileSync(closedTimingChannel.target), bytes);
        assertMissing(closedTimingChannel.stage);
      } finally {
        rmSync(closedTimingChannel.alias, { recursive: true, force: true });
      }
    } finally {
      bytes.fill(0);
    }
  });

  it("preserves partial, foreign-content, symlink, and hidden-link conflicts", {
    skip: process.platform !== "darwin",
  }, async () => {
    const partial = privateParent();
    const expected = exactScopeBytes("b");
    try {
      writeFileSync(partial.stage, expected.subarray(0, expected.byteLength - 1), {
        mode: 0o600,
        flag: "wx",
      });
      const rejected = await invokeNative(partial.parent, "none", expected);
      assert.equal(rejected.code, 70);
      assert.match(rejected.stderr, /entry_invalid/);
      assert.equal(lstatSync(partial.stage).size, expected.byteLength - 1);
      assertMissing(partial.target);
    } finally {
      rmSync(partial.alias, { recursive: true, force: true });
    }

    const foreign = privateParent();
    try {
      writeFileSync(foreign.stage, exactScopeBytes("c"), { mode: 0o600, flag: "wx" });
      const rejected = await invokeNative(foreign.parent, "none", expected);
      assert.equal(rejected.code, 70);
      assert.match(rejected.stderr, /content_mismatch/);
      assertMissing(foreign.target);
    } finally {
      rmSync(foreign.alias, { recursive: true, force: true });
    }

    const symlink = privateParent();
    try {
      symlinkSync("foreign", symlink.target);
      const rejected = await invokeNative(symlink.parent, "none", expected);
      assert.equal(rejected.code, 70);
      assert.match(rejected.stderr, /entry_invalid/);
      assert.equal(lstatSync(symlink.target).isSymbolicLink(), true);
    } finally {
      rmSync(symlink.alias, { recursive: true, force: true });
    }

    const hiddenLink = privateParent();
    try {
      writeFileSync(hiddenLink.target, expected, { mode: 0o600, flag: "wx" });
      const hidden = path.join(hiddenLink.parent, "hidden-link");
      linkSync(hiddenLink.target, hidden);
      const rejected = await invokeNative(hiddenLink.parent, "none", expected);
      assert.equal(rejected.code, 70);
      assert.match(rejected.stderr, /state_conflict/);
      assert.equal(lstatSync(hiddenLink.target).nlink, 2);
      assert.equal(lstatSync(hidden).nlink, 2);
    } finally {
      expected.fill(0);
      rmSync(hiddenLink.alias, { recursive: true, force: true });
    }
  });
});

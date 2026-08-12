import assert from "node:assert/strict";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  withV3SealCapacityAdmission,
} from "../../src/execution/v3-seal-capacity.js";

const limits = Object.freeze({
  rootQuotaBytes: 1024 * 1024,
  maxSealCount: 4,
  minFreeBytes: 0,
});

test("v3 seal capacity releases its exact lock identity", async () => {
  const root = await mkdtemp(
    path.join(tmpdir(), "setfarm-v3-seal-capacity-identity-"),
  );
  try {
    const result = await withV3SealCapacityAdmission({
      sealedRoot: root,
      createsSeal: false,
      limits,
      operation: async (reservation) => {
        reservation.admitWrite(0);
        return "ok" as const;
      },
    });
    assert.equal(result, "ok");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("v3 seal capacity refuses a same-byte replacement lock", async () => {
  const root = await mkdtemp(
    path.join(tmpdir(), "setfarm-v3-seal-capacity-replacement-"),
  );
  try {
    await assert.rejects(
      withV3SealCapacityAdmission({
        sealedRoot: root,
        createsSeal: false,
        limits,
        operation: async () => {
          const lockPath = path.join(root, ".capacity.lock");
          const replacementPath = path.join(root, ".capacity.lock.replacement");
          const bytes = await readFile(lockPath);
          await writeFile(replacementPath, bytes, { mode: 0o600 });
          await rename(replacementPath, lockPath);
        },
      }),
      (error: unknown) =>
        error instanceof Error
        && error.message.startsWith(
          "V3_DEPLOY_SEAL_CAPACITY_LOCK_OWNERSHIP_MISMATCH:",
        ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

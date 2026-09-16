import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, realpathSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createMaintenanceIntentV1 } from "../build-generation-maintenance-journal.mjs";
import { openMaintenanceOwnerJournalV1 } from "../build-generation-maintenance-journal-store.mjs";
import { prepareMaintenanceOwnerAttemptV1 } from "../build-generation-maintenance-owner-attempt.mjs";

const intent = createMaintenanceIntentV1({ candidateCompletionHash: "a".repeat(64),
  controllerSourceHash: "b".repeat(64), retainedBuildHash: "c".repeat(64), launcherConfigurationHash: "d".repeat(64) });
function fixture(run) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "maintenance-attempt-")));
  try { run(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test("journals the real owner and retry preserves its nonce without acquiring a reservation", { skip: process.platform !== "darwin" }, () => fixture(root => {
  const first = prepareMaintenanceOwnerAttemptV1(root, intent);
  const retry = prepareMaintenanceOwnerAttemptV1(root, intent);
  assert.equal(first.claim.owner.pid, process.pid);
  assert.equal(retry.claim.ownerClaimHash, first.claim.ownerClaimHash);
  assert.equal(openMaintenanceOwnerJournalV1(root).read().claims.length, 1);
  assert.deepEqual(readdirSync(root).sort(), ["intent.json", "owner-0001.json"]);
  assert.equal(first.requiresFreshExclusion, true);
}));

test("conflicting intent refuses without adding owner history", () => fixture(root => {
  const store = openMaintenanceOwnerJournalV1(root);
  store.publishIntent(intent);
  const different = createMaintenanceIntentV1({ candidateCompletionHash: "f".repeat(64),
    controllerSourceHash: "b".repeat(64), retainedBuildHash: "c".repeat(64), launcherConfigurationHash: "d".repeat(64) });
  assert.throws(() => prepareMaintenanceOwnerAttemptV1(root, different), /MAINTENANCE_OWNER/);
  assert.equal(store.read().intent.maintenanceIntentHash, intent.maintenanceIntentHash);
  assert.deepEqual(readdirSync(root), ["intent.json"]);
}));

test("a successor links an actually exited owner without removing historical files", { skip: process.platform !== "darwin" }, () => fixture(root => {
  const moduleUrl = new URL("../build-generation-maintenance-owner-attempt.mjs", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { prepareMaintenanceOwnerAttemptV1 } from ${JSON.stringify(moduleUrl)};
    process.stdout.write(JSON.stringify(prepareMaintenanceOwnerAttemptV1(${JSON.stringify(root)}, ${JSON.stringify(intent)})));
  `], { encoding: "utf8", timeout: 5000, env: {} });
  assert.equal(child.status, 0, child.stderr);
  const first = JSON.parse(child.stdout);
  const second = prepareMaintenanceOwnerAttemptV1(root, intent);
  assert.equal(second.claim.ordinal, 2);
  assert.equal(second.claim.previousOwnerClaimHash, first.claim.ownerClaimHash);
  assert.match(second.claim.previousOwnerDeathObservationHash, /^[a-f0-9]{64}$/);
  assert.equal(second.claim.owner.pid, process.pid);
  assert.deepEqual(readdirSync(root).sort(), ["intent.json", "owner-0001.json", "owner-0002.json"]);
}));

for (const scenario of ["live", "reused", "ambiguous", "dead", "initial-current-ambiguous", "post-publication-ambiguous", "competing-successor"]) {
  test(`owner attempt ${scenario} preserves the exact history boundary`, () => fixture(root => {
    const moduleUrl = new URL("../build-generation-maintenance-owner-attempt.mjs", import.meta.url).href;
    const codecUrl = new URL("../build-generation-maintenance-journal.mjs", import.meta.url).href;
    const storeUrl = new URL("../build-generation-maintenance-journal-store.mjs", import.meta.url).href;
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import cp from "node:child_process";
      import { createHash } from "node:crypto";
      import { createMaintenanceOwnerClaimV1 } from ${JSON.stringify(codecUrl)};
      import { openMaintenanceOwnerJournalV1 } from ${JSON.stringify(storeUrl)};
      const store = openMaintenanceOwnerJournalV1(${JSON.stringify(root)}), intent = ${JSON.stringify(intent)};
      const predecessor = { uid: process.getuid(), pid: process.pid + 100000, processGroupId: 1234,
        processLstart: "Tue Sep 15 08:00:00 2026", reservationNonce: "10000000-0000-4000-8000-000000000001",
        bootSessionHash: createHash("sha256").update("1786632747\\n827658\\n").digest("hex") };
      store.publishIntent(intent); store.publishOwnerClaim(createMaintenanceOwnerClaimV1(intent, predecessor));
      const scenario = ${JSON.stringify(scenario)}; let currentCalls = 0;
      const result = (status, stdout) => ({ status, stdout, stderr: "", signal: null });
      cp.spawnSync = (file, args) => {
        if (file === "/usr/sbin/sysctl") return result(0, "{ sec = 1786632747, usec = 827658 } Tue Sep 15 08:00:00 2026\\n");
        if (file !== "/bin/ps") throw Error("unexpected command");
        if (Number(args[1]) === process.pid) {
          currentCalls++;
          if (scenario === "initial-current-ambiguous") return result(0, "malformed\\n");
          if (scenario === "competing-successor" && currentCalls === 3) {
            const latest = store.read().claims.at(-1);
            store.publishOwnerClaim(createMaintenanceOwnerClaimV1(intent,
              { ...predecessor, pid: predecessor.pid + 1 }, latest, "e".repeat(64)));
          }
          if (scenario === "post-publication-ambiguous" && currentCalls > 2) return result(0, "malformed\\n");
          return result(0, " " + process.getuid() + " Tue Sep 15 08:00:00 2026 1234 S\\n");
        }
        if (Number(args[1]) !== predecessor.pid) throw Error("unexpected pid");
        if (scenario === "ambiguous") return result(0, "malformed\\n");
        if (["dead", "post-publication-ambiguous", "competing-successor"].includes(scenario)) return result(1, "");
        return result(0, " " + process.getuid() + " Tue Sep 15 08:" + (scenario === "reused" ? "01" : "00") + ":00 2026 1234 S\\n");
      };
      const { prepareMaintenanceOwnerAttemptV1 } = await import(${JSON.stringify(moduleUrl)});
      let value = null, error = null;
      try { value = prepareMaintenanceOwnerAttemptV1(${JSON.stringify(root)}, intent); }
      catch (cause) { error = cause.message; }
      process.stdout.write(JSON.stringify({ value, error, history: store.read() }));
    `], { encoding: "utf8", timeout: 5000, env: {} });
    assert.equal(child.status, 0, child.stderr);
    const observed = JSON.parse(child.stdout);
    const count = scenario === "competing-successor" ? 3 : ["dead", "post-publication-ambiguous"].includes(scenario) ? 2 : 1;
    assert.equal(observed.history.claims.length, count);
    assert.deepEqual(readdirSync(root).sort(), ["intent.json", ...Array.from({ length: count }, (_, index) => `owner-000${index + 1}.json`)]);
    if (scenario === "dead") {
      assert.equal(observed.error, null);
      assert.equal(observed.value.claim.ordinal, 2);
    } else {
      assert.equal(observed.value, null);
      assert.match(observed.error, /MAINTENANCE_OWNER/);
    }
  }));
}

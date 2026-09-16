import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { observeCurrentMaintenanceOwnerV1, observeMaintenanceOwnerProcessV1 } from "../build-generation-maintenance-owner-observer.mjs";

const nonce = "10000000-0000-4000-8000-000000000001";
const bootText = "{ sec = 1786632747, usec = 827658 } Thu Aug 13 17:52:27 2026\n";
const bootHash = createHash("sha256").update("1786632747\n827658\n").digest("hex");
const owner = { uid: 501, pid: 1234, processLstart: "Tue Sep 15 08:00:00 2026", processGroupId: 1234,
  bootSessionHash: bootHash, reservationNonce: nonce };
const ok = stdout => ({ status: 0, stdout, stderr: "", signal: null });
const alive = ok("  501 Tue Sep 15 08:00:00 2026 1234 S\n");
const dead = { status: 1, stdout: "", stderr: "", signal: null };

test("current-owner observation uses the actual running process", { skip: process.platform !== "darwin" }, () => {
  const observed = observeCurrentMaintenanceOwnerV1(nonce);
  assert.equal(observed.owner.pid, process.pid);
  assert.equal(observed.owner.uid, process.getuid());
  assert.equal(observed.owner.reservationNonce, nonce);
  assert.match(observed.observationHash, /^[a-f0-9]{64}$/);
  assert.equal(observeMaintenanceOwnerProcessV1(observed.owner).state, "live_match");
});

test("a real exited test owner is observed as definitely dead", { skip: process.platform !== "darwin" }, () => {
  const moduleUrl = new URL("../build-generation-maintenance-owner-observer.mjs", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { observeCurrentMaintenanceOwnerV1 } from ${JSON.stringify(moduleUrl)};
    process.stdout.write(JSON.stringify(observeCurrentMaintenanceOwnerV1(${JSON.stringify(nonce)}).owner));
  `], { encoding: "utf8", timeout: 5000, env: {} });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(observeMaintenanceOwnerProcessV1(JSON.parse(child.stdout)).state, "definitely_dead");
});

const cases = [
  ["two dead observations", dead, dead, bootText, "definitely_dead"],
  ["matching live owner", alive, alive, bootText, "live_match"],
  ["Darwin padded process state", ok("  501 Tue Sep 15 08:00:00 2026     1234 Ss  \n"), ok("  501 Tue Sep 15 08:00:00 2026     1234 Ss  \n"), bootText, "live_match"],
  ["reused process start", ok(" 501 Tue Sep 15 08:01:00 2026 1234 S\n"), ok(" 501 Tue Sep 15 08:01:00 2026 1234 S\n"), bootText, "live_pid_reused"],
  ["changed process UID", ok(" 502 Tue Sep 15 08:00:00 2026 1234 S\n"), ok(" 502 Tue Sep 15 08:00:00 2026 1234 S\n"), bootText, "live_pid_reused"],
  ["changed process group", ok(" 501 Tue Sep 15 08:00:00 2026 1235 S\n"), ok(" 501 Tue Sep 15 08:00:00 2026 1235 S\n"), bootText, "live_pid_reused"],
  ["stable different boot", alive, alive, bootText.replace("1786632747", "1786632748"), "live_pid_reused", bootText.replace("1786632747", "1786632748")],
  ["mixed dead and live", dead, alive, bootText, "ambiguous"],
  ["stderr on dead result", { ...dead, stderr: "warning" }, dead, bootText, "ambiguous"],
  ["observer timeout", { ...dead, error: { code: "ETIMEDOUT" } }, dead, bootText, "ambiguous"],
  ["malformed process row", ok("unparseable\n"), alive, bootText, "ambiguous"],
  ["zombie owner", ok(" 501 Tue Sep 15 08:00:00 2026 1234 Z\n"), alive, bootText, "ambiguous"],
  ["boot changes while observing", dead, dead, bootText.replace("1786632747", "1786632748"), "ambiguous"],
];
for (const [name, first, second, finalBoot, expected, initialBoot = bootText] of cases) test(name, () => {
  const moduleUrl = new URL("../build-generation-maintenance-owner-observer.mjs", import.meta.url).href;
  const replies = [ok(initialBoot), first, second, ok(finalBoot)];
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import cp from "node:child_process";
    const replies = ${JSON.stringify(replies)}; const calls = [];
    cp.spawnSync = (file, args, options) => {
      calls.push({ file, args, options });
      return replies[calls.length - 1];
    };
    const { observeMaintenanceOwnerProcessV1 } = await import(${JSON.stringify(moduleUrl)});
    const result = observeMaintenanceOwnerProcessV1(${JSON.stringify(owner)});
    process.stdout.write(JSON.stringify({ result, calls }));
  `], { encoding: "utf8", timeout: 5000, env: {} });
  assert.equal(child.status, 0, child.stderr);
  const observed = JSON.parse(child.stdout);
  assert.equal(observed.result.state, expected);
  assert.equal(observed.calls.length, 4);
  for (const [index, call] of observed.calls.entries()) {
    const boot = index === 0 || index === 3;
    assert.equal(call.file, boot ? "/usr/sbin/sysctl" : "/bin/ps");
    assert.deepEqual(call.args, boot ? ["-n", "kern.boottime"] : ["-p", "1234", "-o", "uid=", "-o", "lstart=", "-o", "pgid=", "-o", "stat="]);
    assert.deepEqual(call.options, { shell: false,
      env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LANG: "C", LC_ALL: "C", TZ: "UTC" },
      timeout: 5000, maxBuffer: 65536, stdio: ["ignore", "pipe", "pipe"] });
  }
});

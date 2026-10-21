import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import { parseManualOrphanEvidenceV1 } from "../../src/execution/schemas/manual-control-orphan-retirement-v1.js";
import type { ManualOrphanEvidenceV1 } from "../../src/execution/schemas/manual-control-orphan-retirement-v1.js";
import { proveManualOrphanRetirementV1 } from "../../src/execution/manual-control-orphan-proof-v1.js";
import { makeSyntheticManualOrphanEvidenceV1, syntheticBytesV1 } from "./helpers/manual-control-orphan-fixture-v1.js";

// These detached component inputs make no native observation or service claim.
// Each case catches a real parser/proof regression at the named predicate.
type Mutable<T> = T extends readonly (infer E)[] ? Mutable<E>[]
  : T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
type Evidence = Mutable<ManualOrphanEvidenceV1>;
type Snapshot = Evidence["nativeBefore"];
type Present = Extract<Snapshot["services"][number], { status: "present" }>;
type Service = Present["service"];
type File = Present["pidFile"];
type Capture = Snapshot["census"];
type Fixture = { evidence: Evidence; priorRecord: ReturnType<typeof makeSyntheticManualOrphanEvidenceV1>["priorRecord"] };
type Refusal = "NATIVE" | "OTHER_OWNER" | "MALFORMED";
const T0 = "2026-10-20T00:00:00.000Z";
const SOURCE = "b".repeat(40);
const COMMAND = {
  dashboard: "/fixture/node /fixture/old/dist/server/daemon.js 3333",
  spawner: "/fixture/node /fixture/old/dist/spawner.js",
} as const;
const SCRIPT = { dashboard: "/fixture/old/dist/server/daemon.js", spawner: "/fixture/old/dist/spawner.js" } as const;
const PID = { dashboard: 801, spawner: 802 } as const;
const NAMES = ["dashboard.lock", "dashboard.pid", "spawner.lock", "spawner.pid"];
const digest = (raw: string) => createHash("sha256").update(raw).digest("hex");
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const text = (file: Pick<File, "bytes">) => Buffer.from(file.bytes.base64, "base64").toString("utf8");
const time = (seconds: number) => new Date(Date.parse(T0) + seconds * 1000).toISOString();

async function fresh(): Promise<Fixture> {
  // Keep the initial missing-contract RED inside each callback. Other import
  // failures propagate unchanged; no production module or validator is stubbed.
  const url = new URL("./helpers/manual-control-orphan-present-services-fixture-v1.js", import.meta.url);
  let namespace: unknown;
  try { namespace = await import(url.href); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ERR_MODULE_NOT_FOUND"
      && "url" in error && error.url === url.href) {
      assert.fail("M1 missing contract: makeSyntheticManualOrphanPresentServicesEvidenceV1 fixture is absent");
    }
    throw error;
  }
  assert.ok(namespace !== null && typeof namespace === "object");
  assert.ok("makeSyntheticManualOrphanPresentServicesEvidenceV1" in namespace);
  const factory = namespace.makeSyntheticManualOrphanPresentServicesEvidenceV1;
  assert.equal(typeof factory, "function", "the future helper must export the adopted zero-argument factory");
  const result: unknown = (factory as () => unknown)();
  assert.ok(result !== null && typeof result === "object" && "evidence" in result && "priorRecord" in result);
  assert.deepEqual(Object.keys(result).sort(), ["evidence", "priorRecord"]);
  return result as Fixture;
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function present(snapshot: Snapshot, service: Service): Present {
  const entry = snapshot.services.find(s => s.service === service);
  assert.ok(entry && entry.status === "present", `${service} must be present in this antecedent`);
  return entry;
}
const dashboard = (e: Evidence) => present(e.nativeBefore, "dashboard");
const spawner = (e: Evidence) => present(e.nativeAfter, "spawner");
function listing(e: Evidence) {
  const found = e.namespace.directories.find(d => d.relative === "services");
  assert.ok(found);
  return found;
}
function fileStats(file: File) { return [file.descriptorBefore, file.descriptorAfter, file.namedAfter]; }
function sealFile(file: File, raw: string) {
  file.bytes = syntheticBytesV1(raw);
  for (const stat of fileStats(file)) stat.size = String(Buffer.byteLength(raw));
  assert.equal(file.bytes.sha256, digest(raw));
  assert.equal(text(file), raw);
  assert.ok(fileStats(file).every(s => s.size === String(Buffer.byteLength(raw))));
}
function sealLock(service: Present) { sealFile(service.lock.file, `${JSON.stringify(service.lock.value)}\n`); }
function sealCapture(capture: Capture, raw: string) {
  capture.stdout.bytes = syntheticBytesV1(raw);
  capture.stdout.dataBytesObserved = Buffer.byteLength(raw);
  assert.equal(text(capture.stdout), raw);
  assert.equal(capture.stdout.bytes.sha256, digest(raw));
  assert.equal(capture.stdout.dataBytesObserved, capture.stdout.bytes.byteLength);
}
type CensusRow = { pid: number; ppid: number; pg: number; command: string };
function censusRows(snapshot: Snapshot): CensusRow[] {
  const raw = text(snapshot.census.stdout);
  assert.ok(raw.endsWith("\n"));
  return raw.slice(0, -1).split("\n").map(line => {
    const match = /^(\d+) (\d+) (\d+) (.+)$/.exec(line);
    assert.ok(match, `synthetic census line: ${line}`);
    return { pid: Number(match[1]), ppid: Number(match[2]), pg: Number(match[3]), command: match[4]! };
  });
}
function censusRow(snapshot: Snapshot, pid: number): CensusRow {
  const matches = censusRows(snapshot).filter(r => r.pid === pid);
  assert.equal(matches.length, 1);
  return matches[0]!;
}
function changeCensus(snapshot: Snapshot, pid: number, change: (row: CensusRow) => CensusRow | null) {
  let count = 0;
  const rows = censusRows(snapshot).flatMap(row => {
    if (row.pid !== pid) return [row];
    count++;
    const changed = change(row);
    return changed === null ? [] : [changed];
  });
  assert.equal(count, 1, "a mutation must address exactly its intended census row");
  sealCapture(snapshot.census, rows.map(r => `${r.pid} ${r.ppid} ${r.pg} ${r.command}\n`).join(""));
}
function captureIds(e: Evidence): string[] {
  return [e.nativeBefore, e.nativeAfter].flatMap(s => [s.census, s.collectorIdentity.before, s.collectorIdentity.comm,
    s.collectorIdentity.after, ...s.services.flatMap(v => v.status === "present" ? [v.identity.before, v.identity.comm, v.identity.after] : [])])
    .map(c => c.captureId);
}

// Independent expectations use the producer's documented insertion order and
// fixed synthetic projection formulas, never the future helper's internals.
function expectedFile(relative: string, raw: string): File {
  const bytes = { base64: Buffer.from(raw).toString("base64"), byteLength: Buffer.byteLength(raw), sha256: digest(raw) };
  const stat = { dev: "1", ino: String(parseInt(digest(relative).slice(0, 12), 16)), mode: "33152", nlink: "1",
    uid: "501", gid: "20", size: String(bytes.byteLength), mtimeNs: "1792454400000000000", ctimeNs: "1792454400000000000" };
  return { relative, bytes, descriptorBefore: { ...stat }, descriptorAfter: { ...stat }, namedAfter: { ...stat },
    parents: ["", "services"].map(relative => {
      const parent = { ...stat, ino: String(parseInt(digest(`directory:${relative}`).slice(0, 12), 16)), mode: "16832", nlink: "2", size: "64" };
      return { relative, before: { ...parent }, after: { ...parent } };
    }) };
}
function expectedLock(service: Service) {
  return { schema: "setfarm.fresh-service-process.v1", service, installationDirectory: "/fixture/installation",
    sourceSha: SOURCE, executable: "/fixture/node", script: SCRIPT[service],
    ownerIdentity: { schema: "setfarm.process-identity.v1", pid: PID[service], processStartedAt: T0,
      processGroupId: PID[service], source: "observed_os" } };
}
function assertCapture(c: Capture, s: Snapshot, n: number, sequence: number, argv: string[], stdout: string) {
  const begin = n === 1 ? 70 : 100;
  assert.deepEqual(c, {
    captureId: id(n * 100 + sequence), collector: s.collector, executable: "/bin/ps", argv, cwd: "/fixture/maintenance",
    executorPid: 500 + n * 10 + sequence, executorParentPid: 400,
    invokedAtUTC: time(begin), spawnObservedAtUTC: time(begin + 1), exitObservedAtUTC: time(begin + 2), closeObservedAtUTC: time(begin + 3),
    exit: { code: 0, signal: null }, processClose: { code: 0, signal: null },
    stdout: { bytes: { base64: Buffer.from(stdout).toString("base64"), byteLength: Buffer.byteLength(stdout), sha256: digest(stdout) },
      dataBytesObserved: Buffer.byteLength(stdout), endObserved: true, closeObserved: true },
    stderr: { bytes: { base64: "", byteLength: 0, sha256: digest("") }, dataBytesObserved: 0, endObserved: true, closeObserved: true }, errors: [],
  });
}
function assertP0(f: Fixture) {
  const e = f.evidence, baseline = makeSyntheticManualOrphanEvidenceV1();
  assert.deepEqual(f.priorRecord, baseline.priorRecord);
  assert.notEqual(f.priorRecord, e.reservation.value, "the returned prior record is detached from evidence");
  assert.deepEqual(listing(e).names, NAMES);
  assert.equal(e.reservation.value.owner.pid, 101);
  assert.equal(e.reservation.value.owner.processGroupId, 101);
  assert.deepEqual(e.namespace.startChildren.map(d => d.value.child.pid), [102]);
  for (const [index, s] of [e.nativeBefore, e.nativeAfter].entries()) {
    const n = index + 1, old = index === 0 ? baseline.evidence.nativeBefore : baseline.evidence.nativeAfter;
    assert.deepEqual(s.services.map(v => [v.service, v.status]), [["dashboard", "present"], ["spawner", "present"]]);
    assert.deepEqual({ ...s, services: old.services, census: old.census }, old, "retain collector, its original captures and chronology");
    assert.deepEqual({ ...s.census, stdout: old.census.stdout }, old.census);
    const suffix = `801 1 801 ${COMMAND.dashboard}\n802 1 802 ${COMMAND.spawner}\n`;
    assert.equal(text(s.census.stdout), text(old.census.stdout) + suffix);
    assert.deepEqual(s.census.stdout.bytes, syntheticBytesV1(text(old.census.stdout) + suffix));
    assert.equal(s.census.stdout.dataBytesObserved, Buffer.byteLength(text(old.census.stdout) + suffix));
    assert.deepEqual(censusRows(s).map(r => r.pid), [1, 400, n === 1 ? 511 : 521, 801, 802]);
    for (const name of ["dashboard", "spawner"] as const) {
      const v = present(s, name), pid = PID[name], first = name === "dashboard" ? 5 : 8;
      const lock = expectedLock(name);
      assert.deepEqual(v.lock.value, lock);
      assert.deepEqual(Object.keys(v.lock.value), ["schema", "service", "installationDirectory", "sourceSha", "executable", "script", "ownerIdentity"]);
      assert.deepEqual(Object.keys(v.lock.value.ownerIdentity), ["schema", "pid", "processStartedAt", "processGroupId", "source"]);
      assert.deepEqual(v.lock.file, expectedFile(`services/${name}.lock`, `${JSON.stringify(lock)}\n`));
      assert.deepEqual(v.pidFile, expectedFile(`services/${name}.pid`, String(pid)));
      const root = baseline.evidence.reservation.file.parents[0]!;
      for (const file of [v.lock.file, v.pidFile]) {
        assert.deepEqual(file.parents[0], root, "new files retain the captured root identity and UID");
        assert.notEqual(file.descriptorBefore, file.descriptorAfter);
        assert.notEqual(file.descriptorAfter, file.namedAfter);
        for (const parent of file.parents) assert.notEqual(parent.before, parent.after);
      }
      assert.equal(v.identity.subject, name);
      assert.deepEqual(v.identity.expected, { pid, processStartedAt: T0, processGroupId: pid, source: "observed_os",
        executable: "/fixture/node", script: SCRIPT[name], commandHash: digest(COMMAND[name]) });
      assert.deepEqual(Object.keys(v.identity.expected), ["pid", "processStartedAt", "processGroupId", "source", "executable", "script", "commandHash"]);
      const argv = ["-ww", "-p", String(pid), "-o", "lstart=", "-o", "pgid=", "-o", "args="];
      const raw = `Tue Oct 20 00:00:00 2026 ${pid} ${COMMAND[name]}\n`;
      assertCapture(v.identity.before, s, n, first, argv, raw);
      assertCapture(v.identity.comm, s, n, first + 1, ["-ww", "-p", String(pid), "-o", "comm="], "/fixture/node\n");
      assertCapture(v.identity.after, s, n, first + 2, argv, raw);
      assert.notEqual(v.identity.before, v.identity.after);
    }
  }
  const normalized = structuredClone(e);
  normalized.nativeBefore = structuredClone(baseline.evidence.nativeBefore);
  normalized.nativeAfter = structuredClone(baseline.evidence.nativeAfter);
  listing(normalized).names = [...listing(baseline.evidence).names];
  assert.deepEqual(normalized, baseline.evidence, "no authority outside services/census/inventory is resealed or changed");
  for (const name of ["dashboard", "spawner"] as const) {
    const before = present(e.nativeBefore, name), after = present(e.nativeAfter, name);
    for (const key of ["lock", "pidFile"] as const) {
      assert.deepEqual(before[key], after[key]);
      assert.notEqual(before[key], after[key]);
    }
    assert.notEqual(before.lock.file.descriptorBefore, after.lock.file.descriptorBefore);
    assert.notEqual(before.pidFile.parents[0], after.pidFile.parents[0]);
    assert.notEqual(before.identity, after.identity);
  }
  const ids = captureIds(e);
  assert.equal(ids.length, 20);
  assert.equal(new Set(ids).size, 20);
}

function assertServiceJoins(e: Evidence, s: Snapshot, name: Service) {
  const v = present(s, name), record = v.lock.value, expected = v.identity.expected;
  assert.equal(v.lock.file.relative, `services/${name}.lock`);
  assert.equal(v.pidFile.relative, `services/${name}.pid`);
  assert.ok(listing(e).names.includes(`${name}.lock`) && listing(e).names.includes(`${name}.pid`));
  assert.deepEqual([record.service, record.installationDirectory, record.sourceSha, record.executable, record.script],
    [name, e.target.selection.installationDir, e.target.source.sha, e.target.nodeExecutable, SCRIPT[name]]);
  assert.equal(text(v.lock.file), `${JSON.stringify(record)}\n`);
  assert.equal(text(v.pidFile), String(record.ownerIdentity.pid));
  assert.deepEqual([expected.pid, expected.processStartedAt, expected.processGroupId, expected.source],
    [record.ownerIdentity.pid, record.ownerIdentity.processStartedAt, record.ownerIdentity.processGroupId, record.ownerIdentity.source]);
  assert.deepEqual([expected.executable, expected.script, v.identity.subject], [record.executable, record.script, name]);
  const command = COMMAND[name], raw = `Tue Oct 20 00:00:00 2026 ${expected.processGroupId} ${command}\n`;
  assert.equal(expected.commandHash, digest(command));
  for (const c of [v.identity.before, v.identity.after]) {
    assert.equal(text(c.stdout), raw);
    assert.deepEqual(c.argv, ["-ww", "-p", String(expected.pid), "-o", "lstart=", "-o", "pgid=", "-o", "args="]);
  }
  assert.deepEqual(v.identity.comm.argv, ["-ww", "-p", String(expected.pid), "-o", "comm="]);
  assert.equal(text(v.identity.comm.stdout), `${expected.executable}\n`);
  const row = censusRow(s, expected.pid);
  assert.equal(row.pg, expected.processGroupId);
  assert.equal(row.command, command);
  assert.notEqual(row.pid, s.collector.pid);
  assert.notEqual(row.pid, s.census.executorPid);
}
function rebindDashboard(e: Evidence, pid: number, pg: number) {
  for (const s of [e.nativeBefore, e.nativeAfter]) {
    const v = present(s, "dashboard"), oldPid = v.lock.value.ownerIdentity.pid;
    v.lock.value.ownerIdentity.pid = pid; v.lock.value.ownerIdentity.processGroupId = pg; sealLock(v);
    v.identity.expected.pid = pid; v.identity.expected.processGroupId = pg;
    sealFile(v.pidFile, String(pid));
    for (const c of [v.identity.before, v.identity.comm, v.identity.after]) c.argv[2] = String(pid);
    for (const c of [v.identity.before, v.identity.after]) sealCapture(c, `Tue Oct 20 00:00:00 2026 ${pg} ${COMMAND.dashboard}\n`);
    changeCensus(s, oldPid, row => ({ ...row, pid, pg }));
    assertServiceJoins(e, s, "dashboard");
    assertServiceJoins(e, s, "spawner");
  }
  assert.deepEqual(present(e.nativeBefore, "dashboard").lock, present(e.nativeAfter, "dashboard").lock);
  assert.deepEqual(present(e.nativeBefore, "dashboard").pidFile, present(e.nativeAfter, "dashboard").pidFile);
}
function assertUnrelatedAuthorities(e: Evidence, before: Evidence) {
  assert.deepEqual(e.request, before.request);
  assert.deepEqual(e.reservation, before.reservation);
  assert.deepEqual(e.journal, before.journal);
  assert.deepEqual(e.journalHead, before.journalHead);
  assert.deepEqual(e.namespace.startChildren, before.namespace.startChildren);
  assert.deepEqual(e.target, before.target);
  assert.deepEqual(e.mc, before.mc);
  assert.deepEqual(e.database, before.database);
}
function refuse(f: Fixture, code: Refusal) {
  const before = structuredClone(f);
  freeze(f);
  if (code === "MALFORMED") assert.throws(() => parseManualOrphanEvidenceV1(f.evidence));
  else {
    const parsed = parseManualOrphanEvidenceV1(f.evidence);
    assert.deepEqual(parsed, f.evidence, "semantic controls must remain strictly parser-valid");
  }
  assert.deepEqual(proveManualOrphanRetirementV1(f.evidence), { status: "refused", code });
  assert.deepEqual(f, before, "frozen evidence and prior record must remain byte-for-byte unchanged");
}
function eligible(f: Fixture) {
  const before = structuredClone(f), baseline = makeSyntheticManualOrphanEvidenceV1();
  freeze(f); freeze(baseline);
  const parsed = parseManualOrphanEvidenceV1(f.evidence);
  assert.deepEqual(parsed, f.evidence);
  const parsedBefore = structuredClone(parsed);
  freeze(parsed);
  const verdict = proveManualOrphanRetirementV1(parsed), old = proveManualOrphanRetirementV1(baseline.evidence);
  assert.equal(verdict.status, "eligible"); assert.equal(old.status, "eligible");
  if (verdict.status !== "eligible" || old.status !== "eligible") assert.fail("present and absent component positives must be eligible");
  assert.equal(verdict.evidenceHash, digest(canonicalJsonStringify(parsed)));
  assert.equal(verdict.priorRecordHash, old.priorRecordHash);
  assert.equal(verdict.releasedRecordHash, old.releasedRecordHash);
  assert.deepEqual(Object.keys(verdict).sort(), ["evidenceHash", "priorRecordHash", "releasedRecordHash", "status"]);
  assert.deepEqual(f, before);
  assert.deepEqual(parsed, parsedBefore);
}

test("P0 both service pairs bind ordered producer bytes, identity captures and exact census owners", async () => {
  const f = await fresh(), second = await fresh();
  assertP0(f); assertP0(second);
  assert.deepEqual(f, second);
  assert.notEqual(f, second); assert.notEqual(f.evidence, second.evidence); assert.notEqual(f.priorRecord, second.priorRecord);
  assert.notEqual(dashboard(f.evidence).lock.file, dashboard(second.evidence).lock.file);
  assert.notEqual(spawner(f.evidence).identity, spawner(second.evidence).identity);
  eligible(f);
});
test("P1 only dashboard.log and spawner.log are allowed beside the complete service pairs", async () => {
  const f = await fresh(); assertP0(f);
  listing(f.evidence).names = [...NAMES, "dashboard.log", "spawner.log"].sort();
  assert.deepEqual(listing(f.evidence).names.filter(n => !NAMES.includes(n)), ["dashboard.log", "spawner.log"]);
  eligible(f);
});

type Defect = { id: string; name: string; code: Refusal; change(e: Evidence): void };
const defects: Defect[] = [
  { id: "N01a", name: "dashboard lock locator cannot claim the spawner path", code: "NATIVE", change: e => {
    const v = dashboard(e), bytes = structuredClone(v.lock.file.bytes);
    v.lock.file.relative = "services/spawner.lock";
    assert.equal(v.lock.file.relative, "services/spawner.lock"); assert.deepEqual(v.lock.file.bytes, bytes);
    assert.deepEqual(v.lock.file.parents.map(p => p.relative), ["", "services"]);
  } },
  { id: "N01b", name: "spawner PID locator cannot claim the dashboard path", code: "NATIVE", change: e => {
    const v = spawner(e), bytes = structuredClone(v.pidFile.bytes);
    v.pidFile.relative = "services/dashboard.pid";
    assert.equal(v.pidFile.relative, "services/dashboard.pid"); assert.deepEqual(v.pidFile.bytes, bytes);
  } },
  { id: "N02a", name: "lock service label must match the observed role", code: "NATIVE", change: e => {
    const v = dashboard(e); v.lock.value.service = "spawner"; sealLock(v);
    assert.equal(v.service, "dashboard"); assert.equal(v.lock.value.service, "spawner");
  } },
  { id: "N02b", name: "lock installation must match the selection directory", code: "NATIVE", change: e => {
    const v = dashboard(e); v.lock.value.installationDirectory = "/fixture/other-installation"; sealLock(v);
    assert.equal(e.target.selection.installationDir, "/fixture/installation");
    assert.equal(v.lock.value.installationDirectory, "/fixture/other-installation");
  } },
  { id: "N02c", name: "lock Source must match the selected target Source", code: "NATIVE", change: e => {
    const v = dashboard(e); v.lock.value.sourceSha = "a".repeat(40); sealLock(v);
    assert.equal(e.target.source.sha, SOURCE); assert.equal(v.lock.value.sourceSha, "a".repeat(40));
  } },
  { id: "N02d", name: "lock executable must match the physical target Node", code: "NATIVE", change: e => {
    const v = dashboard(e); v.lock.value.executable = "/fixture/other-node"; sealLock(v);
    assert.equal(e.target.nodeExecutable, "/fixture/node"); assert.equal(v.lock.value.executable, "/fixture/other-node");
  } },
  { id: "N02e", name: "spawner lock cannot substitute the dashboard script", code: "NATIVE", change: e => {
    const v = spawner(e); v.lock.value.script = SCRIPT.dashboard; sealLock(v);
    assert.equal(v.service, "spawner"); assert.equal(v.lock.value.script, SCRIPT.dashboard);
    assert.equal(v.identity.expected.script, SCRIPT.spawner);
  } },
  { id: "N03a", name: "PID decimal bytes must equal the lock PID", code: "NATIVE", change: e => {
    const v = dashboard(e); sealFile(v.pidFile, "803");
    assert.equal(text(v.pidFile), "803"); assert.equal(v.lock.value.ownerIdentity.pid, 801);
  } },
  { id: "N03b", name: "PID bytes cannot gain a trailing newline", code: "NATIVE", change: e => {
    const v = spawner(e); sealFile(v.pidFile, "802\n");
    assert.equal(text(v.pidFile), "802\n"); assert.equal(v.lock.value.ownerIdentity.pid, 802);
  } },
  { id: "N04a", name: "expected identity PID must equal the lock owner", code: "NATIVE", change: e => {
    const v = dashboard(e); v.identity.expected.pid = 803;
    assert.equal(v.lock.value.ownerIdentity.pid, 801); assert.equal(v.identity.expected.pid, 803);
    assert.equal(v.identity.before.argv[2], "801"); assert.equal(censusRow(e.nativeBefore, 801).command, COMMAND.dashboard);
  } },
  { id: "N04b", name: "expected identity start must equal the lock owner", code: "NATIVE", change: e => {
    const v = dashboard(e); v.identity.expected.processStartedAt = time(1);
    assert.equal(v.lock.value.ownerIdentity.processStartedAt, T0); assert.equal(v.identity.expected.processStartedAt, time(1));
    assert.ok(text(v.identity.before.stdout).startsWith("Tue Oct 20 00:00:00 2026 "));
  } },
  { id: "N04c", name: "expected identity PG must equal the lock owner", code: "NATIVE", change: e => {
    const v = dashboard(e); v.identity.expected.processGroupId = 803;
    assert.equal(v.lock.value.ownerIdentity.processGroupId, 801); assert.equal(v.identity.expected.processGroupId, 803);
    assert.equal(censusRow(e.nativeBefore, 801).pg, 801);
  } },
  { id: "N05a", name: "identity subject must match the service role", code: "NATIVE", change: e => {
    const v = dashboard(e); v.identity.subject = "spawner";
    assert.equal(v.service, "dashboard"); assert.equal(v.identity.subject, "spawner");
  } },
  { id: "N05b", name: "identity command digest must hash command text without its newline", code: "NATIVE", change: e => {
    const v = dashboard(e); v.identity.expected.commandHash = "a".repeat(64);
    assert.notEqual(digest(COMMAND.dashboard), v.identity.expected.commandHash);
    assert.equal(text(v.identity.before.stdout), text(v.identity.after.stdout));
    assert.ok(text(v.identity.before.stdout).endsWith(`${COMMAND.dashboard}\n`));
  } },
  { id: "N05c", name: "comm executable must match the expected Node", code: "NATIVE", change: e => {
    const v = spawner(e); sealCapture(v.identity.comm, "/fixture/other-node\n");
    assert.equal(v.identity.expected.executable, "/fixture/node"); assert.equal(text(v.identity.comm.stdout), "/fixture/other-node\n");
  } },
  { id: "N05d", name: "before and after identity stdout must be exactly equal", code: "NATIVE", change: e => {
    const v = spawner(e), raw = text(v.identity.before.stdout);
    sealCapture(v.identity.after, `${raw.slice(0, -1)} \n`);
    assert.equal(text(v.identity.after.stdout), `${raw.slice(0, -1)} \n`);
    assert.equal(text(v.identity.before.stdout), raw); assert.notEqual(text(v.identity.after.stdout), raw);
  } },
  { id: "N06a", name: "equal raw observations must still match the expected UTC start", code: "NATIVE", change: e => {
    const v = dashboard(e), raw = `Tue Oct 20 00:00:01 2026 801 ${COMMAND.dashboard}\n`;
    sealCapture(v.identity.before, raw); sealCapture(v.identity.after, raw);
    assert.equal(text(v.identity.before.stdout), text(v.identity.after.stdout));
    assert.equal(v.identity.expected.processStartedAt, T0); assert.equal(v.identity.expected.commandHash, digest(COMMAND.dashboard));
    assert.equal(v.lock.value.ownerIdentity.processGroupId, 801);
  } },
  { id: "N06b", name: "equal raw observations must still match the expected PG", code: "NATIVE", change: e => {
    const v = dashboard(e), raw = `Tue Oct 20 00:00:00 2026 803 ${COMMAND.dashboard}\n`;
    sealCapture(v.identity.before, raw); sealCapture(v.identity.after, raw);
    assert.equal(text(v.identity.before.stdout), text(v.identity.after.stdout));
    assert.equal(v.identity.expected.processGroupId, 801); assert.equal(v.identity.expected.commandHash, digest(COMMAND.dashboard));
    assert.equal(v.lock.value.ownerIdentity.processStartedAt, T0);
  } },
  { id: "N07", name: "script prefix X is not an executable script boundary despite a valid digest and census", code: "NATIVE", change: e => {
    const v = spawner(e), command = `${COMMAND.spawner}X`, prefix = `${v.identity.expected.executable} ${v.identity.expected.script}`;
    for (const c of [v.identity.before, v.identity.after]) sealCapture(c, `Tue Oct 20 00:00:00 2026 802 ${command}\n`);
    v.identity.expected.commandHash = digest(command);
    changeCensus(e.nativeAfter, 802, row => ({ ...row, command }));
    assert.equal(text(v.identity.before.stdout), text(v.identity.after.stdout));
    assert.equal(censusRow(e.nativeAfter, 802).command, command); assert.equal(v.identity.expected.commandHash, digest(command));
    assert.ok(command.startsWith(prefix)); assert.equal(command.slice(prefix.length, prefix.length + 1), "X");
    assert.equal(v.lock.value.script, SCRIPT.spawner); assert.equal(v.identity.expected.script, SCRIPT.spawner);
  } },
  { id: "N08a", name: "service comm stream must observe close", code: "NATIVE", change: e => {
    const c = spawner(e).identity.comm; c.stdout.closeObserved = false;
    assert.equal(c.stdout.endObserved, true); assert.equal(c.stdout.closeObserved, false);
    assert.equal(c.stdout.dataBytesObserved, c.stdout.bytes.byteLength);
  } },
  { id: "N08b", name: "service capture executor must bind to the collector parent", code: "NATIVE", change: e => {
    const c = dashboard(e).identity.before; c.executorParentPid = 401;
    assert.equal(c.executorParentPid, 401); assert.equal(e.nativeBefore.collector.pid, 400);
    assert.deepEqual(c.collector, e.nativeBefore.collector);
  } },
  { id: "N08c", name: "service capture IDs must be globally unique across brackets", code: "NATIVE", change: e => {
    spawner(e).identity.after.captureId = e.nativeBefore.census.captureId;
    const ids = captureIds(e); assert.equal(ids.length, 20); assert.equal(new Set(ids).size, 19);
    assert.equal(spawner(e).identity.after.captureId, e.nativeBefore.census.captureId);
  } },
  { id: "N09a", name: "validated service identity requires its exact census PID", code: "NATIVE", change: e => {
    changeCensus(e.nativeBefore, 801, () => null);
    assert.ok(!censusRows(e.nativeBefore).some(r => r.pid === 801));
    assert.equal(dashboard(e).identity.expected.pid, 801); assert.equal(text(dashboard(e).pidFile), "801");
  } },
  { id: "N09b", name: "service census command must equal the identity observation", code: "NATIVE", change: e => {
    changeCensus(e.nativeBefore, 801, row => ({ ...row, command: "/usr/bin/true" }));
    assert.equal(censusRow(e.nativeBefore, 801).command, "/usr/bin/true");
    assert.ok(text(dashboard(e).identity.before.stdout).endsWith(`${COMMAND.dashboard}\n`));
  } },
  { id: "N09c", name: "service census PG must equal the expected owner PG", code: "NATIVE", change: e => {
    changeCensus(e.nativeAfter, 802, row => ({ ...row, pg: 803 }));
    assert.equal(censusRow(e.nativeAfter, 802).pg, 803); assert.equal(spawner(e).identity.expected.processGroupId, 802);
    assert.equal(censusRow(e.nativeAfter, 802).command, COMMAND.spawner);
  } },
  { id: "N10a", name: "duplicate service roles refuse even with fresh valid capture IDs", code: "NATIVE", change: e => {
    const duplicate = structuredClone(dashboard(e));
    for (const [i, c] of [duplicate.identity.before, duplicate.identity.comm, duplicate.identity.after].entries()) c.captureId = id(901 + i);
    e.nativeBefore.services[1] = duplicate;
    assert.notEqual(e.nativeBefore.services[0], duplicate);
    assert.deepEqual(e.nativeBefore.services.map(v => v.service), ["dashboard", "dashboard"]);
    assert.equal(new Set(captureIds(e)).size, 20); assertServiceJoins(e, e.nativeBefore, "dashboard");
  } },
  { id: "N10b", name: "present service requires both lock and PID inventory names", code: "NATIVE", change: e => {
    listing(e).names = NAMES.filter(n => n !== "spawner.pid");
    assert.ok(listing(e).names.includes("spawner.lock")); assert.ok(!listing(e).names.includes("spawner.pid"));
    assert.equal(spawner(e).status, "present"); assert.equal(text(spawner(e).pidFile), "802");
  } },
  { id: "N11a", name: "coherently bound service cannot exempt the original worker PID", code: "NATIVE", change: e => {
    rebindDashboard(e, 101, 801);
    assert.equal(dashboard(e).identity.expected.pid, e.reservation.value.owner.pid);
    assert.equal(censusRow(e.nativeBefore, 101).pg, 801); assert.equal(e.reservation.value.owner.processGroupId, 101);
  } },
  { id: "N11b", name: "coherently bound service cannot exempt the recorded start-child PID", code: "NATIVE", change: e => {
    rebindDashboard(e, 102, 801);
    assert.equal(dashboard(e).identity.expected.pid, e.namespace.startChildren[0]!.value.child.pid);
    assert.equal(censusRow(e.nativeAfter, 102).pg, 801);
  } },
  { id: "N11c", name: "coherently bound service cannot exempt the detached original worker PG", code: "NATIVE", change: e => {
    rebindDashboard(e, 801, 101);
    assert.notEqual(dashboard(e).identity.expected.pid, e.reservation.value.owner.pid);
    assert.equal(e.reservation.value.owner.pid, e.reservation.value.owner.processGroupId);
    assert.equal(censusRow(e.nativeBefore, 801).pg, e.reservation.value.owner.processGroupId);
  } },
  { id: "N12a", name: "original worker parent excludes a service even when the parent is absent from census", code: "NATIVE", change: e => {
    changeCensus(e.nativeBefore, 801, row => ({ ...row, ppid: 101 }));
    assertServiceJoins(e, e.nativeBefore, "dashboard");
    assert.equal(censusRow(e.nativeBefore, 801).ppid, e.reservation.value.owner.pid);
    assert.ok(!censusRows(e.nativeBefore).some(r => r.pid === 101));
  } },
  { id: "N12b", name: "start-child parent excludes a service even when the parent is absent from census", code: "NATIVE", change: e => {
    changeCensus(e.nativeBefore, 801, row => ({ ...row, ppid: 102 }));
    assertServiceJoins(e, e.nativeBefore, "dashboard");
    assert.equal(censusRow(e.nativeBefore, 801).ppid, e.namespace.startChildren[0]!.value.child.pid);
    assert.ok(!censusRows(e.nativeBefore).some(r => r.pid === 102));
  } },
  { id: "N13a", name: "another PID with the exact service command receives no service exemption", code: "NATIVE", change: e => {
    sealCapture(e.nativeBefore.census, text(e.nativeBefore.census.stdout) + `900 1 900 ${COMMAND.dashboard}\n`);
    assertServiceJoins(e, e.nativeBefore, "dashboard");
    assert.equal(censusRow(e.nativeBefore, 900).command, censusRow(e.nativeBefore, 801).command);
    assert.notEqual(900, dashboard(e).identity.expected.pid); assert.equal(censusRow(e.nativeBefore, 900).ppid, 1);
  } },
  { id: "N13b", name: "collector descendants receive no census-executor exemption", code: "NATIVE", change: e => {
    sealCapture(e.nativeBefore.census, text(e.nativeBefore.census.stdout) + "900 400 900 /usr/bin/true\n");
    const row = censusRow(e.nativeBefore, 900);
    assert.equal(row.ppid, e.nativeBefore.collector.pid); assert.notEqual(row.pid, e.nativeBefore.census.executorPid);
    assert.equal(row.command, "/usr/bin/true"); assert.ok(!row.command.includes("/fixture/old/dist/"));
  } },
  { id: "N13c", name: "a service child running selected Source receives no service PID exemption", code: "NATIVE", change: e => {
    sealCapture(e.nativeBefore.census, text(e.nativeBefore.census.stdout) + `900 801 900 ${COMMAND.dashboard}\n`);
    assertServiceJoins(e, e.nativeBefore, "dashboard");
    const row = censusRow(e.nativeBefore, 900);
    assert.equal(row.ppid, dashboard(e).identity.expected.pid); assert.notEqual(row.pid, row.ppid);
    assert.ok(row.command.includes(`${e.target.selection.releaseDir}/dist/`));
    assert.notEqual(row.ppid, e.nativeBefore.collector.pid);
  } },
  { id: "N14a", name: "absent service observation requires both inventory names missing", code: "NATIVE", change: e => {
    e.nativeBefore.services[0] = { service: "dashboard", status: "absent" };
    assert.deepEqual(e.nativeBefore.services[0], { service: "dashboard", status: "absent" });
    assert.ok(listing(e).names.includes("dashboard.lock") && listing(e).names.includes("dashboard.pid"));
  } },
  { id: "N14b", name: "absent pairs in both brackets cannot exempt retained selected-dist census commands", code: "NATIVE", change: e => {
    for (const s of [e.nativeBefore, e.nativeAfter]) s.services[0] = { service: "dashboard", status: "absent" };
    listing(e).names = ["spawner.lock", "spawner.pid"];
    for (const s of [e.nativeBefore, e.nativeAfter]) {
      assert.deepEqual(s.services[0], { service: "dashboard", status: "absent" });
      assert.equal(censusRow(s, 801).command, COMMAND.dashboard);
      assert.notEqual(801, s.collector.pid); assert.notEqual(801, s.census.executorPid);
      assertServiceJoins(e, s, "spawner");
    }
    assert.ok(!listing(e).names.some(n => n.startsWith("dashboard.")));
  } },
  { id: "N15a", name: "self-consistent dashboard lock inode must agree across snapshots", code: "OTHER_OWNER", change: e => {
    const before = dashboard(e).lock.file, after = present(e.nativeAfter, "dashboard").lock.file;
    const old = structuredClone(after), ino = String(BigInt(after.descriptorBefore.ino) + 1n);
    for (const stat of fileStats(after)) stat.ino = ino;
    assert.ok(fileStats(after).every(s => s.ino === ino)); assert.notEqual(before.descriptorBefore.ino, ino);
    assert.deepEqual({ ...after, descriptorBefore: old.descriptorBefore, descriptorAfter: old.descriptorAfter, namedAfter: old.namedAfter }, old);
    for (const s of [e.nativeBefore, e.nativeAfter]) for (const name of ["dashboard", "spawner"] as const) assertServiceJoins(e, s, name);
  } },
  { id: "N15b", name: "self-consistent spawner PID inode must agree across snapshots", code: "OTHER_OWNER", change: e => {
    const before = present(e.nativeBefore, "spawner").pidFile, after = spawner(e).pidFile;
    const old = structuredClone(after), ino = String(BigInt(after.descriptorBefore.ino) + 1n);
    for (const stat of fileStats(after)) stat.ino = ino;
    assert.ok(fileStats(after).every(s => s.ino === ino)); assert.notEqual(before.descriptorBefore.ino, ino);
    assert.deepEqual({ ...after, descriptorBefore: old.descriptorBefore, descriptorAfter: old.descriptorAfter, namedAfter: old.namedAfter }, old);
    for (const s of [e.nativeBefore, e.nativeAfter]) for (const name of ["dashboard", "spawner"] as const) assertServiceJoins(e, s, name);
  } },
  { id: "N16", name: "unknown.log is not one of the two exact ignored service logs", code: "OTHER_OWNER", change: e => {
    listing(e).names = [...NAMES, "unknown.log"].sort();
    assert.deepEqual(listing(e).names.filter(n => !NAMES.includes(n)), ["unknown.log"]);
    for (const s of [e.nativeBefore, e.nativeAfter]) for (const name of ["dashboard", "spawner"] as const) assertServiceJoins(e, s, name);
  } },
  { id: "M01", name: "sorted canonical lock JSON cannot replace producer insertion order", code: "MALFORMED", change: e => {
    const v = dashboard(e), value = structuredClone(v.lock.value), raw = `${canonicalJsonStringify(value)}\n`;
    sealFile(v.lock.file, raw);
    assert.notEqual(raw, `${JSON.stringify(value)}\n`); assert.deepEqual(v.lock.value, value);
    assert.deepEqual(JSON.parse(raw), value);
  } },
  { id: "M02", name: "file UID must equal its captured root UID", code: "MALFORMED", change: e => {
    const file = dashboard(e).lock.file;
    for (const stat of fileStats(file)) stat.uid = "777";
    assert.ok(fileStats(file).every(s => s.uid === "777")); assert.equal(file.parents[0]!.before.uid, "501");
    assert.equal(file.parents[0]!.after.uid, "501");
  } },
  { id: "M03a", name: "PID file rejects 33 decimal bytes beyond its fixed 32-byte cap", code: "MALFORMED", change: e => {
    const file = dashboard(e).pidFile; sealFile(file, "8".repeat(33));
    assert.equal(file.bytes.byteLength, 33); assert.match(text(file), /^\d{33}$/);
  } },
  { id: "M03b", name: "8193-byte lock violates the byte cap and exact record encoding", code: "MALFORMED", change: e => {
    const v = dashboard(e), record = `${JSON.stringify(v.lock.value)}\n`;
    sealFile(v.lock.file, record + " ".repeat(8193 - Buffer.byteLength(record)));
    assert.equal(v.lock.file.bytes.byteLength, 8193); assert.notEqual(text(v.lock.file), record);
    assert.deepEqual(JSON.parse(text(v.lock.file)), v.lock.value);
  } },
  { id: "M04", name: "service lock owner source requires observed_os rather than tracked_child", code: "MALFORMED", change: e => {
    const v = dashboard(e);
    // Explicitly untrusted test data: this malformed source is outside the
    // parsed evidence type, so mutate it through Reflect rather than a cast.
    Reflect.set(v.lock.value.ownerIdentity, "source", "tracked_child"); sealLock(v);
    assert.equal(Reflect.get(v.lock.value.ownerIdentity, "source"), "tracked_child");
    assert.equal(v.identity.expected.source, "observed_os");
    assert.equal(JSON.parse(text(v.lock.file)).ownerIdentity.source, "tracked_child");
  } },
];

for (const defect of defects) {
  test(`${defect.id} ${defect.name}`, async () => {
    const f = await fresh(); assertP0(f);
    const before = structuredClone(f.evidence);
    defect.change(f.evidence);
    assertUnrelatedAuthorities(f.evidence, before);
    refuse(f, defect.code);
  });
}

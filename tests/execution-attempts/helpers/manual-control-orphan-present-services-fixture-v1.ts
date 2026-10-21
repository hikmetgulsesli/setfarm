import { createHash } from "node:crypto";
import { makeSyntheticManualOrphanEvidenceV1, syntheticBytesV1 } from "./manual-control-orphan-fixture-v1.js";
import type { ManualOrphanEvidenceV1 } from "../../../src/execution/schemas/manual-control-orphan-retirement-v1.js";
import type { ManualRecordV1 } from "../../../src/execution/schemas/manual-evaluation-record-v1.js";

// Fixed, detached component data only. These values do not observe a process,
// read a service file, choose an installation, or grant an effect capability.
type Snapshot = ManualOrphanEvidenceV1["nativeBefore"];
type Capture = Snapshot["census"];
type Present = Extract<Snapshot["services"][number], { status: "present" }>;
type File = Present["pidFile"];
type Parent = File["parents"][number];
const T0 = "2026-10-20T00:00:00.000Z";
const SOURCE = "b".repeat(40);
const digest = (raw: string) => createHash("sha256").update(raw).digest("hex");
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const services = [
  { service: "dashboard", pid: 801, script: "/fixture/old/dist/server/daemon.js",
    command: "/fixture/node /fixture/old/dist/server/daemon.js 3333" },
  { service: "spawner", pid: 802, script: "/fixture/old/dist/spawner.js",
    command: "/fixture/node /fixture/old/dist/spawner.js" },
] as const;

function serviceFile(relative: string, raw: string, capturedRoot: Parent): File {
  const bytes = syntheticBytesV1(raw);
  const stat = { dev: "1", ino: String(parseInt(digest(relative).slice(0, 12), 16)),
    mode: "33152", nlink: "1", uid: capturedRoot.before.uid, gid: "20", size: String(bytes.byteLength),
    mtimeNs: "1792454400000000000", ctimeNs: "1792454400000000000" };
  const directory = { ...stat, ino: String(parseInt(digest("directory:services").slice(0, 12), 16)),
    mode: "16832", nlink: "2", size: "64" };
  return { relative, bytes, descriptorBefore: { ...stat }, descriptorAfter: { ...stat }, namedAfter: { ...stat },
    parents: [structuredClone(capturedRoot), { relative: "services", before: { ...directory }, after: { ...directory } }] };
}

function identityCapture(snapshot: Snapshot, n: number, sequence: number, argv: string[], stdout: string): Capture {
  // Preserve the baseline's bounded chronology, successful synthetic outcome,
  // empty stderr/errors and complete streams. Only fixed capture data changes.
  const capture = structuredClone(snapshot.collectorIdentity.before);
  capture.captureId = id(n * 100 + sequence);
  capture.collector = structuredClone(snapshot.collector);
  capture.argv = [...argv];
  capture.executorPid = 500 + n * 10 + sequence;
  capture.executorParentPid = snapshot.collector.pid;
  capture.stdout.bytes = syntheticBytesV1(stdout);
  capture.stdout.dataBytesObserved = capture.stdout.bytes.byteLength;
  return capture;
}

export function makeSyntheticManualOrphanPresentServicesEvidenceV1(): { evidence: ManualOrphanEvidenceV1; priorRecord: ManualRecordV1 } {
  const { evidence, priorRecord } = structuredClone(makeSyntheticManualOrphanEvidenceV1());
  const root = evidence.reservation.file.parents[0]!;
  const pairs = services.map(({ service, pid, script }) => {
    // Producer insertion order is part of the record-byte contract. The lock
    // owner has five fields; the seven-field expected owner below adds a hash.
    const value: Present["lock"]["value"] = {
      schema: "setfarm.fresh-service-process.v1", service, installationDirectory: "/fixture/installation",
      sourceSha: SOURCE, executable: "/fixture/node", script,
      ownerIdentity: { schema: "setfarm.process-identity.v1", pid, processStartedAt: T0,
        processGroupId: pid, source: "observed_os" },
    };
    return { lock: { file: serviceFile(`services/${service}.lock`, `${JSON.stringify(value)}\n`, root), value },
      pidFile: serviceFile(`services/${service}.pid`, String(pid), root) };
  });
  for (const [index, snapshot] of [evidence.nativeBefore, evidence.nativeAfter].entries()) {
    const n = index + 1;
    snapshot.services = services.map(({ service, pid, script, command }, serviceIndex): Present => {
      const sequence = serviceIndex === 0 ? 5 : 8;
      const argv = ["-ww", "-p", String(pid), "-o", "lstart=", "-o", "pgid=", "-o", "args="];
      const raw = `Tue Oct 20 00:00:00 2026 ${pid} ${command}\n`;
      // Each bracket owns independent copies of equal complete file evidence.
      const pair = structuredClone(pairs[serviceIndex]!);
      return { service, status: "present", ...pair,
        identity: { subject: service,
          expected: { pid, processStartedAt: T0, processGroupId: pid, source: "observed_os",
            executable: "/fixture/node", script, commandHash: digest(command) },
          before: identityCapture(snapshot, n, sequence, argv, raw),
          comm: identityCapture(snapshot, n, sequence + 1, ["-ww", "-p", String(pid), "-o", "comm="], "/fixture/node\n"),
          after: identityCapture(snapshot, n, sequence + 2, argv, raw) },
      };
    });
    const original = Buffer.from(snapshot.census.stdout.bytes.base64, "base64").toString("utf8");
    const appended = services.map(({ pid, command }) => `${pid} 1 ${pid} ${command}\n`).join("");
    snapshot.census.stdout.bytes = syntheticBytesV1(original + appended);
    snapshot.census.stdout.dataBytesObserved = snapshot.census.stdout.bytes.byteLength;
  }
  const listing = evidence.namespace.directories.find(d => d.relative === "services");
  if (!listing) throw new Error("Synthetic baseline lacks its services directory listing");
  listing.names = ["dashboard.lock", "dashboard.pid", "spawner.lock", "spawner.pid"];
  return structuredClone({ evidence, priorRecord });
}

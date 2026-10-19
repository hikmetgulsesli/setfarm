import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { spawnSync } from "node:child_process";
import { z } from "zod";
import { pgBegin, lockInternalProductionWorkflowRunInsertionFenceV1, type PgTransactionSql } from "../db-pg.js";
import { freshInstallationSelectionV1, assertFreshInstallationSelectionUnchangedV1 } from "../installation/fresh-installation-selection-v1.js";
import { assertFreshInstallationOperationalEntryV1 } from "../installation/fresh-installation-entry-v1.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { requireFindingPublicationV1, type FindingPublicationParentRowV1, type FindingPublicationChildRowV1 } from "../findings/finding-publication-v1.js";
import { loadConvergenceSuite } from "../evals/suite-schema.js";
import { V3ReleaseAdmissionV1Schema, canarySelectorHash } from "./v3-release-admission.js";
import type { PersistWorkflowRunInputV1 } from "./run-persistence.js";
import { ControlPrivateIntentV1Schema, ControlWorkerCustodyV1Schema, hashControlSelectionIdentityV1, type ControlWorkerCustodyV1 } from "./schemas/manual-control-job-v1.js";

const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const AcquireSchema = z.object({ jobId: z.string().uuid(), kind: z.enum(["activation_preflight", "convergence_full8"]),
  selectionHash: Hash, sourceSha: z.string().regex(/^[a-f0-9]{40}$/), suiteHash: Hash.nullable() }).strict();
const ReservationSchema = AcquireSchema.extend({ revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  phase: z.enum(["pending", "active", "cancelling", "ownership_unknown", "released"]) }).strict();
export type ManualEvaluationReservationV1 = Readonly<z.infer<typeof ReservationSchema>>;
const SlotSchema = z.object({ admissionHash: Hash, slotHash: Hash, caseHash: Hash, taskHash: Hash, repetition: z.literal(1) }).strict();
export type BoundCanarySlotV1 = Readonly<z.infer<typeof SlotSchema>>;
const OwnerSchema = z.object({ pid: z.number().int().positive(), processStartedAt: z.string().datetime(),
  processGroupId: z.number().int().positive(), source: z.literal("observed_os"), executable: z.string().min(1), script: z.string().min(1), commandHash: Hash }).strict();
type Owner = Readonly<z.infer<typeof OwnerSchema>>;
const RecordSchema = z.object({ schema: z.literal("setfarm.manual-evaluation-record.v1"), reservation: ReservationSchema,
  owner: OwnerSchema, intentHash: Hash, nonceDigest: Hash, admissionHash: Hash.nullable(), slots: z.array(SlotSchema).max(8),
  executionMode: z.enum(["preflight", "execute"]) }).strict();
type RecordV1 = z.infer<typeof RecordSchema>;
type ParentPin = { locator: string; stat: fs.BigIntStats };
type FilePin = { locator: string; bytes: Buffer; stat: fs.BigIntStats; parents: ParentPin[] };
type Custody = { input: z.infer<typeof AcquireSchema>; owner: Owner; intent: FilePin; nonceDigest: string; executionMode: "preflight" | "execute" };
const custodies = new Map<string, Custody>();
const observedPins = new WeakMap<ManualEvaluationReservationV1, FilePin>();
const SUITE = "evals/suites/product-convergence-codex-v1.json";

function refuseV1(code = "MANUAL_EVALUATION_OWNERSHIP_UNKNOWN"): never { throw new Error(code); }
function sameStatV1(a: fs.BigIntStats, b: fs.BigIntStats, file: boolean): boolean {
  const keys: (keyof fs.BigIntStats)[] = file
    ? ["dev", "ino", "uid", "gid", "mode", "nlink", "size", "mtimeNs", "ctimeNs"]
    : ["dev", "ino", "uid", "gid", "mode"];
  return keys.every(key => a[key] === b[key]);
}
function pinParentsV1(directory: string, privateRoot: string): ParentPin[] {
  if (!path.isAbsolute(directory) || path.normalize(directory) !== directory
    || !path.isAbsolute(privateRoot) || path.normalize(privateRoot) !== privateRoot
    || !(directory === privateRoot || directory.startsWith(`${privateRoot}${path.sep}`))) refuseV1();
  const pins: ParentPin[] = [];
  for (let locator = directory; ; locator = path.dirname(locator)) {
    const stat = fs.lstatSync(locator, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink() || pins.length >= 128) refuseV1();
    if ((locator === privateRoot || locator.startsWith(`${privateRoot}${path.sep}`))
      && (stat.uid !== BigInt(process.getuid!()) || (stat.mode & 0o7777n) !== 0o700n)) refuseV1();
    pins.push({ locator, stat });
    if (path.dirname(locator) === locator) break;
  }
  return pins;
}
function assertParentsV1(pins: ParentPin[]): void {
  for (const pin of pins) if (!sameStatV1(pin.stat, fs.lstatSync(pin.locator, { bigint: true }), false)) refuseV1();
}
function readPrivateFileV1(locator: string, cap: number, privateRoot: string): FilePin {
  const parents = pinParentsV1(path.dirname(locator), privateRoot);
  const before = fs.lstatSync(locator, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || before.uid !== BigInt(process.getuid!())
    || (before.mode & 0o7777n) !== 0o600n || before.size <= 0n || before.size > BigInt(cap)) refuseV1();
  const fd = fs.openSync(locator, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    if (!sameStatV1(before, fs.fstatSync(fd, { bigint: true }), true)) refuseV1();
    const bytes = Buffer.alloc(Number(before.size));
    if (fs.readSync(fd, bytes, 0, bytes.length, 0) !== bytes.length || fs.readSync(fd, Buffer.alloc(1), 0, 1, bytes.length) !== 0) refuseV1();
    if (!sameStatV1(before, fs.fstatSync(fd, { bigint: true }), true)
      || !sameStatV1(before, fs.lstatSync(locator, { bigint: true }), true)) refuseV1();
    assertParentsV1(parents);
    return { locator, bytes, stat: before, parents };
  } finally { fs.closeSync(fd); }
}
function syncDirectoryV1(directory: string): void {
  const fd = fs.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function publishExclusiveV1(locator: string, bytes: Buffer, privateRoot: string): FilePin {
  const parents = pinParentsV1(path.dirname(locator), privateRoot);
  const fd = fs.openSync(locator, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try {
    if (fs.writeSync(fd, bytes) !== bytes.length) refuseV1();
    fs.fsyncSync(fd); assertParentsV1(parents);
    if (!sameStatV1(fs.fstatSync(fd, { bigint: true }), fs.lstatSync(locator, { bigint: true }), true)) refuseV1();
  } finally { fs.closeSync(fd); }
  syncDirectoryV1(path.dirname(locator));
  const pin = readPrivateFileV1(locator, bytes.length, privateRoot);
  if (!pin.bytes.equals(bytes)) refuseV1();
  return pin;
}
function sameOwnerV1(a: Owner, b: Owner): boolean {
  return a.source === "observed_os" && b.source === "observed_os"
    && ["pid", "processStartedAt", "processGroupId", "executable", "script", "commandHash"].every(key =>
      Reflect.get(a, key) !== undefined && Reflect.get(a, key) === Reflect.get(b, key));
}
function bytesV1(value: unknown): Buffer { return Buffer.from(`${JSON.stringify(value)}\n`); }
function digestV1(bytes: Buffer | string): string { return createHash("sha256").update(bytes).digest("hex"); }
function optionalStatV1(locator: string): fs.Stats | null {
  try { return fs.lstatSync(locator); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
function selectionV1() {
  assertFreshInstallationSelectionUnchangedV1();
  const selected = freshInstallationSelectionV1;
  if (!selected?.activation?.acknowledged || !selected.activation.activatedPin) refuseV1("MANUAL_EVALUATION_SELECTION_REQUIRED");
  selected.assertUnchanged();
  const selectionHash = hashControlSelectionIdentityV1({ schema: "setfarm.manual-control-selection.v1",
    installationId: selected.state.origin.installationId, sourceSha: selected.state.origin.sourceSha,
    installationDir: selected.directory, releaseDir: selected.paths.repository, catalogHash: selected.catalogHash,
    activationPreparedHash: selected.activation.preparedPin.sha256, activationAcknowledgedHash: selected.activation.activatedPin.sha256 });
  selected.assertUnchanged();
  return { selected, selectionHash, root: path.join(selected.paths.root, "evals", "manual-controls") };
}
function createChildV1(parent: string, child: string, privateRoot: string): string {
  const pins = pinParentsV1(parent, privateRoot); const directory = path.join(parent, child);
  try { fs.mkdirSync(directory, { mode: 0o700 }); syncDirectoryV1(parent); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  assertParentsV1(pins); pinParentsV1(directory, privateRoot); return directory;
}
function rootV1(create: boolean): ReturnType<typeof selectionV1> {
  const context = selectionV1();
  const parent = path.dirname(context.root);
  pinParentsV1(parent, context.selected.directory);
  if (create) createChildV1(parent, "manual-controls", context.selected.directory);
  else if (optionalStatV1(context.root)) pinParentsV1(context.root, context.selected.directory);
  return context;
}
function stableV1(pin: FilePin, root: string): void {
  assertParentsV1(pin.parents);
  const current = readPrivateFileV1(pin.locator, pin.bytes.length, root);
  if (!sameStatV1(pin.stat, current.stat, true) || !pin.bytes.equals(current.bytes)) refuseV1();
}
function psV1(args: string[]): string {
  const result = spawnSync("/bin/ps", args, { shell: false, encoding: "utf8", timeout: 5000, maxBuffer: 4 * 1024 * 1024,
    env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LANG: "C", LC_ALL: "C", TZ: "UTC" }, stdio: ["ignore", "pipe", "pipe"] });
  if (result.error || result.signal || result.status !== 0 || result.stderr !== "") refuseV1();
  return result.stdout;
}
function processOwnerV1(pid: number, script: string, executable: string): Owner {
  const output = psV1(["-ww", "-p", String(pid), "-o", "lstart=", "-o", "pgid=", "-o", "comm=", "-o", "args="]);
  const row = /^\s*(\w{3} \w{3} +\d{1,2} \d{2}:\d{2}:\d{2} \d{4})\s+(\d+)\s+(\S+)\s+([^\r\n]+)\n?$/.exec(output);
  if (!row || fs.realpathSync(row[3]!) !== executable || !row[4]!.startsWith(`${executable} ${script}`)
    || !["", " "].includes(row[4]!.slice(`${executable} ${script}`.length, `${executable} ${script}`.length + 1))) refuseV1();
  return OwnerSchema.parse({ pid, processStartedAt: new Date(`${row[1]} UTC`).toISOString(),
    processGroupId: Number(row[2]), source: "observed_os", executable, script, commandHash: digestV1(row[4]!) });
}
function entryV1(kind: "worker" | "direct"): Owner {
  const { selected } = selectionV1();
  const script = path.join(selected.paths.repository, "dist", kind === "worker" ? "cli/control-test-worker-v1.js" : "evals/convergence-runner.js");
  if (!fileURLToPath(import.meta.url).endsWith(".js") || process.execArgv.length !== 0 || process.argv[1] !== script
    || fs.realpathSync(script) !== script || /\s/.test(script)) refuseV1("MANUAL_EVALUATION_ENTRY_REFUSED");
  assertFreshInstallationOperationalEntryV1();
  return processOwnerV1(process.pid, script, fs.realpathSync(process.execPath));
}
async function suiteV1(): Promise<string> {
  const { selected } = selectionV1();
  const loaded = await loadConvergenceSuite(path.join(selected.paths.repository, SUITE));
  if (loaded.suite.repetitionsPerCase !== 1 || loaded.suite.rootCauseRepeatLimit !== 3
    || loaded.suite.timeout.runMs !== 21600000 || loaded.suite.timeout.pollMs !== 15000) refuseV1("MANUAL_EVALUATION_RECIPE_REFUSED");
  selected.assertUnchanged(); return loaded.suiteHash;
}
function assertCustodyV1(input: z.infer<typeof AcquireSchema>): Custody {
  const context = selectionV1(), custody = custodies.get(input.jobId);
  if (!custody || hashCanonicalJson(input) !== hashCanonicalJson(custody.input)
    || input.selectionHash !== context.selectionHash || input.sourceSha !== context.selected.state.origin.sourceSha) refuseV1("MANUAL_EVALUATION_CUSTODY_REQUIRED");
  stableV1(custody.intent, context.selected.directory);
  assertFreshInstallationOperationalEntryV1();
  if (!sameOwnerV1(custody.owner, processOwnerV1(process.pid, custody.owner.script, custody.owner.executable))) refuseV1();
  return custody;
}

export async function registerSelectedManualWorkerCustodyV1(raw: ControlWorkerCustodyV1): Promise<void> {
  const custody = ControlWorkerCustodyV1Schema.parse(raw), owner = entryV1("worker"), context = selectionV1();
  if (process.argv.length !== 4 || process.argv[2] !== "--job-id" || process.argv[3] !== custody.jobId) refuseV1("MANUAL_EVALUATION_ENTRY_REFUSED");
  const locator = path.join(context.selected.paths.root, "mission-control", "controls", "jobs", custody.jobId, "intent.json");
  const pin = readPrivateFileV1(locator, 32768, context.selected.directory);
  const intent = ControlPrivateIntentV1Schema.parse(JSON.parse(pin.bytes.toString("utf8")));
  const receipt = intent.receipt;
  if (receipt.kind === "ui_regression" || intent.installationDir !== context.selected.directory || intent.releaseDir !== context.selected.paths.repository
    || receipt.jobId !== custody.jobId || receipt.selectionHash !== custody.selectionHash || custody.selectionHash !== context.selectionHash
    || receipt.sourceSha !== custody.sourceSha || custody.sourceSha !== context.selected.state.origin.sourceSha
    || receipt.mcBuildHash !== custody.mcBuildHash || !timingSafeEqual(Buffer.from(intent.nonceDigest, "hex"), Buffer.from(digestV1(custody.nonce), "hex"))
    || (receipt.kind === "convergence_full8" && receipt.suiteHash !== await suiteV1())) refuseV1("MANUAL_EVALUATION_CUSTODY_REQUIRED");
  stableV1(pin, context.selected.directory);
  const input = AcquireSchema.parse({ jobId: receipt.jobId, kind: receipt.kind, selectionHash: receipt.selectionHash, sourceSha: receipt.sourceSha, suiteHash: receipt.suiteHash });
  const existing = custodies.get(input.jobId);
  if (existing && (digestV1(existing.intent.bytes) !== digestV1(pin.bytes) || !sameOwnerV1(existing.owner, owner))) refuseV1();
  custodies.set(input.jobId, { input, owner, intent: pin, nonceDigest: intent.nonceDigest, executionMode: "execute" });
}

export async function prepareSelectedDirectEvaluationIntentV1(): Promise<Readonly<z.infer<typeof AcquireSchema> & { kind: "convergence_full8"; suiteHash: string }>> {
  if (arguments.length) refuseV1("MANUAL_EVALUATION_ENTRY_REFUSED");
  const owner = entryV1("direct"), context = rootV1(false);
  const options = new Map<string, string>(); let execute = false;
  for (let index = 2; index < process.argv.length; index++) {
    const key = process.argv[index]!;
    if (options.has(key)) refuseV1("MANUAL_EVALUATION_RECIPE_REFUSED");
    if (key === "--execute" || key === "--json") { options.set(key, "true"); if (key === "--execute") execute = true; }
    else if (["--suite", "--output-root", "--release-sha"].includes(key) && process.argv[index + 1]) options.set(key, process.argv[++index]!);
    else refuseV1("MANUAL_EVALUATION_RECIPE_REFUSED");
  }
  if (options.get("--suite") !== path.join(context.selected.paths.repository, SUITE)
    || (options.has("--output-root") && options.get("--output-root") !== context.selected.paths.evals)
    || (options.has("--release-sha") && options.get("--release-sha") !== context.selected.state.origin.sourceSha)
    || (execute && !options.has("--release-sha"))) refuseV1("MANUAL_EVALUATION_RECIPE_REFUSED");
  const input = { jobId: randomUUID(), kind: "convergence_full8" as const, selectionHash: context.selectionHash,
    sourceSha: context.selected.state.origin.sourceSha, suiteHash: await suiteV1() };
  const nonceDigest = digestV1(randomBytes(32));
  rootV1(true); const directory = createChildV1(context.root, "direct", context.selected.directory);
  const mode = execute ? "execute" as const : "preflight" as const;
  const pin = publishExclusiveV1(path.join(directory, `${input.jobId}.json`), bytesV1({ schema: "setfarm.manual-direct-evaluation-intent.v1", ...input, executionMode: mode, owner, nonceDigest }), context.selected.directory);
  custodies.set(input.jobId, { input, owner, intent: pin, nonceDigest, executionMode: mode });
  return Object.freeze(input);
}

function readRecordV1(ignoreMutation = false): { record: RecordV1; pin: FilePin; uncertain: boolean } | null {
  const context = rootV1(false);
  if (!optionalStatV1(context.root)) return null;
  const mutation = optionalStatV1(path.join(context.root, "mutation.json"));
  const locator = path.join(context.root, "reservation.json");
  if (!optionalStatV1(locator)) { if (mutation && !ignoreMutation) refuseV1(); return null; }
  const pin = readPrivateFileV1(locator, 65536, context.selected.directory);
  const record = RecordSchema.parse(JSON.parse(pin.bytes.toString("utf8")));
  if (!bytesV1(record).equals(pin.bytes) || record.reservation.selectionHash !== context.selectionHash
    || record.reservation.sourceSha !== context.selected.state.origin.sourceSha) refuseV1();
  return { record, pin, uncertain: !!mutation && !ignoreMutation };
}
function publishRecordV1(record: RecordV1, previous: FilePin | null): void {
  const context = rootV1(true), bytes = bytesV1(RecordSchema.parse(record));
  const revisions = createChildV1(context.root, "revisions", context.selected.directory);
  publishExclusiveV1(path.join(revisions, `${String(record.reservation.revision).padStart(20, "0")}.json`), bytes, context.selected.directory);
  const locator = path.join(context.root, "reservation.json");
  if (!previous) { publishExclusiveV1(locator, bytes, context.selected.directory); return; }
  stableV1(previous, context.selected.directory);
  const temporary = path.join(context.root, `${randomUUID()}.tmp`);
  const pin = publishExclusiveV1(temporary, bytes, context.selected.directory);
  stableV1(previous, context.selected.directory); stableV1(pin, context.selected.directory);
  fs.renameSync(temporary, locator); syncDirectoryV1(context.root);
  if (!readPrivateFileV1(locator, 65536, context.selected.directory).bytes.equals(bytes)) refuseV1();
}
async function mutateV1<T>(action: (sql: PgTransactionSql) => Promise<T>): Promise<T> {
  let lock: FilePin | undefined;
  const context = rootV1(false);
  // The existing DB epoch serializes publication. Custody persists beyond the
  // transaction acknowledgement; rollback/crash never erases this evidence.
  const result = await pgBegin(async sql => {
    await lockInternalProductionWorkflowRunInsertionFenceV1(sql);
    if (optionalStatV1(path.join(context.root, "mutation.json"))) refuseV1("MANUAL_EVALUATION_RESERVED");
    // Readiness runs inside action before its first publication via acquire.
    const createLock = () => {
      rootV1(true);
      lock = publishExclusiveV1(path.join(context.root, "mutation.json"), bytesV1({ schema: "setfarm.manual-evaluation-mutation.v1", pid: process.pid, nonce: randomUUID() }), context.selected.directory);
    };
    mutationStarters.set(sql, createLock);
    try { return await action(sql); } finally { mutationStarters.delete(sql); }
  });
  context.selected.assertUnchanged();
  if (lock) { stableV1(lock, context.selected.directory); fs.unlinkSync(lock.locator); syncDirectoryV1(context.root); }
  context.selected.assertUnchanged();
  return result as T;
}
const mutationStarters = new WeakMap<object, () => void>();
function startMutationV1(sql: PgTransactionSql): void { const start = mutationStarters.get(sql); if (!start) refuseV1(); start(); mutationStarters.delete(sql); }

async function idleV1(sql: PgTransactionSql): Promise<void> {
  const rows = await sql.unsafe<Record<string, unknown>[]>(`SELECT
    (SELECT count(*)::integer FROM runs WHERE status IN ('running','resuming','cancelling','failing')) AS active_runs,
    (SELECT count(*)::integer FROM claim_log WHERE outcome IS NULL) AS open_claims,
    (SELECT count(*)::integer FROM execution_attempts WHERE disposition IN ('claimed','running')) AS active_attempts,
    (SELECT count(*)::integer FROM execution_attempts a LEFT JOIN claim_log c ON c.id=a.claim_id AND c.run_id=a.run_id AND c.step_id=a.step_id AND COALESCE(c.story_id,'')=a.story_id AND (a.agent_id IS NULL OR c.agent_id=a.agent_id) AND c.outcome IS NULL WHERE a.disposition IN ('claimed','running') AND c.id IS NULL) AS active_attempt_binding_conflicts,
    (SELECT count(*)::integer FROM runtime_sessions WHERE state NOT IN ('released','quarantined')) AS active_runtimes,
    (SELECT count(*)::integer FROM runtime_completion_requests WHERE state NOT IN ('accepted','rejected','quarantined')) AS active_runtime_completions,
    (SELECT count(*)::integer FROM runtime_completion_effects WHERE mandatory IS TRUE AND state NOT IN ('applied','reconciled')) AS active_completion_effects,
    (SELECT count(*)::integer FROM recovery_cases WHERE status IN ('open','repairing','evidencing')) AS active_recovery_cases,
    (SELECT count(*)::integer FROM recovery_dispatch_deliveries WHERE state IN ('authorized','leased','attempt_reserved','running')) AS active_recovery_deliveries,
    (SELECT count(*)::integer FROM run_termination_requests WHERE state<>'terminalized') AS active_termination_requests,
    (SELECT count(*)::integer FROM product_compilation_attempts WHERE state IN ('reserved','dispatching')) AS active_compilations,
    (SELECT count(*)::integer FROM artifact_publication_reservations WHERE state='reserved') AS active_publications,
    (SELECT count(*)::integer FROM artifact_publication_batches WHERE state='active') AS active_publication_batches,
    (SELECT count(*)::integer FROM operational_outbox WHERE state IN ('pending','leased')) AS active_outbox,
    (SELECT count(*)::integer FROM operational_event_deliveries WHERE state IN ('pending','leased')) AS active_operational_deliveries,
    (SELECT count(*)::integer FROM internal_production_owner_reservations_v1 WHERE state IN ('pending','bound')) AS active_owner_reservations`);
  const fields = ["active_runs", "open_claims", "active_attempts", "active_attempt_binding_conflicts", "active_runtimes", "active_runtime_completions", "active_completion_effects", "active_recovery_cases", "active_recovery_deliveries", "active_termination_requests", "active_compilations", "active_publications", "active_publication_batches", "active_outbox", "active_operational_deliveries", "active_owner_reservations"];
  if (rows.length !== 1 || Object.keys(rows[0]!).length !== fields.length
    || fields.some(field => !Number.isSafeInteger(rows[0]![field]) || Number(rows[0]![field]) < 0)) refuseV1("MANUAL_EVALUATION_ACTIVITY_UNKNOWN");
  if (fields.some(field => rows[0]![field] !== 0)) refuseV1("MANUAL_EVALUATION_ACTIVITY_PRESENT");
  // An open historical issue is not unfinished publication work. Validate the
  // actual immutable parent/child publication relation instead of issue prose.
  const parents = await sql.unsafe<FindingPublicationParentRowV1[]>("SELECT finding_set_hash,finding_set_id,run_id,story_id,packet_hash,slice_hash,source_sha,source_tree_hash,finding_ids,payload FROM finding_sets ORDER BY finding_set_hash LIMIT 4097");
  const children = await sql.unsafe<FindingPublicationChildRowV1[]>("SELECT finding_set_hash,finding_id,origin,classification,invariant_ref,status,source_fingerprint,payload FROM findings ORDER BY finding_set_hash,finding_id LIMIT 65537");
  if (parents.length > 4096 || children.length > 65536) refuseV1("MANUAL_EVALUATION_ACTIVITY_UNKNOWN");
  const groups = new Map(parents.map(parent => [parent.finding_set_hash, [] as FindingPublicationChildRowV1[]]));
  for (const child of children) { const group = groups.get(child.finding_set_hash); if (!group) refuseV1("MANUAL_EVALUATION_ACTIVITY_UNKNOWN"); group.push(child); }
  for (const parent of parents) requireFindingPublicationV1(parent, groups.get(parent.finding_set_hash)!);
}

type ProcessRow = { pid: number; parentPid: number; processGroupId: number; command: string };
function parseProcessTableV1(output: string): ProcessRow[] {
  const lines = output.split("\n").filter(Boolean);
  if (lines.length > 65536) refuseV1();
  const seen = new Set<number>();
  return lines.map(line => {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/.exec(line);
    if (!match) refuseV1();
    const row = { pid: Number(match[1]), parentPid: Number(match[2]), processGroupId: Number(match[3]), command: match[4]! };
    if (!Number.isSafeInteger(row.pid) || row.pid <= 0 || seen.has(row.pid)
      || !Number.isSafeInteger(row.parentPid) || row.parentPid < 0
      || !Number.isSafeInteger(row.processGroupId) || row.processGroupId < 0) refuseV1();
    seen.add(row.pid); return row;
  });
}
function hasOwnedChildrenV1(rows: readonly ProcessRow[], owner: Pick<Owner, "pid" | "processGroupId">): boolean {
  const byPid = new Map(rows.map(row => [row.pid, row]));
  for (const row of rows) {
    if (row.pid === owner.pid) continue;
    if (owner.processGroupId === owner.pid && row.processGroupId === owner.processGroupId) return true;
    let parent = row.parentPid;
    const seen = new Set<number>([row.pid]);
    while (parent > 0) {
      if (parent === owner.pid) return true;
      if (seen.has(parent)) refuseV1();
      seen.add(parent);
      const ancestor = byPid.get(parent); if (!ancestor) break;
      parent = ancestor.parentPid;
    }
  }
  return false;
}
function externalOwnersV1(self?: Custody): "none" | "owned" {
  const { selected, root } = rootV1(false);
  const maintenanceRoot = path.join(selected.paths.repository, ".setfarm");
  if (optionalStatV1(maintenanceRoot)) {
    const entries = fs.readdirSync(maintenanceRoot);
    if (entries.length > 4096) refuseV1();
    // Presence, including incomplete/temp/old owner residue, blocks. Never
    // invoke maintenance's stale-lock recovery or retained-generation cleanup.
    if (entries.some(name => name === "build-generation-maintenance-lock-v1.json" || name.startsWith(".build-generation-maintenance-lock-v1.json."))) return "owned";
  }
  const executable = fs.realpathSync(process.execPath);
  const scripts = [path.join(selected.paths.repository, "dist/cli/control-test-worker-v1.js"), path.join(selected.paths.repository, "dist/evals/convergence-runner.js")];
  const rows = parseProcessTableV1(psV1(["-ww", "-axo", "pid=,ppid=,pgid=,command="]));
  for (const row of rows) {
    const argv = row.command.split(/\s+/), script = argv[1];
    const selectedMention = scripts.some(candidate => argv.includes(candidate))
      || argv.includes(path.join(selected.paths.repository, "src/evals/convergence-runner.ts"))
      || argv.includes(path.join(selected.paths.repository, "src/cli/control-test-worker-v1.ts"));
    if (!selectedMention) continue;
    if (!script || !scripts.includes(script) || argv[0] !== executable) refuseV1();
    const owner = processOwnerV1(row.pid, script, executable);
    if (owner.processGroupId !== row.processGroupId) refuseV1();
    if (!self || !sameOwnerV1(self.owner, owner) || hasOwnedChildrenV1(rows, owner)) return "owned";
  }
  if (self && hasOwnedChildrenV1(rows, self.owner)) return "owned";
  // Persistent ready services are checked as infrastructure, not counted as jobs.
  const services = path.join(selected.paths.root, "services");
  if (optionalStatV1(services)) for (const service of ["dashboard", "spawner"] as const) {
    const lockPath = path.join(services, `${service}.lock`), pidPath = path.join(services, `${service}.pid`);
    if (!optionalStatV1(lockPath) && !optionalStatV1(pidPath)) continue;
    const lock = readPrivateFileV1(lockPath, 8192, selected.directory), pid = readPrivateFileV1(pidPath, 32, selected.directory);
    const record = JSON.parse(lock.bytes.toString("utf8"));
    const expected = path.join(selected.paths.repository, "dist", service === "dashboard" ? "server/daemon.js" : "spawner.js");
    if (record.schema !== "setfarm.fresh-service-process.v1" || record.service !== service || record.installationDirectory !== selected.directory
      || record.sourceSha !== selected.state.origin.sourceSha || record.executable !== executable || record.script !== expected
      || pid.bytes.toString() !== String(record.ownerIdentity?.pid)) refuseV1();
    if (Object.keys(record).sort().join(",") !== ["schema", "service", "installationDirectory", "sourceSha", "executable", "script", "ownerIdentity"].sort().join(",")
      || record.ownerIdentity?.schema !== "setfarm.process-identity.v1"
      || Object.keys(record.ownerIdentity).sort().join(",") !== ["schema", "pid", "processStartedAt", "processGroupId", "source"].sort().join(",")) refuseV1();
    const { schema: _schema, ...identity } = record.ownerIdentity;
    const observed = processOwnerV1(identity.pid, expected, executable);
    const owner = OwnerSchema.parse({ ...identity, executable, script: expected, commandHash: observed.commandHash });
    if (!sameOwnerV1(owner, observed)) refuseV1();
    stableV1(lock, selected.directory); stableV1(pid, selected.directory);
  }
  // Direct intents published before reservation are durable ownership too.
  const direct = path.join(root, "direct");
  if (optionalStatV1(direct)) {
    pinParentsV1(direct, selected.directory);
    const entries = fs.readdirSync(direct); if (entries.length > 4096) refuseV1();
    for (const name of entries) {
      if (/^[a-f0-9-]{36}\.released$/.test(name)) {
        if (!entries.includes(name.replace(/\.released$/, ".json"))) refuseV1();
        continue;
      }
      if (!/^[a-f0-9-]{36}\.json$/.test(name)) refuseV1();
      const pin = readPrivateFileV1(path.join(direct, name), 16384, selected.directory);
      if (self && pin.locator === self.intent.locator) { stableV1(self.intent, selected.directory); continue; }
      const jobId = name.slice(0, -5), done = path.join(direct, `${jobId}.released`);
      if (!optionalStatV1(done)) return "owned";
      const released = readPrivateFileV1(done, 65536, selected.directory);
      const value = RecordSchema.parse(JSON.parse(released.bytes.toString("utf8")));
      if (value.reservation.jobId !== jobId || value.reservation.phase !== "released" || value.intentHash !== digestV1(pin.bytes)) refuseV1();
    }
  }
  selected.assertUnchanged(); return "none";
}

function recordedCustodyV1(record: RecordV1): Custody {
  const { selected, root } = selectionV1();
  const worker = path.join(selected.paths.repository, "dist/cli/control-test-worker-v1.js");
  const direct = path.join(selected.paths.repository, "dist/evals/convergence-runner.js");
  if (![worker, direct].includes(record.owner.script) || record.owner.executable !== fs.realpathSync(process.execPath)
    || !sameOwnerV1(record.owner, processOwnerV1(record.owner.pid, record.owner.script, record.owner.executable))) refuseV1();
  const isWorker = record.owner.script === worker;
  const locator = isWorker
    ? path.join(selected.paths.root, "mission-control", "controls", "jobs", record.reservation.jobId, "intent.json")
    : path.join(root, "direct", `${record.reservation.jobId}.json`);
  const intent = readPrivateFileV1(locator, 32768, selected.directory);
  if (digestV1(intent.bytes) !== record.intentHash) refuseV1();
  const { revision: _revision, phase: _phase, ...input } = record.reservation;
  if (isWorker) {
    const parsed = ControlPrivateIntentV1Schema.parse(JSON.parse(intent.bytes.toString("utf8")));
    if (parsed.nonceDigest !== record.nonceDigest || parsed.installationDir !== selected.directory || parsed.releaseDir !== selected.paths.repository
      || Object.keys(input).some(key => Reflect.get(input, key) !== Reflect.get(parsed.receipt, key))) refuseV1();
  } else {
    const parsed = JSON.parse(intent.bytes.toString("utf8"));
    if (parsed.schema !== "setfarm.manual-direct-evaluation-intent.v1" || parsed.nonceDigest !== record.nonceDigest
      || parsed.executionMode !== record.executionMode || !sameOwnerV1(OwnerSchema.parse(parsed.owner), record.owner)
      || Object.keys(input).some(key => Reflect.get(input, key) !== Reflect.get(parsed, key))) refuseV1();
  }
  selected.assertUnchanged();
  return { input, owner: record.owner, intent, nonceDigest: record.nonceDigest, executionMode: record.executionMode };
}
export async function observeSelectedEvaluatorOwnersV1(): Promise<"none" | "owned" | "unknown"> {
  try {
    if (!freshInstallationSelectionV1) { assertFreshInstallationSelectionUnchangedV1(); return "none"; }
    const current = readRecordV1();
    if (current?.uncertain) return "unknown";
    if (current && current.record.reservation.phase !== "released") { recordedCustodyV1(current.record); return "owned"; }
    return externalOwnersV1();
  } catch { return "unknown"; }
}
export async function observeSelectedManualEvaluationInTransactionV1(_sql: PgTransactionSql): Promise<ManualEvaluationReservationV1 | null> {
  if (!freshInstallationSelectionV1) { assertFreshInstallationSelectionUnchangedV1(); return null; }
  const current = readRecordV1();
  if (!current || (!current.uncertain && current.record.reservation.phase === "released")) { if (externalOwnersV1() !== "none") refuseV1(); return null; }
  let uncertain = current.uncertain;
  if (!uncertain) try {
    if (externalOwnersV1(recordedCustodyV1(current.record)) !== "none") uncertain = true;
  } catch { uncertain = true; }
  const reservation = Object.freeze({ ...current.record.reservation, ...(uncertain ? { phase: "ownership_unknown" as const } : {}) });
  observedPins.set(reservation, current.pin); return reservation;
}

export async function acquireSelectedManualEvaluationV1(raw: z.infer<typeof AcquireSchema>): Promise<ManualEvaluationReservationV1> {
  const input = AcquireSchema.parse(raw), custody = assertCustodyV1(input);
  if ((input.kind === "activation_preflight" && input.suiteHash !== null)
    || (input.kind === "convergence_full8" && input.suiteHash !== await suiteV1())) refuseV1("MANUAL_EVALUATION_RECIPE_REFUSED");
  return mutateV1(async sql => {
    const prior = readRecordV1();
    if (prior && (prior.uncertain || prior.record.reservation.phase !== "released")) refuseV1("MANUAL_EVALUATION_RESERVED");
    assertCustodyV1(input); await idleV1(sql); if (externalOwnersV1(custody) !== "none") refuseV1("MANUAL_EVALUATION_RESERVED");
    startMutationV1(sql);
    const record: RecordV1 = { schema: "setfarm.manual-evaluation-record.v1", reservation: { ...input, revision: (prior?.record.reservation.revision ?? 0) + 1, phase: "pending" },
      owner: custody.owner, intentHash: digestV1(custody.intent.bytes), nonceDigest: custody.nonceDigest,
      admissionHash: null, slots: [], executionMode: custody.executionMode };
    publishRecordV1(record, prior?.pin ?? null);
    const pending = readRecordV1(true)!;
    record.reservation = { ...record.reservation, revision: record.reservation.revision + 1, phase: "active" };
    publishRecordV1(record, pending.pin);
    return Object.freeze({ ...record.reservation });
  });
}
function heldV1(reservation: ManualEvaluationReservationV1) {
  const parsed = ReservationSchema.parse(reservation), current = readRecordV1();
  if (!current || current.uncertain || hashCanonicalJson(parsed) !== hashCanonicalJson(current.record.reservation)) refuseV1("MANUAL_EVALUATION_REVISION_CONFLICT");
  if (parsed.phase !== "active" && parsed.phase !== "cancelling") refuseV1();
  const { revision: _revision, phase: _phase, ...input } = parsed;
  const custody = assertCustodyV1(input);
  if (!sameOwnerV1(custody.owner, current.record.owner) || current.record.intentHash !== digestV1(custody.intent.bytes)
    || current.record.nonceDigest !== custody.nonceDigest) refuseV1();
  return { ...current, custody };
}
async function admissionV1(sql: PgTransactionSql, admissionHash: string) {
  const rows = await sql.unsafe<Array<{ payload: unknown; expires_at: Date | string; expired: boolean }>>(
    "SELECT payload,expires_at,expires_at <= clock_timestamp() AS expired FROM v3_release_admissions WHERE admission_hash=$1", [admissionHash]);
  if (rows.length !== 1) refuseV1("MANUAL_EVALUATION_CANARY_REFUSED");
  const value = V3ReleaseAdmissionV1Schema.parse(rows[0]!.payload);
  if (value.kind !== "convergence_canary" || value.admissionHash !== admissionHash || rows[0]!.expired !== false
    || new Date(rows[0]!.expires_at).toISOString() !== value.expiresAt) refuseV1("MANUAL_EVALUATION_CANARY_REFUSED");
  return value;
}
export async function bindSelectedManualCanaryV1(input: { reservation: ManualEvaluationReservationV1; admissionHash: string; slots: readonly BoundCanarySlotV1[] }): Promise<ManualEvaluationReservationV1> {
  return mutateV1(async sql => {
    const held = heldV1(input.reservation);
    if (held.record.reservation.kind !== "convergence_full8" || held.record.executionMode !== "execute") refuseV1("MANUAL_EVALUATION_CANARY_REFUSED");
    const slots = z.array(SlotSchema).min(1).max(8).parse(input.slots), admission = await admissionV1(sql, Hash.parse(input.admissionHash));
    if (admission.suiteHash !== held.record.reservation.suiteHash || admission.releaseSha !== held.record.reservation.sourceSha
      || new Set(slots.map(slot => slot.slotHash)).size !== slots.length
      || slots.some(slot => slot.admissionHash !== admission.admissionHash || !admission.slots.some(stored =>
        stored.slotHash === slot.slotHash && stored.caseHash === slot.caseHash && stored.taskHash === slot.taskHash && stored.repetition === slot.repetition))) refuseV1("MANUAL_EVALUATION_CANARY_REFUSED");
    await idleV1(sql); if (externalOwnersV1(held.custody) !== "none") refuseV1();
    startMutationV1(sql);
    const record = { ...held.record, admissionHash: admission.admissionHash, slots,
      reservation: { ...held.record.reservation, revision: held.record.reservation.revision + 1 } };
    publishRecordV1(record, held.pin); return Object.freeze(record.reservation);
  });
}
export async function assertSelectedManualRunInsertionV1(sql: PgTransactionSql, reservation: ManualEvaluationReservationV1 | null, run: PersistWorkflowRunInputV1["run"]): Promise<void> {
  const current = await observeSelectedManualEvaluationInTransactionV1(sql);
  if (current === null && reservation === null) return;
  if (!current || !reservation || hashCanonicalJson(current) !== hashCanonicalJson(reservation) || current.phase !== "active") refuseV1("MANUAL_EVALUATION_RESERVED");
  const context = rootV1(false), prior = observedPins.get(reservation); if (!prior) refuseV1(); stableV1(prior, context.selected.directory);
  const stored = readRecordV1(); if (!stored || stored.uncertain) refuseV1();
  const canary = run.protocol.canaryAdmission;
  if (!canary || current.kind !== "convergence_full8" || stored.record.executionMode !== "execute" || run.protocol.mode !== "v3"
    || run.protocol.releaseAdmissionKind !== "convergence_canary" || run.protocol.compilerReleaseSha !== current.sourceSha
    || canary.admissionHash !== stored.record.admissionHash || run.protocol.releaseAdmissionHash !== canary.admissionHash
    || canary.taskHash !== hashCanonicalJson(run.task)
    || !stored.record.slots.some(slot => Object.keys(slot).every(key => Reflect.get(slot, key) === Reflect.get(canary, key)))) refuseV1("MANUAL_EVALUATION_RESERVED");
  const admission = await admissionV1(sql, canary.admissionHash);
  if (admission.suiteHash !== current.suiteHash || admission.releaseSha !== current.sourceSha
    || !admission.slots.some(slot => slot.slotHash === canary.slotHash && slot.caseHash === canary.caseHash && slot.taskHash === canary.taskHash
      && slot.repetition === canary.repetition && slot.selectorHash === canarySelectorHash(canary.slotToken))) refuseV1("MANUAL_EVALUATION_CANARY_REFUSED");
  const claims = await sql.unsafe<Array<{ run_id: string | null; consumed_at: unknown; selector_hash: string; admission_hash: string }>>(
    "SELECT run_id,consumed_at,selector_hash,admission_hash FROM v3_canary_admission_claims WHERE slot_hash=$1 FOR UPDATE", [canary.slotHash]);
  if (claims.length !== 1 || claims[0]!.run_id !== null || claims[0]!.consumed_at !== null
    || claims[0]!.admission_hash !== canary.admissionHash || claims[0]!.selector_hash !== canarySelectorHash(canary.slotToken)) refuseV1("MANUAL_EVALUATION_CANARY_REFUSED");
}
export async function assertNoSelectedManualRecoveryInsertionV1(sql: PgTransactionSql): Promise<void> {
  if (await observeSelectedManualEvaluationInTransactionV1(sql)) refuseV1("MANUAL_EVALUATION_RESERVED");
}
export async function releaseSelectedManualEvaluationV1(reservation: ManualEvaluationReservationV1): Promise<void> {
  await mutateV1(async sql => {
    const held = heldV1(reservation); await idleV1(sql);
    if (externalOwnersV1(held.custody) !== "none") refuseV1();
    for (const slot of held.record.slots) {
      const claims = await sql.unsafe<Array<{ run_id: string | null; consumed_at: unknown; status: string | null; release_admission_hash: string | null }>>(
        "SELECT c.run_id,c.consumed_at,r.status,r.release_admission_hash FROM v3_canary_admission_claims c LEFT JOIN runs r ON r.id=c.run_id WHERE c.slot_hash=$1 AND c.admission_hash=$2 FOR UPDATE OF c", [slot.slotHash, slot.admissionHash]);
      if (claims.length !== 1 || (claims[0]!.run_id === null ? claims[0]!.consumed_at !== null
        : claims[0]!.consumed_at === null || !["completed", "failed", "cancelled"].includes(claims[0]!.status ?? "") || claims[0]!.release_admission_hash !== slot.admissionHash)) refuseV1();
    }
    startMutationV1(sql);
    const record: RecordV1 = { ...held.record, reservation: { ...held.record.reservation, revision: held.record.reservation.revision + 1, phase: "released" } };
    publishRecordV1(record, held.pin);
    if (held.custody.intent.locator.endsWith(`${reservation.jobId}.json`)) {
      publishExclusiveV1(held.custody.intent.locator.replace(/\.json$/, ".released"), bytesV1(record), selectionV1().selected.directory);
    }
  });
}

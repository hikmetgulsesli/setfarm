import assert from "node:assert/strict";
import fs from "node:fs";
import { Socket } from "node:net";
import { registerHooks, type LoadHookSync } from "node:module";
import { types } from "node:util";
import { holdTask6aRootOwnedJsonFileV1 } from "../../src/internal-production/task6a-root-owned-json-file-v1.js";
import { holdTask6aSocketPhysicalEvidenceV1 } from "../../src/internal-production/task6a-socket-physical-evidence-v1.js";
import { parseTask6aPostgresSocketTransportV1 } from "../../src/internal-production/task6a-postgres-socket-transport-v1.js";
import { createTask6aNativeBaselineObserverV1, type Task6aBaselineRoleV1 } from "./task6a-native-baseline-observer-v1.js";

type Pin = { serial: number; fd: number; identity: fs.BigIntStats; closes: number };
type Context = { file: string; serverUid: number; clientGid: number; socketPath: string; pins: Pin[];
  acquiring: boolean; nativeCloses: number; events: string[];
  baseline?: ReturnType<typeof createTask6aNativeBaselineObserverV1> };
let context: Context | undefined;
// Pure ledger initialization only. Missing context still retains originals and
// records failure; it cannot mint fixture readiness or silently drop custody.
const orphanBaseline = createTask6aNativeBaselineObserverV1({
  contextIsCurrent: () => false, checkpoint() {}, event() {},
});
export function observeTask6aNativeBaselineOriginalV1(role: Task6aBaselineRoleV1,
  original: Promise<void>, transaction: unknown, owner?: string) {
  const observer = context?.baseline ?? orphanBaseline;
  observer.observe(role, original, transaction, owner);
}

// Pure callback construction. Only runTask6aNativeClosedProbeV1 installs this
// in Node; callback-unit ports do not authenticate native timing or PG facts.
export function createTask6aNativeCanonicalLoadObserverV1(canonicalURL: string,
  checkpoint: () => void, event: (name: string) => void) {
  let requested = 0, returned = 0;
  const failures: { stage: string; error: unknown }[] = [];
  function diagnostic(stage: string, action: () => void) {
    try { action(); } catch (error) { failures.push({ stage, error }); }
  }
  const load: LoadHookSync = (url, loadContext, nextLoad) => {
    if (url !== canonicalURL) return nextLoad(url, loadContext);
    requested++;
    diagnostic("canonical-request:count", () => { assert.equal(requested, 1); });
    diagnostic("canonical-request:checkpoint", checkpoint);
    diagnostic("canonical-request:event", () => event("canonical-load-request"));
    // NEVER refuse or substitute the genuine delegate's source/result/error.
    const originalResult = nextLoad(url, loadContext);
    returned++;
    diagnostic("canonical-return:event", () => event("canonical-next-load-returned"));
    return originalResult;
  };
  return Object.freeze({ load, snapshot: () => ({ requested, returned,
    failed: failures.length !== 0, failures: failures.map(failure => ({ ...failure })) }) });
}

// Test-only exact importer replacement. This is diagnostic data/physical custody,
// NEVER holdTask6aProtectedPostgresSocketV1's fixed production authentication.
export function holdTask6aProtectedPostgresSocketV1() {
  const ctx = context; assert.ok(ctx);
  ctx.acquiring = true;
  let file: ReturnType<typeof holdTask6aRootOwnedJsonFileV1> | undefined;
  let physical: ReturnType<typeof holdTask6aSocketPhysicalEvidenceV1> | undefined;
  try {
    file = holdTask6aRootOwnedJsonFileV1(ctx.file);
    const transport = parseTask6aPostgresSocketTransportV1(JSON.parse(file.read().toString()));
    assert.equal(`${transport.socketDirectory}/.s.PGSQL.${transport.port}`, ctx.socketPath);
    physical = holdTask6aSocketPhysicalEvidenceV1(transport, ctx.serverUid, ctx.clientGid);
    assert.ok(physical);
    const fixedFile = file, fixedPhysical = physical;
    const recheck = () => { fixedFile.recheck(); fixedPhysical.recheck(); fixedFile.recheck(); };
    return Object.freeze({ read: () => { recheck(); return { descriptor: { transport, schemaOwner: "setfarm_owner" } }; },
      recheck, close: () => {
        try { fixedPhysical.close(); } finally { fixedFile.close(); }
        ctx.events.push("holder-close");
      } });
  } catch (error) { physical?.close(); file?.close(); throw error; }
  finally { ctx.acquiring = false; }
}

export async function runTask6aNativeClosedProbeV1(file: string,
  identities: Readonly<{ serverUid: number; clientGid: number; socketPath: string }>,
  mode: "healthy" | "wrong-tuple" | "delayed-close" | "denied-access" | "denied-column" | "denied-membership" | "denied-owner" | "denied-base"
    | "phase-checksum" | "phase-journal32" | "phase-journal33" | "phase-table" | "phase-index" | "phase-function" | "phase-type" | "phase-trigger"
    | "held-healthy" | "held-delayed-close" | "held-idle-expiry",
  coldGraph?: Readonly<{ canonicalURL: string }>) {
  assert.equal(context, undefined);
  assert.ok(["healthy", "wrong-tuple", "delayed-close", "denied-access", "denied-column", "denied-membership", "denied-owner", "denied-base",
    "phase-checksum", "phase-journal32", "phase-journal33", "phase-table", "phase-index", "phase-function", "phase-type", "phase-trigger",
    "held-healthy", "held-delayed-close", "held-idle-expiry"].includes(mode));
  const heldMode = mode.startsWith("held-"), idleExpiry = mode === "held-idle-expiry";
  const delayedClose = mode === "delayed-close" || mode === "held-delayed-close";
  const earlyRefusal = mode === "wrong-tuple" || mode.startsWith("denied-");
  const phaseRefusal = mode.startsWith("phase-");
  const denied = earlyRefusal || phaseRefusal;
  if (phaseRefusal) assert.ok(coldGraph, "phase canaries require the freshly sealed cold graph");
  if (coldGraph) {
    const nominated = new URL(coldGraph.canonicalURL);
    assert.equal(nominated.protocol, "file:"); assert.equal(nominated.host, "");
    assert.equal(nominated.href, coldGraph.canonicalURL);
    assert.equal(nominated.search, ""); assert.equal(nominated.hash, ""); assert.ok(nominated.pathname.endsWith(".js"));
  }
  const ctx: Context = { file, ...identities, pins: [], acquiring: false, nativeCloses: 0, events: [] };
  context = ctx;
  const actualOpen = fs.openSync, actualClose = fs.closeSync, actualConnect = Socket.prototype.connect;
  let connected = 0, socket: Socket | undefined;
  let nativeCloseOriginal: Promise<void> | undefined;
  let loadHook: ReturnType<typeof registerHooks> | undefined;
  let canonicalObservation: ReturnType<typeof createTask6aNativeCanonicalLoadObserverV1> | undefined;
  let releaseDestroy: (() => void) | undefined;
  let resolveDestruction!: () => void;
  const destructionRequested = new Promise<void>(resolve => { resolveDestruction = resolve; });
  let withholding = true;
  let observerFailure: unknown, observerFailed = false, settled = false;
  const rows: string[][] = [];
  const commands: string[] = [], transactionStates: string[] = [];
  const catalogRows: { names: string[]; values: (string | null)[] }[] = [];
  const canonicalJournalRows: string[][] = [], coldCatalogRows: string[][] = [];
  const errorCodes: string[] = [];
  type ApiRole = "hold" | "recheck" | "close";
  type ApiRecord = { state: "unused" | "started" | "fulfilled" | "rejected" | "threw";
    original?: Promise<unknown>; error?: unknown };
  const apiOriginals: Record<ApiRole, ApiRecord> = {
    hold: { state: "unused" }, recheck: { state: "unused" }, close: { state: "unused" },
  };
  function apiOriginal<T>(role: ApiRole, invoke: () => Promise<T>): Promise<T> {
    const record = apiOriginals[role]; assert.equal(record.state, "unused");
    record.state = "started"; ctx.events.push(`api-${role}-started`);
    try {
      const original = invoke(); record.original = original;
      assert.equal(types.isPromise(original), true);
      void original.then(() => { record.state = "fulfilled"; ctx.events.push(`api-${role}-fulfilled`); }, error => {
        record.state = "rejected"; record.error = error; ctx.events.push(`api-${role}-rejected`);
      });
      return original;
    } catch (error) { record.state = "threw"; record.error = error; throw error; }
  }
  const timerOriginals: Promise<void>[] = [];
  const timerHandles: ReturnType<typeof setTimeout>[] = [];
  function waitOwned(ms: 25 | 6500): Promise<void> {
    const original = new Promise<void>(resolve => { timerHandles.push(setTimeout(resolve, ms)); });
    timerOriginals.push(original); return original;
  }
  const journalNames = ["version", "name", "checksum", "state"];
  const coldNames = ["laterJournalCount", "relationCount", "functionCount", "typeCount", "triggerCount"];
  let journalDescriptions = 0, coldDescriptions = 0;
  const lifetimeNames = ["pid", "backendStart", "session", "role", "database", "socket"];
  let names: string[] = [];
  let refusedBaseDefault: string | null = null;
  let wire = Buffer.alloc(0);
  function releaseDestruction() {
    const original = releaseDestroy; releaseDestroy = undefined;
    original?.(); // Burn before delegation; never retry an uncertain original.
  }
  function livePins() {
    assert.equal(ctx.pins.length, 5);
    for (const pin of ctx.pins) {
      assert.equal(pin.closes, 0);
      const stat = fs.fstatSync(pin.fd, { bigint: true });
      assert.equal(stat.dev, pin.identity.dev); assert.equal(stat.ino, pin.identity.ino);
    }
  }
  ctx.baseline = createTask6aNativeBaselineObserverV1({
    contextIsCurrent: () => context === ctx,
    checkpoint() {
      assert.equal(commands.filter(tag => tag === "BEGIN").length, 1);
      assert.equal(commands.filter(tag => tag === "ROLLBACK").length, 0);
      assert.equal(transactionStates.at(-1), "T");
      assert.equal(ctx.nativeCloses, 0); livePins();
    },
    event: name => { ctx.events.push(name); },
  });
  fs.openSync = function (...args: Parameters<typeof actualOpen>) {
    const fd = Reflect.apply(actualOpen, fs, args) as number;
    if (ctx.acquiring) ctx.pins.push({ serial: ctx.pins.length, fd, identity: fs.fstatSync(fd, { bigint: true }), closes: 0 });
    return fd;
  };
  fs.closeSync = function (fd: number) {
    const pin = ctx.pins.find(pin => pin.fd === fd && pin.closes === 0);
    if (pin) {
      if (ctx.nativeCloses !== 1) { observerFailed = true; observerFailure = Error("FD custody ended before native socket close"); }
      pin.closes++; ctx.events.push(`fd-close:${pin.serial}`);
    }
    return Reflect.apply(actualClose, fs, [fd]);
  };
  Socket.prototype.connect = function (this: Socket, ...args: Parameters<typeof actualConnect>) {
    // No fake socket/query/results. Observe the real PG socket only.
    if (typeof args[0] === "string" && args[0].includes("/.s.PGSQL.")) {
      assert.equal(args[0], ctx.socketPath, "only the independently nominated fixture socket is allowed");
      connected++; socket = this;
      nativeCloseOriginal = new Promise(resolve => { this.once("close", resolve); });
      this.once("close", () => {
        try { livePins(); ctx.nativeCloses++; ctx.events.push("native-close"); }
        catch (error) { observerFailed = true; observerFailure = error; }
      });
      this.on("data", (bytes: Buffer) => {
        try {
          wire = Buffer.concat([wire, bytes]); assert.ok(wire.length < 65536);
          while (wire.length >= 5) {
            const size = wire.readInt32BE(1); assert.ok(size >= 4 && size < 65536);
            if (wire.length < size + 1) break;
            const frame = wire.subarray(5, size + 1);
            if (wire[0] === 84) { // Genuine RowDescription, not column-count guessing.
              const count = frame.readUInt16BE(0); let offset = 2; names = [];
              assert.ok(count < 64);
              for (let i = 0; i < count; i++) {
                const end = frame.indexOf(0, offset); assert.ok(end >= offset);
                names.push(frame.subarray(offset, end).toString()); offset = end + 19;
                assert.ok(offset <= frame.length);
              }
              assert.equal(offset, frame.length);
              if (names.length === journalNames.length && names.every((name, i) => name === journalNames[i])
                || names.length === coldNames.length && names.every((name, i) => name === coldNames[i])) {
                assert.equal(context, ctx); assert.equal(ctx.nativeCloses, 0); livePins();
                assert.equal(commands.filter(tag => tag === "BEGIN").length, 1);
                assert.equal(commands.filter(tag => tag === "ROLLBACK").length, 0);
                assert.equal(transactionStates.at(-1), "T");
                assert.ok(canonicalObservation);
                assert.deepEqual(canonicalObservation.snapshot(), { requested: 1, returned: 1, failed: false, failures: [] });
                assert.equal(ctx.baseline!.snapshot().failed, false);
                assert.deepEqual(ctx.baseline!.snapshot().records,
                  ["ACCESS", "BASE", "OWNER"].map(role => ({ role, state: "fulfilled" })));
                if (names.length === journalNames.length) {
                  assert.equal(++journalDescriptions, 1); ctx.events.push("canonical-journal-query");
                } else {
                  assert.equal(++coldDescriptions, 1); assert.equal(canonicalJournalRows.length, 31);
                  ctx.events.push("cold-catalog-query");
                }
              }
            } else if (wire[0] === 68) {
              const count = frame.readUInt16BE(0); assert.equal(count, names.length);
              let offset = 2; const values: (string | null)[] = [];
              for (let i = 0; i < count; i++) {
                const length = frame.readInt32BE(offset); offset += 4; assert.ok(length >= -1);
                if (length === -1) values.push(null);
                else { assert.ok(offset + length <= frame.length);
                  values.push(frame.subarray(offset, offset + length).toString()); offset += length; }
              }
              assert.equal(offset, frame.length);
              if (names.length === 6 && names.every((name, index) => name === lifetimeNames[index])) {
                assert.ok(values.every(value => value !== null)); rows.push(values as string[]);
              } else if (names.length === journalNames.length && names.every((name, i) => name === journalNames[i])) {
                assert.ok(values.every(value => typeof value === "string")); assert.ok(canonicalJournalRows.length < 31);
                assert.equal(values[0], String(canonicalJournalRows.length + 1));
                assert.match(values[2]!, /^[a-f0-9]{64}$/); assert.ok(["applied", "adopted"].includes(values[3]!));
                livePins(); assert.equal(ctx.nativeCloses, 0);
                canonicalJournalRows.push(values as string[]);
              } else if (names.length === coldNames.length && names.every((name, i) => name === coldNames[i])) {
                assert.ok(values.every(value => typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value)));
                assert.equal(coldCatalogRows.length, 0); livePins(); assert.equal(ctx.nativeCloses, 0);
                coldCatalogRows.push(values as string[]);
              } else {
                assert.ok(catalogRows.length < 1024); catalogRows.push({ names: [...names], values });
              }
            } else if (wire[0] === 69) { // Actual ErrorResponse fields; retain SQLSTATE only.
              let offset = 0, fields = 0;
              while (offset < frame.length && frame[offset] !== 0) {
                assert.ok(++fields <= 32); const kind = frame[offset++]!;
                const end = frame.indexOf(0, offset); assert.ok(end >= offset);
                if (kind === 67) {
                  const code = frame.subarray(offset, end).toString(); assert.match(code, /^[0-9A-Z]{5}$/);
                  assert.ok(errorCodes.length < 8); errorCodes.push(code);
                }
                offset = end + 1;
              }
              assert.equal(offset, frame.length - 1); assert.equal(frame[offset], 0);
            } else if (wire[0] === 67) {
              assert.equal(frame.at(-1), 0); commands.push(frame.subarray(0, -1).toString());
            } else if (wire[0] === 90) {
              assert.equal(frame.length, 1); transactionStates.push(frame.toString()); names = [];
            }
            wire = wire.subarray(size + 1);
          }
        } catch (error) { observerFailed = true; observerFailure = error; }
      });
      if (delayedClose) {
        const originalDestroy = this._destroy;
        this._destroy = function (this: Socket, error: Error | null, callback: (error?: Error | null) => void) {
          if (!withholding) {
            this._destroy = originalDestroy;
            Reflect.apply(originalDestroy, this, [error, callback]); return;
          }
          assert.equal(releaseDestroy, undefined);
          releaseDestroy = () => { this._destroy = originalDestroy; Reflect.apply(originalDestroy, this, [error, callback]); };
          resolveDestruction();
        };
      }
    }
    return Reflect.apply(actualConnect, this, args) as Socket;
  } as typeof actualConnect;
  let result: Promise<void> | undefined;
  let probeImportOriginal: Promise<typeof import("../../src/internal-production/task6a-protected-postgres-backend-probe-v1.js")> | undefined;
  let probe: Awaited<NonNullable<typeof probeImportOriginal>> | undefined;
  let holding: Promise<import("../../src/internal-production/task6a-protected-postgres-backend-probe-v1.js").Task6aProtectedBackendOwnerV2> | undefined;
  let heldOwner: Awaited<NonNullable<typeof holding>> | undefined;
  let closeIdentity = false;
  try {
    if (coldGraph) {
      canonicalObservation = createTask6aNativeCanonicalLoadObserverV1(coldGraph.canonicalURL, () => {
        ctx.baseline!.canonicalRequested();
        const snapshot = ctx.baseline!.snapshot();
        if (snapshot.failed) throw snapshot.failures[0]!.error;
      }, name => { ctx.events.push(name); });
      loadHook = registerHooks({ load: canonicalObservation.load });
      ctx.events.push("native-load-hook-installed");
    }
    // Install every passive hook before importing the genuine probe. Retain
    // that original import independently; no deadline/retry releases its hooks.
    ctx.events.push("passive-hooks-installed");
    probeImportOriginal = import("../../src/internal-production/task6a-protected-postgres-backend-probe-v1.js");
    ctx.events.push("probe-import");
    probe = await probeImportOriginal;
    ctx.events.push("probe-import-settled");
    if (heldMode) {
      holding = apiOriginal("hold", () => probe!.holdTask6aProtectedPostgresBackendV2());
      heldOwner = await holding;
      assert.ok(heldOwner); assert.equal(commands.filter(tag => tag === "BEGIN").length, 1);
      assert.equal(commands.filter(tag => tag === "ROLLBACK").length, 0);
      assert.equal(ctx.nativeCloses, 0); livePins(); ctx.events.push("held-owner-returned");
      await waitOwned(idleExpiry ? 6500 : 25);
      livePins();
      if (idleExpiry) {
        assert.equal(ctx.nativeCloses, 1); assert.deepEqual(errorCodes, ["25P03"]);
        ctx.events.push("actual-idle-expiry-observed");
      } else {
        assert.equal(ctx.nativeCloses, 0); assert.equal(commands.filter(tag => tag === "ROLLBACK").length, 0);
        ctx.events.push("held-after-actual-await");
      }
      const checking = apiOriginal("recheck", () => probe!.recheckTask6aProtectedPostgresBackendV2(heldOwner!));
      if (idleExpiry) await assert.rejects(checking, /TASK6A_PROTECTED_POSTGRES_BACKEND_OWNER_REFUSED/);
      else assert.equal(await checking, undefined);
      result = apiOriginal("close", () => probe!.closeTask6aProtectedPostgresBackendV2(heldOwner!));
      closeIdentity = probe.closeTask6aProtectedPostgresBackendV2(heldOwner) === result;
      assert.equal(closeIdentity, true);
    } else result = probe.probeTask6aProtectedPostgresBackendV1();
    void result.then(() => { settled = true; }, () => { settled = true; });
    if (delayedClose) {
      await Promise.race([destructionRequested, result.then(() => {
        throw Error("probe settled before delayed destruction enrollment");
      }, error => { throw error; })]);
      await waitOwned(25);
      assert.equal(settled, false); assert.equal(ctx.nativeCloses, 0); livePins();
      ctx.events.push("pending-native-close"); assert.ok(releaseDestroy); releaseDestruction();
    }
    if (denied || idleExpiry) await assert.rejects(result, /TASK6A_PROTECTED_POSTGRES_BACKEND_PROBE_REFUSED/);
    else assert.equal(await result, undefined);
    ctx.events.push("probe-settled");
    const baselineSnapshot = ctx.baseline.snapshot(), orphanSnapshot = orphanBaseline.snapshot();
    if (baselineSnapshot.failed) throw baselineSnapshot.failures[0]!.error;
    if (orphanSnapshot.failed) throw orphanSnapshot.failures[0]!.error;
    if (canonicalObservation) {
      const snapshot = canonicalObservation.snapshot();
      if (snapshot.failed) throw snapshot.failures[0]!.error;
      assert.equal(snapshot.requested, earlyRefusal ? 0 : 1);
      assert.equal(snapshot.returned, snapshot.requested, "load delegation return is NOT evaluation completion");
      const prefix = mode === "wrong-tuple" ? 0 : ["denied-access", "denied-column", "denied-membership"].includes(mode)
        ? 1 : mode === "denied-base" ? 2 : 3;
      assert.equal(baselineSnapshot.records.length, prefix);
      assert.deepEqual(baselineSnapshot.records.map(record => record.role), ["ACCESS", "BASE", "OWNER"].slice(0, prefix));
      assert.deepEqual(baselineSnapshot.records.map(record => record.state),
        Array.from({ length: prefix }, (_, i) => earlyRefusal && i === prefix - 1 ? "rejected" : "fulfilled"));
      assert.equal(journalDescriptions, earlyRefusal ? 0 : 1);
      assert.equal(coldDescriptions, earlyRefusal || mode === "phase-checksum" ? 0 : 1);
      assert.equal(canonicalJournalRows.length, earlyRefusal ? 0 : 31);
      const phaseCounts: Record<string, string[]> = {
        "phase-journal32": ["1", "0", "0", "0", "0"], "phase-journal33": ["1", "0", "0", "0", "0"],
        "phase-table": ["0", "1", "0", "1", "0"], "phase-index": ["0", "1", "0", "0", "0"],
        "phase-function": ["0", "0", "1", "0", "0"], "phase-type": ["0", "0", "0", "1", "0"],
        "phase-trigger": ["0", "0", "0", "0", "1"],
      };
      assert.deepEqual(coldCatalogRows, earlyRefusal || mode === "phase-checksum" ? []
        : [phaseCounts[mode] ?? ["0", "0", "0", "0", "0"]]);
    }
    if (observerFailed) throw observerFailure;
    assert.equal(wire.length, 0, "complete native PG message framing required");
    assert.equal(connected, 1); assert.equal(ctx.nativeCloses, 1); assert.ok(socket?.destroyed);
    assert.equal(rows.length, denied || idleExpiry ? 1 : heldMode ? 3 : 2,
      "real own-backend DataRows required; setup failure cannot pass");
    const [pid, backendStart, session, role, database, local] = rows[0]!;
    assert.ok(Number.isSafeInteger(Number(pid)) && Number(pid) > 1); assert.ok(backendStart!.length > 0);
    assert.equal(session, mode === "wrong-tuple" ? "task6a_runtime" : "setfarm_runtime");
    assert.equal(role, session); assert.equal(database, mode === "wrong-tuple" ? "postgres" : "setfarm"); assert.equal(local, "t");
    if (!denied && !idleExpiry) for (const row of rows.slice(1)) assert.deepEqual(row, rows[0]);
    if (mode === "wrong-tuple") {
      assert.ok(!commands.includes("BEGIN")); assert.ok(!commands.includes("ROLLBACK"));
    } else {
      assert.equal(commands.filter(tag => tag === "BEGIN").length, 1);
      assert.equal(commands.filter(tag => tag === "ROLLBACK").length, idleExpiry ? 0 : 1);
      assert.ok(transactionStates.includes("T")); assert.equal(transactionStates.at(-1), idleExpiry ? "T" : "I");
      const access = catalogRows.find(row => row.names.includes("journalColumnWrite")); assert.ok(access);
      const field = (name: string) => access.values[access.names.indexOf(name)];
      assert.equal(field("journalWrite"), mode === "denied-access" || mode === "denied-membership" ? "t" : "f");
      assert.equal(field("journalColumnWrite"), ["denied-access", "denied-column", "denied-membership"].includes(mode) ? "t" : "f");
      assert.equal(field("otherRoleMembership"), mode === "denied-membership" ? "t" : "f");
      if (!earlyRefusal || mode === "denied-owner") {
        const owner = catalogRows.find(row => row.names.includes("ownerMatches")); assert.ok(owner);
        assert.equal(owner.values[owner.names.indexOf("ownerMatches")], mode === "denied-owner" ? "f" : "t");
      }
      if (mode === "denied-base") {
        const drift = catalogRows.find(row => row.names.includes("column")
          && row.values[row.names.indexOf("table")] === "runs"
          && row.values[row.names.indexOf("column")] === "status");
        assert.ok(drift); refusedBaseDefault = drift.values[drift.names.indexOf("default")]!;
        assert.equal(refusedBaseDefault, "'corrupt'::text");
      }
    }
    for (const pin of ctx.pins) { assert.equal(pin.closes, 1); assert.throws(() => fs.fstatSync(pin.fd), (e: NodeJS.ErrnoException) => e.code === "EBADF"); }
    console.log(JSON.stringify({ event: "native-closed-probe", authority: "diagnostic-only", mode,
      before: rows[0], after: denied || idleExpiry ? null : rows.at(-1), events: ctx.events,
      commands, transactionStates, refusedBaseDefault, catalogRows: catalogRows.length,
      baseline: coldGraph ? baselineSnapshot.records : null,
      canonicalLoad: canonicalObservation?.snapshot() ?? null,
      canonicalJournalRows, coldCatalogRows,
      fdCount: ctx.pins.length, nativeSockets: connected, heldMode, ownerIssued: heldOwner !== undefined,
      closeIdentity, errorCodes, apiOriginals: Object.fromEntries(Object.entries(apiOriginals)
        .map(([role, record]) => [role, record.state])), ownedTimers: timerHandles.length }));
  } finally {
    // Release the same genuine destruction original on any assertion failure.
    let cleanupFailed = false, cleanupError: unknown;
    try {
      withholding = false; // Monotonic: a later native destruction must pass through.
      try { releaseDestruction(); } catch (error) { cleanupFailed = true; cleanupError = error; }
      // A synchronous delegate fault must not skip either retained original.
      // Unknown pending originals stay pending; no retry or timer releases custody.
      try { if (probeImportOriginal) await probeImportOriginal.catch(() => {}); }
      catch (error) { cleanupFailed = true; cleanupError = error; }
      try { if (holding) heldOwner ??= await holding.catch(() => undefined); }
      catch (error) { cleanupFailed = true; cleanupError = error; }
      try {
        if (heldOwner && probe && !result)
          result = apiOriginal("close", () => probe!.closeTask6aProtectedPostgresBackendV2(heldOwner!));
      } catch (error) { cleanupFailed = true; cleanupError = error; }
      try { if (result) await result.catch(() => {}); }
      catch (error) { cleanupFailed = true; cleanupError = error; }
      try { if (nativeCloseOriginal) await nativeCloseOriginal; }
      catch (error) { cleanupFailed = true; cleanupError = error; }
      try { await ctx.baseline?.joinOriginals(); }
      catch (error) { cleanupFailed = true; cleanupError = error; }
      try { await orphanBaseline.joinOriginals(); }
      catch (error) { cleanupFailed = true; cleanupError = error; }
      try {
        await Promise.allSettled(Object.values(apiOriginals).flatMap(record => record.original ? [record.original] : []));
        await Promise.allSettled(timerOriginals);
      } catch (error) { cleanupFailed = true; cleanupError = error; }
    } finally {
      const originalHook = loadHook; loadHook = undefined;
      try { originalHook?.deregister(); }
      catch (error) { cleanupFailed = true; cleanupError = error; }
      fs.openSync = actualOpen; fs.closeSync = actualClose; Socket.prototype.connect = actualConnect;
      context = undefined;
    }
    if (cleanupFailed) throw cleanupError;
  }
}

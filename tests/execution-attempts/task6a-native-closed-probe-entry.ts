import assert from "node:assert/strict";
import fs from "node:fs";
import { Socket } from "node:net";
import { probeTask6aProtectedPostgresBackendV1 } from "../../src/internal-production/task6a-protected-postgres-backend-probe-v1.js";
import { holdTask6aRootOwnedJsonFileV1 } from "../../src/internal-production/task6a-root-owned-json-file-v1.js";
import { holdTask6aSocketPhysicalEvidenceV1 } from "../../src/internal-production/task6a-socket-physical-evidence-v1.js";
import { parseTask6aPostgresSocketTransportV1 } from "../../src/internal-production/task6a-postgres-socket-transport-v1.js";

type Pin = { serial: number; fd: number; identity: fs.BigIntStats; closes: number };
type Context = { file: string; serverUid: number; clientGid: number; socketPath: string; pins: Pin[];
  acquiring: boolean; nativeCloses: number; events: string[] };
let context: Context | undefined;

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
  mode: "healthy" | "wrong-tuple" | "delayed-close" | "denied-access" | "denied-column" | "denied-membership" | "denied-owner" | "denied-base") {
  assert.equal(context, undefined);
  assert.ok(["healthy", "wrong-tuple", "delayed-close", "denied-access", "denied-column", "denied-membership", "denied-owner", "denied-base"].includes(mode));
  const ctx: Context = { file, ...identities, pins: [], acquiring: false, nativeCloses: 0, events: [] };
  context = ctx;
  const actualOpen = fs.openSync, actualClose = fs.closeSync, actualConnect = Socket.prototype.connect;
  let connected = 0, socket: Socket | undefined;
  let nativeCloseOriginal: Promise<void> | undefined;
  let releaseDestroy: (() => void) | undefined;
  let resolveDestruction!: () => void;
  const destructionRequested = new Promise<void>(resolve => { resolveDestruction = resolve; });
  let observerFailure: unknown, observerFailed = false, settled = false;
  const rows: string[][] = [];
  const commands: string[] = [], transactionStates: string[] = [];
  const catalogRows: { names: string[]; values: (string | null)[] }[] = [];
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
              } else {
                assert.ok(catalogRows.length < 1024); catalogRows.push({ names: [...names], values });
              }
            } else if (wire[0] === 67) {
              assert.equal(frame.at(-1), 0); commands.push(frame.subarray(0, -1).toString());
            } else if (wire[0] === 90) {
              assert.equal(frame.length, 1); transactionStates.push(frame.toString()); names = [];
            }
            wire = wire.subarray(size + 1);
          }
        } catch (error) { observerFailed = true; observerFailure = error; }
      });
      if (mode === "delayed-close") {
        const originalDestroy = this._destroy;
        this._destroy = function (this: Socket, error: Error | null, callback: (error?: Error | null) => void) {
          assert.equal(releaseDestroy, undefined);
          releaseDestroy = () => { this._destroy = originalDestroy; Reflect.apply(originalDestroy, this, [error, callback]); };
          resolveDestruction();
        };
      }
    }
    return Reflect.apply(actualConnect, this, args) as Socket;
  } as typeof actualConnect;
  let result: Promise<void> | undefined;
  try {
    result = probeTask6aProtectedPostgresBackendV1();
    void result.then(() => { settled = true; }, () => { settled = true; });
    if (mode === "delayed-close") {
      await Promise.race([destructionRequested, result.then(() => {
        throw Error("probe settled before delayed destruction enrollment");
      }, error => { throw error; })]);
      await new Promise(resolve => setTimeout(resolve, 25));
      assert.equal(settled, false); assert.equal(ctx.nativeCloses, 0); livePins();
      ctx.events.push("pending-native-close"); assert.ok(releaseDestroy); releaseDestruction();
    }
    const denied = mode === "wrong-tuple" || mode.startsWith("denied-");
    if (denied) await assert.rejects(result, /TASK6A_PROTECTED_POSTGRES_BACKEND_PROBE_REFUSED/);
    else assert.equal(await result, undefined);
    ctx.events.push("probe-settled");
    if (observerFailed) throw observerFailure;
    assert.equal(wire.length, 0, "complete native PG message framing required");
    assert.equal(connected, 1); assert.equal(ctx.nativeCloses, 1); assert.ok(socket?.destroyed);
    assert.equal(rows.length, denied ? 1 : 2, "real own-backend DataRows required; setup failure cannot pass");
    const [pid, backendStart, session, role, database, local] = rows[0]!;
    assert.ok(Number.isSafeInteger(Number(pid)) && Number(pid) > 1); assert.ok(backendStart!.length > 0);
    assert.equal(session, mode === "wrong-tuple" ? "task6a_runtime" : "setfarm_runtime");
    assert.equal(role, session); assert.equal(database, mode === "wrong-tuple" ? "postgres" : "setfarm"); assert.equal(local, "t");
    if (!denied) assert.deepEqual(rows[1], rows[0]);
    if (mode === "wrong-tuple") {
      assert.ok(!commands.includes("BEGIN")); assert.ok(!commands.includes("ROLLBACK"));
    } else {
      assert.equal(commands.filter(tag => tag === "BEGIN").length, 1);
      assert.equal(commands.filter(tag => tag === "ROLLBACK").length, 1);
      assert.ok(transactionStates.includes("T")); assert.equal(transactionStates.at(-1), "I");
      const access = catalogRows.find(row => row.names.includes("journalColumnWrite")); assert.ok(access);
      const field = (name: string) => access.values[access.names.indexOf(name)];
      assert.equal(field("journalWrite"), mode === "denied-access" || mode === "denied-membership" ? "t" : "f");
      assert.equal(field("journalColumnWrite"), ["denied-access", "denied-column", "denied-membership"].includes(mode) ? "t" : "f");
      assert.equal(field("otherRoleMembership"), mode === "denied-membership" ? "t" : "f");
      if (!denied || mode === "denied-owner") {
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
      before: rows[0], after: denied ? null : rows.at(-1), events: ctx.events,
      commands, transactionStates, refusedBaseDefault, catalogRows: catalogRows.length,
      fdCount: ctx.pins.length, nativeSockets: connected }));
  } finally {
    // Release the same genuine destruction original on any assertion failure.
    let cleanupFailed = false, cleanupError: unknown;
    try {
      try { releaseDestruction(); } catch (error) { cleanupFailed = true; cleanupError = error; }
      // A synchronous delegate fault must not skip either retained original.
      // Unknown pending originals stay pending; no retry or timer releases custody.
      try { if (result) await result.catch(() => {}); }
      catch (error) { cleanupFailed = true; cleanupError = error; }
      try { if (nativeCloseOriginal) await nativeCloseOriginal; }
      catch (error) { cleanupFailed = true; cleanupError = error; }
    } finally {
      fs.openSync = actualOpen; fs.closeSync = actualClose; Socket.prototype.connect = actualConnect;
      context = undefined;
    }
    if (cleanupFailed) throw cleanupError;
  }
}

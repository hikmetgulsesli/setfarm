import fs, { type BigIntStats } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { resolveInternalProductionBaselineWorkspaceRootV1 } from "./baseline-workspace-authority-path-v1.js";
import { encodeDeploymentCutoverMaintenanceIntentV1, encodeDeploymentCutoverOwnerClaimV1,
  parseDeploymentCutoverOwnerHistoryV1, parseDeploymentCutoverMaintenanceIntentV1, type DeploymentCutoverMaintenanceIntentV1,
  type DeploymentCutoverOwnerClaimV1 } from "./baseline-deployment-cutover-records-v1.js";

const DIRECTORY_KEYS = ["dev", "ino", "mode", "uid", "gid", "birthtimeNs"] as const;
const FILE_KEYS = [...DIRECTORY_KEYS, "size", "nlink", "mtimeNs", "ctimeNs"] as const;
const CONTENT_KEYS = [...DIRECTORY_KEYS, "size", "mtimeNs"] as const;
const MAX_BYTES = 65536;
const STAGE = /^\.(intent\.json|owner-[0-9]{4}\.json)\.([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.tmp$/;
let cleanupUncertain = false;
function fail(): never { throw Error("DEPLOYMENT_CUTOVER_OWNER_STORE_INVALID"); }
const same = (a: BigIntStats, b: BigIntStats, keys: readonly (keyof BigIntStats)[] = FILE_KEYS) => keys.every(key => a[key] === b[key]);
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const identity = (stat: BigIntStats, keys: readonly (keyof BigIntStats)[]) => Object.fromEntries(keys.map(key => [key, String(stat[key])]));
function fixed(name: string): boolean {
  const match = /^owner-([0-9]{4})\.json$/.exec(name);
  return name === "intent.json" || !!match && Number(match[1]) >= 1 && Number(match[1]) <= 4096;
}
type File = { bytes: Buffer; stat: BigIntStats };
type Observation = Readonly<{ maintenance: DeploymentCutoverMaintenanceIntentV1 | null; claims: readonly DeploymentCutoverOwnerClaimV1[];
  rootIdentityHash: string | null; ancestorIdentityHash: string; pendingStageCount: number; files: readonly Readonly<{ name: string; identityHash: string; bytesHash: string;
    byteLength: number; kind: "committed" | "inert-stage" | "committed-alias" }>[];
  ownerHistoryObservationHash: string; committedHistoryHash: string }>;
function observation(maintenance: DeploymentCutoverMaintenanceIntentV1 | null, claims: readonly DeploymentCutoverOwnerClaimV1[], rootIdentityHash: string | null,
  pendingStageCount: number, files: Map<string, File>, ancestorIdentityHash: string): Observation {
  const body = { schema: "setfarm.internal-production-deployment-cutover-owner-store-observation.v1", maintenance, claims: Object.freeze([...claims]),
    rootIdentityHash, ancestorIdentityHash, pendingStageCount, files: Object.freeze([...files].map(([name, file]) => Object.freeze({ name,
      identityHash: hashCanonicalJson(identity(file.stat, FILE_KEYS)), bytesHash: digest(file.bytes), byteLength: file.bytes.length,
      kind: fixed(name) ? "committed" as const : file.stat.nlink === 1n ? "inert-stage" as const : "committed-alias" as const }))) };
  const committedHistoryHash = hashCanonicalJson({ schema: "setfarm.internal-production-deployment-cutover-committed-history.v1",
    rootIdentityHash, ancestorIdentityHash, maintenance, claims: body.claims, files: body.files.filter(file => file.kind === "committed") });
  return Object.freeze({ ...body, committedHistoryHash, ownerHistoryObservationHash: hashCanonicalJson(body) });
}
function consume<T>(fd: number, body: () => T): T {
  let result: T | undefined, invalid = false;
  try { result = body(); } catch { invalid = true; }
  // The owned slot is consumed here; no caller retries this close.
  try { fs.closeSync(fd); } catch { cleanupUncertain = true; invalid = true; }
  if (invalid) fail(); return result as T;
}
type Store = { snapshot: () => { value: Observation; files: Map<string, File> }; publish: (name: string, bytes: Buffer) => void };
function withStore(create: boolean, body: (store: Store | null, ancestorIdentityHash: string) => Observation, expectedHistoryHash?: string): Observation {
  if (cleanupUncertain) fail();
  const pins: { target: string; fd: number; stat: BigIntStats }[] = [];
  let invalid = false, result: Observation | undefined;
  try {
    const checkPins = () => {
      for (const pin of pins) {
        const current = fs.lstatSync(pin.target, { bigint: true });
        if (!current.isDirectory() || current.isSymbolicLink() || !same(pin.stat, current, DIRECTORY_KEYS)
          || !same(pin.stat, fs.fstatSync(pin.fd, { bigint: true }), DIRECTORY_KEYS)) fail();
      }
    };
    const hold = (target: string) => {
      checkPins(); const stat = fs.lstatSync(target, { bigint: true });
      if (!stat.isDirectory() || stat.isSymbolicLink()) fail();
      const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      pins.push({ target, fd, stat }); checkPins(); return stat;
    };
    const lexical = resolveInternalProductionBaselineWorkspaceRootV1();
    const workspace = process.platform === "darwin" && lexical.startsWith("/var/") ? `/private${lexical}` : lexical;
    const filesystemRoot = path.parse(workspace).root, segments = path.relative(filesystemRoot, workspace).split(path.sep);
    if (segments.length > 128) fail(); hold(filesystemRoot);
    for (let index = 0; index < segments.length; index++) hold(path.join(filesystemRoot, ...segments.slice(0, index + 1)));
    const uid = process.getuid?.(), workspaceStat = pins.at(-1)!.stat;
    if (uid === undefined || workspaceStat.uid !== BigInt(uid) || (workspaceStat.mode & 0o022n) !== 0n) fail();
    const device = workspaceStat.dev, baseline = path.join(workspace, "data", "internal-production-baseline");
    for (const target of [path.join(workspace, "data"), baseline]) {
      const stat = hold(target);
      if (stat.uid !== BigInt(uid) || stat.dev !== device || (stat.mode & 0o022n) !== 0n) fail();
    }
    const baselineFd = pins.at(-1)!.fd, root = path.join(baseline, "deployment-cutover-owner-v1");
    const ancestorIdentityHash = hashCanonicalJson(pins.map(pin => ({ path: pin.target, identity: identity(pin.stat, DIRECTORY_KEYS) })));
    let missing = false;
    try { fs.lstatSync(root); } catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") missing = true; else throw error; }
    if (missing && !create) {
      checkPins(); try { fs.lstatSync(root); fail(); } catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
      result = body(null, ancestorIdentityHash);
    } else {
      let created = false;
      if (create && missing) {
        if (expectedHistoryHash !== undefined && observation(null, [], null, 0, new Map(), ancestorIdentityHash).committedHistoryHash !== expectedHistoryHash) fail();
        try { fs.mkdirSync(root, { mode: 0o700 }); created = true; }
        catch (error) { if (expectedHistoryHash !== undefined || !(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error; }
      }
      const rootStat = hold(root), rootFd = pins.at(-1)!.fd;
      if (rootStat.uid !== BigInt(uid) || rootStat.dev !== device || (rootStat.mode & 0o7777n) !== 0o700n) fail();
      if (create) { fs.fsyncSync(baselineFd); checkPins(); }
      const rootIdentityHash = hashCanonicalJson(identity(rootStat, DIRECTORY_KEYS));
      const read = (name: string): File => {
        checkPins(); const target = path.join(root, name);
        return readHeld(target);
      };
      // readHeld uses its own scoped descriptor so no descriptor number escapes.
      const readHeld = (target: string): File => {
        const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
        return consume(fd, () => {
          const stat = fs.fstatSync(fd, { bigint: true });
          if (!stat.isFile() || stat.uid !== BigInt(uid) || stat.dev !== device || (stat.mode & 0o7777n) !== 0o600n
            || ![1n, 2n].includes(stat.nlink) || stat.size < 0n || stat.size > BigInt(MAX_BYTES)) fail();
          const buffer = Buffer.alloc(MAX_BYTES + 1), length = fs.readSync(fd, buffer, 0, buffer.length, 0);
          if (BigInt(length) !== stat.size || !same(stat, fs.fstatSync(fd, { bigint: true })) || !same(stat, fs.lstatSync(target, { bigint: true }))) fail();
          checkPins(); return { bytes: buffer.subarray(0, length), stat };
        });
      };
      const committedPins = new Map<string, File>();
      const snapshot = () => {
        checkPins(); const names = fs.readdirSync(root).sort(); if (names.length > 8202) fail();
        const files = new Map<string, File>(), stages: { name: string; target: string; file: File }[] = [];
        for (const name of names) {
          const stage = STAGE.exec(name);
          if (!fixed(name) && (!stage || !fixed(stage[1]!))) fail();
          const file = read(name); files.set(name, file);
          if (stage) stages.push({ name, target: stage[1]!, file });
        }
        let pendingStageCount = 0;
        for (const stage of stages) {
          if (stage.file.stat.nlink === 1n) { pendingStageCount++; continue; }
          const destination = files.get(stage.target);
          if (!destination || !same(destination.stat, stage.file.stat) || !destination.bytes.equals(stage.file.bytes)) fail();
        }
        const committed = names.filter(fixed);
        for (const name of committed) {
          const file = files.get(name)!;
          const aliases = stages.filter(stage => stage.file.stat.dev === file.stat.dev && stage.file.stat.ino === file.stat.ino);
          if (file.stat.nlink === 2n ? aliases.length !== 1 || aliases[0]!.target !== name : aliases.length !== 0) fail();
        }
        const owners = committed.filter(name => name !== "intent.json");
        if (owners.some((name, index) => name !== `owner-${String(index + 1).padStart(4, "0")}.json`)) fail();
        const intent = files.get("intent.json"); if (!intent && owners.length) fail();
        const history = intent ? parseDeploymentCutoverOwnerHistoryV1(intent.bytes, owners.map(name => files.get(name)!.bytes)) : { maintenance: null, claims: [] };
        if (JSON.stringify(names) !== JSON.stringify(fs.readdirSync(root).sort())) fail();
        for (const [name, file] of files) if (!same(file.stat, fs.lstatSync(path.join(root, name), { bigint: true }))) fail();
        for (const [name, retained] of committedPins) {
          const current = files.get(name);
          if (!current || !same(retained.stat, current.stat) || !retained.bytes.equals(current.bytes)) fail();
        }
        for (const name of committed) committedPins.set(name, files.get(name)!);
        checkPins(); return { files, value: observation(history.maintenance, history.claims, rootIdentityHash, pendingStageCount, files, ancestorIdentityHash) };
      };
      if (expectedHistoryHash !== undefined && !created && snapshot().value.committedHistoryHash !== expectedHistoryHash) fail();
      const publish = (name: string, bytes: Buffer) => {
        if (!fixed(name)) fail();
        const before = snapshot(), existing = before.files.get(name), target = path.join(root, name);
        const validateCandidate = (current: ReturnType<typeof snapshot>) => {
          if (name === "intent.json") {
            if (current.value.maintenance && !encodeDeploymentCutoverMaintenanceIntentV1(current.value.maintenance).equals(bytes)) fail();
          } else {
            const ordinal = Number(name.slice(6, 10));
            if (!current.value.maintenance || current.value.claims.length < ordinal - 1) fail();
            parseDeploymentCutoverOwnerHistoryV1(encodeDeploymentCutoverMaintenanceIntentV1(current.value.maintenance),
              [...current.value.claims.slice(0, ordinal - 1).map(encodeDeploymentCutoverOwnerClaimV1), bytes]);
          }
        };
        validateCandidate(before);
        if (existing) {
          if (!existing.bytes.equals(bytes)) fail();
          const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
          consume(fd, () => {
            const check = () => { checkPins(); if (!same(existing.stat, fs.fstatSync(fd, { bigint: true })) || !same(existing.stat, fs.lstatSync(target, { bigint: true }))) fail(); };
            check(); fs.fsyncSync(fd); check(); fs.fsyncSync(rootFd); check(); fs.fsyncSync(baselineFd); check();
          });
          return;
        }
        if (before.value.pendingStageCount >= 8) fail();
        const stage = path.join(root, `.${name}.${randomUUID()}.tmp`);
        const fd = fs.openSync(stage, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR | fs.constants.O_NOFOLLOW, 0o600);
        consume(fd, () => {
          const initial = fs.fstatSync(fd, { bigint: true });
          if (!initial.isFile() || initial.uid !== BigInt(uid) || initial.dev !== device || initial.nlink !== 1n || initial.size !== 0n
            || (initial.mode & 0o7777n) !== 0o600n || !same(initial, fs.lstatSync(stage, { bigint: true }))) fail();
          checkPins(); fs.writeFileSync(fd, bytes); fs.fsyncSync(fd);
          const prepared = fs.fstatSync(fd, { bigint: true });
          if (!same(initial, prepared, DIRECTORY_KEYS) || prepared.nlink !== 1n || prepared.size !== BigInt(bytes.length)) fail();
          const verify = (expected: BigIntStats, paths: string[]) => {
            checkPins(); const buffer = Buffer.alloc(MAX_BYTES + 1), length = fs.readSync(fd, buffer, 0, buffer.length, 0);
            if (!buffer.subarray(0, length).equals(bytes) || !same(expected, fs.fstatSync(fd, { bigint: true }))
              || paths.some(file => !same(expected, fs.lstatSync(file, { bigint: true })))) fail();
            checkPins();
          };
          verify(prepared, [stage]); validateCandidate(snapshot()); verify(prepared, [stage]); fs.linkSync(stage, target);
          const linked = fs.fstatSync(fd, { bigint: true });
          if (linked.nlink !== 2n || !same(prepared, linked, CONTENT_KEYS)) fail();
          verify(linked, [stage, target]); fs.fsyncSync(rootFd); verify(linked, [stage, target]);
        });
        const after = snapshot(); if (!after.files.get(name)?.bytes.equals(bytes)) fail();
      };
      result = body({ snapshot, publish }, ancestorIdentityHash); checkPins();
    }
  } catch { invalid = true; }
  while (pins.length) { const pin = pins.pop()!; try { fs.closeSync(pin.fd); } catch { cleanupUncertain = true; invalid = true; } }
  if (invalid || !result) fail(); return result;
}

// Storage/history only. Neither a read nor a publication grants live ownership.
export function observeDeploymentCutoverOwnerHistoryV1(): Observation {
  return withStore(false, (store, ancestorIdentityHash) => store ? store.snapshot().value : observation(null, [], null, 0, new Map(), ancestorIdentityHash));
}
export function publishDeploymentCutoverOwnerClaimV1(maintenance: unknown, claim: unknown, expectedHistoryHash?: string): Observation {
  if (expectedHistoryHash !== undefined && (typeof expectedHistoryHash !== "string" || !/^[a-f0-9]{64}$/.test(expectedHistoryHash))) fail();
  const intentBytes = encodeDeploymentCutoverMaintenanceIntentV1(maintenance), claimBytes = encodeDeploymentCutoverOwnerClaimV1(claim);
  const parsed = JSON.parse(claimBytes.toString("utf8")) as DeploymentCutoverOwnerClaimV1;
  if (parsed.maintenanceIntentHash !== parseDeploymentCutoverMaintenanceIntentV1(intentBytes).maintenanceIntentHash) fail();
  return withStore(true, store => {
    if (!store) fail();
    const before = store.snapshot(), count = before.value.claims.length;
    const prior = before.value.claims.slice(0, parsed.ordinal - 1).map(encodeDeploymentCutoverOwnerClaimV1);
    if (parsed.ordinal > count + 1) fail();
    parseDeploymentCutoverOwnerHistoryV1(intentBytes, [...prior, claimBytes]);
    store.publish("intent.json", intentBytes);
    store.publish(`owner-${String(parsed.ordinal).padStart(4, "0")}.json`, claimBytes);
    const after = store.snapshot().value;
    if (after.claims[parsed.ordinal - 1]?.ownerClaimHash !== parsed.ownerClaimHash) fail();
    return after;
  }, expectedHistoryHash);
}

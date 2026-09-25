import fs, { type BigIntStats } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { resolveInternalProductionBaselineWorkspaceRootV1 } from "./baseline-workspace-authority-path-v1.js";
import { encodeDeploymentCutoverServiceEffectIntentV1, encodeDeploymentCutoverServiceEffectCompletionV1,
  parseDeploymentCutoverServiceEffectHistoryV1 } from "./baseline-deployment-cutover-service-effect-records-v1.js";

// Storage and historical ordering only. No service, process, owner or dispatch authority.
const FILE_ORDER = ["intent-0001.json", "completion-0001.json", "intent-0002.json", "completion-0002.json"] as const;
const STAGE = /^\.(intent-000[12]\.json|completion-000[12]\.json)\.([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.tmp$/;
const DIRECTORY_KEYS = ["dev", "ino", "mode", "uid", "gid", "birthtimeNs"] as const;
const FILE_KEYS = [...DIRECTORY_KEYS, "size", "nlink", "mtimeNs", "ctimeNs"] as const;
const CONTENT_KEYS = [...DIRECTORY_KEYS, "size", "mtimeNs"] as const;
const MAX_BYTES = 65536;
let cleanupUncertain = false;
const fail = (): never => { throw Error("DEPLOYMENT_CUTOVER_SERVICE_EFFECT_STORE_INVALID"); };
function durableSync(fd: number): void {
  try { fs.fsyncSync(fd); } catch { cleanupUncertain = true; fail(); }
}
const same = (left: BigIntStats, right: BigIntStats, keys: readonly (keyof BigIntStats)[] = FILE_KEYS) =>
  keys.every(key => left[key] === right[key]);
const identity = (stat: BigIntStats, keys: readonly (keyof BigIntStats)[]) =>
  Object.fromEntries(keys.map(key => [key, String(stat[key])]));
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const fixed = (name: string) => FILE_ORDER.includes(name as typeof FILE_ORDER[number]);
type File = Readonly<{ bytes: Buffer; stat: BigIntStats }>;
type History = ReturnType<typeof parseDeploymentCutoverServiceEffectHistoryV1>;
type Observation = Readonly<{ schema: "setfarm.internal-production-deployment-cutover-service-effect-store.v1";
  authority: "history-only"; storageState: "settled" | "needs-reconciliation";
  rootIdentityHash: string | null; ancestorIdentityHash: string; pendingStageCount: number;
  files: readonly Readonly<{ name: string; identityHash: string; bytesHash: string; byteLength: number;
    kind: "committed" | "inert-stage" | "committed-alias" }>[];
  history: History; storeObservationHash: string }>;

function historyOf(files: Map<string, File>): History {
  const committed = FILE_ORDER.filter(name => files.has(name));
  if (committed.some((name, index) => name !== FILE_ORDER[index])) fail();
  const intents = ["intent-0001.json", "intent-0002.json"].filter(name => files.has(name)).map(name => files.get(name)!.bytes);
  const completions = ["completion-0001.json", "completion-0002.json"].filter(name => files.has(name)).map(name => files.get(name)!.bytes);
  return parseDeploymentCutoverServiceEffectHistoryV1(intents, completions);
}
function observation(files: Map<string, File>, rootIdentityHash: string | null, ancestorIdentityHash: string): Observation {
  const history = historyOf(files);
  const entries = Object.freeze([...files].map(([name, file]) => Object.freeze({ name,
    identityHash: hashCanonicalJson(identity(file.stat, FILE_KEYS)), bytesHash: digest(file.bytes), byteLength: file.bytes.length,
    kind: fixed(name) ? "committed" as const : file.stat.nlink === 1n ? "inert-stage" as const : "committed-alias" as const })));
  const pendingStageCount = entries.filter(entry => entry.kind === "inert-stage").length;
  const body = { schema: "setfarm.internal-production-deployment-cutover-service-effect-store.v1" as const,
    authority: "history-only" as const, storageState: pendingStageCount ? "needs-reconciliation" as const : "settled" as const,
    rootIdentityHash, ancestorIdentityHash, pendingStageCount, files: entries, history };
  return Object.freeze({ ...body, storeObservationHash: hashCanonicalJson(body) });
}
function consume<T>(fd: number, body: () => T): T {
  let result: T | undefined, invalid = false;
  try { result = body(); } catch { invalid = true; }
  try { fs.closeSync(fd); } catch { cleanupUncertain = true; invalid = true; }
  if (invalid) fail();
  return result as T;
}
type Store = Readonly<{ snapshot: () => Readonly<{ value: Observation; files: Map<string, File> }>;
  publish: (name: string, bytes: Buffer, expectedObservationHash: string) => Observation }>;

function withStore(create: boolean, body: (store: Store | null, ancestorIdentityHash: string) => Observation,
  expectedObservationHash?: string): Observation {
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
    if (uid === undefined) fail();
    const ownerUid = BigInt(uid as number);
    if (workspaceStat.uid !== ownerUid || (workspaceStat.mode & 0o022n) !== 0n) fail();
    const device = workspaceStat.dev, baseline = path.join(workspace, "data", "internal-production-baseline");
    for (const target of [path.join(workspace, "data"), baseline]) {
      const stat = hold(target);
      if (stat.uid !== ownerUid || stat.dev !== device || (stat.mode & 0o022n) !== 0n) fail();
    }
    const baselineFd = pins.at(-1)!.fd, root = path.join(baseline, "deployment-cutover-service-effects-v1");
    const ancestorIdentityHash = hashCanonicalJson(pins.map(pin => ({ path: pin.target, identity: identity(pin.stat, DIRECTORY_KEYS) })));
    let missing = false;
    try { fs.lstatSync(root); } catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") missing = true; else throw error; }
    if (missing && !create) {
      checkPins(); try { fs.lstatSync(root); fail(); } catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
      result = body(null, ancestorIdentityHash);
    } else {
      const created = missing;
      if (missing) {
        if (observation(new Map(), null, ancestorIdentityHash).storeObservationHash !== expectedObservationHash) fail();
        fs.mkdirSync(root, { mode: 0o700 });
      }
      const rootStat = hold(root), rootFd = pins.at(-1)!.fd;
      if (rootStat.uid !== ownerUid || rootStat.dev !== device || (rootStat.mode & 0o7777n) !== 0o700n) fail();
      if (missing) { durableSync(baselineFd); checkPins(); }
      const rootIdentityHash = hashCanonicalJson(identity(rootStat, DIRECTORY_KEYS));
      const read = (name: string): File => {
        checkPins(); const target = path.join(root, name);
        const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
        return consume(fd, () => {
          const stat = fs.fstatSync(fd, { bigint: true });
          if (!stat.isFile() || stat.uid !== ownerUid || stat.dev !== device || (stat.mode & 0o7777n) !== 0o600n
            || ![1n, 2n].includes(stat.nlink) || stat.size < 0n || stat.size > BigInt(MAX_BYTES)) fail();
          const buffer = Buffer.alloc(MAX_BYTES + 1);
          let length = 0;
          while (length < buffer.length) {
            const size = fs.readSync(fd, buffer, length, buffer.length - length, length);
            if (size === 0) break;
            length += size;
          }
          if (BigInt(length) !== stat.size || !same(stat, fs.fstatSync(fd, { bigint: true }))
            || !same(stat, fs.lstatSync(target, { bigint: true }))) fail();
          checkPins(); return { bytes: buffer.subarray(0, length), stat };
        });
      };
      const committedPins = new Map<string, File>();
      const snapshot = () => {
        checkPins(); const names = fs.readdirSync(root).sort(); if (names.length > 32) fail();
        const files = new Map<string, File>(), stages: { name: string; target: string; file: File }[] = [];
        for (const name of names) {
          const stage = STAGE.exec(name);
          if (!fixed(name) && (!stage || !fixed(stage[1]!))) fail();
          const file = read(name); files.set(name, file);
          if (stage) stages.push({ name, target: stage[1]!, file });
        }
        for (const stage of stages) {
          if (stage.file.stat.nlink === 1n) continue;
          const destination = files.get(stage.target);
          if (!destination || !same(destination.stat, stage.file.stat) || !destination.bytes.equals(stage.file.bytes)) fail();
        }
        for (const name of FILE_ORDER) {
          const file = files.get(name); if (!file) continue;
          const aliases = stages.filter(stage => stage.file.stat.dev === file.stat.dev && stage.file.stat.ino === file.stat.ino);
          // This store never removes stages: a fixed-only file has no durable
          // evidence that it passed through the exclusive no-replace publisher.
          if (file.stat.nlink !== 2n || aliases.length !== 1 || aliases[0]!.target !== name) fail();
        }
        const value = observation(files, rootIdentityHash, ancestorIdentityHash);
        if (value.pendingStageCount > 8 || JSON.stringify(names) !== JSON.stringify(fs.readdirSync(root).sort())) fail();
        for (const [name, file] of files) if (!same(file.stat, fs.lstatSync(path.join(root, name), { bigint: true }))) fail();
        for (const [name, retained] of committedPins) {
          const current = files.get(name);
          if (!current || !same(retained.stat, current.stat) || !retained.bytes.equals(current.bytes)) fail();
        }
        for (const name of FILE_ORDER) if (files.has(name)) committedPins.set(name, files.get(name)!);
        checkPins(); return { value, files };
      };
      const publish = (name: string, bytes: Buffer, expected: string) => {
        if (!fixed(name) || !/^[a-f0-9]{64}$/.test(expected)) fail();
        const before = snapshot();
        if (before.value.storageState !== "settled"
          || (created ? before.files.size !== 0 : before.value.storeObservationHash !== expected)) fail();
        const target = path.join(root, name), existing = before.files.get(name);
        const validateCandidate = (current: Map<string, File>) => {
          const candidates = new Map(current);
          candidates.set(name, { bytes, stat: existing?.stat ?? rootStat });
          historyOf(candidates);
        };
        validateCandidate(before.files);
        if (existing) {
          if (!existing.bytes.equals(bytes)) fail();
          const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
          consume(fd, () => {
            const check = () => { checkPins(); if (!same(existing.stat, fs.fstatSync(fd, { bigint: true }))
              || !same(existing.stat, fs.lstatSync(target, { bigint: true }))) fail(); };
            check(); durableSync(fd); check(); durableSync(rootFd); check(); durableSync(baselineFd); check();
          });
          return snapshot().value;
        }
        const stage = path.join(root, `.${name}.${randomUUID()}.tmp`);
        const fd = fs.openSync(stage, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR | fs.constants.O_NOFOLLOW, 0o600);
        consume(fd, () => {
          const initial = fs.fstatSync(fd, { bigint: true });
          if (!initial.isFile() || initial.uid !== ownerUid || initial.dev !== device || initial.nlink !== 1n
            || initial.size !== 0n || (initial.mode & 0o7777n) !== 0o600n || !same(initial, fs.lstatSync(stage, { bigint: true }))) fail();
          checkPins(); fs.writeFileSync(fd, bytes); durableSync(fd);
          const prepared = fs.fstatSync(fd, { bigint: true });
          if (!same(initial, prepared, DIRECTORY_KEYS) || prepared.nlink !== 1n || prepared.size !== BigInt(bytes.length)) fail();
          const verify = (expectedStat: BigIntStats, paths: string[]) => {
            checkPins(); const buffer = Buffer.alloc(MAX_BYTES + 1);
            let length = 0;
            while (length < buffer.length) {
              const size = fs.readSync(fd, buffer, length, buffer.length - length, length);
              if (size === 0) break;
              length += size;
            }
            if (!buffer.subarray(0, length).equals(bytes) || !same(expectedStat, fs.fstatSync(fd, { bigint: true }))
              || paths.some(file => !same(expectedStat, fs.lstatSync(file, { bigint: true })))) fail();
            checkPins();
          };
          verify(prepared, [stage]);
          const during = snapshot();
          if (during.value.pendingStageCount !== 1 || !during.files.get(path.basename(stage))?.bytes.equals(bytes)) fail();
          validateCandidate(during.files); verify(prepared, [stage]); fs.linkSync(stage, target);
          const linked = fs.fstatSync(fd, { bigint: true });
          if (linked.nlink !== 2n || !same(prepared, linked, CONTENT_KEYS)) fail();
          verify(linked, [stage, target]); durableSync(rootFd); verify(linked, [stage, target]);
        });
        const after = snapshot();
        if (after.value.storageState !== "settled" || !after.files.get(name)?.bytes.equals(bytes)) fail();
        durableSync(baselineFd); checkPins(); return snapshot().value;
      };
      if (expectedObservationHash !== undefined && !missing && snapshot().value.storeObservationHash !== expectedObservationHash) fail();
      result = body({ snapshot, publish }, ancestorIdentityHash); checkPins();
    }
  } catch { invalid = true; }
  while (pins.length) { const pin = pins.pop()!; try { fs.closeSync(pin.fd); } catch { cleanupUncertain = true; invalid = true; } }
  if (invalid || !result) fail(); return result as Observation;
}

/** Read-only history; missing root is not created and neither state grants dispatch. */
export function observeDeploymentCutoverServiceEffectStoreV1(): Observation {
  return withStore(false, (store, ancestorIdentityHash) => store ? store.snapshot().value
    : observation(new Map(), null, ancestorIdentityHash));
}
export function publishDeploymentCutoverServiceEffectIntentV1(intent: unknown, expectedObservationHash: string): Observation {
  if (typeof expectedObservationHash !== "string" || !/^[a-f0-9]{64}$/.test(expectedObservationHash)) fail();
  const bytes = encodeDeploymentCutoverServiceEffectIntentV1(intent);
  const ordinal = (JSON.parse(bytes.toString("utf8")) as { ordinal: 1 | 2 }).ordinal;
  return withStore(ordinal === 1, store => {
    if (!store) fail();
    return store!.publish(`intent-${String(ordinal).padStart(4, "0")}.json`, bytes, expectedObservationHash);
  }, expectedObservationHash);
}
export function publishDeploymentCutoverServiceEffectCompletionV1(completion: unknown, expectedObservationHash: string): Observation {
  if (typeof expectedObservationHash !== "string" || !/^[a-f0-9]{64}$/.test(expectedObservationHash)) fail();
  const bytes = encodeDeploymentCutoverServiceEffectCompletionV1(completion);
  const ordinal = (JSON.parse(bytes.toString("utf8")) as { ordinal: 1 | 2 }).ordinal;
  return withStore(false, store => {
    if (!store) fail();
    return store!.publish(`completion-${String(ordinal).padStart(4, "0")}.json`, bytes, expectedObservationHash);
  }, expectedObservationHash);
}

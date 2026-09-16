import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { encodeMaintenanceJournalRecordV1, parseMaintenanceOwnerHistoryV1 } from "./build-generation-maintenance-journal.mjs";

// Internal storage only: neither record publication nor replay grants live
// ownership. Caller must authenticate fixed root, process and exclusion first.
const MAX_BYTES = 65536;
const FIXED = /^(?:intent|owner-(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-3][0-9]{3}|40[0-8][0-9]|409[0-6]))\.json$/;
const TEMP = /^\.(intent\.json|owner-[0-9]{4}\.json)\.[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.tmp$/;
const DIRECTORY_KEYS = ["dev", "ino", "uid", "gid", "mode", "birthtimeNs"];
const FILE_KEYS = [...DIRECTORY_KEYS, "size", "nlink", "mtimeNs", "ctimeNs"];
const same = (a, b, keys = FILE_KEYS) => keys.every(key => a[key] === b[key]);
const fail = () => { throw Error("MAINTENANCE_JOURNAL_STORE_INVALID"); };

function useDescriptor(fd, callback) {
  let result, failure = null;
  try { result = callback(fd); } catch (error) { failure = error; }
  try { fs.closeSync(fd); }
  catch (closeError) {
    if (failure !== null) throw new AggregateError([failure, closeError], "MAINTENANCE_JOURNAL_CLOSE_UNCERTAIN");
    throw closeError;
  }
  if (failure !== null) throw failure;
  return result;
}

export function openMaintenanceOwnerJournalV1(directory) {
  if (typeof directory !== "string" || !path.isAbsolute(directory) || path.normalize(directory) !== directory) fail();
  const parents = [];
  for (let current = directory; ; current = path.dirname(current)) {
    const stat = fs.lstatSync(current, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink() || parents.length >= 128) fail();
    parents.push({ path: current, stat });
    if (path.dirname(current) === current) break;
  }
  if (parents[0].stat.uid !== BigInt(process.getuid()) || (parents[0].stat.mode & 0o7777n) !== 0o700n) fail();
  const assertParents = () => {
    for (const original of parents) {
      const current = fs.lstatSync(original.path, { bigint: true });
      if (!current.isDirectory() || current.isSymbolicLink() || !same(current, original.stat, DIRECTORY_KEYS)) fail();
    }
  };
  const readFile = name => {
    assertParents();
    const file = path.join(directory, name);
    return useDescriptor(fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK), fd => {
      const before = fs.fstatSync(fd, { bigint: true });
      if (!before.isFile() || before.uid !== BigInt(process.getuid()) || before.dev !== parents[0].stat.dev
        || (before.mode & 0o7777n) !== 0o600n || ![1n, 2n].includes(before.nlink) || before.size > BigInt(MAX_BYTES)) fail();
      const buffer = Buffer.alloc(Number(before.size) + 1);
      let length = 0;
      while (length < buffer.length) {
        const count = fs.readSync(fd, buffer, length, buffer.length - length, length);
        if (count === 0) break;
        length += count;
      }
      if (BigInt(length) !== before.size || !same(before, fs.fstatSync(fd, { bigint: true }))
        || !same(before, fs.lstatSync(file, { bigint: true }))) fail();
      assertParents();
      return { bytes: buffer.subarray(0, length), stat: before };
    });
  };
  const syncDirectory = () => {
    assertParents();
    useDescriptor(fs.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW), fd => {
      if (!same(fs.fstatSync(fd, { bigint: true }), parents[0].stat, DIRECTORY_KEYS)) fail();
      fs.fsyncSync(fd);
      assertParents();
    });
  };
  const snapshot = () => {
    assertParents();
    const names = fs.readdirSync(directory).sort();
    if (names.length > 8202) fail();
    const files = new Map(), stages = [];
    for (const name of names) {
      const temporary = TEMP.exec(name);
      if (!FIXED.test(name) && (!temporary || !FIXED.test(temporary[1]))) fail();
      const observed = readFile(name);
      files.set(name, observed);
      if (temporary) stages.push({ name, basename: temporary[1], observed });
    }
    let pendingPublicationCount = 0;
    for (const stage of stages) {
      if (stage.observed.stat.nlink === 1n) { pendingPublicationCount++; continue; }
      const fixed = files.get(stage.basename);
      if (!fixed || !same(fixed.stat, stage.observed.stat) || !fixed.bytes.equals(stage.observed.bytes)) fail();
    }
    if (pendingPublicationCount > 8) fail();
    const committedNames = names.filter(name => FIXED.test(name));
    for (const name of committedNames) {
      const fixed = files.get(name);
      const aliases = stages.filter(stage => stage.observed.stat.dev === fixed.stat.dev && stage.observed.stat.ino === fixed.stat.ino);
      if (fixed.stat.nlink === 2n ? aliases.length !== 1 : aliases.length !== 0) fail();
    }
    const ownerNames = committedNames.filter(name => name !== "intent.json");
    if (ownerNames.some((name, index) => name !== `owner-${String(index + 1).padStart(4, "0")}.json`)) fail();
    const intentBytes = files.get("intent.json")?.bytes;
    if (!intentBytes && ownerNames.length > 0) fail();
    const history = intentBytes ? parseMaintenanceOwnerHistoryV1(intentBytes, ownerNames.map(name => files.get(name).bytes))
      : Object.freeze({ intent: null, claims: Object.freeze([]) });
    if (JSON.stringify(names) !== JSON.stringify(fs.readdirSync(directory).sort())) fail();
    for (const [name, observed] of files) if (!same(observed.stat, fs.lstatSync(path.join(directory, name), { bigint: true }))) fail();
    assertParents();
    return { history: Object.freeze({ ...history, pendingPublicationCount }), files };
  };
  const publish = (basename, bytes) => {
    const before = snapshot(), existing = before.files.get(basename);
    if (existing) {
      if (!existing.bytes.equals(bytes)) fail();
      syncDirectory();
    } else {
      if (before.history.pendingPublicationCount >= 8) fail();
      const staging = `.${basename}.${randomUUID()}.tmp`;
      const stagingPath = path.join(directory, staging), fixedPath = path.join(directory, basename);
      assertParents();
      useDescriptor(fs.openSync(stagingPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600), fd => {
        assertParents(); fs.writeFileSync(fd, bytes); fs.fsyncSync(fd);
      });
      const prepared = readFile(staging);
      if (prepared.stat.nlink !== 1n || !prepared.bytes.equals(bytes)) fail();
      // On errors preserve all effects. Recovery never deletes partial evidence.
      fs.linkSync(stagingPath, fixedPath);
      const linked = readFile(staging), fixed = readFile(basename);
      if (linked.stat.nlink !== 2n || !same(linked.stat, fixed.stat)
        || !same(linked.stat, prepared.stat, [...DIRECTORY_KEYS, "size", "mtimeNs"])
        || !fixed.bytes.equals(bytes) || !linked.bytes.equals(bytes)) fail();
      assertParents(); fs.unlinkSync(stagingPath); syncDirectory();
    }
    const after = snapshot();
    if (!after.files.get(basename)?.bytes.equals(bytes)) fail();
    return after.history;
  };
  return Object.freeze({
    read() { return snapshot().history; },
    publishIntent(intent) {
      const bytes = encodeMaintenanceJournalRecordV1(intent);
      parseMaintenanceOwnerHistoryV1(bytes, []);
      return publish("intent.json", bytes).intent;
    },
    publishOwnerClaim(claim) {
      const bytes = encodeMaintenanceJournalRecordV1(claim), record = JSON.parse(bytes.toString("utf8"));
      const before = snapshot();
      if (!before.history.intent) fail();
      const claims = before.history.claims;
      if (record.ordinal === claims.length) {
        if (!claims.length || !encodeMaintenanceJournalRecordV1(claims.at(-1)).equals(bytes)) fail();
      } else {
        parseMaintenanceOwnerHistoryV1(encodeMaintenanceJournalRecordV1(before.history.intent), [...claims.map(encodeMaintenanceJournalRecordV1), bytes]);
      }
      const after = publish(`owner-${String(record.ordinal).padStart(4, "0")}.json`, bytes);
      if (after.claims.at(-1)?.ownerClaimHash !== record.ownerClaimHash) fail();
      return after.claims.at(-1);
    },
  });
}

import fs from "node:fs";
import path from "node:path";
import { userInfo } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import * as zlib from "node:zlib";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const reviewed = Object.freeze([
  { name: "postgres", version: "3.4.8", entry: "src/index.js",
    integrity: "sha512-d+JFcLM17njZaOLkv6SCev7uoLaBtfK86vMUXhW1Z4glPWh4jozno9APvW/XKFJ3CCxVoC7OL38BqRydtu5nGg==" },
  { name: "zod", version: "4.4.3", entry: "index.js",
    integrity: "sha512-ytENFjIJFl2UwYglde2jchW2Hwm4GJFLDiSXWdTrJQBIN9Fcyp7n4DhxJEiWNAJMV1/BqWfW/kkg71UDcHJyTQ==" },
]);
const fail = () => { throw Error("DEPLOYMENT_CUTOVER_DEPENDENCY_REFUSED"); };
const directoryKeys = ["dev", "ino", "uid", "gid", "mode", "birthtimeNs"];
const fileKeys = [...directoryKeys, "nlink", "size", "mtimeNs", "ctimeNs"];
const same = (a, b, keys) => keys.every(key => a[key] === b[key]);
const zero = bytes => bytes.every(byte => byte === 0);
let uncertain = false;

function decodeGzipV1(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 18 || bytes.length > 2 * 1024 * 1024
    || bytes[0] !== 31 || bytes[1] !== 139 || bytes[2] !== 8 || bytes[3] !== 0 || typeof zlib.crc32 !== "function") fail();
  const decoded = zlib.inflateRawSync(bytes.subarray(10), { info: true, maxOutputLength: 8 * 1024 * 1024 });
  const trailer = 10 + decoded.engine.bytesWritten;
  if (!Number.isSafeInteger(trailer) || trailer + 8 !== bytes.length
    || bytes.readUInt32LE(trailer) !== zlib.crc32(decoded.buffer)
    || bytes.readUInt32LE(trailer + 4) !== decoded.buffer.length) fail();
  return decoded.buffer;
}

function decodeTarV1(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1024 || bytes.length > 8 * 1024 * 1024 || bytes.length % 512) fail();
  const members = [], seen = new Set();
  const text = field => {
    const end = field.indexOf(0), body = end < 0 ? field : field.subarray(0, end);
    if ((end >= 0 && !zero(field.subarray(end))) || body.some(byte => byte < 32 || byte > 126)) fail();
    return body.toString("ascii");
  };
  const octal = (field, allowEmpty = false) => {
    if (allowEmpty && zero(field)) return 0;
    const value = field.toString("ascii");
    if (field.some(byte => byte > 127) || !/^[0-7]+[ \0]*$/.test(value)) fail();
    const parsed = Number.parseInt(value, 8); if (!Number.isSafeInteger(parsed)) fail(); return parsed;
  };
  for (let offset = 0; offset < bytes.length;) {
    const header = bytes.subarray(offset, offset + 512);
    if (zero(header)) {
      if (bytes.length - offset < 1024 || !zero(bytes.subarray(offset)) || members.length === 0) fail();
      return Object.freeze(members);
    }
    if (members.length >= 1024 || header[156] !== 48 || header.subarray(257, 265).toString("hex") !== "7573746172003030"
      || !zero(header.subarray(157, 257)) || !zero(header.subarray(500))) fail();
    let sum = 0; for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : header[i];
    if (sum !== octal(header.subarray(148, 156))) fail();
    const mode = octal(header.subarray(100, 108)); if (![0o644, 0o755].includes(mode)) fail();
    octal(header.subarray(108, 116), true); octal(header.subarray(116, 124), true); octal(header.subarray(136, 148));
    octal(header.subarray(329, 337), true); octal(header.subarray(337, 345), true);
    text(header.subarray(265, 297)); text(header.subarray(297, 329));
    const prefix = text(header.subarray(345, 500)), name = text(header.subarray(0, 100));
    const locator = prefix ? `${prefix}/${name}` : name;
    if (!/^package\/[A-Za-z0-9._/-]+$/.test(locator) || locator.split("/").some(part => part === "" || part === "." || part === "..")
      || [...seen].some(prior => prior === locator || prior.startsWith(`${locator}/`) || locator.startsWith(`${prior}/`))) fail();
    seen.add(locator);
    const length = octal(header.subarray(124, 136)), start = offset + 512, end = start + length;
    const next = start + Math.ceil(length / 512) * 512;
    if (length > 2 * 1024 * 1024 || next > bytes.length || !zero(bytes.subarray(end, next))) fail();
    members.push(Object.freeze({ locator: locator.slice(8), bytes: Buffer.from(bytes.subarray(start, end)) }));
    offset = next;
  }
  fail();
}

// Caller must first authenticate this module and package-lock.json against Git.
// This returns owned archive bytes, never an execution or database capability.
export function readCutoverDependencyArchivesV1() {
  if (uncertain || arguments.length !== 0) fail();
  const pins = [], directories = new Set(), files = [];
  let result, invalid = false;
  try {
    const home = userInfo().homedir, uid = BigInt(process.getuid());
    if (!path.isAbsolute(home) || fs.realpathSync(home) !== home || fs.realpathSync(root) !== root
      || !root.startsWith(`${home}${path.sep}`)) fail();
    const check = () => {
      for (const pin of pins) if (!same(pin.stat, fs.fstatSync(pin.fd, { bigint: true }), directoryKeys)
        || !same(pin.stat, fs.lstatSync(pin.target, { bigint: true }), directoryKeys)) fail();
      for (const file of files) if (!same(file.stat, fs.lstatSync(file.target, { bigint: true }), fileKeys)) fail();
    };
    const hold = directory => {
      const segments = directory.split(path.sep).filter(Boolean); if (segments.length > 128) fail();
      for (let index = 0; index <= segments.length; index++) {
        const target = path.join(path.parse(directory).root, ...segments.slice(0, index)); if (directories.has(target)) continue;
        check(); const stat = fs.lstatSync(target, { bigint: true });
        if (!stat.isDirectory() || stat.isSymbolicLink()
          || ((target === home || target.startsWith(`${home}/`)) && (stat.uid !== uid || (stat.mode & 0o022n)))) fail();
        const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
        pins.push({ target, stat, fd }); directories.add(target); check();
      }
    };
    hold(root); const device = pins.at(-1).stat.dev;
    const read = (target, cap) => {
      hold(path.dirname(target)); check();
      const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
      let observed;
      try {
        const stat = fs.fstatSync(fd, { bigint: true });
        if (!stat.isFile() || stat.uid !== uid || stat.dev !== device || (stat.mode & 0o022n) || stat.nlink !== 1n || stat.size < 1n || stat.size > BigInt(cap)) fail();
        const buffer = Buffer.alloc(Number(stat.size) + 1);
        let count = 0;
        while (count < buffer.length) {
          const size = fs.readSync(fd, buffer, count, buffer.length - count, count);
          if (size === 0) break;
          count += size;
        }
        if (BigInt(count) !== stat.size || !same(stat, fs.fstatSync(fd, { bigint: true }), fileKeys)
          || !same(stat, fs.lstatSync(target, { bigint: true }), fileKeys)) fail();
        observed = { target, stat, bytes: Buffer.from(buffer.subarray(0, count)) };
      } finally { fs.closeSync(fd); }
      files.push(observed); check(); return observed.bytes;
    };
    const lockBytes = read(path.join(root, "package-lock.json"), 4 * 1024 * 1024), lock = JSON.parse(lockBytes);
    if (lock.lockfileVersion !== 3 || !lock.packages || Array.isArray(lock.packages)) fail();
    const packages = [];
    const noDependencies = value => ["dependencies", "peerDependencies", "optionalDependencies"].every(key => value[key] === undefined
      || (value[key] && !Array.isArray(value[key]) && typeof value[key] === "object" && Object.keys(value[key]).length === 0));
    for (const contract of reviewed) {
      const declared = lock.packages[`node_modules/${contract.name}`];
      if (!declared || declared.version !== contract.version || declared.integrity !== contract.integrity || !noDependencies(declared)) fail();
      const digest = Buffer.from(contract.integrity.slice(7), "base64").toString("hex");
      const compressed = read(path.join(home, ".npm/_cacache/content-v2/sha512", digest.slice(0, 2), digest.slice(2, 4), digest.slice(4)), 2 * 1024 * 1024);
      if (`sha512-${createHash("sha512").update(compressed).digest("base64")}` !== contract.integrity) fail();
      const rawMembers = decodeTarV1(decodeGzipV1(compressed));
      const metadata = rawMembers.find(member => member.locator === "package.json"); if (!metadata) fail();
      const manifest = JSON.parse(metadata.bytes);
      if (manifest.name !== contract.name || manifest.version !== contract.version || manifest.type !== "module" || !noDependencies(manifest)
        || !rawMembers.some(member => member.locator === contract.entry && member.bytes.length > 0)) fail();
      packages.push(Object.freeze({ name: contract.name, version: contract.version, entryLocator: `node_modules/${contract.name}/${contract.entry}`,
        members: Object.freeze(rawMembers.map(member => Object.freeze({ locator: `node_modules/${contract.name}/${member.locator}`, bytes: member.bytes }))) }));
    }
    if (!read(path.join(root, "package-lock.json"), 4 * 1024 * 1024).equals(lockBytes)) fail();
    check(); result = Object.freeze({ packages: Object.freeze(packages) });
  } catch { invalid = true; }
  while (pins.length) { const pin = pins.pop(); try { fs.closeSync(pin.fd); } catch { invalid = true; } }
  if (invalid || !result) { uncertain = true; fail(); }
  return result;
}

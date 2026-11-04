import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants, closeSync, fstatSync, lstatSync, openSync, readlinkSync, readSync,
  realpathSync, type BigIntStats } from 'node:fs';
import { posix } from 'node:path';
import { types } from 'node:util';
import { subscriptionCodingCanonicalPathV1, subscriptionCodingHashV1,
  subscriptionCodingPublicAncestorAllowedV1, subscriptionCodingWorkerRefusedV1 } from './subscription-coding-worker-policy-v1.js';

const refuse: () => never = subscriptionCodingWorkerRefusedV1;
const MAX_IMAGES = 64, MAX_EDGES = 512, MAX_ALIASES = 128, MAX_OUTPUT = 524288;
const MAX_FILE = 268435456, MAX_BYTES = 1073741824, MAX_PINS = 2048, DEADLINE_MS = 30000;
const uid = () => { if (!process.getuid) refuse(); return BigInt(process.getuid()); };
function frozen<T>(value: T): T {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
}
function data(value: unknown, depth = 0): any {
  if (depth > 12 || (value !== null && typeof value === 'object' && types.isProxy(value))) refuse();
  if (typeof value === 'string' || value === null) return value;
  if (Array.isArray(value)) {
    if (value.length > 1024) refuse();
    const ds = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(ds).length !== value.length + 1) refuse();
    return Array.from({ length: value.length }, (_, i) => {
      const d = ds[String(i)]; if (!d || !Object.hasOwn(d, 'value')) refuse(); return data(d.value, depth + 1);
    });
  }
  if (typeof value !== 'object') refuse();
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) refuse();
  const out: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') refuse();
    const d = Object.getOwnPropertyDescriptor(value, key); if (!d || !Object.hasOwn(d, 'value')) refuse();
    out[key] = data(d.value, depth + 1);
  }
  return out;
}
function exact(value: any, keys: readonly string[]): void {
  if (!value || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) refuse();
}
function canonical(value: unknown): asserts value is string { if (!subscriptionCodingCanonicalPathV1(value)) refuse(); }
function publicPath(path: string): void {
  canonical(path); if (!path.startsWith('/opt/homebrew/')) refuse();
}
function nodeLocation(path: string): void {
  if (!/^\/opt\/homebrew\/Cellar\/node(?:@[0-9]+)?\/[0-9]+\.[0-9]+\.[0-9]+\/bin\/node$/.test(path)) refuse();
}
function libraryLocation(path: string): void {
  canonical(path);
  if (!/^\/opt\/homebrew\/(?:Cellar\/[^/]+\/[^/]+\/(?:lib|bin)|opt\/[^/]+\/lib)\/(?:[^/]+\/)*[^/]+\.dylib$/.test(path)) refuse();
}
function system(path: string): boolean { return path.startsWith('/usr/lib/') || path.startsWith('/System/Library/'); }
function aliasTarget(target: unknown): asserts target is string {
  if (typeof target !== 'string' || !target || target.length > 1024 || /[\x00-\x20\\\x7f]/.test(target)) refuse();
  const parts = target.split('/'); let named = false;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if ((!part && !(i === 0 && target.startsWith('/'))) || part === '.' || (part === '..' && named)) refuse();
    if (part !== '..' && part) named = true;
  }
}

function text(value: unknown): asserts value is string {
  if (typeof value !== 'string' || Buffer.byteLength(value) > MAX_OUTPUT || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\ufffd]/.test(value)
    || !value.endsWith('\n')) refuse();
}
export type SubscriptionCodingNodeMachOV1 = Readonly<{ dependencies: readonly string[]; rpaths: readonly string[] }>;
/** Inert metadata parser: output DATA confers no physical file or runtime authority. */
export function parseSubscriptionCodingNodeMachOV1(path: string, dependenciesOutput: string, loadCommandsOutput: string): SubscriptionCodingNodeMachOV1 {
  canonical(path); text(dependenciesOutput); text(loadCommandsOutput);
  const header = (line: string) => line === path + ':' || line === path + ' (architecture arm64):';
  const lines = dependenciesOutput.split('\n');
  if (!header(lines.shift()!)) refuse();
  const dependencies: string[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const match = /^\s+(.+) \(compatibility version [0-9]+\.[0-9]+\.[0-9]+, current version [0-9]+\.[0-9]+\.[0-9]+(?:, (?:weak|reexport))?\)\s*$/.exec(line);
    if (!match || match[1].length > 1024 || /[\s\\]/.test(match[1])) refuse();
    dependencies.push(match[1]); if (dependencies.length > MAX_EDGES) refuse();
  }
  const commands = loadCommandsOutput.split('\n');
  if (!header(commands.shift()!)) refuse();
  const rpaths: string[] = []; let count = 0, block: string[] = [], headerLines: string[] = [];
  const consume = () => {
    if (!block.length) return;
    const cmds = block.filter(line => /^\s*cmd\s+/.test(line));
    const sizes = block.filter(line => /^\s*cmdsize\s+/.test(line));
    if (cmds.length !== 1 || sizes.length !== 1 || !/^\s*cmd LC_[A-Z0-9_]+\s*$/.test(cmds[0])
      || !/^\s*cmdsize [1-9][0-9]*\s*$/.test(sizes[0])) refuse();
    if (cmds[0].trim() === 'cmd LC_RPATH') {
      const paths = block.filter(line => /^\s*path\s+/.test(line));
      const match = paths.length === 1 && /^\s*path (\S+) \(offset [0-9]+\)\s*$/.exec(paths[0]);
      if (!match || match[1].length > 1024) refuse();
      rpaths.push(match[1]); if (rpaths.length > MAX_ALIASES) refuse();
    }
  };
  for (const line of commands) {
    const match = /^Load command ([0-9]+)$/.exec(line);
    if (match) {
      consume(); if (Number(match[1]) !== count || ++count > 1024) refuse(); block = [];
    } else if (count) block.push(line); else headerLines.push(line);
  }
  consume();
  // Real otool carries the Mach header's ncmds. Cross-check it so a successful
  // but partial response cannot silently lose a tail of load commands.
  const nonemptyHeader = headerLines.map(line => line.trim()).filter(Boolean);
  if (nonemptyHeader.length !== 3 || nonemptyHeader[0] !== 'Mach header'
    || nonemptyHeader[1].split(/\s+/).join(' ') !== 'magic cputype cpusubtype caps filetype ncmds sizeofcmds flags' || !count) refuse();
  const fields = nonemptyHeader[2].split(/\s+/);
  if (fields.length !== 8 || fields[0] !== '0xfeedfacf' || fields[1] !== '16777228'
    || !/^[0-9]+$/.test(fields[5]) || Number(fields[5]) !== count) refuse();
  return frozen({ dependencies, rpaths });
}
function expand(value: string, loader: string, executable: string): string {
  let path: string;
  if (value === '@loader_path') path = posix.dirname(loader);
  else if (value.startsWith('@loader_path/')) path = posix.resolve(posix.dirname(loader), value.slice(13));
  else if (value === '@executable_path') path = posix.dirname(executable);
  else if (value.startsWith('@executable_path/')) path = posix.resolve(posix.dirname(executable), value.slice(17));
  else if (value.startsWith('/')) { canonical(value); path = value; }
  else return refuse();
  publicPath(path); return path;
}
type Lookup = Readonly<{ path: string; readPaths: readonly string[] }>;
type Edge = Readonly<{ loaderPath: string; installName: string; path: string; alias: string }>;
type Graph = Readonly<{ nodePath: string; readPaths: readonly string[]; mapPaths: readonly string[];
  absentPaths: readonly string[]; images: readonly Readonly<{ path: string; metadata: SubscriptionCodingNodeMachOV1 }>[];
  edges: readonly Edge[] }>;
type Rpath = Readonly<{ value: string; loader: string }>;
async function collect(nodePath: string, lookup: (path: string) => Lookup | undefined,
  readImage: (path: string) => Promise<SubscriptionCodingNodeMachOV1>, checkDeadline: () => void): Promise<Graph> {
  nodeLocation(nodePath);
  const first = lookup(nodePath); if (!first || first.path !== nodePath) refuse();
  const readPaths = new Set<string>(), mapPaths = new Set<string>(), absentPaths = new Set<string>();
  const images: { path: string; metadata: SubscriptionCodingNodeMachOV1 }[] = [], edges: Edge[] = [];
  const queue: { path: string; inherited: readonly Rpath[] }[] = [{ path: nodePath, inherited: [] }];
  const visited = new Map<string, { metadata: SubscriptionCodingNodeMachOV1; rpaths: readonly string[] }>();
  while (queue.length) {
    checkDeadline(); const current = queue.shift()!;
    const previous = visited.get(current.path);
    if (!previous && visited.size >= MAX_IMAGES) refuse();
    const metadata = previous?.metadata ?? await readImage(current.path); checkDeadline();
    // Every frame remembers its defining image. Inherited @loader_path must
    // expand against that image, rather than against the current dependency.
    const rpaths: Rpath[] = [...metadata.rpaths.map(value => ({ value, loader: current.path })), ...current.inherited];
    for (const rpath of rpaths) expand(rpath.value, rpath.loader, nodePath);
    if (rpaths.length > MAX_ALIASES) refuse();
    const expandedRpaths = [...new Set(rpaths.map(frame => expand(frame.value, frame.loader, nodePath)))];
    if (previous) {
      // Refuse a context-sensitive shared image rather than guess which
      // ancestor run-path stack the dynamic loader will choose.
      if (metadata.dependencies.some(name => name.startsWith('@rpath/'))
        && JSON.stringify(previous.rpaths) !== JSON.stringify(expandedRpaths)) refuse();
      continue;
    }
    visited.set(current.path, { metadata, rpaths: expandedRpaths });
    images.push({ path: current.path, metadata });
    for (const installName of metadata.dependencies) {
      checkDeadline(); if (edges.length >= MAX_EDGES) refuse();
      if (system(installName)) {
        canonical(installName); edges.push({ loaderPath: current.path, installName, path: installName, alias: installName }); continue;
      }
      let candidates: string[];
      if (installName.startsWith('@rpath/')) {
        const suffix = installName.slice(7);
        if (!suffix || suffix.startsWith('/') || suffix.split('/').some(part => !part || part === '.' || part === '..') || /[@\\]/.test(suffix)) refuse();
        candidates = [...new Set(rpaths.map(frame => posix.join(expand(frame.value, frame.loader, nodePath), suffix)))];
      } else candidates = [expand(installName, current.path, nodePath)];
      let resolved: Lookup | undefined, selected = '';
      for (const candidate of candidates) {
        libraryLocation(candidate); resolved = lookup(candidate);
        if (resolved) { selected = candidate; break; }
        absentPaths.add(candidate); if (absentPaths.size > MAX_EDGES) refuse();
      }
      if (!resolved) refuse();
      libraryLocation(resolved.path); if (!resolved.path.startsWith('/opt/homebrew/Cellar/')) refuse();
      edges.push({ loaderPath: current.path, installName, path: resolved.path, alias: selected });
      for (const path of resolved.readPaths) { libraryLocation(path); readPaths.add(path); mapPaths.add(path); }
      // A dylib self-ID is resolved and pinned, rather than blindly discarded.
      if (resolved.path !== current.path && resolved.path !== nodePath) queue.push({ path: resolved.path, inherited: rpaths });
    }
  }
  return frozen({ nodePath, readPaths: [...readPaths].sort(), mapPaths: [...mapPaths].sort(), absentPaths: [...absentPaths].sort(), images, edges });
}
/** Compact in-memory graph DATA seam. Never used by production capture. */
export async function resolveSubscriptionCodingNodeLibraryDataV1(input: Readonly<{
  nodePath: string; images: readonly Readonly<{ path: string; dependenciesOutput: string; loadCommandsOutput: string }>[];
  aliases: readonly Readonly<{ path: string; target: string }>[];
}>): Promise<Graph> {
  const v = data(input); exact(v, ['nodePath', 'images', 'aliases']); canonical(v.nodePath); nodeLocation(v.nodePath);
  if (!Array.isArray(v.images) || !Array.isArray(v.aliases) || v.images.length > MAX_IMAGES || v.aliases.length > MAX_ALIASES) refuse();
  const images = new Map<string, SubscriptionCodingNodeMachOV1>(), aliases = new Map<string, string>();
  for (const image of v.images) {
    exact(image, ['path', 'dependenciesOutput', 'loadCommandsOutput']); canonical(image.path);
    if (image.path !== v.nodePath) libraryLocation(image.path);
    if (!image.path.startsWith('/opt/homebrew/Cellar/') || images.has(image.path)) refuse();
    images.set(image.path, parseSubscriptionCodingNodeMachOV1(image.path, image.dependenciesOutput, image.loadCommandsOutput));
  }
  for (const alias of v.aliases) {
    exact(alias, ['path', 'target']); publicPath(alias.path);
    aliasTarget(alias.target); if (aliases.has(alias.path)) refuse();
    aliases.set(alias.path, alias.target);
  }
  const lookup = (original: string): Lookup | undefined => {
    let path = original; const paths = new Set([path]), seen = new Set<string>();
    while (true) {
      publicPath(path);
      const parts = path.split('/'); let aliasPath: string | undefined;
      for (let i = 2; i <= parts.length; i++) { const prefix = parts.slice(0, i).join('/'); if (aliases.has(prefix)) { aliasPath = prefix; break; } }
      if (!aliasPath) return images.has(path) ? { path, readPaths: [...paths] } : undefined;
      if (seen.has(aliasPath) || seen.size >= MAX_ALIASES) refuse(); seen.add(aliasPath);
      path = posix.resolve(posix.dirname(aliasPath), aliases.get(aliasPath)!) + path.slice(aliasPath.length);
      publicPath(path); paths.add(path);
    }
  };
  return collect(v.nodePath, lookup, async path => { const image = images.get(path); if (!image) refuse(); return image; }, () => {});
}

function same(a: BigIntStats, b: BigIntStats): boolean {
  return a.dev === b.dev && a.ino === b.ino && a.mode === b.mode && a.uid === b.uid && a.gid === b.gid
    && a.nlink === b.nlink && a.rdev === b.rdev && a.size === b.size && a.mtimeNs === b.mtimeNs
    && a.ctimeNs === b.ctimeNs && a.birthtimeNs === b.birthtimeNs;
}
function identity(stat: BigIntStats) {
  return Object.fromEntries(['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'rdev', 'size', 'mtimeNs', 'ctimeNs', 'birthtimeNs']
    .map(key => [key, String(stat[key as keyof BigIntStats])]));
}
function absent(path: string): boolean {
  try { lstatSync(path); return false; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true; throw error; }
}
type DirectoryPin = { path: string; stat: BigIntStats; fd: number | undefined };
type FilePin = DirectoryPin & { hash: string };
type AliasPin = Readonly<{ path: string; target: string; stat: BigIntStats }>;
function createFilePins(publicOnly: boolean) {
  const directories = new Map<string, DirectoryPin>(), files = new Map<string, FilePin>(), aliases = new Map<string, AliasPin>();
  const missing = new Set<string>(), readPaths = new Set<string>(); let bytes = 0;
  let closeResult: 'closed' | 'custody-uncertain' | undefined;
  const alive = () => { if (closeResult) refuse(); };
  const directoryAllowed = (path: string, stat: BigIntStats) => {
    const allowed = subscriptionCodingPublicAncestorAllowedV1({ path, uid: stat.uid, gid: stat.gid, mode: stat.mode,
      currentUid: uid(), directory: stat.isDirectory(), symbolicLink: stat.isSymbolicLink() });
    // General DATA inspection also supports the root-owned sticky temp ancestor.
    if (!allowed && !( !publicOnly && stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === 0n
      && (stat.mode & 0o1000n) !== 0n)) refuse();
  };
  function pinDirectory(path: string): void {
    if (directories.has(path)) return;
    if (directories.size + files.size >= MAX_PINS) refuse();
    const stat = lstatSync(path, { bigint: true }); directoryAllowed(path, stat);
    if (realpathSync(path) !== path) refuse();
    const fd = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    const pin = { path, stat, fd }; directories.set(path, pin);
    if (!same(stat, fstatSync(fd, { bigint: true })) || !same(stat, lstatSync(path, { bigint: true }))) refuse();
  }
  function hashFile(pin: DirectoryPin, deadline: number): string {
    if (pin.fd === undefined) refuse();
    const before = fstatSync(pin.fd, { bigint: true });
    if (!same(before, pin.stat) || !same(before, lstatSync(pin.path, { bigint: true })) || realpathSync(pin.path) !== pin.path) refuse();
    const hash = createHash('sha256'), buffer = Buffer.alloc(65536); let offset = 0;
    while (offset < Number(before.size)) {
      if (performance.now() >= deadline) refuse();
      const count = readSync(pin.fd, buffer, 0, Math.min(buffer.length, Number(before.size) - offset), offset);
      if (!count) refuse(); hash.update(buffer.subarray(0, count)); offset += count;
    }
    if (readSync(pin.fd, buffer, 0, 1, offset) !== 0 || !same(before, fstatSync(pin.fd, { bigint: true }))
      || !same(before, lstatSync(pin.path, { bigint: true })) || realpathSync(pin.path) !== pin.path) refuse();
    return hash.digest('hex');
  }
  function lookup(original: string, deadline: number): Lookup | undefined {
    alive(); canonical(original); if (publicOnly) publicPath(original);
    let path = original; const paths = new Set([original]), seen = new Set<string>();
    while (true) {
      if (performance.now() >= deadline) refuse();
      pinDirectory('/'); const parts = path.split('/').slice(1); let parent = '/', restart = false;
      for (let i = 0; i < parts.length; i++) {
        const next = posix.join(parent, parts[i]); let stat: BigIntStats;
        try { stat = lstatSync(next, { bigint: true }); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          if (!absent(original)) refuse();
          missing.add(next); if (missing.size > MAX_EDGES) refuse(); return undefined;
        }
        if (stat.isSymbolicLink()) {
          if ((stat.uid !== 0n && stat.uid !== uid()) || stat.nlink !== 1n || stat.size > 1024n
            || seen.has(next) || seen.size >= MAX_ALIASES) refuse();
          seen.add(next); const target = readlinkSync(next);
          aliasTarget(target); if (!same(stat, lstatSync(next, { bigint: true }))) refuse();
          const existing = aliases.get(next);
          if (existing && (!same(existing.stat, stat) || existing.target !== target)) refuse();
          aliases.set(next, { path: next, target, stat }); if (aliases.size > MAX_ALIASES) refuse();
          path = posix.resolve(parent, target, ...parts.slice(i + 1)); canonical(path); if (publicOnly) publicPath(path);
          paths.add(path); restart = true; break;
        }
        if (i < parts.length - 1) { pinDirectory(next); parent = next; continue; }
        if (!stat.isFile() || stat.nlink !== 1n || (stat.uid !== 0n && stat.uid !== uid()) || (stat.mode & 0o022n) !== 0n
          || stat.size < 1n || stat.size > BigInt(MAX_FILE) || realpathSync(path) !== path) refuse();
        if (publicOnly && !path.startsWith('/opt/homebrew/Cellar/')) refuse();
        const previous = files.get(path);
        if (previous) { if (!same(previous.stat, stat)) refuse(); }
        else {
          bytes += Number(stat.size); if (bytes > MAX_BYTES || files.size >= MAX_IMAGES || directories.size + files.size >= MAX_PINS) refuse();
          const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
          const pin: FilePin = { path, stat, fd, hash: '' }; files.set(path, pin); pin.hash = hashFile(pin, deadline);
        }
        for (const alias of paths) { if (realpathSync(alias) !== path) refuse(); readPaths.add(alias); }
        if (readPaths.size > MAX_IMAGES + MAX_EDGES + MAX_ALIASES) refuse();
        return { path, readPaths: [...paths] };
      }
      if (!restart) refuse();
    }
  }
  const close = (): 'closed' | 'custody-uncertain' => {
    if (closeResult) return closeResult;
    closeResult = 'closed';
    for (const pin of [...files.values(), ...directories.values()]) {
      const fd = pin.fd; pin.fd = undefined;
      if (fd !== undefined) { try { closeSync(fd); } catch { closeResult = 'custody-uncertain'; } }
    }
    return closeResult;
  };
  const recheck = (deadline: number) => {
    alive();
    for (const pin of directories.values()) {
      if (performance.now() >= deadline || pin.fd === undefined || realpathSync(pin.path) !== pin.path
        || !same(pin.stat, fstatSync(pin.fd, { bigint: true })) || !same(pin.stat, lstatSync(pin.path, { bigint: true }))) refuse();
      directoryAllowed(pin.path, pin.stat);
    }
    for (const pin of aliases.values()) {
      if (!same(pin.stat, lstatSync(pin.path, { bigint: true })) || readlinkSync(pin.path) !== pin.target) refuse();
    }
    for (const path of missing) if (!absent(path)) refuse();
    for (const pin of files.values()) if (hashFile(pin, deadline) !== pin.hash) refuse();
  };
  const manifest = () => ({
    directories: [...directories.values()].map(pin => ({ path: pin.path, stat: identity(pin.stat) })),
    aliases: [...aliases.values()].map(pin => ({ path: pin.path, target: pin.target, stat: identity(pin.stat) })),
    files: [...files.values()].map(pin => ({ path: pin.path, hash: pin.hash, stat: identity(pin.stat) })), missing: [...missing].sort(),
  });
  return { lookup, recheck, close, manifest, readPaths };
}
export type SubscriptionCodingOwnedFileDataV1 = Readonly<{
  readPaths: readonly string[]; closureHash: string; recheck(): void; close(): 'closed' | 'custody-uncertain';
}>;
/** General owned-filesystem DATA inspection, with no Node, policy or startup authority. */
export function captureSubscriptionCodingOwnedFileDataV1(input: Readonly<{
  paths: readonly string[]; absentPaths: readonly string[];
}>): SubscriptionCodingOwnedFileDataV1 {
  const pins = createFilePins(false);
  try {
    const v = data(input); exact(v, ['paths', 'absentPaths']);
    if (!Array.isArray(v.paths) || !Array.isArray(v.absentPaths) || !v.paths.length || v.paths.length > MAX_IMAGES || v.absentPaths.length > MAX_EDGES) refuse();
    const deadline = performance.now() + DEADLINE_MS;
    for (const path of v.paths) if (!pins.lookup(path, deadline)) refuse();
    for (const path of v.absentPaths) if (pins.lookup(path, deadline)) refuse();
    pins.recheck(deadline); return Object.freeze({ readPaths: Object.freeze([...pins.readPaths].sort()),
      closureHash: subscriptionCodingHashV1(JSON.stringify(pins.manifest())), recheck: () => pins.recheck(performance.now() + DEADLINE_MS), close: pins.close });
  } catch { pins.close(); return refuse(); }
}
export type SubscriptionCodingNodeLibrariesV1 = Readonly<{
  nodePath: string; readPaths: readonly string[]; mapPaths: readonly string[]; closureHash: string;
  recheck(): void; close(): 'closed' | 'custody-uncertain';
}>;
/** Parent-only physical mechanism. Fixed own Node + public metadata; no caller
 * paths, backends, environment options, qualification or admission flags. */
export async function captureSubscriptionCodingNodeLibrariesV1(): Promise<SubscriptionCodingNodeLibrariesV1> {
  const pins = createFilePins(true), deadline = performance.now() + DEADLINE_MS;
  const checkDeadline = () => { if (performance.now() >= deadline) refuse(); };
  const otool = (path: string, flag: '-L' | '-l'): Promise<string> => {
    checkDeadline();
    return new Promise((resolve, reject) => {
      execFile('/usr/bin/otool', ['-arch', 'arm64', ...(flag === '-l' ? ['-h'] : []), flag, path], { shell: false, env: Object.create(null),
        encoding: 'utf8', maxBuffer: MAX_OUTPUT, timeout: Math.max(1, Math.min(5000, Math.floor(deadline - performance.now()))) },
      (error, stdout, stderr) => {
        if (error || stderr.length || performance.now() >= deadline) reject(new Error('SUBSCRIPTION_CODING_WORKER_REFUSED'));
        else resolve(stdout);
      });
    });
  };
  try {
    if (process.platform !== 'darwin' || process.arch !== 'arm64' || arguments.length) refuse();
    const nodePath = realpathSync(process.execPath); nodeLocation(nodePath);
    const original = pins.lookup(process.execPath, deadline); if (!original || original.path !== nodePath) refuse();
    const graph = await collect(nodePath, path => pins.lookup(path, deadline), async path => {
      const dependencies = await otool(path, '-L'), commands = await otool(path, '-l');
      return parseSubscriptionCodingNodeMachOV1(path, dependencies, commands);
    }, checkDeadline);
    pins.recheck(deadline); checkDeadline();
    if (graph.readPaths.length > 256 || graph.mapPaths.length > 256) refuse();
    const closureHash = subscriptionCodingHashV1(JSON.stringify({ schema: 'setfarm.subscription-coding-node-libraries.v1', graph, files: pins.manifest() }));
    return Object.freeze({ nodePath, readPaths: graph.readPaths, mapPaths: graph.mapPaths, closureHash,
      recheck: () => pins.recheck(performance.now() + DEADLINE_MS), close: pins.close });
  } catch { pins.close(); return refuse(); }
}

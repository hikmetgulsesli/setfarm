import { SUBSCRIPTION_CODING_LIMITS_V1 } from './subscription-coding-policy-v1.js';

export const SUBSCRIPTION_SCOPED_FILE_PLUGIN_ID_V1 = 'setfarm-scoped-files-v1';
export const SUBSCRIPTION_SCOPED_FILE_SDK_ROOT_V1 = '/opt/homebrew/lib/node_modules/openclaw/node_modules/@earendil-works/pi-coding-agent';
export const SUBSCRIPTION_SCOPED_FILE_SDK_LEAVES_V1 = Object.freeze([
  'package.json', 'dist/index.js', 'dist/core/tools/write.js', 'dist/core/tools/edit.js',
  'dist/core/tools/edit-diff.js', 'dist/core/tools/file-mutation-queue.js',
  'dist/core/tools/path-utils.js', 'dist/core/tools/tool-definition-wrapper.js',
]);

/** One fixed Node-only operations implementation, embedded verbatim in the pinned plugin.
 * No async filesystem work survives SDK abort/queue rejection. Every invocation
 * owns its preimage; in-place candidate mutation is NOT an atomic acceptance. */
export const SUBSCRIPTION_SCOPED_FILE_OPERATIONS_V1 = String.raw`
function createInvocationOperations(fs, path, scope, signal, editing, rootIdentity) {
  const fail = () => { throw new Error('SETFARM_SCOPED_FILE_REFUSED'); };
  const live = () => { if (signal?.aborted) throw new Error('Operation aborted'); };
  const ownUid = process.getuid();
  const c = fs.constants;
  let preimage;
  const canonical = value => typeof value === 'string' && value.startsWith('/')
    && value.length <= 1024 && !/[\\\x00-\x1f\x7f]/.test(value)
    && !value.includes('//') && !value.split('/').some(p => p === '.' || p === '..')
    && path.resolve(value) === value && value !== '/';
  const inside = (value, root) => value === root || value.startsWith(root + '/');
  const forbidden = value => inside(value, scope.root + '/.git')
    || scope.controls.some(control => inside(value, control));
  const permitted = value => scope.grants.some(grant => grant.kind === 'file'
    ? value === grant.path : value !== grant.path && inside(value, grant.path));
  const target = value => {
    live();
    if (!canonical(value) || !value.startsWith(scope.root + '/') || forbidden(value) || !permitted(value)) fail();
    return value;
  };
  const sameIdentity = (a, b) => a.dev === b.dev && a.ino === b.ino && a.uid === b.uid
    && a.gid === b.gid && a.mode === b.mode && a.birthtimeNs === b.birthtimeNs;
  const sameObject = (a, b) => sameIdentity(a, b) && a.nlink === b.nlink;
  const sameSnapshot = (a, b) => sameObject(a, b) && a.size === b.size
    && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;
  const directory = value => {
    const stat = fs.lstatSync(value, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== BigInt(ownUid)
      || (stat.mode & 0o022n) !== 0n || fs.realpathSync(value) !== value) fail();
    return stat;
  };
  if (!rootIdentity || !sameIdentity(rootIdentity, directory(scope.root))) fail();
  const parents = value => {
    live();
    if (!sameIdentity(rootIdentity, directory(scope.root))) fail();
    const chain = [{ path: scope.root, stat: rootIdentity }];
    const relative = path.relative(scope.root, path.dirname(value));
    if (relative.startsWith('..') || path.isAbsolute(relative)) fail();
    let current = scope.root;
    for (const part of relative ? relative.split('/') : []) {
      current += '/' + part; chain.push({ path: current, stat: directory(current) });
    }
    return chain;
  };
  const recheck = chain => {
    live();
    for (const entry of chain) if (!sameIdentity(entry.stat, directory(entry.path))) fail();
  };
  const regular = stat => {
    if (!stat.isFile() || stat.nlink !== 1n || stat.uid !== BigInt(ownUid)
      || (stat.mode & 0o022n) !== 0n || stat.size < 0n || stat.size > BigInt(scope.maxBytes)) fail();
  };
  const named = (value, fd, before) => {
    const opened = fs.fstatSync(fd, { bigint: true }); regular(opened);
    const current = fs.lstatSync(value, { bigint: true }); regular(current);
    if (!sameObject(opened, current) || (before && !sameSnapshot(before, opened))
      || fs.realpathSync(value) !== value) fail();
    return opened;
  };
  const bytesFrom = (fd, stat) => {
    const bytes = Buffer.alloc(Number(stat.size)); let offset = 0;
    while (offset < bytes.length) {
      const read = fs.readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (read <= 0) fail(); offset += read;
    }
    if (!sameSnapshot(stat, fs.fstatSync(fd, { bigint: true }))) fail();
    return bytes;
  };
  const read = value => {
    value = target(value); const chain = parents(value);
    const fd = fs.openSync(value, c.O_RDONLY | c.O_NOFOLLOW | c.O_NONBLOCK);
    try {
      const stat = named(value, fd); const bytes = bytesFrom(fd, stat);
      recheck(chain); named(value, fd, stat);
      return { value, stat, bytes, chain };
    } finally { fs.closeSync(fd); }
  };
  return {
    async access(value) { const checked = read(value); checked.bytes.fill(0); },
    async readFile(value) {
      if (!editing || preimage) fail();
      preimage = read(value); return Buffer.from(preimage.bytes);
    },
    async mkdir(value) {
      live();
      if (!canonical(value) || !inside(value, scope.root) || forbidden(value)) fail();
      // Exact-file parents are prepared by the owner before launch. Directory
      // grants may create only their own descendants, never an outside parent.
      let current = scope.root; directory(current);
      const relative = path.relative(scope.root, value);
      for (const part of relative ? relative.split('/') : []) {
        current += '/' + part;
        try { directory(current); }
        catch (error) {
          if (error?.code !== 'ENOENT' || !scope.grants.some(grant => grant.kind === 'directory'
            && inside(current, grant.path)) || forbidden(current)) throw error;
          const chain = parents(current); recheck(chain); live();
          fs.mkdirSync(current, { mode: 0o700 }); directory(current); recheck(chain);
        }
      }
      parents(value + '/owned-leaf');
    },
    async writeFile(value, content) {
      value = target(value);
      if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > scope.maxBytes) fail();
      const bytes = Buffer.from(content, 'utf8'); const chain = parents(value);
      if (editing && (!preimage || preimage.value !== value)) fail();
      let before;
      try { before = fs.lstatSync(value, { bigint: true }); regular(before); }
      catch (error) { if (error?.code !== 'ENOENT' || editing) throw error; }
      recheck(chain); live();
      const fd = fs.openSync(value, c.O_RDWR | c.O_NOFOLLOW | c.O_NONBLOCK
        | (before ? 0 : c.O_CREAT | c.O_EXCL), 0o600);
      try {
        const opened = named(value, fd, before);
        if (editing) {
          recheck(preimage.chain);
          if (!sameSnapshot(opened, preimage.stat) || !bytesFrom(fd, opened).equals(preimage.bytes)) fail();
        }
        recheck(chain); named(value, fd, opened); live();
        let offset = 0;
        while (offset < bytes.length) {
          const written = fs.writeSync(fd, bytes, offset, bytes.length - offset, offset);
          if (written <= 0) fail(); offset += written;
        }
        fs.ftruncateSync(fd, bytes.length); fs.fsyncSync(fd);
        const after = named(value, fd);
        if (!sameObject(opened, after) || !bytesFrom(fd, after).equals(bytes)) fail();
        recheck(chain); named(value, fd, after);
      } finally { fs.closeSync(fd); }
    },
    dispose() { if (preimage) preimage.bytes.fill(0); preimage = undefined; },
  };
}
`;

/** Called only with the already-validated canonical scope from worker narrowing. */
export function buildSubscriptionScopedFilePluginV1(input: Readonly<{
  privateRoot: string; worktree: string; grants: readonly Readonly<{ path: string; kind: 'file' | 'directory' }>[];
  controls: readonly string[];
}>): Readonly<{ manifest: string; source: string }> {
  const scope = JSON.stringify({ root: input.worktree, grants: input.grants,
    controls: input.controls, maxBytes: SUBSCRIPTION_CODING_LIMITS_V1.maxRequestBytes });
  const manifest = JSON.stringify({ id: SUBSCRIPTION_SCOPED_FILE_PLUGIN_ID_V1,
    name: 'Setfarm scoped file tools', configSchema: { type: 'object', additionalProperties: false, properties: {} },
    contracts: { tools: ['setfarm_write', 'setfarm_edit'] },
    toolMetadata: { setfarm_write: { optional: true }, setfarm_edit: { optional: true } },
  }, null, 2) + '\n';
  const source = `import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWriteTool, createEditTool } from 'file://${SUBSCRIPTION_SCOPED_FILE_SDK_ROOT_V1}/dist/index.js';
${SUBSCRIPTION_SCOPED_FILE_OPERATIONS_V1}
const scope = ${scope};
export default {
  id: '${SUBSCRIPTION_SCOPED_FILE_PLUGIN_ID_V1}', name: 'Setfarm scoped file tools',
  register(api) {
    const entry = ${JSON.stringify(input.privateRoot + '/scoped-files/index.mjs')};
    if (api.id !== '${SUBSCRIPTION_SCOPED_FILE_PLUGIN_ID_V1}' || api.source !== entry
      || fileURLToPath(import.meta.url) !== entry || fs.realpathSync(entry) !== entry
      || (api.rootDir !== undefined && api.rootDir !== path.dirname(entry))
      || JSON.stringify(fs.readdirSync(path.dirname(entry)).sort()) !== JSON.stringify(['index.mjs', 'openclaw.plugin.json']))
      throw new Error('SETFARM_SCOPED_PLUGIN_SOURCE_REFUSED');
    const rootIdentity = fs.lstatSync(scope.root, { bigint: true });
    for (const [name, factory, editing] of [['setfarm_write', createWriteTool, false], ['setfarm_edit', createEditTool, true]]) {
      const template = factory(scope.root);
      api.registerTool({ name, label: name, description: template.description, parameters: template.parameters,
        prepareArguments: template.prepareArguments, executionMode: template.executionMode,
        async execute(id, params, signal, onUpdate) {
          const operations = createInvocationOperations(fs, path, scope, signal, editing, rootIdentity);
          try { return await factory(scope.root, { operations }).execute(id, params, signal, onUpdate); }
          finally { operations.dispose(); }
        },
      }, { optional: true });
    }
  },
};
`;
  return Object.freeze({ manifest, source });
}

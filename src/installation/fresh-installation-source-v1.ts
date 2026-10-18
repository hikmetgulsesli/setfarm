import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIMIT = 64 * 1024 * 1024;
const GIT_ENV = { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null", GIT_NO_REPLACE_OBJECTS: "1", GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" };
function refuse(): never { throw new Error("FRESH_INSTALLATION_SOURCE_UNAVAILABLE"); }

function git(root: string, args: string[]): string {
  const result = spawnSync("/usr/bin/git", ["-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", ...args],
    { cwd: root, env: GIT_ENV, encoding: "utf8", timeout: 5000, maxBuffer: 2 * 1024 * 1024 });
  if (result.error || result.status !== 0 || result.signal || result.stderr) refuse();
  return result.stdout;
}

/** Source mode attests a real clean checkout; compiled mode additionally requires the actual finalized release. */
export async function captureFreshInstallationSourceShaV1(): Promise<string> {
  try {
    if (Object.keys(process.env).some(key => /^GIT_(?:DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|COMMON_DIR|NAMESPACE|REPLACE_REF_BASE|CONFIG.*)$/.test(key))) refuse();
    const modulePath = fileURLToPath(import.meta.url);
    if (!modulePath.endsWith(".ts")) {
      const release = await import("../internal-production/baseline-post-handoff-receipt-v1.js");
      return release.observeCurrentInternalProductionCleanSetfarmSourceBuildV1().sha;
    }
    const root = realpathSync(path.resolve(path.dirname(modulePath), "../.."));
    if (realpathSync(git(root, ["rev-parse", "--show-toplevel"]).trim()) !== root) refuse();
    const head = git(root, ["rev-parse", "--verify", "HEAD^{commit}"]).trim();
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(head)
      || git(root, ["status", "--porcelain=v1", "--untracked-files=all"]) !== "") refuse();
    const entries = git(root, ["ls-tree", "-r", "-z", "HEAD", "--", "src", "package.json", "package-lock.json", "tsconfig.json"]).split("\0");
    if (entries.pop() !== "" || entries.length < 4 || entries.length > 10_000) refuse();
    const expected = new Map<string, { mode: string; hash: string }>();
    for (const entry of entries) {
      const match = /^(100644|100755) blob ([a-f0-9]{40}|[a-f0-9]{64})\t([^\0\r\n]+)$/.exec(entry);
      if (!match || !/^(?:src\/[^\\]+|package\.json|package-lock\.json|tsconfig\.json)$/.test(match[3]!)
        || match[3]!.split("/").some(part => part === "." || part === ".." || !part) || expected.has(match[3]!)) refuse();
      expected.set(match[3]!, { mode: match[1]!, hash: match[2]! });
    }
    const actual = ["package.json", "package-lock.json", "tsconfig.json"];
    let count = 0;
    const walk = (relative: string, depth: number): void => {
      if (++count > 10_000 || depth > 32) refuse();
      const st = lstatSync(path.join(root, relative));
      if (st.isDirectory()) {
        for (const name of readdirSync(path.join(root, relative)).sort()) walk(`${relative}/${name}`, depth + 1);
      } else if (st.isFile()) actual.push(relative);
      else refuse();
    };
    walk("src", 0);
    if (JSON.stringify(actual.sort()) !== JSON.stringify([...expected.keys()].sort())) refuse();
    let total = 0;
    for (const relative of actual) {
      const wanted = expected.get(relative)!;
      const fd = openSync(path.join(root, relative), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        const before = fstatSync(fd, { bigint: true });
        if (!before.isFile() || before.nlink !== 1n || before.size > 4n * 1024n ** 2n
          || ((before.mode & 0o111n) !== 0n) !== (wanted.mode === "100755")) refuse();
        const declaredSize = Number(before.size);
        if (total + declaredSize > LIMIT) refuse();
        const parts: Buffer[] = []; let amount = 0;
        while (amount < declaredSize) {
          const buffer = Buffer.alloc(Math.min(65536, declaredSize - amount)), n = readSync(fd, buffer);
          if (!n) refuse();
          amount += n; total += n;
          parts.push(buffer.subarray(0, n));
        }
        const after = fstatSync(fd, { bigint: true });
        const named = lstatSync(path.join(root, relative), { bigint: true });
        for (const key of ["dev", "ino", "mode", "nlink", "uid", "gid", "size", "mtimeNs", "ctimeNs"] as const) {
          if (before[key] !== after[key] || before[key] !== named[key]) refuse();
        }
        if (BigInt(amount) !== before.size) refuse();
        const hash = createHash(head.length === 40 ? "sha1" : "sha256")
          .update(`blob ${amount}\0`).update(Buffer.concat(parts)).digest("hex");
        if (hash !== wanted.hash) refuse();
      } finally { closeSync(fd); }
    }
    if (git(root, ["rev-parse", "--verify", "HEAD^{commit}"]).trim() !== head
      || git(root, ["status", "--porcelain=v1", "--untracked-files=all"]) !== "") refuse();
    return head;
  } catch { return refuse(); }
}

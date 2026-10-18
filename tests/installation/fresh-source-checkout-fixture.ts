import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { after } from "node:test";
import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, statfsSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let original: Promise<Readonly<{
  root: string; sha: string;
  api: typeof import("../../src/installation/fresh-installation-v1.js");
  capture: typeof import("../../src/installation/fresh-installation-source-v1.js");
}>> | undefined;
let owned: { root: string; identity: ReturnType<typeof lstatSync> } | undefined;
after(() => {
  if (!owned) return;
  const { root, identity } = owned, current = lstatSync(root);
  assert.equal(current.dev, identity.dev); assert.equal(current.ino, identity.ino);
  assert.equal(current.uid, identity.uid); assert.equal(current.isSymbolicLink(), false);
  rmSync(root, { recursive: true }); // Only this suite's exact newly created directory.
});

/** One real committed copy of the production source; no initializer or source-check bypass. */
export function freshSourceCheckoutFixture() {
  return original ??= (async () => {
    const source = fileURLToPath(new URL("../../", import.meta.url));
    const capacity = statfsSync(source, { bigint: true });
    assert.ok(capacity.bavail * capacity.bsize >= 8n * 1024n ** 3n + 192n * 1024n ** 2n);
    const root = mkdtempSync(path.join(realpathSync(tmpdir()), "setfarm-fresh-source-"));
    owned = { root, identity: lstatSync(root) };
    let bytes = 0, count = 0;
    const copy = (relative: string, depth = 0): void => {
      assert.ok(++count < 10_000 && depth < 32);
      const from = path.join(source, relative), target = path.join(root, relative), st = lstatSync(from);
      if (st.isDirectory()) {
        mkdirSync(target, { mode: 0o700 });
        for (const name of readdirSync(from)) copy(`${relative}/${name}`, depth + 1);
      } else {
        assert.ok(st.isFile() && !st.isSymbolicLink() && st.size <= 4 * 1024 ** 2);
        bytes += st.size; assert.ok(bytes <= 64 * 1024 ** 2);
        copyFileSync(from, target);
      }
    };
    // Asset initialization reads only these fixed source-controlled trees.
    // Track them in the same real fixture commit; keep all existing copy caps.
    const sourcePaths = ["src", "package.json", "package-lock.json", "tsconfig.json", "workflows", "agents", "references", "skills"] as const;
    for (const relative of sourcePaths) copy(relative);
    writeFileSync(path.join(root, ".gitignore"), "node_modules\n", { mode: 0o600 });
    symlinkSync(realpathSync(path.join(source, "node_modules")), path.join(root, "node_modules"), "dir");
    const git = (args: string[]) => execFileSync("/usr/bin/git", ["-c", "core.hooksPath=/dev/null", ...args], {
      cwd: root, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" },
      encoding: "utf8", timeout: 15_000, maxBuffer: 1024 * 1024,
    });
    git(["init", "-q", "-b", "fixture"]);
    git(["add", "--", ...sourcePaths, ".gitignore"]);
    git(["-c", "user.name=Installation Test", "-c", "user.email=installation-test@example.invalid", "commit", "-q", "-m", "production source fixture"]);
    assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]), "");
    const sha = git(["rev-parse", "HEAD"]).trim();
    const api = await import(pathToFileURL(path.join(root, "src/installation/fresh-installation-v1.ts")).href);
    const capture = await import(pathToFileURL(path.join(root, "src/installation/fresh-installation-source-v1.ts")).href);
    return Object.freeze({ root, sha, api, capture });
  })();
}

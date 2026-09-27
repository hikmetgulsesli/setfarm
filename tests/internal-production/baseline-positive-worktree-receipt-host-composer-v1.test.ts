import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const sourceUrl = new URL("../../src/internal-production/baseline-positive-worktree-receipt-host-composer-v1.ts", import.meta.url);
const physicalUrl = new URL("../../src/internal-production/baseline-positive-worktree-physical-catalog-v2.ts", import.meta.url);

function git(args: string[]): string {
  const result = spawnSync("git", args, { encoding: "utf8", env: {
    ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_OPTIONAL_LOCKS: "0",
  } });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function fixture() {
  const ownerHomeRoot = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "setfarm-receipt-host-"));
  const workspaceRoot = path.join(ownerHomeRoot, "ai", "setrox");
  for (const directory of [workspaceRoot, path.join(workspaceRoot, "setfarm"),
    path.join(workspaceRoot, "mission-control"), path.join(ownerHomeRoot, "projects"),
    path.join(ownerHomeRoot, ".openclaw", "workspace", "agent-scratch"),
    path.join(ownerHomeRoot, ".openclaw", "workspaces", "workflows")]) {
    fs.mkdirSync(directory, { recursive: true });
  }
  const primary = path.join(ownerHomeRoot, "projects", "story");
  git(["init", "-q", primary]);
  git(["-C", primary, "config", "user.name", "Fixture"]);
  git(["-C", primary, "config", "user.email", "fixture@example.invalid"]);
  git(["-C", primary, "commit", "-q", "--allow-empty", "-m", "initial"]);
  const runtime = path.join(primary, ".worktrees", "story-1");
  fs.mkdirSync(path.dirname(runtime));
  git(["-C", primary, "worktree", "add", "-q", "-b", "runtime-1", runtime]);
  return { ownerHomeRoot, workspaceRoot, primary, runtime,
    close: () => fs.rmSync(ownerHomeRoot, { recursive: true, force: true }) };
}

async function fakeComposer(temporary: string) {
  const adapter = path.join(temporary, "fake-adapter.ts");
  fs.writeFileSync(adapter, `
    export async function observeDiagnosticPositiveWorktreeReceiptCandidateWithCodeOwnedDatabaseV1(url, root, ports) {
      globalThis.receiptProbe.calls++;
      globalThis.receiptProbe.url = url;
      const candidate = await ports.holdPhysical(async (physical, recheckPhysical) => {
        const before = await ports.observeSource();
        if (globalThis.receiptProbe.mutate) globalThis.receiptProbe.mutate();
        const after = await ports.observeSource();
        await recheckPhysical();
        globalThis.receiptProbe.physical = physical;
        globalThis.receiptProbe.before = before;
        globalThis.receiptProbe.after = after;
        if (globalThis.receiptProbe.secretFailure) throw Error('PRIVATE_PASSWORD_AND_FENCE');
        return Object.freeze({authority:'diagnostic-only',receiptStatus:'required-unpublished',
          physicalIdentityProvenance:'unverified',producerAuthentication:'unverified',
          receipt:Object.freeze({root,sourceSha:before.sourceSha,sourceTreeHash:before.sourceTreeHash})});
      });
      globalThis.receiptProbe.adapterReturned = true;
      return candidate;
    }
  `);
  const source = fs.readFileSync(sourceUrl, "utf8")
    .replace('from "./baseline-positive-worktree-physical-catalog-v2.js"',
      `from ${JSON.stringify(physicalUrl.href)}`)
    .replace('from "./baseline-positive-worktree-receipt-database-v1.js"',
      `from ${JSON.stringify(pathToFileURL(adapter).href)}`);
  assert.ok(source.includes(physicalUrl.href));
  assert.ok(source.includes(pathToFileURL(adapter).href));
  const copy = path.join(temporary, "composer.ts");
  fs.writeFileSync(copy, source);
  return import(pathToFileURL(copy).href) as Promise<typeof import("../../src/internal-production/baseline-positive-worktree-receipt-host-composer-v1.js")>;
}

test("receipt host composer imports without loading PostgreSQL or connecting", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import net from 'node:net';
    import { registerHooks, syncBuiltinESMExports } from 'node:module';
    let loads = 0, connections = 0;
    registerHooks({resolve(specifier, context, next) { if (specifier === 'postgres') loads++; return next(specifier, context); }});
    net.Socket.prototype.connect = () => { connections++; throw Error('UNEXPECTED_CONNECTION'); };
    syncBuiltinESMExports();
    const module = await import(${JSON.stringify(sourceUrl.href)});
    process.stdout.write(JSON.stringify({ exports:Object.keys(module), loads, connections }));
  `], { encoding: "utf8", timeout: 15000, env: {} });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    exports: ["observeScopedHeldDiagnosticPositiveWorktreeReceiptCandidateV1"], loads: 0, connections: 0,
  });
});

test("receipt host composer forwards an actual held runtime physical/source pair", async () => {
  const sample = fixture();
  const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "setfarm-receipt-adapter-"));
  try {
    const module = await fakeComposer(temporary);
    const probe: Record<string, unknown> = { calls: 0 };
    (globalThis as typeof globalThis & { receiptProbe: typeof probe }).receiptProbe = probe;
    const candidate = await module.observeScopedHeldDiagnosticPositiveWorktreeReceiptCandidateV1({
      ownerHomeRoot: sample.ownerHomeRoot, workspaceRoot: sample.workspaceRoot,
    }, "postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm", sample.runtime);
    assert.equal(probe.calls, 1);
    assert.equal(probe.url, "postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm");
    assert.equal(probe.adapterReturned, true);
    assert.deepEqual(probe.before, probe.after);
    assert.deepEqual(probe.physical, {
      root: sample.runtime, gitPrimaryRoot: sample.primary,
      dev: String(fs.lstatSync(sample.runtime, { bigint: true }).dev),
      ino: String(fs.lstatSync(sample.runtime, { bigint: true }).ino),
      birthtimeNs: String(fs.lstatSync(sample.runtime, { bigint: true }).birthtimeNs),
    });
    assert.equal(candidate.authority, "diagnostic-only");
    assert.equal(candidate.receiptStatus, "required-unpublished");
    assert.equal(candidate.physicalIdentityProvenance, "unverified");
    assert.equal(candidate.producerAuthentication, "unverified");
    assert.equal(candidate.receipt.sourceSha, git(["-C", sample.runtime, "rev-parse", "HEAD"]));
    assert.equal(candidate.receipt.sourceTreeHash, git(["-C", sample.runtime, "rev-parse", "HEAD^{tree}"]));
    assert.equal(JSON.stringify(candidate).includes("PRIVATE_PASSWORD"), false);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
    sample.close();
  }
});

test("receipt host composer refuses retained roots and private adapter failures", async () => {
  const sample = fixture();
  const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "setfarm-receipt-adapter-"));
  try {
    const module = await fakeComposer(temporary);
    const probe: Record<string, unknown> = { calls: 0 };
    (globalThis as typeof globalThis & { receiptProbe: typeof probe }).receiptProbe = probe;
    const scope = { ownerHomeRoot: sample.ownerHomeRoot, workspaceRoot: sample.workspaceRoot };
    await assert.rejects(module.observeScopedHeldDiagnosticPositiveWorktreeReceiptCandidateV1(
      scope, "postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm", sample.primary),
    /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_RECEIPT_HOST_COMPOSER_INVALID/);
    assert.equal(probe.calls, 0);
    await assert.rejects(module.observeScopedHeldDiagnosticPositiveWorktreeReceiptCandidateV1(
      scope, "postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm", `${sample.runtime}-missing`),
    /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_RECEIPT_HOST_COMPOSER_INVALID/);
    assert.equal(probe.calls, 0);
    probe.secretFailure = true;
    await assert.rejects(module.observeScopedHeldDiagnosticPositiveWorktreeReceiptCandidateV1(
      scope, "postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm", sample.runtime),
    (error: Error) => error.message === "INTERNAL_PRODUCTION_POSITIVE_WORKTREE_RECEIPT_HOST_COMPOSER_INVALID"
      && !String(error).includes("PRIVATE_PASSWORD_AND_FENCE"));
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
    sample.close();
  }
});

test("receipt host composer withholds an adapter candidate when the final catalog is unresolved", async () => {
  const sample = fixture();
  const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "setfarm-receipt-adapter-"));
  try {
    const module = await fakeComposer(temporary);
    const probe: Record<string, unknown> = { calls: 0 };
    (globalThis as typeof globalThis & { receiptProbe: typeof probe }).receiptProbe = probe;
    fs.mkdirSync(path.join(sample.workspaceRoot, ".worktrees", "unrelated-non-git"), { recursive: true });
    await assert.rejects(module.observeScopedHeldDiagnosticPositiveWorktreeReceiptCandidateV1({
      ownerHomeRoot: sample.ownerHomeRoot, workspaceRoot: sample.workspaceRoot,
    }, "postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm", sample.runtime),
    /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_RECEIPT_HOST_COMPOSER_INVALID/);
    assert.equal(probe.calls, 1);
    assert.equal(probe.adapterReturned, true);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
    sample.close();
  }
});

test("receipt host composer refuses branch drift during the nested adapter", async () => {
  const sample = fixture();
  const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "setfarm-receipt-adapter-"));
  try {
    const module = await fakeComposer(temporary);
    const probe: Record<string, unknown> = { calls: 0 };
    (globalThis as typeof globalThis & { receiptProbe: typeof probe }).receiptProbe = probe;
    const firstSha = git(["-C", sample.runtime, "rev-parse", "HEAD"]);
    git(["-C", sample.primary, "commit", "-q", "--allow-empty", "-m", "successor"]);
    const successorSha = git(["-C", sample.primary, "rev-parse", "HEAD"]);
    probe.mutate = () => git(["-C", sample.primary, "update-ref", "refs/heads/runtime-1", successorSha]);
    await assert.rejects(module.observeScopedHeldDiagnosticPositiveWorktreeReceiptCandidateV1({
      ownerHomeRoot: sample.ownerHomeRoot, workspaceRoot: sample.workspaceRoot,
    }, "postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm", sample.runtime),
    /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_RECEIPT_HOST_COMPOSER_INVALID/);
    assert.notEqual(git(["-C", sample.runtime, "rev-parse", "HEAD"]), firstSha);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
    sample.close();
  }
});

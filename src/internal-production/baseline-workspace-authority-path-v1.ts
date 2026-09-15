import { userInfo } from "node:os";
import { closeSync, constants, fstatSync, lstatSync, openSync } from "node:fs";
import type { BigIntStats } from "node:fs";
import path from "node:path";

const CODE_OWNER_HOME_V1 = userInfo().homedir;
const CODE_OWNED_WORKSPACE_ROOT_V1 = path.join(CODE_OWNER_HOME_V1, "ai", "setrox");
const pendingWorkspaceAcquisitionCleanupV1 = new Set<() => void>();

// Source/build identity belongs to the executing checkout. Runtime authority
// belongs to this single code-owned workspace, including from linked worktrees.
export function resolveInternalProductionBaselineWorkspaceRootV1(): string {
  return CODE_OWNED_WORKSPACE_ROOT_V1;
}

export function authenticateInternalProductionBaselineWorkspaceAnchorV1(): Readonly<{
  assertStable: () => void;
  close: () => void;
}> {
  if (pendingWorkspaceAcquisitionCleanupV1.size > 0) {
    for (const close of pendingWorkspaceAcquisitionCleanupV1) { try { close(); } catch { /* Retain every unfinished acquisition. */ } }
    throw new Error("INTERNAL_PRODUCTION_BASELINE_WORKSPACE_ANCESTOR_IDENTITY_INVALID");
  }
  // Darwin's system /var presentation is the same explicitly supported alias
  // as the existing receipt reader. No user-controlled symlink is canonicalized.
  const lexical = CODE_OWNED_WORKSPACE_ROOT_V1;
  const anchor = process.platform === "darwin" && lexical.startsWith("/var/")
    ? `/private${lexical}` : lexical;
  const root = path.parse(anchor).root;
  const segments = path.relative(root, anchor).split(path.sep);
  const paths = [root, ...segments.map((_, index) => path.join(root, ...segments.slice(0, index + 1)))];
  const held: Array<Readonly<{ path: string; descriptor: number; identity: BigIntStats }>> = [];
  let closed = false;
  let closing = false;
  const fail = (): never => { throw new Error("INTERNAL_PRODUCTION_BASELINE_WORKSPACE_ANCESTOR_IDENTITY_INVALID"); };
  const same = (left: BigIntStats, right: BigIntStats): boolean => left.isDirectory() && !left.isSymbolicLink()
    && right.isDirectory() && !right.isSymbolicLink() && left.dev === right.dev && left.ino === right.ino
    && left.mode === right.mode && left.uid === right.uid;
  const close = (): void => {
    if (closed) return;
    closing = true;
    while (held.length > 0) {
      closeSync(held[held.length - 1]!.descriptor);
      held.pop();
    }
    closed = true;
    pendingWorkspaceAcquisitionCleanupV1.delete(close);
  };
  const assertStable = (): void => {
    if (closed || closing) fail();
    for (const entry of held) {
      if (!same(entry.identity, fstatSync(entry.descriptor, { bigint: true }))
        || !same(entry.identity, lstatSync(entry.path, { bigint: true }))) fail();
    }
  };
  try {
    for (const current of paths) {
      const before = lstatSync(current, { bigint: true });
      if (!before.isDirectory() || before.isSymbolicLink()) fail();
      const descriptor = openSync(current, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      held.push({ path: current, descriptor, identity: before });
      if (!same(before, fstatSync(descriptor, { bigint: true }))) fail();
    }
    const currentUid = process.getuid?.();
    if (currentUid === undefined || held.at(-1)!.identity.uid !== BigInt(currentUid)) fail();
    assertStable();
    return Object.freeze({ assertStable, close });
  } catch (error) {
    try { close(); }
    catch {
      pendingWorkspaceAcquisitionCleanupV1.add(close);
      try { close(); } catch { /* Failed acquisition never abandons its cleanup owner. */ }
    }
    throw error;
  }
}

export function resolveInternalProductionBaselineAuthorityPathV1(...segments: string[]): string {
  const relative = segments.join("/");
  if (
    segments.length === 0
    || path.isAbsolute(relative)
    || relative.includes("\\")
    || path.posix.normalize(relative) !== relative
    || !relative.startsWith("data/internal-production-baseline/")
    || relative.split("/").some((segment) => !/^[A-Za-z0-9._-]+$/.test(segment) || segment === "." || segment === "..")
  ) throw new Error("INTERNAL_PRODUCTION_BASELINE_WORKSPACE_LOCATOR_INVALID");
  return path.join(CODE_OWNED_WORKSPACE_ROOT_V1, relative);
}

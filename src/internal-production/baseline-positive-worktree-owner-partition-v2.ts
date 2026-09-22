import path from "node:path";
import { types } from "node:util";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";

// Diagnostic projection only. This module does not read host state or grant cutover authority.
const SCHEMA = "setfarm.internal-production-positive-worktree-owner-partition.v2";
const IDENTITY_SCHEMA = "setfarm.internal-production-positive-worktree-identity.v2";
const PHYSICAL_KEYS = ["root", "namespace", "kind", "dev", "ino", "birthtimeNs", "gitPrimaryRoot", "dirty", "referencingPids"] as const;
const OWNER_KEYS = ["ownerKey", "worktreeRoot", "physicalIdentityHash"] as const;
const MAX_ENTRIES = 256;

export type PositivePhysicalWorktreeV2 = Readonly<{
  root: string;
  namespace: "retained-code" | "runtime";
  kind: "git-worktree" | "artifact";
  dev: string;
  ino: string;
  birthtimeNs: string;
  gitPrimaryRoot: string | null;
  dirty: boolean;
  referencingPids: readonly number[];
}>;

export type PositiveWorktreeOwnerV2 = Readonly<{
  ownerKey: string;
  worktreeRoot: string | null;
  physicalIdentityHash: string | null;
}>;

function fail(): never {
  throw new Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PARTITION_INVALID");
}

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Reflect.ownKeys(descriptors);
  if (actual.length !== keys.length || actual.some((key) => typeof key !== "string" || !keys.includes(key)
    || !descriptors[key]!.enumerable || !("value" in descriptors[key]!))) fail();
  return Object.fromEntries(keys.map((key) => [key, descriptors[key]!.value as unknown]));
}

function array(value: unknown): readonly unknown[] {
  if (types.isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
    || value.length > MAX_ENTRIES) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Reflect.ownKeys(descriptors);
  if (actual.length !== value.length + 1 || actual.some((key) => {
    if (key === "length") return false;
    if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) return true;
    return !descriptors[key]!.enumerable || !("value" in descriptors[key]!);
  })) fail();
  return Array.from({ length: value.length }, (_, index) => descriptors[String(index)]!.value as unknown);
}

function absolutePath(value: unknown): string {
  if (typeof value !== "string" || value === "/" || Buffer.byteLength(value) > 1024
    || !path.posix.isAbsolute(value) || path.posix.normalize(value) !== value
    || value.split("/").slice(1).some((segment) => !/^[A-Za-z0-9._-]+$/.test(segment) || segment === "." || segment === "..")) fail();
  return value;
}

function decimal(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,19}$/.test(value)) fail();
  return value;
}

function sha256(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) fail();
  return value;
}

function sortedUniqueStrings(value: unknown, parse: (item: unknown) => string): readonly string[] {
  const values = array(value).map(parse);
  if (values.some((item, index) => index > 0 && values[index - 1]! >= item)) fail();
  return Object.freeze(values);
}

function physical(value: unknown): PositivePhysicalWorktreeV2 {
  const record = exact(value, PHYSICAL_KEYS);
  const root = absolutePath(record.root);
  const namespace = record.namespace;
  const kind = record.kind;
  if (namespace !== "retained-code" && namespace !== "runtime") fail();
  if (kind !== "git-worktree" && kind !== "artifact") fail();
  const gitPrimaryRoot = record.gitPrimaryRoot === null ? null : absolutePath(record.gitPrimaryRoot);
  if ((kind === "git-worktree") !== (gitPrimaryRoot !== null)) fail();
  if (typeof record.dirty !== "boolean") fail();
  const referencingPids = array(record.referencingPids).map((pid) => {
    if (!Number.isSafeInteger(pid) || (pid as number) <= 0) fail();
    return pid as number;
  });
  if (referencingPids.some((pid, index) => index > 0 && referencingPids[index - 1]! >= pid)) fail();
  return Object.freeze({ root, namespace, kind, dev: decimal(record.dev), ino: decimal(record.ino),
    birthtimeNs: decimal(record.birthtimeNs), gitPrimaryRoot, dirty: record.dirty,
    referencingPids: Object.freeze(referencingPids) });
}

function physicalList(value: unknown): readonly PositivePhysicalWorktreeV2[] {
  const entries = array(value).map(physical);
  if (entries.some((entry, index) => index > 0 && entries[index - 1]!.root >= entry.root)) fail();
  const identities = new Set(entries.map((entry) => `${entry.dev}:${entry.ino}:${entry.birthtimeNs}`));
  if (identities.size !== entries.length) fail();
  return Object.freeze(entries);
}

function owner(value: unknown): PositiveWorktreeOwnerV2 {
  const record = exact(value, OWNER_KEYS);
  const ownerKey = record.ownerKey;
  if (typeof ownerKey !== "string" || !/^[A-Za-z0-9._:-]{1,256}$/.test(ownerKey)) fail();
  const worktreeRoot = record.worktreeRoot === null ? null : absolutePath(record.worktreeRoot);
  const physicalIdentityHash = record.physicalIdentityHash === null ? null : sha256(record.physicalIdentityHash);
  if ((worktreeRoot === null) !== (physicalIdentityHash === null)) fail();
  return Object.freeze({ ownerKey, worktreeRoot, physicalIdentityHash });
}

function ownerList(value: unknown): readonly PositiveWorktreeOwnerV2[] {
  const entries = array(value).map(owner);
  if (entries.some((entry, index) => index > 0 && entries[index - 1]!.ownerKey >= entry.ownerKey)) fail();
  return Object.freeze(entries);
}

export function createPositiveWorktreeIdentityHashV2(value: unknown): string {
  const entry = physical(value);
  return hashCanonicalJson({ schema: IDENTITY_SCHEMA, root: entry.root, dev: entry.dev, ino: entry.ino,
    birthtimeNs: entry.birthtimeNs, gitPrimaryRoot: entry.gitPrimaryRoot });
}

export function projectPositiveWorktreeOwnersV2(value: unknown) {
  const input = exact(value, ["physicalBefore", "physicalAfter", "retainedGitPrimaries", "database"]);
  const physicalBefore = physicalList(input.physicalBefore);
  const physicalAfter = physicalList(input.physicalAfter);
  const retainedGitPrimaries = sortedUniqueStrings(input.retainedGitPrimaries, absolutePath);
  const database = exact(input.database, ["snapshotHash", "activeOwners"]);
  const databaseSnapshotHash = sha256(database.snapshotHash);
  const activeOwners = ownerList(database.activeOwners);

  if (hashCanonicalJson(physicalBefore) !== hashCanonicalJson(physicalAfter)) fail();
  const ownersByRoot = new Map<string, PositiveWorktreeOwnerV2>();
  let primaryProjectOwnerCount = 0;
  for (const activeOwner of activeOwners) {
    if (activeOwner.worktreeRoot === null) {
      primaryProjectOwnerCount += 1;
    } else {
      if (ownersByRoot.has(activeOwner.worktreeRoot)) fail();
      ownersByRoot.set(activeOwner.worktreeRoot, activeOwner);
    }
  }
  const inventory = physicalBefore.map((entry) => {
    const ownerForRoot = ownersByRoot.get(entry.root);
    let classification: "retained-code" | "retained-artifact" | "bound-execution";
    if (entry.namespace === "retained-code") {
      if (ownerForRoot || entry.referencingPids.length > 0) fail();
      if (entry.kind === "git-worktree") {
        if (!retainedGitPrimaries.includes(entry.gitPrimaryRoot!)) fail();
        classification = "retained-code";
      } else {
        classification = "retained-artifact";
      }
    } else {
      if (entry.kind !== "git-worktree" || !ownerForRoot || retainedGitPrimaries.includes(entry.gitPrimaryRoot!)) fail();
      if (ownerForRoot.physicalIdentityHash !== createPositiveWorktreeIdentityHashV2(entry)) fail();
      classification = "bound-execution";
      ownersByRoot.delete(entry.root);
    }
    return Object.freeze({ ...entry, classification });
  });
  if (ownersByRoot.size !== 0) fail();
  const ownedWorktreeCount = inventory.filter((entry) => entry.classification === "bound-execution").length;
  const dirtyOwnedWorktreeCount = inventory.filter((entry) => entry.classification === "bound-execution" && entry.dirty).length;
  const state = ownedWorktreeCount === 0 && primaryProjectOwnerCount === 0 ? "zero-candidate" : "occupied";
  const body = { schema: SCHEMA, state, inventory: Object.freeze(inventory), ownedWorktreeCount,
    dirtyOwnedWorktreeCount, primaryProjectOwnerCount, physicalWitnessHash: hashCanonicalJson(physicalBefore),
    databaseSnapshotHash, activeOwnerSetHash: hashCanonicalJson(activeOwners),
    retainedGitPrimariesHash: hashCanonicalJson(retainedGitPrimaries) } as const;
  return Object.freeze({ ...body, projectionHash: hashCanonicalJson(body) });
}

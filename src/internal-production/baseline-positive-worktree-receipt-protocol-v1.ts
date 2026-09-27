import { types } from "node:util";

import { derivePositiveWorktreeBindingReceiptCandidateV1 } from "./baseline-positive-worktree-binding-contract-v1.js";

// A diagnostic port protocol only. No supplied observer authenticates itself,
// and this module neither publishes a receipt nor grants worktree ownership.
type SourceObservationV1 = Readonly<{
  root: string;
  gitPrimaryRoot: string;
  sourceSha: string;
  sourceTreeHash: string;
}>;

type PortsV1 = Readonly<{
  holdPhysical: <T>(withinHold: (physical: unknown,
    recheckPhysical: () => Promise<unknown>) => Promise<T>) => Promise<T>;
  withReadOnlyDatabaseSnapshot: <T>(withinTransaction: (snapshot: unknown) => Promise<T>) => Promise<T>;
  observeSource: () => Promise<unknown>;
}>;

function fail(): never {
  throw new Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_RECEIPT_PROTOCOL_INVALID");
}

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || types.isProxy(value)
    || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const fields = Object.getOwnPropertyDescriptors(value);
  const actual = Reflect.ownKeys(fields);
  if (actual.length !== keys.length || actual.some((key) => typeof key !== "string"
    || !keys.includes(key) || !fields[key]!.enumerable || !("value" in fields[key]!))) fail();
  return Object.fromEntries(keys.map((key) => [key, fields[key]!.value as unknown]));
}

function source(value: unknown): SourceObservationV1 {
  const row = exact(value, ["root", "gitPrimaryRoot", "sourceSha", "sourceTreeHash"]);
  if (Object.values(row).some((member) => typeof member !== "string")) fail();
  return Object.freeze(row as SourceObservationV1);
}

function onlyRow(value: unknown): unknown {
  if (!Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype
    || value.length !== 1 || !Object.hasOwn(value, 0) || Reflect.ownKeys(value).length !== 2) fail();
  return value[0];
}

function sameSource(value: SourceObservationV1, receipt: Readonly<{
  root: string; sourceSha: string; sourceTreeHash: string;
}>, gitPrimaryRoot: string): void {
  if (value.root !== receipt.root || value.gitPrimaryRoot !== gitPrimaryRoot
    || value.sourceSha !== receipt.sourceSha || value.sourceTreeHash !== receipt.sourceTreeHash) fail();
}

/**
 * Coordinates injected held/read-only observers and returns only a canonical,
 * unpublished candidate. The caller must separately authenticate the physical
 * observer and transaction; this function cannot establish producer authority.
 */
export async function observeHeldDiagnosticPositiveWorktreeReceiptCandidateV1(ports: PortsV1) {
  if (ports === null || typeof ports !== "object" || types.isProxy(ports)
    || typeof ports.holdPhysical !== "function"
    || typeof ports.withReadOnlyDatabaseSnapshot !== "function"
    || typeof ports.observeSource !== "function") fail();
  let holdCalls = 0;
  let databaseCalls = 0;
  let produced: ReturnType<typeof derivePositiveWorktreeBindingReceiptCandidateV1> | null = null;
  const returned = await ports.holdPhysical(async (physical, recheckPhysical) => {
    holdCalls += 1;
    if (holdCalls !== 1 || typeof recheckPhysical !== "function") fail();
    const initialPhysical = exact(physical, ["root", "dev", "ino", "birthtimeNs", "gitPrimaryRoot"]);
    const before = source(await ports.observeSource());
    const inside = await ports.withReadOnlyDatabaseSnapshot(async (snapshot) => {
      databaseCalls += 1;
      if (databaseCalls !== 1) fail();
      const rows = exact(snapshot, ["attempts", "sessions"]);
      const attempt = onlyRow(rows.attempts);
      const session = onlyRow(rows.sessions);
      const candidate = derivePositiveWorktreeBindingReceiptCandidateV1({ attempt, session, physical });
      sameSource(before, candidate.receipt, initialPhysical.gitPrimaryRoot as string);
      const after = source(await ports.observeSource());
      sameSource(after, candidate.receipt, initialPhysical.gitPrimaryRoot as string);
      if (Object.keys(before).some((key) => before[key as keyof SourceObservationV1]
        !== after[key as keyof SourceObservationV1])) fail();
      const finalPhysical = exact(await recheckPhysical(),
        ["root", "dev", "ino", "birthtimeNs", "gitPrimaryRoot"]);
      if (Object.keys(initialPhysical).some((key) => initialPhysical[key] !== finalPhysical[key])) fail();
      produced = candidate;
      return candidate;
    });
    if (databaseCalls !== 1 || inside !== produced) fail();
    return inside;
  });
  if (holdCalls !== 1 || databaseCalls !== 1 || produced === null || returned !== produced) fail();
  return produced;
}

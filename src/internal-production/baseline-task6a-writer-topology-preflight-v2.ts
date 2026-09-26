import { types } from "node:util";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";

const INPUT_SCHEMA = "setfarm.internal-production-task6a-writer-topology-input.v2";
const OUTPUT_SCHEMA = "setfarm.internal-production-task6a-writer-topology-preflight.v2";
const LABELS = [
  "com.setrox.setfarm-spawner",
  "com.setrox.setfarm-dashboard",
  "com.setrox.mission-control",
] as const;
const INPUT_KEYS = ["schema", "databaseName", "databaseOwnerRole", "controllerRole", "runtimeRole", "launcherRoles"] as const;
const RUNTIME_KEYS = ["name", "login", "superuser", "bypassRls", "createRole", "createDatabase", "activeSessionCount"] as const;
const LAUNCHER_KEYS = ["label", "role"] as const;

function fail(): never {
  throw new Error("INTERNAL_PRODUCTION_TASK6A_WRITER_TOPOLOGY_INVALID");
}

function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || types.isProxy(value)
    || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Reflect.ownKeys(descriptors);
  if (actual.length !== keys.length || actual.some(key => typeof key !== "string" || !keys.includes(key)
    || !descriptors[key]!.enumerable || !("value" in descriptors[key]!))) fail();
  return Object.fromEntries(keys.map(key => [key, descriptors[key]!.value as unknown]));
}

function array(value: unknown): readonly unknown[] {
  if (types.isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
    || value.length !== LABELS.length) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Reflect.ownKeys(descriptors);
  if (actual.length !== LABELS.length + 1 || actual.some(key => {
    if (key === "length") return false;
    if (typeof key !== "string" || !/^[0-2]$/.test(key)) return true;
    return !descriptors[key]!.enumerable || !("value" in descriptors[key]!);
  })) fail();
  return LABELS.map((_, index) => descriptors[String(index)]!.value as unknown);
}

function roleName(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z][a-z0-9_]{0,62}$/.test(value)) fail();
  return value;
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") fail();
  return value;
}

export function projectTask6aWriterTopologyPreflightV2(input: unknown) {
  const value = record(input, INPUT_KEYS);
  if (value.schema !== INPUT_SCHEMA || value.databaseName !== "setfarm") fail();
  const databaseOwnerRole = roleName(value.databaseOwnerRole);
  const controllerRole = roleName(value.controllerRole);
  const rawRuntime = record(value.runtimeRole, RUNTIME_KEYS);
  const activeSessionCount = rawRuntime.activeSessionCount;
  if (!Number.isSafeInteger(activeSessionCount) || (activeSessionCount as number) < 0) fail();
  const runtimeRole = Object.freeze({
    name: roleName(rawRuntime.name),
    login: boolean(rawRuntime.login),
    superuser: boolean(rawRuntime.superuser),
    bypassRls: boolean(rawRuntime.bypassRls),
    createRole: boolean(rawRuntime.createRole),
    createDatabase: boolean(rawRuntime.createDatabase),
    activeSessionCount: activeSessionCount as number,
  });
  const launcherRoles = Object.freeze(array(value.launcherRoles).map((item, index) => {
    const launcher = record(item, LAUNCHER_KEYS);
    if (launcher.label !== LABELS[index]) fail();
    return Object.freeze({ label: LABELS[index]!, role: roleName(launcher.role) });
  }));
  const normalized = Object.freeze({ schema: INPUT_SCHEMA, databaseName: "setfarm" as const,
    databaseOwnerRole, controllerRole, runtimeRole, launcherRoles });

  const blockers: string[] = [];
  if (launcherRoles.some(launcher => launcher.role !== runtimeRole.name)) blockers.push("launcher-role-mismatch");
  if (runtimeRole.bypassRls) blockers.push("runtime-bypass-rls");
  if (runtimeRole.createDatabase) blockers.push("runtime-can-create-database");
  if (runtimeRole.createRole) blockers.push("runtime-can-create-role");
  if (runtimeRole.name === databaseOwnerRole) blockers.push("runtime-database-owner");
  if (runtimeRole.name === controllerRole) blockers.push("runtime-matches-controller");
  if (!runtimeRole.login) blockers.push("runtime-no-login");
  if (runtimeRole.activeSessionCount > 0) blockers.push("runtime-session-present");
  if (runtimeRole.superuser) blockers.push("runtime-superuser");
  blockers.sort();
  const body = Object.freeze({
    schema: OUTPUT_SCHEMA,
    authority: "diagnostic-only" as const,
    evidenceProvenance: "caller-supplied" as const,
    cutoverAdmission: "not-granted" as const,
    status: blockers.length ? "blocked" as const : "unverified" as const,
    blockers: Object.freeze(blockers),
    sourceSnapshotHash: hashCanonicalJson(normalized),
  });
  return Object.freeze({ ...body, topologyHash: hashCanonicalJson(body) });
}

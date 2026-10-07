import { types } from "node:util";
import type postgres from "postgres";
import type { RunInfo, StepInfo } from "../installer/status.js";
import { isSetfarmOperationalActiveRunStatusV1 } from "../contracts/operational-active-run-status-v1.js";
import { projectDashboardRunForApi, projectDashboardObservationForApiV2 } from "../server/dashboard-core-projection-v2.js";
import { DASHBOARD_CORE_COLUMN_MANIFEST_V2 as manifest } from "./dashboard-core-readonly-profile-v2.js";

// Internal data operation only: no acquisition, qualification or publication authority.
export type CopiedDashboardCoreRequestV2 = Readonly<
  | { kind: "runs"; workflowId?: string; includeTerminal: boolean }
  | { kind: "run"; id: string }
  | { kind: "stories"; id: string }
  | { kind: "observations"; id: string }
  | { kind: "rules" }
>;
type Code = "DASHBOARD_CORE_REQUEST_REFUSED" | "DASHBOARD_CORE_RESPONSE_CAPACITY_REFUSED"
  | "DASHBOARD_CORE_ROWS_REFUSED" | "DASHBOARD_CORE_QUERY_REFUSED";
type Failure = Readonly<{ code: Code; disposition: "operation-refusal" | "sticky-refusal" }>;
const failures = new WeakMap<object, Failure>();
function refuse(code: Code): never {
  const error = new Error(code);
  failures.set(error, Object.freeze({ code, disposition: code === "DASHBOARD_CORE_REQUEST_REFUSED"
    || code === "DASHBOARD_CORE_RESPONSE_CAPACITY_REFUSED" ? "operation-refusal" : "sticky-refusal" }));
  throw error;
}
export function classifyDashboardCoreResponseFailureV2(error: unknown): Failure | null {
  return error !== null && typeof error === "object" && !types.isProxy(error) ? failures.get(error) ?? null : null;
}
function record(value: unknown, code: Code): Record<string, unknown> {
  if (value === null || typeof value !== "object" || types.isProxy(value)) refuse(code);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) refuse(code);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const copy: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string") refuse(code);
    const descriptor = descriptors[key]!;
    if (!Object.hasOwn(descriptor, "value") || !descriptor.enumerable) refuse(code);
    copy[key] = descriptor.value;
  }
  return copy;
}
function text(value: unknown, code: Code, maximum = Infinity, nonempty = false): string {
  if (typeof value !== "string" || (nonempty && !value) || value.includes("\0")
    || Buffer.byteLength(value, "utf8") > maximum || Buffer.from(value, "utf8").toString("utf8") !== value) refuse(code);
  return value;
}
export function copyDashboardCoreRequestV2(value: unknown): CopiedDashboardCoreRequestV2 {
  const code = "DASHBOARD_CORE_REQUEST_REFUSED", source = record(value, code);
  const kind = source.kind;
  const keys = kind === "runs" ? ["kind", "workflowId", "includeTerminal"]
    : kind === "rules" ? ["kind"] : ["kind", "id"];
  if (Object.keys(source).some(key => !keys.includes(key))) refuse(code);
  if (kind === "rules") return Object.freeze({ kind });
  if (kind === "runs") {
    if (Object.hasOwn(source, "includeTerminal") && typeof source.includeTerminal !== "boolean") refuse(code);
    const result = { kind, includeTerminal: source.includeTerminal ?? false } as { kind: "runs"; includeTerminal: boolean; workflowId?: string };
    if (Object.hasOwn(source, "workflowId")) result.workflowId = text(source.workflowId, code, 1024, true);
    return Object.freeze(result);
  }
  if (kind !== "run" && kind !== "stories" && kind !== "observations") refuse(code);
  return Object.freeze({ kind, id: text(source.id, code, 1024, true) });
}
const dateTime = Date.prototype.getTime, dateIso = Date.prototype.toISOString;
type Table = keyof typeof manifest;
type Row = Record<string, string | number | boolean | null>;
function sourceRow(value: unknown, table: Table): Row {
  const code = "DASHBOARD_CORE_ROWS_REFUSED", source = record(value, code), fields = manifest[table];
  if (Object.keys(source).length !== fields.length) refuse(code);
  const copy: Row = {};
  for (const field of fields) {
    if (!Object.hasOwn(source, field.name)) refuse(code);
    const value = source[field.name];
    let copied: Row[string];
    if (value === null && !field.notNull) copied = null;
    else if (field.type === "text") copied = text(value, code);
    else if (field.type === "int4") {
      if (typeof value !== "number" || !Number.isInteger(value) || value < -2147483648 || value > 2147483647) refuse(code);
      copied = value;
    } else if (field.type === "bool") {
      if (typeof value !== "boolean") refuse(code);
      copied = value;
    } else {
      if (value === null || typeof value !== "object" || types.isProxy(value)
        || Object.getPrototypeOf(value) !== Date.prototype || Reflect.ownKeys(value).length !== 0) refuse(code);
      try {
        if (!Number.isFinite(dateTime.call(value))) refuse(code);
        copied = dateIso.call(value);
      } catch { refuse(code); }
    }
    Object.defineProperty(copy, field.name, { value: copied, enumerable: true });
  }
  return Object.freeze(copy);
}
function resultArray(value: unknown, maximum: number): unknown[] {
  const code = "DASHBOARD_CORE_ROWS_REFUSED";
  if (value === null || typeof value !== "object" || types.isProxy(value) || !Array.isArray(value)) refuse(code);
  const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) refuse(code);
  const descriptors = Object.getOwnPropertyDescriptors(value), copy: unknown[] = [];
  let indexCount = 0;
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string") refuse(code);
    if (key === "length") continue;
    const descriptor = descriptors[key]!;
    if (/^(?:0|[1-9][0-9]*)$/.test(key) && Number(key) < length) {
      if (!Object.hasOwn(descriptor, "value") || !descriptor.enumerable) refuse(code);
      indexCount++;
    } else if (descriptor.enumerable) refuse(code);
  }
  // Outer malformed batches are sticky even when their declared count overflows.
  if (indexCount !== length) refuse(code);
  if (length > maximum) refuse("DASHBOARD_CORE_RESPONSE_CAPACITY_REFUSED");
  for (let index = 0; index < length; index++) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) refuse(code);
    copy.push(descriptor.value);
  }
  return copy;
}
function inert(value: unknown, depth = 0): unknown {
  if (depth > 64) refuse("DASHBOARD_CORE_RESPONSE_CAPACITY_REFUSED");
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return Object.freeze(value.map(item => inert(item, depth + 1)));
  const copied = {};
  for (const [key, item] of Object.entries(value)) Object.defineProperty(copied, key,
    { value: inert(item, depth + 1), enumerable: true });
  return Object.freeze(copied);
}
const OBSERVATIONS_SQL = `SELECT id, run_id, step_id, story_id, agent_id, phase, check_id, label, status,
       summary, detail, evidence, file_paths, github, metadata, event_type,
       started_at, completed_at, created_at, updated_at
FROM public.run_observations
WHERE run_id = $1
ORDER BY created_at DESC
LIMIT 250`;

export async function readDashboardCoreResponseInTransactionV2(
  originalTransaction: Pick<postgres.TransactionSql, "unsafe">, input: unknown,
): Promise<unknown> {
  const request = copyDashboardCoreRequestV2(input);
  let total = 0;
  const seen = new Map<Table, Set<unknown>>();
  async function rows(table: Table, sql: string, parameters: string[], cap: number): Promise<Row[]> {
    const expectedRunId = parameters[0];
    let pending: unknown, result: unknown;
    try { pending = originalTransaction.unsafe(sql, [...parameters]); }
    catch { refuse("DASHBOARD_CORE_QUERY_REFUSED"); }
    if (pending !== null && (typeof pending === "object" || typeof pending === "function")
      && types.isProxy(pending)) refuse("DASHBOARD_CORE_ROWS_REFUSED");
    try { result = await pending; }
    catch { refuse("DASHBOARD_CORE_QUERY_REFUSED"); }
    const values = resultArray(result, cap);
    total += values.length;
    if (total > 4096) refuse("DASHBOARD_CORE_RESPONSE_CAPACITY_REFUSED");
    const identities = seen.get(table) ?? new Set<unknown>(); seen.set(table, identities);
    return values.map(value => {
      const row = sourceRow(value, table);
      if (identities.has(row.id)) refuse("DASHBOARD_CORE_ROWS_REFUSED");
      identities.add(row.id);
      if (table !== "runs" && table !== "rules" && row.run_id !== (request.kind === "run"
        || request.kind === "stories" || request.kind === "observations" ? request.id : expectedRunId)) refuse("DASHBOARD_CORE_ROWS_REFUSED");
      return row;
    });
  }
  let output: unknown;
  if (request.kind === "runs" || request.kind === "run") {
    const detail = request.kind === "run";
    const fetched = await rows("runs", detail ? "SELECT * FROM public.runs WHERE id = $1"
      : request.workflowId !== undefined ? "SELECT * FROM public.runs WHERE workflow_id = $1 ORDER BY created_at DESC"
        : "SELECT * FROM public.runs ORDER BY created_at DESC", detail ? [request.id]
          : request.workflowId !== undefined ? [request.workflowId] : [], 256);
    if (detail && (fetched.length > 1 || fetched.some(row => row.id !== request.id))) refuse("DASHBOARD_CORE_ROWS_REFUSED");
    if (!detail && request.workflowId !== undefined && fetched.some(row => row.workflow_id !== request.workflowId)) refuse("DASHBOARD_CORE_ROWS_REFUSED");
    const projected: unknown[] = [];
    for (const run of fetched) {
      if (!detail && !request.includeTerminal && !isSetfarmOperationalActiveRunStatusV1(run.status)) continue;
      const steps = await rows("steps", "SELECT * FROM public.steps WHERE run_id = $1 ORDER BY step_index ASC", [run.id as string], 1024);
      if (detail) projected.push({ ...run, steps });
      // Legacy TypeScript protocol unions are not a runtime PostgreSQL TEXT enum.
      else projected.push(projectDashboardRunForApi({ ...run, steps } as unknown as RunInfo & { steps: StepInfo[] }, { includeTerminal: request.includeTerminal }));
    }
    output = detail ? projected[0] ?? null : projected;
  } else if (request.kind === "rules") {
    output = await rows("rules", "SELECT * FROM public.rules ORDER BY sort_order ASC, created_at ASC", [], 4096);
  } else if (request.kind === "stories") {
    output = await rows("stories", "SELECT * FROM public.stories WHERE run_id = $1 ORDER BY story_index ASC", [request.id], 4096);
  } else {
    output = (await rows("run_observations", OBSERVATIONS_SQL, [request.id], 250))
      .map(row => projectDashboardObservationForApiV2(row as Parameters<typeof projectDashboardObservationForApiV2>[0]));
  }
  const copied = inert(output);
  if (Buffer.byteLength(JSON.stringify(copied), "utf8") > 4 * 1024 * 1024) refuse("DASHBOARD_CORE_RESPONSE_CAPACITY_REFUSED");
  return copied;
}

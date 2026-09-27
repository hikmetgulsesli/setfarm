import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import type postgres from "postgres";

import { canonicalJsonStringify } from "../product-compiler/canonical-json.js";

// Private post-33 fixture only. This does not create a worktree, fence a
// writer, authenticate a producer, register a migration, or grant admission.
// The exact target check is only a sample; a live creator needs continuous
// DB/OS exclusion and a separately reviewed no-replace physical operation.
const TABLE = "public.internal_production_positive_worktree_precreate_reservations_v1";
const REFUSED = "TASK6A_PRIVATE_PRECREATE_RESERVATION_REFUSED";
const SCHEMA = "setfarm.internal-production-positive-worktree-private-precreate-reservation.v1";
const fail = (): never => { throw new Error(REFUSED); };

export const PRIVATE_POSITIVE_WORKTREE_PRECREATE_RESERVATION_V1_STATEMENTS = Object.freeze([
  `CREATE UNIQUE INDEX task6a_private_precreate_story_identity_v1
    ON public.stories(id, run_id, story_id)`,
  `CREATE TABLE ${TABLE} (
    reservation_hash text PRIMARY KEY CHECK (reservation_hash ~ '^[a-f0-9]{64}$'),
    run_id text NOT NULL REFERENCES public.runs(id) ON DELETE RESTRICT,
    story_db_id text NOT NULL UNIQUE,
    story_id text NOT NULL,
    dispatch_key text NOT NULL,
    owner_instance_id text NOT NULL,
    root text NOT NULL UNIQUE,
    source_sha text NOT NULL CHECK (source_sha ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    source_tree_hash text NOT NULL CHECK (source_tree_hash ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    canonical_body text NOT NULL CHECK (octet_length(canonical_body) BETWEEN 1 AND 4096),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT task6a_private_precreate_dispatch_v1 UNIQUE (run_id, story_db_id, dispatch_key),
    CONSTRAINT task6a_private_precreate_logical_story_v1 UNIQUE (run_id, story_id),
    CONSTRAINT task6a_private_precreate_story_identity_v1
      FOREIGN KEY (story_db_id, run_id, story_id)
      REFERENCES public.stories(id, run_id, story_id)
      ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT task6a_private_precreate_body_hash_v1
      CHECK (reservation_hash = encode(pg_catalog.sha256(pg_catalog.convert_to(canonical_body, 'UTF8')), 'hex'))
  )`,
  `CREATE FUNCTION public.task6a_private_precreate_immutable_v1() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'TASK6A_PRIVATE_PRECREATE_RESERVATION_IMMUTABLE' USING ERRCODE = '42501';
    END $$`,
  `CREATE TRIGGER task6a_private_precreate_no_replace_v1 BEFORE UPDATE OR DELETE ON ${TABLE}
    FOR EACH ROW EXECUTE FUNCTION public.task6a_private_precreate_immutable_v1()`,
  `CREATE TRIGGER task6a_private_precreate_no_truncate_v1 BEFORE TRUNCATE ON ${TABLE}
    FOR EACH STATEMENT EXECUTE FUNCTION public.task6a_private_precreate_immutable_v1()`,
] as const);

type ReservationBody = Readonly<{
  schema: typeof SCHEMA;
  runId: string;
  storyDbId: string;
  storyId: string;
  dispatchKey: string;
  ownerInstanceId: string;
  root: string;
  sourceSha: string;
  sourceTreeHash: string;
}>;

type ReservationRow = Readonly<{
  reservationHash: string;
  runId: string;
  storyDbId: string;
  storyId: string;
  dispatchKey: string;
  ownerInstanceId: string;
  root: string;
  sourceSha: string;
  sourceTreeHash: string;
  canonicalBody: string;
}>;

const INPUT_KEYS = Object.freeze(["runId", "storyDbId", "storyId", "dispatchKey",
  "ownerInstanceId", "root", "sourceSha", "sourceTreeHash"] as const);

function boundedIdentity(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 256
    || value.trim() !== value || value.includes("\0")) return fail();
  return value;
}

function project(input: unknown): { body: ReservationBody; canonicalBody: string;
  reservationHash: string } {
  if (input === null || typeof input !== "object"
    || Object.getPrototypeOf(input) !== Object.prototype) return fail();
  const keys = Reflect.ownKeys(input);
  if (keys.length !== INPUT_KEYS.length
    || keys.some((key) => typeof key !== "string" || !INPUT_KEYS.includes(key as typeof INPUT_KEYS[number]))) fail();
  const field = (key: typeof INPUT_KEYS[number]): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return fail();
    return descriptor.value;
  };
  const root = boundedIdentity(field("root"));
  if (!path.isAbsolute(root) || root === path.parse(root).root
    || path.normalize(root) !== root || root.endsWith(path.sep)) fail();
  const sourceShaValue = field("sourceSha"), sourceTreeHashValue = field("sourceTreeHash");
  const sourceSha = typeof sourceShaValue === "string" ? sourceShaValue : fail();
  const sourceTreeHash = typeof sourceTreeHashValue === "string" ? sourceTreeHashValue : fail();
  if (!/^([a-f0-9]{40}|[a-f0-9]{64})$/.test(sourceSha)
    || !/^([a-f0-9]{40}|[a-f0-9]{64})$/.test(sourceTreeHash)
    || sourceSha.length !== sourceTreeHash.length) fail();
  const body: ReservationBody = Object.freeze({ schema: SCHEMA,
    runId: boundedIdentity(field("runId")),
    storyDbId: boundedIdentity(field("storyDbId")),
    storyId: boundedIdentity(field("storyId")),
    dispatchKey: boundedIdentity(field("dispatchKey")),
    ownerInstanceId: boundedIdentity(field("ownerInstanceId")),
    root, sourceSha, sourceTreeHash });
  const canonicalBody = canonicalJsonStringify(body);
  if (Buffer.byteLength(canonicalBody, "utf8") > 4096) fail();
  const reservationHash = createHash("sha256").update(canonicalBody, "utf8").digest("hex");
  return { body, canonicalBody, reservationHash };
}

function exactTargetAbsent(root: string): boolean {
  try { fs.lstatSync(root); return false; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "ENOENT"; }
}

export async function appendPrivateDiagnosticPrecreateReservationV1(
  sql: postgres.Sql, input: unknown,
): Promise<Readonly<{ schema: typeof SCHEMA; authority: "diagnostic-only";
  disposition: "inserted" | "identical-retry"; reservationHash: string }>> {
  try {
    const { body, canonicalBody, reservationHash } = project(input);
    // This is a sampled no-replace precondition, not a continuous fence.
    if (!exactTargetAbsent(body.root)) fail();
    return await sql.begin("isolation level serializable", async (tx) => {
      const mode = await tx.unsafe<Array<{ isolation: string; readOnly: string }>>(`
        SELECT pg_catalog.current_setting('transaction_isolation') AS isolation,
          pg_catalog.current_setting('transaction_read_only') AS "readOnly"`);
      if (mode.length !== 1 || mode[0]?.isolation !== "serializable"
        || mode[0]?.readOnly !== "off") fail();
      const linked = await tx.unsafe(`SELECT s.id FROM public.runs r
        JOIN public.stories s ON s.run_id = r.id
        WHERE r.id = $1 AND r.status = 'running'
          AND s.id = $2 AND s.story_id = $3
          AND s.status IN ('pending', 'failed')
        FOR UPDATE OF r, s`, [body.runId, body.storyDbId, body.storyId]);
      if (linked.length !== 1) fail();
      const expected: ReservationRow = Object.freeze({ reservationHash,
        runId: body.runId, storyDbId: body.storyDbId, storyId: body.storyId,
        dispatchKey: body.dispatchKey, ownerInstanceId: body.ownerInstanceId,
        root: body.root, sourceSha: body.sourceSha, sourceTreeHash: body.sourceTreeHash,
        canonicalBody });
      const inserted = await tx.unsafe(`INSERT INTO ${TABLE} (
        reservation_hash, run_id, story_db_id, story_id, dispatch_key,
        owner_instance_id, root, source_sha, source_tree_hash, canonical_body
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT DO NOTHING RETURNING reservation_hash`, [
        reservationHash, body.runId, body.storyDbId, body.storyId,
        body.dispatchKey, body.ownerInstanceId, body.root, body.sourceSha,
        body.sourceTreeHash, canonicalBody]);
      if (inserted.length === 1) return Object.freeze({ schema: SCHEMA,
        authority: "diagnostic-only" as const, disposition: "inserted" as const,
        reservationHash });
      const existing = await tx.unsafe<Array<ReservationRow>>(`SELECT
        reservation_hash AS "reservationHash", run_id AS "runId",
        story_db_id AS "storyDbId", story_id AS "storyId",
        dispatch_key AS "dispatchKey", owner_instance_id AS "ownerInstanceId",
        root, source_sha AS "sourceSha", source_tree_hash AS "sourceTreeHash",
        canonical_body AS "canonicalBody" FROM ${TABLE}
        WHERE reservation_hash = $1 OR root = $2
          OR (run_id = $3 AND story_db_id = $4 AND dispatch_key = $5)`,
      [reservationHash, body.root, body.runId, body.storyDbId, body.dispatchKey]);
      if (existing.length !== 1 || !Object.keys(expected).every((key) =>
        existing[0]![key as keyof ReservationRow] === expected[key as keyof ReservationRow])) fail();
      return Object.freeze({ schema: SCHEMA, authority: "diagnostic-only" as const,
        disposition: "identical-retry" as const, reservationHash });
    });
  } catch { return fail(); }
}

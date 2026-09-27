import type postgres from "postgres";

const REQUIRED_BASE_TABLES_V1 = Object.freeze([
  "claim_log",
  "medic_checks",
  "rules",
  "run_observations",
  "runs",
  "steps",
  "stories",
] as const);

// Frozen from the ordinary db-pg.ts base DDL, checked against a PostgreSQL 17
// isolated fixture. Additional contract-spine columns are not base members.
const EXPECTED_BASE_COLUMNS_V1 = Object.freeze([
  ["claim_log", "abandoned_at", "timestamp with time zone", -1, false, null],
  ["claim_log", "agent_id", "text", -1, true, null],
  ["claim_log", "claimed_at", "timestamp with time zone", -1, true, "now()"],
  ["claim_log", "diagnostic", "text", -1, false, null],
  ["claim_log", "duration_ms", "integer", -1, false, null],
  ["claim_log", "id", "bigint", -1, true, "nextval('claim_log_id_seq'::regclass)"],
  ["claim_log", "outcome", "text", -1, false, null],
  ["claim_log", "run_id", "text", -1, true, null],
  ["claim_log", "step_id", "text", -1, true, null],
  ["claim_log", "story_id", "text", -1, false, null],
  ["medic_checks", "actions_taken", "integer", -1, true, "0"],
  ["medic_checks", "checked_at", "timestamp with time zone", -1, true, null],
  ["medic_checks", "details", "text", -1, true, "'[]'::text"],
  ["medic_checks", "id", "text", -1, true, null],
  ["medic_checks", "issues_found", "integer", -1, true, "0"],
  ["medic_checks", "summary", "text", -1, true, "''::text"],
  ["rules", "applies_to", "text", -1, true, "'implement'::text"],
  ["rules", "category", "text", -1, true, "'general'::text"],
  ["rules", "content", "text", -1, true, null],
  ["rules", "created_at", "timestamp with time zone", -1, true, "now()"],
  ["rules", "enabled", "boolean", -1, true, "true"],
  ["rules", "id", "text", -1, true, null],
  ["rules", "project_type", "text", -1, true, "'general'::text"],
  ["rules", "readonly", "boolean", -1, true, "false"],
  ["rules", "severity", "text", -1, true, "'mandatory'::text"],
  ["rules", "sort_order", "integer", -1, true, "0"],
  ["rules", "source", "text", -1, false, null],
  ["rules", "title", "text", -1, true, null],
  ["rules", "updated_at", "timestamp with time zone", -1, true, "now()"],
  ["run_observations", "agent_id", "text", -1, false, null],
  ["run_observations", "check_id", "text", -1, true, null],
  ["run_observations", "completed_at", "timestamp with time zone", -1, false, null],
  ["run_observations", "created_at", "timestamp with time zone", -1, true, "now()"],
  ["run_observations", "detail", "text", -1, false, null],
  ["run_observations", "event_type", "text", -1, false, null],
  ["run_observations", "evidence", "text", -1, true, "'{}'::text"],
  ["run_observations", "file_paths", "text", -1, true, "'[]'::text"],
  ["run_observations", "github", "text", -1, true, "'{}'::text"],
  ["run_observations", "id", "text", -1, true, null],
  ["run_observations", "label", "text", -1, true, null],
  ["run_observations", "metadata", "text", -1, true, "'{}'::text"],
  ["run_observations", "phase", "text", -1, false, null],
  ["run_observations", "run_id", "text", -1, true, null],
  ["run_observations", "started_at", "timestamp with time zone", -1, false, null],
  ["run_observations", "status", "text", -1, true, null],
  ["run_observations", "step_id", "text", -1, true, null],
  ["run_observations", "story_id", "text", -1, true, "''::text"],
  ["run_observations", "summary", "text", -1, false, null],
  ["run_observations", "updated_at", "timestamp with time zone", -1, true, "now()"],
  ["runs", "assigned_developer", "text", -1, false, null],
  ["runs", "context", "text", -1, true, "'{}'::text"],
  ["runs", "created_at", "timestamp with time zone", -1, true, "now()"],
  ["runs", "id", "text", -1, true, null],
  ["runs", "meta", "text", -1, false, null],
  ["runs", "notify_url", "text", -1, false, null],
  ["runs", "run_number", "integer", -1, true, "nextval('runs_run_number_seq'::regclass)"],
  ["runs", "status", "text", -1, true, "'running'::text"],
  ["runs", "task", "text", -1, true, null],
  ["runs", "updated_at", "timestamp with time zone", -1, true, "now()"],
  ["runs", "workflow_id", "text", -1, true, null],
  ["steps", "abandoned_count", "integer", -1, true, "0"],
  ["steps", "agent_id", "text", -1, true, null],
  ["steps", "created_at", "timestamp with time zone", -1, true, "now()"],
  ["steps", "current_story_id", "text", -1, false, null],
  ["steps", "expects", "text", -1, true, null],
  ["steps", "id", "text", -1, true, null],
  ["steps", "input_template", "text", -1, true, null],
  ["steps", "loop_config", "text", -1, false, null],
  ["steps", "max_retries", "integer", -1, true, "2"],
  ["steps", "output", "text", -1, false, null],
  ["steps", "retry_count", "integer", -1, true, "0"],
  ["steps", "run_id", "text", -1, true, null],
  ["steps", "started_at", "timestamp with time zone", -1, false, null],
  ["steps", "status", "text", -1, true, "'waiting'::text"],
  ["steps", "step_id", "text", -1, true, null],
  ["steps", "step_index", "integer", -1, true, null],
  ["steps", "type", "text", -1, true, "'single'::text"],
  ["steps", "updated_at", "timestamp with time zone", -1, true, "now()"],
  ["stories", "abandoned_count", "integer", -1, true, "0"],
  ["stories", "acceptance_criteria", "text", -1, true, "'[]'::text"],
  ["stories", "claim_generation", "integer", -1, true, "0"],
  ["stories", "claimed_at", "timestamp with time zone", -1, false, null],
  ["stories", "claimed_by", "text", -1, false, null],
  ["stories", "created_at", "timestamp with time zone", -1, true, "now()"],
  ["stories", "depends_on", "text", -1, false, null],
  ["stories", "description", "text", -1, true, "''::text"],
  ["stories", "file_skeletons", "text", -1, false, null],
  ["stories", "id", "text", -1, true, null],
  ["stories", "implementation_contract", "text", -1, false, null],
  ["stories", "max_retries", "integer", -1, true, "2"],
  ["stories", "merge_status", "text", -1, false, null],
  ["stories", "output", "text", -1, false, null],
  ["stories", "pr_url", "text", -1, false, null],
  ["stories", "quality_failure_fingerprint", "text", -1, false, null],
  ["stories", "requested_dependencies", "text", -1, false, null],
  ["stories", "resolved_scope_files", "text", -1, false, null],
  ["stories", "retry_count", "integer", -1, true, "0"],
  ["stories", "run_id", "text", -1, true, null],
  ["stories", "scope_description", "text", -1, false, null],
  ["stories", "scope_files", "text", -1, false, null],
  ["stories", "scope_targets", "text", -1, false, null],
  ["stories", "shared_edit_requests", "text", -1, false, null],
  ["stories", "shared_files", "text", -1, false, null],
  ["stories", "started_at", "timestamp with time zone", -1, false, null],
  ["stories", "status", "text", -1, true, "'pending'::text"],
  ["stories", "story_branch", "text", -1, false, null],
  ["stories", "story_id", "text", -1, true, null],
  ["stories", "story_index", "integer", -1, true, null],
  ["stories", "story_screens", "text", -1, false, null],
  ["stories", "title", "text", -1, true, null],
  ["stories", "updated_at", "timestamp with time zone", -1, true, "now()"],
] as const);

const EXPECTED_BASE_INDEXES_V1 = Object.freeze([
  ["idx_claim_log_open_single_unique", "claim_log", "CREATE UNIQUE INDEX idx_claim_log_open_single_unique ON public.claim_log USING btree (run_id, step_id) WHERE ((outcome IS NULL) AND (story_id IS NULL))"],
  ["idx_claim_log_open_story_unique", "claim_log", "CREATE UNIQUE INDEX idx_claim_log_open_story_unique ON public.claim_log USING btree (run_id, step_id, story_id) WHERE ((outcome IS NULL) AND (story_id IS NOT NULL))"],
  ["idx_run_observations_run_created", "run_observations", "CREATE INDEX idx_run_observations_run_created ON public.run_observations USING btree (run_id, created_at DESC)"],
  ["idx_run_observations_status", "run_observations", "CREATE INDEX idx_run_observations_status ON public.run_observations USING btree (run_id, status, created_at DESC)"],
  ["idx_run_observations_step_story", "run_observations", "CREATE INDEX idx_run_observations_step_story ON public.run_observations USING btree (run_id, step_id, story_id, created_at DESC)"],
  ["idx_runs_run_number_unique", "runs", "CREATE UNIQUE INDEX idx_runs_run_number_unique ON public.runs USING btree (run_number)"],
  ["idx_runs_status_dev", "runs", "CREATE INDEX idx_runs_status_dev ON public.runs USING btree (status, assigned_developer) WHERE (status = 'running'::text)"],
  ["idx_steps_agent_status", "steps", "CREATE INDEX idx_steps_agent_status ON public.steps USING btree (agent_id, status) WHERE (status = ANY (ARRAY['pending'::text, 'running'::text]))"],
  ["idx_steps_run_status", "steps", "CREATE INDEX idx_steps_run_status ON public.steps USING btree (run_id, status)"],
  ["idx_stories_active_story_id_unique", "stories", "CREATE UNIQUE INDEX idx_stories_active_story_id_unique ON public.stories USING btree (run_id, story_id) WHERE (status = ANY (ARRAY['pending'::text, 'running'::text]))"],
  ["idx_stories_quality_failure_fingerprint", "stories", "CREATE INDEX idx_stories_quality_failure_fingerprint ON public.stories USING btree (run_id, quality_failure_fingerprint) WHERE (quality_failure_fingerprint IS NOT NULL)"],
  ["idx_stories_run_status", "stories", "CREATE INDEX idx_stories_run_status ON public.stories USING btree (run_id, status)"],
] as const);

const EXPECTED_BASE_CONSTRAINTS_V1 = Object.freeze([
  ["claim_log_pkey", "claim_log", "p", "PRIMARY KEY (id)"],
  ["medic_checks_pkey", "medic_checks", "p", "PRIMARY KEY (id)"],
  ["rules_pkey", "rules", "p", "PRIMARY KEY (id)"],
  ["run_observations_pkey", "run_observations", "p", "PRIMARY KEY (id)"],
  ["run_observations_run_id_fkey", "run_observations", "f", "FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE"],
  ["runs_pkey", "runs", "p", "PRIMARY KEY (id)"],
  ["steps_pkey", "steps", "p", "PRIMARY KEY (id)"],
  ["steps_run_id_fkey", "steps", "f", "FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE"],
  ["stories_pkey", "stories", "p", "PRIMARY KEY (id)"],
  ["stories_run_id_fkey", "stories", "f", "FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE"],
] as const);

const EXPECTED_BASE_FK_TRIGGER_GROUPS_V1 = Object.freeze([
  ["run_observations_run_id_fkey", "run_observations"],
  ["run_observations_run_id_fkey", "runs"],
  ["steps_run_id_fkey", "runs"],
  ["steps_run_id_fkey", "steps"],
  ["stories_run_id_fkey", "runs"],
  ["stories_run_id_fkey", "stories"],
] as const);

const EXPECTED_BASE_SEQUENCES_V1 = Object.freeze([
  ["claim_log_id_seq", "claim_log", "id", "a"],
  ["runs_run_number_seq", null, null, null],
] as const);

const TABLE_SQL_V1 = `SELECT c.relname AS name, c.relkind AS kind,
  c.relpersistence AS persistence, c.relispartition AS partitioned,
  am.amname AS "accessMethod",
  c.reloptions AS "tableOptions", toast.reloptions AS "toastOptions",
  c.relreplident AS "replicaIdentity",
  c.relrowsecurity AS "rowSecurity", c.relforcerowsecurity AS "forceRowSecurity",
  pg_catalog.pg_has_role(session_user, c.relowner, 'MEMBER') AS "ownerReachable",
  EXISTS (SELECT 1 FROM pg_catalog.pg_inherits h
    WHERE h.inhrelid = c.oid OR h.inhparent = c.oid) AS "hasInheritance",
  EXISTS (SELECT 1 FROM pg_catalog.pg_rewrite r
    WHERE r.ev_class = c.oid) AS "hasRewriteRules"
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_catalog.pg_am am ON am.oid = c.relam
  LEFT JOIN pg_catalog.pg_class toast ON toast.oid = c.reltoastrelid
 WHERE n.nspname = 'public'
   AND c.relname IN ('claim_log', 'medic_checks', 'rules',
     'run_observations', 'runs', 'steps', 'stories')
 ORDER BY c.relname COLLATE "C"`;

const COLUMN_SQL_V1 = `SELECT c.relname AS "table", a.attname AS "column",
  format_type(a.atttypid, a.atttypmod) AS "type",
  a.atttypmod AS typmod, a.attnotnull AS "notNull",
  pg_get_expr(d.adbin, d.adrelid) AS "default",
  a.attisdropped AS dropped, a.attidentity AS identity,
  a.attgenerated AS generated,
  a.atthasmissing AS "hasMissing",
  a.attmissingval IS NOT NULL AS "missingPresent",
  a.attstorage AS storage,
  a.attcompression = ''::pg_catalog."char" AS "defaultCompression",
  CASE WHEN a.attcollation = 0 THEN 'none'
       WHEN a.attcollation = 'pg_catalog."default"'::regcollation THEN 'default'
       ELSE 'custom' END AS collation
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0
  LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
 WHERE n.nspname = 'public'
   AND c.relname IN ('claim_log', 'medic_checks', 'rules',
     'run_observations', 'runs', 'steps', 'stories')
 ORDER BY c.relname COLLATE "C", a.attname COLLATE "C"
 LIMIT 1025`;

const INDEX_SQL_V1 = `SELECT tc.relname AS "table", ic.relname AS name,
  pg_get_indexdef(i.indexrelid) AS definition,
  i.indisvalid AS valid, i.indisready AS ready, i.indislive AS live,
  i.indisunique AS unique, i.indisprimary AS "primary",
  i.indimmediate AS immediate,
  EXISTS (SELECT 1 FROM pg_catalog.pg_constraint co
    WHERE co.conindid = i.indexrelid
      AND co.contype IN ('p', 'u', 'x')) AS "constraintOwned",
  i.indnkeyatts AS "keyCount", i.indnatts AS "totalCount",
  i.indexprs IS NOT NULL AS "hasExpression", am.amname AS method,
  ic.relkind AS kind, ic.relpersistence AS persistence,
  pg_catalog.pg_has_role(session_user, ic.relowner, 'MEMBER') AS "ownerReachable"
  FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class ic ON ic.oid = i.indexrelid
  JOIN pg_catalog.pg_class tc ON tc.oid = i.indrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = ic.relnamespace
  JOIN pg_catalog.pg_am am ON am.oid = ic.relam
 WHERE n.nspname = 'public'
   AND ic.relname IN ('idx_runs_run_number_unique', 'idx_steps_run_status',
     'idx_stories_run_status', 'idx_stories_active_story_id_unique',
     'idx_stories_quality_failure_fingerprint', 'idx_steps_agent_status',
     'idx_runs_status_dev', 'idx_run_observations_run_created',
     'idx_run_observations_step_story', 'idx_run_observations_status',
     'idx_claim_log_open_single_unique', 'idx_claim_log_open_story_unique')
 ORDER BY ic.relname COLLATE "C"
 LIMIT 13`;

const CONSTRAINT_SQL_V1 = `SELECT c.relname AS "table", co.conname AS name,
  co.contype AS kind, pg_get_constraintdef(co.oid) AS definition,
  co.convalidated AS validated, co.condeferrable AS deferrable,
  co.condeferred AS deferred, co.conislocal AS local,
  co.coninhcount AS "inheritCount", co.connoinherit AS "noInherit",
  co.conparentid::text AS "parentOid"
 FROM pg_catalog.pg_constraint co JOIN pg_catalog.pg_class c ON c.oid = co.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND (c.relname, co.conname) IN (
     ('claim_log', 'claim_log_pkey'), ('medic_checks', 'medic_checks_pkey'),
     ('rules', 'rules_pkey'), ('run_observations', 'run_observations_pkey'),
     ('runs', 'runs_pkey'), ('steps', 'steps_pkey'), ('stories', 'stories_pkey'),
     ('run_observations', 'run_observations_run_id_fkey'),
     ('steps', 'steps_run_id_fkey'), ('stories', 'stories_run_id_fkey'))
 ORDER BY co.conname COLLATE "C"
 LIMIT 11`;

const FK_TRIGGER_SQL_V1 = `SELECT co.conname AS name,
  tn.nspname AS "triggerSchema", tc.relname AS "triggerTable",
  count(*)::integer AS "triggerCount",
  bool_and(t.tgenabled = 'O' AND t.tgisinternal) AS enabled
  FROM pg_catalog.pg_constraint co JOIN pg_catalog.pg_class c ON c.oid = co.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_catalog.pg_trigger t ON t.tgconstraint = co.oid
  JOIN pg_catalog.pg_class tc ON tc.oid = t.tgrelid
  JOIN pg_catalog.pg_namespace tn ON tn.oid = tc.relnamespace
 WHERE n.nspname = 'public' AND co.contype = 'f'
   AND (c.relname, co.conname) IN (
     ('run_observations', 'run_observations_run_id_fkey'),
     ('steps', 'steps_run_id_fkey'), ('stories', 'stories_run_id_fkey'))
 GROUP BY co.conname, tn.nspname, tc.relname
 ORDER BY co.conname COLLATE "C", tc.relname COLLATE "C"
 LIMIT 7`;

const SEQUENCE_SQL_V1 = `SELECT c.relname AS name, c.relkind AS kind,
  c.relpersistence AS persistence, s.seqtypid::regtype::text AS type,
  s.seqstart::text AS start, s.seqincrement::text AS increment,
  s.seqmin::text AS min, s.seqmax::text AS max, s.seqcache::text AS cache,
  s.seqcycle AS cycle, own.relname AS "ownerTable",
  att.attname AS "ownerColumn", dep.deptype AS "dependencyType",
  ownn.nspname AS "ownerSchema",
  pg_catalog.pg_has_role(session_user, c.relowner, 'MEMBER') AS "ownerReachable"
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_catalog.pg_sequence s ON s.seqrelid = c.oid
  LEFT JOIN pg_catalog.pg_depend dep ON dep.classid = 'pg_catalog.pg_class'::regclass
    AND dep.objid = c.oid AND dep.refclassid = 'pg_catalog.pg_class'::regclass
    AND dep.deptype IN ('a', 'i')
  LEFT JOIN pg_catalog.pg_class own ON own.oid = dep.refobjid
  LEFT JOIN pg_catalog.pg_namespace ownn ON ownn.oid = own.relnamespace
  LEFT JOIN pg_catalog.pg_attribute att ON att.attrelid = own.oid
    AND att.attnum = dep.refobjsubid
 WHERE n.nspname = 'public'
   AND c.relname IN ('claim_log_id_seq', 'runs_run_number_seq')
 ORDER BY c.relname COLLATE "C"
 LIMIT 3`;

function mismatch(): never {
  throw new Error("SETFARM_BASE_SCHEMA_CATALOG_MISMATCH_V1");
}

/** Standalone catalog check only; not a runtime startup or migration path. */
export async function verifyOrdinaryBaseSchemaCatalogReadOnlyV1(
  sql: postgres.Sql,
): Promise<void> {
  try {
    await sql.begin("isolation level repeatable read read only", async (transaction) => {
      await transaction.unsafe("SELECT pg_catalog.set_config('search_path', 'pg_catalog, public, pg_temp', true)");
      await transaction.unsafe("SELECT pg_catalog.set_config('lock_timeout', '1000ms', true)");
      await transaction.unsafe("SELECT pg_catalog.set_config('statement_timeout', '5000ms', true)");
      await transaction.unsafe("SELECT pg_catalog.set_config('idle_in_transaction_session_timeout', '5000ms', true)");
      const access = await transaction.unsafe<Array<{ database: boolean; schema: boolean }>>(
        "SELECT has_database_privilege(current_user, current_database(), 'CONNECT') AS database, has_schema_privilege(current_user, 'public', 'USAGE') AS schema",
      );
      if (access.length !== 1 || !access[0]?.database || !access[0]?.schema) mismatch();
      const tables = await transaction.unsafe<Array<{
        name: string;
        kind: string;
        persistence: string;
        partitioned: boolean;
        accessMethod: string | null;
        tableOptions: string[] | null;
        toastOptions: string[] | null;
        replicaIdentity: string;
        rowSecurity: boolean;
        forceRowSecurity: boolean;
        hasInheritance: boolean;
        hasRewriteRules: boolean;
        ownerReachable: boolean;
      }>>(TABLE_SQL_V1);
      if (
        tables.length !== REQUIRED_BASE_TABLES_V1.length
        || tables.some((table, index) =>
          table.name !== REQUIRED_BASE_TABLES_V1[index]
          || table.kind !== "r"
          || table.persistence !== "p"
          || table.partitioned !== false
          || table.accessMethod !== "heap"
          || table.tableOptions !== null || table.toastOptions !== null
          || table.replicaIdentity !== "d"
          || table.rowSecurity !== false
          || table.forceRowSecurity !== false
          || table.hasInheritance !== false
          || table.hasRewriteRules !== false
          || table.ownerReachable !== false)
      ) mismatch();
      const columns = await transaction.unsafe<Array<{
        table: string;
        column: string;
        type: string;
        typmod: number;
        notNull: boolean;
        default: string | null;
        dropped: boolean;
        identity: string;
        generated: string;
        hasMissing: boolean;
        missingPresent: boolean;
        storage: string;
        defaultCompression: boolean;
        collation: string;
      }>>(COLUMN_SQL_V1);
      if (columns.length > 1024) mismatch();
      const byName = new Map<string, typeof columns[number]>();
      for (const column of columns) {
        if (column.dropped || column.identity !== "" || column.generated !== "") mismatch();
        const key = `${column.table}.${column.column}`;
        if (byName.has(key)) mismatch();
        byName.set(key, column);
      }
      for (const expected of EXPECTED_BASE_COLUMNS_V1) {
        const actual = byName.get(`${expected[0]}.${expected[1]}`);
        if (!actual || actual.type !== expected[2]
          || actual.typmod !== expected[3]
          || actual.notNull !== expected[4]
          || actual.default !== expected[5]
          || actual.hasMissing || actual.missingPresent
          || actual.storage !== (expected[2] === "text" ? "x" : "p")
          || !actual.defaultCompression
          || actual.collation !== (expected[2] === "text" ? "default" : "none")) mismatch();
      }
      const indexes = await transaction.unsafe<Array<{
        table: string;
        name: string;
        definition: string;
        valid: boolean;
        ready: boolean;
        live: boolean;
        unique: boolean;
        primary: boolean;
        immediate: boolean;
        constraintOwned: boolean;
        keyCount: number;
        totalCount: number;
        hasExpression: boolean;
        method: string;
        kind: string;
        persistence: string;
        ownerReachable: boolean;
      }>>(INDEX_SQL_V1);
      if (indexes.length !== EXPECTED_BASE_INDEXES_V1.length
        || indexes.some((actual, index) => {
          const expected = EXPECTED_BASE_INDEXES_V1[index]!;
          return actual.name !== expected[0]
            || actual.table !== expected[1]
            || actual.definition !== expected[2]
            || actual.unique !== expected[2].startsWith("CREATE UNIQUE INDEX")
            || !actual.valid || !actual.ready || !actual.live || actual.primary
            || !actual.immediate || actual.constraintOwned
            || actual.keyCount !== actual.totalCount || actual.hasExpression
            || actual.method !== "btree" || actual.kind !== "i"
            || actual.persistence !== "p" || actual.ownerReachable;
        })) mismatch();
      const constraints = await transaction.unsafe<Array<{
        table: string;
        name: string;
        kind: string;
        definition: string;
        validated: boolean;
        deferrable: boolean;
        deferred: boolean;
        local: boolean;
        inheritCount: number;
        noInherit: boolean;
        parentOid: string;
      }>>(CONSTRAINT_SQL_V1);
      if (constraints.length !== EXPECTED_BASE_CONSTRAINTS_V1.length
        || constraints.some((actual, index) => {
          const expected = EXPECTED_BASE_CONSTRAINTS_V1[index]!;
          return actual.name !== expected[0]
            || actual.table !== expected[1]
            || actual.kind !== expected[2]
            || actual.definition !== expected[3]
            || !actual.validated || actual.deferrable || actual.deferred
            || !actual.local || actual.inheritCount !== 0
            || !actual.noInherit || actual.parentOid !== "0";
        })) mismatch();
      const fkTriggers = await transaction.unsafe<Array<{
        name: string;
        triggerSchema: string;
        triggerTable: string;
        triggerCount: number;
        enabled: boolean;
      }>>(FK_TRIGGER_SQL_V1);
      if (fkTriggers.length !== EXPECTED_BASE_FK_TRIGGER_GROUPS_V1.length
        || fkTriggers.some((actual, index) => {
          const expected = EXPECTED_BASE_FK_TRIGGER_GROUPS_V1[index]!;
          return actual.name !== expected[0]
            || actual.triggerSchema !== "public"
            || actual.triggerTable !== expected[1]
            || actual.triggerCount !== 2 || !actual.enabled;
        })) mismatch();
      const sequences = await transaction.unsafe<Array<{
        name: string;
        kind: string;
        persistence: string;
        type: string;
        start: string;
        increment: string;
        min: string;
        max: string;
        cache: string;
        cycle: boolean;
        ownerTable: string | null;
        ownerColumn: string | null;
        dependencyType: string | null;
        ownerSchema: string | null;
        ownerReachable: boolean;
      }>>(SEQUENCE_SQL_V1);
      if (sequences.length !== EXPECTED_BASE_SEQUENCES_V1.length
        || sequences.some((actual, index) => {
          const expected = EXPECTED_BASE_SEQUENCES_V1[index]!;
          return actual.name !== expected[0]
            || actual.ownerTable !== expected[1]
            || actual.ownerColumn !== expected[2]
            || actual.dependencyType !== expected[3]
            || actual.ownerSchema !== (expected[1] === null ? null : "public")
            || actual.ownerReachable
            || actual.kind !== "S" || actual.persistence !== "p"
            || actual.type !== "bigint" || actual.start !== "1"
            || actual.increment !== "1" || actual.min !== "1"
            || actual.max !== "9223372036854775807"
            || actual.cache !== "1" || actual.cycle;
        })) mismatch();
    });
  } catch {
    mismatch();
  }
}

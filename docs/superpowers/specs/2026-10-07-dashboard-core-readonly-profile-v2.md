# Dashboard core read-only profile V2: exact catalog nomination

This is the Task4f.1 catalog nomination, not an implementation, host receipt,
reader readiness or startup authority. Run these three fixed statements only
inside the original private RR read-only transaction. Statement1 has no inputs;
statements2/3 receive only the five relation OIDs captured and validated from1.
No caller SQL, URL or metadata overrides. Repeat the complete qualification
before publication on the same transaction, alongside source journal/cold census.

Trust boundary: installed PostgreSQL and its builtin pg_catalog identities are
trusted. This does not attest binaries or defeat privileged catalog tampering.
Defaults, sequence owners and mutator-trigger/FK semantics do not grant or prove
read ownership; the existing base/full-head owner verifiers remain unchanged.

Original transaction ordering: BEGIN RR READ ONLY; SET LOCAL statement_timeout
'5s', lock_timeout '1s', search_path pg_catalog (utility commands, not SELECT
set_config); fixed LOCK TABLE ONLY public.runs, ONLY public.steps,
ONLY public.stories, ONLY public.rules, ONLY public.run_observations IN ACCESS
SHARE MODE; then the first snapshot-producing qualification SELECT. Retain those
original locks until transaction settlement. First/final relation inventories
must match the original five OID bindings, not merely repin the same names.

ACCESS SHARE does not exclude index DDL. The separate Task5 authenticated
cooperative schema-writer exclusion/drain must persist through complete reader
settlement: new ordinary/migration ports are refused by the permanent db-pg latch,
old raw handles/processes need actual drain proof, and closed controller/reader
source ports emit no schema DDL. No arbitrary privileged/same-UID adversary or
builtin-catalog editor claim. Unqualified metadata characterization is only a
sample, not this exclusion certificate. Do not add a universal native barrier.

Rejected negative: five SHARE ROW EXCLUSIVE locks would exclude index DDL but
conflict with the controller's still-held36 SHARE locks on its different backend,
preventing consuming startup. They also block the proposed concurrent-DML RR
oracle. Do not transfer the controller backend, relax timeouts or claim that
negative recipe is usable. ACCESS SHARE is compatible with those SHARE locks.

## Original tuple decoding and bounds

Exactly five relations and104 live columns: runs20, steps18, stories33, rules13,
run_observations20. Fetch sentinels6/105/129 and refuse excess; index count≤128,
key count≤32, each family operator/support count≤64. These are accepted metadata
and application publication bounds, not transport/backend allocation bounds.
Rows must be nonproxy plain own-data records with exactly the selected fields.
Driver Result extends Array with nonenumerable metadata: validate/copy numeric
own entries without demanding Array.prototype equality or invoking user hooks.
JSON arrays/records nested in index metadata also require inert own-data decoding,
exact keys, no holes/accessors/proxies or nonfinite/cross-type coercion.

OID strings are canonical positive uint32 decimals. Boolean/numeric fields keep
their exact driver types; no truthiness/string conversion. Missing/null joined
metadata refuses unless the explicit contract below requires null. SQL parameter
OID lists are newly copied original values, not caller-controlled objects.

## Statement1: fixed public relations

```sql
SELECT c.oid::text AS relation_oid,
       c.relname::text AS relation_name,
       c.relkind::text AS relation_kind,
       c.relpersistence::text AS persistence,
       am.amname::text AS access_method,
       pn.nspname::text AS handler_namespace,
       hp.proname::text AS handler_name,
       hl.lanname::text AS handler_language,
       hp.prosrc AS handler_source,
       hp.probin AS handler_binary,
       hp.prosecdef AS handler_security_definer,
       hp.proconfig AS handler_config,
       c.relrowsecurity AS row_security,
       c.relforcerowsecurity AS force_row_security,
       EXISTS (SELECT 1 FROM pg_catalog.pg_inherits h
               WHERE h.inhrelid=c.oid OR h.inhparent=c.oid) AS has_inheritance,
       EXISTS (SELECT 1 FROM pg_catalog.pg_rewrite r
               WHERE r.ev_class=c.oid) AS has_rewrite,
       pg_catalog.has_table_privilege(c.oid,'SELECT') AS can_select
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_catalog.pg_am am ON am.oid=c.relam
LEFT JOIN pg_catalog.pg_proc hp ON hp.oid=am.amhandler
LEFT JOIN pg_catalog.pg_namespace pn ON pn.oid=hp.pronamespace
LEFT JOIN pg_catalog.pg_language hl ON hl.oid=hp.prolang
WHERE n.nspname='public'
  AND c.relname IN ('runs','steps','stories','rules','run_observations')
ORDER BY c.relname
LIMIT 6
```

Require the five exact names, distinct OIDs, kind r, persistence p, heap access
method, handler pg_catalog.heap_tableam_handler, language internal, source
heap_tableam_handler, null binary/configuration, security-definer false; both RLS
flags/inheritance/rewrite false and SELECT true. No views, foreign tables or
partition/inheritance substitutes. Do not report raw relation metadata publicly.

## Statement2: complete live columns bound to original relation OIDs

```sql
SELECT a.attrelid::text AS relation_oid,
       a.attnum::integer AS attribute_number,
       a.attname::text AS column_name,
       t.oid::text AS type_oid,
       tn.nspname::text AS type_namespace,
       t.typname::text AS type_name,
       t.typtype::text AS type_kind,
       a.atttypmod::integer AS type_modifier,
       a.attndims::integer AS dimensions,
       a.attnotnull AS not_null,
       a.attidentity::text AS identity_kind,
       a.attgenerated::text AS generated_kind,
       a.attcollation::text AS collation_oid,
       cn.nspname::text AS collation_namespace,
       co.collname::text AS collation_name
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_type t ON t.oid=a.atttypid
JOIN pg_catalog.pg_namespace tn ON tn.oid=t.typnamespace
LEFT JOIN pg_catalog.pg_collation co ON co.oid=a.attcollation
LEFT JOIN pg_catalog.pg_namespace cn ON cn.oid=co.collnamespace
WHERE a.attrelid=ANY($1::oid[]) AND a.attnum>0 AND NOT a.attisdropped
ORDER BY a.attrelid,a.attname
LIMIT 105
```

Exactly104 (relation_oid,column_name) members below, unique positive attnums per
relation; attnum order need not be contiguous/source ordered after migrations.
Exact builtin namespace pg_catalog, type kind b, typmod−1, dimensions0, empty
identity/generated state. Types: textOID25, int4OID23, boolOID16,
timestamptzOID1184. Text collation is pg_catalog.default/OID100; all other types
have collationOID0 and null collation namespace/name. Retain attnum/type/collation
binding for the index inventory; same-name columns cannot substitute relationOID.
pg_catalog.default/OID100 delegates to the installed database locale/provider;
it does NOT mean C ordering or provider b. This profile explicitly relies on the
same trusted installed database collation/provider/version as the authenticated
launcher target and source-compatible legacy reads. It grants no portable locale
equivalence or immunity to provider/catalog replacement. Metadata characterization
must report an internal hash/profile separately if that matched-host premise is
not established; do not silently normalize or infer builtin/C semantics.

```text
runs:
id run_number workflow_id task status context meta notify_url assigned_developer
protocol protocol_version compiler_release_sha packet_hash activation_preflight_hash
accepted_candidate_hash deploy_receipt_hash release_admission_hash
project_transfer_ack_hash created_at updated_at
steps:
id run_id step_id agent_id step_index input_template expects status output
retry_count max_retries abandoned_count started_at type loop_config
current_story_id created_at updated_at
stories:
id run_id story_index story_id title description acceptance_criteria status
output retry_count max_retries abandoned_count claimed_by claimed_at
claim_generation started_at depends_on scope_files shared_files scope_targets
requested_dependencies shared_edit_requests resolved_scope_files scope_description
file_skeletons implementation_contract story_screens story_branch pr_url
merge_status created_at updated_at quality_failure_fingerprint
rules:
id title content category project_type source severity applies_to enabled readonly
sort_order created_at updated_at
run_observations:
id run_id step_id story_id agent_id phase check_id label status summary detail
evidence file_paths github metadata event_type started_at completed_at
created_at updated_at
```

Every *_at is timestamptz. Integer exceptions: runs.run_number/protocol_version;
steps.step_index/retry_count/max_retries/abandoned_count;
stories.story_index/retry_count/max_retries/abandoned_count/claim_generation;
rules.sort_order. rules.enabled/readonly are bool; all remaining members text.
Exact NOT NULL sets (remaining fields nullable):

```text
runs: id run_number workflow_id task status context protocol protocol_version created_at updated_at
steps: id run_id step_id agent_id step_index input_template expects status retry_count max_retries abandoned_count type created_at updated_at
stories: id run_id story_index story_id title description acceptance_criteria status retry_count max_retries abandoned_count claim_generation created_at updated_at
rules: all except source
run_observations: id run_id step_id story_id check_id label status evidence file_paths github metadata created_at updated_at
```

## Statement3: complete index inventory and builtin dependency summaries

```sql
WITH indexes AS MATERIALIZED (
  SELECT i.* FROM pg_catalog.pg_index i
  WHERE i.indrelid=ANY($1::oid[])
  ORDER BY i.indrelid,i.indexrelid LIMIT 129
)
SELECT i.indrelid::text AS relation_oid,
       i.indexrelid::text AS index_oid,
       ic.relname::text AS index_name,
       ic.relkind::text AS index_kind,
       am.amname::text AS access_method,
       hn.nspname::text AS handler_namespace,
       hp.proname::text AS handler_name,
       hl.lanname::text AS handler_language,
       hp.prosrc AS handler_source,
       hp.probin AS handler_binary,
       hp.prosecdef AS handler_security_definer,
       hp.proconfig AS handler_config,
       i.indnatts::integer AS total_attributes,
       i.indnkeyatts::integer AS key_attributes,
       i.indisprimary AS primary_key,
       i.indisunique AS unique_index,
       i.indimmediate AS immediate,
       i.indisvalid AS valid,
       i.indisready AS ready,
       i.indislive AS live,
       i.indisexclusion AS exclusion,
       i.indkey::text AS attribute_numbers,
       i.indclass::text AS operator_class_oids,
       i.indcollation::text AS collation_oids,
       i.indoption::text AS key_options,
       pg_catalog.pg_get_expr(i.indexprs,i.indrelid,false) AS expressions,
       pg_catalog.pg_get_expr(i.indpred,i.indrelid,false) AS predicate,
       pg_catalog.pg_get_indexdef(i.indexrelid,0,false) AS definition,
       (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'constraint_oid',c.oid::text,'kind',c.contype::text,
          'validated',c.convalidated,'deferrable',c.condeferrable,
          'deferred',c.condeferred,'attributes',c.conkey) ORDER BY c.oid)
        FROM pg_catalog.pg_constraint c
        WHERE c.conindid=i.indexrelid AND c.conrelid=i.indrelid
          AND c.contype='p') AS primary_constraints,
       (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'ordinal',k.pos,'attribute_number',i.indkey[k.pos],
          'operator_class_oid',oc.oid::text,
          'operator_class_namespace',onsp.nspname::text,
          'operator_class_name',oc.opcname::text,
          'operator_class_default',oc.opcdefault,
          'operator_input_type_oid',oc.opcintype::text,
          'operator_key_type_oid',oc.opckeytype::text,
          'family_oid',f.oid::text,'family_namespace',fn.nspname::text,
          'family_name',f.opfname::text,
          'class_method_matches',oc.opcmethod=ic.relam,
          'family_method_matches',f.opfmethod=ic.relam,
          'support_count',(SELECT count(*)::integer FROM pg_catalog.pg_amproc ap
                           WHERE ap.amprocfamily=f.oid),
          'operator_count',(SELECT count(*)::integer FROM pg_catalog.pg_amop ao
                            WHERE ao.amopfamily=f.oid),
          'support_builtin',NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_amproc ap
            LEFT JOIN pg_catalog.pg_proc p ON p.oid=ap.amproc
            LEFT JOIN pg_catalog.pg_namespace ns ON ns.oid=p.pronamespace
            LEFT JOIN pg_catalog.pg_language l ON l.oid=p.prolang
            WHERE ap.amprocfamily=f.oid AND (
              p.oid IS NULL OR ns.nspname IS DISTINCT FROM 'pg_catalog'
              OR l.lanname IS DISTINCT FROM 'internal'
              OR p.prokind IS DISTINCT FROM 'f' OR p.prosecdef
              OR p.proconfig IS NOT NULL OR p.probin IS NOT NULL)),
          'operators_builtin',NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_amop ao
            LEFT JOIN pg_catalog.pg_operator op ON op.oid=ao.amopopr
            LEFT JOIN pg_catalog.pg_namespace ons ON ons.oid=op.oprnamespace
            LEFT JOIN pg_catalog.pg_proc p ON p.oid=op.oprcode
            LEFT JOIN pg_catalog.pg_namespace ns ON ns.oid=p.pronamespace
            LEFT JOIN pg_catalog.pg_language l ON l.oid=p.prolang
            WHERE ao.amopfamily=f.oid AND (
              op.oid IS NULL OR p.oid IS NULL
              OR ons.nspname IS DISTINCT FROM 'pg_catalog'
              OR ns.nspname IS DISTINCT FROM 'pg_catalog'
              OR l.lanname IS DISTINCT FROM 'internal'
              OR p.prokind IS DISTINCT FROM 'f' OR p.prosecdef
              OR p.proconfig IS NOT NULL OR p.probin IS NOT NULL
              OR ao.amopmethod IS DISTINCT FROM ic.relam
              OR ao.amoplefttype IS DISTINCT FROM op.oprleft
              OR ao.amoprighttype IS DISTINCT FROM op.oprright))
        ) ORDER BY k.pos)
        FROM pg_catalog.generate_series(0,i.indnkeyatts-1) k(pos)
        LEFT JOIN pg_catalog.pg_opclass oc ON oc.oid=i.indclass[k.pos]
        LEFT JOIN pg_catalog.pg_namespace onsp ON onsp.oid=oc.opcnamespace
        LEFT JOIN pg_catalog.pg_opfamily f ON f.oid=oc.opcfamily
        LEFT JOIN pg_catalog.pg_namespace fn ON fn.oid=f.opfnamespace) AS keys
FROM indexes i
LEFT JOIN pg_catalog.pg_class ic ON ic.oid=i.indexrelid
LEFT JOIN pg_catalog.pg_am am ON am.oid=ic.relam
LEFT JOIN pg_catalog.pg_proc hp ON hp.oid=am.amhandler
LEFT JOIN pg_catalog.pg_namespace hn ON hn.oid=hp.pronamespace
LEFT JOIN pg_catalog.pg_language hl ON hl.oid=hp.prolang
ORDER BY i.indrelid,i.indexrelid
```

Require distinct indexOID, original relationOID, kind i, btree/internal builtin
pg_catalog.bthandler (same source), null handler binary/config, non-security-definer,
valid/live/ready/immediate, not exclusion, null expressions. Parse all four
space-separated canonical vector strings strictly: total/key count1..32,
no INCLUDE columns; equal counts/lengths and captured attnum binding. Key options
0..3 only. Collation must equal original column collation. Key JSON fields are
exactly the named17 members above; class/family namespaces pg_catalog, matching
methods, default type class (text_ops/int4_ops/bool_ops/timestamptz_ops), exact input
type, key type0, positive family/classOID. Family names text_ops/integer_ops/
bool_ops/datetime_ops respectively. Counts1..64 and builtin summaries true.
No expressions/custom family/operator-code/handler substitutions. The declared
trusted-installed-builtin premise supplies builtin selectors/support/type-I/O
semantics; this is deliberately not recursive whole-PostgreSQL attestation.
Family support functions legitimately include cross-type date/time/interval
paths; do not restrict every dependency input to four dashboard column types.

Exactly one id-only unconditional unique primary index per relation; exactly one
validated immediate/nondeferrable primary constraint, positive constraintOID and
attributes exactly [captured id attnum]. Nonprimary index primary_constraints is
null. Other plain-key indexes use captured column bindings. Partial predicates
must be literal source-compatible deparses for only: runs.status='running';
steps.status IN('pending','running') on agent_id/status;
stories.status IN('pending','running') on run_id/story_id;
stories.quality_failure_fingerprint IS NOT NULL on run_id/fingerprint. Unknown
predicate refuses; do not equate arbitrary pg_get_expr text with harmless SQL.
Nominated exact pg_get_expr(...,false) spellings: `(status = 'running'::text)`;
`(status = ANY (ARRAY['pending'::text, 'running'::text]))`;
`(quality_failure_fingerprint IS NOT NULL)`, with the exact table/key bindings
listed above. An unknown spelling refuses, not an expression-normalizing parser.
Actual host compatibility/decoding remains unproved until characterization.

Independent scoped nomination review: C0/I0/M0 on the original ACCESS SHARE/OID
binding, matched-default-collation and trusted builtin premise. Runtime source
requires genuine RED first. No readiness/Task5 admission follows from that review.

Primary source basis (PostgreSQL18 published source, not installed-host version
attestation): [LOCK](https://www.postgresql.org/docs/18/sql-lock.html),
[SET TRANSACTION](https://www.postgresql.org/docs/18/sql-set-transaction.html),
[utility command classification](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/backend/tcop/utility.c).

## Remaining proof gates

Check exact source/predicate tuples with source-fault RED before runtime source;
then installed provider decoding and actual target compatibility. Source tuple
fixtures are not live PG evidence.
Actual metadata characterization prints only counts/hashes using the captured
agreed private target; never URL/rows, SQL mutation or migration. Mock tuple tests
are not actual PG/callback/transaction/cleanup or startup qualification.

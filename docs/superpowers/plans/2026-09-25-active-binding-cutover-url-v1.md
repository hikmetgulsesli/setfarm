# Non-pre32 active binding cutover URL observer V1

Status: implementation verified locally; PR delivery pending. Diagnostic-only,
no cutover authority.

## Causal scope

PR #167's positive active/binding transaction is exposed through `db-pg.ts`,
which chooses ambient runtime configuration. The authenticated launcher instead
holds an agreed private PostgreSQL URL. A separate import-inert cutover-local
observer is needed before a held physical/DB pair can use positive rows. It
must not change the pre-32 zero census, migration or writer/admission behavior.

## File map and sequence

1. RED tests in `tests/internal-production/baseline-positive-worktree-active-binding-cutover-database-v1.test.ts`:
   import inertia and ambient-URL refusal; exact local target/PG environment
   refusal before connection; fake postgres.js options, one bounded read-only
   transaction, eight normalized queries, and bounded close on failure.
2. Implement `src/internal-production/baseline-positive-worktree-active-binding-cutover-database-v1.ts`:
   only caller-held URL; strict local target and driver option check; lazy
   postgres import; repeatable-read/read-only transaction with local timeouts;
   reuse strict V1 active/binding row observer and Result normalization.
3. Add test to pure suite. Run focused, pure/cutover suites and TypeScript.
   Independent read-only review, PR, clean-main build and real host proof are
   subsequent delivery steps. A separate held launcher/physical pair and
   trusted physical receipt remain later work.

No empty result or path string is a nonowner classification. No service switch,
worktree removal, migration or old dist replacement is part of this change.

## Verification evidence

RED failed on the absent module. Focused GREEN 7/7 covers import inertia,
ambient/remote/ambiguous URL refusal, one read-only transaction, eight
normalized Results, and close on success/failure. Independent read-only review
found no blocker and requested two additional negative fake-driver paths:
mismatched driver target and failed bounded close; both now refuse with the
sanitized error. Pure suite 144/144, cutover suite 390/390, TypeScript no-emit,
English/path checks and diff check passed before the extra negative cases;
focused 7/7 passed after them. Final pure recheck and PR review remain pending.

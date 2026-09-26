# Authenticated held-journal pre32 diagnostic pair

The existing V6 pre32 physical/database pair reads complete binding rows in one PostgreSQL transaction but does not hold the fixed pre32 writer locks or exact migration-1-through-31 journal identity. The separate V2 held-journal census added in PR #176 releases its locks before V6 can read binding rows. Sequencing those two observers would not prove a common held interval.

Add a distinct V7 diagnostic. In one `READ COMMITTED READ ONLY` transaction, acquire the existing 36 fixed SHARE locks, verify exact ordered source ordinal/name/checksum/state for migrations 1–31 and the post-31 tail, then read the cold catalog, thirteen-category zero census, complete active rows, quarantined runtime count and binding rows. Preserve V6 source byte-for-byte and copy its bounded read/check body into the separately versioned V7 path. Preload any source modules needed for V7 before lock acquisition. Return a frozen, separately hashed V7 snapshot with literal fixed-lock scope, full-journal identity and `released-at-return` labels, plus `authority:diagnostic-only`.

Bind V7 through the existing first/second held physical catalog passes and code-owned two-launcher private URL holder. Add only a separate zero-input V7 observer and authenticated `inspect-pre32-host-pair-v7 --json` verb. Preserve all V1–V6 shapes, active-binding behavior, source/build checks and sanitized refusal. A first-pass physical refusal is not database proof. Locks cease at return; this does not provide continuous process/service exclusion, full auxiliary writer coverage, retained-root qualification, positive execution ownership, admission authority or cutover permission. No migration, DB write, launchctl action, service switch, selected-dist/link change or worktree cleanup occurs.

## File Map

- `src/internal-production/baseline-legacy-database-census-v1.ts`: separate V7 held combined DB snapshot, duplicated bounded V6 read/check body, hash and labels.
- `src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts`: private qualified V7 callback using the agreed two-plist URL.
- `src/internal-production/baseline-positive-worktree-host-pair-v2.ts`: V7 validator, held pair, zero-input launcher flow and exact hash.
- `scripts/deployment-cutover.mjs`: separate authenticated V7 verb and sanitized refusal.
- `tests/internal-production/baseline-legacy-database-census-v1.test.ts`, `tests/internal-production/baseline-deployment-cutover-launcher-observation-v1.test.ts`, `tests/internal-production/baseline-positive-worktree-host-pair-v2.test.ts`, `scripts/__tests__/deployment-cutover.test.js`: RED/GREEN and regression coverage.
- `docs/superpowers/plans/2026-09-26-pre32-held-journal-pair.md`: verification and delivery record.

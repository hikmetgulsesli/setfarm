# Pre32 held physical/database diagnostic plan

> Root is the sole writer and PR delivery owner. Other agents may inspect/review only.

**Goal:** Bind the unchanged physical catalog, the pre32 zero-owner census, and four strict active-row sets inside one held physical interval and one read-only PostgreSQL snapshot, while retaining all blockers and diagnostic-only labels.

**Spec:** `docs/superpowers/specs/2026-09-25-pre32-held-physical-database-design.md`

## Constraints

- Preserve V1/V2/V3 public evidence shapes, current cutover default owner and service state.
- Launcher configuration supplies the only URL. Keep it private and validate both held configurations and PG environment before DB connection.
- Reuse V2 physical callback exact-once/awaited-return gate and V4 one-transaction observer. No second DB snapshot, caller-supplied path/row/zero assertion, blocker filtering, or owner grant.
- Worktrees, selected historical dist/CLI, and ignored runtime artifacts remain in place. No dirty-build/runtime-guard bypass.

## Task 1 — held launcher combined census

**Files:** launcher observation source and its focused test.

- [x] RED: prove combined method unavailable before qualification, exact URL agreement/ambiguity/PG-env refusal before DB effect, one combined call while held, drift/failure poison, bounded close and no credential in output/error.
- [x] GREEN: share the private validated target/import path between legacy and combined census; retain existing V1 result and state gates. Extend the default holder with the same serialized qualified/idle checks for combined census.

## Task 2 — physical/V4 envelope

**Files:** host-pair source and focused test.

- [x] RED: prove V4 observer runs once only between physical passes, unresolved blockers stay present, unchanged V2 child is object-identical to the V4 active rows, envelope is frozen/hash-bound/diagnostic-only.
- [x] RED refusal: duplicate/missing/late callback, malformed V4 shape/hash/count crossing, false V2 hash, physical drift or DB error never yields a pair. Import remains inert.
- [x] GREEN: validate V4 strictly, project its V2 child through unchanged V2 pair, and add zero-input code-owned host diagnostic with launcher qualification and `finally` close.

## Verification and delivery

- [x] Focused TDD tests, `npx tsc --noEmit`, pure/cutover packages, path/source manifest contracts, `git diff --check`. Final run: pure 117, cutover 384, manifest 18, serial genuine 43; English/path and TypeScript passed.
- [x] Independent read-only review; repair Critical/Important findings and rerun affected gates. Reviewer found none; minor PG environment, DB failure and concurrency coverage was added.
- [ ] Conventional commit, scoped PR, exact-head checks/review, SHA-bound merge, independent clean-main build. One sanitized host diagnostic only if the deployed build and selected historical installation remain preserved; record refusal honestly. Do not claim cutover.

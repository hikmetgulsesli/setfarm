# Task6A V2 Mission Control launcher hold plan

## Goal and File Map

Supply the missing third-launcher private hold/recheck prerequisite for a later source-authenticated Task6A V2 host adapter. It is causally necessary because live Mission Control is persistent/running while the V1 Setfarm launcher contract requires both entries idle. Keep V1/V7 outputs, the new V2 database snapshot, frozen migration digests, and live state unchanged.

- `docs/superpowers/specs/2026-09-26-task6a-v2-mission-control-launcher-hold-design.md`: narrowly selected design.
- `src/internal-production/baseline-task6a-mission-control-launcher-hold-v2.ts`: independent holder with pinned plist, strict local URL and loaded-state checks, sanitized public projection.
- `tests/internal-production/baseline-task6a-mission-control-launcher-hold-v2.test.ts`: fake OS and real temp file TDD tests.
- `src/internal-production/baseline-task6a-writer-database-snapshot-v2.ts` and its focused test: causal compatibility fix for the exact live passwordless local URL; the previous adapter incorrectly required a URL password although all three current plists omit it. This only removes the password-presence requirement; it retains exact local target, role, ambient `PG*`, transaction, timeout, and diagnostic-only checks.
- `package.json`: pure-suite enrollment.

## RED/GREEN sequence

1. Add import-inert and zero-input refusal tests; run focused RED on missing source.
2. Add valid running `KeepAlive` fixture with twelve exact environment keys, private token/URL, fixed paths, loaded-state environment, one PID, and temporary physical plist. Test frozen public output, role extraction, exact URL agreement, recheck and idempotent close.
3. Add refusal tests for missing/extra keys, local URL ambiguity, PID/state drift, missing loaded `keepalive`/`runatload`, loaded/plist URL/token mismatch, owner-only plist mode, changed plist bytes/metadata, closed access and cleanup uncertainty. Assert no private text or secret-derived hash in JSON/error.
4. Implement bounded, import-inert holder. Pin owner-controlled directory and regular plist through no-follow file descriptors, compare lstat/fstat and bytes on each recheck, parse bounded `plutil`/`launchctl` output under sanitized command environment, and close all descriptors on every acquisition failure. Use one stable error code. No DB/HTTP calls.
   Include the RED/GREEN passwordless-local regression in both the holder and prior DB snapshot adapter before claiming live compatibility; reject missing usernames and remote/ambiguous targets as before.
5. Run focused, pure, cutover, manifest, migration-digest, TypeScript and source contract checks; independent read-only review. Commit/push a scoped PR, observe exact-head GitHub comments/checks, and merge with SHA condition if sound.
6. Fast-forward preserved clean-main deployment clone, run normal guarded build, then no-write host/HTTP checks. Record diagnostic limits and next three-launcher DB/physical composition work.

Do not use dirty-build/runtime-guard bypasses; do not change roles, plists, live services, selected CLI, or preserved worktrees. The holder never creates a positive owner or writer fence.

## Verification record

The missing module was RED. Reviewer-found passwordless-local compatibility, owner-only token-plist permissions, and loaded `keepalive`/`runatload` properties were each tested RED before correction. The exact-head GitHub Codex review then identified that a failed `recheck()` or private URL agreement could be forgotten after outside state returned; two new tests were RED and the holder now stays invalid irreversibly. Focused holder plus DB adapter tests are 45/45; post-fix pure 240/240, cutover 424/424, manifest 18/18, migration digests, and TypeScript noEmit passed. Sanitized read-only live hold/recheck/close succeeded with role `setrox`, and the corrected DB adapter's private live read-only snapshot reported database owner/session role `setrox`, superuser and bypass/creation flags true, and one other same-role backend at that instant. These are diagnostic samples, not writer exclusion or cutover authority. Independent read-only re-review had no other Critical/Important issue. Guarded build awaits clean main after PR delivery.

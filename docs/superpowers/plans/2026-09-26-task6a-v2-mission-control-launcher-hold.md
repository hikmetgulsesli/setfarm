# Task6A V2 Mission Control launcher hold plan

## Goal and File Map

Supply the missing third-launcher private hold/recheck prerequisite for a later source-authenticated Task6A V2 host adapter. It is causally necessary because live Mission Control is persistent/running while the V1 Setfarm launcher contract requires both entries idle. Keep V1/V7 outputs, the new V2 database snapshot, frozen migration digests, and live state unchanged.

- `docs/superpowers/specs/2026-09-26-task6a-v2-mission-control-launcher-hold-design.md`: narrowly selected design.
- `src/internal-production/baseline-task6a-mission-control-launcher-hold-v2.ts`: independent holder with pinned plist, strict local URL and loaded-state checks, sanitized public projection.
- `tests/internal-production/baseline-task6a-mission-control-launcher-hold-v2.test.ts`: fake OS and real temp file TDD tests.
- `package.json`: pure-suite enrollment.

## RED/GREEN sequence

1. Add import-inert and zero-input refusal tests; run focused RED on missing source.
2. Add valid running `KeepAlive` fixture with twelve exact environment keys, private token/URL, fixed paths, loaded-state environment, one PID, and temporary physical plist. Test frozen public output, role extraction, exact URL agreement, recheck and idempotent close.
3. Add refusal tests for missing/extra keys, local URL ambiguity, PID/state drift, loaded/plist URL/token mismatch, changed plist bytes/metadata, closed access and cleanup uncertainty. Assert no private text or secret-derived hash in JSON/error.
4. Implement bounded, import-inert holder. Pin owner-controlled directory and regular plist through no-follow file descriptors, compare lstat/fstat and bytes on each recheck, parse bounded `plutil`/`launchctl` output under sanitized command environment, and close all descriptors on every acquisition failure. Use one stable error code. No DB/HTTP calls.
5. Run focused, pure, cutover, manifest, migration-digest, TypeScript and source contract checks; independent read-only review. Commit/push a scoped PR, observe exact-head GitHub comments/checks, and merge with SHA condition if sound.
6. Fast-forward preserved clean-main deployment clone, run normal guarded build, then no-write host/HTTP checks. Record diagnostic limits and next three-launcher DB/physical composition work.

Do not use dirty-build/runtime-guard bypasses; do not change roles, plists, live services, selected CLI, or preserved worktrees. The holder never creates a positive owner or writer fence.

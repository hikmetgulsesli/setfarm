# Task6A V2 Mission Control launcher hold design

## Decision

The existing V1 launcher holder authenticates two intermittent, idle Setfarm LaunchAgents, but Mission Control is a separate persistent, running `KeepAlive` LaunchAgent. Appending it to the V1 two-idle array would change a frozen diagnostic contract and reject the healthy host. The Task6A V2 database snapshot is also not yet composable with a source-authenticated third launcher. Build a separate, narrow Mission Control hold/recheck capability before the full three-launcher physical/DB host adapter. Do not alter V1/V7, migrations, plists, or selected services in this slice.

## Contract

`holdTask6aMissionControlLauncherV2()` is zero-input and import-inert. It acquires owner-controlled directory and owner-only plist file descriptors without following symlinks; verifies the exact Mission Control plist shape, program, working directory, twelve environment names, fixed nonsecret values, nonempty private token, and a strict local `setfarm` PostgreSQL URL, including the live passwordless form; checks the loaded `launchctl` label, running state, loaded `keepalive`/`runatload` properties, one active PID, executable/arguments, and loaded/plist environment agreement. It retains private bytes, URL and token only inside the holder. `recheck()` repeats file metadata/bytes and loaded-state checks; `assertSameDatabaseUrl(raw)` requires exact equality with the private held URL and returns only the decoded role name; `close()` releases every descriptor and fails closed on uncertain cleanup. Calling after close refuses. Errors are stable and sanitized. No raw URL/token or hash computed from secret bytes is exposed in the observation.

The frozen observation is `diagnostic-only`, `cutoverAdmission:not-granted`, `physicalIdentityProvenance:unverified`, and reports only the exact label, running/one-active status, role name, and a canonical hash of that public projection. A running LaunchAgent configuration is not a verified process owner or continuous writer fence. Mission Control service identity, its listener, the DB snapshot, and the physical two-pass catalog will be joined in a later separately versioned host adapter. This holder cannot grant Task6A/zero-owner/migration32/cutover authority.

## Test and File Map

- `src/internal-production/baseline-task6a-mission-control-launcher-hold-v2.ts`: separate import-inert private holder.
- `tests/internal-production/baseline-task6a-mission-control-launcher-hold-v2.test.ts`: RED/GREEN fake launchctl/plutil plus real temporary plist, exact shape, URL/token redaction, URL mismatch, loaded/plist drift, lifecycle/cleanup, import inertness.
- `src/internal-production/baseline-task6a-writer-database-snapshot-v2.ts` and its focused test: remove only the unintended URL-password requirement so the existing strict local diagnostic adapter accepts the observed three passwordless launcher URLs; retain missing-user, remote-target, ambient-`PG*`, read-only transaction, and refusal guards.
- `package.json`: include focused test in pure internal-production suite.
- `docs/superpowers/plans/2026-09-26-task6a-v2-mission-control-launcher-hold.md`: implementation/verification plan.

No live plist, process, database, access-control, worktree, or service mutation is in this PR. The authenticated controller-role query remains a separate prerequisite before feeding the pure topology preflight; do not infer `controllerRole` from fixture defaults.

# Selected fresh database and configuration implementation

Approved scope: full isolated fresh Setfarm/MC installation preserving old data. Root remains the sole writer. This is Unit2a of the accepted design, following durable commit reconciliation. Reviewers approved splitting database/configuration preparation from operational activation and entrypoint composition.

## Scope and boundary

Select one private SETFARM_INSTALLATION_DIR before legacy env loading. Treat it as a locator, never as database/operational authority. Strictly read the committed private records; derive frozen URL and instance paths; reject conflicting explicit targets and special/test profiles. In db-pg create a privately owned restricted client, verify the actual clean executing source and connected database, journal33, role identity/policy and schema catalog on that exact client, then publish the client only as database-verified. This result is not operational ready. No service entrypoints, process starts, workflow admission, administrative connection, DDL or grants are added in this unit.

Normal selected getSql/pgQuery must refuse before preparation. Selected pgMigrate remains forbidden for the entire process lifetime. Reject incompatible test/special configuration without changing targets. These no-effect request refusals need not poison an otherwise valid read-only preparation. Actual verification failure, detected retarget and close permanently refuse further selected SQL acquisition. A closed selected process must not reopen the legacy URL. Repeated successful preparation may return its existing promise/client; concurrent close invalidates the preparing epoch before any continuation. Without selection, existing fallback behavior remains unchanged. Keep original Task6A/deployment guards untouched. Gateway18789 remains the existing host service: explicitly pin its existing default ~/.openclaw state/config paths and reject conflicting overrides; Setfarm workflow/runtime/artifact paths are private instance paths. Do not imply that the external gateway is a separate new installation.

## File map

- New src/installation/fresh-installation-selection-v1.ts: synchronous private record/locator snapshot, immutable derived URL/paths, conflict checks and unchanged-selection assertion. No connection or effects.
- src/runtime-config.ts: capture selection before ordinary env fallback; selected mode skips legacy .env files and uses the derived configuration. Preserve unselected loading and special inherited modes.
- src/db-pg.ts: selected preparation state and owned SQL client/epoch, exact actual verification; reject implicit/default migration and incompatible profiles, sticky failure/close. Do not call this API from entrypoints yet.
- src/installer/paths.ts, src/installer/runtime-identity.ts, src/lib/logger.ts, src/installer/events.ts: use the selected runtime root when selected, retaining exact unselected paths. Only pure path resolution changes.
- New tests/installation/fresh-installation-selection.integration.test.ts and tests/installation/fresh-installation-test-support.ts; refactor tests/installation/fresh-installation-bootstrap.integration.test.ts to import that exact shared provisioning helper. Use the real copied committed source fixture and actual fresh DB/role; no production test flag or fake authority. Child processes isolate module/environment state.
- Existing runtime-config/path focused tests and relevant Task6A refusal tests must retain behavior.

## Sequence

1. Add RED integration for missing selected-preparation API: getSql refuses before preparation, exact runtime URL/paths selected without legacy env, actual restricted read succeeds only after preparation, then close prohibits getSql/pgMigrate/reprepare. Test should fail clearly, never skip missing API.
2. Add selector and owned SQL preparation with no entrypoint effects. After each awaited verification stage assert source/record/selection and phase/client ownership. Close failed owned clients with bounded timeout and fixed errors; never log credentials.
3. Genuine negative cases: conflicting PG URL/paths; unsafe/missing committed records; mutated records/catalog; special/test profile conflict; later environment retarget; verification failure and close cannot restore default DDL. Test no new tables/journal effects and distinct instance paths. Reuse DBs serially, OID-checked teardown,8GiB disk floor.
4. Run affected real integration + typecheck and existing paths/config/Task6A guard tests. Perform independent source review, scoped commit/push/PR, exact-head cloud review, merge and stock clean-main build.

## Following Unit2b

Add a strict fresh source/build+manifestA authority variant and actual DB resolver/run-readiness branch, owner-controlled null-to-A CAS, narrow business DML grants and mechanical protection of migrationApplication/head evidence. Provision MC five tables/sequence/indexes/seeds through source-owned contract before activated catalog binding. Preserve schema-stage hash as history. Only then compose selected preparation and operational verification before all CLI/daemon/spawner/MC effects, pin exact child release/installation readiness, transition launchers and verify ports/heartbeat/real clean workflow.

## Verified Unit2a checkpoint

This change is causally required to run the approved isolated installation without accidentally using legacy database/environment/path state. It prepares the database/configuration boundary only; entrypoints and operational activation remain pending.

- Genuine missing-API integration RED: c66246 (exit1), after real source fixture/fresh schema provisioning and exact teardown; no missing API skip.
- Selected preparation initial GREEN: 801adb,4pass0fail0skip. Focused typecheck94e8bd exit0.
- Expanded selected/database/Task6A/dashboard-reader/event-projection run: 8614a0,103pass0fail0skip0cancel. This run predates the following two review corrections.
- Review corrections: validate selection before both OpenClaw path getters; handle synchronous client construction failure by permanently refusing preparation. Affected getter regression6acc47,1pass0fail0skip; affected one-client integration07c834,1pass0fail0skip after final constructor correction. Final noemit04661e exit0 and whitespace9fc273 exit0.
- Independent source reviews: oracle getter correction C0/I0/M0; resource final narrow review8f2141 C0/I0/M0. No stock build, service startup or operational readiness is claimed for this unit.
- Freeze this unit in a local scoped commit before switching the same sole writer back to the parent bootstrap branch. PR285 has two subsequently discovered initial-catalog policy findings (current database ACL and inert new nonpublic routines), which must be corrected/reviewed before parent delivery. Then incorporate the corrected parent and deliver Unit2a through its own reviewed branch.

- Corrected parent4f3a581a incorporated by429dc12e. Final complete selected-suite
  rerun73cdd8:6passed/0failed/0skipped/0cancelled,28.503735s, covering both narrow
  corrections and exact current parent catalog policy. Post-merge noemit and
  whitespace51b5dd exited0. Library delivery remains separate from activation.

- PR286 finding4306976919 is a causal path-isolation correction: default run
  repository selection uses runtime-identity.resolveProjectsRoot, which bypassed
  runtimeConfig.projectsDir. Route that resolver through the captured selection
  and pin its three existing root-env aliases to the same derived projects root.
  Preserve unselected explicit-env/default behavior and explicit repository inputs;
  assert selection before resolving runtime identity even with an explicit repo.
  Add genuine selected default-repository, alias-conflict and late-retarget checks.
  Parent38b9ee89 compatibility correction incorporated before this regression.

- Default-project-path RED07053e proved the actual resolver selected~/projects.
  Correction c1255a:8passed/0failed/0skipped/0cancelled in37.362258s across the
  full selected suite, now including default identity and all3 alias retargets.
  Final noemit/digest/whitespacee92012 exited0. Both independent path correction
  reviews returned C0/I0/M0. This proves default routing, not universal containment
  of intentionally explicit repository paths or service operational readiness.

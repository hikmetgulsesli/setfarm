# Fresh V3 admission and runtime correction

A real compiled fresh installation on e9fb2509 reproduced two system defects:
the first listener reservation stalls with installed postgres3.4.8 when
fetch_types is false, and V3 preflight attempts a legacy journal SHARE lock that
the deliberately read-only runtime role cannot acquire. Original test state and
failure captures are retained; test-owned database/role cleanup completed.
These fixes are causally required for the same working fresh Setfarm objective.

The selected runtime also explicitly executes Codex, while V3 profiles and the
evaluator still read legacy MiniMax/OpenClaw configuration. Bind the selected
profile to its captured explicit raw model and actual argv, without inventing
remote model/provider evidence. Unsupported selected fallback refuses. Preserve
legacy profiles, all33 migration/catalog/activation verification, complete
eight-case coverage and genuine release GO requirements.

## File map

- src/installation/fresh-installation-spawner-listener-v1.ts: fixed SELECT1
  driver warm-up before reserve; verify the same reserved backend and all four
  real channels afterward exactly as before.
- src/installation/fresh-installation-v3-admission-v1.ts: selected compiled
  read-only full migration and activation verification on the supplied client;
  exact origin/source attestation only after verification. Legacy verifier and
  attestation order unchanged.
- src/installation/fresh-installation-v3-profile-v1.ts: inert import, captured
  runtime/model, sticky retarget refusal, qualified Codex adapter profile and
  exact raw model arguments.
- src/execution/activation-preflight.ts: existing migration callback uses that
  fixed adapter; all remaining checks and publication unchanged.
- src/execution/operational-retry-directive.ts: selected primary profile comes
  from the actual captured Codex model; selected fallback explicitly refuses.
- src/execution/v3-implementation-handoff.ts: lazy existing primary default.
- src/spawner.ts: captured selected policy and immutable V3 handoff/argv agree.
- src/evals/convergence-runner.ts: same migration verification, owned selected
  preparation/client/cleanup, actual selected profile, physically private output
  directory/store checks; legacy behavior and full-suite GO gates retained.
- tests/installation/fresh-installation-v3-admission.test.ts and
  tests/installation/fresh-installation-v3-profile.test.ts: actual function-body
  components and explicit DATA ports, not operational authority.
- tests/installation/fresh-installation-unit3-controls.test.ts: warm-up before
  reserve while preserving current same-backend/channel assertions.
- tests/installation/fresh-installation-spawner-listener-driver.integration.test.mjs:
  exact installed-driver isolated-PG controls in separate held diagnostic
  children; first reservation remains pending after authentication, fixed warm-up
  permits same-backend reserve and actual owned pool close.
- evals/suites/product-convergence-codex-v1.json: all eight original tasks,
  oracles and limits unchanged; only actual selected provider/model fields.
- This plan records scope and actual validation without claiming live readiness.

## Verification and delivery

Preserve genuine old compiled journal SQL42501 and listener deadline results.
Add focused tests before implementation and retain actual RED, then apply the
reviewed minimum source correction. Require focused GREEN plus adjacent
activation/convergence/profile/release-gate checks, typecheck and source contracts.
The isolated driver diagnostic is separate from actual compiled listener
qualification. Review exact staged composition and deliver through a scoped PR,
new-head cloud review and normal merge. Build stock clean main, then run a NEW
Unit3 qualification with unchanged assertions and fresh receipt names, and a
NEW actual selected V3 preflight GREEN. No dirty/skip flags, journal UPDATE grant,
forged admission, partial-suite GO or historical Native/PM qualification.

Final persistent installation must use that exact qualified release and remain
separate from disposable test installations. Real services, HTTP/DB joins,
maintained workflow/agent execution and genuine complete-suite release outcome
remain actual runtime gates. Existing project data and unknown effects remain
preserved.

## Source verification evidence

The actual old compiled V3 negative control matched journal SQL42501 with the
restricted role, failed preflight and unverified evaluator state; owned test
cleanup completed. The new22-case component suite first returned20 failures
and2 passes, including actual old callbacks/profile/default behavior; missing
new helpers alone are not the causal proof. After the reviewed patches all22
passed. The three adjacent pure suites also passed all13 cases. TypeScript,
version, English2155, path1043, migration digests and12 MC artifacts passed.
Independent exact source, test, suite and listener reviews had no findings.

The new installed-driver regression uses the existing isolated-PG wrapper,
which requires a clean committed checkpoint. Run it and the adjacent actual-PG
suites after the scoped checkpoint commit and before push/review delivery. Do
not weaken the wrapper or source scope checks to run from a dirty tree.
Actual new-main preflight GREEN, compiled QA4, services and workflow remain open.

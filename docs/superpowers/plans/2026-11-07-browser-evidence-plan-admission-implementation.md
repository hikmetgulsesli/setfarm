# Browser evidence plan admission implementation

Goal: give the model precise PLAN feedback for the two impossible contracts observed in the real game run.

Spec: `docs/superpowers/specs/2026-11-07-browser-evidence-plan-admission-design.md`.

- [x] Add failing schema and real PLAN compiler regressions for numeric rendered values and a persisted initial-state no-op. Preserve positive controls for valid DOM and invocation channels and a genuinely changing persistence target.
- [x] In `product-spec-v2.ts`, reject browser-rendered `value` equality expectations outside string/null. Leave invocation-output JSON types unchanged.
- [x] In the existing persistence-effect validation, reject only the bounded proven no-op scenario. Resolve present initial JSON pointers locally; preserve unknown/dynamic/scenario cases for existing validators and runtime evidence.
- [x] Run the two focused test files, noEmit, the existing semantic-digest check and diff check. Regenerate only genuine changed source closures if needed.
- [ ] Obtain independent review, deliver through a PR, perform the combined clean-main stock build, and start the next actual production run. Preserve failed run2 and the owner-fix engine-coverage limits.

No retry-budget increase, coercion, test/runtime-guard bypass, new storage framework, isolated database, manual generated-app repair or existing-origin rewrite.

Original RED: PID90482 exit1, three expected failing regressions. Final focused tests: PID99581 exit0, 31 passed, zero skipped. NoEmit99579, digest99016, diff99582 all exit0; generated digests were already current. Offline validation99580 exit0 reads the immutable original ProductSpec34e0e3dd and emits the four precise admission issues covering its three failed predicates, with unchanged artifact bytes. An initially absent persisted value can become the real zero score without changing the task's score.

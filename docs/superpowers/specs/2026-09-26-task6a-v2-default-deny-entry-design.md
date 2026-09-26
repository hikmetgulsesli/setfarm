# Task6A V2 default-deny entry design

## Decision and authority boundary

The existing Task6A V1 `prepare-current-entry` and `resume-current-entry` call the exact-poison quarantine prehook before a new admission check could run. Their behavior and the documented operator shell are frozen. Do not insert a purported V2 gate inside or after either V1 function, and do not reroute a V1 verb to a V2 wrapper. Introduce a separately named, explicitly selected V2 command surface that refuses before it imports or calls any V1 writer.

This slice establishes an executable routing and default-denial contract, **not** a continuous DB/OS writer fence, positive physical ownership, a current-entry effect gate, Task6A readiness, or a selected live operator path. The V1 shell continues to call V1 until a later reviewed selection change. Today's held V2 host observations remain diagnostic-only/not-granted/unverified and cannot mint admission. The shared superuser/database-owner role and same-UID process topology remain unacceptable for positive admission.

## Executable boundary

Add a distinct `acceptance:task6a-current-entry-v2` npm script that invokes a distinct zero-input CLI. Its exact verbs are `prepare-current-entry-v2 --json` and `resume-current-entry-v2 --json`. Both call an import-inert V2 controller entry and terminate nonzero with the stable sanitized `TASK6A_V2_ADMISSION_NOT_GRANTED` code and no stdout. Invalid command shapes terminate nonzero with a separate usage code before controller import. No caller evidence, flag, environment toggle, diagnostic hash, or prior V1 record can change the result. The V2 source graph has no import of the V1 current-entry controller or effect modules. This contract prevents accidental affirmative interpretation of a JSON refusal as an operation pair.

The future positive V2 implementation requires an unforgeable private admission handle bound to an authenticated, continuously held DB **and** OS writer exclusion, exact operation identity, current physical-owner evidence, and durable journal state. The handle must be obtained before any current-entry prepare or resume mutation, and rechecked immediately before each V2 side effect, including prehook, schema, service, and producer effects. It may not delegate to effectful V1 prepare/resume. The first live V2 selection is a separate reviewed operator step after those proofs and least-privilege transition; this PR does not select it.

## File map and verification

- `src/internal-production/baseline-task6a-current-entry-controller-v2.ts`: no-input refusal-only V2 controller.
- `src/internal-production/baseline-task6a-current-entry-cli-v2.ts`: separate strict V2 CLI entry, no V1 imports.
- `tests/internal-production/baseline-task6a-current-entry-controller-v2.test.ts`: default denial, malformed inputs and source graph, poison V1 fixture, no sentinel effects.
- `package.json`: one additive npm entry and test enrollment.
- This design and its adjacent implementation plan: explicit future authority and scope.

No migration, role/grant/credential, plist/service, selected CLI symlink, V1 source or operator shell, current-entry store, or live cutover state changes.

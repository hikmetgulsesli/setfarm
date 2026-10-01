# Private Read-Only Login SCRAM v1 Design

## Causal objective and current evidence

PR262 repaired fresh execution-root ownership and merged as
a5654e98a204229aefbe6bada684ad2dfe590be3. Its new clean-main guarded build and
merged88 ownership tests passed. The fifth genuine ALL already closed1 with two
independent28P01 authentication failures in base-schema/current-journal read-only
integration tests. Both create a new restricted LOGIN without PASSWORD and then
use a Unix socket client without a password, against a constructor-owned private
cluster whose local and TCP HBA both require SCRAM. This test-only mismatch must
be fixed before another genuine ALL; production verifier behavior is unchanged.

Root uses standing bounded authorization; user asked root to choose and proceed
without repeat questions. Root sole writer, independent agents read-only. This
design is self-reviewed before code and committed with its implementation plan.

## Alternatives and decision

1. Reuse the private constructor's already-randomized64hex password only for its
   new ephemeral restricted LOGIN roles. The unchanged journal redactor already
   covers that password and admin URL, including SQL/server error output. Keep
   all flags/grants identical. This is the smallest correction and selected.
2. Generate separate restricted-role passwords. This requires an authenticated
   secret-enrollment/redaction protocol for server/test output and expands the
   root fix unnecessarily. Not selected; password separation is not a property
   these catalog-verifier fixtures claim.
3. Weaken local HBA to trust or reuse a live/retained cluster. Forbidden. Neither
   is a valid test or a safe completion path.

The reused random password is not a role-separation or security boundary claim.
No live credential, role, privilege, deployment selector or native policy changes.

## Authentication contract

Each test obtains the existing explicit private admin URL. Decode its password
and require exactly64 lowercase hex characters with a boolean assertion and
literal non-secret error message, before constructing a SQL client. Never print
the password, admin URL, SQL containing it, or arbitrary driver errors manually.
Existing private data-directory, non5432 port and socket joins remain. Add an
observed password_encryption=scram-sha-256 check before role/database effects.

Append PASSWORD to the existing random restricted LOGIN CREATE ROLE statement,
using only that shape-validated password. Supply it to all four restricted
clients in each file, including drift/revocation reconnects and missing-target
refusal. NOLOGIN writer role is unchanged. Preserve positive catalog fingerprints,
restricted privilege assertions, negative drift/revocation cases, cleanup and
primary/cleanup failure ordering. No production source change is required.

## Closed focused private execution mode

Existing isolated/router harnesses do not create a private server. Add exactly
one mode, readonly-verifiers, to the existing constructor-owned private wrapper.
Its immutable test argv is:

```text
--import tsx --test --test-concurrency=1
tests/execution-attempts/base-schema-readonly-verifier-v1.integration.test.ts
tests/execution-attempts/contract-spine-readonly-verifier-v1.integration.test.ts
```

Dispatch with the existing owned process.execPath; no caller-supplied command,
filename, root, port, credentials or environment capability. findings still runs
the exact npm test:findings command; all still runs the exact npm test command.
Unknown/extra args fail before private root/SQL/subprocess effects. Reuse all
unchanged preconditions, fresh root/port/password creation, SCRAM/identity fences,
FD journal/redaction, original-child ownership, actual exit+close/sixEOF,
two quiescence samples, admin end, server close and strict terminal protocol.
The new mode is focused integration evidence, never ALL or production admission.

## File Map (exact6 paths)

| Path | Responsibility |
| --- | --- |
| scripts/run-private-postgres-tests.mjs | Fixed focused mode only; findings/all and lifecycle unchanged |
| scripts/__tests__/private-postgres-test-cluster.test.js | Actual plan/CLI refusal and malformed login consumer regressions |
| tests/execution-attempts/base-schema-readonly-verifier-v1.integration.test.ts | Ephemeral LOGIN authentication, unchanged base catalog proof |
| tests/execution-attempts/contract-spine-readonly-verifier-v1.integration.test.ts | Ephemeral LOGIN authentication, unchanged current journal proof |
| docs/superpowers/specs/2026-10-01-private-readonly-login-scram-v1-design.md | Causal contract and boundaries |
| docs/superpowers/plans/2026-10-01-private-readonly-login-scram-v1.md | TDD/effect-review/delivery checkpoints |

## Verification and effect gates

Baseline existing wrapper/journal tests102PASS0SKIP3831.742833ms on the new clean
isolated branch. First add focused plan tests and malformed-login actual consumer
tests; observe RED before implementation. Add only the fixed mode, run pure
wrapper/journal tests and review. Commit the clean focused harness before any
real private cluster invocation. Per-invocation independent exact-head C0/I0/M0,
fresh source/dependency/host/primary/resource checks are mandatory. Focused mode
does not claim or require a compiled release; guarded build follows merged main.

Run the unchanged two integration bodies through the new fixed mode to observe
real SCRAM28P01 RED on a fresh constructor-owned cluster. Freeze source/docs/
dependencies until owned closure, strict complete journal and outer exit are
observed. Only then implement passwords. Run pure regressions, commit, obtain
new per-invocation clearance and invoke the same mode on another new cluster.
Require both full integration bodies PASS0SKIP plus complete cleanup/lifecycle
and primary posthealth. Do not adopt, query, stop or clean an old cluster.

Normal scoped PR delivery with independent exact-head and actual remote review/
security gates; no admin bypass, force, deletion or direct main commit. New
clean-main synchronization/guarded build and actual source/build identities.
Only afterward consider a separately reviewed genuine unchanged ALL. Protected
bootstrap/origin/fence/genesis/32/33 and live cutover remain unproven/fail-closed.

# Restart Helper Physical Fixtures Implementation Plan

> **Execution:** Primary-owner minimal test-first fixture correction, independent
> read-only diagnosis/review; no production behavior changes.

**Goal:** Run the existing physical restart-helper witnesses honestly under the
isolated runner's sanitized environment.

**Cause:** The isolated runner omits TMPDIR/TMP/TEMP. On this Darwin host os.tmpdir
then returns symlink `/tmp`, resolving to `/private/tmp`. Two fixtures injected
the lexical path as their code-owned workspace. The physical ancestor guard
correctly refused it before helper dispatch. Other physical fixtures already use
realpathSync. This is necessary broad-gate qualification for the approved
preserved-deployment cutover, not a reason to weaken the production guard.

## File map

- Modify only the two positive fixture roots in
  `tests/internal-production/baseline-service-restart-helper-v1.test.ts`.
- No source guard, runner environment, P3 capability or assertion changes.

## Steps and evidence

- [x] Full isolated helper suite completed17/19 with two ancestor-identity
  failures; test databases cleaned. Preserve log2026-09-16-restart-helper-3449f606.log.
- [x] Reproduce both failures cheaply with TMPDIR absent and no DB environment:

```sh
env -u TMPDIR -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL node --import tsx --test --test-name-pattern='^P4 helper binds fixed pre-schema action$|^P4 restart helper dispatches at most once$' tests/internal-production/baseline-service-restart-helper-v1.test.ts
```

- [x] Canonicalize only the two disposable fixture roots:

```ts
const fixture = realpathSync(mkdtempSync(path.join(tmpdir(), "setfarm-p4-helper-")));
const fixture = realpathSync(mkdtempSync(path.join(tmpdir(), "setfarm-p4-baseline-helper-")));
```

- [x] Rerun the exact failing command GREEN (2/2,6303.086167ms), retain at-most-once/forged-capability
  and insecure-ancestor assertions, and independently review the two-line diff
  (no findings).
- [x] Checkpoint then repeat complete helper file through unchanged isolated
  runner alone. Continue sequence/startup qualification only after full result.

Full isolated rerun atd7fc4336 passed19/19,zero failures/skips36644.202875ms.
Runner removed its primary/template prefix3bb6ad469e61bf7c31f1d866. Original failed
log is retained; successful log is workspace logs/2026-09-16-restart-helper-d7fc4336.log.

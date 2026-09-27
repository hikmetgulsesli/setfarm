# Task6A code-owned diagnostic receipt host

Root is the only writer. PR #222 composes real held physical/source identity
with the read-only PostgreSQL adapter, but its scope and URL remain supplied
by a caller. Bind those inputs to the already-held Setfarm and Mission Control
LaunchAgents without changing runtime state or granting ownership.

## Decision

Add a private method to the qualified default Setfarm launcher holder. It
accepts only a genuine held MC capability and one runtime worktree path. Both
held Setfarm launcher URLs must be identical; the genuine MC holder must
authenticate that same URL and role before and after the composer. Derive the
workspace only from the held account home and code-owned resolver. Keep the
entire composer inside one `observeQualifiedDatabase` interval, without
nested database-method calls. A separate import-inert code-owned wrapper
acquires, qualifies and closes both holders, accepting only the worktree path.

## File Map

- `src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts`:
  add the private qualified `observeTask6aHeldReceiptCandidateV1` method,
  checked before and after the diagnostic composer and returning only its
  unpublished candidate. Never expose a URL or credential.
- `src/internal-production/baseline-task6a-held-receipt-host-v1.ts`:
  import-inert one-argument code-owned wrapper. Acquire both real holders,
  check expected labels, qualify passive Setfarm home, invoke the private
  method, recheck and close both holders on every path. Collapse failures to
  one fixed private-data-free code.
- `tests/internal-production/baseline-deployment-cutover-launcher-observation-v1.test.ts`:
  RED/GREEN held-launcher fixture for genuine/forged MC, URL and role drift,
  qualification, scope, composer failure and secret-free output/errors.
- `tests/internal-production/baseline-task6a-held-receipt-host-v1.test.ts`:
  RED/GREEN import inertia and fake-holder close/ordering behavior.
- `package.json`: register the new wrapper test in the pure suite (the
  launcher test is already in the cutover suite).

This remains a diagnostic, sampled observation. The database transaction ends
before final physical checks, and neither old same-UID writers nor current
owners are continuously fenced. No receipt publication, owner admission,
live role/grant/credential, service or selected CLI change. Verify focused
tests, TypeScript, pure/cutover and manifest suites, independent read-only
review, exact-head PR review, clean-main build and host HTTP state.

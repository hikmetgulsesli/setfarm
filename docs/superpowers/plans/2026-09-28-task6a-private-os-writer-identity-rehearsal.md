# Task6A isolated OS writer-identity rehearsal

## Causal boundary

The approved Task6A transition requires a mechanical OS writer fence before
guarded 32/33 and positive owner admission. The live selected CLI and manual
paths still run as `setrox`, which can use passwordless sudo; mode bits under
that same identity do not fence them. Private PostgreSQL 17 tests already show
an old, held restricted login denied on four core tables, but no real
distinct-UID filesystem negative rehearsal exists.

## Contract

- This is an opt-in, macOS-only test of two existing unprivileged identities,
  `nobody` as old writer and `_www` as intended successor. The primary test
  runner may use sudo only to launch those identities and change the owner of
  a child of the newly created `/tmp/setfarm-task6a-os-fence.*` fixture.
  Its runner-owned parent is `0711`: both identities can traverse but neither
  can rename the child path used by privileged `chown` and cleanup.
- First transfer the empty fixture to the old identity and prove its child
  can write. Then transfer that exact directory to the successor. Afterward,
  an actual old-UID child must fail to create or alter a file, fail to
  sudo into the successor, and an actual successor-UID child must create the
  intended file. Assert exact distinct UIDs, path/owner/inode preservation,
  and no old-writer artifact.
- Cleanup returns ownership of only the verified fixture directory to the
  runner and removes only that fixture. Never touch a user/deployment/runtime
  worktree, service, credential, role or LaunchAgent.
- The test proves an *isolated mechanism*, not the live fence. In particular
  the live `setrox` identity retains sudo. An old process holding a writable
  file descriptor before the directory ownership transfer can keep writing;
  the test should demonstrate that residual and require old-session/process
  drain in a real transition. Do not admit Task6A, promote the private create
  receipt to owner, or run guarded32/33 from this result.

## RED/GREEN and delivery

First run an opt-in test with the second ownership transition absent: the
old-UID write must succeed and the expected denial fail (RED). Add only the
fixture ownership transfer, then prove old direct write and privilege escalation
denied, successor write succeeds, cleanup exact, and default invocation
skips. Run TypeScript, source manifest/digest, independent read-only review,
exact-head PR review, then clean-main build and merged-main opt-in fixture.

## File Map

- `tests/internal-production/task6a-private-os-writer-identity.test.ts`:
  exact disposable fixture, OS identity preflight, direct child probes and
  bounded cleanup.
- `package.json`: explicit opt-in test script, never part of an ambient test.

# Task6A private child authority rehearsal

## Boundary and decision

Current Setfarm agent spawn inherits `SETFARM_PG_URL` and ambient environment.
The separate private PostgreSQL old-login denial and macOS OS-identity tests
do not prove what one actual child can do under both constraints together.
The next bounded slice is an opt-in, disposable integration test that launches
real harmless child processes under distinct existing macOS UIDs and dedicated
PG17 roles. It does not edit the ordinary spawner or launchd service and is
not a live cutover or owner/admission receipt.

The fixture creates its own uniquely named disposable PG17 cluster under
`/tmp`, with SCRAM authentication, a generated credential kept out of logs
and Git, and a loopback-only non-5432 port. It creates one isolated database
and random scoped roles;
it uses a unique `/tmp` root with exact inode/path/owner checks. A successor
child receives only a path to an OS-restricted credential file, not a password
on argv or in test logs. It must prove effective UID/PG login, read a benign
row, and receive permission denial for representative DML/DDL and old-owned
filesystem paths. An old child must be denied successor credential access,
successor-owned path writes, and revoked linked-run writer DML. No live URI,
service PID, selected CLI, user project or historical worktree is touched.

This is a combined mechanical rehearsal of a proposed child boundary. It does
not claim the production spawner uses that profile; production still passes
its privileged URL. The next reviewed slice must wire a fail-closed private
launch profile at the actual spawner spawn seam, then prove it under the same
fixture before any live transition.

## Fail-closed tests

- Require explicit test opt-in, exact `/private/tmp/setfarm-task6a-child-authority.*/data` identity,
  loopback non-5432 private cluster and `sudo -n` access to existing `nobody`
  and `_www` UIDs. Refuse otherwise before creating roles/files. Stage and
  hash-verify the child script in a traversable temporary path; the repository
  worktree is not traversable by those UIDs.
- Prove a baseline old capability in rollback-only scope, then revoke it and
  prove denial in the real old child. No marker row remains.
- Prove the successor child has only its scoped credential and cannot use the
  old owner's filesystem path or perform out-of-scope SQL writes/DDL.
- Cleanup only identified disposable files/roles/database; preserve and
  report anything whose ownership or identity cannot be revalidated.

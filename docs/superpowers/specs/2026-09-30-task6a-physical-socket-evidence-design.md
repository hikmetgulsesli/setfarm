# Task6A Physical Socket Evidence Design

## Causal scope and chosen approach

PR245 delivers single-backend loss fencing, not socket ownership. PR244 fixes
the descriptor's source but does not authenticate its running socket. Both are
needed by the owner-approved Task6A protected startup. This slice proves the
remaining physical socket prerequisite without publishing a DB pool or claiming
readiness. Root alone writes; reviewers investigate read-only. All old paths,
worktrees, services, roles, deployments and production namespace remain intact.

A leaf-only stat misses parent substitution and ACLs; a descriptor plus role
name is not a running-server observation. Choose immutable root ancestry,
descriptor holds, exact search-only server-owned directory and socket metadata,
with sticky revocation and actual private peer evidence. Root administrator and
the separately excluded PostgreSQL OS identity are trusted, not mechanically
excluded arbitrary-root actors.

## Interfaces and trust boundaries

`holdTask6aSocketPhysicalEvidenceV1(transport:unknown, serverOsUid:number,
runtimeOsGid:number)` is import-inert, macOS-only, diagnostic physical evidence.
Three exact arguments, existing strict transport parser, nonroot identities,
server UID different from runtime, actual process real/effective UID and GID
matching runtime. No DB/environment access and no socket connection. It returns
frozen `{observe,recheck,close}`; observations are frozen schema-tagged physical
data, never descriptor/grant/schema/readiness/owner/admission authority.

Directory: server UID, runtime GID, exact0710 including no special bits,
nonsymlink directory, ACL-free. Socket: server UID, actual socket type, exact0777,
one link, ACL-free. Pin dev/ino/birthtime/uid/gid/mode/type; recheck lstat around
each absolute system `/bin/ls -ldne` ACL probe. Bound output/time, scrub env,
one expected header row and no ACL rows even when xattrs mask '+'. Validate
system executable root/nonwritable/nonsymlink first. Socket GID is observed/pinned,
not assumed numerically equal to its server UID: directory search controls
excluded clients. The0710 directory cannot be opened O_RDONLY by the client;
never widen permissions or present lstat pins as FD-relative openat proof.
Generic caller path data does not authenticate its ancestry. Drift/failure
permanently revokes; close is idempotent and makes subsequent access refuse.
Fixed error codes do not leak arguments/environment.

`holdTask6aProtectedPostgresSocketV1()` accepts zero arguments and loads only
the existing fixed descriptor. Pin every ancestor through the run directory's
parent as root0755/ACL-free/nonsymlink with no-follow directory FDs, bracket
generic directory/socket holds by descriptor and ancestry rechecks. Trusted
immutable ancestry supplies the pathname exclusion argument; FDs alone do not.
No env/path/URL fallback, no caller replacement descriptor. Return frozen
`{read,recheck,close}`, where read returns fixed descriptor plus physical data.
Sticky refusal and process-global cleanup uncertainty; close attempts every FD
and nested holder, revokes before cleanup, never mutates filesystem/DB. This is
physical transport evidence only, not verified server role/grants or startup.

## Evidence and tests

Pure negatives exercise wrong argument/identity/platform, unprivileged ordinary
directory and fake regular socket refusal. Default tests never sudo/contactPG.
The fixed wrapper refuses absent production descriptor and caller arguments.
For actual positives extend only the existing private PG client proof/entry:
_www holds actual0710 _postgres:_www directory/socket, checks frozen metadata,
rechecks around actual peer queries/LISTEN and closes. Wrong server UID/GID and
missing port refuse. Parent compares socket dev/ino/server owner/mode and exact
role/session/db/null address; repeat after restart with newly acquired evidence.
Captured old observations never authorize a new socket generation. Existing
root fixture start/stop/config/HBA/cleanup policy remains unchanged.
An additional bounded scoped child holds physical evidence while the parent
checks exact server/home/run-directory metadata and narrows0710 to0700. The
first recheck refuses; after restoration to the original0710 the same holder
must still refuse. End stdin and require actual close-event completion before
cleanup; unknown child completion retains the exact fixture. No permission
widening beyond its original policy, no PG/LaunchAgent/live effects. Repeat
before/after restart. A third excluded UID tests actual owner mismatch rather
than only the server==runtime identity guard.

No claim that a same-UID hostile JS actor or root cannot forge diagnostic data.
No production directory creation in tests. Independent review precedes opt-in
privileged fixture; exact identity cleanup and absence evidence remain required.
Focused regressions/strict TS/contracts/exact-head cloud review precede merge
and an ordinary clean standby main build. Protected startup, authentic V2
receipt/source promotion and deployment closure stay separate required gates.

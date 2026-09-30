# Task6A Protected PostgreSQL Descriptor Design

## Causal scope

PR243 proved explicit peer-socket transport but its caller-supplied candidate is
not authority. The next cutover prerequisite authenticates a fixed root-owned
descriptor without importing runtime configuration or contacting PostgreSQL.
This is necessary for the same approved Task6A cutover, not a new product feature.
Root remains the only writer; agents investigate and review read-only.

## Contract

`holdTask6aProtectedPostgresDescriptorV1()` accepts no arguments. It reads only
`/Library/Application Support/Setfarm/authority/platform-postgres-endpoint-v1.json`.
No environment, URL, caller path, credential or fallback selects its source.
The module is import-inert. macOS with Node >=22 is the supported host.

The exact canonical JSON record has five fields: `schema` equal to
`setfarm.protected-postgres-endpoint.v1`, `transport` using the existing exact
transport schema, `schemaOwner` equal to `setfarm_owner`, `serverOsUid` and
`runtimeOsGid`. Transport must use the fixed socket directory
`/Library/Application Support/Setfarm/PostgreSQL/run`, database `setfarm` and
role `setfarm_runtime`. Runtime UID/GID are nonroot, equal to the process real
and effective identities, and the nonroot server UID differs from runtime UID.
Only the existing bounded non-5432 port contract is accepted.

Every descriptor ancestor is root-owned, mode0755, nonsymlink and ACL-free.
Hold no-follow directory descriptors and match lstat/fstat physical identities.
Node does not provide FD-relative openat here: the exclusion argument depends
on that root-owned ACL-free ancestry and a trusted root administrator. Recheck
the entire path around reads; held FDs alone are not an atomic pathname fence.
The leaf is root-owned mode0444, regular, one link, 1..16384 bytes, nonsymlink
and ACL-free. Read via its no-follow/nonblocking descriptor with bounded reads,
then check identities and exact bytes again. JSON is UTF8 canonical compact
serialization with precisely one final newline: duplicates, alternate spacing,
unknown keys, invalid UTF8 and oversized inputs are refused. Errors are fixed
codes, never descriptor contents or environment values.

The macOS ACL probe uses absolute system `/bin/ls -ldne`, scrubbed environment,
bounded output and timeout; require one expected metadata line with no `+` or
ACL rows. Probe failure is denial, never equivalent to an empty ACL. The
system executable itself is root-owned nonsymlink and not group/other writable.
Recheck includes ACLs, current identities, file bytes and pinned metadata;
any failure permanently revokes the holder. Close attempts every held FD;
close uncertainty fences future holds in the process. Closing only drops
read handles, never changes the OS fence.

## Separate evidence boundary

`holdTask6aRootOwnedJsonFileV1(path)` is a generic read-only physical-file leaf,
not a production descriptor/role/owner/admission capability. It follows the
same root/ACL/no-follow/bounded rules and supports a real private fixture under
a random root-owned `/Library/Application Support/setfarm-task6a-descriptor.*`
directory. It cannot override the zero-argument production loader's path.
`parseTask6aProtectedPostgresDescriptorV1(bytes)` returns data, not authority.

Descriptor authentication is NOT proof of a running server, socket ownership,
role grants, migration head, continuous writer exclusion, deployment closure,
agent UID separation or launchd/reboot persistence. The later restricted
startup must verify socket physical facts and actual readonly database facts
before publishing either pool or LISTEN client. No existing pool, default,
spawner, Mission Control, host account, live service, schema or deployment is
modified in this slice; no live Setfarm namespace is created.

## Private fixture safety

Explicit opt-in only. Root creates a random mode0700 fixture using system
mktemp; capture and validate exact device/inode/name/owner before every root
effect. Root installs only data and unchanged compiled-source bytes, never
executes user-owned Node. The scoped `_www` child runs actual source from a
root0444 module under the protected fixture; nobody and scoped UID must fail
to append/replace the descriptor. Negative root-admin fixture perturbations
test modes, links, ACLs, bytes and recheck revocation. The driving root-capable
administrator is trusted, not an excluded actor. Cleanup requires unchanged
root identity, no unexpected children, only known same-device regular files
with one link, then exact file removal and rmdir; retain on uncertainty.
The owner-approved 2026-09-27 Task6A OS/role/protected-deployment transition,
reaffirmed in the owner checkpoint and latest continuation, covers this
temporary isolated protected-host rehearsal sibling. Its footprint is not the
production `Setfarm` namespace. Default tests skip before any root/filesystem
preparation. macOS system executable/runtime trust remains a prerequisite;
checking `/bin/ls` UID/mode is not a full executable/native-library attestation.

## Acceptance

Intended RED and GREEN for strict bytes and generic filesystem refusal;
default tests perform no privileged or DB effects; optional actual root-file
fixture passes and its exact directory is independently absent afterward.
Focused existing transport/production tests and strict TypeScript/contracts
pass. Independent and exact-head cloud review precede merge; ordinary clean
standby main build follows. Never equate this descriptor slice to live cutover.

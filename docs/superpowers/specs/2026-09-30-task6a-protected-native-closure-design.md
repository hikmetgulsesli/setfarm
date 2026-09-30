# Task6A private protected native-runtime closure

## Causal scope and decision

PR248's actual no-write host check refuses the missing successor edge. The old
incident's device16777230 cannot be mapped authoritatively to current16777231;
matching inodes/bytes are not continuity proof. Preserve strict V1 and all old
records. A fresh V2 source genesis is a separate protocol, not permission to
seed the old chain. It requires a trusted execution boundary first.

Choose a positive private Node/PostgreSQL native relocation rehearsal extending
the existing peer-authenticated private cluster. Reject executing Homebrew's
mutable dependency graph as protected production authority. Reject a plain
bin/lib copy or DYLD fallback: external load commands and PostgreSQL compiled
prefix resources would still escape. Root remains sole writer under the owner's
explicit decision delegation; isolated OS/access rehearsal is already approved.

This slice is test-only. It adds no production admission capability, namespace,
default, account, service, database migration, selector or legacy recovery effect.
No production startup is delivered by a successful disposable fixture.

## Native input and relocation contract

Use installed Node22.23.1 and PostgreSQL17.10 on macOS arm64. Read the complete
thin arm64 little-endian Mach-O load-command table, not an otool-L-only list.
Bound files512MiB, commands4096, paths1024UTF8bytes, images128 and complete
native bytes512MiB. Reject fat/foreign/truncated/crossed/unknown dependency load
commands, unterminated or noncanonical paths, malformed sizes and duplicate
install IDs or destination basenames. Preserve weak/reexport/upward/lazy loads
as dependencies; none may be silently omitted. /usr/lib and /System/Library
are the only trusted system image roots. Dynamic linker must be /usr/lib/dyld.

Discover transitive dependencies from exact entry binaries node, postgres,
pg_ctl, initdb, psql plus plpgsql and dict_snowball modules. Resolve absolute,
@loader_path, @executable_path and ordered @rpath inputs against actual original
paths; ambiguity or missing dependency refuses. Record original bytes/hash and
recheck each source before/after copying; copies are fixture payloads chosen by
the trusted driver, NOT independent vendor/origin attestation.

Unsupported alternate dylib_use_command marker/flags refuse rather than being
silently interpreted as legacy records. Each executable resolution context is
traversed; shared-image resolutions must agree. Standalone non-executable module
entries and their descendants reject @executable_path/@rpath dependency imports
instead of pretending that the module is PostgreSQL's executable context. Actual
inherited-rpath positive and two-existing-candidate refusal tests cover resolver
behavior. Complete published-byte accounting includes negative copies and any
post-edit/signature growth, not merely original images and share resources.

Relocate non-system dependencies to concrete @loader_path-relative paths inside
the new native root. Remove original LC_RPATH entries and use no DYLD search or
fallback environment. Reparse every copied binary after edits, resolve every
non-system load to a regular protected member, and independently compare it with
the intended closure. Rewrite install IDs consistently. Local ad-hoc signatures
are required after Mach-O edits and verified with the system codesign tool;
there is no certificate/keychain signing, external signing, notarization or
distribution. All preparation tools run as the ordinary trusted driver, not
root. Never execute user-owned Node as root.

PostgreSQL's executable suffix must retain
opt/homebrew/Cellar/postgresql@17/17.10/bin and resources retain sibling
opt/homebrew/share/postgresql@17 and opt/homebrew/lib/postgresql@17. Its compiled
prefix relocation compares path suffixes; a naive root/bin layout can fall back
to the original Homebrew share/modules. Copy the bounded complete share tree,
only regular files/directories, and both selected modules. initdb must prove
that its relocated default resource lookup works WITHOUT a -L override.

The complete share tree is captured/rechecked read-only before the first native
payload mkdir/write/edit/sign. Trusted non-executable source resources may have
1..4096 hardlinks (installed timezone aliases); keep each path and full captured
bytes/10metadata plus directory membership. The private resource reader rejects
executable data inputs and alias-induced drift. Publication uses wx byte copies,
never hardlinks; all native-image and protected-output readers remain exact1link.
Every copied alias counts separately against complete published-byte accounting.

Node uses a fixed root-protected empty OpenSSL configuration and protected
module directory. No ambient NODE_OPTIONS, OPENSSL_CONF, OPENSSL_MODULES,
DYLD_*, PG*, URL, Homebrew PATH or user Home lookup in child environment. The
explicit fixture config variables never become production selection authority.

## Protected private lifecycle

Opt-in SETFARM_TASK6A_TEST_PROTECTED_NATIVE_FIXTURE=1 requires the existing
SETFARM_TASK6A_TEST_PROTECTED_PG_FIXTURE=1. Default tests skip without effects.
The existing unique /private/tmp/setfarm-task6a-protected-pg.* root, pinned
device/inode, peer policy, scrubbed environment, _postgres server, _www runtime,
nobody excluded identity, SQL denial and exact lifecycle remain intact.

Prepare native payloads before any server effect; the driver is explicitly
trusted during preparation. Protect every file/directory via exact bounded
paths (no recursive chown), root:wheel 0444 data/0555 binaries/directories,
under the existing root-owned0711 parent. Audit ACL-free no-follow ancestry and
members, same device/one-link files, byte hashes and immutable membership before
each child/start/restart. Root commands use only system-owned tools. The server
UID cannot mutate code even though it owns disposable PG data. _www and nobody
cannot mutate any native member or directory; test actual append/new-file denial
using the relocated unprivileged Node, without truncating executable files.

All Node clients/probes and PG tools use the protected copies, never a fallback
to the original executable. Exercise actual crypto, ICU and PostgreSQL plpgsql/
text search module resource use. Hold an actual backend long enough to inspect
loaded images with system lsof under root. Audit postmaster, SQL backend and
Node client, requiring their exact relocated executable and observed native
libraries/module to be inside the protected root or system image roots; reject
any Homebrew/Home/temporary outside image. lsof is sampled corroboration, not
proof of all future dlopen or full application/npm/extension behavior.

Darwin lsof txt also contains mapped data. Only an exact
/Library/Preferences/Logging/.plist-cache.<alphanumeric> path may be classified
as sampled non-executable data, never code/source/ownership authority. Require
the same complete lsof membership between TWO root-system vmmap -w samples for
the same bracketed PID; every matching VM region must be exactly r--/r-- current
AND maximum protection. Missing/conflicting/unparseable/truncated/warning output
refuses. No generic /Library exclusion; every other non-system name retains the
exact protected-image requirement. Cache data cannot satisfy required binaries
or modules. Path/VM evidence does not prove mapped inode UID, especially after
unlink; do not reopen a replacement cache as mapped-object identity.

Repeat positive/negative peer SQL and native checks across the existing exact
postmaster restart. Stop only the captured PID/UID/start/command/data identity.
Any lifecycle/control-subprocess timeout, unknown child completion, native drift, failed stop or cleanup
retains the exact fixture and fails. Existing bounded same-device no-symlink
cleanup removes only the proven stopped temporary tree; no historical worktree
or production namespace is removed. Independently check recorded PIDs/root gone.

Synchronous command error/signal/null status permanently burns cleanup authority.
The intentional missing-lib Node abort is waited/reaped by an unprivileged system
shell with a child-only zero core limit; only exact134 plus missing-lib diagnostic
is expected, not an arbitrary signal. Native reader close ambiguity permanently
denies reacquisition/cleanup, preserving the primary and close errors together.
Preparation-tool ambiguity burns the same private native cleanup latch, including
when preparation failed before the returned protected object was assigned.
An embedded SQL/notification logical-probe deadline is a test failure; a definite
normal probe-child completion can still permit verified stop/cleanup, unlike an
unknown lifecycle/control-subprocess completion.

## File map and verification

- tests/execution-attempts/task6a-native-load-commands-v1.ts: bounded Mach-O
  parsing and transitive relocation preparation used only by the private fixture.
- tests/execution-attempts/task6a-native-load-commands-v1.test.ts: real helper
  behavior with independently built binary bytes and actual disposable copies.
- tests/execution-attempts/task6a-protected-native-fixture-v1.ts: private payload
  preparation/protection/immutable rechecks and loaded-image diagnostic checks.
- tests/execution-attempts/task6a-private-protected-cluster.integration.test.ts:
  opt-in wiring, protected executable use and real loaded-image/module probes.
- package.json: safe focused pure test and explicitly bounded native fixture run.
- this spec and its companion plan: causality, decisions, evidence and limits.

TDD proves parser/relocation missing or unsafe behavior before implementation.
Independent read-only review must clear exact privileged fixture source BEFORE
opt-in execution. Run pure tests, default no-effect skip, actual private native
fixture without skips, source/test TypeScript/contracts, existing socket and pure
regressions; deliver only after exact-head cloud/security/thread review. Build
reviewed clean-main with ordinary guards and report actual host truth, not
production native closure or Task6A completion. Freeze the old startup19 changes.

## Primary references

- Apple, Run-Path Dependent Libraries:
  https://developer.apple.com/library/archive/documentation/DeveloperTools/Conceptual/DynamicLibraries/100-Articles/RunpathDependentLibraries.html
- Apple, Dynamic Library Usage Guidelines (dlopen is a separate runtime path):
  https://developer.apple.com/library/archive/documentation/DeveloperTools/Conceptual/DynamicLibraries/100-Articles/DynamicLibraryUsageGuidelines.html
- PostgreSQL17 initdb input resources:
  https://www.postgresql.org/docs/17/app-initdb.html
- PostgreSQL17 client dynamic_library_path defaults:
  https://www.postgresql.org/docs/17/runtime-config-client.html
- PostgreSQL REL_17_STABLE src/port/path.c make_relative_path (executable suffix
  matching decides whether compiled resource paths can be relocated).
- Apple, Viewing Virtual Memory Usage (current/maximum VM protections):
  https://developer.apple.com/library/archive/documentation/Performance/Conceptual/ManagingMemory/Articles/VMPages.html
- lsof upstream manual (txt includes program code and data):
  https://raw.githubusercontent.com/lsof-org/lsof/master/Lsof.8

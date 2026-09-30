# Task6A protected native fixture implementation plan

> For agentic workers: Root implements inline; agents are read-only investigators
> and reviewers under the owner's explicit sole-writer instruction. Follow TDD,
> independent review and verification-before-completion task by task.

**Goal:** Prove an actual disposable peer cluster and client execute relocated,
root-protected Node/PostgreSQL/native resources without mutable Homebrew loads.

**Architecture:** A bounded test-only arm64 Mach-O parser discovers the complete
static closure and plans concrete internal relocation. A private fixture helper
copies/edits/ad-hoc-signs/rechecks payloads before protecting exact paths; the
existing cluster lifecycle uses those executables and independently audits actual
loaded images and access denials. No production authority or startup wiring.

**Tech Stack:** TypeScript ESM, Node22+, Darwin system install_name_tool/codesign/
lsof, PostgreSQL17, existing peer fixture and esbuild; no dependencies added.

**Spec:** docs/superpowers/specs/2026-09-30-task6a-protected-native-closure-design.md

## Global constraints

- Preserve all worktrees, archives, old V1 receipts and startup19 dirty files.
- No live PG5432, migrations, roles/accounts, services, selection or legacy recovery.
- No root execution of user-owned Node; privileged tools are system-owned only.
- Opt-in native rehearsal requires the existing peer fixture opt-in too.
- No DYLD fallback, relaxed guards or fake origin/remount continuity proof.
- Private root and captured process identities must be exact; uncertainty retains.
- Node22.23.1/PG17.10 installed inputs; arm64 only, bounded static graph128images/
  512MiB, table4096commands, canonical path1024UTF8bytes, same-device private tree.
- Local ad-hoc signatures only; no keys, public release or external signing.

## Task1: Bounded native load-command parser and closure

**Files:** Create test-only task6a-native-load-commands-v1.ts and .test.ts.
**Interfaces:** parseTask6aNativeLoadCommandsV1(bytes:Buffer) returns immutable
dependency paths/kinds, rpaths, optional installId and exact dynamicLinker.
Private closure collector consumes real original entry paths and returns copied
source bytes, intended destinations and exact install_name_tool edits.

- [x] Build independent arm64 Mach-O header/load-command byte fixtures. Assert
  parsed dependencies include weak/reexport/upward/lazy commands; foreign/fat,
  truncated table, wrong size/string offset/NUL, traversal/relative/overlong paths
  refuse. Mutation deleting weak dependency collection must fail a behavior test.
- [x] Run missing-helper RED without any root or native execution.
  `env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL node --import tsx --test tests/execution-attempts/task6a-native-load-commands-v1.test.ts`
- [x] Implement bounded actual parser, then run GREEN. Add real private source
  copies for missing/ambiguous dependency and escaped relocation refusal; never
  invoke an edited executable until private pre-effect review is complete.
- [x] Record exact tests, source paths and limits; no production call sites.

## Task2: Protected payload and existing peer fixture wiring

**Files:** Create task6a-protected-native-fixture-v1.ts; modify existing private
cluster integration and package.json; no changes to production socket/policy.
**Interfaces:** Private preparation accepts exact fixture root and scoped root
system-command callback; returns node path, PG bin path, recheck() and exact
native member list. It cannot grant production startup or caller source authority.

- [x] Before implementation add a private relocation assertion that current
  Homebrew load paths fail protection, with no unsafe child/root effects.
- [x] Copy bounded captured inputs into exact new paths; PostgreSQL executable
  suffix and share/module siblings follow the spec, no -L resource override.
- [x] Rewrite every non-system load to intended internal @loader_path member,
  strip rpaths, set install IDs, locally ad-hoc sign/verify and reparse/recheck.
  Use the actual parsed original dependencies, not guesses from filenames.
- [x] Protect exact files/directories root:wheel0555/0444, verify ACLs/physical
  membership/full byte digests and bracket every child with immutable rechecks.
- [x] Route all existing client/probe/PG commands through the private protected
  copies only when both explicit opt-ins are present. Absent opt-ins preserve
  existing fixture behavior and skip discovery without filesystem/sudo/PG effects.
- [x] Exercise native crypto/ICU, default relocated initdb resources, actual
  plpgsql and dictionary module use; inspect real Node/postmaster/backend mapped
  images using root-controlled lsof. Reject any non-system path outside closure.
- [x] Repeat native/access/peer checks after restart. Preserve existing exact
  uncertain-start/child/stop cleanup refusal behavior and scoped removal only.
- [x] Get independent read-only privileged-source review before actual opt-in.
- [x] Run explicit actual fixture; record exact root/PIDs, 0 skips, stop/absence.
  `npm run test:task6a-protected-native-fixture`

## Task3: Proportional verification and reviewed delivery

- [x] Pure helper, default native fixture, existing socket lifecycle and safe
  internal-production pure suite372. No unpinned all-tests/live-host fallback.
- [x] Actual source and modified test/helper strict TypeScript; English/path/
  version/migration digests/12MC contracts and diff checks.
- [ ] Root self-review and independent read-only exact diff review; fix real
  findings with focused RED/GREEN and affected actual fixture rerun.
- [ ] Commit scoped source/tests/spec/plan/package, push own branch and PR.
- [ ] Completed exact-head cloud review, security pass and no unresolved genuine
  findings before SHA-bound normal merge; keep branch/worktree and every archive.
- [ ] Ordinary clean-main standby build (v2 capacity), full BUILD_INFO and actual
  HTTP/PG truth. Do not claim production native provenance or completedTask6A.

## Baseline

Base main6724081115dad334c1c977db288e94704fa4f2eb, existing isolated source tree
on test/task6a-protected-native-closure-v1, root sole writer. Native tools inspected
read-only; no relocation/signature/root fixture executed. Existing capture22GREEN.
Standby-v2 ordinary build terminal, unselected; selected/old19dirty unchanged.

## Implementation evidence before privileged execution

Parser/collector/relocated verifier50 focused cases pass with0skips. All new
behavior fixes followed observed RED/GREEN: independent review identified source
and resolution context drift, exact intended relocation, bounded pre-read FD
identity, synchronous/async child ambiguity, FD release ambiguity, unsupported
alternate dylib-use records, complete payload bytes and module-context refusal.
Actual inherited-rpath chain succeeds; two-existing rpath candidates refuse.
Native-tool/FD uncertainty permanently blocks cleanup and reacquisition; every
readiness/close timeout retains even after later normal child completion.
Strict TypeScript4source/test files0errors; existing transport4/physical5/single
backend7 and pure372 pass,0skips. English1873/path947/version2.3.79/migration
digests/12MissionControl contracts pass. Default actualfixture explicitly skips
without effects; readonly installed graph35images/102892096bytes/69imports.
Initial private attempt exposed hardlinked timezone data and retained its exact
incomplete tree. Private non-executable resource reader/preflight followed actual
RED/GREEN; all protected outputs/native images remain strict single-link. A later
attempt exposed lsof txt's mapped-data semantics, not an escaped code image;
exact stopped fixture cleanup passed. Cache-only dual VMmap non-executable data
classification followed four missing-helper RED cases to50GREEN; no generic
Library/image/ownership authority allowance. Both fixes received independent
exact-source pre-effect clearance before distinct new attempts.

Final explicit actual fixture passed3/3,0fail/skip in73.249s with both opt-ins:
35protected native images/935files, actual held Node/postmaster/backend/module
audits, crypto/ICU, default initdb resources, permission/peer/SQL denials and
missing-library refusal across two postmaster starts. Exact stop/removal and
independent absence of the root/all six recorded PIDs passed. The first retained
failed tree's complete metadata/bytes digest stayed identical; no live paths
changed. Exact PID/root diagnostics remain in local continuation logs, not source
authority. Actual private success does NOT establish production origin, held live
writer fence, PG31genesis, guarded32/33, owner admission or fullTask6A completion.

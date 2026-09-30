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

- [ ] Build independent arm64 Mach-O header/load-command byte fixtures. Assert
  parsed dependencies include weak/reexport/upward/lazy commands; foreign/fat,
  truncated table, wrong size/string offset/NUL, traversal/relative/overlong paths
  refuse. Mutation deleting weak dependency collection must fail a behavior test.
- [ ] Run missing-helper RED without any root or native execution.
  `env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL node --import tsx --test tests/execution-attempts/task6a-native-load-commands-v1.test.ts`
- [ ] Implement bounded actual parser, then run GREEN. Add real private source
  copies for missing/ambiguous dependency and escaped relocation refusal; never
  invoke an edited executable until private pre-effect review is complete.
- [ ] Record exact tests, source paths and limits; no production call sites.

## Task2: Protected payload and existing peer fixture wiring

**Files:** Create task6a-protected-native-fixture-v1.ts; modify existing private
cluster integration and package.json; no changes to production socket/policy.
**Interfaces:** Private preparation accepts exact fixture root and scoped root
system-command callback; returns node path, PG bin path, recheck() and exact
native member list. It cannot grant production startup or caller source authority.

- [ ] Before implementation add a private relocation assertion that current
  Homebrew load paths fail protection, with no unsafe child/root effects.
- [ ] Copy bounded captured inputs into exact new paths; PostgreSQL executable
  suffix and share/module siblings follow the spec, no -L resource override.
- [ ] Rewrite every non-system load to intended internal @loader_path member,
  strip rpaths, set install IDs, locally ad-hoc sign/verify and reparse/recheck.
  Use the actual parsed original dependencies, not guesses from filenames.
- [ ] Protect exact files/directories root:wheel0555/0444, verify ACLs/physical
  membership/full byte digests and bracket every child with immutable rechecks.
- [ ] Route all existing client/probe/PG commands through the private protected
  copies only when both explicit opt-ins are present. Absent opt-ins preserve
  existing fixture behavior and skip discovery without filesystem/sudo/PG effects.
- [ ] Exercise native crypto/ICU, default relocated initdb resources, actual
  plpgsql and dictionary module use; inspect real Node/postmaster/backend mapped
  images using root-controlled lsof. Reject any non-system path outside closure.
- [ ] Repeat native/access/peer checks after restart. Preserve existing exact
  uncertain-start/child/stop cleanup refusal behavior and scoped removal only.
- [ ] Get independent read-only privileged-source review before actual opt-in.
- [ ] Run explicit actual fixture; record exact root/PIDs, 0 skips, stop/absence.
  `npm run test:task6a-protected-native-fixture`

## Task3: Proportional verification and reviewed delivery

- [ ] Pure helper, default native fixture, existing socket lifecycle and safe
  internal-production pure suite372. No unpinned all-tests/live-host fallback.
- [ ] Actual source and modified test/helper strict TypeScript; English/path/
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

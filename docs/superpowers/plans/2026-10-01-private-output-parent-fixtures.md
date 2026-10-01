# Private Output Parent Fixtures Implementation Plan

> **For agentic workers:** Execute inline with the primary owner as sole writer;
> use read-only independent design and exact diff review. The suggested
> `executing-plans` skill is unavailable in this session; this explicit serial
> checklist supplies the execution checkpoints instead. Never delegate edits.

**Goal:** Eliminate inherited-GID fixture setup failures without weakening builders.

**Architecture:** A test-only fresh-directory helper pins its own descriptor and
path before establishing current GID. Five suites reuse it, leaving their actual
builder consumers and negative assertions unchanged. No wrapper or live effect.

**Tech Stack:** Node 26, POSIX filesystem metadata/descriptors, node:test, existing
esbuild and Darwin test-only native fixture consumers.

**Spec:** `docs/superpowers/specs/2026-10-01-private-output-parent-fixtures-design.md`

## Global Constraints

- Root is the sole source/Git/delivery writer; agents are read-only reviewers.
- Keep all five builder ownership guards unchanged.
- Keep environment scrubber, default test graph and dependencies unchanged.
- Modify only new test-owned directories, never old/system/foreign paths.
- Builds require clean worktrees; no dirty-build or runtime-guard bypass.
- Preserve all old worktrees, dirty files, branches and private footprints.
- Do not infer production/native authority from ordinary fixture passes.

## File Map

Create the helper and its test named in the spec; modify only mkdtemp setup/imports
in the five mapped suites. These two documents travel with the causal fix.
No production File Map entries are added because production policy is correct.

### Task 1: Establish the reproduction and reviewed ownership contract

**Files:** This spec and plan; existing five suite setup and five builder guards.

**Interfaces:** The current builders consume external canonical UID/GID-owned
mode-0700 output parents. Their guards are the unchanged acceptance boundary.

- [x] Read all relevant instructions and current source; confirm the group
  mismatch with a fresh ordinary filesystem fixture, without PostgreSQL/native
  invocation or inspecting old roots. Retain the diagnostic fixture.
- [x] Run actual existing bundle consumer with a clean environment:

```sh
env -i HOME=/Users/setrox PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin:/usr/sbin:/sbin /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-concurrency=1 scripts/__tests__/node-toolchain-provisioner-bundle.test.js
```

Observed RED: 0 pass, 1 fail, exit 1; intended exit 0 refused by private-parent
guard. This is a real semantic failure, not a missing module or syntax error.

- [x] Have a read-only reviewer inspect the exact design, alternatives and
  fresh-directory-only group preparation; address important findings first.
- [ ] Commit the reviewed docs before helper implementation (Markdown-only).

### Task 2: Fresh output-parent helper and regression coverage

**Create:** `scripts/__tests__/fixtures/private-output-parent.mjs` and
`scripts/__tests__/private-output-parent.test.js`.

**Consumes:** `prefix` is an absolute mkdtemp prefix; `io` defaults to `node:fs`.
**Produces:** `createPrivateOutputParent(prefix, io): canonicalPath`, or throws
without returning a path or repairing a rebound/foreign directory.

- [ ] Write tests first, using real filesystem creation and explicit metadata:

```js
const root = createPrivateOutputParent(join('/tmp', 'setfarm-output-parent-'));
const stat = lstatSync(root);
assert.equal(root, realpathSync(root));
assert.equal(stat.uid, process.getuid());
assert.equal(stat.gid, process.getgid());
assert.equal(stat.mode & 0o7777, 0o700);
assert.equal(stat.isDirectory(), true);
assert.deepEqual(readdirSync(root), []);
```

Add single-boundary interpositions for group-preparation throw, open throw,
close throw, operation-plus-close throw, invalid created metadata and both
pre/post-group path rebinding. Keep creation, held descriptors and metadata real;
assert resulting filesystem identities, refusal and exact descriptor closure.
Cleanup only each test's own paths in that test's finally block.
Invalid prefix fixtures must fail before mkdtemp; all pre-group UID/mode/identity
and inherited-GID observations must agree before any descriptor preparation.

- [ ] Implement the minimal helper from the spec: create -> capture -> resolve
  -> open -> validate identity/UID/mode -> conditional descriptor fchown -> fresh
  validate identity/UID/GID/mode/canonicality -> close once -> return.
- [ ] Run the direct tests serially; fix only demonstrated failures. Deliberate
  realistic fault interpositions must remain red without each corresponding
  fail-closed check, while positives prove real current-GID metadata.

### Task 3: Integrate all affected fixture parents and verify consumers

**Modify:** The five suite paths in the spec File Map.
**Consumes:** `createPrivateOutputParent(prefix)`.
**Produces:** Existing actual bundle/native consumer behavior with complete
parent preparation, including intentional invalid-mode/nonempty fixtures.

- [ ] Replace each `mkdtempSync` setup call with the helper, removing only its
  fs import and adding the helper import. Keep tmpdir prefixes, all actual
  builders/native assertions, explicit chmod and existing cleanup unchanged.

```js
import { createPrivateOutputParent } from './fixtures/private-output-parent.mjs';
const alias = createPrivateOutputParent(join(tmpdir(), 'setfarm-fixture-'));
```

- [ ] Run the complete six-file set (helper plus five consumers), serially under
  the Task 1 environment with TMPDIR absent. Read full output and actual exit;
  expect original guards, timeout, retained stages and O_EXCL behavior to pass.
- [ ] Run normal complete `npm run test:scripts` separately and record exact
  counts/exit; do not substitute it for the full private PostgreSQL graph.
- [ ] Run English/version/path contracts, diff whitespace and exact credential
  scan; inspect the entire mapped diff and confirm all builder/wrapper/package
  bytes still equal the base. Record fresh evidence in this plan.

### Task 4: Independent delivery and new clean-main proof

**Files:** Exact mapped diff, normal scoped branch/PR and new clean-main checkout.
**Consumes:** Exact reviewed source SHA, passing scoped evidence and clean status.
**Produces:** Reviewed ordinary PR delivery; fresh guarded clean-main build; a
newly reviewed whole private graph, or an honestly recorded next causal failure.

- [ ] Independent read-only exact source review; fix all important findings.
- [ ] Commit only mapped paths, push normally, deliver a PR and read complete
  GitHub review/check/thread state. Request Copilot/Gemini review without calling
  silence, quota responses or empty requested-reviewer lists an approval.
- [ ] Merge only with fresh matching-head evidence and ordinary protection;
  preserve branches/worktrees, never direct-main commit, force or admin bypass.
- [ ] Create a new clean-main checkout, obtain authentic history, prove matching
  lock/dependency bridge, and run a real guarded `npm run build` there.
- [ ] After a fresh exact pre-effect review and live zero-owner/resource audit,
  run one new complete private PostgreSQL graph. Do not reuse old credentials,
  roots, PIDs or prior clearance. Require full durable diagnostics, actual outer
  exit, captured closures/quiescence/admin end and fresh post-host evidence.
- [ ] Resume separately gated protected-origin/fence/genesis/live Task6a work;
  do not claim project completion from this fixture repair.

Plan self-review: every spec acceptance item maps to a task; interfaces and paths
are consistent; no unrelated runtime or deployment authority is introduced.

## Evidence

- Base: `5678e85222562f0088a77385db70127335366b59`, isolated sole writer branch
  `fix/private-output-parent-fixtures-v1`. Previous main build checkout retained.
- Lock SHA256 matches reused dependency bridge:
  `a7619de7cab700d96ce2c8073f842f9f02f480ff704d0ac689914f0f3e9267fc`.
- Task 1 semantic bundle RED: 1 test, 0 pass, 1 fail, 154.80075 ms, actual exit 1.
- Full graph is still failed/unverified; the original failed epoch is closed.
- Independent read-only design review: Critical 0 / Important 0 / Minor 2;
  prefix-before-effect validation and inherited-GID drift refusal added to spec.

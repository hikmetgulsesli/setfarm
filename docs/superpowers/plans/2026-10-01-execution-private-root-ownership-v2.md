# Execution Private Fresh-Root Ownership v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Root uses inline execution with checkpoints because implementation delegation is prohibited and executing-plans is unavailable; independent agents are read-only reviewers.

**Goal:** Correct code-owned fresh root preparation behind the fifth ALL execution failure cascade without weakening any ownership or authority guard.

**Architecture:** Reuse the existing FD-pinned createNodeCandidateRuntimeAttemptRootInternalV2 constructor, then bind each consumer's original inode rather than repinning a later path. Keep source-admission anchors, lifecycle, cleanup and strict Node/npm ownership checks intact.

**Tech Stack:** TypeScript ESM/.js imports, Node26.4.0, node:test, test-only finite TypeScript VM modules, ordinary Darwin UID501/GID20.

**Spec:** docs/superpowers/specs/2026-10-01-execution-private-root-ownership-v2-design.md

## Global Constraints

- Root sole source/Git/delivery writer; agents read-only.
- Prefix-only creation of new empty UID-owned0700 roots, never existing-path repair.
- Original bigint dev/inode and current UID/GID/mode/canonical checks remain.
- Retain invalid/uncertain roots; preserve old worktrees/private evidence/archives.
- No live5432 test fallback, SCRAM/HBA change, secret/access/privilege/native policy change.
- No shared dependency install/write, source/runtime/dirty-build guard bypass or main commit.
- Protected bootstrap remains unconditional refusal; no origin/fence/genesis/32/33/cutover success follows.
- User standing authorization selects inline execution; no additional permission prompt.

## Task 1: Actual constructor regression and minimal source preparation

**Files:** Create tests/execution-attempts/private-fresh-root-ownership-v2.test.ts.
Modify the ten source paths listed in the spec, this plan and the spec only.

**Interfaces:** Existing creator consumes normalized absolute prefix and returns
Readonly<{absolutePath:string;device:bigint;inode:bigint}>. Test VM exports actual
privateRootV2/exactPrivateRootV2/materializeSourceStage/probeToolchain only in its
finite test context. New private source allocator consumes prefix/label and
returns existing SourceOwnedPrivateDirectoryV2, original identity bound.

- [x] New isolated branch fix/execution-private-root-ownership-v2 at9b63901e,
  unchanged ignored shared node_modules symlink; no install. Existing pure21
  ownership tests passed0FAIL0SKIP988.709167ms under scrubbedTMPDIR.
- [x] Commit self-reviewed design/plan before implementation:951b0e4d.
- [x] Add actual constructor table for content-store, local trust, metadata,
  module export, required modules, host-self and suspended-exec roots. Compile
  entire tracked module with CommonJS/esModuleInterop and append a test-context
  export, keeping imports bound to actual source filename. Capture actual
  mkdtemp metadata and assert returned roots match current process UID/GID0700,
  canonical identity and original device/inode. Retain new roots.

```typescript
const original = fs.mkdtempSync;
let created: fs.BigIntStats | undefined;
t.mock.method(fs, "mkdtempSync", (prefix: string) => {
  const alias = original(prefix);
  created = fs.lstatSync(alias, { bigint: true });
  return alias;
});
syncBuiltinESMExports();
const result = actualConstructor();
const stat = fs.lstatSync(result.root, { bigint: true });
assert.equal(stat.gid, BigInt(process.getgid!()));
assert.equal(stat.uid, BigInt(process.getuid!()));
assert.equal(stat.mode & 0o7777n, 0o700n);
assert.equal(stat.dev, created!.dev);
assert.equal(stat.ino, created!.ino);
```

- [x] Run RED using exactly:

```bash
env -u TMPDIR -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL /opt/homebrew/Cellar/node/26.4.0/bin/node --import tsx --test tests/execution-attempts/private-fresh-root-ownership-v2.test.ts
```

Expected current creator guard rejection or observed GID0 instead of20, not
VM/import/fixture errors. Record real RED count/duration and actual inherited GID.
- [x] Add source context test by calling actual materializeSourceStage([],new Map())
  in the finite VM. Verify fresh context/source identities and actual0700 UID/GID;
  no DB/native process. Probe test uses actual probeToolchain up to an adapter
  that records its real new HOME/cache/tmp metadata and throws a literal sentinel;
  no executable is run. Require current GID on observed directories independently.
- [x] Minimal source change pattern, retaining original guard and pin:

```typescript
const fresh = createNodeCandidateRuntimeAttemptRootInternalV2(
  path.join(os.tmpdir(), ROOT_PREFIX_V2),
);
const alias = fresh.absolutePath;
const root = alias;
const stat = lstatSync(root, { bigint: true });
if (stat.dev !== fresh.device || stat.ino !== fresh.inode) {
  return failV2("FIXTURE_BUILD_FAILED", "Fresh root identity changed");
}
```

Use each file's existing typed error code, not the illustrative FIXTURE_BUILD_FAILED
literal. Keep existing UID/GID/mode/canonical checks. Numeric consumers require
safe dev/inode before BigInt comparison. Remove pre-stat pathchmod and unsafe
initial-root pathname deletion. Do not change later exact owned cleanup.
- [x] Source context/output/environment/install creators use private original-pin
  create-and-anchor operation. Compiled-output fault callbacks cannot trigger
  post-fault repinning; preserve existing parent_created/unanchored retention.
  Recheck original context after empty census before first mkdir.
- [x] Add actual same-owner-empty replacement tests at first consumer stat and
  source-anchor/census boundaries. Expect refusal and retained original plus
  replacement; zero post-rebind chmod/removal/mkdir and no positive return.
  Run RED before each added fence, then GREEN for the complete regression file.
- [x] Run existing21 ownership tests plus new regression; no skips on this host.

## Task 2: Positive fixture creator alignment and consumer verification

**Files:** Four existing execution test paths listed in the spec; no adversarial
external/symlink/capture fixtures or unrelated nested creators.

**Interfaces:** Positive mkdtemp creators now consume the same prefix-only helper
and receive canonical fresh path; production consumer guards remain unchanged.

- [x] Run focused ordinary affected consumer tests against current source to
  capture guard REDs before changing their positive root preparation. Explicitly
  exclude the two private-login DB integrations until their separate auth fix.
- [x] Replace only positive standalone mkdtemp creation with the reviewed helper:

```typescript
const created = createNodeCandidateRuntimeAttemptRootInternalV2(
  path.join(os.tmpdir(), "setfarm-release-terminal-v2-"),
);
const root = created.absolutePath;
```

Keep real Node/npm pairing checks, fault injection and strict external-directory
denials. Existing exact fixture cleanup belongs only to newly created fixtures.
- [x] Run affected source-admission, capsule, host-node, terminal, content-store
  and native fixture consumers with scoped existing esbuild binary if required;
  ordinary/private effect scope must be reviewed before invoking real fixtures.
  Preserve all original expected refusal codes; do not turn skips/faults into passes.
- [x] Run noemit TypeScript and version/English/path/migration/MC/diff contracts.
  Inspect actual output, no guarded feature build bypass.
- [x] Root self-review against17-file map and all known212-block cause buckets.
  Independent exact source/test/diff review, then minimal corrections and fresh
  focused verification. No copied constructor assertions or new authority DTOs.

## Task 3: Reviewed delivery and fresh merged verification

**Files:** Only the17 mapped paths; retained logs updated outside source repo.

- [ ] Stage exact mapped paths, conventional scoped source commit, exact committed
  focused verification and independent final exact-head read-only review.
- [ ] Normal push/scoped PR, inspect actual complete cloud/security/review state.
  Copilot/Gemini requests once if applicable; quota/silence is not approval.
- [ ] Normal SHA-bound merge without admin bypass/deletion/history rewrite.
- [ ] New clean-main synchronization/build and matching compiled identities;
  old clean-main builds and live selection remain unchanged.
- [ ] Address independent SCRAM login fixtures in a separate bounded design/test
  slice before another full ALL. That slice keeps local/TCP SCRAM and live
  credentials/roles unchanged; no test graph substitution.
- [ ] Future genuine unchanged ALL requires a fresh per-invocation review and
  immediate source/build/dependency/primary-health/resource checks. Freeze until
  owned exit+close/sixEOF/quiescence/admin/server/strictterminal/outer/posthost.
  Report final stages actually reached; do not stitch prior partial evidence.

## Self-review checkpoints

Independent constructor review identified original-pin loss in four mapped
fixture builders, not new unrelated functionality. Root observed build-failure
and dispose deletion REDs and genuine same-owner/same-mode later-state capture
REDs before their correction. Retain the original pin in fixture state and
precheck it before existing cleanup; this is not atomic conditional unlink.
Content inventory and source empty-census replacement REDs also proved later
repinning/mutation. Typed preparation failures preserve domain codes and causes.
Initial original-pin refinements stayed within the proposed scope.
The later two-case capsule consumer run reached a new installed-metadata root
refusal after the Node/npm pair was corrected (onePASS/oneFAIL). Add that one
source path from the updated spec. Two adversarial capture test files remained
unchanged and passed their native consumer suites, leaving the final17-file map.
Do not change the
unrelated fixed-path network-negative scratch ABI without actual failure evidence.

Independent final refinement required four primary+authenticated-cleanup cases
and both native builders' pre-dispatch/pre-receipt original-root joins. Root
observed sixREDs, corrected error ordering/pre-dispatch, then observed two
pre-receipt REDs before adding the final checks. The regression leaf explicitly
skips non-Darwin; no platform emulation or cross-platform pass is claimed.

## Observed verification checkpoint

- Genuine initial constructorRED9:0PASS9FAIL1182.128916ms, inheritedGID0 vs20.
- Typed preparationRED7:9PASS7FAIL1092.227416ms; source allocationRED5:
  16PASS5FAIL1266.9215ms; inventory/censusRED2:21PASS2FAIL1593.5065ms.
- Four primary+cleanup and pre-dispatchREDs:0PASS6FAIL1357.746792ms;
  pre-receiptREDs:0PASS2FAIL1266.9605ms. No native effect in these VM tests.
- Initial explicit16-file ordinary consumer run12477 definitely CLOSED0:
  299PASS0FAIL0CANCELLED0SKIP490013.548959ms, including real ordinary native
  fixtures, local Git/Node, fake npm adapters and fixture-local xattr/package
  observations. No auth integrations/private-ALL/live5432 test writes.
- After final review fixes, current67new+21old pure tests88PASS0SKIP
  2060.360625ms. Final15-file ordinary consumer run46517 definitely CLOSED0:
  225PASS0FAIL0CANCELLED0SKIP45510.645334ms. Fresh capsule two-case run33307
  definitely CLOSED0:2PASS0FAIL0CANCELLED0SKIP5423.042333ms. These proportional
  reruns include the final source refinements; they are not a fresh full299 or ALL.
- Current noemit33257 and contracts5452 definitely CLOSED0; version2.3.79,
  English1923files, paths966files, migration digests current, MC12 artifacts.
  Type/contracts are separate, not a guarded build. Both read-only reviewers
  returned C0/I0/M0 for the final17-path dirty source/test diff; exact committed
  head verification and review remain before PR delivery.

Each source preparation change has a constructor RED plus unchanged guard
consumer coverage. Original-pin replacement denials protect against repinning;
normalization cannot accept external paths. Uncertain or unanchored failures
retain their roots; authenticated builder failures may clean only the original
fixture root. The independent auth failure and remaining protected/native/live
obligations are explicit exclusions, not completed outcomes.

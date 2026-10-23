# Owned Source Verification Buffer Implementation Plan

> For agentic workers: REQUIRED use subagent-driven-development with one fresh
> implementer, independent task review and one final whole-diff review. Root
> alone runs commands with execution effects and owns delivery.

**Goal:** Remove discarded full-file allocations from complete Source pins
verification while preserving fresh content, identity, custody and timing
guards; measure any successor timing separately.

**Architecture:** A private verification consumer streams every original file
through one bounded per-pass buffer and fresh per-file SHA256 states. Existing
byte-return consumers retain their behavior. Shared private read/custody logic
prevents divergent success or error paths.

**Tech Stack:** Node26.4.0, JavaScript ESM, node:test, existing contained VM seam.

**Spec:** `docs/superpowers/specs/2026-10-23-owned-source-verification-buffer-design-v1.md`.

## Global Constraints

- Sole writer is the existing controller worktree, branch
  `fix/manual-orphan-verification-buffer-20261023`, based on50aa7357.
- Preserve M454/T161/I5/live services/credentials/all originals; no runtime,
  provider, private/native, Git delivery or subagents from implementation agents.
- Root executes actual tests. Worker static Python/Git reads are allowed.
- No content/metadata/physical/owner/observer/Git/close observation is removed,
  no positive cache, expected digest refresh, clock reset or deadline widening.
- The two ordinary public-check pins passes use independent pass buffers;
  no pass state survives or changes any public API.
- H_HELD/STOCK_HELD descriptors, temporary flags, same T owner, one-at-a-time
  lifetime, burn-before-close, UNKNOWN and reverse cleanup remain exact.
- Keep ordinary file bytes, graph/resolver/handoff paths unchanged. Shared
  private mechanics may be factored, never copy a second success algorithm.
- Plan/source tests are not actual Source timing/genuine/full8/rollout credit.

## File Map

Modify H=`tests/execution-attempts/helpers/manual-control-orphan-bootstrap-child-v1.mjs`
and J=`scripts/__tests__/manual-orphan-bootstrap-owned-route-v1.test.js` only for
implementation. This plan and its spec record the measured causal scope. Logs
and Root admissions/captures stay outside tracked source. H189100B/d09228e7 and
J794819B/f2227acb are the starting bytes; Root records later exact pins.

### Task 1: Verification consumer with actual contained regression tests

**Consumes:** actual `ownedSourcePinsV1(resources,home,sourceContext)` private
implementation, its `check()/file()/handoffTargetOutput()` paths, and J's
`task7dPinsV1`/`task7dPrivateVmV1` seams.

**Produces:** the same private/public APIs and proof order, with bounded pass
allocations and adversarial tests. No exported verification API or Source fake.

- [ ] **Step 1: Author failing tests and STOP before H changes.** Read the
  complete spec and focused actual private read/custody code plus contained
  seam. Extend the seam to observe actual Buffer allocations, explicit
  positions/lengths, strict legacy byte-return offsets and independent
  scratch coverage. Keep swallowed fixture-assertion detection. Add one
  clearly identified semantic test that fails on old H because complete
  verification allocates full-file results; do not fail merely because a
  helper name is missing. Test matrix:

  ```js
  // Actual source is extracted by the existing contained private-pins seam.
  // Independent expected digests use fixture bytes, never verifier output.
  for (const delegated of [false, true]) {
    for (const size of [0, 1, 65535, 65536, 65537, 131077]) {
      // Fresh different-content files; exact every-byte positional coverage.
      // Check one scratch+one EOF allocation per pass and no full-file result.
      // Repeat check: fresh read coverage and fresh pass buffers are required.
    }
  }
  // Additional cases: positive short reads, corrupt first/middle/last byte,
  // invalid read counts, throw, trailing byte, metadata drift, failed stock,
  // simultaneous digest/read+close UNKNOWN, recycled FD, reentry/post-close,
  // mutation between passes, and unchanged ordinary file().bytes behavior.
  ```

  The code above defines required cases, not a passing fixture algorithm.
  Concrete tests must assert actual output/IO/custody/independent hashes;
  no no-op loops or source-text-only success assertions. Write an immutable
  RED-ready report with J pins, exact cases and expected semantic failures.
  Do not execute Node or edit H until Root consumes the original RED result.

- [ ] **Step 2: Root runs original RED.** Root freezes test-only pins and
  invokes these exact safe suites with fixed Node26.4.0, strict PATH/LANG/LC,
  original capture and source/writer bookends:

  ```bash
  /opt/homebrew/Cellar/node/26.4.0/bin/node --test \
    scripts/__tests__/manual-orphan-bootstrap-owned-route-v1.test.js \
    scripts/__tests__/private-postgres-test-cluster.test.js \
    scripts/__tests__/path-contract-fixed-host-policy.test.js
  ```

  Root separates intentional new semantic failures from scaffolding and
  unrelated regressions. Never run the protected generic wildcard suite.

- [ ] **Step 3: Implement only after Root RED.** Factor shared private
  metadata/read/custody machinery as needed. Add a fixed internal verification
  route used only by ordinary pins `check`. Lazily create one65536 scratch and
  one EOF buffer per pass after its first pre-read gate. Fresh SHA256 per file;
  expected SHA must already exist. Preserve exact physical/pre/post metadata,
  requested file positions/lengths/positive short-read bounds, full coverage,
  one EOF read and digest acceptance. Ordinary byte-return paths remain exact.
  Keep one temporary delegated descriptor and the current same-owner/close
  refusal ledger; no new caller flag, retained observation or retry. Write a
  GREEN-ready report with exact H/J pins and self-review, then stop writes.

- [ ] **Step 4: Root verifies GREEN and reviews.** Root consumes original
  three-suite GREEN, Node `--check` H and `node scripts/check-path-contract.mjs`
  using the actual package path-script mapping (inspect package.json first).
  Every old case must remain passing; any unchanged old fixture assertion
  about offset is adapted only to distinguish the new scratch destination
  from exact original file position. Root must not label scaffolding as a
  security refusal. Fresh independent task spec+quality review follows; fixes
  stay scoped and get targeted original verification. No unreviewed delivery.

- [ ] **Step 5: Root checkpoints and delivers the scoped branch.** Once
  required verification and final whole-diff review approve, Root stages only
  H/J/spec/plan, commits conventionally, pushes this branch, opens a reviewable
  PR and consumes actual GitHub checks/comments. Ordinary reviewed merge is
  authorized; no direct-main commit/force/admin bypass/deletion. Build only
  from a clean worktree, without dirty/runtime skip switches. A successor
  clean-main stock build/material binding/new admitted Source measurement is
  a distinct next phase, not automatic PASS from tests. Keep the actual454
  failure and all live/genuine/full8 guards in the handoff.

## Controller rulings and self-review

Ruling: Existing user continue/fix authority and Standing Owner Authorization
v1 cover this causal ordinary source refinement and its review/delivery;
brainstorming's repeated design-approval prompts and plan execution-choice menu
are unnecessary — reason: they would re-request already bounded authority —
cost if wrong: reversible source work remains isolated and reviewable; stop at
any actual new destructive/credential/runtime-guard authority boundary.

Ruling: Tests execute only in Root and only the exact three safe suites —
reason: generic npm test selects separate protected PM work — cost if wrong:
validation is limited to this declared affected slice and later stock build,
never a claim that the entire protected system campaign passed.

Ruling: Preserve SDD workspace/evidence after review — reason: current owner
requires session continuity and new records retained — cost if wrong: modest
disk use; no destructive scratch cleanup is authorized.

| Task/interface | Self-review |
| --- | --- |
| Tests → actual private pins | Existing contained source extraction; semantic allocation RED plus independent content/custody assertions. |
| Shared read → ordinary/verification consumers | Same IO/metadata/EOF/close behavior; only allocation destination/hash streaming differs. |
| Root RED → author implementation | Explicit stage boundary; no agent execution or simultaneous writer. |
| Source change → admission/timing | New main/build/material required; no old-case replay or unproven fit. |

Self-review: one independently reviewable task, concrete file/interface map,
unchanged M/T/clock/owner constraints, adversarial regression matrix and exact
Root test command are supplied. No implementation or timing result exists in
this plan. The measured failure is the causal reason, not permission to weaken
the platform's proof obligations.

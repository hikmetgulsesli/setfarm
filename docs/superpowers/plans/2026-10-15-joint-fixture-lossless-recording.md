# Joint Fixture Lossless Recording Implementation Plan

> **For agentic workers:** Root is the sole implementation/delivery owner. Use read-only independent review for each completed change; no delegated source writer or producer.

**Goal:** Prevent the remaining joint test campaign from recreating duplicate uncompressed trace files while preserving their complete original JSON content.

**Architecture:** Gzip both retained trace records at their initial write and decode originals before the unchanged assertions. Confirm the actual emitted artifacts, captured streams and terminal evidence through the existing genuine fixture callback. Retain the separate verified archival custody map for historical raw files.

**Tech Stack:** Node.js builtin node:zlib, fs, node:test; no dependencies.

**Spec:** docs/superpowers/specs/2026-10-15-joint-fixture-lossless-recording-design.md

## Global Constraints

- Existing sole writer branch fix/cutover-dashboard-reviewed-delivery-v6; parent165c3a4a8605b7289906001c0be5186488cf465e.
- Disk floor8GiB; no parallel heavy producers; no private-root/process adoption.
- Original11088 remains CANCELLED/refused/incomplete; first alias incomplete, remaining4UNRUN.
- Preserve every existing resource/terminal/EOF/close oracle, child stdout/stderr and source-only authority boundary.
- PM2 execution remains owner-closed UNRUN, never PASS; do not select test:scripts or a wildcard that includes it.
- No production Source, schema, service, build guard, native/Root or held XS changes in this correction.

## File Map

1. scripts/__tests__/deployment-dashboard-cutover-adapter-v2.test.js: compressed original/result recording, original decoding, genuine persisted-artifact regression assertions.
2. docs/superpowers/specs/2026-10-15-joint-fixture-lossless-recording-design.md: measured cause, selection and unchanged evidence boundaries.
3. docs/superpowers/plans/2026-10-15-joint-fixture-lossless-recording.md: causal plan and actual validation checkpoints.

## Task1: Correct duplicate recording

- [x] Add assertions after the existing child terminal/stream checks and before reading originals:

```js
assert.equal(fs.existsSync(root+'.joint-originals.json'),false,'raw original trace must not duplicate compressed evidence');
assert.equal(fs.existsSync(root+'.joint-result.json'),false,'raw result trace must not duplicate compressed evidence');
assert.equal(fs.existsSync(root+'.joint-originals.json.gz'),true);
assert.equal(fs.existsSync(root+'.joint-result.json.gz'),true);
```

- [x] Run only the first existing callback, retain actual stdout/stderr/terminal, and verify failure on raw original evidence rather than a fixture/import error:

```bash
env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL node --test --test-name-pattern='^fixed joint original-operation qualifier is available before any participant acquisition$' scripts/__tests__/deployment-dashboard-cutover-adapter-v2.test.js
```

- [x] Import gzipSync/gunzipSync in the parent and gzipSync in its child program. Replace the two raw writes with gzipSync(Buffer.from(JSON.stringify(value)),{level:3}) into the corresponding .json.gz names; read originals with gunzipSync. Decode the persisted result and assert its stdout/stderr and status/signal/error/EOF/closed agree with the actual capture. Keep every previous assertion and callback unchanged.
- [x] Run the exact same callback once for actual GREEN. Check node --check and git diff --check.
- [ ] Independently review the three current paths plus actual RED/GREEN and protected source pins before normal scoped commit/push/PR readback. No stock Setfarm build is permitted on the feature branch.

## Task2: Complete the maintained remaining suffix

- [ ] Freshly verify clean delivered HEAD, disk headroom and no active root-owned producer. Run exactly:

```bash
node scripts/run-private-postgres-tests.mjs after-local-custody
```

- [ ] Record actual five-alias results, outer terminal and maintained strict journal. Require genuine test/server exit-close, both quiescence observations and admin ending before local cleanup credit; preserve unknown/cancelled/failed outcomes. Never reuse11088's private root.
- [ ] Only after terminal classification continue the separately held XS restoration and broader remaining acceptance gates. This plan is not a waiver or global completion record.

At plan creation all new regression execution and implementation were UNRUN. Historical archival verification is not regression-test or whole-campaign PASS.

## Actual scoped validation checkpoint

The one genuine existing callback failed before implementation because its raw original artifact existed: actual342947 exit1,1test/0PASS/1FAIL/0other. Its child itself closed normally0/null with both captured EOF/close flags true. Raw1503B SHA256964a0e59ac8eac401d4fdbefebf4734f773e37cba392c820384a8ed055cf7e74 is retained in logs/2026-10-15-disk-recovery-v1/joint-recording-red-v1.log. This is an artifact-storage regression, not a production Source failure.

After the minimal gzip writes/read and persisted-result assertions, the same exact selected callback passed: actual400959 exit0,1test/1PASS/0other. Raw698B SHA2567bd5c03ce2efb4bba4f1aa833b41923f4864dd7ea9c3acf91c6bae68bc053309 and the decoded artifact pins are retained in joint-recording-green-receipt-v1.json. Both raw duplicates are absent and both gzip records decode; the originals contain passed=true/actual=false/nativeCalls=0. Syntax and diff checks exit0. No other alias, PG, production Source, Root or whole-goal qualification follows. Final review/delivery and the fresh five-alias campaign remain pending.

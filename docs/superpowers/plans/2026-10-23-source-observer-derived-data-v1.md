# Clean Source Observer Derived Data Plan

> For agentic workers: REQUIRED SUB-SKILL: subagent-driven-development.

**Goal:** Reduce repeated private encoding/serialization while preserving
every Source observation, result, refusal and clock.

**Architecture:** Task1 observer/tests, Root semantic RED then minimal GREEN
and review/clean-build evidence; Task2 independently reviewed M admission and
fixed-T fixture separation, RED/GREEN and final review. Root alone executes.

**Tech Stack:** existing TypeScript ESM observer and finite Node test harness,
existing pinned compiler/loader; no dependency or public API addition.

**Spec:** docs/superpowers/specs/2026-10-23-source-observer-derived-data-design-v1.md.

## Global constraints

Read the complete spec. Preserve all actual FS/Git/context/read/digest/metadata/
topology/absence/resolver/custody proof calls and temporal ordering, old120000ms
and subordinate5000ms clocks. No native resolver, cache, public selector, new
import/export/module, changed profile/raw/T, service/credential/DB effects or
guard bypass. Source changes serialized in the existing sole writer. Author
and reviewers do not run Node/tests/builds or stage/commit/deliver; Root does.

## File Map

Modify only observer TS, its existing TS test file, H maintenance admission,
J manifest/admission tests, this plan and its spec. No release/generated edits.

### Task 1: Derived computations with actual-function parity

**Files:**
- Modify src/internal-production/baseline-post-handoff-receipt-v1.ts.
- Test tests/internal-production/baseline-post-handoff-receipt-v1.test.ts.
**Consumes:** complete spec above and existing finite observer test helpers.
**Produces:** private sort/vector helpers and exact selected-site use, tests
demonstrating semantic RED then parity GREEN without Source owner execution.

- [ ] Step1: Read applicable AGENTS and exact existing functions/tests. Add
  focused tests only, in a uniquely named describe group
  `clean Source derived computation parity v1`. Reuse the existing isolated
  actual-source loader; do not create a fake successful Source owner. Provide
  Root exact pattern/command and static package/tool inputs; STOP writing after
  RED_READY until Root supplies actual RED qualification and permission to
  implement. No Source TS edit before that checkpoint.

  Allocation RED: actual derivePinnedSet on a finite unsorted8+ entry fixture
  counts only locator UTF8 encodings through isolated Buffer observation. Assert
  <=N encodings forN>=2 (zero forN<2) and exact old-comparator output/identity.
  The current comparator must fail this bound for the chosen fixture. Use a
  separate selected strictObject/observeArtifacts fixture to count only the
  removed key/vector canonicalization calls; preserve unrelated raw/hash calls.
  Baseline failure must be the semantic bound, not loader/missing function.

```typescript
const expected = originalEntries.slice().sort((a, b) =>
  Buffer.compare(Buffer.from(a.locator, "utf8"), Buffer.from(b.locator, "utf8")));
assert.deepEqual(observed.entries, expected);
assert.ok(observed.locatorEncodings <= originalEntries.length);
```

- [ ] Step2: After Root original semantic RED, add private implementations:

```typescript
function sortCleanSourceByUtf8V1<T>(items: T[], keyOf: (item: T) => string): T[] {
  if (items.length < 2) return items;
  const encoded = items.map((item) => ({ item, key: Buffer.from(keyOf(item), "utf8") }));
  encoded.sort((left, right) => Buffer.compare(left.key, right.key));
  for (let index = 0; index < items.length; index += 1) items[index] = encoded[index]!.item;
  return items;
}
function equalCleanSourceStringVectorsV1(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false;
  return true;
}
```

  Keep global compareBytes/canonicalComparable unchanged. Replace only the
  eight current Source sorts: derivePinnedSet entries; expectedTopology outputs
  and directories; observeArtifacts readdir names, directories, expectedFiles,
  files and fileSnapshots. Preserve the same arrays/entries/freeze placement.
  For the record-map chain, pass its completed original mapped array into the
  helper before collision checks; do not move canonicalLocator out of map.
  For readdir names, sort the same fresh array before the unchanged loop and
  validation. No cross-sort encoding reuse or pre-validation transformation.

  Replace only strictObject ordered Object.keys equality; artifacts directory
  and file vector equality; output-entry ordered key equality. For example:

```typescript
if (!equalCleanSourceStringVectorsV1(Object.keys(record), keys))
  fail(`${label} has unknown, missing, or reordered fields`);
```

  Keep actual messages/raw reconstruction/hash/body checks exactly. Do not
  replace canonicalComparable(outputTree.entries), manifest/object comparisons
  or any other consumer.

- [ ] Step3: Add exact actual-function differential controls: empty/singleton,
  sorted/reversed/many, ASCII/prefix, escaped/control, NFC/NFD, astral/BMP,
  duplicate and equal-UTF8 keys/lone surrogates; stable ties, same input array
  and object identities, no early freeze. Protect sort/validation/collision
  refusal order in real selected functions. Ordered vector cases include same
  length substitution/reorder, missing/extra keys, escaped/surrogate strings;
  retain raw whitespace/duplicate-key rejection and exact canonical hashes.
  Compare full finite actual FS/Git/read/stat/EOF/close/bookend operation trace
  and failure prefix against original authority. Isolated counters must not
  alter the host realm or swallow assertion failures as expected refusals.
- [ ] Step4: Freeze source/tests after IMPLEMENTED; report exact changed files,
  group command, tests/coverage and all actual observations Root supplied.
  Root runs focused group/adjacent observer controls, obtains task review and
  commits scoped tested source. Root then runs guarded build on CLEAN writer;
  no SETFARM_ALLOW_DIRTY_BUILD or runtime bypass. If a real guard refuses, keep
  original evidence and diagnose rather than disable it. No Source acquisition
  with the intermediate stale H aggregate.

### Task 2: Independently bound maintenance and fixed-target manifests

**Files:**
- Modify tests/execution-attempts/helpers/manual-control-orphan-bootstrap-child-v1.mjs (H).
- Test scripts/__tests__/manual-orphan-bootstrap-owned-route-v1.test.js (J).
**Consumes:** Task1 reviewed code, Root clean-build actual compiled output and
independent143-record audit/review. Unknown future digests are NOT guessed.
**Produces:** separate M/T expectations and scoped reviewed M aggregate only.

- [ ] Step1: Root independently enumerates exact143 M records using the fixed
  already-audited locator set, sorted UTF8 and JSON field order locator/sha256,
  compares every unchanged member to baseline and explains each changed body
  from reviewed source/compiler/config. Compute the new aggregate as:

```javascript
createHash('sha256').update(JSON.stringify(records)).digest('hex');
```

  An independent static review authenticates changed compiled bytes and this
  calculation before Root sends concrete pins in Task2 brief. Fixed T153
  aggregate ef3696ca8b4cfcd387eb3cc77000a13781fde1cb17da9550abe2b88ed7656d2b,
  profile77005216... and rawb2e03e4b... remain exact. This is source-derived
  expected material, not updating a failed current-release observation.
- [ ] Step2: Author changes J only for RED: retain independent historical
  common/T rows, create explicit reviewed M overrides, never spread mutable M
  into T. Exact M143 new aggregate positive must fail current stale H.
  FixedT153 original aggregate stays positive. Add digest (not count-only)
  crossed controls: old shared M as maintenance refuses; changed M observer row
  inside153 target refuses; wrong/omitted/duplicate/reordered records refuse.
  Root obtains original semantic RED, author STOPPED before H change.
- [ ] Step3: After Root RED, update only H maintenance aggregate to the concrete
  independently reviewed expected value. Keep target aggregate, all proof
  algorithm/counts/receivers/zeroargs/cleanup/phase and clocks unchanged.
  Update stale explanatory comment if needed; no profile/hash acceptance
  fallback or generated runtime edit. Freeze and report Root exact pins.
- [ ] Step4: Root runs the existing three safe Node suites (J,
  private-postgres-test-cluster.test.js, path-contract-fixed-host-policy.test.js),
  H syntax, relevant observer parity/adjacent tests and guarded CLEAN build.
  Every required original is consumed; record scoped skips honestly, no generic
  npm test selection of separate protected campaigns. Obtain Task2 review and
  broad final branch review; Root owns conventional commits/push/PR/normal merge.

## Completion boundary

Source code completion requires actual semantic RED/GREEN, task/final review,
clean build and reviewed M admission. Delivery does not prove timing. Root must
qualify successor clean-main stock/actual public point and a separately admitted
fresh120s composition with original custody. Do not replay prior namespaces,
widen/reset clocks or claim Source/genuine/full8/rollout GO from pure tests.

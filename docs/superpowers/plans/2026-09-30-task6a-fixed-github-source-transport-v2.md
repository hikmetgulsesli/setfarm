# Task6A Fixed GitHub Source Transport v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Root implements inline; user requires a sole writer. Agents are read-only reviewers.

**Goal:** Join actual fixed HTTPS merged main and exact selected Git source bytes without granting production or review authority.

**Architecture:** One zero-input builtin-only MJS reader calls fixed system curl and the delivered pure object verifier. It brackets main and joins closed merged PR and selected trees/blobs, returning diagnostic digests only.

**Tech Stack:** Node22 ESM builtins, macOS system curl, public GitHub REST, node:test and vm.SourceTextModule.

**Spec:** `docs/superpowers/specs/2026-09-30-task6a-fixed-github-source-transport-v2-design.md`

## Global Constraints

- Root sole writer; preserve all old trees/branches and dirty19.
- Exactly zero input; fixed repo/main/CA/system curl and selected two MJS paths.
- 60-second monotonic total deadline, ten-second perGET, five-second connect, no retries; maximum response4MiB plus trailer.
- Scope merged-source-transport-diagnostic-only; productionAuthorityfalse/reviewAuthorityfalse.
- No write/root/vendor/archive/native/DB/service/selector/admission effect or guard bypass.
- Independent source review, fresh exact-head GitHub/security/comment gate, normal reviewed PR merge and ordinary clean-main verification.

## File Map

- Create `scripts/task6a-fixed-github-source-transport-v2.mjs`: real fixed curl reader and joined merged/source diagnostics.
- Create `scripts/__tests__/task6a-fixed-github-source-transport-v2.test.js`: real VM module graph, external transport/clock doubles, coherent Git fixtures and consuming npm graph coverage.
- Create this spec/plan; no package/default runtime changes. Existing scripts glob must select the test.
- Reuse, do not modify `scripts/task6a-github-delivery-object-v2.mjs`.

### Task 1: Fixed HTTPS merged source reader and complete refusal coverage

**Interfaces:** Consume the three delivered `verifyTask6aGithub*ObjectV2(record,expectedSha)` functions. Produce `observeCurrentTask6aGithubMergedSourceTransportV2()` and only frozen diagnostic results described in the spec.

- [x] Write independent literal fixture framing in tests and a VM loader using the actual delivered verifier. Replace only `node:child_process.spawnSync` and `node:perf_hooks.performance.now`; never production injection parameters.
- [x] Write the positive contract test first:

```js
const {observe,calls,fixture}=await loadReader();
const result=observe();
assert.equal(result.mainSha,fixture.mainSha);
assert.equal(result.productionAuthority,false);
assert.equal(result.reviewAuthority,false);
assert.deepEqual(result.sources.map(x=>x.path),[
  'scripts/task6a-github-delivery-object-v2.mjs',
  'scripts/task6a-fixed-github-source-transport-v2.mjs']);
assert.equal(calls.length,9);
```

- [x] Add behavior tests rejecting caller args before any subprocess, request env/config/proxy/redirect/effective URL/status/encoding/bounds/errors, open/mismatched PR/base/head/merge, incomplete/ambiguous association, coherent symlink/size/byte substitution, missing blob and differing main endpoints. Assert frozen nested results and no extra request after refusal. Endpoint equality cannot exclude ABA moves or attest continuous main stability.
- [x] Run `node --experimental-vm-modules --test scripts/__tests__/task6a-fixed-github-source-transport-v2.test.js` and record missing implementation assertion RED. Initial35 failed expected assertion. Corrected independent literal SHA and a VM file-URL harness read; harness defect is not claimed production RED.
- [x] Implement fixed route derivation, direct curl args/options, exact UTF8/status trailer parsing, deadline checks and existing verifier composition. The output's data records never serve as protected authority.
- [x] Run the complete new suite and PR251 suite; expanded43+62 passed105/0fail/0skip. In-memory moving-main guard mutation misses the actual refusal consumer; no source files rewritten.
- [x] Exercise actual default npm graph selecting a bounded real new leaf; omitted-glob mutant rejected before child. Default test invocation spawns full43 VM suite if needed because normal scripts test command omits the experimental VM flag; test-only, bounded and scrubbed.
- [x] Run source `tsc --noEmit`, node syntax checks, version2.3.79/English1888/path952/frozen migration/12MC contracts and diff checks; no ambient full test side effects.
- [ ] Independent read-only exact file/hash review. Scope feature build attempt must respect existing main guard; no dirty/guard bypass.
- [ ] Stage only the four mapped files and conventional commit; normal push/scoped PR. Request optional Copilot/Gemini once using existing accounts. Obtain fresh-head available mandatory cloud/security gate and inspect full paginated comments/reviews/threads before normal SHA-bound merge.
- [ ] Fast-forward clean standby main, ordinary `npm run build`, actual compiled source/build observer, merged new+object suites, zero-input actual fixed public HTTPS observation and read-only PG/HTTP/selector checks. Keep standby unselected; record exact evidence and remaining bootstrap/compiler/fence/genesis/admission obligations externally.

No new privileged execution is authorized by this plan. Later source launcher admission requires its own exact design, TDD and independent pre-effect review.

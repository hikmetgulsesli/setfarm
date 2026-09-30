# Task6A GitHub Delivery Object Protocol Implementation Plan

> **For agentic workers:** Root executes inline, sole writer/delivery owner.
> Read-only investigation and independent review are the only delegated roles.
> Use test-driven-development and verification-before-completion task by task;
> delegated owner choices remove repeated approval menus, never evidence gates.

**Goal:** Validate the signed-merge/tree/blob byte protocol needed by a later
authentic fixedHTTPS source publisher, without granting provenance authority.

**Architecture:** One builtincrypto-only MJS unit validates plain API data,
recomputes framed Git objects and returns frozen protocol characterization.
No external effects, installation, runtime capability or admission callsite.

**Tech Stack:** Node22 builtincrypto, ESM MJS, node:test, no new dependencies.

**Spec:** docs/superpowers/specs/2026-09-30-task6a-github-delivery-object-v2-design.md

## Global Constraints

- Preserve all old worktrees/branches/dirty19; no reset/revert/stash/main commit.
- No HTTPS/root/account/credential/ACL/DB/service/selector/vendor effects.
- Protocol DTOs remain productionAuthority:false; expected SHA is untrusteddata.
- Only canonical signed two-parent merge, nonrecursive regular/tree and bounded
  canonical base64 blobs. Preserve bytes; no normalized timestamps/signatures.
- Fixed bounds: payload64KiB/signature16KiB/tree4096entries/name255UTF8bytes/
  blob2MiB, exactUTF8 and nonnegative safeinteger sizes, no metadata coercion.
- Root sole writer; proportional focused verification, no guard bypass.

### Task1: Signed merge framing

**Files:** create scripts/task6a-github-delivery-object-v2.mjs and
scripts/__tests__/task6a-github-delivery-object-v2.test.js.

**Interfaces:** `verifyTask6aGithubSignedMergeObjectV2(record, expectedSha)`
returns frozen protocol-only {schema,objectKind,sha,treeSha,parentShas,
productionAuthority:false}; throws TASK6A_GITHUB_OBJECT_PROTOCOL_REFUSED.

- [x] Write tests loading the actual module only after asserting it exists;
  missing function/module must fail an assertion, not a parse/import error.
  Golden raw commit fixture has independently literal expected Git identity.

```js
assert.equal(verifyTask6aGithubSignedMergeObjectV2(commit, literalSha).sha, literalSha);
assert.throws(() => verifyTask6aGithubSignedMergeObjectV2(alteredPayload, literalSha));
```

- [x] Run `node --test scripts/__tests__/task6a-github-delivery-object-v2.test.js`
  and observe missing behavior RED. Then implement exact two-argument plain
  shape/bounds/UTF8/header/signature validation and framedhash comparison.
- [x] Add byte mutation/headerparent/tree relation/unsupportedsignature/arity/
  accessor/prototype/oversize refusal tests. Run GREEN before commit.

### Task2: Nonrecursive tree and blob framing

**Files:** same MJS and adjacent pure test.

**Interfaces:** `verifyTask6aGithubTreeObjectV2(record, expectedSha)` returns
frozen protocol-only treeSha/entryCount; `verifyTask6aGithubBlobObjectV2(record,
expectedSha)` returns frozen protocol-only sha/byteLength/contentSha256.
All outputs contain productionAuthority:false; no returned paths or capability.

- [x] Add independently literal tree hash with filename/directory sort crossing
  and known hello-newline blob ce013625030ba8dba906f756967f9e9ca394464a.

```js
assert.equal(verifyTask6aGithubBlobObjectV2(blob, literalBlobSha).byteLength, 6);
assert.throws(() => verifyTask6aGithubTreeObjectV2(truncatedTree, literalTreeSha));
```

- [x] Observe RED for absent tree/blob exports, implement canonical Git ordering/
  serialization and strict canonical base64/bounds with minimal helpers.
- [x] Test altered OID/mode/order semantics/duplicates/casefold/path/symlink/
  gitlink/type/truncation/size/encoding/UTF8/extraargs. Verify GREEN and confirm
  framing mutations are rejected, not caught test assertions.

### Task3: Review and delivery

- [x] Verify actual default test:scripts glob selects adjacent test (existing
  consumer coverage can use bounded actual selected leaf, never text-only claim).
- [x] Run focused complete module tests plus sourceTS, contracts and diffcheck.
- [ ] Independent read-only implementation review; fix real findings withTDD.
- [ ] Scoped commit/push/PR; complete exact-head cloud/security/review/threads.
  Normal SHA-bound merge, preserve branch/worktree, ordinary cleanmain standby
  build, compiledobserver and readonlyhost checks. No productionorigin claim.
- [ ] Next design: fixed realTLS stablemain/merged/reviewed source delivery,
  system-only bootstrap/vendorNode/native admission, genuine heldsource origin.

## Evidence

New isolated worktree at reviewedmainb553919c; npmci--ignore-scripts16packages.
Fresh baseline eval/socket6PASS/0FAIL/0SKIP.
Initial40 tests observed assertion-missing-module RED, then40GREEN. Additional
coherently hashed malformed/multiple-PGP-armor cases exposed genuine RED and
were fixed by strict armor parsing; no local CRC/GPG trust claimed. Independent
review prompted coherent invalid tree/hash guards and accurate Proxy/subset
scope. Its terminal-newline `$` concern was retracted after actual Node22 tests
disproved it; no fakeRED or spurious anchor fix. Those four cases remain
characterization tests. Current62PASS/0FAIL/0SKIP include full2MiB blob, explicit
UTF8 literal350byte/347character commit framing and default actual selected leaf.
In-memory character-count framing mutant refuses the UTF8 golden; removed
default-glob mutant makes the actual consumer reject before child creation.
No source file rewritten by mutation checks. SourceTS/node-check/English1884/
paths950/version2.3.79/frozenmigration/12MC/diffcheck PASS.

Actual read-only API experiment through ordinary Node/fixed systemcurl/CA
recomputed current signed merge b553919c, root990867a9(32entries), scripts
subtree56entries and existing33251byte MJS blobadbd7df6/SHA256c456a1ab.
This is real API object-protocol compatibility, not proof this unmerged verifier
is an admitted protected publisher. No vendor archive/root/install/runtime
effects. Independent complete source review found no implementation blocker;
final doc/UTF8 coverage follow-up and scoped delivery remain pending. All
producer/origin/fence/genesis/live32+33/admission/fresh-run gates stay unresolved.

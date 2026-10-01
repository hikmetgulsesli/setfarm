# Task6A Protected Source-Entry Bootstrap v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Root executes inline as the only writer; agents inspect/review read-only.

**Goal:** Prove a genuine delivered protected private MJS entry, official vendor Node and actual parent-owned unprivileged execution without granting production authority.

**Architecture:** Explicitly owner-admitted Apple system Perl retains the root source/vendor/physical/process holder and directly forks/drops credentials/execs one protected entry. Pure bounded archive/native helpers are authenticated before import. A separate actual rehearsal runs only after reviewed delivery and exact pre-effect clearance.

**Tech Stack:** Apple Perl5.34.1 with fixed SIP core/XS search, Apple curl, builtin-only Node22.23.1 entry, node:test, isolated explicitly opted-in macOS rehearsal.

**Spec:** `docs/superpowers/specs/2026-09-30-task6a-protected-origin-bootstrap-v2-design.md`

## Global Constraints

- Root sole writer; preserve all old worktrees/branches, failed fixtures and dirty19.
- Initial owner admission is explicit and independent; generic rootcopy/hash/JSON is not origin.
- Zero runtime caller selection; fixed system tools/source policy/GitHub/official Node routes.
- Fix first Perl BEGIN @INC to exactly the two SIP5.34 roots before imports; scrub external env and use -f. No default Library/Network/Updates/Extras modules.
- Compressed128MiB/expanded512MiB/members20000/selectedNode128MiB bounds; no unrelated archive extraction, root Node, npm, Git or generated installer execution.
- No source/vendor download or privileged effect until separately reviewed exact delivered package and invocation; no unmerged feature called delivered.
- Private diagnostics only, productionAuthorityfalse. No compiler/fence/genesis/32/33/admission/live-selector effect or guard bypass.
- Actual parent PID/private pipes/definite reap, not child JSON, determines lifetime and cleanup. Uncertainty preserves exact fresh fixture.

## File Map and interfaces

- Create `scripts/task6a-origin-archive-v2.pm`, package `Task6aOriginArchiveV2`, pure `extract_node_v2($gzip_bytes)` returning exact selected member bytes or `TASK6A_ORIGIN_ARCHIVE_REFUSED`. Input/output are bytes, not origin authority. Use fixed SIP IO::Uncompress::Gunzip; no disk writes/exec/network/UID changes.
- Create `scripts/task6a-origin-native-v2.pm`, package `Task6aOriginNativeV2`, pure `assert_node_native_v2($bytes)` returning diagnostic native details or `TASK6A_ORIGIN_NATIVE_REFUSED`. No process/tool invocation or admission authority.
- Create `scripts/task6a-origin-map-v2.pm`, package `Task6aOriginMapV2`, pure
  `parse_map_v2($raw_bytes,$captured_pid)` returning complete interleaved grammar
  diagnostic/regions or `TASK6A_ORIGIN_MAP_REFUSED`. No process/FS effects or
  admission. Bounds1MiB/8192lines/4096regions/64summarycategories/32malloczones;
  exact bound PID/full sections, canonical numeric ranges/paths/known labels,
  all current/max permissions and complete metric/footer rows. Final reviewed
  literal source blob is added to authentic publisher policy before import.
- Create `scripts/task6a-protected-origin-entry-v2.mjs`, builtin-only zero-extra-argument child: READY, fresh parent CHALLENGE/PONG exchange, END/EOF and fixed20s deadline. No child-reported identity or arbitrary eval/paths/imports.
- Create `scripts/task6a-protected-origin-bootstrap-v2.pl`: fixed zero-argument root system supervisor; source/vendor authentic retrieval, protected staging, held direct child/lifetime and exact cleanup. Helpers are imported only after fixed Git byte-policy authentication.
- Create `scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js`: invoke actual fixed system Perl and helpers under scrubbed environment, actual child entry and parent contract. Default no privileged effects.
- Create `scripts/task6a-origin-observer-recon-v2.mjs`: ordinary-only zero-arg
  controlled owned-child map-format exploration, mandatory exact review before
  observer execution. No privileged/source/vendor/DB effects; not origin proof.
- Create `scripts/__tests__/fixtures/task6a-origin-vmmap-interleaved-v2.txt`:
  sanitized complete actual ordinary own-child map fixture for strict pure-parser
  grammar tests only, never production/native-origin evidence.
- Create `tests/execution-attempts/task6a-private-protected-origin.integration.test.ts`: actual independent owner-install invocation/entry/private fixture, explicitly opt-in and gated on delivered package/exact pre-effect clearance. Register only safe default tests; a new opt-in package command is allowed only if needed and source/tests/spec map includes it.
- Spec/this plan and external checkpoints. No V1/dirty19/default production entry changes.

### Task 1: Archive and static native denial primitives

**Consumes:** Raw gzip and Node image bytes from the later trusted publisher, never caller provenance. **Produces:** The two exact pure Perl interfaces above.

- [ ] Write Node test fixtures assembling literal ustar headers/checksums/padding and gzip bytes independently with node:zlib. Run actual `/usr/bin/perl -f` with first-BEGIN fixed SIP search and local reviewed helper `require` as an ordinary test UID. Test-side local paths are not production selection.
- [ ] Positive fixture contains unrelated symlink/npm metadata plus exactly one regular fixed bin/node; assert only literal selected bytes return. Negative fixtures: duplicate selected name, selected symlink/hardlink, missing member, wrong checksum/octal/size, truncated header/body/padding, missing double-zero EOF, nonzero tail, overbound declared node/total/member count, effective path substitution through local PAX/GNU name, ambiguous or malformed extension and gzip CRC/trailing/concatenated stream. Reject unsupported effective paths rather than guessing.

```js
assert.ok(fs.existsSync(new URL('../../scripts/task6a-origin-archive-v2.pm',import.meta.url)),
  'archive implementation missing');
const actual=runActualSystemPerlArchive(literalGzipFixture);
assert.deepEqual(actual,Buffer.from('literal selected bytes'));
```

- [ ] Run focused tests, observe expected missing-implementation assertion RED, fix harness defects separately. Implement streaming128MiB compressed/512MiB expanded/20000member bounds, checksum and size parsing, PAX/GNU effective path state, exact regular uniqueness, selected128MiB bound and complete EOF/CRC. No filesystem extraction.
- [ ] Add independently built thin arm64 Mach-O vectors: exact executable/header/reserved/table/count/size, mandatory one `/usr/lib/dyld`, complete loader strings, only canonical `/usr/lib/` or `/System/Library/` dependencies. Reject wrong CPU/filetype, unknown/path-affecting command, duplicate linker, RPATH, DYLD_ENVIRONMENT, external/relative/@rpath path, crossing offsets, malformed terminator and truncated table. Observe native helper missing RED, then minimal GREEN.
- [ ] Assert pure helper error sanitization and no writes/child tools. In-memory invalid command/path/duplicate-member mutants must miss real refusal consumers; never rewrite source for mutants. Actual default npm graph must select this suite and dispatch a bounded real leaf.

### Task 2: Fixed entry and system supervisor

**Consumes:** Pure helpers only after actual admitted delivery. **Produces:** Fixed actual source/vendor/physical/direct-child held diagnostic, not a serialized capability.

Current evidence: Task1 pure helpers independently reviewed at archive blob
da1fd458fcaba775be5ba09ef88157b5ee48dbda and native blob
59e1ae8de38cf2083a0294c55454083840eb47f1;110tests passed. Two genuine review
findings (empty pending PAX and8byte segment command) each reproduced RED then
fixed;25 additional structural command/platform REDs fixed. Actual20000/20001
tar-member and4096/4097command bounds tested with coherent complete fixtures.
Read-request observer isolates selected-size denial before body reads; lowered
in-memory test limits exercise compressed/expanded branches without allocating
128/512MiB. These are pure-byte diagnostics, not vendor/admission evidence.

Entry16missing-source AssertionRED then16GREEN; final-END broken output exposed
real exit0bug, independently RED and fixed by checking its end callback error.
Open-input replay consumer prevents premature EOF from masking missing replay
checks. Embedded Perl Git framing31missing-source AssertionRED then31GREEN;
main remains unconditionally fail-closed while publisher/held origin are absent.
Its SIP B scalar flags preserve parsed numeric-vs-string field typing; full root
PM/XS closure admission must include B before any privileged execution.

Current transport evidence: helper lifecycle independently reviewed after actual
FD200 closure, partial-readdir EIO, undefined POSIX calls/waitpid and sticky
uncertainty consumers. Actual full suite224PASS/0SKIP before later additions.
Metadata38 plus missing-route-guard exec-edge mutant1PASS independently reviewed;
only external capture/clock is replaced in tests, preserving UTF8/JSON/body/depth,
timers and all ten Git framing/source joins. Post-decode expiration was genuinely
accepted in two RED tests before the new final clock check. Vendor16 protocol
tests now pass with coherent synthetic gzip/pin substitution IN MEMORY only:
no real archive, vendor-positive or source-origin claim. Canonical unrelated
relative manifest names are inert, never URL/extraction selections. Actual full
v22.23.1 manifest has not been acquired by the bootstrap; primary web reader was
unavailable, so the Windows-row compatibility fixture is explicitly synthetic.
Main remains unconditionally refused. Stage/UID drop/held origin are absent.

Current physical-holder fragment:20 missing-implementation REDs then20GREEN;
16 ACL REDs then16GREEN;13 ancestry REDs then13GREEN. Actual ordinary read of
fixed root-owned Perl retains nofollow/CLOEXEC FD, raw SHA256 and identity checks;
private ledgers—not returned diagnostic fields—drive all rechecks/release. Actual
directory descriptors and complete fixed ls ACL rows are held/sampled; only exact
rootwheel/private/tmp01777 sticky ancestry is allowed writable. Directory checks
hold dev/inode/mode/uid/gid, NOT changing contents/mtime or a descendant/ABA fence.
Review exposed root/non-mac registration escape:3 JS-only simulated host REDs
with forbidden-child sentinel then moved registration and real/effective UID
gate GREEN. Actual ordinary FIFO with controlled pre-open regular snapshot
blocked500ms RED, fixed O_NONBLOCK yields ~20ms refusal. Private lifecycle6 tests
exercise actual4FD release, restored drift/failed hold stay burned, release/reopen
refusal and missing-burn in-memory mutant. Throwing close left3FDs RED; per-handle
guard continues completeclose and burns. Fresh full312PASS/0FAIL/0SKIP46752.522ms.
These are fragments, not protected-stage/native/entry/cleanup authority. Exact
independent physical-fragment review cleared bootstrap f9d37de5...fac64 and
tests981a1508...a73d; reviewer independently reran59PASS/0SKIP. The close-fault
port actually closes before injecting uncertainty: complete attempts and sticky
denial are proven, not native uncertain-close leak freedom.

### Task2 physical composition refinement (2026-10-01)

This closes the causally necessary gap between the already-delivered physical
fragments; it does NOT enable main or claim protected/native execution. Root is
the sole writer at .worktrees/setfarm-task6a-composed-physical-v2 on
fix/task6a-composed-physical-v2, base0185aaee631341d057c79e855e5ab9b51e9d402a.
The old private-test tree remains immutable2b6b3031 while interrupted descendants
settle; standby stays immutable4cdb88dd. Only one branch is written at a time.
All old trees/archives/failed footprints/user changes remain preserved.

**Files (exactly four modified):**
- scripts/task6a-protected-origin-bootstrap-v2.pl: private fixed composition and
  raw-capture/close ownership guard, no new imports or main behavior.
- scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js: ordinary real
  system-Perl consumers; only external ACL/stat/close fault ports in memory.
- docs/superpowers/specs/2026-09-30-task6a-protected-origin-bootstrap-v2-design.md.
- This plan. Source-helper/entry/vendor/native pins and production paths unchanged.

**Interfaces:** hold/recheck/release_system_perl_physical, each prefixed
task6a_origin_ and zero-argument. Fixed rootwheel0755/nlink1 /usr/bin/perl,
SHA256abda2bfd23a6c9a8e57adf2291f0aea4abd8faf440558ee49fe4ced55e8d9ad0,
max1048576 bytes; exactly three retained ancestry directories. Private state and
record references drive recheck, never copied diagnostics.

- [x] Verify new isolated clean baseline with unchanged dependencies:
  `node --test --test-name-pattern='retained|ACL sample' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js`
  Actual57PASS0FAIL0SKIP1345.173ms, exit0. No PG/native/privileged fixture effect.
- [x] Commit reviewed causal design/File Map before implementation (4f15bf5d).
  External
  source-only design review found release-before-raw-close and ownership/state
  pitfalls; canonical spec includes the fixes, not invented execution clearance.
- [x] Add test-only systemObject kind composed-physical, load actual declarations
  with sole final main removed IN MEMORY. Missing-interface assertion RED first:
  ```js
  const r=systemObject('composed-physical',{mode:'success'},'');
  assert.equal(r.status,0,r.stderr.toString());
  const out=JSON.parse(r.stdout);
  assert.equal(out.scope,'composed-system-perl-physical-candidate-diagnostic-only');
  assert.equal(out.productionAuthority,false);
  assert.equal(out.ownedCount,4);assert.equal(out.leakedCount,0);
  assert.equal(out.releasedRefused,true);assert.equal(out.reopenRefused,true);
  ```
- [x] Extend the same real consumer with exact leaf ACL fault AFTER healthy
  fixed baseline, preserving actual file metadata/hash and ancestor rows. Added
  row/plus marker/stderr/nonzero/unknown reap each refuses; restoration after
  caught recheck still refuses. @ xattr alone is not an ACL entry. Expected
  refusal is exactly TASK6A_ORIGIN_BOOTSTRAP_REFUSED, not generic harness failure.
- [x] Test post-capture ancestor drift; close fault counts actual descriptor
  attempts; helper failure plus definite reap cannot revive; partial initial
  capture attempts owned closure. Prior raw contamination is refused without
  closing its original descriptor; raw owner can still clean its own FD.
  Duplicate/arguments/recheck-before-start/release/reopen/raw additions refuse.
- [x] Implement minimal private new/starting/active/burned/released state,
  exclusive initially-empty ledgers, private internal capture/cleanup flag and
  exact record pins. Capture ancestry -> leaf ACL -> fixed retained file ->
  full composed recheck. Recheck privately authenticates state/counts/references,
  settlement/deadline, ancestry/file, leaf ACL, file/ancestry and final settlement.
  Any failure burns and attempts owned cleanup once; cleanup never depends on
  still-valid origin. Independent review found live-ledger cleanup could adopt
  a replacement and leak the original FD: actual ledger removal/replacement
  consumers each observed 1 leaked original FD (2 semantic REDs,187.694ms).
  Seal actual handles immediately after successful open and before fallible
  checks, including partial starts; the private cleanup loop owns release and
  ignores contaminated raw ledgers. Original/raw-owner behavior is unchanged.
  The repaired consumers plus old lifecycle tests passed21/0/0,1232.154ms.
  Actual curl nonzero-but-definitely-reaped operation also revived the epoch
  (1 semantic RED,163.046ms); burn at the captor's final failed-operation edge,
  AFTER its own settlement attempt. The fixed consumer passed1/0/0,124.881ms.
- [x] Run `node --test --test-name-pattern='composed physical|retained|ACL sample' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js`
  Observe genuine GREEN for every earlier RED, and original fragment regressions.
  Run coherent in-memory missing-leaf-ACL/post-ancestry/sticky-state mutants:
  literal independent consumer expectations must reject mutants, not source text.
  Initial missing-interface13RED ->13GREEN plus6 old lifecycle GREEN. Focused
  original57 plus initial13 passed70/0/0,2163.677ms. Expanded composition24/0/0,
  1889.127ms:22 modes and2 coherent mutant consumers. Partial capture records
  actual4FD ownership at the external real-file seek edge before denial;
  missing registration mutant exposes all4 leaked FDs. Post-leaf ancestry
  omission actually reaches forbidden acceptance; leaf-ACL omission accepts
  the added row; missing lifecycle burn revives restored actual file validity.
  Real helper clock loss is independently reaped only by its test owner and
  cannot revive helper/composed state. Prior raw FD remains untouched until its
  original owner's explicit close. These are ordinary read-only diagnostics.
- [ ] Fresh whole bootstrap/default host contract suite with actualmacOS zero
  skips; noemit/version/English/path/check-only frozen digests/MC/diff/credential
  gates. Independent exact four-file source/test/spec/plan review; root scoped
  conventional commits and normal reviewed SHA-bound PR delivery only. No main
  commit, history rewrite, guard bypass, root/native/PG/network/selector effect.
- [ ] Synchronize/build only a separately proven clean inactive standby; do not
  change a source tree with unknown surviving children. No fullnpm/Task6A success
  without fresh complete respective evidence. Lost daemon sessions are unverified,
  not passes or authority to signal/adopt/clean old private fixtures.

Native grammar next slice:ordinary reviewed recon5ae16d... completed actual
265region/54path format diagnostic; no raw map was retained. Existing V1 cache
scanner does not parse all rows, can miss anonymous executable regions and uses
split sections incompatible with fixed interleaved args. Root will first add
mapText diagnostic through a real output-preservation RED/GREEN, then request
exact read-only recon pre-effect review before another ordinary own-child run.
Keep map only in orchestration memory; root uses apply_patch for sanitized full
grammar fixture and writes pure parser tests before code. Full protection census
must always classify current OR maximum executable rows; unknown anonymous/JIT/
trampoline rows refuse until exact independent runtime policy exists. No root
observer admission or automatic runtime-flag relaxation follows.

Second exact reviewed dc719fa6... ordinary own-child recon completed0.607s,
actualPID25774,bothdefclose true; independentps absence exit1. Complete raw42583
characters retained in orchestrationmemory only. Root applied mapped337LF-line
fixture after substituting PID77777,parent42424,dates2000-01-01 and stripping
36formatter-padding line endings; full region grammar/counts preserved. Full
fixture has265rows (one kernel pseudo-row),47currentexec,63currentORmaxexec and
13anonymous maxexec even for ApplePerl. Native region policy remains unresolved:
never treat labels as code origin or silently admit anonymous potential code.
The fixture has338 split items including its terminal empty item, not338
LF-terminated lines. Pure-parser28 missing-implementation ASSERT REDs thenGREEN;
seven accepted-bad-input semantic REDs thenGREEN bind details/types, header image
path/load start and exact per-zone region counts. Full44focusedPASS/0SKIP,
independently reviewed at mapSHA256cbbb00600be897bffa2e3a9460dc81c5c225a8ea5a7fc0588cf9d80c25ebe201
and tests99ac8225...b197. Current/max classifiers never exempt unused/cache/guard/
kernel rows; unused paths are separate from image paths. Coherent actual
1MiB/+1bytes with missing-bound in-memory mutant,4096/4097regions,64/65categories
and32/33zones tested. The8192-line defense is structurally redundant under other
caps; a clearly scaled337/338 in-memory consumer exercises that exact branch.
Fresh full357PASS/0FAIL/0SKIP47469.747ms before later publisher-pin refinement.
Mapblob9719bf4f3676b43b7858e3cabe3cee3e679120f8 is now literal source policy:
two exact-four-source publisher REDs thenGREEN, eleven fixed responses and a
fully coherently framed replacement map helper refused. Current57map/source
focusedPASS/0SKIP1131.419ms. No helper import, privilege or publisher network
effect. Parser success means format only; no observerTCB/process/native/source
authority. Full bootstrap stage/drop/held-entry/cleanup remains unimplemented.

Native observer decision/review gates (same File Map):
- [ ] Independently prove vmmap-only literal DT_NO_RESPAWN=1, absent DT_FORCE,
  scrubbed other env, exact byte drift refusal; never DT_NO_RESPAWN_TO_DT.
  Static direct branch proves no developer respawn for observed9e2b3e... bytes;
  no full transitive/target-effect or privilege clearance follows.
- [ ] Prove default VMUTask analysis/corpse/live-target behavior. Document
  peeking/suspension as an explicit owned-private-child lifecycle effect, not a
  globally read-only observation. Never probe live services/foreign PIDs.
- [ ] Review separate ordinary own-child exploratory script and timeout/kill/
  definite reap before any observer invocation. Fixed args -w/-noCoalesce/
  -interleaved/actualPID; do not use-v/allSplitLibs/unverified modes/output files.
  Implement script first through missing-source default-denial tests; ordinary
  invocation with extra argv refuses before spawn. Script must hash/read/check
  nonsymlink rootwheel0755/nlink1 exact system vmmap/perl before either exec,
  then parent captures Perl READY/PID/privatepipes and no caller selection.
  Spawn vmmap with literal env DT_NO_RESPAWN=1 and no DT_FORCE/DYLD/otherenv;
  actualpid args only. Collect complete close/output within10s/8MiB. Close
  target input and require definite both-helper-and-target close, exactPID-only
  bounded shutdown on failure. Print small ordinary diagnostic only after both
  settle; refuse unknown close/reap/signal status. Independent review each file
  and plan then explicit ordinary script invocation; preserve raw maps only in
  memory, no filesystem artifacts or protected-origin claims.
- [ ] After cleared ordinary format/closure evidence, root TDD exact system-tool
  env/byte pins/loaded current+max protections and helper/target failure/reap.
  Keep default main and privileged invocation closed until complete delivery.

- [ ] Write actual unprivileged entry tests before source: exact stdout READY/PONG/END behavior, missing/bad/replayed nonce, extra args, wrong/partial/overbound messages, input EOF, parent loss, fixed deadline and definite close. Spawn ordinary test Node only for protocol evidence; never label it vendor/protected origin.
- [ ] Implement builtin-only child with parent protocol and fixed20s total timer, no renewal/caller options, exit on EOF/invalid input/uncertain stream error. Supply no PID/source facts to parent.
- [ ] Write root-supervisor default denial test: ordinary real system Perl invocation refuses before network/staging/fork. Stub only external effects in a test-only harness where necessary; retain actual program branches, canonical route/source/tree framing, native helper and parent state machine. No production dependency-injection or special test argv.
- [ ] Implement first-BEGIN fixed system module roots and root/exact-zero-argument refusal. Core modules include POSIX/JSON::PP/IO::Select/Digest::SHA/Time::HiRes/MIME::Base64/Encode/Gunzip; root independently inventories/protects full PM/XS/libperl closure, not only initial five bundles. No unchecked default modules.
- [ ] Implement fixed scrubbed Applecurl via direct exec, no shell/config/proxy/redirect/credentials/API-returned routes. Shared monotonic bootstrap180s bound, per metadataGET10s/connect5s/body4MiB; archiveGET60s/128MiB; no retries/renewal. Own helper subprocess PIDs/EOF/reap; uncertainty refuses before execution/cleanup. Actual HTTP200/UTF8/JSON/route/output bounds are required.
- [ ] Port strict signed-merge/tree/blob framing from delivered PR251 semantics into authentic system publisher, test golden ASCII/UTF8 bytes and coherent denials. Join real merged PR/base/main/repo/head/second parent and sampled main endpoint agreement. Do not substitute plutil/verdict-only checks for object identity or call this independent GPG verification.
- [ ] Source helper/entry policy uses actual literal blob identities computed after their final byte review:

```bash
git hash-object --no-filters scripts/task6a-origin-archive-v2.pm
git hash-object --no-filters scripts/task6a-origin-native-v2.pm
git hash-object --no-filters scripts/task6a-origin-map-v2.pm
git hash-object --no-filters scripts/task6a-protected-origin-entry-v2.mjs
```

Insert exact literals with apply_patch before final review; source identities come from reviewed files and actual delivered Git graph, never runtime arguments. Bootstrap own delivered blob is bound by independent owner-install invocation after merge, outside its own self-hash.
- [ ] Implement fresh root-private stage with exclusive/no-follow regular files and retained complete identities/ACL-free protected ancestry. Verify official fixed Node HTTPS checksum against literal ef28d8...fa953, then complete bounded archive scanner and native policy BEFORE any Node execution. Recheck source/vendor physical identities and selected byte hashes.
- [ ] Fork with exact parent-owned PID; child closes unrelated inherited FDs, resets supplementary groups using checked Perl core `$)` assignment (POSIX::setgroups unavailable), checked setgid/setuid, verifies real/effective IDs/groups, then fixed-list `exec {fixedNode} fixedNode,fixedEntry`. Preserve only exact protocol pipes and CLOEXEC setup-error channel; no wrapper or caller code.
- [ ] Parent uses exact waitpid(pid,WNOHANG) before/after READY/native/source samples and bounded three fresh challenges. Parent owns all identity, immutable source/vendor/native metadata and lifetime; no child JSON authority. Burn on ECHILD/exit/EOF/error/drift/timeout/uncertainclose. Never signal reaped PID or use global child reaper. Actual loaded-image observations must account for readonly logging-cache mapped data without executable/writable exceptions.
- [ ] End child, wait definite exact reap, recheck full fixture root/descent and cleanup with narrowly scoped validated code; uncertainty retains new fixture. Keep every old fixture/tree untouched. Output private diagnostics, productionAuthorityfalse; no origin token persists after parent releases.

### Task 3: Reviewed delivery and actual protected rehearsal

- [ ] Run full focused pure/protocol tests, sourceTS/syntax/version/English/path/frozen migration/MC/diff contracts. Independent exact all-source/test/spec/plan review. Ordinary feature build obeys unchanged main guard.
- [ ] Conventional scoped commits, normal push/PR, fresh exact-head available cloud/security/full paginated review/comments/threads gate; optional Copilot/Gemini once. Normal SHA-bound merge, no bypass/deletion.
- [ ] Fast-forward clean standby main, ordinary build/compiled observer and merged focused tests. Independently inspect actual GitHub merge/source/review/security identities for the owner-install selection. Freeze exact bootstrap/entry/helper blobs/bytes and actual invocation literal; independently review again BEFORE privileges.
- [ ] Actual opt-in trusted-owner installation uses only fixed system tools: fetch the actual admitted bootstrap blob to a newly root-owned private stage, check typed base64/size and framed Git identity against the independently admitted delivered blob, then execute exact protected system Perl program. Never root-execute the user-owned test Node/local mutable file or derive authority from a receipt DTO.
- [ ] Run actual private vendor/source/native/credential-drop/direct-PID/private-pipe/held-byte/lifetime positives and wrong-entry/argv-title spoof/replay/foreignPID/source-native replacement/parent-loss/cleanup-uncertainty denials. Only delivered source and real official archive count; fakes prove protocol only. Capture actual child UID/groups/start/maps and exact root/source/vendor identities, definite cleanup or preserved failure evidence.
- [ ] Independent post-run PID/root absence or exact preserved-tree validation, then PG31/HTTP/selector/namespace read-only checks. Standby unselected and all live guards unchanged. Record exact remaining compiler/fence/genesis/32/33/admission/live handoff outcomes without claiming Task6A completion.

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

### Ordinary P2a delta (four existing files only)

Modify only `scripts/task6a-protected-origin-bootstrap-v2.pl`,
`scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js`, this plan and
its named existing spec. Do not alter entry/helper/map/import-policy/native/
observer/package/lock/launcher/production main or generated runtime artifacts.
The source base is delivered main d40fa6b9d517bdbb9e466585c86fbd1471c4dfc0;
old main/worktrees/dirty2 remain preserved. The ordinary MC telemetry delivery
has its own PR33/merge5c9e/clean-main-build proof; it admits no live cutover.
Root alone writes/delivers; parallel reviewers do not execute project tests.

Ruling: separate immutable original custody, initially absent admission and
irreversible lifecycle state, rather than one mutable record or public factory.
Reason: altered admission cannot redirect disposal or create execution authority.
Cost if wrong: ordinary interface/test rework, never a protected-effect waiver.
The detailed ordinary contract is the spec's new declaration-only section;
the protected Task2/Task3 checkboxes below remain separate and incomplete.

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

### Task 2a: Ordinary private parent consumer (not protected execution)

**Consumes:** reviewed actual bootstrap declarations; existing actual now/poll/
shutdown routines; ordinary finite external ports only in the test process.
**Produces:** zero-argument `task6a_origin_consume_entry_protocol()` returning
the exact seven-field counts-only diagnostic from the spec after settlement.
No production initializer exists. `task6a_origin_parent_require_unburned()` is
the actual consumer-used zero-argument no-effect permanent-invalid guard.

- [x] **Step 1: Review design and isolate the sole writer.** Verify fresh clean
  main d40fa/treecb513, own.git/no alternates, initial four-file SHA agreement,
  no .env/node_modules/dist, ordinary UID and old-pin/resource preservation.
  Create scoped branch `fix/task6a-ordinary-parent-protocol-v2` in a separate
  own clone; no old root rebuild or dependency reuse. Independently review this
  exact spec/plan refinement and commit the docs before source changes.

- [x] **Step 2: First missing-feature RED.** Put the named test inside existing
  ordinary-host registration. Assert declaration BEFORE any initializer injection:

```js
test('Perl parent protocol completes exact bounded transcript',()=>{
  const source=readFileSync(BOOTSTRAP,'utf8');
  assert.match(source,/^sub task6a_origin_consume_entry_protocol\s*\{/m,
    'ordinary parent consumer declaration missing');
  const r=systemObject('parent-protocol',{mode:'success'},'');
  assert.equal(r.status,0,r.stderr.toString());
  assert.equal(r.stderr.length,0);
  const out=JSON.parse(r.stdout);
  assert.deepEqual(out.consumer,{scope:'parent-entry-protocol-diagnostic-only',
    productionAuthority:false,challengeCount:3,inputBytes:229,outputBytes:220,
    handlesClosed:5,reaped:true});
  assert.deepEqual(out.writes,[`CHALLENGE ${'1'.repeat(64)}\n`,
    `CHALLENGE ${'2'.repeat(64)}\n`,`CHALLENGE ${'3'.repeat(64)}\n`,'END\n']);
  assert.equal(out.harnessFault,null);
});
```

  Run fixed Node with scrubbed environment, no loader/dependencies:

```bash
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^Perl parent protocol completes exact bounded transcript$' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

  Expected exactly the missing declaration assertion. Record actual exit/footer.
  This is not later mutation/security evidence. Undefined function/anchor/syntax/
  queue exceptions cannot substitute for this RED or a semantic mutant kill.

- [x] **Step 3: Make external ports trustworthy before consumer GREEN.** Extend
  existing `systemObject` with parent-only startup/runtime sticky fault state.
  Keep sole final-main removal and install CORE overrides before source eval.
  Fix exact prototypes and caller alias behavior with independent self-witnesses:
  actual caller sysopen handle; actual sysread buffer/raw/count/errno; exact
  syswrite payload/request/offset/count; binary configuration; fcntl `0 but true` success; raw exact
  readiness timeout-versus-error/throw and pipe-read undef/EINTR/EAGAIN contracts;
  synthetic waitpid `$?`; fake-PID wait/signal never CORE. Harness independently
  owns ordinary real pipes and closes every extra end. Use finite literal queues.
  Latch unexpected errors BEFORE throw and inspect after EVERY catch/eval before
  translating exact refusal or success. Check eval's independent success sentinel
  and immediately captured `$@`. Unknown factory/primitive/queue/argument cases
  are loud harness failures, not expected status64. Nominated throws require
  literal primitive+ordinal and actual reachability. Trace records strictly
  increasing seq/op/original-role/slot/invocation/request/return/errno/bytes/raw
  wait status; fixture cleanup attempts/definite closes are separate facts.

- [x] **Step 4: Clock RED/GREEN.** Add actual-validator consumers for undefined,
  reference, string-numeric, dual POK/numeric, throw, negative, backward, over1e12,
  numeric NaN and Inf; allow zero/equal/fraction and inclusive1e12. Construct
  POSIX numeric factories and inspect public B flags/classification before
  returning samples; never stringify them first. Add unexpected factory and
  exhausted-clock harness-fault controls. Preserve actual validator in every
  parent/transport test. Observe genuine invalid-scalar acceptance RED, then:

```perl
sub task6a_origin_now {
    task6a_origin_refuse() unless @_==0;
    my $now;
    my $ok=eval {$now=Time::HiRes::clock_gettime(Time::HiRes::CLOCK_MONOTONIC());1;};
    task6a_origin_refuse() unless $ok&&defined($now)&&!ref($now);
    my $flags=B::svref_2object(\$now)->FLAGS;
    task6a_origin_refuse() if $flags&B::SVf_POK();
    task6a_origin_refuse() unless $flags&(B::SVf_IOK()|B::SVf_NOK());
    task6a_origin_refuse() if $now!=$now||$now<0||$now<$last_clock||$now>1e12;
    $last_clock=$now;return $now;
}
```

Ruling: recheck the admission at every epoch/settlement; inspect both copied PID
scalars before coercion and bind1..2147483647 to actual target signed32 pid_t
(SDK sys/_types.h:84 and sys/_types/_pid_t.h:31). Authenticated pre-first-poll
failure gets one original-only cleanup poll, then unchanged known-live shutdown.
Reason: initial-only checks permit record drift, and clock failure cannot strand
an authenticated child. Cost if wrong: ordinary interface/test rework, never a
native gate waiver. Require drift, PID type/range and early-failure settlement
denials before completing the slice; the initial missing-feature RED was observed.

- [x] **Step 5: Private state and once-only ownership.** Beside current private
  declarations define absent admission+retained HASH reference, copied original
  PID, five originals, phase/permanent-invalid/cleanup flags, close-attempted/
  definite-close arrays, immutable start/deadline and independent frame/EOF/
  reap facts exactly as spec. Add no setter. Pin the unique in-memory test
  initializer after literal review; test originals before injecting their copied
  admission. Configure/recheck only original live slots; retained closed slots
  never become live again or close reused numeric FDs. Entropy acquisition is
  recorded before configuration. Failure burns before original-only disposal.
  Preserve raw binary rootwheel entropy and exact pre/opened/post-read lstat/
  fstat identity/flags/count32/buffer32. Live pipe identity uses stable fields0..6,
  not transient size/timestamps; retain complete captures for diagnostics.
  Each attempted flag precedes the call, false/throw never retries, remaining
  originals still close. Unknown/unauthed/uncertain/reaped PID never signals.

- [x] **Step 6: Actual FSM GREEN.** Implement setup-empty-EOF+definite-close,
  buffered READY acceptance, literal owned entropy, three32byte unique challenges,
  matching current PONG, entropy definite close before challenge3, full END,
  definite input close before ending, final END/drain/allEOF/exactrawzero/all5
  definite closes before settled. Parse full chunks before successor effects.
  Requests/totals/partial buffers/deadlines are the spec's exact literals; no
  generic runner/captor rewrite. Actual IO::Select construction/membership stay
  real; external readiness may be substituted. Clear `$!` before readiness;
  empty+zero errno is timeout only, throw/nonzero errno/unknown or duplicate
  ready handles refuses. Pipe read undef/throw/EINTR/EAGAIN refuses without retry;
  zero alone is EOF, count equals raw buffer length and lies within request.
  Bracket every readiness/read/nonterminal-write (including entropy) with actual
  exact-PID poll and original-deadline checks before/after. Treat final full
  END-write/definite-input-close/enter-ending as one compound operation checked
  before END and after ending, with no intervening poll. Any observed reap before
  definite input close refuses. This samples lifetime, not an exact kernel-exit
  timestamp or continuous proof; do not infer that from synthetic wait events.
  Return only the literal diagnostic in Step2 after irreversible settled state.
  Allow eventual clock progress, not an invented fixed poll-attempt cap.

- [x] **Step 7: Denials and six honest semantic mutants.** Fresh fixture for
  each absent/forged/arity/alias/replaced original, every fragment boundary,
  coalesced future/replay/extra/CRLF/NUL/uppercase/63or65hex/partial EOF/221byte
  stdout, one stderr/setup byte, each missing EOF/reap/close, partial write,
  entropy device/flags/path drift/31or33bytes/duplicate/throw, early/nonzero/
  undefined/ECHILD/foreign reap, deadline44->46/bootstrap expiry and restored
  burn/repeat. Original decisions stay real. Inject mutations only after unique
  actual literal anchor review. Wrong nonce/nonzero reap/deadline renewal must
  reach otherwise coherent forbidden diagnostics; burn omission must admit the
  actual used guard after refusal+disposal with zero new events; remove all and
  only reaped signal exclusions for postreap forbidden synthetic signal witness.
  Input-close omission must show actual final-END acceptance via observer inserted
  immediately AFTER its assignment in test-copy bytes; read delivery is not
  acceptance, even if final all-close check later refuses. Require positive
  baseline closure and sticky harnessFaultnull before crediting each semantic kill.

- [x] **Step 8: Adjacent and full ordinary verification.** Run exact new parent
  and clock consumers, existing metadata-clock tests, child entry, helper captor,
  physical-holder, unsupported-host and actual default-graph leaf consumers.
  Then full actual bootstrap test suite with zero macOS skips, bounded fixed
  command/output and explicit terminal evidence. Source syntax/version/English/
  path/diff gates must pass. No repeat ALL/native/protected probe is needed.

```bash
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
git diff --check
git diff --stat d40fa6b9d517bdbb9e466585c86fbd1471c4dfc0
```

- [x] **Step 9: Ordinary reviewed delivery.** Exact four-file independent source/
  test/spec/plan review; record actual RED/GREEN/mutant counts and source pins.
  Scoped conventional commit/normal push/PR; full paginated actual current-head
  comments/review/security/threads, normal SHA-bound merge, no bypass/deletion.
  Fresh own clean-main dependency/build admission and guarded build (never dirty
  bypass), exact source/build binding and independent old-pin/host preservation.
  This closes only ordinary P2a. No installation/root/native/service/DB/fence/
  genesis/32/33/A–E/M1/M2 claim; retain all worktrees/branches/evidence.

Ordinary execution ledger, 2026-10-03:

- Ordinary P2a Steps1–9 closed at exact source04393cce/test28176bc. Full1118 and
  adjacent895 actual PASS/0FAIL/0SKIP, complete outputs and natural terminal0
  observed. Final independent exact four-file reviews C0/I0/M0. PR267 exacthead
  88f1aa315566a202781a783b5624a9a91047df85 delivered normally; current-head Codex
  Completed plus actual bot +1 supports no findings, not formal approval;
  GitGuardian SUCCESS/zero annotations and full paginated feedback clear.
  Optional Copilot/Gemini approval was not observed or inferred.
- Normal SHA-bound merge ca86623fb13d29a01a3e45c27a0cf7d315b32276 has exact
  parents d40fa6b9/88f1aa3 and reviewed treea9c62512. Separate full own clean-main
  clone, one locked ignore-scripts install, independently admitted fresh source/
  tools/dependencies/preservation, then ONE normal pre/build/post guarded build.
  Actual npmEXIT0/CLOSE0/null/spawnErrorfalse and outer0 observed; full terminal
  output read. Display2.3.79+ca86623f, input660d06e3f6306ea98e3de825b0692ae81f37feb759ad302fb998688d293e9f14,
  outputTree033a76deae2fce44ca3f5df9492582ddcffd5da5c8bd26eaebff899964217f73.
  Independent complete858-output/three-artifact/source binding and old-pin/host
  preservation C0/I0/M0. All roots/branches/evidence retained; no old ALL rerun,
  main direct commit, native/SQL/credential/service/fence/cutover admission.

- Reviewed exact specbd7fa279/plan981482ef promoted in scoped docs commit
  bf96cf3d2a42ff1cfb3626ab29dc46a1dad4cc71; two independent C0/I0/M0 reviews.
- First consumer RED a6af00 CLOSED1:1FAIL/0SKIP/50.926792ms, actual missing
  declaration assertion before any initializer. First consumer GREEN is recorded
  in the superseding11:27UTC ledger below; full Step7 remains pending.
- Independently reviewed clock-only harness preserved actual validator; genuine
  2706f8 CLOSED1:16tests/10PASS/6FAIL/0SKIP/379.744334ms. Actual string/dual/
  reference acceptance, undefined warnings, escaped nominated throw and arity
  acceptance; four sticky harness-fault controls passed, not false refusals.
- Minimal reviewed actual-now change then a62441 CLOSED0:16PASS/0SKIP/
  371.066417ms. No imports/main/launcher change. This is only the clock slice.
- Fresh resume/source/preservation/resource audit before adjacent invocation
  26360 naturally CLOSED0/af0b15:121PASS/0FAIL/0SKIP/31183.4575ms, all actual
  clock/metadata/source/vendor/entry/captor/default-graph selected consumers.
  Full bootstrap suite was NOT selected; the still-missing parent test excluded.
- Parent pipe/entropy/ready/prototype harness self-witnesses, real FSM, six
  coherent mutants, full ordinary review/delivery/build remain pending.
  No native/protected/service/SQL/P2/P2a/M1/M2 acceptance is implied.

11:00UTC superseding candidate ledger:
- Foundation10/17/27/30 focusedcases each actual CLOSED0/0SKIP; latest05788b
  30PASS/0FAIL/0SKIP/482.285708ms. Runtime bridge errors were harness faults,
  not semantic refusal/mutation evidence; exact prototypes/aliases now witnessed.
- First actualprivateparent FSM candidate implemented but UNEXECUTED; source
  review corrected initial-only admission checks and pre-first-poll settlement.
  RawtypedPID signed32 ruling above refines the same four-file causal contract.
- Compile-only face33 CLOSED0 syntaxOK; JSsyntax/diffcheck0. Actualsuccess
  initializer/finiteexternalport fixture remains under independent pre-effect
  review before the first real consumer invocation. No firstconsumerGREEN yet.
- Denials, fragmentmatrix, six coherent mutants, full verification, reviewedPR
  and clean-main delivery still required. Main/native/production gates unchanged.

11:27UTC superseding actual-consumer ledger:
- Actualconsumer bb226e CLOSED0:1PASS/0FAIL/0SKIP84.175291ms; foundation+consumer
  983654 CLOSED0:31PASS/0FAIL/0SKIP672.770291ms; sixunauthenticateddenials
  3cafe0 CLOSED0:6PASS/0FAIL/0SKIP200.539334ms.
- Independent reviews found raw256 closeassertions counted fixturefinalizer;
  root corrected to pre-finalizer consumerEvents, exact five original attempts/
  definite results. Corrected testbde95960...f385/source04393cc...8d9 C0/I0/M0;
  focused8d05e0 CLOSED0:10PASS/0FAIL/0SKIP361.56175ms. Raw256 refusal, otherwise
  complete rawzero-mutant diagnostic and actual burn-mutant guard acceptance
  after refusal/disposal observed. No syntax/queue/harnesserror counted as kill.
- Finite wait lifetime chooses live32 or closed-input1 only from independently
  CORE-confirmed physical originalinput closure, never copiedphase/result.
  Latest test4982f2e...06a adds wrongnonce baseline+actualactive-onlyprefix mutant,
  UNEXECUTED pending exact review. Four other controls, fault/fragment/ownership
  matrices, full ordinary suite/review/PR/clean-main remain. No native/protected/
  service/DB/fence/A-E/P2a/M1/M2 completion implied.

11:55UTC superseding executed-matrix ledger:
- All six required semanticcontrols observed at exacttestd7e87fed...bdcd/source
  04393cc...8d9:64babb/15f5c1 CLOSED0:46PASS/0FAIL/0SKIP1239.656875ms.
  Wrongnonce/raw256/deadline mutants reach complete forbidden diagnostics;
  burnedguard mutant accepts actual usedguard after refusal/disposal; postreap
  mutant sends one synthetic TERM only after exactreap/five definitecloses;
  inputclose mutant records actual END acceptance with physicallylive original
  input, then stillrefuses/burns/disposes/reaps at the originaldeadline.
- Failedpostreap791a1a/650c80 were NOT kills. JS stringreplacement corrupted
  literal Perl$$; TESTONLY callback replacements preserve exactbytes now, with
  bounded changedshutdown and byte-identicalactualpoll checks. Independent
  C0/I0/M0 before freshpassing46case run; no productionwaiver/fix.
- Fullordinarybootstrap4504dc/5faf6a CLOSED0:444PASS/0FAIL/0SKIP52134.245875ms,
  completeoutput/footerread at d7e87fed. No projectALL/native/privileged claim.
- Reviewed ac886ccd...78b7 then215nonemptytwochunkboundarycases b05734/1867e0
  CLOSED0:215PASS/0FAIL/0SKIP5937.17875ms: READY5, PONG1-3 each69, END3;
  actualpipebytes, fullfinitequeue drainage, exactdiagnostic/closes/counters.
  No arbitrarymultichunk/native/timing inference.
- Latesttest7b45dd33...86cf adds11malformed/partialEOF/sidechannelbyte denials,
  UNEXECUTED pending exactreview. Source04393 unchanged. Remainingownership/
  error/entropy/reap/deadline matrices and freshfullordinaryreview/delivery/
  build stillrequired. Step7/8/9 remain open; protected/main gates unchanged.

12:10UTC superseding verification ledger:
- Exactsource04393ccef9795a0d78f3c9dd96bbb2bdc045e32dfb9505acdfe8711972aac8d9
  and test9f19726fbe15cd4d050b23de86bba24bfba3e012b0e2faecfdc4056dbcd328b4:
  fullordinary005e66/1ec3d8/b6ad7d CLOSED0,675PASS/0FAIL/0CANCEL/0SKIP/0TODO,
  58648.633541ms. Terminal0/finalfooter observed; middle first output chunk
  outer-display truncated, no full per-line-read claim. Parentfd868b/f98be8
  CLOSED0:277PASS/0FAIL/0SKIP7610.195791ms, completeoutput/footerread.
- Reviewed malformed/partialEOF/sidechannel825164 CLOSED0:11P0F0S358.418916ms;
  earlywait4 and clockC2throw8b2da3 CLOSED0:5P0F0S183.596167ms. Earlier pending/
  running statements are historical. No managed test session currently running.
- Step7 remains open for admission/restoration/alias, primitive/entropy errors,
  all229 partialwrite nominations, missingEOF/reap/uncertainclose and bootstrap
  expiry/framing matrices. Portselfwitnesses do not replace actualconsumer
  denials. Step8/9 and delivery/native/service/DB/fence/A-E remain open.

Resumed Step7 admission candidate (not yet executed):
- Fresh get_goal returned null; standing owner protocol continues the same
  bounded objective, not a historical blocked lock. Root alone writes.
- Test940ab35d188365cf645151cdc55cbef8fed31321327460b5a000a85034a4f675 adds
  25 initial and25 C3-drift cases: four aliases/four owned-peer replacements,
  five missing keys/extra key, nine PID values/types, copied HASH/absent record.
  Source04393 unchanged. Independent exact review precedes execution.
- Ruling: nominate admission-only mutation after external clock C3, restore
  only its original HASH/fields after consumer disposal and before the repeat
  baseline. Reason: next actual epoch must reject while cleanup retains sealed
  originals/PID. Cost if wrong: ordinary fixture rework, no native effect.
- Original custody snapshots retain record/FH/FD/all13stat values, checked
  without consulting closed descriptors; no phase/latch/close facts reset.
  Expected initial0 protocol/PID effects; C3 two consumer clocks/12stat/20fcntl,
  one sealed live poll plus cleanup raw-zero reap after four definite closes.
  Restoration must not revive actual consumer/usedguard; repeat effects0.
  These are proposed coverage, not new production RED/GREEN or Step7 closure.

13:27UTC Step7 admission execution and write candidate:
- Test940ab35d...f675/source04393 reviewed C0/I0/M0 twice;16d8e6/63d7f6
  CLOSED0:50PASS/0FAIL/0CANCEL/0SKIP/0TODO1383.909833ms, fulloutput/footerread.
  Earlier admission UNEXECUTED statement is historical. All50actual denials/
  originalcustody disposal/restored-record burnedrepeat requirements observed.
- Test308a1c91d93659468fb403e7cb37ae17980703fbbcc34eaa156c2617d5bdf152 adds
  all229shortwrite outcomes, six firstwrite undefined/throw/EINTR/EAGAIN/EIO/
  fullcompletion+freshEIO outcomes. UNEXECUTED pending independent exactreview.
  Preserve fullcaller75/END4request; nominate physicalCOREshort count, independently
  read only expected peerprefix, forbidretry/successor; no spontaneousOSfault claim.
  Fullcompletion+errno distinguishes physicalcompletion from accepted return.
  All queues are finite independently counted literals. Remaining Step7/8/9 open.

Step7 write execution and primitive candidate:
- Exacttest308a1c91...f152/source04393 reviewed C0/I0/M0 twice;68c5f8/3ef4e3
  CLOSED0:235PASS/0FAIL/0CANCEL/0SKIP/0TODO6641.4355ms, fulloutput/footerread.
  All229short/zero completions and6firstwrite fault outcomes observed at actual
  consumer. Physical CORE writes are controlled nominations, not spontaneous
  kernel shortwrite/error evidence. Zero cases do not prove peerbuffer absence.
- Test463dd414c693ec8099c1d5640eb605b299b2998efe2518679337054ae69e1c06 adds
  10read/5readiness/10close-response-fault cases UNEXECUTED underexactreview.
  Physical close precedes false/throw nomination; never a cleanup-complete claim.
  Late stderr/stdout close cases explicitly require their closes AFTER already
  observed exactreap; other rows preserve all-close-before-cleanup-reap ordering.
  Scope unchanged; Step7/8/9 and native/service/DB/fence/A-E remain open.

13:43UTC Step7 primitive/framing verification:
- Test463dd414...e1c06/source04393:7757e3 CLOSED0,25P0F0S775.21875ms,
  fulloutput/footerread. Independent C0/I0/M0; secondC0/I0/M1 timeouttitle
  corrected to distinguish healthyemptyreadiness from subsequentdeadlineexpiry.
- Testa2e2a3b2fbc3295f04a8d0baf5397c1d4b907e4e83e4fc35964a42d2c3b4ab88
  adds17framecases; independentC0/I0/M0 then55258d CLOSED0:18P0F0S586.545208ms
  (includes correctedtimeout). Actual replay/future/initialcoalescedprefix,
  END-extra/after-END actual221 bytes, malformedEND,5READY/3END actualprefixEOF.
  Current further exactreview pending. No full Step7/8/9/native qualification.

Step7 finish and remaining configuration port:
- Exacttest768f9507...4279/source04393 reviewed C0/I0/M0 twice;10ffe1 CLOSED0:
  9PASS/0FAIL/0SKIP349.059584ms, fulloutput/footerread. Four successful order
  permutations, three missingEOF denials, protocol-deadline missingreap followed
  by original-only cleanupreap, bootstrap179->180 clipping observed. Reap-last
  proves after END bytes/before stdoutEOF, not continuous kernel lifetime.
- Ruling: extend the existing finite external ports with binmode rather than
  mock the consumer configuration or add a separate runner. Reason: spec already
  requires binary/configuration denial, but initial portlist omitted its seam.
  Cost if wrong: ordinary fixture rework; no new production knob/native authority.
  Existing four-file File Map remains exact. Root f2384e CLOSED0 independently
  observes fixed-system CORE::binmode prototype `*;$` before hook installation.
- Configuration adapter TDD: first add ordinary selfwitness for actual owned
  input binary configuration, expect missing-adapter failure before adding hook.
  Then install caller-FH-preserving prototype-checked CORE-delegating port;
  false/throw only after actual configuration, literal nomination event before
  response. Fixture setup remains CORE::binmode and is outside consumer traces.
  Run three adapter selfwitnesses, then ten false/throw actualconsumer cases.
  Original index0..3:8stat/2consumerclock/2wait/fcntl0,5,10,15; entropy35stat/
  8consumerclock/8wait/20fcntl. All acquire original custody before configuration,
  burn, close every genuine original once, then effect-free repeat. Remaining
  entropy/physicaldrift and fullverification/delivery requirements stay open.

Configuration adapter evidence:
- Exactfb41dd90...3aa3 independently reviewed RED-only C0/I0/M0. Roota91c90
  CLOSED1:1FAIL/0SKIP84.859833ms; missingadapter mode produced fixedharness
  fault255 rather than expected0. This is missing-test-adapter RED, NOT semantic
  security refusal or a production mutant kill. All acquired fixtureends cleaned.
- Candidatea3680e7167631369470de6071c5d08675f1be41d907fb2afe59241b5b3c723ef
  adds literalprototype native/installed checks, ownedFH CORE-delegating binary
  port, postconfiguration false/throw noms and three selfwitnesses. UNEXECUTED
  underexactindependentreview; source04393/main unchanged. Need adapterGREEN,
  healthy actualparent regression then tenconsumerconfiguration denials before
  claiming coverage. Step7/8/9 still open.

14:19UTC superseding configuration evidence and entropy candidate:
- Reviewed a3680e/source04393:1f3b9a CLOSED0,4P0F0S158.501542ms; three
  adapter selfwitnesses and healthy actualconsumer regression. Earlier adapter
  UNEXECUTED statement historical. Reviewed b92f19d/source04393:1a435f/4529d4
  CLOSED0,38P0F0C0S0TODO1100.650209ms, fulloutput/footerread. Ten config false/
  throw and28 original observed-stat drift cases qualify ordinary decisions,
  never actual native FD replacement. No production source change.
- Candidate d530704c9e028dabc8c8d6ead538741171593fbde00bf34871653ed430f2f61e
  adds53 actualconsumer entropy/flags cases UNEXECUTED pending exact reviews.
  Preidentity4/open3/identity21/read9/flags16. Actual successful CORE config/flag
  operations precede synthetic false/throw/undefined/bit corruption nominations.
  Entropy read31 is physical31; reported33 is synthetic after witnessedCORE32,
  never claimed native read33. Duplicate second raw32 must reject before a second
  challenge. Fixed synthetic entropy tuples remain ordinary fixtures only.
- Finite per-role fcntl queues now validate all23 healthy consumer operations;
  rerun positive/Foundation and semantic controls to catch regressions. Tuple
  shape and coherent actual retained-FD replacement coverage/acceptance ruling
  remain required before Step7 closure; Step8/9 also open.

Remaining Step7 shape/rebinding design refinement:
- Root uses writing-plans to refine the same approved four-file map. Choose an
  actual owned input-pipe FD rebinding over a fake fileno port or silent coverage
  waiver. Cost if wrong: ordinary fixture rework only. No production API/effect.
- First add a missing-adapter selfwitness for `fd-rebinding` and literal actual
  consumer shape cases. Exact read-only review precedes missing-adapter RED;
  never count that harness fault as semantic refusal or production mutant kill.
- Existing stat/lstat ports retain independently captured13-field actual/synthetic
  tuples, then nominate copied12/14-field returns at original-input second stat
  or entropy pre/opened/postpath/posthandle seams. Consumer must refuse, burn,
  once-dispose original custody and settle only sealed PID with repeat effects0.
- For actual rebinding, duplicate only the live owned input writer with fixed
  `CORE::open(my $hold,'>&',$input)`, immediately register it in the fixture
  ledger before inspection; then acquire/register both ends of one fresh pipe.
  Fixture owns11 ends total. Require independent old/hold identities to match
  and replacement writer's actual stable identity to differ. If not distinguishable,
  refuse the fixture; no synthetic inode or alternate filesystem target.
- A bounded fixture closure at nominated clock C3 performs fixed system
  `POSIX::dup2(replacement_writer_fd, original_input_fd)` once. Require defined
  return and fresh errno0 plus independent actual original/hold/replacement
  stat/fileno checks; do not assume success truthiness or documented C return.
  Selfwitness records actual return shape before consumer credit. Retained FH,
  FD, admission and all13 captured custody fields remain unchanged. No restore,
  reopen, closeflag reset or new production custody acquisition.
- Expected actualconsumer rebinding denial:2consumer clocks/5stats/2sealed waits,
  no configuration/readiness/read/write/entropy/signals, original closes input/
  stdout/stderr/setup once before cleanuprawzero. Fixture old-preservation and
  replacement-source handles must remain live with unchanged FD/stable identity
  after consumer and burnedrepeat; fixturefinalizer alone closes those handles.
  Disposing original FH necessarily closes current replacement binding: spec
  makes this observable boundary explicit, not a weakened validation gate.
- Independent design/code review and actual selfwitness/consumer execution still
  required; no Step7 checkbox or native/Task3 admission follows from this plan.

14:46UTC final ordinary Step7/8 evidence, superseding pending statements:
- Bootstrap04393ccef9795a0d78f3c9dd96bbb2bdc045e32dfb9505acdfe8711972aac8d9
  and final test28176bc303369e284eef3810a939c197e98cf5bab527071ae32a3afb6f0a9bfa.
  No production source change during all recent entropy/flags/shape/rebinding/
  settled-repeat additions. Source/spec/refined plan independently reviewed.
- Entropy/flags53:2fe923/7748a4 CLOSED0,53P0F0C0S0TODO1628.629333ms;
  Foundation/healthy/sixsemantic controls40:1e4b6c/cf8b31 CLOSED0,40P0F0C0S0TODO
  1213.600458ms at d530704c. Complete outputs/footer read. Earlier UNEXECUTED
  candidate annotations are historical, not current pending work.
- Shape/rebinding missing-adapter19660349 RED9ac778 CLOSED1:11F0P0S320.384334ms,
  fixed harness fault only, not semantic security RED. Reviewed140910c4 GREEN
  b5a632 CLOSED0:1P0F0S94.673292ms actual SIP POSIX dup2 return4/prototypeNULL,
  real stable identity difference; c8a6a9 CLOSED0:11P0F0C0S0TODO398.969917ms,
  actual consumer rebinding and shape10 denials. No custody/reset/native claim.
- Source-only checklist I1 identified missing settled repetition coverage.
  Reviewed405ce39c adapter REDb43cda CLOSED1:1F0P0S89.982417ms missing mode,
  not semantic RED. Reviewed28176bc GREEN8002f9 CLOSED0:1P0F0S100.751083ms;
  preserves first exact seven-field diagnostic, actual repeated consumer/guard
  refuse and burn, no new events/reinitialization/reopened handle.
- Fresh exact source/isolation/resource admission confirms sole mapped writer,
  own full Git/canonical origin/ordinary UID/no source changes. Independent
  14:43–14:44 preservation C0/I0/M0 matches admitted own-clone and retained
  source/build/dependency/output, requested two-file, backup/journal and MC pins.
  Resources remain healthy. Detailed host/physical measurements stay in the
  external execution ledgers; this is not global zero-owner or loaded-host proof.
- Adjacent403950/cbae46 CLOSED0:895P0F0C0S0TODO57100.26ms; full7f3053/6169b9
  CLOSED0:1118P0F0C0S0TODO73898.952958ms. Both entire outputs read in memory
  chunks without truncation; natural terminal0/footer observed. All215fragment
  boundaries/all229partial writes/sixsemantic controls/current matrices rechecked
  on final exact bytes. No old project ALL rerun/native/protected/SQL effect.
- Fixed Perl syntaxc6ec67, final JS syntaxd1e4f2, version1d90c3(2.3.79),
  English82d429(1931), paths5a4911(966), diffeccb45 all CLOSED0. After these
  evidence-only plan marks, rerun cheap doc/source gates before commit.
- Steps3/5/7/8 now ordinary-qualified only. Step9 exact reviewed delivery/PR/
  clean-main build remains open. Protected Task2/Task3/native/M1/M2/fence/DB/
  service/A–E gates remain unchanged and incomplete; all worktrees retained.

### Task 2b.1: Ordinary actual captor foundation (test-only)

**Goal:** Prove a bounded lower-port bridge through the existing real ACL, captor, FD parser, clock and helper-lifecycle decisions before implementing any staged custody declaration.

**Architecture:** One closed test kind owns four real pipe pairs and one read-only directory handle. It injects finite synthetic clock, PID/wait, readiness and directory-entry samples but uses real pipe bytes, binary mode, CLOEXEC and definite original closure. It never simulates a successful captor DTO or executes an external helper.

**Tech Stack:** Existing Node builtins, fixed Apple system Perl and existing fixed SIP core/XS modules. No dependency/package/lock changes.

**Spec:** Staged source/vendor custody section in `docs/superpowers/specs/2026-09-30-task6a-protected-origin-bootstrap-v2-design.md`.

**Files and interfaces:**

- Modify only this plan, its existing spec for causally required clarification and `scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js`.
- Bootstrap remains source SHA25604393ccef9795a0d78f3c9dd96bbb2bdc045e32dfb9505acdfe8711972aac8d9. The existing callback-based `replaceOnce` removes its sole final main call in memory. Only this closed captor kind additionally maps the unique external child-exec syntax site to the unconditional denying port specified below; no other source bytes change.
- Add `STAGED_CAPTOR_PORT_PROGRAM` before `PARENT_PORT_PROGRAM`, handling only `kind:'staged-captor-ports'` and a closed `{mode}` record. Interpolate it before the parent program in `systemObject`.
- `stagedCaptorPorts(mode='healthy')` invokes only that closed kind. Old parent/composed/source/vendor modes remain unchanged. No production initializer, staged declaration, path/hash setter, callback, tool allowlist expansion or native launcher.

**Global constraints for this task:**

Root is the sole writer/poller/delivery owner; agents perform read-only review. Preserve all original worktrees/branches/requested two/evidence/cache. No direct main commit, reset/revert/history rewrite/worktree deletion, new ALL, native observer, real fork/exec/wait/kill, protected/root/SQL/credential/ACL/service effects or production-main opening.

Ruling: acquire one own read-only DIR handle on literal `/dev/fd` instead of a fresh empty directory. This preserves real directory acquisition/parser/closure while removing fixture pathname creation/deletion/selection. All enumerated names are synthetic; no actual CORE readdir or host-census proof. If wrong, the ordinary bridge needs rework; no protected authority follows.

Explicit delegates are only four CORE pipe pairs, CORE stat/fileno on sealed owned originals, binary mode, one setup CLOEXEC fcntl, bounded stdout-writer fixture preload, real queued sysreads, once-only original close and one read-only CORE opendir/closedir. Real IO::Select construction/membership/count/removal stay active; only readiness is nominated. Source-side other listed file/process/socket/signal ports deny before delegation. CORE::GLOBAL hooks are not a general Perl sandbox; qualified/compiled bypasses must not be introduced into the reviewed candidate. Perl cannot parse the block form `exec {$tool} $tool,@$args;` as an overridden ordinary sub. Map exactly that one memory-copy external site to `CORE::GLOBAL::exec($tool,$tool,@$args);`, retaining both operands but always denying delegation. Real child exec syntax/argv/dispatch equivalence is expressly unqualified; positive-PID parent cases never enter it.

H1 waits are live0/live0/live0/exact424242 with raw0 or256; no kernel fork/wait/kill. Two readiness rounds, four reads, eight pipe closes plus one closedir. Seven clocks include startup; raw256 uses six because it refuses before the final successful clock. Census refusals/inspection and partial pair faults use three clocks and no fork/wait/readiness/read.

Literal synthetic census: `.`/`..`, std0/1/2, eight live original pipe FDs and its own live FD, then errno0 EOF: 15 readdir calls. Duplicate ordinal7, noncanonical ordinal6 and EIO ordinal6 refuse before fork. Actual fds removes its own FD and sorts the remaining11. No borrowed descriptor is closed.

Event cap8192; each canonical UTF8 event <=512B; metadata <=16384B; complete pre-print UTF8 JSON <=8388608B. Event validation/serialization/overflow latches nonthrowingly. Already-owned cleanup bypasses queue/sticky validity checks. maxBuffer8388608 applies only to this closed kind; old65536 and every timeout remain unchanged. No generic retry/quota increase.

Source gap stays visible: capture close loop797–798 and fds closedir696 are outside their respective evals. Throwing close can escape before shared/helper accounting. This foundation does not fix or conceal it. Later throwing-close RED needs its own mapped causal source/test/spec/plan refinement, distinguishing consumer closure from fixture finalization.

- [x] **Step 1: Add only the helper and first healthy test from the literal JS block.** Its `typeof STAGED_CAPTOR_PORT_PROGRAM` assertion executes before systemObject/new fixture child. Missing adapter must fail with `staged captor adapter missing`, not syntax/anchor/queue failure. This is adapter RED only, not a claim of missing production ACL/capture behavior.
- [x] **Step 2: Two exact candidate read-only reviews, then ONE focused RED.** Review source/env/host/interception/closure recipe before any focused execution. Root observes natural terminal and reads all output.

```bash
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged captor foundation retains actual ACL capture and original closure$' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

- [x] **Step 3: After observed RED add the exact lower-port adapter.** The following is the complete Perl payload for `const STAGED_CAPTOR_PORT_PROGRAM=String.raw` plus a JS template literal. Preserve dollar/backslash bytes with callback-based replacement. No production edit.

```perl
    if($q->{kind} eq 'staged-captor-ports') {
      require Fcntl; require IO::Select; require POSIX; require Time::HiRes;
      require B; require Errno; require Digest::SHA; require Encode;
      my $fault='';my @owned;my %roles;my @events;my %calls;
      my $mode=$q->{record}{mode};
      my %modes=map {$_=>1} qw(healthy malformed extra-row raw256 census-duplicate census-noncanonical census-eio partial-pipe inspection-fault forbidden forbidden-exec caught-fault overflow);
      die "TEST_STAGED_CAPTOR_HARNESS_FAULT\n" unless ref($q->{record}) eq 'HASH'
        &&join(',',sort keys %{$q->{record}}) eq 'mode'&&defined($mode)&&!ref($mode)&&$modes{$mode};
      my $self=$mode=~/\A(?:partial-pipe|inspection-fault|forbidden|forbidden-exec|caught-fault|overflow)\z/;
      my $latch=sub {$fault='TEST_STAGED_CAPTOR_HARNESS_FAULT';return 0;};
      my $fail=sub {$latch->();die "$fault\n";};
      my $check=sub {die "$fault\n" if length($fault);};
      my $event=sub {
        return 0 if length($fault);
        my $ok=eval {
          $fail->() if @events>=8192||@_%2;
          my %e=(seq=>1+@events,@_);
          for my $k(keys %e) {
            $fail->() unless $k=~/\A[a-zA-Z][a-zA-Z0-9]{0,31}\z/;
            my $v=$e{$k};$fail->() unless defined($v)&&!ref($v);
            if($k eq 'op'||$k eq 'role') {
              $fail->() unless $v=~/\A[A-Za-z0-9_.-]+\z/&&length($v)<=($k eq 'op'?32:96);
            } else {$fail->() unless $v=~/\A[0-9]+\z/&&$v<=2000000000000;}
          }
          my $encoded=JSON::PP->new->canonical->utf8->encode(\%e);
          $fail->() if length($encoded)>512;push @events,\%e;1;
        };
        $latch->() unless $ok;return $ok?1:0;
      };
      my @pipe_roles=(['in-r','in-w'],['out-r','out-w'],['err-r','err-w'],['setup-r','setup-w']);
      my @clock=(0)x($mode eq 'raw256'?6:$mode=~/\Acensus-/||$mode eq 'partial-pipe'||$mode eq 'inspection-fault'||$mode eq 'overflow'?3:7);
      my @wait=([0,0],[0,0],[0,0],[424242,$mode eq 'raw256'?256:0]);
      @wait=() if $mode=~/\Acensus-/||$mode eq 'partial-pipe'||$mode eq 'inspection-fault'||$mode eq 'overflow';
      my @ready=(['out-r','err-r','setup-r'],['out-r']);
      @ready=() if $mode=~/\Acensus-/||$mode eq 'partial-pipe'||$mode eq 'inspection-fault'||$mode eq 'overflow';
      my %read=( 'out-r'=>[1,0], 'err-r'=>[0], 'setup-r'=>[0] );
      my @census;my $census;my $census_built=0;my $loaded=0;my $selector;
      my ($captured,$enumerated);my $load_complete=0;my $setup_error='';
      my $identify=sub {
        my ($fh)=@_;$fail->() unless defined($fh)&&ref($fh);
        for my $r(@owned) {
          next unless $r->{fh}==$fh;
          $fail->() if $r->{attempted}||$r->{closed}||!defined(fileno($fh))
            ||fileno($fh)!=$r->{fd};
          my @s=CORE::stat($fh);$fail->() unless @s==13;
          for my $i(0..6) {$fail->() unless $s[$i]==$r->{identity}[$i];}
          return $r;
        }
        $fail->();
      };
      my $register=sub {
        my @records=@_;
        # Alias rejection precedes registration; all distinct acquisitions are
        # retained together before any fallible fileno/stat/configuration.
        for my $r(@records) {
          for my $other(@owned,@records) {
            next if $r==$other;$fail->() if $r->{fh}==$other->{fh};
          }
        }
        push @owned,@records;
        $fail->() if $mode eq 'inspection-fault'&&@owned==2;
        for my $r(@records) {
          $r->{fd}=fileno($r->{fh});$fail->() unless defined($r->{fd})&&$r->{fd}>=3;
          for my $other(@owned) {
            next if $other==$r;
            $fail->() if !$other->{closed}&&defined($other->{fd})&&$other->{fd}==$r->{fd};
          }
          $r->{identity}=[CORE::stat($r->{fh})];$fail->() unless @{$r->{identity}}==13;
          $r->{metadataReady}=1;
          $roles{$r->{role}}=$r;
          $event->(op=>'acquire',role=>$r->{role},fd=>$r->{fd});
        }
      };
      my $dispose=sub {
        my ($r,$owner)=@_;return 0 if $r->{attempted};
        $r->{attempted}=1;$r->{closer}=$owner;
        # Raw successful CORE acquisitions are private originals before metadata.
        # Never make their cleanup depend on admission or fallible inspection.
        if($r->{metadataReady}) {
          my @s=CORE::stat($r->{fh});
          unless(defined(fileno($r->{fh}))&&fileno($r->{fh})==$r->{fd}&&@s==13) {
            $latch->();return 0;
          }
          for my $i(0..6) {if($s[$i]!=$r->{identity}[$i]) {$latch->();return 0;}}
        } else {
          unless(!$r->{exposed}&&defined($r->{fh})&&ref($r->{fh})&&defined(fileno($r->{fh}))) {
            $latch->();return 0;
          }
        }
        $event->(op=>'close-attempt',role=>$r->{role},owner=>$owner);
        $!=0;my $ok=eval {$r->{directory}?CORE::closedir($r->{fh}):CORE::close($r->{fh})};
        my $error=$@;my $errno=0+$!;
        $r->{closed}=1 if $ok&&!length($error)&&!defined(fileno($r->{fh}));
        $event->(op=>'close-result',role=>$r->{role},owner=>$owner,result=>$ok?1:0,
          definite=>$r->{closed},errno=>$errno);
        $latch->() unless $r->{closed};return $ok;
      };
      my $deny=sub {$event->(op=>'denied',role=>'external');$fail->();};
      {
        no warnings qw(redefine once);
        local *CORE::GLOBAL::pipe=sub (**) {
          $check->();$fail->() unless @_==2&&@pipe_roles&&!defined($_[0])&&!defined($_[1]);
          my $names=shift @pipe_roles;
          CORE::pipe(my $a,my $b) or $fail->();
          $register->({fh=>$a,role=>$names->[0],attempted=>0,closed=>0},
            {fh=>$b,role=>$names->[1],attempted=>0,closed=>0});
          $_[0]=$a;$_[1]=$b;$roles{$names->[0]}{exposed}=1;$roles{$names->[1]}{exposed}=1;
          ++$calls{pipe};
          if($names->[0] eq 'out-r') {
            my $row="-r--r--r-- 1 root wheel 16 Jan 1 2026 /stage/entry.mjs\n";
            $row="invalid ACL row\n" if $mode eq 'malformed';
            $row.=" 0: user:ordinary allow read\n" if $mode eq 'extra-row';
            $!=0;my $n=CORE::syswrite($_[1],$row,length($row));
            $fail->() unless defined($n)&&$n==length($row)&&!$!;
            $event->(op=>'fixture-preload',role=>'out-w',length=>$n);
          }
          if($mode eq 'partial-pipe'&&$calls{pipe}==2) {$fail->();}
          if($mode eq 'overflow'&&$calls{pipe}==3) {
            for(1..8193) {$event->(op=>'overflow',role=>'fixture');}$check->();
          }
          return 1;
        };
        local *CORE::GLOBAL::binmode=sub (*;$) {
          $check->();$fail->() unless @_==1;my $r=$identify->($_[0]);
          $fail->() if $r->{binary}++;++$calls{binmode};
          my $ok=CORE::binmode($_[0]);$fail->() unless $ok;
          $event->(op=>'binmode',role=>$r->{role});return $ok;
        };
        local *CORE::GLOBAL::fcntl=sub (*$$) {
          $check->();$fail->() unless @_==3;my $r=$identify->($_[0]);
          $fail->() unless $r->{role} eq 'setup-w'&&!$calls{fcntl}++
            &&$_[1]==Fcntl::F_SETFD()&&$_[2]==Fcntl::FD_CLOEXEC();
          $!=0;my $v=CORE::fcntl($_[0],$_[1],$_[2]);$fail->() unless defined($v)&&!$!;
          $event->(op=>'fcntl',role=>$r->{role});return $v;
        };
        local *CORE::GLOBAL::opendir=sub (*$) {
          $check->();$fail->() unless @_==2&&!defined($_[0])&&!ref($_[1])&&$_[1] eq '/dev/fd'
            &&!defined($census)&&@owned==8;
          # Read-only opening of the fixed system directory acquires only this
          # directory handle. readdir output below is synthetic, not OS census.
          CORE::opendir(my $directory,'/dev/fd') or $fail->();
          $census={fh=>$directory,role=>'census',directory=>1,attempted=>0,closed=>0};
          $register->($census);$_[0]=$directory;$census->{exposed}=1;++$calls{opendir};return 1;
        };
        local *CORE::GLOBAL::readdir=sub (*) {
          $check->();$fail->() unless @_==1&&!wantarray;
          my $r=$identify->($_[0]);$fail->() unless $r==$census;
          unless($census_built) {
            my %seen;
            for my $original(@owned) {
              $identify->($original->{fh});$fail->() if $seen{$original->{fd}}++;
            }
            @census=('.', '..','0','1','2',map {"$_->{fd}"} @owned);
            $census[6]=$census[5] if $mode eq 'census-duplicate';
            $census[5]='03' if $mode eq 'census-noncanonical';
            $census_built=1;
          }
          my $ordinal=++$calls{readdir};$event->(op=>'readdir',role=>'census',ordinal=>$ordinal);
          if($mode eq 'census-eio'&&$ordinal==6) {$!=Errno::EIO();return undef;}
          $!=0;return shift @census;
        };
        local *CORE::GLOBAL::closedir=sub (*) {
          $fail->() unless @_==1;my $r=$identify->($_[0]);$fail->() unless $r==$census;
          ++$calls{closedir};return $dispose->($r,0);
        };
        local *CORE::GLOBAL::fork=sub () {
          $check->();$fail->() unless @_==0&&!$calls{fork}++&&defined($census)&&$census->{closed};
          $event->(op=>'fork',role=>'synthetic',pid=>424242);return 424242;
        };
        local *CORE::GLOBAL::waitpid=sub ($$) {
          $check->();$fail->() unless @_==2&&$_[0]==424242&&$_[1]==POSIX::WNOHANG()&&@wait;
          my $v=shift @wait;++$calls{wait};
          $event->(op=>'wait',role=>'synthetic',pid=>424242,result=>$v->[0],raw=>$v->[1]);
          $?=$v->[1];return $v->[0];
        };
        local *CORE::GLOBAL::close=sub (;*) {
          $fail->() unless @_==1;my $r=$identify->($_[0]);
          $fail->() if $r->{directory};++$calls{close};return $dispose->($r,0);
        };
        local *CORE::GLOBAL::sysread=sub (*\$$;$) {
          $check->();$fail->() unless @_==3&&ref($_[1]) eq 'SCALAR'&&$_[2]==65536;
          my $buffer_ref=$_[1];$fail->() unless !ref($$buffer_ref)&&$$buffer_ref eq '';
          my $r=$identify->($_[0]);my $queue=$read{$r->{role}};
          $fail->() unless ref($queue) eq 'ARRAY'&&@$queue;
          my $nomination=shift @$queue;
          $fail->() unless $roles{$r->{role}=~s/-r\z/-w/r}{closed};
          $!=0;my $n=CORE::sysread($_[0],$$buffer_ref,$_[2]);
          $fail->() unless defined($n)&&!$!&&!utf8::is_utf8($$buffer_ref)&&$n==length($$buffer_ref);
          $fail->() unless $nomination?$n>0:$n==0;
          ++$calls{read};$event->(op=>'read',role=>$r->{role},count=>$n,request=>65536);
          return $n;
        };
        local *IO::Select::can_read=sub {
          $check->();$fail->() unless @_==2&&ref($_[0]) eq 'IO::Select'&&$_[1]==0.01&&@ready;
          $selector=$_[0] unless defined($selector);$fail->() unless $_[0]==$selector;
          my $want=shift @ready;my @members=$_[0]->handles;my %members;
          $fail->() unless @members==@$want&&$_[0]->count==@$want;
          for my $fh(@members) {my $r=$identify->($fh);$fail->() if $members{$r->{role}}++;}
          my @answer;
          for my $role(@$want) {$fail->() unless $members{$role};push @answer,$roles{$role}{fh};}
          ++$calls{ready};$event->(op=>'ready',role=>'selector',count=>scalar(@answer));return @answer;
        };
        local *Time::HiRes::clock_gettime=sub (;$) {
          $check->();$fail->() unless @_==1&&$_[0]==Time::HiRes::CLOCK_MONOTONIC()&&@clock;
          ++$calls{clock};my $v=shift @clock;
          my $flags=B::svref_2object(\$v)->FLAGS;
          $fail->() unless $flags&(B::SVf_IOK()|B::SVf_NOK())&&!($flags&B::SVf_POK());
          $event->(op=>'clock',role=>'monotonic');return $v;
        };
        local *CORE::GLOBAL::exec=sub {$event->(op=>'denied-exec',role=>'external');$fail->();};
        local *CORE::GLOBAL::system=$deny;
        local *CORE::GLOBAL::readpipe=sub (_) {$deny->();};
        local *CORE::GLOBAL::kill=sub (@) {$deny->();};
        local *CORE::GLOBAL::open=sub (*;$@) {$deny->();};
        local *CORE::GLOBAL::sysopen=sub (*$$;$) {$deny->();};
        local *CORE::GLOBAL::syswrite=sub (*$;$$) {$deny->();};
        local *CORE::GLOBAL::chdir=sub (;$) {$deny->();};
        local *CORE::GLOBAL::unlink=sub (@) {$deny->();};
        local *CORE::GLOBAL::mkdir=sub (_;$) {$deny->();};
        local *CORE::GLOBAL::rmdir=sub (_) {$deny->();};
        local *CORE::GLOBAL::rename=sub ($$) {$deny->();};
        local *CORE::GLOBAL::stat=sub (;*) {$deny->();};
        local *CORE::GLOBAL::lstat=sub (;*) {$deny->();};
        local *CORE::GLOBAL::seek=sub (*$$) {$deny->();};
        local *CORE::GLOBAL::sysseek=sub (*$$) {$deny->();};
        local *CORE::GLOBAL::truncate=sub ($$) {$deny->();};
        local *CORE::GLOBAL::socket=sub (*$$$) {$deny->();};
        local *CORE::GLOBAL::socketpair=sub (**$$$) {$deny->();};
        local *CORE::GLOBAL::connect=sub (*$) {$deny->();};
        local *CORE::GLOBAL::accept=sub (**) {$deny->();};
        local *IO::Select::can_write=$deny;local *IO::Select::has_exception=$deny;
        local *Time::HiRes::sleep=$deny;local *POSIX::dup2=$deny;
        local *POSIX::close=$deny;local *POSIX::_exit=$deny;
        my %prototypes=(pipe=>'**',opendir=>'*$',readdir=>'*',closedir=>'*',
          fork=>'',waitpid=>'$$',sysread=>'*\\$$;$',binmode=>'*;$',fcntl=>'*$$',close=>';*');
        for my $op(sort keys %prototypes) {
          my $expected=$prototypes{$op};
          my $installed='CORE::GLOBAL'->can($op);$fail->() unless defined($installed)&&ref($installed) eq 'CODE';
          my $core=prototype('CORE::'.$op);my $hook=prototype($installed);
          $fail->() unless defined($core)&&defined($hook)&&$core eq $expected&&$hook eq $expected;
        }
        for my $op('exec','system') {
          my $installed='CORE::GLOBAL'->can($op);
          $fail->() unless defined($installed)&&ref($installed) eq 'CODE';
          $fail->() if defined(prototype($installed));
        }
        my $source=MIME::Base64::decode_base64($ARGV[0]);
        my $ok=eval {$loaded=eval($source."\n1;\n");$setup_error=$@;
          $check->();$fail->() unless $loaded&&!length($setup_error);$load_complete=1;
          my $capture=\&task6a_origin_capture;my $fds=\&task6a_origin_fds;
          local *main::task6a_origin_fds=sub {
            $check->();$fail->() unless @_==0;
            $enumerated=$fds->();return $enumerated;
          };
          local *main::task6a_origin_capture=sub {
            $check->();$fail->() unless @_==4&&$_[0] eq '/bin/ls'&&ref($_[1]) eq 'ARRAY'
              &&@{$_[1]}==2&&$_[1][0] eq '-lde'&&$_[1][1] eq '/stage/entry.mjs'
              &&$_[2]==2&&$_[3]==4096;
            ++$calls{capture};$event->(op=>'capture',role=>'acl');
            $captured=$capture->(@_);return $captured;
          };
          my $diagnostic=eval {task6a_origin_acl_free('/stage/entry.mjs')};my $primary=$@;
          if($mode eq 'forbidden') {eval {CORE::GLOBAL::system('/bin/false')};}
          if($mode eq 'forbidden-exec') {eval {CORE::GLOBAL::exec('/bin/false','/bin/false')};}
          if($mode eq 'caught-fault') {eval {$fail->()};}
          $check->();
          my $refused=!defined($diagnostic)&&$primary eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
          $fail->() unless (!length($primary)&&ref($diagnostic) eq 'HASH')||$refused;
          $out={accepted=>defined($diagnostic)?JSON::PP::true:JSON::PP::false,
            refused=>$refused?JSON::PP::true:JSON::PP::false,diagnostic=>$diagnostic,
            captured=>$captured,enumerated=>$enumerated,
            helpersSettled=>task6a_origin_helpers_settled()};$check->();
          1;
        };my $primary=$@;
        # Independent fixture finalizer: never mutable producer ledgers/receipts.
        # Already-attempted uncertain originals are not retried.
        for my $r(@owned) {
          next if $r->{attempted};
          my $closed=eval {$dispose->($r,1)};my $error=$@;
          $latch->() unless $closed&&!length($error)&&$r->{closed};
          ++$calls{fixtureClose};
        }
        my $definite=grep {$_->{closed}&&!defined(fileno($_->{fh}))} @owned;
        $latch->() unless $definite==@owned;
        unless($load_complete) {die length($setup_error)?$setup_error:"$fault\n";}
        if(length($fault)) {
          die "$fault\n" unless $self&&$primary eq "$fault\n";
          $out={accepted=>JSON::PP::false,refused=>JSON::PP::false,diagnostic=>undef,
            harnessFault=>$fault};
        } else {
          die $primary unless $ok;
          $check->();$fail->() if @clock;
          unless($mode=~/\Acensus-/) {$fail->() if @wait||@ready;}
          $out->{harnessFault}=undef;
        }
        $out->{calls}=\%calls;$out->{events}=\@events;
        $out->{ownedCount}=scalar(@owned);$out->{definitelyClosed}=$definite;
        $out->{consumerClosed}=scalar(grep {$_->{closed}&&$_->{closer}==0} @owned);
        $out->{fixtureClosed}=scalar(grep {$_->{closed}&&$_->{closer}==1} @owned);
        $out->{syntheticCensus}=JSON::PP::true;
        $out->{productionAuthority}=JSON::PP::false;
        my $metadata=JSON::PP->new->canonical->utf8->encode({map {$_=>$out->{$_}} grep {$_ ne 'events'} keys %$out});
        die "TEST_STAGED_CAPTOR_HARNESS_FAULT\n" if length($metadata)>16384;
        my $json=JSON::PP->new->canonical->utf8->encode($out);
        die "TEST_STAGED_CAPTOR_HARNESS_FAULT\n" if length($json)>8388608;
        print $json;exit 0;
      }
    }
```

- [x] **Step 4: Wire the closed branch and literal matrix.** In systemObject, immediately after existing sole-main removal, add the exact closed-kind mapping `if(kind==='staged-captor-ports') source=replaceOnce(source,'exec {$tool} $tool,@$args;','CORE::GLOBAL::exec($tool,$tool,@$args);');`. Then insert `${STAGED_CAPTOR_PORT_PROGRAM}` immediately before `${PARENT_PORT_PROGRAM}`. Change only that function's spawn `maxBuffer:65536` to `maxBuffer:kind==='staged-captor-ports'?8388608:65536`. Keep exact source removal, scrubbed env, fixed Apple Perl, ordinary-host refusal, cwd and timeout. Tests below live in the existing ordinary-host else block; Step1 initially adds only helper/first test.

```javascript
function stagedCaptorPorts(mode='healthy') {
  assert.equal(typeof STAGED_CAPTOR_PORT_PROGRAM,'string','staged captor adapter missing');
  const r=systemObject('staged-captor-ports',{mode},'');
  assert.equal(r.status,0,r.stderr.toString());assert.equal(r.stderr.length,0);
  const out=JSON.parse(r.stdout);assert.equal(out.productionAuthority,false);
  assert.equal(out.syntheticCensus,true);return out;
}
test('staged captor foundation retains actual ACL capture and original closure',()=>{
  const out=stagedCaptorPorts();
  assert.equal(out.harnessFault,null);assert.equal(out.accepted,true);assert.equal(out.refused,false);
  assert.deepEqual(out.diagnostic,{scope:'acl-sample-diagnostic-only',productionAuthority:false});
  assert.deepEqual(out.captured,{out:'-r--r--r-- 1 root wheel 16 Jan 1 2026 /stage/entry.mjs\n',
    err:'',status:0,pid:424242,reaped:true});
  assert.equal(out.helpersSettled,true);
  assert.equal(out.ownedCount,9);assert.equal(out.definitelyClosed,9);
  assert.equal(out.consumerClosed,9);assert.equal(out.fixtureClosed,0);
  assert.deepEqual(out.calls,{capture:1,pipe:4,binmode:8,fcntl:1,opendir:1,
    readdir:15,closedir:1,clock:7,fork:1,close:8,ready:2,read:4,wait:4});
  const waits=out.events.filter(e=>e.op==='wait');
  assert.deepEqual(waits.map(e=>[e.pid,e.result,e.raw]),[[424242,0,0],[424242,0,0],
    [424242,0,0],[424242,424242,0]]);
  const acquired=out.events.filter(e=>e.op==='acquire');
  assert.deepEqual(acquired.map(e=>e.role),['in-r','in-w','out-r','out-w','err-r','err-w','setup-r','setup-w','census']);
  const own=acquired.find(e=>e.role==='census').fd;
  assert.equal(out.enumerated.includes(own),false);
  const pipes=acquired.filter(e=>e.role!=='census').map(e=>e.fd);
  assert.deepEqual(out.enumerated,[0,1,2,...pipes].sort((a,b)=>a-b));
  assert.deepEqual(out.events.filter(e=>e.op==='read').map(e=>[e.role,e.count,e.request]),
    [['out-r',55,65536],['err-r',0,65536],['setup-r',0,65536],['out-r',0,65536]]);
  assert.deepEqual(out.events.filter(e=>e.op==='close-attempt').map(e=>[e.role,e.owner]),
    [['census',0],['in-r',0],['in-w',0],['out-w',0],['err-w',0],['setup-w',0],
      ['err-r',0],['setup-r',0],['out-r',0]]);
});
for(const mode of ['malformed','extra-row','raw256']) {
  test('staged captor foundation refuses '+mode+' through actual consumer',()=>{
    const out=stagedCaptorPorts(mode);
    assert.equal(out.harnessFault,null);assert.equal(out.accepted,false);assert.equal(out.refused,true);
    assert.equal(out.diagnostic,null);assert.equal(out.helpersSettled,true);
    assert.equal(out.ownedCount,9);assert.equal(out.definitelyClosed,9);
    assert.equal(out.consumerClosed,9);assert.equal(out.fixtureClosed,0);
    assert.equal(out.calls.clock,mode==='raw256'?6:7);assert.equal(out.calls.wait,4);
    assert.equal(out.calls.close,8);assert.equal(out.calls.closedir,1);
    if(mode==='raw256') {
      assert.equal(out.captured,null);
      const last=out.events.filter(e=>e.op==='wait').at(-1);
      assert.deepEqual([last.pid,last.result,last.raw],[424242,424242,256]);
    } else {assert.equal(out.captured.reaped,true);assert.equal(out.captured.status,0);}
  });
}
for(const [mode,count] of [['census-duplicate',7],['census-noncanonical',6],['census-eio',6]]) {
  test('staged captor foundation refuses '+mode+' before synthetic fork',()=>{
    const out=stagedCaptorPorts(mode);
    assert.equal(out.harnessFault,null);assert.equal(out.accepted,false);assert.equal(out.refused,true);
    assert.equal(out.captured,null);assert.equal(out.enumerated,null);assert.equal(out.helpersSettled,false);
    assert.equal(out.calls.readdir,count);assert.equal(out.calls.clock,3);
    assert.equal(out.calls.fork,undefined);assert.equal(out.calls.wait,undefined);
    assert.equal(out.calls.read,undefined);assert.equal(out.calls.ready,undefined);
    assert.equal(out.ownedCount,9);assert.equal(out.consumerClosed,9);assert.equal(out.fixtureClosed,0);
    assert.equal(out.definitelyClosed,9);
  });
}
for(const [mode,owned,consumer,fixture] of [['inspection-fault',2,0,2],['partial-pipe',4,2,2],['overflow',6,4,2],
    ['forbidden',9,9,0],['forbidden-exec',9,9,0],['caught-fault',9,9,0]]) {
  test('staged captor foundation classifies '+mode+' as harness fault with original containment',()=>{
    const out=stagedCaptorPorts(mode);
    assert.equal(out.harnessFault,'TEST_STAGED_CAPTOR_HARNESS_FAULT');
    assert.equal(out.accepted,false);assert.equal(out.refused,false);assert.equal(out.diagnostic,null);
    assert.equal(out.ownedCount,owned);assert.equal(out.definitelyClosed,owned);
    assert.equal(out.consumerClosed,consumer);assert.equal(out.fixtureClosed,fixture);
    if(mode==='overflow') {assert.equal(out.events.length,8192);}
    if(mode==='forbidden') {assert.equal(out.events.filter(e=>e.op==='denied').length,1);}
    if(mode==='forbidden-exec') {assert.equal(out.events.filter(e=>e.op==='denied-exec').length,1);}
  });
}

```

- [x] **Step 5: Exact candidate review before GREEN/negative execution.** Two independent reviewers inspect native/installed prototypes, caller aliases, real buffer/count agreement, immediate pair/DIR ownership, finite queues, zero-but-true fcntl return, deny-before-effect delegates, raw wait status, synthetic census, preserved actual source/helper decisions, budgets and original containment. Producer/finalizer credit stays separate. Syntax/anchor/prototype/queue/alias/sticky fault is harness failure, not semantic RED. Source SHA remains unchanged. Resolve load-bearing findings before execution. Declaration load-complete is set only after successful eval/sticky checks; incomplete load is fatal before self-mode classification, preserving setup error without contained-success JSON. Direct denied-exec self-witness must latch the fixed harness fault with no delegation.
- [x] **Step 6: Run the reviewed 13-test foundation, read complete output and observe natural terminal.** Record actual pass/fail/filter counts; name filtering does not qualify unsupported hosts. Healthy and real source refusals have zero fixture-finalizer credit. Inspection/partial/overflow faults independently close exactly two originals through the finalizer. No real child-helper/native uncertain-close qualification.

```bash
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged captor foundation ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

- [x] **Step 7: Record this foundation's exact boundary.** Save the observed missing-adapter RED, H1 actual-composition results and all13 outcomes with source/test hashes, full output and natural terminals. Record inspection-fault as two raw unexposed acquisitions with consumer0/fixture2 closure; partial-pipe as4/2/2; overflow as6/4/2. Do not implement or execute staged-owner/shared-holder/throwing-close/mutation recipes in this task. Those require separately literal reviewed subplans before their effects; this foundation alone is not full staged/native admission.
- [ ] **Step 8: Adjacent verification and scoped delivery.** Complete fresh bootstrap suite on exact final source/test, diff/English/path gates, independent whole-branch review, scoped conventional commit, normal push/PR/current-head feedback/SHA-bound merge and separately admitted own clean-main normal guarded build. No new ALL or staged owner implementation. Record proof in the two existing external ledgers and preserve all roots.

**Preflight consistency:** P2a consumes unchanged source04393 and leaves main refused. This task changes only test ports/docs and cannot initialize the proposed staged owner. A later staged task consumes this bridge only after complete admission; future H42 math cannot substitute for H1. Fixture closes in inspection/partial/overflow are never credited to consumer cleanup. Staged ownership, shared throwing-cleanup regression/fix, native/protected origin/compiler/DB fence/loaded service/A–E remain separately gated.

Ordinary foundation execution ledger, 2026-10-03:

- Two exact candidate RED reviews C0/I0/M0; a657c7 naturally CLOSED1,
  1FAIL/0SKIP/65.381833ms, exact missing-adapter assertion before any fixture.
  This is adapter RED, not a production security failure. All output read.
- Initial c18721 naturally CLOSED1, 12FAIL/0SKIP/436.411417ms: one shared
  setup/compile cascade from overriding Perl's native exec-block syntax.
  No semantic refusal or containment credit. Before another execution, the
  uniquely anchored closed-kind denied-port mapping and fatal incomplete-load
  guard were documented, implemented and independently reviewed C0/I0/M0.
- Exact testc51fc0a23da60166cbad51cab4e24ababafee018597a639f54f85880d5b8ffa3,
  unchanged bootstrap04393; focused117816 naturally CLOSED0,13PASS/0FAIL/0SKIP/
  551.532833ms. Full output read. Actual H1, source refusals and all fixture
  self-cases passed, with consumer versus finalizer closure kept distinct.
- Two exact unfiltered-recipe reviews C0/I0/M0; ONE full bootstrap752f69/485b97,
  managed83894 naturally CLOSED0,1131PASS/0FAIL/0SKIP/76220.743583ms. All1141
  output lines read. Existing ordinary owned-child/synthetic-observer effects
  remained their previously admitted case-specific scope; this was not an
  effect-free suite or native/protected probe. Post-run source/test/spec/plan
  pins unchanged. English1931/path966 checks passed. No new ALL.
- Steps1–7 and Step8's adjacent verification qualify. Whole-branch review,
  normal PR delivery and separately admitted own clean-main guarded build remain
  pending. No staged owner, throwing/shared-cleanup repair, native origin,
  compiler/DB fence/loaded-service/cutover/A–E result is inferred.

### Task 3: Reviewed delivery and actual protected rehearsal

- [ ] Run full focused pure/protocol tests, sourceTS/syntax/version/English/path/frozen migration/MC/diff contracts. Independent exact all-source/test/spec/plan review. Ordinary feature build obeys unchanged main guard.
- [ ] Conventional scoped commits, normal push/PR, fresh exact-head available cloud/security/full paginated review/comments/threads gate; optional Copilot/Gemini once. Normal SHA-bound merge, no bypass/deletion.
- [ ] Fast-forward clean standby main, ordinary build/compiled observer and merged focused tests. Independently inspect actual GitHub merge/source/review/security identities for the owner-install selection. Freeze exact bootstrap/entry/helper blobs/bytes and actual invocation literal; independently review again BEFORE privileges.
- [ ] Actual opt-in trusted-owner installation uses only fixed system tools: fetch the actual admitted bootstrap blob to a newly root-owned private stage, check typed base64/size and framed Git identity against the independently admitted delivered blob, then execute exact protected system Perl program. Never root-execute the user-owned test Node/local mutable file or derive authority from a receipt DTO.
- [ ] Run actual private vendor/source/native/credential-drop/direct-PID/private-pipe/held-byte/lifetime positives and wrong-entry/argv-title spoof/replay/foreignPID/source-native replacement/parent-loss/cleanup-uncertainty denials. Only delivered source and real official archive count; fakes prove protocol only. Capture actual child UID/groups/start/maps and exact root/source/vendor identities, definite cleanup or preserved failure evidence.
- [ ] Independent post-run PID/root absence or exact preserved-tree validation, then PG31/HTTP/selector/namespace read-only checks. Standby unselected and all live guards unchanged. Record exact remaining compiler/fence/genesis/32/33/admission/live handoff outcomes without claiming Task6A completion.

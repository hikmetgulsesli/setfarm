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

- [ ] **Step 9: Ordinary reviewed delivery.** Exact four-file independent source/
  test/spec/plan review; record actual RED/GREEN/mutant counts and source pins.
  Scoped conventional commit/normal push/PR; full paginated actual current-head
  comments/review/security/threads, normal SHA-bound merge, no bypass/deletion.
  Fresh own clean-main dependency/build admission and guarded build (never dirty
  bypass), exact source/build binding and independent old-pin/host preservation.
  This closes only ordinary P2a. No installation/root/native/service/DB/fence/
  genesis/32/33/A–E/M1/M2 claim; retain all worktrees/branches/evidence.

Ordinary execution ledger, 2026-10-03:

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

### Task 3: Reviewed delivery and actual protected rehearsal

- [ ] Run full focused pure/protocol tests, sourceTS/syntax/version/English/path/frozen migration/MC/diff contracts. Independent exact all-source/test/spec/plan review. Ordinary feature build obeys unchanged main guard.
- [ ] Conventional scoped commits, normal push/PR, fresh exact-head available cloud/security/full paginated review/comments/threads gate; optional Copilot/Gemini once. Normal SHA-bound merge, no bypass/deletion.
- [ ] Fast-forward clean standby main, ordinary build/compiled observer and merged focused tests. Independently inspect actual GitHub merge/source/review/security identities for the owner-install selection. Freeze exact bootstrap/entry/helper blobs/bytes and actual invocation literal; independently review again BEFORE privileges.
- [ ] Actual opt-in trusted-owner installation uses only fixed system tools: fetch the actual admitted bootstrap blob to a newly root-owned private stage, check typed base64/size and framed Git identity against the independently admitted delivered blob, then execute exact protected system Perl program. Never root-execute the user-owned test Node/local mutable file or derive authority from a receipt DTO.
- [ ] Run actual private vendor/source/native/credential-drop/direct-PID/private-pipe/held-byte/lifetime positives and wrong-entry/argv-title spoof/replay/foreignPID/source-native replacement/parent-loss/cleanup-uncertainty denials. Only delivered source and real official archive count; fakes prove protocol only. Capture actual child UID/groups/start/maps and exact root/source/vendor identities, definite cleanup or preserved failure evidence.
- [ ] Independent post-run PID/root absence or exact preserved-tree validation, then PG31/HTTP/selector/namespace read-only checks. Standby unselected and all live guards unchanged. Record exact remaining compiler/fence/genesis/32/33/admission/live handoff outcomes without claiming Task6A completion.

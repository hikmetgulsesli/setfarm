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
- Create `scripts/task6a-protected-origin-entry-v2.mjs`, builtin-only zero-extra-argument child: READY, fresh parent CHALLENGE/PONG exchange, END/EOF and fixed20s deadline. No child-reported identity or arbitrary eval/paths/imports.
- Create `scripts/task6a-protected-origin-bootstrap-v2.pl`: fixed zero-argument root system supervisor; source/vendor authentic retrieval, protected staging, held direct child/lifetime and exact cleanup. Helpers are imported only after fixed Git byte-policy authentication.
- Create `scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js`: invoke actual fixed system Perl and helpers under scrubbed environment, actual child entry and parent contract. Default no privileged effects.
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

- [ ] Write actual unprivileged entry tests before source: exact stdout READY/PONG/END behavior, missing/bad/replayed nonce, extra args, wrong/partial/overbound messages, input EOF, parent loss, fixed deadline and definite close. Spawn ordinary test Node only for protocol evidence; never label it vendor/protected origin.
- [ ] Implement builtin-only child with parent protocol and fixed20s total timer, no renewal/caller options, exit on EOF/invalid input/uncertain stream error. Supply no PID/source facts to parent.
- [ ] Write root-supervisor default denial test: ordinary real system Perl invocation refuses before network/staging/fork. Stub only external effects in a test-only harness where necessary; retain actual program branches, canonical route/source/tree framing, native helper and parent state machine. No production dependency-injection or special test argv.
- [ ] Implement first-BEGIN fixed system module roots and root/exact-zero-argument refusal. Core modules include POSIX/JSON::PP/IO::Select/Digest::SHA/Time::HiRes/MIME::Base64/Encode/Gunzip; root independently inventories/protects full PM/XS/libperl closure, not only initial five bundles. No unchecked default modules.
- [ ] Implement fixed scrubbed Applecurl via direct exec, no shell/config/proxy/redirect/credentials/API-returned routes. Shared monotonic bootstrap180s bound, per metadataGET10s/connect5s/body4MiB; archiveGET60s/128MiB; no retries/renewal. Own helper subprocess PIDs/EOF/reap; uncertainty refuses before execution/cleanup. Actual HTTP200/UTF8/JSON/route/output bounds are required.
- [ ] Port strict signed-merge/tree/blob framing from delivered PR251 semantics into authentic system publisher, test golden ASCII/UTF8 bytes and coherent denials. Join real merged PR/base/main/repo/head/second parent and sampled main endpoint agreement. Do not substitute plutil/verdict-only checks for object identity or call this independent GPG verification.
- [ ] Source helper/entry policy uses actual literal blob identities computed after their final byte review:

```bash
git hash-object scripts/task6a-origin-archive-v2.pm
git hash-object scripts/task6a-origin-native-v2.pm
git hash-object scripts/task6a-protected-origin-entry-v2.mjs
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

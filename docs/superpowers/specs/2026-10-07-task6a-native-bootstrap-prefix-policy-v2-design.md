# Task6A native bootstrap prefix policy v2 design

## Bounded causal correction

The startup lacks a shared policy prefix joining prerequisite receipts to the
delivered S10e remap object. This is necessary for the existing completion goal,
not a retained-terminal fix. Root selects this separately nominated memory-only
source correction under standing authorization. Universal terminal, runtime,
security and test gates remain unchanged.

Alternatives: another wait probe does not fix composition; physical bootstrap
source/adapters remain forbidden by unresolved terminal; a private C policy
composition is selected. No production caller or physical adapter is introduced.
The eventual bootstrap must use this exact reducer/object, not a test-only mirror.

## Sole storage

One private synchronous object holds three stdio slots plus the ACTUAL S10e
eight-slot object, never a second writable eleven-FD ledger. NEW private mapping:
global1..3 = stdio0..2/FD0..2; global4..9 = remap local1..6/FD3..8;
global10..11 = remap local7..8/planned new3/4. Not an already-selected physical
identity scheme. Old S10e code/local IDs remain byte-unchanged.
Private valid storage, exclusive access and callback lifetime are preconditions,
not proof of physical custody/thread identity. Context confines forwarding only.
The port table remains live, immutable and nonoverlapping with policy storage
throughout entry. Context may refer back to the policy for defined owner/remap
recursive entry; exclusive access permits those APIs but excludes concurrent
access and arbitrary callback writes to either ledger or table. Canonical zero
is checked fieldwise; padding bytes are never observed or used as authority.

## Prefix / failure rules

Start only canonical all-zero storage and complete nonnull ports. Null storage
REFUSES with no effects. Invalid nonnull storage/ports burns BOTH latches and
preserves all other state/history. No reset or retry API.

On entry set entered once and ALL9 inherited occurrences PENDING before the
first callback; planned targets EMPTY. Ports are SYNTHETIC pure receipt reducers,
never permission for physical FD/thread/image calls, guard mutation, acquisition,
Node or retained-owner birth.

1. Genesis global1..9/FD0..8, once each: premark, call, seal raw rc. Only1 marks
   model HELD; otherwise UNKNOWN, burn and preserve unvisited PENDING suffix.
2. Premark/call/seal DISABLE once; require rc0 and synthetic saved ENABLE0 or
   DISABLE1. Failed-call output is raw untrusted history, not saved-state proof.
3. MASK once: require rc0 and valid-output1; no actual mask/continuity authority.
4. ENTRY model census once: require1, not a real complete immutable-table scan.
5. Derive ready1 from accepted receipts, invoke ACTUAL S10e on the same embedded
   object. Its eight close/dup receipts are sole records. Binding wrappers
   premark/seal binding[0/1] with old local IDs7/8, same forwarded context.
6. Require actual remap COMPLETE and neither burn; POST model census once
   requires1. Return PREFIX_COMPLETE/phase COMPLETE, never Node/readiness,
   full settlement, restoration, acquisition or cleanup permission.

Top-level genesis/guard/census boundaries and binding wrappers seal their OWN
returned receipt before checking BOTH burns. Close/dup wrappers must instead
forward the ORIGINAL raw struct unchanged and synchronize either burn into BOTH
before returning it to S10e; they do not duplicate or pre-seal the sole old
action receipt. S10e immediately seals that returned result and known
settlement/acquisition, then observes its burn and stops. Binding wrapper seals
its own integer receipt, synchronizes burns and forwards the ORIGINAL int.
Only the enum-returning outer entry may return SF_P_BURNED after these boundaries
or after actual S10e returns; never substitute that enum for a port result.
After EVERY callback, including pre-remap ports, propagate either burn to BOTH
and stop before any later port. Owner reentry immediately burns both with no nested
callbacks. Direct old-policy reentry can burn embedded only: detect at the first
returned boundary, not only after eventual remap. During close/dup reentry, let
old policy seal its returned known settlement/acquisition before stopping.
Refusal/reentry never erases identity, phase, receipt or action prefix.
Unreturned callbacks stay pending; no terminal/progress/death claim follows.

## Exact private interface

```c
#ifndef SF_ORIGIN_BOOTSTRAP_PREFIX_POLICY_V2_H
#define SF_ORIGIN_BOOTSTRAP_PREFIX_POLICY_V2_H
#include "task6a-origin-native-remap-policy-v2.h"
/* Private memory prefix only: no physical owner, guard, census or permission. */
enum sf_prefix_phase_v2 { SF_P_UNBOUND, SF_P_GENESIS, SF_P_DISABLE, SF_P_MASK,
    SF_P_ENTRY, SF_P_REMAP, SF_P_POST, SF_P_COMPLETE };
enum sf_prefix_result_v2 { SF_P_REFUSED, SF_P_BURNED, SF_P_PREFIX_COMPLETE,
    SF_P_UNAVAILABLE };
struct sf_prefix_call_v2 { int rc, error, output; };
struct sf_prefix_receipt_v2 {
    unsigned attempted, returned;
    int rc, error, output;
};
struct sf_prefix_policy_v2 {
    unsigned entered, burned;
    enum sf_prefix_phase_v2 phase;
    struct sf_remap_occurrence_v2 stdio[3];
    struct sf_remap_policy_v2 remap;
    struct sf_prefix_receipt_v2 genesis[9];
    struct sf_prefix_receipt_v2 disable, mask, entry, post, binding[2];
};
struct sf_prefix_ports_v2 {
    void *context;
    int (*genesis)(void *, unsigned, int);
    struct sf_prefix_call_v2 (*disable)(void *);
    struct sf_prefix_call_v2 (*mask)(void *);
    int (*entry)(void *);
    struct sf_remap_call_v2 (*close_one)(void *, int);
    struct sf_remap_call_v2 (*duplicate)(void *, int, int);
    int (*binding_valid)(void *, int, unsigned);
    int (*post)(void *);
};
enum sf_prefix_result_v2 sf_bootstrap_prefix_run_v2(
    struct sf_prefix_policy_v2 *, const struct sf_prefix_ports_v2 *);
#endif
```

No bearer-capability accessor, JS policy mirror, guard/Node adapter or release API.

## File Map / unchanged gates

Create scripts/task6a-origin-native-bootstrap-prefix-policy-v2.h, its .c ONLY
after genuine RED, and scripts/__tests__/task6a-origin-native-bootstrap-prefix-policy-v2.test.js.
Create this paired spec/plan: PR275 aggregate19 files, existing14 plus5.
All old docs/native/entry/test/driver/recipes, S10e three files, original dirty
files, selected CLI/dist and journal remain frozen. Root alone writes.
New private originals are logs, never public delivery artifacts.

## Separately nominated finite actual-C fixture

NEW closed model-only opt-in; default SKIP without effects; adjacent native flags
refuse. Compile old remap plus new prefix plus independent C driver, not old
test/recipe replay. Missing new C uses driver-only UNAVAILABLE/NO_EFFECT fallback
and naturally exits71; unwrapped ordinary exit0 oracle must fail for that exact
behavior, not missing-file/compiler/setup error.

Exact test-only opt-in: SETFARM_ALLOW_NATIVE_BOOTSTRAP_PREFIX_MODEL_V2=1.
Absent registers SKIP; any other present value refuses before effects. Exact
SETFARM_NATIVE_BOOTSTRAP_PREFIX_MODEL_MODE allows baseline or omit-cross-burn
only, default baseline. Reject every other SETFARM_TASK6A_NATIVE_* and every
adjacent SETFARM_ALLOW_* containing NATIVE/COOPERATIVE/TASK6A. New private fixture
prefix /private/tmp/setfarm-bootstrap-prefix-model.; owner501 mode0700. Copy
only the two owned headers, old remap C, optional new prefix C and driver;
emit their objects and model binary, inspect exact expected directory entries.
No cleanup/deletion/repair of prior fixture is part of this recipe.

Use exact S10e fixed clang/ld/nm/otool/Node/SDK26.5 settings/System/resource pins,
held/rechecked anew. Only TWO owned headers in own-include closure; C11/O0/
nostdinc/fno-builtin/strong-stack/no modules/LTO/default config. Only stack guard/
fail imports and one System dependency permit execution; new import refuses.
No whole provider/dyld proof. Processes require natural exit+close and both EOFs;
never kill/retry/hide output or settle a hanging pending call. Preserve fixtures
and complete checked-once input holder closure.

Independent literal C oracle: success; each genesis with0/-1/2; disable errors/
illegal saved output; mask errors/invalid output; entry/post0/-1/2; all8 remap and
both binding failures; owner AND direct-remap reentry at EVERY callback;
malformed storage/ports; historical prefix and pending suffix preservation.
One separately nominated private derivative omitting cross-burn propagation must
fail this actual C oracle; never mutate originals or replay accepted baseline.

Finite success qualifies shared FD-prefix policy ONLY. Physical inherited birth,
nonFD/provider/Kc/Mach/VM capacity, guard/TCB/thread continuity, two real complete
censuses, original-owner terminal, Node lifecycle, EVERY settlement/restoration,
P2/CONTROL/P3/P4/P5/A-E/READY/merge/cutover remain closed.

## Observed finite verification, 2026-10-06 UTC

Nomination was independently reviewed before implementation. The first candidate
driver compile at21:53 refused a misleading-indentation warning under unchanged
-Werror: compiler/setup refusal, NOT RED. An explicit-brace-only driver correction
was reviewed; the refused fixture remains untouched.

Genuine missing-C RED21:56:05..08 naturally closed with six statuses
0,0,0,0,0,71 and19 checked-once closes/errors[]. The driver-only UNAVAILABLE
path checks full fieldwise NO_EFFECT and naturally exits71; the ordinary exit0
assertion fails specifically MissingBootstrapPrefixPolicy. New C was authored
only after preserving that complete original.

Actual-C GREEN22:02:39..41 has seven natural zero statuses (three compiles,
link, nm, otool, model), both EOFs and22 checked-once closes/errors[].
Ordinary test result:1PASS/0FAIL/0SKIP. The independent finite driver covers
both accepted synthetic saved guard values, failure at all23 callback positions,
invalid guard outputs, both owner/direct-remap active reentry with successful
and error results, missing ports/noncanonical storage and NO_EFFECT refusal.

Separately reviewed copy-only omit-cross-burn22:04:48..50 replaces only the
unique live check's inner-latch term. Its seven natural statuses are
0,0,0,0,0,0,140;22 checked-once closes/errors[], both EOFs; ordinary FAIL.
Direct-remap reentry at first genesis now allows later ports, violating the
unchanged stopped-prefix oracle. This is specific behavioral sensitivity,
not a compiler/setup failure, baseline replay or exhaustive mutation proof.

All qualified invocations inspected exactly two stack imports and one direct
System1356 dependency before model entry; compile/link/model channels are
empty. Each effect recipe had fresh255-input preservation with unchanged
materialManifest8932f44384c62eccfae77276eb84c6d5a8ec47a0252cec8c7f29c24e47289f21.
Default invocation registers one SKIP without effects; syntax passes; adjacent
native opt-in refuses before fixture acquisition. SKIP is not acceptance.

Reviewed source pins: header ad64d936990c55d0600ca259f5a416e2dbc8cbaa378f7208c9a00f6b4252236f;
C e6c6e9c40f3293298adb87a4f8b22f73e97d39da9690cbee15ece28ff372b1db;
test7bc8edaa80779571daa1841c4012b240b307f6ac1e88edc0cdadf8a4b287d47a;
driver baa0711f323f26567753faa866be37e5473344f34f30720c8cfbb034a66675ec.
Owned derivative C958411160735671613b1481ae535e8d4df70955720bc8658363de25c49e45481.
Originals/accepted fixtures remain unchanged; private complete raw receipts
are not public delivery files. Source/test evidence was independently reviewed.
Only this shared private C prefix is qualified. Physical/integrated, terminal,
CONTROL, rollout and whole-project qualification remains unresolved;
all associated execution/admission gates above remain closed.

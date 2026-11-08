# Subscription worker owner-admission wait

## Goal and causal evidence

Allow a genuinely owned subscription worker to wait for the existing fenced owner-admission transaction without consuming its proof/OPENED startup window. This fixes the observed software-production recovery path; it adds no model capabilities or product-specific policy.

Actual Source `7a7612f90aad0dfb76316ceff36ece0b15d89ea2`, installation `56cdc7c6-2370-4c8f-94c1-d7c2e6878747`, run `418522b3-d042-49c4-bbfb-91acc8f641f6`: implementation failed 7/8 authoritative predicates. The normal bounded repair acquired claim 8, attempt `ATT_3a07513d-b388-49be-b458-cf1f9a39edf7`, runtime `RTS_c061ebff-32a7-41e2-81c8-abb67d9dc9f7`. Worker-bound custody was recorded at 22:53:33.278 UTC; original custody closed uncertain at 22:53:43.211, before the stored owner RUNNING update timestamp of 22:53:49.778. Exact function-return and COMMIT times are unknown. Later quarantine and stale recovery fences are downstream. The exact winning child 9s or parent 10s timer is not recorded.

Evidence: operational `root-supervise-evidence-recovery-pretransfer-clock-audit-v1.json`, SHA256 `4e38331325dc9c3ac3c1a186042c7a66609394c4d6780ed18aee040b6e691ff6`; safe refusal `root-supervise-evidence-recovery-runtime-refusal-safe-v1.json`, SHA256 `b005b5a72d7aea8debe90715b8566335a9b162de9ffac811f6016a8c21f9de08`.

## Chosen design

Add one explicit, private, identity-bound owner-admission wait between authenticated worker proof and the existing OPEN/OPENED exchange. The real runtime requests it only after validating the original worker, isolation material and durable worker-bound journal. Acquisition awaits its acknowledgement before returning to the selected caller. This covers subsequent starting-claim checks, fenced markRunning and running-claim/supervisor rechecks without changing their order or authority.

The private protocol gains `waitForOwnerAdmission(): string` and states `admission-wait-sent` and `admission-waiting`. The fixed request type is `owner-admission-wait`; its fixed acknowledgement is `owner-admission-waiting`. Both carry the existing complete nonce/PID/identity/material/policy/preload binding. No caller-supplied duration or new credential is accepted. A worker facade gains `waitForOwnerAdmission(): Promise<void>`; selected/spawner APIs remain unchanged.

Clocks and transitions:

| Phase | Bound | Required transition |
| --- | --- | --- |
| Proof and optional wait negotiation | Existing child 9000ms / parent 10000ms absolute startup bounds | Exact proof, stable isolation checks and exact wait ACK before those bounds expire |
| Explicit acknowledged owner-admission wait | New fixed 120000ms; one shot, no reset | Existing authenticated owner checks and RUNNING publication, followed by physical OPEN |
| OPEN/OPENED after explicit wait | Fresh existing short child 9000ms / parent 10000ms bounds | Exact bound OPEN/OPENED, never merely gate write |
| Whole original worker/runtime attempt | Existing 1800000ms, counted from original acquisition/spawn | Never restarted or extended by wait or OPEN |

The 120000ms value is a new phase budget, not an already-owned lease or authority. Existing claim/recovery lease checks remain authoritative and may refuse earlier. Expiry, original death, FD EOF, abort or invalid identity still fails closed. READY without the explicit authenticated wait keeps the original short timeout. A wait request without ACK keeps the original short parent timeout. A direct non-wait path retains its current exact short deadline behavior.

The preload remains blocked before SDK evaluation throughout the wait. No authenticated application/provider request or new file/network permission is granted; the existing broker TCP connectivity proof remains intact. Incoming frame parsing allows only the fixed optional three-frame challenge/wait/open sequence instead of accepting arbitrary extra messages. Duplicate, replayed, foreign, malformed or out-of-order requests/ACKs/OPENED refuse. A wait cannot be repeated to renew its budget. Unexpected queued or partial data cannot cross an outgoing phase transition.

The physical parent revalidates original process identity and pinned material before requesting wait and before OPEN. Its nonrenewable wait deadline is anchored at wait-request emission, never ACK arrival. It disarms the startup timer only on authenticated timely wait ACK, installs that already-anchored wait deadline, then re-arms the short OPENED timer when actual OPEN is sent. The child starts its wait budget on accepting the valid fixed wait request and retains EOF handling through SDK lifetime. Request, ACK, OPEN and OPENED transitions synchronously check monotonic deadlines, including late events arriving before timer callbacks execute. Admission timeout consumes the existing whole-attempt budget.

The runtime races wait acknowledgement against its existing closed/abort/lifetime ownership path. Every fault/stop/finish rejects a pending wait. Missing or malformed worker methods/promises refuse without discarding original partial ownership; production acquisition cannot silently fall back to the direct path. Custody signalling recognizes valid new pre-OPEN states only as the existing READY state permits; ACK is not closure evidence and closure acceptance, original process/stream promises, quarantine and uncertainty rules are unchanged. Slow proof or slow durable worker binding still consumes its original startup window and may correctly refuse.

## Alternatives rejected

- Raising the existing startup constants: weakens ordinary proof/no-OPENED failures and obscures the phase error.
- Opening before owner publication or skipping SQL/custody checks: breaks the existing ownership boundary.
- Splitting privileged owner SQL into new pre-admission tickets: adds a broader authority/storage protocol where the existing private worker gate can express the missing bounded phase.

## File map and verification

- `src/execution/subscription-coding-worker-policy-v1.ts`: exact fixed wait request/ACK and one-shot protocol states; custody signal-state support only.
- `src/execution/subscription-coding-worker-preload-v1.ts`: optional fixed wait exchange and bounded phase clocks before SDK entry.
- `src/execution/subscription-coding-worker-v1.ts`: original-owned facade, wait ACK/deadline and OPENED timer coordination.
- `src/execution/subscription-coding-runtime-v1.ts`: request/await wait after worker-bound journal and before returning; retain existing closure race.
- `tests/execution-attempts/subscription-coding-worker-v1.test.ts`: genuine actual-body fake-clock regression and existing/new negative protocol controls.
- `tests/execution-attempts/subscription-coding-runtime-v1.test.ts`: actual runtime orchestration order/closure-race controls; repair only required typed physical-worker fixture shape.

Before production edits, preserve a genuine RED showing the actual existing parent/child startup mechanics expire while a valid owner operation is delayed beyond 10s. RED must not be a missing method/export or a duplicated test-only state machine. Exercise actual protocol, actual parent callbacks/openGate and actual fixed preload program/phase statements with explicit inert OS/clock ports. GREEN uses the same delayed owner scenario, then negative missing proof/ACK/OPENED, expiry, EOF, abort, identity, duplicate/replay and unchanged direct-path controls. Never launch sandbox probes, SDK, providers or live installation operations from these component tests.

Run only the two focused files and TypeScript no-emit, with original PID/argv/exit captures. Independent task review plus one whole-branch review; normal reviewed PR and exact clean-main stock build follow. Live qualification is a separate normal guarded operation after concrete Source/physical-custody conditions are reviewed. Current quarantined work is evidence, not a replay target.

## Limits

No model/profile/token/capacity/retry-budget change, lease extension, grant/role/credential change, migration, generated-code edit, old release patch, SQL repair, completion/termination replay, force cleanup or runtime-guard bypass. Preserve both older unresolved installations and all current failures. Startup and lifetime budgets above are fixed Source policy, not environment controls. Existing user Standing Owner Authorization covers this causally necessary scoped root fix and reviewed normal delivery; no unrelated future action is authorized.

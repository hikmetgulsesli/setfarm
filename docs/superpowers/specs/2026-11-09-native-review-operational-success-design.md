# Native review authority after an operational retry

## Actual failure

Source0005 run `48c0de95-e2d1-4bc5-8c03-935bb992f037` automatically retried an inconclusive Kimi implementation through MiniMax. Generation2 attempt `ATT_71aadf85-0f49-4a1d-8f51-bb6eb00ea0e1`, class `infrastructure_retry`, produced candidate `073bf7b43c238da92a7b75aefbe4c5fa32b81a3f`. Its owned application evidence passed 8/8, its completion was accepted with committed effects and released runtime, and Kimi supervisor returned pass with fresh 8/8 evidence.

VERIFY11 then failed before a worker with `V3_GITHUB_REVIEW_IMPLEMENTATION_AUTHORITY_MISSING`. The exact default review loader excludes `infrastructure_retry`. The existing canonical `readNativeOperationalSuccessAuthority` independently accepted this exact live successor in a read-only transaction (Node95175exit0/client closed). Causal proof: `5b2ffd663790ee90e59f8e01c297a98440bbbb38388559d776ecb009bdfdecdd` in the preceding smoke workspace. The original PR head was not retained by the error observation; do not invent a hidden subpredicate trace.

Earlier VERIFY9/10 had a separate dependency-copy disk-capacity refusal, followed by watchdog cleanup. That guard is correct and is outside this source fix. Do not alter its reserve, timers, ownership or runtime safety checks.

## Decision and limits

Integrate the existing canonical native operational-success reader into `loadDefaultImplementationAuthority` for a native infrastructure-retry candidate. Do not admit the class by an unconditional SQL `IN` expansion. The selected candidate must remain one unambiguous exact story/packet/head/tree/slice candidate, then pass the real canonical success factory: released predecessor and successor, inconclusive predecessor, generation/admission/custody lineage, accepted completion and actual output/evidence/story acceptance relations. Match the authenticated result back to the selected candidate. Refuse any missing, malformed, ambiguous or inconsistent authority.

Keep the direct product-implementation and supervisor-repair paths and historical PacketV1/V2 behavior. Preserve all existing exact packet, producer, index/CAS, slice-family, story identity, writable-path and evidence-plan guards. Use the existing factory unchanged unless a concrete incompatibility requires a separately reviewed amendment. Do not introduce new grants, recovery authority, schema families, runtime overrides, generated-project patches or special cases for this run/model/task.

This is a causal root fix for the existing goal: a legitimate successful automatic fallback must remain usable by downstream review while unaccepted or failed retries remain inadmissible.

## Verification and file map

| File | Responsibility |
| --- | --- |
| `src/findings/v3-github-review-router.ts` | Authenticate a native operational successor through the canonical success seam |
| `tests/findings/v3-github-review-native-authority.test.ts` | Actual default-loader regression using the real reader/index/filesystem CAS and real canonical success reader |
| Existing native operational fixture/helper only if necessary | Small reusable valid successor material; no live DB or test-framework expansion |

Reproduce genuine behavior RED before production edits: the actual default loader rejects a valid canonical native operational successor. A missing import or fixture error is not RED. The real success factory must run; do not stub a positive authority object. Keep direct/native/historical controls and prove failed or unaccepted retries, wrong lineage/head/slice and duplicate authority remain rejected. Use focused local tests and existing relevant router coverage; no whole matrix, isolation campaign, model call or browser run. Preserve RED/GREEN PID/exit/hash evidence for task and whole-branch review.

Root alone owns delivery, clean stock release build, normal canary retirement and guarded rollout. All accepted evidence and old installation history remain preserved. Full workflow and actionable-review routing are not qualified merely by a unit test or a started worker.

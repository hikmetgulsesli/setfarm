# Final supervisor compiler worktree handoff

The current real case completed implementation and story supervision (8/8 each), then native VERIFY12 merged the exact reviewed head and accepted its post-merge completion. Final SUPERVISE13 failed before evidence execution: its compiler completion had no resolved input, the spawner selected agent scratch, and its neutral runtime had no worktree. The exact completion lease correctly rejected this mismatch. Missing instruction provenance subsequently prevented a bounded native retry. Correcting this platform handoff is causally necessary to finish the same software-production objective.

## Decision

Bind the canonical integrated repository at initial publication of an authenticated v3 final-product supervisor runtime. Reuse the existing optional RuntimeClaimIntentV1.worktree and nominated runtime reservation INSERT. Return meaningful deterministic canonical JSON through the existing resolvedInput string, containing only the canonical repo and final-product compiler instruction/schema. The actual spawner JSON cwd reader and envelope builder then carry the same path and exact instruction into completion. No second cwd channel is needed.

The source is the current protected run context, not a stale story_workdir or caller-supplied path. Publication must compare the proposed worktree with locked runs.context after authenticating final_product and before any claim/runtime birth. Reject conflicting caller intent. Running reissue must reauthenticate current context/subject and exact existing binding; never backfill an old NULL or mismatched runtime. The final compiler instruction uses the same path that was reserved. Agent-owned final-supervisor fallback continues to use its normal final repository. Story supervision and unrelated compiler stages retain their current behavior.

## Alternatives considered

An additional compiler-workdir result field duplicates the existing JSON input contract and leaves missing instruction provenance unresolved. A post-publication worktree UPDATE adds an unnecessary mutation authority. Starting a fictitious worker or relaxing the completion worktree predicate would break the existing ownership contract. Initial binding plus canonical input is the smallest compatible correction.

## Required invariants

Reservation remains reserved with no worker PID/start/runtime path; no provider is acquired by compiler completion. Existing nominated owner/sidecar publication, subject admission, exact envelope/output hash, live owner attempt/lease, drained state and r.worktree equality remain enforced. Completion still validates final branch, clean audit and unchanged source. No schema, role, credential, guard, retry-budget, model, generated source or retained-run repair changes belong here. Adding exact instruction provenance does not fix generic retry authority.

## Verification and delivery

Add one focused integration fixture using the existing ephemeral Postgres harness and actual final-subject admission. Exercise real initial publication, returned compiler result, actual spawner cwd/envelope functions, completion request/drain/owner lifecycle and actual supervisor lease SQL. Peripheral Git/evidence effects may be bounded; successful lease rows must not be stubbed. RED must expose the existing NULL/scratch mismatch. GREEN must reach a bounded evidence sentinel with exact path/input equality and no started-worker fields. Cover stale/conflicting context and NULL/mismatched reissue, plus wrong-owner/expired-lease refusal without evidence effects. Use the same fixture rather than a broad new matrix.

Run the affected regression and adjacent existing publication/spawner/owned-supervisor checks once after the fix, then a clean build and independent task/whole-branch review. Root owns commits, normal PR delivery and any separately guarded rollout. Preserve the current failed case and all original records. A later fresh case must measure the delivered fix; local tests do not qualify the full workflow.

## Authorization

Continue under the user's explicit instruction to correct platform problems and finish Setfarm, the single-writer Standing Owner Authorization, and existing bounded delivery authority. No new destructive or privileged operation is introduced. Existing sole writer is reused. The independent design note and actual original RCA are retained privately under the preceding handoff evidence directory.

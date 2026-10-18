# Fresh completion finalization and successor admission

The first actual Codex convergence case on release `782340e1` completed its plan but failed before design could launch. The design reader correctly required an accepted planner completion. The predecessor was still processing with committed effects. Its finalizer also entered the legacy baseline bootstrap path outside its owner capability context.

This is a Setfarm lifecycle defect discovered while bringing the fresh system online. Fixing it is necessary for the existing full eight-case qualification; it adds no product feature or migration authority.

## Design

Keep the English, story and design authority readers strictly accepted-only. A completed business step is insufficient authority while its completion owner is still finalizing.

Retain the real completion owner capability across bootstrap selection and acceptance. In a captured fresh installation, require the existing compiled, prepared operational entry and return the ordinary finalization decision. The legacy bootstrap body and its authority checks remain intact. Preserve the legacy continuation's outer early return, cleanup and event behavior.

Before selecting a pending successor, exclude work with a known unsettled, successful, non-story single-step predecessor in the same run. Recheck readiness under the existing run-row lock before publishing a new claim or runtime. Preserve committed replay before the new-publication check. The barrier does not cover unrelated runs, current or later steps, or loop/story predecessor completions. Missing or corrupt authority continues to fail through existing readers.

Use one fixed SQL predicate shared by candidate selection and transaction-time readiness. It introduces no caller-selected authority, configurable bypass or new environment flag.

Quarantine also leaves a completed predecessor unaccepted. Keep it behind the same causal barrier until explicit resolution or run termination. Quarantine is not an active lease owner for process-exit retention; that separate three-state check and the existing recovery guards remain unchanged.

The same run exposed a third causal lifecycle defect: process-exit cleanup released a drained session while its completion request still owned finalization. Keep proving physical drain, then check the exact run/session/claim under the existing run-first transaction lock order. An active completion request retains session ownership and suppresses release/event/worktree cleanup. Ordinary acceptance performs release. Keep the recovery requirement for a drained session unchanged.

## Alternatives assessed

Allowing processing completions through authority readers would change the accepted-owner contract. Waiting a fixed duration would leave a scheduling race. A causal readiness barrier plus correct finalization preserves the contract and permits unrelated ready work to proceed.

## Verification and delivery

First record failing component and isolated PostgreSQL regressions. Cover fresh admission/refusal and unchanged legacy ownership, successor deferral without new claim/runtime/sequence effects, acceptance and replay, other ready runs, and loop/story boundaries. Run focused lifecycle tests, type and maintained contracts, independent review, and a clean stock build. Deliver on a reviewed PR branch. Preserve the original failed run and repeat the complete unchanged convergence suite on a release-bound fresh installation; no manual ledger repair or result promotion.

# Scoped completion routing implementation plan

**Goal:** Let accepted single supervise/verify completions with authenticated story-member scope reach their existing continuation handlers. Root owns delivery and qualification on a new release; the historical run is preserved.

**Observed cause:** Run f83a8e5f-997c-45b6-b51d-1403c36f612a has implementation and independent supervisor canonical PASS8/8, accepted effects-committed supervise request RCR_e7e5704a-ee21-4651-bf98-f4611b203d9e, but empty supervised_story_ids. The completion request legitimately carries story IDs. resumeRuntimeCompletionEffects treats those IDs as a loop discriminator, calls checkLoopContinuation on the single supervisor step and bypasses its existing marker/verify publication. The verify candidate SQL consequently returns no work before GitHub review handling. Private original diagnosis: root-fresh-plan-terminal-run1-verify-no-work-diagnosis-v1.json SHA2561b4695e8f3afd2af63213ac57d2c6f320902a79676ebefe0f5a15f431c7ecb97.

**Design:** Restrict the generic story branch to the actual persisted step.type === "loop" already loaded by the selected query. Story IDs remain authorization scope. Single supervise/verify continuations reach the existing handlers below that branch, retaining all protocol, authenticated subject, retry, source, review, defer and replay checks. Refusal handling remains before dispatch; story_qa_fix_merge remains inside true-loop handling. No context marker patch, current run repair, new gate, bypass or timing feature.

**File Map:**
- src/installer/step-ops.ts: one conditional in resumeRuntimeCompletionEffects; no new production API.
- tests/execution-attempts/runtime-completion-scoped-routing.test.ts: execute full actual resume and existing supervisor/verify declarations using established TypeScript AST/transpile unit seam, keeping SQL/Git/filesystem external ports inert. Assert supervisor marker and verify publication; verify existing exact target guard; true-loop, refusal and subject-mismatch controls.
- This plan.

**Execution (sole author; Root-approved bounded condition):**
1. Write behavioral regressions. The break caught is single scoped completion being swallowed by loop dispatch; expectations are literal publication/state/error results, not source regex or a mirrored predicate.
2. Capture genuine RED against03521 with PID/argv/time/raw stdout/stderr/exit under private0600 evidence.
3. Add step.type === "loop" to the generic story condition only.
4. Run focused file GREEN, tsc --noEmit, npm run check:migration-digests and git diff --check, preserving original captures. Recheck only after relevant changes.
5. Freeze exact File Map hashes/diff and hand off to Root and independent reviewer. No staging/commit/push/build, DB setup, model call, service action or generated-project edit.

**Commands:** node --import tsx --test tests/execution-attempts/runtime-completion-scoped-routing.test.ts; ./node_modules/.bin/tsc --noEmit; npm run check:migration-digests; git diff --check.

**Limits:** Inert component tests prove actual dispatch and publication placement, not PostgreSQL engine privileges, real GitHub merge/source acceptance, live runtime custody or end-to-end factory completion. Those remain Root rollout/run qualification. No isolated environment is introduced.

**Verified author result:** Genuine original RED PID2137 exit1 (two expected skipped-handler failures; three controls passed); GREEN PID2214 exit0 (5/5). NoEmit PID2286 exit0, semantic-digest check PID2288 exit0 (unchanged/current), diff-check PID2287 exit0. Captures root-scoped-completion-routing-{red-v2,green-v1,noemit-v1,digest-v1,diffcheck-v1}.{stdout,stderr,result.json} are private0600. The earlier red-v1 was a fixture parameter-order assertion error and is not qualifying RED. Production diff is one conditional only. Independent read-only review found no P0/P1. Adjacent QA-FIX producers remain inside actual loop completion; refusal precedes dispatch. No live qualification or current run repair claimed.

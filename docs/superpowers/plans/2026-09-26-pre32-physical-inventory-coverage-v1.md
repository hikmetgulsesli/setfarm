# Pre32 physical inventory coverage V1 plan

1. Preserve every dirty, historical, development and deployment worktree. Use one isolated branch from clean main; root is sole writer. Capture statuses and current host diagnostic before changing code.
2. RED: add fake-port V3/V7 fixtures proving every present root is accounted once, retained Git topology never becomes owner/nonowner, runtime/non-Git/PID/churn stays unresolved, original blockers survive, and nonzero active database rows or physical drift refuse.
3. GREEN: implement the smallest frozen, hash-bound diagnostic projection over directly produced V3 output. Verify nested source hashes and cold-zero shape; retain source by identity. Enroll in pure tests.
4. Add a separately selected source-authenticated no-write bootstrap verb with strict output validation and negative tests. Do not add a new DB query, owner count, zero-owner authority, admission or mutation.
5. Run proportional checks and independent read-only review. Deliver one PR, normal guarded clean-main build and authenticated no-write host observation. Preserve selected old build/CLI, services and every worktree.

This is a causal physical-inventory clarification for the same Task6A cutover objective. V7 cannot produce a positive owner. A later non-pre32 producer-authenticated receipt and continuous DB/OS writer fence remain separate requirements.

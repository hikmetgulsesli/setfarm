# Held Identity Drift Diagnostic V1 Plan

> Root remains the only writer/delivery owner. Other agents may inspect read-only. Preserve all existing worktrees, dirty files, runtime data, selected dist/CLI, and safety gates.

**Goal:** Identify the held filesystem object that makes live V2 physical observation fail closed, without changing its refusal semantics.

**Spec:** `docs/superpowers/specs/2026-09-24-held-identity-drift-diagnostic-v1-design.md`

## RED/GREEN

- [x] Add directory and incidental-file mutation fixtures asserting unchanged outer invalid error and exact frozen inner `{kind,root}` cause. Run focused RED.
- [x] Split the existing `assertStable` compound comparisons only enough to label descriptor versus pathname drift; keep every `same`/`sameFile` predicate and throw on the same mismatch. Run focused GREEN and stable fixture regression.
- [x] Run pure, cutover, TypeScript, contracts, `git diff --check`, and independent read-only code review. Fix any Important/Critical finding using RED/GREEN.
- [x] Add the newly observed status-1/nonobserver-PID root/PID cause fixture RED; preserve rejection and make it GREEN. Rerun focused, pure/cutover, TypeScript, contracts, diff check, and read-only re-review before updating PR head.

## Delivery and host diagnosis

- [ ] Commit, push, open PR, inspect GitGuardian and exact-head cloud review, SHA-bound squash merge without deleting worktrees.
- [ ] Fast-forward independent clean-main deployment clone, normal build; fast-forward selected source while verifying historical dist/CLI identity. Run one built V3 probe from canonical workspace root. If it still refuses, report exact structured cause and classify that path before any further change. Keep all blockers and safety gates intact.

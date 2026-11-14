# MiniMax PLAN Output Capacity Implementation Plan

Root is the sole source writer and delivery owner. Independent agents review
the task and final diff; operational authors prepare private effects for Root.

**Goal:** Let genuine MiniMax PLAN reports complete within the existing total
attempt budget after two original reports exhausted the current per-call cap.

**Spec:** `docs/superpowers/specs/2026-11-14-minimax-plan-output-capacity-design.md`

## File Map

- `src/execution/subscription-coding-policy-v1.ts`: own a fixed model/profile
  allocation selector; use it for emitted SDK model `maxTokens`.
- `src/execution/subscription-coding-runtime-v1.ts`: pass the same selected
  limits into actual broker acquisition.
- `tests/execution-attempts/subscription-coding-policy-v1.test.ts`: observe
  emitted PLAN capacity, unchanged defaults and real worker reconstruction;
  refuse forged default material that claims the higher capacity.
- `tests/execution-attempts/subscription-coding-runtime-v1.test.ts`: observe
  matching broker/worker capacity and all unchanged remaining limits.

## Steps

1. Change the existing regression expectations first. Capture failures proving
   the actual SDK output and broker acquisition still use 8192 for PLAN.
2. Implement only the shared fixed selector and its two consumers. Keep the
   authenticated facade, broker accounting and strict decoder unchanged.
3. Run focused policy/runtime/worker/decoder regressions and TypeScript checks.
   Obtain independent task and whole-diff reviews; resolve actual findings.
4. Commit and push the scoped branch, obtain exact-head GitHub review and use
   normal protected merge. Build clean main without guard bypasses.
5. If the old native run remains PLAN-only with infrastructure retries, stop it
   through the normal fresh snapshot fence, retaining original evidence. Use
   the maintained guarded release transition and start one clean playable case.

No extra retry, timeout, aggregate, provider-probe, generated-project rescue or
manual database repair is authorized by this change. Report native outcomes
separately from source/build verification.

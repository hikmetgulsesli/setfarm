# Kimi Thinking Default Implementation Plan

> **For agentic workers:** Use subagent-driven-development for the bounded implementation and independent review. Root owns delivery.

**Goal:** Stop sending disabled thinking from Kimi coding workers, so normal supervisor and implementation requests can reach K3.1 Pro.

**Architecture:** Add one model-specific default in the existing coding-material builder. Keep argv, broker serialization and worker reconstruction unchanged.

**Tech Stack:** TypeScript, Node test runner, OpenClaw 2026.5.20 / pi-ai 0.75.4.

**Spec:** `docs/superpowers/specs/2026-11-08-kimi-thinking-default-design.md`

## Global Constraints

- One writer: existing controller worktree, branch `fix/kimi-thinking-default-20261108`, base `6f3cf4ba6ee6cfba0f4244fed4d454a5c2682a4f`.
- Keep existing 8192 per-request tokens, all request/byte/time ceilings, model identity, credentials and guards.
- MiniMax and the readonly launch control keep their existing behavior.
- No generated edits, direct main commit, extra provider calls or manual workflow completion.

## Task 1: Emit a supported Kimi thinking default

**File Map:**
- Modify `src/execution/subscription-coding-policy-v1.ts`: derive the Kimi coding default.
- Modify `tests/execution-attempts/subscription-coding-policy-v1.test.ts`: exercise material output, provider separation and genuine reconstruction/tamper refusal.
- Modify the existing worker test only if an actual reconstruction assertion requires coverage there; do not duplicate it.

**Interface:** `buildSubscriptionCodingMaterialV1(input)` continues to return the same material schema, argv and profile. Only the generated Kimi coding config gains `agents.defaults.thinkingDefault = 'low'`.

- [ ] Add a regression using the real builder and literal expected `low`. Assert MiniMax and readonly controls remain absent, genuine Kimi material reconstructs, and changing the default to `off` is refused by the existing material validator.
- [ ] Run the focused test before production edits and preserve its original failing result. A failure must identify the missing Kimi enabled default, rather than import/setup errors.
- [ ] After config parsing, implement only:

```typescript
if (base.identity.modelRef === 'kimi/k3.1-pro') config.agents.defaults.thinkingDefault = 'low';
```

- [ ] Run affected policy/worker tests and TypeScript checks. Review the exact whole diff independently. Root commits only after evidence is green, then runs the clean stock build.
- [ ] Root pushes the scoped branch, reads PR reviews, integrates through normal protected delivery, and qualifies rollout through existing gates. Preserve current run results and report live qualification separately.

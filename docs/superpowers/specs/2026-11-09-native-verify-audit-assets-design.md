# Native verifier audit assets

Live Source53 run `ba6feffd-4578-4801-ac72-4004dbab8709` produced accepted application evidence (9/9) and an accepted supervisor pass. VERIFY's first claim correctly deferred for the existing PR review window. The next claim18 was quarantined before any physical worker was bound. Its reviewer worktree had top-level `references` and `node_modules` symlinks. Read-only invocation of the delivered strict coding-worktree inspector deterministically rejects this material. The original catch did not retain its exact internal throw; this is a reproduced pre-launch blocker, not an invented original stack trace.

`injectVerifyContext` currently calls `ensureStoryAuditWorkdir` without an asset mode. Supervision already uses the existing `native-audit` representation, which prepares owned copies and validates their custody instead of accepting external aliases. The fix belongs at VERIFY selection, not in the worker inspector.

## Design

Keep `injectVerifyContext` and all callers' signatures unchanged. When a DB-selected story has a branch, read the actual run protocol for `step.run_id`. For protocol `v3` only, call the existing captured-and-asserted `readSelectedFreshExecutionProfileV1()`. Choose the existing `native-audit` mode only for the closed subscription provider pair `kimi` or `minimax`, and pass it to `ensureStoryAuditWorkdir`. Missing/non-subscription profiles and legacy protocols retain their existing behavior. Profile/custody refusal must propagate; it must not silently downgrade to legacy aliases.

Native assets must be selected during the first injection, including before a PR review deferral. A later injection on the same branch uses the existing preferred-path/idempotent native preparation. Do not mutate the old quarantined worktree or repair its runtime record.

Alternatives rejected: permitting top-level symlinks would weaken the existing worker guard; changing all legacy audit paths would unnecessarily broaden the behavioral change. Use the already-supported native asset path only where the actual DB protocol and captured subscription profile require it.

## Constraints and acceptance

- Preserve strict worktree inspection, .bin-link rules, native asset custody and all runtime/material guards.
- Use the actual DB run protocol and existing selected profile; no context flags or mutable environment booleans confer this choice.
- Preserve legacy/Codex asset behavior, 300-second PR review timing, output/evidence contracts, roles, credentials, provider policies and every timeout/token/retry budget.
- Real VERIFY injection must prepare a copied native worktree that passes the actual strict inspector. Same-context re-entry must retain valid copied assets.
- Legacy DB protocol with spoofed V3 context and V3 Codex/non-subscription profiles must retain legacy behavior. Captured profile/custody drift must fail closed without replacing material.
- No generated-project edits, old run/claim replay, database mutation or service action is part of implementation. Root separately delivers a reviewed clean build and measures a clean run.

Evidence: `.superpowers/sdd/2026-11-04-subscription-operational-integration/root-worker-owner-admission-20261109-clean2-verify18-firstcause-v1.json`, SHA `008c87d97c645c990c278970d7f4173e1ba7b82b4941dee3a59c84b96b3c0cf0` (private local evidence, never commit).

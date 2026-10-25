# Subscription model defaults

The owner approved continuing Setfarm with the existing MiniMax subscription
and Kimi Coding Plan. Actual protocol trials on 2026-10-25 passed tool use,
tool result continuation and final output for `MiniMax-M3.1-Flash` and
`k3.1-pro`. The account catalog describes `kimi-for-coding` as K2.8 Preview;
it does not attest that alias to K3.1 Pro. Use explicit model identities.

## Deliverable

For ordinary OpenClaw-backed installations, new platform model defaults are
`minimax/MiniMax-M3.1-Flash`, followed by `kimi/k3.1-pro`. Use the configured
provider IDs `minimax` and `kimi`. Correct the legacy story fallback, which
currently dispatches an unconfigured `kimi-coding` provider. Remove the dead
polling model constant; cron payloads continue to inherit agent configuration.

Reinstalling a workflow must preserve an explicit workflow model and an existing
custom model. This is a necessary root fix: adopting new platform defaults must
not erase user choices. An existing `default: true` main agent stays untouched.
Only an exact known old platform preset is eligible for automatic migration:

- Scalar `minimax/MiniMax-M3` or `minimax-openai/MiniMax-M3`.
- An object with exactly `primary` and `fallbacks`, an old primary from the
  preceding list, and exactly one fallback `kimi/kimi-for-coding` or
  `kimi-coding/kimi-for-coding`.

New defaults have fresh fallback arrays. Custom values, including objects with
extra metadata or altered fallback order, remain unchanged. An explicit workflow
scalar wins byte for byte, including an intentional old model name. Preserving
an override is data compatibility, not permission to call a paid provider.

Migrate ordinary V3 primary/fallback identities together. Keep strict schema,
hash binding, one-retry budget and exact equality. Old serialized directives and
receipts remain historical; use clean new runs, never rewrite old hashes.
Add a separately identified eight-case MiniMax M3.1 Flash convergence suite,
preserving task text, oracles, case IDs and limits. Keep the original suite and
the selected Codex suite unchanged.

## Global Constraints

- Use only the existing subscription accounts; no PAYG, credential rotation,
  purchase, topup or implicit paid fallback.
- This change is source preparation, not a live model activation.
- Preserve selected fresh-installation Codex identity, runtime guards, fallback
  refusal and exact argv. The live selected installation remains Codex until a
  separately verified private subscription runtime adapter and guarded transition.
- Do not change live configuration, catalogs, credentials, services or database.
- Do not change Kimi CLI or OpenCode defaults without adapter qualification;
  the direct provider trial did not qualify those worker routes.
- Preserve explicit YAML/environment overrides, unrelated settings, history and
  all technical tools. No blanket reinstall or generated artifact edits.
- Work only in the existing sole writer. Workers do not stage, commit, push,
  merge, deploy or spawn other workers. Root owns delivery.
- Build only on clean committed source; no dirty-build or runtime-guard bypass.

## File Map

- `src/installer/agent-model-policy.ts`: pure default/preset selection; no I/O.
- `src/installer/install.ts`: consume that policy during existing agent upsert.
- `src/installer/constants.ts`: actual canonical legacy story fallback.
- `src/installer/agent-cron.ts`: remove unused model constant only.
- `src/execution/operational-retry-directive.ts`: ordinary primary/fallback IDs.
- `workflows/daily-standup/workflow.yml`, `workflows/ui-refactor/workflow.yml`:
  current bundled model defaults; do not recreate retired feature-dev sources.
- `evals/suites/product-convergence-minimax-m31-flash-v1.json`: new suite identity.
- Focused installer, retry, handoff, selected profile and suite tests: prove real
  model selection, preservation, hash/refusal behavior and suite compatibility.

## Activation remains a separate boundary

The selected I5 services run `SETFARM_AGENT_RUNTIME=codex` with
`SETFARM_CODEX_MODEL=gpt-6.1-sol`. Shared OpenClaw catalog entries for the new
models are absent. A source default edit does not change either fact. A complete
activation requires a source-owned private worker adapter, exact model/auth
binding, thinking/tool continuation, fail-closed quota handling, current source
and material admission, ownership closure and guarded service transition.
Changing source invalidates reuse of the old source-bound release proofs.
No manual JSON patch, hand-authored cutover intent or relaxed runtime guard is
an acceptable substitute.

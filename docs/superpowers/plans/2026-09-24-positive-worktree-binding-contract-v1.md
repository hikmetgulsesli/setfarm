# Positive worktree binding contract V1 plan

Root is the sole writer. Read-only agents may independently review. This is a causal prerequisite of the approved physical-plus-PostgreSQL owner contract, not cutover authority.

1. Write literal fixture tests for one matching attempt/session/physical/receipt tuple and a diagnostic-only frozen result. Run RED: missing source must fail.
2. Implement the minimal pure exact-shape parser, V2 physical identity hash comparison, canonical receipt/projection hashes, and active-state checks. Run focused GREEN.
3. Add adversarial cases for path-only/null, crossed IDs/fence/generation, moved inode/birthtime/primary, changed source/tree, wrong hash, extra/accessor/proxy input, inactive rows, and post-return mutation. Run focused tests and the default pure suite.
4. Run TypeScript, source/path contracts, diff check, independent read-only review, then conventional commit, scoped PR, exact-head checks/review, SHA-bound merge and normal independent clean-main build.
5. Host check may read service/DB/catalog health only. Do not publish sidecars, change V1/V2 guards, alter selected CLI/dist, or claim a positive owner from this leaf. Preserve every existing worktree and dirty file.

File map: the source, test, `package.json`, this plan and its paired spec only. A future integration PR needs its own design and review; no pre-32 publication is authorized here.

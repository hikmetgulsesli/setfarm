# Pure positive worktree receipt candidate implementation

## Causal scope

PR #178 emits receipt-required physical/row candidates, but a future producer has no single code-owned canonical receipt constructor. This pure contract prevents divergent fence/identity/source bytes while explicitly withholding producer authentication. It does not solve durable publication or cutover.

## Steps

1. [x] Confirm clean isolated branch at reviewed main `a1de9469`, current comparator contract and unchanged runtime/DB behavior.
2. [x] Write RED exact wire, comparator round-trip, mismatch, input-shape and no-raw-fence tests. RED was the missing export after `npm ci` restored this isolated tree's dependencies.
3. [x] Implement pure constructor with unverified diagnostic wrapper; no producer or guard wiring.
4. [ ] Run focused/pure/contract checks and independent read-only review; commit/push reviewed PR, resolve findings.
5. [ ] Fast-forward preserved clean-main deployment clone and normal guarded build, verify selected historical dist/link unchanged. No live receipt or ownership claim.

## File Map

See the design's bounded File Map. Real post32 producer publication, no-replace journal, crash recovery, pre-spawn recheck, reader reauthentication, continuous exclusion and versioned cutover guard remain separate.

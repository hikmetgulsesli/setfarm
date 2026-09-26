# Pure positive worktree receipt candidate wire

The held physical/row join now names receipt-required runtime candidates, and the existing binding comparator rejects path-only, stale and crossed receipts. No code-owned constructor currently defines the exact canonical receipt bytes from attempt, session and physical inputs. Duplicating that construction at a future producer seam risks a fence/source/identity mismatch or a raw fence-token leak.

Add a pure `derivePositiveWorktreeBindingReceiptCandidateV1` next to the existing comparator. It accepts exactly `{ attempt, session, physical }`, uses the existing strict parsers, derives the domain-separated fence and physical identity commitments, builds the existing V1 receipt body/hash, and round-trips it through `projectPositiveWorktreeBindingCandidateV1` before returning. The outer frozen wrapper is a separate `receipt-candidate.v1` with literal `diagnostic-only`, `physicalIdentityProvenance:unverified`, `producerAuthentication:unverified` and `receiptStatus:required-unpublished`. It contains only the receipt and a canonical candidate hash, never the raw fence token. A self-consistent candidate is not producer-authenticated and grants no owner, admission or cutover authority.

RED tests fix exact field/hash bytes and comparator round-trip; reject mismatched run/claim/attempt/root, inactive state, invalid ID, noncanonical path and exotic/extra input; verify every generation/fence/source/physical/owner change either changes the commitment or refuses and no raw fence appears in serialized output. GREEN uses the existing pure suite, TypeScript and source contracts. No I/O, DB table, migration, sidecar, runtime writer, bootstrap verb, guard, selected artifact or live service changes are permitted in this slice.

## File Map

- `src/internal-production/baseline-positive-worktree-binding-contract-v1.ts`: pure strict constructor and diagnostic wrapper.
- `tests/internal-production/baseline-positive-worktree-binding-contract-v1.test.ts`: RED/GREEN exact candidate and negative cases.
- `docs/superpowers/plans/2026-09-26-positive-receipt-candidate.md`: implementation/verification record.

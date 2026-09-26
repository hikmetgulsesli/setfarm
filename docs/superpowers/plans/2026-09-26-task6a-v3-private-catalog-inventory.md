# Task6A V3 private catalog inventory plan

1. Keep the isolated branch on clean main `5a33a8dd`; preserve every prior
   worktree and selected build. Do not run the live role/grant rehearsal.
2. Write RED tests for strict fixed SQL, exact selected row classes, canonical
   ordering/duplicates, malformed ACL/membership data, row/byte limits,
   private-detail redaction, transaction/driver error sanitization and close.
3. Implement only the import-inert private DB projector and bounded read-only
   adapter. No bootstrap, live mutation, admission or permission-proof claim.
4. Run focused, pure, TypeScript, migration/source contracts and independent
   read-only review; fix Important findings with a failing test first.
5. Deliver a scoped reviewed PR, exact-head merge, preserved clean-main build
   and no-write host diagnostic for regression only. The new V3 inventory has
   no authenticated host verb until a separate follow-up PR.

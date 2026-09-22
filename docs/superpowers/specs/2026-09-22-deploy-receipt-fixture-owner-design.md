# V3 deploy receipt fixture P3 owner binding

The clean-main `test:execution-attempts` run reaches `v3-deploy-receipt-repository.test.ts` and fails because its shared seed inserts a `claim_log` row directly. Current P3 terminal close requires an authenticated, bound claim-owner reservation. Production single-step claim publication already creates that reservation and binds it in the claim-birth transaction; the test fixture predates the requirement. The runner also classifies this file as a raw test, so the isolated database lacks the producer-manifest activation required by the canonical claim-birth path.

Change the shared test seed and classify the file as owner-backed in the execution-attempt test runner. Allocate the claim ID as canonical BIGINT text with `nextval(pg_get_serial_sequence('claim_log','id'))`; call `prepareInternalProductionClaimBirthV1` for `a-claim-single-runtime-v1`; then call `insertAndBindInternalProductionClaimBirthV1` with the existing deploy run, step, agent and claimed time in the same transaction. Preserve the returned numeric claim ID and every test assertion. Do not create a sidecar with ad-hoc SQL or relax `resolveUniqueP3OwnerSidecarV1`.

The five existing tests are the RED gate. They must pass on the corrected seed, including atomic outbox-conflict rollback. Run the file with the isolated-test database mechanism, relevant claim/runtime tests and static contracts. This is test-only and changes no production or live database state.

## File map

- `tests/execution-attempts/v3-deploy-receipt-repository.test.ts`: replace one obsolete direct-SQL claim birth in the shared fixture.
- `scripts/run-execution-attempt-tests.ts`: route this test through the existing P3 owner-backed projection and activated database template.
- No production source, schema, runtime configuration, or generated artifact changes.

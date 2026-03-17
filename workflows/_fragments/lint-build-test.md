Lint: {{lint_cmd}}
Fix ALL lint errors until lint passes clean.

Build: {{build_cmd}}
Fix ALL build/type errors until build passes.

Test: {{test_cmd}}
Fix ALL failing tests until tests pass.

DB SCHEMA SYNC (CRITICAL — if project uses Prisma/ORM):
- After ALL schema changes, ALWAYS run: npx prisma db push (or prisma migrate dev)
- NEVER leave schema.prisma out of sync with the actual database
- If tests fail with column does not exist or relation does not exist → run prisma db push FIRST
- Before marking setup-build as done: verify schema is synced by running prisma db push

TEST ISOLATION RULES:
- NEVER use unscoped deleteMany({}) in test setup/teardown — it deletes other test suites' data
- Always scope cleanup to test-specific data (filter by email pattern, name prefix, etc.)
- If using Prisma in tests, do NOT call prisma.() in afterAll — the shared singleton should stay open
- If test environment lacks Node.js globals (setImmediate, etc.), add polyfills in jest.setup.ts/vitest.setup.ts
- If tests are flaky due to parallel DB access, use --runInBand flag

STEP 1 — Checkout and read PR reviews:
1. cd into {{repo}}
2. git fetch origin
3. git checkout {{story_branch}} && git pull origin {{story_branch}}
4. Get PR number and read review comments:
   PR_NUM=$(gh pr view "{{pr_url}}" --json number --jq '.number' 2>/dev/null || echo "")
   REVIEWS=$(gh pr view "{{pr_url}}" --json reviews --jq '.reviews[].body' 2>/dev/null || echo "")
   COMMENTS=$(gh pr view "{{pr_url}}" --json comments --jq '.comments[].body' 2>/dev/null || echo "")
   if [ -n "$PR_NUM" ]; then
     REPO_SLUG=$(gh pr view "{{pr_url}}" --json url --jq '.url' | sed 's|https://github.com/||;s|/pull/.*||')
     REVIEW_COMMENTS=$(gh api "repos/$REPO_SLUG/pulls/$PR_NUM/comments" --jq '.[].body' 2>/dev/null || echo "")
   fi
5. If external reviews exist → read them and proceed to STEP 2
   If NO reviews exist → skip to STEP 3 (do your own quality review instead)
   Do NOT retry waiting for reviews — you already waited 5 minutes. Proceed with your own judgment.

STEP 2 — Fix review issues (only if external reviews exist):
1. Read ALL review suggestions and comments carefully
2. If reviews mention issues or suggestions → fix ALL of them
3. Run lint: {{lint_cmd}} → fix any lint errors
4. Run build: {{build_cmd}} → fix any build errors
5. Run test: {{test_cmd}} → fix any test failures
   - If the project uses Vitest, use `npm run test:run` or `npx vitest run`.
   - Never run bare `vitest` or `npm test` when `npm test` maps to `vitest`; that starts watch mode and blocks the verifier.
6. If fixes were needed:
   git add -A && git commit -m "fix: address review comments for {{current_story_id}}"
   git push

STEP 4 — STITCH SCREEN COVERAGE AUDIT (MANDATORY for final story or US-xxx where xxx is last):
1. Read stitch/DESIGN_MANIFEST.json (or stitch/UI_CONTRACT.json)
2. List ALL designed screens
3. For EACH screen, verify a corresponding page/route exists in the codebase:
   - find app/ -name 'page.tsx' | sort
4. If any screen has NO matching page:
   - Report it as ISSUES in STATUS: retry
   - List: 'Missing page for Stitch screen: <screenTitle>'
5. This ensures 100% design-to-code coverage

STEP 5 — DB SCHEMA VERIFICATION (if project uses database):
1. Check if prisma/schema.prisma exists
2. If yes, run: npx prisma db push --accept-data-loss 2>&1
3. If schema drift is detected and fixed, report it
4. Run tests again after schema sync to confirm

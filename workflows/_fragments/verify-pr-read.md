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
6. If fixes were needed:
   git add -A && git commit -m "fix: address review comments for {{current_story_id}}"
   git push

STEP 4 — Rebase onto latest feature branch (prevents merge conflicts):
1. git fetch origin
2. git rebase origin/{{branch}}
3. If rebase conflicts occur:
   - Read each conflicted file carefully
   - Resolve conflicts preserving BOTH the existing feature-branch code AND this story's changes
   - git add <resolved files> && git rebase --continue
   - If conflict is unresolvable: git rebase --abort and proceed to merge anyway
4. Run lint: {{lint_cmd}} → fix errors
5. Run build: {{build_cmd}} → fix errors
6. Run test: {{test_cmd}} → fix failures
7. git push --force-with-lease

STEP 5 — Merge PR:
1. gh pr comment "{{pr_url}}" --body "Verified: lint/build/test pass. Code quality checked."
2. Merge with fallback:
   gh pr merge "{{pr_url}}" --squash --delete-branch || {
     echo "Merge failed — retrying after rebase"
     git fetch origin && git rebase origin/{{branch}}
     git push --force-with-lease
     gh pr merge "{{pr_url}}" --squash --delete-branch
   }
3. Reply STATUS: done

If build/test FAILS and you cannot fix:
Reply STATUS: retry with issues list.

ESCALATION MODE (retry count >= 3):
If this story has been retried 3+ times, DO NOT send back to developer.
Instead:
1. Read ALL previous error output and verify feedback
2. Fix the code YOURSELF — you have full access to the repo
3. Run lint+build+test
4. If you fix it → commit, push, merge PR → STATUS: done
5. If you truly cannot fix it → STATUS: skip (story will be skipped, others continue)

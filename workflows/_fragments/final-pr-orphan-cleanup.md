Create final PR to main AND merge:
1. Create PR:
   FINAL_PR=$(gh pr create --base main --head {{branch}} --title "feat({{branch}}): {{task}}" --body "Feature branch {{branch}} — all stories implemented and tested.")
   if [ -z "$FINAL_PR" ]; then
     echo "FATAL: Could not create final PR to main"
     echo "STATUS: retry"
     exit 1
   fi
   echo "Created final PR: $FINAL_PR"
2. Merge:
   gh pr merge "$FINAL_PR" --squash --delete-branch
   if [ $? -ne 0 ]; then
     echo "FATAL: Could not merge final PR to main: $FINAL_PR"
     echo "STATUS: retry"
     exit 1
   fi
3. Close orphan PRs:
   OPEN_PRS=$(gh pr list --base {{branch}} --state open --json number -q '.[].number')
   for pr_num in $OPEN_PRS; do gh pr close "$pr_num" --delete-branch 2>/dev/null || true; done

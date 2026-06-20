# post_merge_quality_regression Failure Memory

## Diagnosis
- A downstream gate can fail after a story PR is already merged.

## Preferred Repair
- Retry on current main with the original story ownership.
- Expand scope from downstream evidence when the reported files are outside the original story scope.
- Do not reopen or recode the already merged branch.


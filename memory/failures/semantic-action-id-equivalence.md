# semantic_action_id_equivalence Failure Memory

## Diagnosis
- A guard may see a removed literal `data-action-id` string after a security or rendering refactor.
- This is only a regression if the observable action ID contract is actually gone.

## Preferred Repair
- Product worker should preserve action IDs through the stack-native rendering mechanism.
- Platform detector should recognize mechanically equivalent action ID creation before consuming story retries.


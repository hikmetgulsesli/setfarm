# react-native-expo Memory

## Behavior
- Native/mobile projects need stack-specific simulator or Expo evidence; browser smoke is not enough.
- UI repair should respect platform navigation and touch targets.

## Recovery Recipes
- `native_tooling_infra_failure`: Retry or preflight Expo/simulator tooling without consuming product retry budget when mechanically confirmed.

## Do Not Do
- Do not inject web-only DOM, CSS, or Playwright assumptions as product requirements.


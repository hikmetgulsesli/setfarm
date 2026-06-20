# static-html-site Memory

## Behavior
- A static HTML project may have no package build. `BUILD_CMD=true` can be valid when the entry HTML exists.
- DOM behavior often lives in inline scripts or plain JS assets.
- Dynamic content should prefer `createElement`, `appendChild`, and `textContent`.

## Recovery Recipes
- `xss_inner_html`: Replace dynamic `innerHTML` string construction with DOM APIs. Preserve action IDs, ARIA attributes, roles, and visible labels.
- `semantic_action_id_equivalence`: DOM `setAttribute("data-action-id", prefix + id)` can preserve the same observable action contract as a removed literal HTML string when mechanically proven.

## Supervisor Handoff
- Missing icons, missing handlers, and visible DOM gaps are product repair findings unless they block startup or final security.

## Do Not Do
- Do not force npm/Vite/React setup into a static HTML project.
- Do not turn one generated file name, icon name, or app name into a stack rule.


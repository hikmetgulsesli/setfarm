# vite-react-web-app Memory

## Behavior
- Vite app shell and router files must preserve previously accepted generated screen branches.
- `index.html` is setup-owned unless explicitly scoped.
- Missing icon imports or mismatched visual icons are repairable UI fidelity findings, not setup-build failures.

## Recovery Recipes
- `generated_screen_regression`: Preserve prior reachable route/render branches while adding the current story.
- `missing_icon_asset`: Supervisor should ask the worker to choose an available equivalent from the current icon system or install/request the missing dependency through setup-build if truly required.

## Do Not Do
- Do not apply browser-game runtime assumptions to ordinary Vite tools or dashboards.


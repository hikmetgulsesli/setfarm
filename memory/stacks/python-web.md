# python-web Memory

## Behavior
- Treat Python web projects as server contracts: route registration, templates/API responses, validation, persistence, and runtime startup.
- Browser smoke is valid only when the stack contract exposes an HTTP app surface.

## Recovery Recipes
- If the app cannot start, setup-build/supervisor should repair framework entrypoint, dependencies, or environment configuration.
- If a route returns wrong behavior, implement/supervisor should repair the route/view/service in owned feature files.

## Do Not Do
- Do not apply React/Vite-specific build assumptions to Python web projects.
- Do not make one framework convention global across Flask, FastAPI, Django, or other Python servers.

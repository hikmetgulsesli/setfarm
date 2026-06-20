# node-express-api Memory

## Behavior
- Treat API projects as server/runtime contracts first: routes, request validation, response shape, status codes, persistence boundaries, and tests.
- Build/setup failures should stay in setup-build only when the server cannot install, start, or compile.
- Product failures belong to implement/supervisor when an endpoint exists but returns wrong data, lacks validation, or misses required behavior.

## Recovery Recipes
- If a route handler is missing, add the smallest route/controller/service wiring inside owned files and cover request/response evidence.
- If validation fails, prefer schema or explicit input checks near the route boundary.
- If persistence is required, keep DB/client setup stack-owned and keep product entity behavior in feature-owned modules.

## Do Not Do
- Do not add browser smoke rules to a backend-only project.
- Do not turn one endpoint name or file layout into a global rule.

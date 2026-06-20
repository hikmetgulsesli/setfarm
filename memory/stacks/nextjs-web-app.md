# nextjs-web-app Memory

## Behavior
- File-system routes and app/page boundaries are the source of routing truth.
- Server/client component boundaries must be preserved; browser-only code belongs in client components.
- Build failures from framework routing or server/client misuse are stack-specific implementation findings.

## Recovery Recipes
- `route_missing`: Add or repair the appropriate route file instead of inventing client-side navigation only.
- `client_boundary`: Move interactive hooks and browser APIs behind an explicit client component.

## Do Not Do
- Do not treat a coherent Next.js repo as a generic Vite SPA.


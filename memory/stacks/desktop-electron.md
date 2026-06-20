# desktop-electron Memory

## Behavior
- Treat Electron projects as split contracts: main process, preload bridge, renderer UI, packaging/build, and desktop runtime smoke.
- Renderer UI rules can resemble web stacks, but preload/main security boundaries are stack-specific.

## Recovery Recipes
- If IPC/preload wiring fails, repair the smallest bridge contract and keep unsafe Node exposure out of renderer code.
- If renderer UI behavior fails, route it as product repair unless packaging/runtime startup is broken.

## Do Not Do
- Do not treat Electron as plain Vite browser runtime when main/preload files are involved.
- Do not make desktop packaging failures look like product UI failures.

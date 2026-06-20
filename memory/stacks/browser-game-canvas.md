# browser-game-canvas Memory

## Behavior
- The first viewport must be a playable game surface, not a dashboard or marketing page.
- Runtime state, input, scoring, pause/restart, and visible motion are core evidence.
- Canvas/game-loop failures are product repair findings before run failure unless the app cannot start.

## Recovery Recipes
- `game_runtime_static`: Connect visible entities to runtime state and request browser evidence that motion/input changes the rendered scene.
- `settings_surface`: Settings should remain tied to gameplay state and return to the playable surface.

## Do Not Do
- Do not apply generic SaaS dashboard layout assumptions to browser games.


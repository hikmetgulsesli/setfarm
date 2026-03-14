# Web Game Development Guide

Reference for canvas-based web game projects. Based on OpenAI's develop-web-game skill.

## Architecture Requirements

### Single Canvas
- Prefer a single `<canvas>` centered in the window
- Draw the background ON the canvas, not via CSS background
- Keep on-screen text minimal; show controls on start/menu screen, not during play

### State Exposure (MANDATORY)
Expose `window.render_game_to_text()` — returns JSON string of current game state.
This is required for automated smoke testing (Phase 15).

```js
function renderGameToText() {
  return JSON.stringify({
    mode: gameState,           // 'menu' | 'playing' | 'paused' | 'gameover'
    player: { x: player.x, y: player.y, vy: player.velocityY },
    entities: obstacles.map(o => ({ x: o.x, y: o.y, w: o.width, h: o.height })),
    score: score,
    isGrounded: player.isGrounded
  });
}
window.render_game_to_text = renderGameToText;
```

Include: game mode, player position/velocity, active obstacles/enemies, score, grounded state.
Exclude: full history, internal timers, rendering state.

### Deterministic Time Stepping (MANDATORY)
Expose `window.advanceTime(ms)` so automated tests can step frames without wall-clock timing.

```js
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i++) update(1 / 60);
  render();
};
```

### Game Loop Pattern
```js
let lastTime = 0;
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // cap at 50ms
  lastTime = timestamp;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
```

### Input Handling
```js
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// In update():
if (keys['Space'] || keys['ArrowUp']) jump();
if (keys['ArrowDown']) duck();
```

### Physics
All movement MUST scale by delta-time:
```js
player.velocityY += GRAVITY * dt;
player.y += player.velocityY * dt;
obstacle.x -= gameSpeed * dt;
bgLayer.x -= bgLayer.speed * dt;
```

### Fullscreen
- `f` key toggles fullscreen on/off
- `Esc` exits fullscreen
- Resize canvas on toggle

## Common Pitfalls

1. **Dual state tracking** — using both a string variable AND a StateMachine class, where one never gets updated
2. **Math.random() in render** — generates different values every frame, causing flicker
3. **Missing function definitions** — restartGame() calls startGame() which doesn't exist
4. **Frame-rate dependent physics** — gravity/velocity applied per-frame without dt scaling
5. **Event listeners on wrong target** — addEventListener on canvas instead of window
6. **No clearRect** — drawing over previous frame without clearing

## Test Checklist (for verify/smoke)

- Space/ArrowUp causes visible player movement within 100ms
- Score increments over time during gameplay
- Collision with obstacle triggers game over state
- Restart button returns to playable state
- Menu → Play → GameOver → Restart flow works end-to-end
- No JS console errors during gameplay
- Background doesn't flicker
- Game responds to keyboard input, not just mouse

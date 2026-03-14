CANVAS / GAME PROJECT RULES (MANDATORY for any project with <canvas> or game mechanics):

Detect: If TASK or PRD contains "game", "oyun", "canvas", "endless runner", "platformer",
"arcade", "puzzle game", "shooter", or similar → apply ALL rules below.

1. SINGLE STATE MACHINE — use ONE state tracking mechanism:
   - Either a string variable (`let gameState = 'menu'`) OR a StateMachine class — NEVER both
   - If you use a StateMachine, ALL code must check `stateMachine.is(STATE)` — never the raw string
   - If you use a string variable, ALL code must check that same variable — never a separate object
   - VIOLATION: `let gameState = 'start'` + `stateMachine.transition(PLAYING)` where update() checks gameState → game loop NEVER runs

2. DETERMINISTIC RENDERING — no Math.random() in render/draw functions:
   - Generate random values ONCE during init/reset (store in arrays/objects)
   - Reuse stored values every frame in render loop
   - VIOLATION: `drawMountain(x, y, 150, 80 + Math.random() * 60)` inside draw() → background flickers every frame

3. DELTA-TIME PHYSICS — all movement must scale by dt:
   - `character.velocityY += GRAVITY * dt` (not just `+= GRAVITY`)
   - `character.y += character.velocityY * dt`
   - `obstacle.x -= speed * dt`
   - `bgLayer.x -= bgLayer.speed * dt`
   - VIOLATION: gravity applied per-frame without dt → physics is frame-rate dependent (144Hz falls 2.4x faster than 60Hz)

4. INPUT HANDLING — keyboard events on window:
   - `window.addEventListener('keydown', handler)` — ALWAYS on window, not canvas or document
   - Use a `keys` object to track pressed state: `keys[e.code] = true` on keydown, `false` on keyup
   - Check `keys` in update loop, not in event handler directly
   - Call `e.preventDefault()` for game keys (Space, ArrowUp, ArrowDown) to prevent page scroll

5. EXPOSE GAME STATE — for smoke test verification (MANDATORY):
   a) `window.render_game_to_text()` — returns JSON string of game state:
      ```
      window.render_game_to_text = () => JSON.stringify({
        mode: gameState,  // 'menu'|'playing'|'paused'|'gameover'
        player: { x: player.x, y: player.y, vy: player.velocityY },
        entities: obstacles.map(o => ({ x: o.x, y: o.y, w: o.width })),
        score: score, isGrounded: player.isGrounded
      });
      ```
   b) `window.advanceTime(ms)` — deterministic time stepping for automated testing:
      ```
      window.advanceTime = (ms) => {
        const steps = Math.max(1, Math.round(ms / (1000 / 60)));
        for (let i = 0; i < steps; i++) update(1 / 60);
        render();
      };
      ```
   c) `window.game = { player, state, score }` — also set this object for simple state access
   - Smoke test Phase 15 calls render_game_to_text() and advanceTime() to verify the game responds to input

6. PROPER GAME LOOP PATTERN:
   ```
   let lastTime = 0;
   function gameLoop(timestamp) {
     const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // cap at 50ms
     lastTime = timestamp;
     update(dt);
     render();
     requestAnimationFrame(gameLoop);
   }
   requestAnimationFrame(gameLoop);
   ```
   - ALWAYS use requestAnimationFrame (never setInterval for game loop)
   - ALWAYS call clearRect before rendering
   - ALWAYS cap dt to prevent physics explosion after tab switch

7. ALL FUNCTIONS MUST EXIST — if restartGame() calls startGame(), startGame() MUST be defined:
   - Before committing, verify: every function call has a corresponding function definition
   - VIOLATION: `function restartGame() { startGame(); }` but startGame() is never defined → ReferenceError

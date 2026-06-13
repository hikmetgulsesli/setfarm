export function hasExplicitNonGameIntent(text: string): boolean {
  const normalized = String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  return /\b(?:not|no|non)[-\s]+(?:a\s+|an\s+|the\s+)?(?:browser\s+|canvas\s+)?game\b/.test(normalized)
    || /\bnot\s+(?:a\s+|an\s+|the\s+)?game\b/.test(normalized)
    || /\bnot\s+gameplay\b/.test(normalized)
    || /\bno\s+gameplay\b/.test(normalized);
}

export function hasBrowserGameIntent(text: string): boolean {
  if (hasExplicitNonGameIntent(text)) return false;
  return /\b(browser-game|browser game|canvas-game|canvas game|arcade|gameplay|playable game|game loop|playfield|score|high score|level|lives|paused|game over|keyboard controls|touch controls|paddle|runner|flappy|breakout|tetris|pong)\b/i.test(text);
}

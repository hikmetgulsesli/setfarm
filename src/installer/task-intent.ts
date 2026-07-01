export function hasExplicitNoDatabaseIntent(text: string): boolean {
  const normalized = String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  return /\b(?:no|not|without)[-\s]+(?:database|db|postgres|postgresql|sqlite)\b/.test(normalized)
    || /\b(?:database|db)[-\s]+(?:not|required\s*:\s*none|none|unneeded|unnecessary)\b/.test(normalized)
    || /\bdb_required\s*[:=]\s*none\b/.test(normalized);
}

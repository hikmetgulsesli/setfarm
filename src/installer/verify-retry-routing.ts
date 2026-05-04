const VERIFY_RETRY_QUALITY_SIGNAL =
  /\b(smoke(?:-test)?|dead[- ]?button|click|route|navigation|link|href|url|visual|screenshot|layout|overlap|blank page|white screen|console error|runtime error|network error|build fails?|build failed|npm run build|typescript error|type error|test fails?|test failed|playwright|accessibility|a11y|heading-skip|low[- ]?contrast|contrast|worktree|dirty|\.bak|backup file|source file|acceptance|broken|regression|responsive|mobile|desktop|aria)\b/i;

export function isVerifyRetryQualityFailure(output: string): boolean {
  const text = output.trim();
  if (!text) return false;
  if (/^SYSTEM_SMOKE_FAILURE:/i.test(text)) return true;
  if (!/\bSTATUS\s*:\s*retry\b/i.test(text)) return false;
  return VERIFY_RETRY_QUALITY_SIGNAL.test(text);
}

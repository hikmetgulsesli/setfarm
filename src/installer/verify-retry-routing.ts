const VERIFY_RETRY_QUALITY_SIGNAL =
  /\b(smoke(?:-test)?|dead[- ]?button|click|route|navigation|link|href|url|visual|screenshot|layout|overlap|blank page|white screen|console error|runtime error|network error|build fails?|build failed|npm run build|typescript error|type error|test fails?|test failed|playwright|accessibility|a11y|heading-skip|low[- ]?contrast|contrast|worktree|dirty|\.bak|backup file|source file|acceptance|broken|regression|responsive|mobile|desktop|aria|review comments?|unresolved review|form|edit mode|edit flow|handler|prop|props|state|data loss|empty form|unused prop)\b/i;

const VERIFY_RETRY_MERGE_BLOCKER_SIGNAL =
  /\b(?:PR|pull request|mergeable|mergeStateStatus|merge state)\b[\s\S]{0,360}\b(?:CONFLICTING|DIRTY|BLOCKED)\b|\b(?:CONFLICTING|DIRTY|BLOCKED)\b[\s\S]{0,160}\b(?:PR|pull request|mergeable|mergeStateStatus|merge state)\b|\bunresolved\s+merge\s+conflicts?\b|\bmerge\s+conflicts?\b[\s\S]{0,160}\b(?:unresolved|markers?|resolve|blocking|failed|dirty)\b|\bconflict\s+markers?\b|\bTS1185\b/i;

export function isVerifyRetryQualityFailure(output: string): boolean {
  const text = output.trim();
  if (!text) return false;
  if (/^SYSTEM_SMOKE_FAILURE:/i.test(text)) return true;
  if (!/\bSTATUS\s*:\s*retry\b/i.test(text)) return false;
  return VERIFY_RETRY_QUALITY_SIGNAL.test(text);
}

export function isVerifyRetryMergeBlocker(output: string): boolean {
  const text = output.trim();
  if (!text || !/\bSTATUS\s*:\s*retry\b/i.test(text)) return false;
  if (/\b(?:no|without|zero)\s+(?:blocking\s+)?merge\s+conflicts?\b/i.test(text)) return false;
  return VERIFY_RETRY_MERGE_BLOCKER_SIGNAL.test(text);
}

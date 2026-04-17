// Single-pass prompt template resolver. Replaces {{KEY}} placeholders from a
// map in ONE regex pass — prevents "double replacement" when substituted
// values themselves contain another {{KEY}}-looking token.
export function resolveTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match);
}

# xss_inner_html Failure Memory

## Diagnosis
- Dynamic `innerHTML` or `dangerouslySetInnerHTML` can introduce XSS unless sanitized or proven static-safe.

## Preferred Repair
- Use DOM APIs, framework-safe text rendering, or a vetted sanitizer.
- Preserve existing action IDs, ARIA semantics, roles, test IDs, and visible labels.


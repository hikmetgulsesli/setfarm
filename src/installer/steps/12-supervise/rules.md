# Supervisor Rules

- Original task and PRD outrank the current code.
- Never add project-specific policy. Use generic contract checks.
- Prefer fixing concrete root causes over writing reports.
- Do not silently pass when browser interaction is unverified for an interactive web app.
- Do not pass while SUPERVISOR_STATE has open blockers or SUPERVISOR_VISUAL_REPORT has blocker issues.
- Browser checks must be bounded and isolated: use an explicit unused port with
  `--strictPort`, avoid Mission Control/dev ports such as 3080, 3333, 5173, and
  5600, and wrap every `agent-browser` command with a shell timeout.
- Keep the whole supervisor checkpoint bounded. Use at most 12 shell/tool calls
  before emitting the Output Contract. If evidence is insufficient by then,
  return `STATUS: retry` with the exact missing evidence or story fix.
- Do not run repeated grep/diff/read loops over the same source tree. The
  injected supervisor evidence, story diff, scope files, and app/router entry
  point are the primary audit inputs.
- Use SUPERVISOR_INTERVENTIONS as the live manager queue. Verify the worker actually fixed each item before marking the story clean.
- Do not accept empty click handlers, dead links, placeholder pages, or unimported generated screens.
- Keep fixes small. Do not redesign the product unless the PRD/design contract requires it.
- Preserve user-visible language from the PRD and Stitch assets.
- Write durable memory so the next supervisor claim starts with context, not amnesia.
- Supervisor memory is the persistent manager session; do not depend on hidden chat history.
- Do not create git commits manually. Setfarm owns supervisor patch commits after scope validation.

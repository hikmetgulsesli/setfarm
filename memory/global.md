# Global Setfarm Memory

## Invariants
- Inspect live run state before deciding recovery.
- Respect scoped write ownership; expand scope only through Setfarm recovery when downstream evidence names additional files.
- Do not hardcode project-specific names, filenames, icon names, or app titles into platform rules.
- Build/test/lint evidence matters more than agent prose.
- Product defects should be repaired by worker/supervisor loops before failing a run, unless the app cannot start or a hard gate is exhausted.

## Recovery Discipline
- Classify each failure as product repair, supervisor repair, platform detector gap, or environment/provider.
- Keep setup/build focused on stack infrastructure. Missing UI details, icons, handlers, routes, or security findings are repair findings unless they break startup/tooling.
- When a guard rejects behavior that appears semantically equivalent, route to platform diagnosis instead of repeatedly consuming story retries.


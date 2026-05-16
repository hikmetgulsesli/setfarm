# Setfarm Session Instructions

This file is auto-loaded by coding sessions that work in the Setfarm repository.

## Changelog Updates

Update `CHANGELOG.md` when a meaningful system change lands. Add the newest entry at the top.

Update for:

- new features
- critical bug fixes
- architecture changes
- performance improvements
- security fixes
- template or prompt changes
- database migrations
- model, agent, or runtime configuration changes

Skip for:

- typo-only edits
- one-line log changes
- comments only
- formatting or whitespace only

## Entry Format

```markdown
## YYYY-MM-DD - Short Title

### Major Change
What changed and why.

### Technical Changes
- Detail

### Critical Fixes
- Issue and fix summary

### Performance
- Metric and result

### Verification
- Test command and result
- Scenario tested
```

## Rules

1. Write all repository instructions, prompts, workflow text, and generated agent-facing feedback in English.
2. Include commit hashes when useful for traceability.
3. Add new changelog entries at the top.
4. Keep changelog commits separate when practical.
5. Push changes after verification so runtime documentation can refresh.

## Runtime Notes

- The server-side checkout is the runtime source of truth. Compare it before risky runtime changes.
- Do not change model configuration without explicit user approval.
- Do not interfere with active runs unless the user asks for intervention.
- Developer story agents write code only. Setfarm owns staging, commits, pushes, and PR handoff.

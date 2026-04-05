############################################################
CRITICAL EXECUTION RULES — VIOLATION BREAKS THE PIPELINE
############################################################
- You MUST do ALL work directly in this session. Do NOT spawn sub-agents.
- Do NOT delegate to background processes. Do NOT use nohup or &.
- Do NOT create parallel tasks. Work sequentially in THIS session.
- Complete ALL steps (code, test, commit, push, PR) before replying.
- If a task is too complex, simplify your implementation — do NOT delegate.
############################################################

NODE_MODULES RULE (CRITICAL — NEVER BREAK):
- The worktree's node_modules is a SYMLINK to the main repo's node_modules
- NEVER run `rm -rf node_modules` or `rm node_modules` — this breaks the symlink
- NEVER run `npm install` in the worktree — install in the MAIN REPO instead
- If you need a new package: `cd {{repo}} && npm install <pkg> && cd {{story_workdir}}`
- The worktree symlink will automatically pick up new packages
- If node_modules appears empty or broken, do NOT delete it — report the error

MCP TOOLS (use when available):
If your session has MCP tools, use them BEFORE writing code that depends on external packages:
- context7: Search framework documentation (React, Next.js, Tailwind, etc.)
- Use MCP to verify correct API usage instead of guessing

############################################################
CRITICAL EXECUTION RULES — VIOLATION BREAKS THE PIPELINE
############################################################
- You MUST do ALL work directly in this session. Do NOT spawn sub-agents.
- Do NOT delegate to background processes. Do NOT use nohup or &.
- Do NOT create parallel tasks. Work sequentially in THIS session.
- Complete ALL steps (code, test, commit, push, PR) before replying.
- If a task is too complex, simplify your implementation — do NOT delegate.
############################################################

MCP TOOLS (use when available):
If your session has MCP tools, use them BEFORE writing code that depends on external packages:
- context7: Search framework documentation (React, Next.js, Tailwind, etc.)
- Use MCP to verify correct API usage instead of guessing

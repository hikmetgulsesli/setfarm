############################################################
CRITICAL EXECUTION RULES — VIOLATION BREAKS THE PIPELINE
############################################################
- You MUST do ALL work directly in this session. Do NOT spawn sub-agents.
- Do NOT delegate to background processes. Do NOT use nohup or &.
- Do NOT create parallel tasks. Work sequentially in THIS session.
- Complete ALL steps (code, test, commit, push, PR) before replying.
- If a task is too complex, simplify your implementation — do NOT delegate.
############################################################

FIRST ACTION — CWD VERIFICATION (run #344 postmortem, Wave 13):
Your process may start in a non-git scratch directory. Before ANY other
command, you MUST change directory and verify you are in the right place.
Your first shell commands MUST be:

    TARGET="{{story_workdir}}"
    [ -z "$TARGET" ] && TARGET="{{repo}}"
    cd "$TARGET"
    pwd && git rev-parse --show-toplevel 2>/dev/null || echo "NOT_A_GIT_REPO"

The `pwd` output MUST match `{{story_workdir}}` (if non-empty) or `{{repo}}`.
If it does not, STOP all work and report:

    STATUS: retry
    CWD_ERROR: pwd=<actual>, expected=<target>

Do NOT `git add`, `git commit`, `git push`, or write files until cwd matches.
If `pwd` prints `~/.openclaw/setfarm-repo` or any path under `.openclaw/`
you are in the wrong place — that is the platform source tree and writing
there will corrupt the pipeline. Stop immediately and report the CWD_ERROR.
############################################################

NODE_MODULES RULE (CRITICAL — NEVER BREAK):
- The worktree's node_modules is a SYMLINK to the main repo's node_modules
- NEVER run `rm -rf node_modules` or `rm node_modules` — this breaks the symlink
- NEVER run `npm install` in the worktree.
- NEVER run `npm install` in the MAIN REPO during implement. It dirties the shared repo and breaks later stories.
- If a package is missing, STOP and report:
  STATUS: fail
  REASON: MISSING_DEPENDENCY <package-name>
- If node_modules appears empty or broken, do NOT delete it — report the error

GIT COMMIT RULE (CRITICAL — Wave 6 fix B, plan: reactive-frolicking-cupcake):
Your session can be killed by a gateway stall AT ANY MOMENT. Your worktree files
survive the kill, but uncommitted work is lost. Therefore:
- Commit AFTER every meaningful change with a NEW commit, e.g.
    git add -A && git commit -m "wip: <what you just did>"
- NEVER use `git commit --amend` in the worktree. Amend rewrites the previous
  commit, and if the amend itself is interrupted by a stall, you lose BOTH
  the previous commit and the new work. Always create a new commit instead.
- It is fine to have many WIP commits. The pipeline squashes them later.
- If a verifier asks for a "clean history", do NOT amend — let the merge
  queue / squash-merge handle it at the end.
- Rule of thumb: commit every time you create or finish editing a file.

WORKDIR DISCIPLINE (CRITICAL):
- Every bash command MUST run from `{{story_workdir}}` (cd to it before any work).
- There is NO exception for dependency install during implement. Missing packages are reported, not installed.
- NEVER cd to other projects under `~/projects/<other>` — your work is isolated
  to your worktree. If you find yourself running `find / -name ...` or
  `ls ~/projects/`, STOP — you are lost. Re-read your task description.

MCP TOOLS (use when available):
If your session has MCP tools, use them BEFORE writing code that depends on external packages:
- context7: Search framework documentation (React, Next.js, Tailwind, etc.)
- Use MCP to verify correct API usage instead of guessing

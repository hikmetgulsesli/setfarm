PLAN step — {{TASK}}

Create the product PRD and choose the technical defaults for this run. The
agent-facing contract is English. User-facing application copy should follow
the user's requested language; if the task is Turkish and no other language is
specified, plan a Turkish UI while keeping all pipeline output keys in English.

Do not read `rules.md`; the rules are embedded below.

## Task

{{TASK}}

## Work

1. Read the task and identify the product concept.
2. Write a detailed PRD in English, including an explicit user-facing language
   decision.
3. Choose TECH_STACK and DB_REQUIRED.
4. Choose REPO path and BRANCH name.
5. Return exactly the key-value output format below.

## Output Format

```
STATUS: done
REPO: $HOME/projects/<slug>
BRANCH: <branch-name>
TECH_STACK: <vite-react|nextjs|vanilla-ts|node-express|react-native>
PRD:
<PRD body>
PRD_SCREEN_COUNT: <number>
DB_REQUIRED: <none|postgres|sqlite>
```

Every field is required. This is not JSON. Use KEY: VALUE lines. PRD may be
multi-line; every other field is single-line.

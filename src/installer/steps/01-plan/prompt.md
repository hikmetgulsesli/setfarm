PLAN step — {{TASK}}

Create the product PRD and choose the technical defaults for this run. The
agent-facing contract is English. User-facing application copy must follow
UI_LANGUAGE. Default UI_LANGUAGE to English unless the user explicitly requests
Turkish or writes the product request in Turkish.

Do not read `rules.md`; the rules are embedded below.

## Task

{{TASK}}

## Work

1. Read the task and identify the product concept.
2. Choose UI_LANGUAGE as English or Turkish.
3. Write a detailed PRD in English, including the UI_LANGUAGE decision.
4. Choose TECH_STACK and DB_REQUIRED.
5. Choose REPO path and BRANCH name.
6. Return exactly the key-value output format below.

## Output Format

```
STATUS: done
REPO: $HOME/projects/<slug>
BRANCH: <branch-name>
TECH_STACK: <vite-react|nextjs|vanilla-ts|node-express|react-native>
UI_LANGUAGE: <English|Turkish>
PRD:
<PRD body>
PRD_SCREEN_COUNT: <number>
DB_REQUIRED: <none|postgres|sqlite>
```

Every field is required. This is not JSON. Use KEY: VALUE lines. PRD may be
multi-line; every other field is single-line.

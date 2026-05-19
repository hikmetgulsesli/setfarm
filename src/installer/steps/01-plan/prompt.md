PLAN step — {{TASK}}

Create the product contract PRD for this run. PLAN owns product intent,
behavior, data/state contracts, platform choice, and Stitch design guidance.
PLAN does not own runtime infrastructure.

Do not read `rules.md`; the rules are embedded below.

## Task

{{TASK}}

## Work

1. Identify the product name from the task, or derive a concise product name from the requested product.
2. Choose PLATFORM, TECH_STACK, UI_LANGUAGE, DB_REQUIRED, and DESIGN_REQUIRED.
3. Write the PRD as a product contract with Product Surfaces, not physical screens.
4. Keep implementation/runtime details out of PLAN.
5. Return exactly the key-value format below.

## Output Format

```
STATUS: done
PROJECT_NAME: <product name>
PROJECT_SLUG: <kebab-case product slug>
PLATFORM: <web|mobile|desktop|api|cli|game>
TECH_STACK: <vite-react|nextjs|vanilla-ts|node-express|react-native>
UI_LANGUAGE: <English or requested product language>
DB_REQUIRED: <none|postgres|sqlite>
DESIGN_REQUIRED: <true|false>
PRD:
<PRD body>
```

Every field is required. This is not JSON. Use KEY: VALUE lines. PRD may be
multi-line; every other field is single-line.

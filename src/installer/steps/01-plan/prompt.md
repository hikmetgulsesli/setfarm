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
3. Write a compact UI_VISION_SUMMARY for DESIGN only.
4. Write the PRD as a product contract with Product Surfaces, not physical screens.
5. Keep implementation/runtime details out of PLAN.
6. Return exactly the key-value format below.

## Output Format

```
CONTRACT_SCHEMA_VERSION: setfarm.plan.v2.2
STATUS: done
PROJECT_NAME: <product name>
PROJECT_SLUG: <kebab-case product slug>
PLATFORM: <web|mobile|desktop|api|cli|game>
TECH_STACK: <vite-react|nextjs|static-html|browser-game|node-express|python-web|node-cli|python-cli|react-native-expo|android-native|ios-native|desktop-electron>
UI_LANGUAGE: <English or requested product language>
DB_REQUIRED: <none|postgres|sqlite|external>
DESIGN_REQUIRED: <true|false>
UI_VISION_SUMMARY: <3-4 UI-focused sentences for DESIGN only; no implementation paths>
PRD:
<PRD body>
```

Every field is required. This is not JSON. Use KEY: VALUE lines. PRD may be
multi-line; every other field is single-line.

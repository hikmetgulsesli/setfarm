SETUP-REPO step — repo is prepared. Confirm and complete.

## Repo State

REPO: {{REPO}}
BRANCH: {{BRANCH}}
TECH_STACK: {{TECH_STACK}}
DB_REQUIRED: {{DB_REQUIRED}}

Pipeline preClaim already did:
- git init + main branch
- created {{BRANCH}} from main
- scaffolded {{TECH_STACK}} files: package.json and config files
- provisioned DB when DB_REQUIRED requires it
- built design contracts from stitch/DESIGN_MANIFEST.json

## Work

1. Check `ls -la {{REPO}}`.
2. Decide EXISTING_CODE true/false. Use true only for a real pre-existing repo
   with meaningful prior commit history.
3. Output and call `step complete`.

## Output

```
STATUS: done
EXISTING_CODE: false
```

Do not read `rules.md`; the rules are embedded below.

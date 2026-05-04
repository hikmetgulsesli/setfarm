# SETUP-REPO Step Rules

The pipeline already did the heavy work:
- ran setup-repo.sh
- created the planned branch
- provisioned PostgreSQL when DB_REQUIRED=postgres
- built design contracts from Stitch HTML
- scaffolded package/config files for TECH_STACK

## Your Single Step

1. Confirm the repo directory exists and has the expected scaffold.
2. Output the key-value format.
3. Call `step complete`.

## Output

```
STATUS: done
EXISTING_CODE: false|true
```

- `false`: fresh scaffold, the usual case.
- `true`: real pre-existing repo with prior meaningful history.

## Do Not

- Do not run git commands.
- Do not run npm install.
- Do not edit scaffold files.
- Do not call Stitch API.

If unsure, choose `EXISTING_CODE: false`.

# 03-stories - Stories Step Module

The third pipeline step. It decomposes the PRD and screen map into implementation stories.

## Input

- `prd`, `repo`
- `screen_map`, `design_system`, `device_type`
- `predicted_screen_files`

## Parsed Output

- `STATUS: done`
- `STORIES_JSON`: array with all required story fields
- `SCREEN_MAP`: array with story ownership data

## Completion Side Effects

1. Insert stories into the database.
2. Fail on zero stories.
3. Fail on missing scope files.
4. Auto-fix overlapping scope ownership by moving later ownership to shared files.
5. Fail on hallucinated screen paths.
6. Auto-fix multi-owner screens.
7. Generate a screen-map fallback for UI projects when needed.

## Prompt Budget

`maxPromptSize: 12288` bytes.

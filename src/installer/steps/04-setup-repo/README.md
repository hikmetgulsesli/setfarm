# 04-setup-repo - Setup Repo Step Module

Runs after plan, design, and stories. It prepares the git repository, scaffold, database provisioning, and design contracts.

## Input

- `repo`, `branch`, `tech_stack`, `db_required`
- `screen_map`
- `stitch/*`

## Preclaim Side Effects

1. Run `setup-repo.sh`.
2. Create a missing branch from main.
3. Provision the database when required.
4. Build table, route, and component contracts from Stitch HTML.
5. Refresh timestamps.

## Parsed Output

- `STATUS: done`
- `EXISTING_CODE`

## Prompt Budget

`maxPromptSize: 6144` bytes.

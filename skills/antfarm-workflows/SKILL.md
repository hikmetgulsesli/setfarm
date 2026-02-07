---
name: antfarm-workflows
description: Install and manage Antfarm workflows for OpenClaw.
user-invocable: false
---

# Antfarm Workflows

Use the Antfarm CLI to install, run, and inspect workflows. The CLI is on PATH
as `antfarm`.

## Common commands

- Install a workflow:
  `antfarm workflow install <url-or-path>`
- Start a workflow run:
  `antfarm workflow run <workflow-id> <task-title>`
- Check status:
  `antfarm workflow status <task-title>`
- Update a workflow:
  `antfarm workflow update <workflow-id> [<url>]`
- Uninstall a workflow:
  `antfarm workflow uninstall <workflow-id>`

If a workflow is blocked, report the exact error and ask the user to resolve it.

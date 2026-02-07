# Antfarm

Antfarm provides workflow installers and runners that integrate with OpenClaw.

## Setup

```bash
npm install
npm run build
```

## Install A Workflow

```bash
antfarm workflow install <workflow-url>
```

Examples:

```bash
antfarm workflow install ./workflows/feature-dev
antfarm workflow install https://github.com/acme/workflows/tree/main/feature-dev
antfarm workflow install https://raw.githubusercontent.com/acme/workflows/main/feature-dev/workflow.yml
```

## Run And Status

```bash
antfarm workflow run <workflow-id> <task-title>
antfarm workflow status <task-title>
```

## Update And Uninstall

```bash
antfarm workflow update <workflow-id>
antfarm workflow update <workflow-id> <workflow-url>
antfarm workflow uninstall <workflow-id>
```

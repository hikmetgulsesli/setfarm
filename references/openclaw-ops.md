# OpenClaw Operations Skill

OpenClaw platform operations, configuration, and management guide.

## Model Policy (FIXED - DO NOT CHANGE)

| Agent Role | Primary Model | Fallback |
|---|---|---|
| Coding (developer, setup, tester, verifier, fixer) | `kimi-coding/k2p5` (Kimi K2.5) | `minimax/MiniMax-M2.5` |
| Non-coding (planner, reviewer, main, PR, merge) | `minimax/MiniMax-M2.5` | `kimi-coding/k2p5` |
| Subagents | `kimi-coding/k2p5` | `minimax/MiniMax-M2.5` |

**RULE: Kimi K2.5 must NEVER be removed from coding agents. This is a fixed policy.**

Model config location: `~/.openclaw/openclaw.json` under `agents.list[].model`

Per-agent override format:
```json
{
  "id": "feature-dev_developer",
  "model": {
    "primary": "kimi-coding/k2p5",
    "fallback": "minimax/MiniMax-M2.5"
  }
}
```

## Sandbox Mode

OpenClaw 2026.2.15+ runs with **sandbox OFF** for file system access.
Config: `~/.openclaw/openclaw.json` → `env.sandbox: false`

## Gateway Management

```bash
# Restart gateway (applies config changes)
openclaw gateway restart

# Check status
openclaw status

# View logs
openclaw logs --tail 50

# Health check
openclaw doctor
```

## Channel Configuration

- **Discord** (Arya bot): channel `discord`, target = channel ID
- **Telegram** (SetroxxBot): channel `telegram`
- **WhatsApp**: channel `whatsapp`

Send message:
```bash
openclaw message send --channel discord --target <channel-id> -m "message"
```

## Cron Jobs

```bash
openclaw cron list
openclaw cron add --schedule "*/5 * * * *" --command "..."
openclaw cron remove <id>
```

## Agent Sessions

```bash
openclaw agent --message "text" --channel discord --deliver
openclaw sessions list
```

## Important File Locations

| File | Purpose |
|---|---|
| `~/.openclaw/openclaw.json` | Main config (models, channels, agents) |
| `~/.openclaw/antfarm/antfarm.db` | Antfarm pipeline database (node:sqlite) |
| `~/.openclaw/antfarm/workflows/` | Workflow definitions (YAML) |
| `~/.openclaw/scripts/antfarm-update.sh` | Antfarm update/patch script |
| `~/.openclaw/scripts/fix-pipeline-v2.py` | Pipeline fix script (node:sqlite API) |
| `~/.openclaw/workspace-main/` | Main agent workspace |
| `/home/setrox/mission-control/projects.json` | Project registry |

## Project Management

Projects are stored in `/home/setrox/mission-control/projects.json`.

Each project needs:
1. Source code in `/home/setrox/<project-name>/`
2. Systemd service: `/etc/systemd/system/<project-name>.service`
3. Cloudflare tunnel entry: `/etc/cloudflared/config.yml`
4. Entry in `projects.json` with: service, repo, domain, stack, github

Create service template:
```ini
[Unit]
Description=<Project Name>
After=network.target

[Service]
Type=simple
User=setrox
WorkingDirectory=/home/setrox/<project-name>
ExecStart=/home/setrox/.npm-global/bin/serve dist -l <port> -s
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## OpenClaw Update Procedure

```bash
cd ~/.openclaw && openclaw update
# Then run antfarm patches:
bash ~/.openclaw/scripts/antfarm-update.sh
```

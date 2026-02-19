# Moltclaw Server Management Skill

Server administration for the OpenClaw platform host.

## Server Details

| Property | Value |
|---|---|
| Hostname | moltclaw |
| IP (Tailscale) | 100.119.51.42 |
| IP (LAN) | 192.168.1.100 |
| User | setrox |
| SSH | `ssh setrox@100.119.51.42` |
| OS | Ubuntu / Debian-based Linux |
| Node.js | v22.22.0 |
| Domain | *.setrox.com.tr |

## Service Management

All web projects run as systemd services.

```bash
# List all project services
sudo systemctl list-units --type=service | grep -E "tracker|timer|menu|pulse|viz|docs|qr|palette|habit|portfolio|shortener"

# Start/stop/restart
sudo systemctl start <service-name>.service
sudo systemctl stop <service-name>.service
sudo systemctl restart <service-name>.service

# Check status
sudo systemctl status <service-name>.service

# Enable on boot
sudo systemctl enable <service-name>.service

# View logs
journalctl -u <service-name>.service --since "1 hour ago"
```

## Active Services

| Service | Port | Domain |
|---|---|---|
| mission-control.service | 3080 | ai.setrox.com.tr |
| restmenu.service | 3501 | restmenu.setrox.com.tr |
| logpulse.service | 3502 | logpulse.setrox.com.tr |
| agentviz.service | 3503 | agentviz.setrox.com.tr |
| clawdocs.service | 3504 | clawdocs.setrox.com.tr |
| url-shortener.service | 3506 | link.setrox.com.tr |
| pomodoro-timer.service | 3507 | pomodoro-timer.setrox.com.tr |
| habit-tracker.service | 3508 | habit-tracker.setrox.com.tr |
| typing-speed-test.service | 3509 | typing-speed-test.setrox.com.tr |
| color-palette-generator.service | 3510 | color-palette-generator.setrox.com.tr |
| qr-code-generator.service | 3511 | qr-code-generator.setrox.com.tr |
| setrox-com-portfolio.service | 3512 | setrox-com-portfolio.setrox.com.tr |
| expense-tracker.service | 3513 | expense-tracker.setrox.com.tr |

## Cloudflare Tunnel

Config: `/etc/cloudflared/config.yml`

**CRITICAL: Follow these steps IN ORDER when adding a new hostname:**

1. Back up first: `sudo cp /etc/cloudflared/config.yml /etc/cloudflared/config.yml.bak`
2. Add new hostname entry (BEFORE the catch-all `- service: http_status:404`):
   ```yaml
     - hostname: <subdomain>.setrox.com.tr
       service: http://127.0.0.1:<port>
   ```
3. Validate YAML: `python3 -c "import yaml; yaml.safe_load(open('/etc/cloudflared/config.yml'))"`
4. If validation passes: `sudo systemctl restart cloudflared`
5. If validation fails: `sudo cp /etc/cloudflared/config.yml.bak /etc/cloudflared/config.yml`
6. Verify after restart: `sudo systemctl is-active cloudflared`

**Rules:**
- Every entry MUST have both `hostname:` and `service:` — never one without the other
- Use short subdomain names (e.g., `agentviz.setrox.com.tr` not `agentviz-real-time-visualization.setrox.com.tr`)
- Never add duplicate hostnames


## Port Allocation

- 3080: Mission Control
- 3001-3006: Infrastructure (Uptime Kuma, Grafana, etc.)
- 3500+: Project apps (auto-allocated by antfarm)
- Next available port: query MC API at /api/projects/next-port

## Project Deployment Checklist

When deploying a new project:

1. Build the project (`npm run build` produces `dist/`)
2. Create systemd service file
3. Enable and start service
4. Add Cloudflare tunnel entry
5. Restart cloudflared
6. Add DNS CNAME record in Cloudflare
7. Update projects.json with service, repo, domain, stack
8. Verify with curl to localhost on the port

## Service Template (Static Vite/React)

```ini
[Unit]
Description=<Project Name>
After=network.target

[Service]
Type=simple
User=setrox
WorkingDirectory=/home/setrox/<project-dir>
ExecStart=/home/setrox/.npm-global/bin/serve dist -l <port> -s
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## Service Template (Next.js)

```ini
[Unit]
Description=<Project Name>
After=network.target

[Service]
Type=simple
User=setrox
WorkingDirectory=/home/setrox/<project-dir>
ExecStart=/usr/bin/npm run dev
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production PORT=<port>

[Install]
WantedBy=multi-user.target
```

## Backup

Important directories to back up:
- ~/.openclaw/ (config, antfarm DB, scripts)
- ~/mission-control/projects.json (project registry)
- /etc/cloudflared/config.yml (tunnel config)
- /etc/systemd/system/*.service (service files)

---

## Cloudflare DNS API (Otomatik Subdomain Ekleme)

Yeni proje oluştururken DNS kaydını otomatik eklemek için:

```bash
# CNAME ekle (proxied)
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/dcb4b61afa6f4a6bd8c05950381655f2/dns_records" \
  -H "Authorization: Bearer CP1qBCzEfcwYlFifgNfEiVEye75FWR7Dq_7BEh8O" \
  -H "Content-Type: application/json" \
  -d '{"type":"CNAME","name":"SUBDOMAIN_ADI","content":"92d8df83-3623-4850-ba41-29126106d020.cfargotunnel.com","proxied":true}'
```

- Zone: setrox.com.tr
- Tunnel CNAME: `92d8df83-3623-4850-ba41-29126106d020.cfargotunnel.com`
- Subdomain max 25 karakter, kısa ve öz olmalı
- Cloudflare tunnel config'e de hostname + service eklemeyi unutma

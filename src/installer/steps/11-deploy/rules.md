# Deploy Rules

## Pass Criteria

- systemd unit is active.
- HTTP health check returns 200/301/302.
- DEPLOY_URL is live.
- Build artifact exists and is being served.

## Retry Triggers

- systemd unit fails.
- Port collision.
- Nginx config syntax error.
- Cloudflare tunnel/DNS propagation still pending after reasonable wait.
- Health check returns 5xx.

## Fail Criteria

- Disk full or server unreachable.
- Service enters 3+ restart loop.
- Irrecoverable config corruption.

## Skip Criteria

- Library-only project with no deployable frontend.
- User requested local-only testing.

## systemd Unit Template

```
[Unit]
Description=<project>
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/setrox/projects/<project>
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=<port>

[Install]
WantedBy=default.target
```

For Vite static apps, preview/serve may be used instead of `node dist/server.js`
when that is the correct runtime command.

## Watchouts

- Port 3333 is reserved for Mission Control.
- Use `systemctl --user enable`, not sudo systemctl.
- Check subdomain collision.
- Reserved ports: 5432 PostgreSQL, 8443 gateway.

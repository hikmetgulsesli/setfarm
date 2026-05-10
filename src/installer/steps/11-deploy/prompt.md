# Deploy Step — Production Deploy Agent

Deploy the project that passed final-test. Configure systemd, choose a
subdomain, configure tunnel/proxy, and health-check the live app.

## Context

- `{{REPO}}`: project root
- `{{PROJECT_NAME}}`: project name for service/subdomain
- `{{PROJECT_DISPLAY_NAME}}`: human-readable product name for UI/project cards
- `{{HOSTNAME}}`: canonical hostname, without protocol
- `{{BUILD_CMD}}`: build command from setup-build
- `{{TECH_STACK}}`: vite-react, nextjs, etc.
- `{{FINAL_PR}}`: PR URL
- `{{PROGRESS}}`: project status

## Deploy Steps

1. Allocate an unused 4xxx/5xxx port.
2. Write user systemd unit: `~/.config/systemd/user/<project>.service`.
3. Configure Nginx reverse proxy: subdomain.setrox.com.tr → localhost:<port>.
4. Configure Cloudflare tunnel hostname routing.
5. Run `systemctl --user enable --now <project>`.
6. Health check root page; HTTP must be 200/301/302.
7. Update Mission Control metadata only after successful deploy:
   - Project id/name: `basename "{{REPO}}"`.
   - `displayName`: `{{PROJECT_DISPLAY_NAME}}`.
   - `summary`: one concise product-purpose sentence, not the raw task string.
   - Use only `ports.frontend`; do not write `ports.web`.
   - `domain` MUST be hostname-only: `{{HOSTNAME}}`.
   - Never put `http://`, `https://`, slashes, paths, or `https//` in `domain`.
   - Payload fields: `id`, `name`, `displayName`, `summary`, `repo`, `status`,
     `ports`, `domain`, `service`, `github`, run id fields if present, `completedAt`.
   - First try `POST http://127.0.0.1:3080/api/projects`; if project exists,
     `PATCH http://127.0.0.1:3080/api/projects/<project-id>`.
   - Mission Control update failure must not roll back a working service; report
     it in ISSUES.

## Output Format

```
STATUS: done|retry|skip|fail
DEPLOY_URL: https://{{HOSTNAME}}
SYSTEMD_UNIT: <project>.service
PORT: <port>
```

For `STATUS: done`, at least one deploy proof is required: DEPLOY_URL,
SYSTEMD_UNIT, or PORT.

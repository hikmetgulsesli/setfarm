# Lessons Learned - Feature-Dev Pipeline

This file records durable pipeline lessons. All agent-facing guidance in this repository must stay in English.

## Last Updated: 2026-02-18

## 1. Implement Stories For Real

Problem: Some historical runs marked stories as done while only scaffolding existed.

Rule:

- List the files created or changed.
- Verify `npm run build` and relevant tests.
- Do not report `STATUS: done` unless real working source behavior exists.
- Component stories should include source, styling when needed, and focused tests when risk warrants it.

## 2. SSL Certificate Handling

Problem: Agents tried to use certbot even though Cloudflare Access blocked ACME challenges.

Rule:

- Do not use Let's Encrypt automation on this server path.
- Use the configured origin certificate when Nginx TLS is required.
- Cloudflare Full SSL mode is expected for proxied domains.

## 3. Sudo Requirements

Problem: Agents cannot reliably complete sudo prompts and often time out.

Rule:

- If a step requires sudo, report the requirement explicitly.
- Prefer user-level services or user-writable paths.
- If there is no safe alternative, mark the item blocked instead of looping.

## 4. Stuck Recovery

Problem: Blind retrying repeats the same failure.

Rule:

- Analyze the failing output first.
- Detect known patterns: SSL, permission, rate limit, network, dependency, missing tool.
- Apply deterministic fixes when available.
- Escalate after repeated failure instead of repeating the same action.

## 5. Practical Pipeline Rules

- Dependency installation failure: classify and retry only when actionable.
- Rate limit: wait or switch provider when policy allows.
- Network failure: short backoff, then retry.
- Build failure: read the error, fix source, rerun.
- Test failure: fix source or test expectation when owned by the story.

## 6. Server Notes

- OS: Ubuntu on moltclaw.
- User: setrox.
- Nginx origin certificate path: `/etc/nginx/ssl/origin.{crt,key}`.
- Cloudflare proxies `*.setrox.com.tr`.
- Use system Node unless a project explicitly pins another runtime.
- Important paths:
  - `~/.openclaw/`
  - `~/mission-control/projects.json`
  - `/etc/cloudflared/config.yml`
  - `/etc/systemd/system/*.service`

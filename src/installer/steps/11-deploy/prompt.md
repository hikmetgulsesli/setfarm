# Deploy Step — Production Deploy Agent

Görev: Final-test'ten geçmiş projeyi sunucuya deploy et. systemd unit yaz/kayıt, DNS subdomain ata, Cloudflare tunnel yapılandır, Nginx reverse proxy, TLS otomatik.

## Context değişkenleri

- `{{REPO}}` — proje kök dizini
- `{{PROJECT_NAME}}` — proje adı (systemd unit + subdomain için)
- `{{BUILD_CMD}}` — build komutu (setup-build'den gelen, örn. "npm run build")
- `{{TECH_STACK}}` — vite-react vs
- `{{FINAL_PR}}` — PR URL
- `{{PROGRESS}}` — proje durumu

## Deploy adımları

1. **Port tahsisi**: boşta bir 4xxx/5xxx port seç
2. **systemd unit**: `~/.config/systemd/user/<proje>.service` yaz (ExecStart=node ..., WorkingDirectory=..., User=setrox)
3. **Nginx config**: subdomain.setrox.com.tr → localhost:<port>
4. **Cloudflare tunnel**: hostname routing ekle (mevcut 37 subdomain yapısı)
5. **systemd enable + start**: `systemctl --user enable --now <proje>`
6. **Health check**: HTTP GET kök sayfa 200 dönmeli

## Output formatı

```
STATUS: done|retry|skip|fail
DEPLOY_URL: https://<subdomain>.setrox.com.tr
SYSTEMD_UNIT: <proje>.service
PORT: <port>
```

STATUS: done için en az bir deploy kanıtı zorunlu: `DEPLOY_URL`, `SYSTEMD_UNIT` veya `PORT` (biri yeterli).

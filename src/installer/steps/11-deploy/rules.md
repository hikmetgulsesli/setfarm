# Deploy Kuralları

## Pass kriterleri (STATUS: done)

- systemd unit `systemctl --user is-active` → active
- HTTP health check 200
- DEPLOY_URL canlı erişilebilir (curl -Is → 200/301/302)
- Build artifact `dist/` dolu ve serve ediliyor

## Retry tetikleri (STATUS: retry)

- systemd unit fail (journalctl log'da ExecStart hata)
- Port çakışması (aynı port başka serviste)
- Nginx config syntax error (`nginx -t` fail)
- Cloudflare tunnel DNS propagation beklemede (5+ dk)
- Health check 5xx döndürüyor

## Fail kriterleri (STATUS: fail)

- Disk full veya sunucu erişilemez
- systemd unit çalışmaya başladı ama 3+ restart loop (`Restart=always` triggered)
- Geri dönülemez config bozulması (Nginx main config bozuldu)

## Skip kriterleri (STATUS: skip)

- Proje library-only (deploy edilecek frontend yok)
- User local-only test istedi (PRD'de deploy_required: false)

## systemd unit template

```
[Unit]
Description=<proje>
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/setrox/projects/<proje>
ExecStart=/usr/bin/node dist/server.js (veya "npx vite preview --port <port>")
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=<port>

[Install]
WantedBy=default.target
```

## Dikkat

- Port 3333 MC için rezerve — kullanma
- `systemctl --user enable` kullan, `sudo systemctl` değil
- Subdomain isim collision kontrol et (existing 37 subdomain listesi mevcut)
- Kırmızı nokta: Rezerve DB port (5432 PostgreSQL), 8443 gateway

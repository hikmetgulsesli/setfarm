# SETUP-REPO Step — Kurallar

Pipeline tüm heavy işi preClaim'de yaptı:
- `setup-repo.sh` çalıştı (git init + branch + scaffold)
- PRD'deki BRANCH oluşturuldu (yoksa main'den)
- PostgreSQL provision (DB_REQUIRED=postgres ise)
- Design contract'lar inşa edildi (stitch HTML'lerden tablo/component/route)
- Scaffold: package.json, tsconfig, vite.config, tailwind.config (TECH_STACK'e göre)

## Senin işin — TEK ADIM

1. `ls -la {{REPO}}` ile dizini kontrol et (package.json var mı)
2. Aşağıdaki KEY: VALUE formatında çıktı ver
3. `step complete` çağır

## Output

```
STATUS: done
EXISTING_CODE: false|true
```

- `EXISTING_CODE: false` — repo yeni scaffold edildi (çoğu durumda)
- `EXISTING_CODE: true` — repo pre-existing (git rev-list count > 5)

## Yapma

- git komutları çalıştırma (preClaim halletti)
- npm install çağırma (setup-build step'in işi)
- scaffold dosyalarına dokunma (next step'teki agent'lar yazacak)
- Stitch API çağırma

EXISTING_CODE gerçekten emin değilsen `false` seç — güvenli default.

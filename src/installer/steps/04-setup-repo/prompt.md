SETUP-REPO step — repo hazır, onayla ve geç.

## Repo durumu

REPO: {{REPO}}
BRANCH: {{BRANCH}}
TECH_STACK: {{TECH_STACK}}
DB_REQUIRED: {{DB_REQUIRED}}

Pipeline preClaim'de şunları yaptı:
- git init + main branch
- {{BRANCH}} branch'ı açıldı (main'den)
- Scaffold ({{TECH_STACK}}): package.json, config dosyaları
- DB provision ({{DB_REQUIRED}} ise)
- Design contract'lar (stitch/DESIGN_MANIFEST.json'dan)

## Yapılacaklar

1. `ls -la {{REPO}}` ile kontrol et
2. EXISTING_CODE true/false belirle (git log çok commit varsa true, yeni scaffold ise false)
3. Çıktı ver, complete çağır

## Çıktı

```
STATUS: done
EXISTING_CODE: false
```

Detaylı kurallar bu promptun altındaki `Kurallar` bölümünde gömülü olarak verilir; `rules.md` dosyasını okumaya çalışma.

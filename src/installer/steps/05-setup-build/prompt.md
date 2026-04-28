SETUP-BUILD step — build hazır, onayla ve geç.

## Repo durumu

REPO: {{REPO}}
TECH_STACK: {{TECH_STACK}}
BUILD_CMD önerisi: {{BUILD_CMD_HINT}}

Pipeline preClaim'de şunları yaptı:
- npm install (deps yüklendi)
- npm run build (baseline yeşil)
- Compat engine (React/Next uyumsuzlukları kontrol edildi)
- Tailwind install (gerekiyorsa)
- stitch-to-jsx ran → src/screens/*.tsx üretildi, commit'lendi

## Yapılacaklar

1. BUILD_CMD değerini yaz (hint'i kullan veya karar ver)
2. Çıktı ver, complete çağır

## Çıktı

```
STATUS: done
BUILD_CMD: npm run build
```

Detaylı kurallar bu promptun altındaki `Kurallar` bölümünde gömülü olarak verilir; `rules.md` dosyasını okumaya çalışma.

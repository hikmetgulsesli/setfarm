DESIGN step — Stitch ekranlarını doğrula + SCREEN_MAP üret.

Pipeline Stitch API ile ekranları SENİN İÇİN üretti — `stitch/` altında HTML dosyaları + `DESIGN_MANIFEST.json` var.

## Repo

REPO: {{REPO}}
PRD ekran sayısı: {{PRD_SCREEN_COUNT}}

## Yapılacaklar

1. `stitch/` dizinindeki HTML dosyaları validate et (size > 500 bytes, Türkçe metin, dark mode)
2. PRD ekran tablosuyla cross-reference yap
3. `stitch/design-tokens.css` üret (renkler, fontlar, spacing)
4. SCREEN_MAP üret (her ekran için screenId + name + type + description)
5. DESIGN_SYSTEM kararını rapor et (aesthetic + palette + fonts)
6. Aşağıdaki KEY: VALUE formatında çıktı ver

## Çıktı

```
STATUS: done
DEVICE_TYPE: DESKTOP|TABLET|MOBILE
DESIGN_SYSTEM: <JSON>
SCREEN_MAP:
[
  {"screenId": "<hash>", "name": "<Türkçe başlık>", "type": "<menu|...>", "description": "<1 cümle>"}
]
```

Detaylı kurallar: rules.md (aşağıda eklendi).

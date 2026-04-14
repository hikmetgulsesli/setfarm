DESIGN step — Stitch ekranları + tokens hazır, sen sadece DESIGN_SYSTEM rapor ver.

## Repo

REPO: {{REPO}}
PRD ekran sayısı: {{PRD_SCREEN_COUNT}}

## Hazır olan (pipeline tarafından üretildi)

- stitch/*.html, *.png — ekranlar
- stitch/DESIGN_MANIFEST.json — screenId+title listesi
- stitch/design-tokens.css + design-tokens.json — renkler/fontlar
- SCREEN_MAP context'e otomatik enjekte edildi:

```json
{{SCREEN_MAP}}
```

## Senin işin

1. `stitch/design-tokens.css` (veya `.json`) dosyasını oku
2. DESIGN_SYSTEM JSON'unu üret (palette + fonts + aesthetic)
3. SCREEN_MAP'i (yukarıdaki) çıktıya geri ver — değiştirme
4. Aşağıdaki KEY: VALUE formatında çıktı yaz, sonra `step complete` çağır

## Çıktı

```
STATUS: done
DEVICE_TYPE: DESKTOP
DESIGN_SYSTEM: <JSON>
SCREEN_MAP: <yukarıdaki JSON aynısı>
```

Detaylı kurallar: rules.md (aşağıda eklendi).

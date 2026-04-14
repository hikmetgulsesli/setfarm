# DESIGN Step — Kurallar

Pipeline Stitch API ile ekranları **otomatik üretir** (preClaim hook). Senin işin: doğrula, sınıflandır, design token'ları çıkar.

## Yapma — DO NOT

- Stitch API'yi sen çağırma (`generate-screen`, `create-project`, `list-screens` YASAK)
- Yeni HTML üretme — sadece `stitch/` altındaki dosyaları doğrula
- Layout/CSS değiştirme — Stitch çıktısı sabit baseline
- Kod yazma — design step'in çıktısı SCREEN_MAP + DESIGN_SYSTEM

## Phase 1: Inputs

1. PRD'yi oku (özellikle `## Ekranlar` tablosu)
2. `references/design-standards.md` — palette, font, anti-pattern
3. `stitch/` dizinindeki HTML dosyaları (DESIGN_MANIFEST.json)
4. Device type belirle: mobil → `MOBILE`, tablet → `TABLET`, varsayılan → `DESKTOP`

## Phase 2: Validate

Her HTML için:
- Boyut > 500 bytes (küçükse download fail)
- Renk değerleri palette'le tutarlı
- Font familyleri seçilen font pair'le aynı (Inter/Roboto/Arial YASAK)
- Türkçe metin (İngilizce default değil)
- Dark mode CSS (`prefers-color-scheme: dark` veya `[data-theme="dark"]`)
- Layout PRD ekran açıklamasıyla eşleşiyor

PRD ekran tablosu ile cross-reference: eksik ekran var mı, fazla ekran var mı?

## Phase 3: Tutarlılık

Tüm ekranlar için:
- Heading + body font tutarlı
- Primary/accent/surface renkleri eşleşiyor
- Spacing scale (4/8/16/24/32/48/64 px)
- Border-radius, shadow, button/card pattern'leri tutarlı
- Hover/focus state tanımlı, transition 150-200ms

## Phase 4: Design Tokens

İlk HTML'den CSS custom properties çıkar → `stitch/design-tokens.css`:
- `--color-*` (primary, accent, bg, surface, text, border)
- `--font-*` (heading, body, mono)
- `--spacing-*`, `--radius-*`, `--shadow-*`

## Phase 5: SCREEN_MAP

Her ekran için:
- `screenId` (Stitch'ten gelen, hash)
- `name` (PRD'deki Türkçe başlık)
- `type` (`menu | list-view | detail | form | dashboard | game | settings | result | info | error`)
- `description` (1 cümle, ne için)

PRD'deki tüm ekranlar dahil olmalı.

## Output Format

```
STATUS: done
DEVICE_TYPE: DESKTOP|TABLET|MOBILE
DESIGN_SYSTEM: <aesthetic + palette + fonts JSON>
SCREEN_MAP:
[
  {"screenId": "...", "name": "Ana Menü", "type": "menu", "description": "..."}
]
```

## Yapma

- DESIGN_MANIFEST.json üzerinden DUPLICATE oluşturma
- Her HTML için ayrı ayrı Stitch API çağırma
- Layout/CSS değiştirip kaydetme
- İngilizce screen adı (PRD'deki Türkçe başlığı kullan)

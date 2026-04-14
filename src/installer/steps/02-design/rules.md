# DESIGN Step — Kurallar

Pipeline her şeyi hazırladı:
- Stitch ekranları üretildi (`stitch/*.html`, `*.png`)
- `stitch/DESIGN_MANIFEST.json` (screenId+title liste)
- `stitch/DESIGN_DOM.json` (element-level)
- `stitch/design-tokens.css` + `design-tokens.json` (renkler, fontlar)
- `SCREEN_MAP` context'e otomatik enjekte edildi (manifest'ten)

Senin işin **tek karar**: DESIGN_SYSTEM raporu (aesthetic + palette + fonts).

## Yapma — DO NOT

- Stitch API çağırma (zaten üretildi)
- HTML/CSS değiştirme
- SCREEN_MAP elle yazma — pipeline auto-generated
- design-tokens.css üretme (Stitch zaten verdi)

## Yapılacaklar

1. `stitch/design-tokens.css` veya `design-tokens.json` dosyalarını oku
2. Renk paleti, font ailesi, aesthetic'i çıkar
3. DESIGN_SYSTEM JSON üret (aşağıdaki schema)
4. (Opsiyonel) SCREEN_MAP'i context'ten al, type'larda override gerekiyorsa düzelt
5. Output ver

## DESIGN_SYSTEM Schema

```json
{
  "aesthetic": "minimal|brutalist|luxury|editorial|industrial|organic|playful|corporate",
  "palette": {
    "primary": "#hex",
    "secondary": "#hex",
    "background": "#hex",
    "surface": "#hex",
    "text": "#hex",
    "border": "#hex",
    "success": "#hex",
    "error": "#hex",
    "warning": "#hex"
  },
  "typography": {
    "heading": "Font Name",
    "body": "Font Name"
  },
  "iconLibrary": "lucide|heroicons",
  "borderRadius": "4|8|12|16",
  "spacing": "4|8|16|24|32|48|64"
}
```

## Aesthetic Seçim Rehberi

design-tokens'tan çıkardığın görsel karaktere göre:
- **minimal**: bol whitespace, sade renk (1-2), sans-serif body
- **brutalist**: kalın font, yüksek kontrast, geometrik
- **luxury**: serif heading, koyu palette + altın aksent
- **editorial**: serif heading, columns, typography vurgu
- **industrial**: monospace, technical, blueprint
- **organic**: yumuşak köşeler, doğal renkler, akıcı font
- **playful**: parlak renkler, yuvarlak köşeler, friendly
- **corporate**: mavi tonlar, professional, serious

## Output Format

```
STATUS: done
DEVICE_TYPE: DESKTOP|TABLET|MOBILE
DESIGN_SYSTEM:
{
  "aesthetic": "...",
  "palette": { ... },
  "typography": { ... },
  ...
}
SCREEN_MAP:
[
  {"screenId": "...", "name": "...", "type": "...", "description": "..."}
]
```

SCREEN_MAP context'te zaten dolu — sadece olduğu gibi geri verirsin (Türkçe screen isimleri ve type'lar pipeline'da otomatik atandı).

## Yanlış output örneği (yapma)

- "DESIGN_SYSTEM not generated yet, working on it..." (yarım iş)
- Stitch API'a yeni çağrı yapma (yasak)
- SCREEN_MAP'i sıfırdan yazma (pipeline'a saygı)
- HTML dosyalarını editleyip kaydetme (immutable baseline)

STORIES step — PRD'yi user story listesi olarak parçala.

## Inputs (context'ten)

- PRD: Plan step çıktısı (full text)
- SCREEN_MAP: Design step çıktısı (screen ID + Türkçe başlık + tip)
- DESIGN_SYSTEM: Design step seçimi (font, palette, aesthetic)
- PREDICTED_SCREEN_FILES: Stitch-to-JSX'in üreteceği tam dosya yolları (`src/screens/<TurkishName>.tsx`)

## Yapılacaklar

1. PRD'yi modüllere böl (independent functional units)
2. Her modül için 1 story yaz (model + API + UI + test)
3. Her ekran (SCREEN_MAP'ten) tam 1 story tarafından scope'lansın
4. Bağımlılık: US-001 = setup+schema, son story = integration wiring
5. scope_files dosyaları PREDICTED_SCREEN_FILES'tan kullan (hayali yol YASAK)
6. SCREEN_MAP'i güncelle (her ekran için `stories` alanı)
7. Aşağıdaki KEY: VALUE formatında çıktı ver

## Çıktı

```
STATUS: done
STORIES_JSON:
[
  { "id": "US-001", "title": "...", "description": "...",
    "acceptanceCriteria": [...], "depends_on": [],
    "screens": [...], "scope_files": [...], "shared_files": [],
    "scope_description": "..." }
]
SCREEN_MAP:
[
  { "screenId": "...", "name": "...", "type": "...", "description": "...", "stories": ["US-001"] }
]
```

Detaylı kurallar: rules.md (aşağıda eklendi).

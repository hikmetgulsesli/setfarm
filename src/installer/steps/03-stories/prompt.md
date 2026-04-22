STORIES step — PRD'yi user story listesi olarak parçala.

## REPO

{{REPO}}

## PRD

{{PRD}}

## SCREEN_MAP

{{SCREEN_MAP}}

## DESIGN_SYSTEM

{{DESIGN_SYSTEM}}

## PREDICTED_SCREEN_FILES

Stitch-to-JSX'in üreteceği tam dosya yolları — scope_files'ta BU YOLLARI kullan.

{{PREDICTED_SCREEN_FILES}}

## Yapılacaklar

1. PRD'yi modüllere böl (independent functional units)
2. Her modül için 1 story yaz (model + API + UI + test)
3. Her ekran (SCREEN_MAP'ten) tam 1 story tarafından scope'lansın
4. Bağımlılık: US-001 = setup+schema, son story = integration wiring
5. scope_files dosyaları PREDICTED_SCREEN_FILES'tan kullan (hayali yol YASAK)
6. SCREEN_MAP'i güncelle (her ekran için `stories` alanı)
7. Aşağıdaki KEY: VALUE formatında çıktı ver

## Örnek Story (referans — yapıyı kopyala)

```
{
  "id": "US-002",
  "title": "Sayaç Core — değer, artır/azalt, reset",
  "description": "Ana sayaç mantığı: değer state, increment/decrement/reset işlemleri, localStorage persistence",
  "acceptanceCriteria": [
    "Kullanıcı + butonuna tıklayınca değer artmalı",
    "Kullanıcı - butonuna tıklayınca değer azalmalı",
    "Reset butonu değeri 0'a dönsürmeli",
    "Sayfa yenilenince son değer korunmalı"
  ],
  "depends_on": [],
  "screens": ["SCR-001"],
  "scope_files": [
    "src/hooks/useCounter.ts",
    "src/components/Counter.tsx",
    "src/screens/AnaSayaSayac.tsx"
  ],
  "shared_files": ["src/types/index.ts"],
  "scope_description": "Hook + component + screen = 3 dosya tam feature-slice"
}
```

Her story EN AZ 3 dosya içermelidir (hook + component + test, VEYA component + type + screen gibi). Tek-dosya story YASAK.

## Çıktı Formatı

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

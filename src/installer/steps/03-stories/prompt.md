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

## DESIGN_DOM_PREVIEW

Her ekranın element özeti (button/input listesi). scope_files seçerken bu bilgiyi kullan —
ekranın hangi component/hook'ları gerektirdiğini tahmin etmek için. Aynı button ≥2 ekranda
varsa shared_files'a koy.

{{DESIGN_DOM_PREVIEW}}

## Yapılacaklar

1. PRD'yi modüllere böl (independent functional units)
2. Her modül için 1 story yaz (model + API + UI + test)
3. Her ekran (SCREEN_MAP'ten) tam 1 story tarafından scope'lansın
4. Bağımlılık: US-001 = setup+schema, son story = integration wiring
5. scope_files dosyaları PREDICTED_SCREEN_FILES'tan kullan (hayali yol YASAK)
6. DESIGN_DOM_PREVIEW'deki button/input sayısına göre scope_files'ı genişlet — 10+ element olan ekran muhtemelen ≥2 ek component (hook + util) gerektirir
7. Ortak component'leri (Button, Input, Modal tekrarı) shared_files'a yaz
8. SCREEN_MAP'i güncelle (her ekran için `stories` alanı)
9. Aşağıdaki KEY: VALUE formatında çıktı ver

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

**OPSİYONEL ama önerilen**: Her scope_files dosyası için `file_skeletons` objesi ekle
(key = dosya yolu, value = 1-cümle rol özeti). Implement agent'ı bu iskeletten çalışarak
çakışmayı önler. Örnek:

```
"file_skeletons": {
  "src/hooks/useCounter.ts": "Counter state + increment/decrement/reset + localStorage sync",
  "src/components/Counter.tsx": "Display value + button triggers",
  "src/screens/AnaSayfa.tsx": "Ana sayfa kapsayıcısı — Counter'ı render eder"
}
```

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

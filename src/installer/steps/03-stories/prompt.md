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

1. **TEK ANA YAPI / STORY**. Her story bir konsept: bir component-family VEYA bir hook+utility VEYA bir screen+flow. ASLA birden fazla konsept bir story'de birleşme.
2. **Setup ayrı, feature ayrı, integration ayrı**:
   - US-001: SADECE proje kurulumu (scaffold, package.json, configs, types file). Feature kodu YOK.
   - US-002..N: Her biri tek feature (1 hook+test VEYA 1 component+test+style VEYA 1 screen+routing)
   - Son story: integration wiring (App.tsx, routes, layout)
3. **Context bloat önleme**: Her story implement edilirken model scaffold+test+commit yapmalı. Büyük story = model context overflow = session ölür. Story ne kadar dar, o kadar sağlam.
4. Her ekran (SCREEN_MAP'ten) tam 1 story tarafından scope'lansın. scope_files'a PREDICTED_SCREEN_FILES'tan al (hayali yol YASAK).
5. DESIGN_DOM_PREVIEW'deki button/input sayısına göre scope ayar: 15+ element ekran = story'yi alt-component'lere böl (form ayrı, list ayrı).
6. Ortak component'leri (Button, Input, Modal tekrar) shared_files'a yaz.
7. SCREEN_MAP'i güncelle (her ekran için `stories` alanı).
8. Aşağıdaki KEY: VALUE formatında çıktı ver.

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

Her story konsept-bazlı — tek feature-slice veya tek yapı. Tek-dosya story YASAK, 6+ dosyalı story de YASAK (context bloat). Doğal sınır: 2-5 dosya.

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

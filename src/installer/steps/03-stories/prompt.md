STORIES step — PRD'yi user story listesi olarak parçala.

## REPO

{{REPO}}

## PRD

{{PRD}}

## SCREEN_MAP

{{SCREEN_MAP}}

## DESIGN_SYSTEM

{{DESIGN_SYSTEM}}

## USER STORY LIMIT

{{STORY_COUNT_HINT}}

If this says `MAX_STORIES=N`, total STORIES_JSON length MUST be <= N,
including setup and integration. Combine small concerns into the nearest
functional story instead of exceeding the explicit user cap.

## PREDICTED_SCREEN_FILES

Stitch-to-JSX'in üreteceği tam dosya yolları — scope_files'ta BU YOLLARI kullan.

{{PREDICTED_SCREEN_FILES}}

## DESIGN_DOM_PREVIEW

Her ekranın element özeti (button/input listesi). scope_files seçerken bu bilgiyi kullan —
ekranın hangi component/hook'ları gerektirdiğini tahmin etmek için. Aynı button ≥2 ekranda
varsa shared_files'a koy.

{{DESIGN_DOM_PREVIEW}}

## UI_BEHAVIOR_CONTRACT

Stitch DOM extractor'ın çıkardığı davranış kontratı. Kodlama başlamadan ÖNCE bu kontratı
story acceptanceCriteria içine dağıt. Her satır için tam bir owner story olmalı:
trigger label/icon + beklenen görünür davranış. Settings/history/profile gibi PRD'de açıkça
yazmayan ama Stitch'te görünen kontroller de ya gerçek route/panel/dialog açmalı ya da story'de
bilinçli disabled/hidden kararı olarak belirtilmeli. Aktif görünen buton boş bırakılamaz.

{{UI_BEHAVIOR_CONTRACT}}

## Yapılacaklar

0. **PROJE KONSEPTİ KİLİTLİ**. Story title/description/acceptanceCriteria PRD ve kullanıcı task'ındaki ana domain kelimelerini korumalı. Sayaç projesinden oyun, not projesinden CRM, şirket sayfasından todo app uydurmak YASAK. Emin değilsen PRD'deki ürün adını ve ana aksiyonları aynen kullan.
1. **TEK ANA YAPI / STORY**. Her story bir konsept: bir component-family VEYA bir hook+utility VEYA bir screen+flow. ASLA birden fazla konsept bir story'de birleşme.
2. **Setup ayrı, feature ayrı, integration ayrı**:
   - US-001: SADECE proje kurulumu (scaffold, package.json, configs, types file). Feature kodu YOK.
   - US-002..N: Her biri tek feature (1 hook+test VEYA 1 component+test+style VEYA 1 screen+routing)
   - Son story: integration wiring (App.tsx, routes, layout)
3. **Context bloat önleme**: Her story implement edilirken model scaffold+test+commit yapmalı. Büyük story = model context overflow = session ölür. Story ne kadar dar, o kadar sağlam.
4. Her ekran (SCREEN_MAP'ten) tam 1 story tarafından scope'lansın. scope_files'a PREDICTED_SCREEN_FILES'tan al (hayali yol YASAK).
5. DESIGN_DOM_PREVIEW'deki button/input yapısına göre scope ayar — ekran birden fazla konsepti birleştiriyorsa (form + list + detail gibi) her konsept ayrı story. Element sayısına değil, yapısal ayırıma göre böl.
6. Ortak component'leri (Button, Input, Modal tekrar) shared_files'a yaz.
7. UI_BEHAVIOR_CONTRACT'teki her button/link/input için acceptanceCriteria yaz. Kriterler mekanik olmalı: `"Ayarlar" icon button opens settings panel`, `"Kayıtlar" navigates to history/logs`, `"Artır" increases visible count` gibi.
8. SCREEN_MAP'i güncelle (her ekran için `stories` alanı).
9. Aşağıdaki KEY: VALUE formatında çıktı ver.

## Story Şeması (referans — alanları doldur, örnek isimleri kopyalama)

`<...>` içindeki placeholder'ları gerçek PRD domain adları ve PREDICTED_SCREEN_FILES
yollarıyla değiştir. Çıktıya `<domain>` veya `<PredictedScreenName>` aynen yazmak HATA.

```
{
  "id": "US-002",
  "title": "<PRD domain> — tek fonksiyonel slice",
  "description": "PRD'deki gerçek domain aksiyonlarını kapsayan net iş parçası",
  "acceptanceCriteria": [
    "PRD'deki birinci kabul kriteri kodla karşılanmalı",
    "İlgili UI aksiyonu gerçek state/veri değişikliği üretmeli",
    "Gerekli persistence/API/validation davranışı doğrulanmalı"
  ],
  "depends_on": [],
  "screens": ["SCR-001"],
  "scope_files": [
    "src/features/<domain>/<domain>State.ts",
    "src/components/<DomainPanel>.tsx",
    "src/screens/<PredictedScreenName>.tsx"
  ],
  "shared_files": ["src/types/index.ts"],
  "scope_description": "State/helper + component family + ilgili screen-flow"
}
```

Her story konsept-bazlı böl — **tek ana yapı**: bir hook, bir component-family, bir screen-flow, VEYA bir utility-module. Birden fazla konseptin birleştiği story YASAK. Dosya sayısı konsept gerektiği kadar — 1, 3, 10, 15 farketmez. Kural yok, yapıya sadakat.

**OPSİYONEL ama önerilen**: Her scope_files dosyası için `file_skeletons` objesi ekle
(key = dosya yolu, value = 1-cümle rol özeti). Implement agent'ı bu iskeletten çalışarak
çakışmayı önler. Örnek:

```
"file_skeletons": {
  "src/features/<domain>/<domain>State.ts": "PRD domain state + actions + persistence/API boundary",
  "src/components/<DomainPanel>.tsx": "PRD domain UI controls + event handlers",
  "src/screens/<PredictedScreenName>.tsx": "PREDICTED_SCREEN_FILES içindeki gerçek screen dosyasını domain component ile bağlar"
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

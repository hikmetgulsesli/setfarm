# STORIES Step — Kurallar

PRD + SCREEN_MAP + DESIGN_SYSTEM'i okuyup user story listesi üret. Her story dosya bazlı (model + API + UI + test). Modüller arası bağımlılık doğru, scope dosya çakışması yok.

## Inputs

- `prd` — Plan step PRD
- `screen_map` — Design step SCREEN_MAP (screenId+name+type)
- `design_system` — Design step seçimi (font, palette)
- `predicted_screen_files` — context'te verilir; her screen için tam dosya yolu (`src/screens/<TurkishName>.tsx`)

Not: Stories step `setup-repo` öncesinde çalışır. Repo yolu henüz oluşturulmamış
olabilir; `REPO/PRD.md`, `package.json` veya kaynak dosyaları zorunlu input
değildir. PRD ve tasarım bilgisi claim içinde gömülü gelir; stories planlaması
bu gömülü inputlardan yapılmalıdır.

## Story Format (zorunlu alanlar per story)

```json
{
  "id": "US-001",
  "title": "Türkçe başlık",
  "description": "1-2 paragraf — DB tabloları, API endpoint'leri, UI bileşenleri",
  "acceptanceCriteria": ["Kriter 1", "Tests pass", "Typecheck passes"],
  "depends_on": ["US-X"] veya [],
  "screens": ["screen-id-1"],
  "scope_files": ["src/lib/foo.ts", "src/screens/Bar.tsx"],
  "shared_files": ["src/App.tsx"],
  "scope_description": "1 cümle — ne, ne değil"
}
```

## Story Boyutu — Hedef

- 15-25 dakika / story
- 200-500 LOC / story
- **MIN 3, MAX 6 dosya / story** (YASAK: tek dosyalık story — model 1-file scope verdiğinde "tam app yaz" refleksi gösteriyor, SCOPE_BLEED döngüsüne giriyor)
- Max 5 acceptance criteria / story (fazlaysa böl)

### Feature-complete paketleme kuralı

Her story **bağımsız çalışır bir feature dilimi** olmalı. Tek component değil:
- Ana component(ler) + hook(lar) + type(lar) + test (3-6 dosya toplam)
- Ya da ekran + ona bağlı tüm destek dosyaları
- Single-file (örn sadece bir display component dosyası) = HATA — modeli paradox'a sokar

Eğer bir feature doğal olarak 1 dosyaysa, yakınındaki ilgili dosyalarla birleştirip tek story yap.

Çok büyük örnekler:
- "Tüm dashboard'u yap" → ayrı: KPI kartları, aktivite akışı, grafikler, filtreler
- "Auth ekle" → schema+middleware, login UI, session

## Sıralama (depends_on)

1. **US-001:** Project setup + design tokens + DB schema (depends_on: [])
2. US-002+: Core moduller (depends_on US-001)
3. **Son story:** Integration wiring (App.tsx, main.tsx, index.css) — depends_on: tüm diğerleri

Geç story'ler erken story'lere bağlanır. Tersi YASAK.

## scope_files & shared_files

- **`scope_files`**: Story'nin SADECE kendi modifiye edebileceği dosyalar. Liste dışı dosya = SCOPE_BLEED reject.
- **`shared_files`**: Story'nin OKU/REFERANS amaçlı görebileceği shared dosyalar (örn. integration story'nin App.tsx'ı). Çok az kullan.
- **`scope_description`**: 1 cümle — bu story nelere dokunur, nelere DOKUNMAZ.

### Çakışma kuralı

İki story aynı dosyayı `scope_files`'a koyamaz. Pipeline `overlap auto-fix` ile ortak dosyayı birinin scope'undan siler, diğerinin shared_files'ına ekler. Önlem: planlama sırasında çakışma yapma.

## SCREEN FILES — `predicted_screen_files` Kullanımı (MUTLAK)

Stitch-to-JSX `src/screens/<ComponentName>.tsx` üretir. Türkçe transliterasyon:
- "Oyun Ekranı" → `src/screens/OyunEkrani.tsx`
- "Ana Menü" → `src/screens/AnaMenu.tsx`

Context'te `PREDICTED_SCREEN_FILES` listesi verilir. **scope_files'a TAM bu yolları koy.** YASAK:
- `src/pages/GameScreen.tsx` (İngilizce hayali)
- `src/views/MainMenu.tsx` (yanlış dizin)
- `src/components/screens/...` (hayali yol)

Her screen tam 1 story tarafından scope'lanmalı. Dağıtım rehberi:
- Menü/liste → 1 story
- Ana fonksiyonel ekran → kendi story'si
- Sonuç/bildirim → ilgili fonksiyonel story ile birlikte
- Ayarlar/profil → ayrı geç story

## SCREEN_MAP Update

Stories step çıktısında SCREEN_MAP'i güncelle. Her ekran için `stories: ["US-N"]` ekle.

## BANNED scope_files (entegrasyon hariç)

Bu dosyalar SADECE integration story'nin scope_files'ında olabilir:
- `src/App.tsx`, `src/main.tsx`, `src/index.tsx`
- `src/index.css`, `src/App.css`
- `package.json`, `tsconfig.json`, `vite.config.*`, `next.config.*`, `tailwind.config.*`

Diğer story'ler bunları okuma referansı için `shared_files`'a koyabilir, scope'a değil.

## Acceptance Criteria

İyi (mekanik doğrulanabilir):
- "Kullanıcı X butonuna basınca Y görür"
- "Form validation: zorunlu alan boşken submit YASAK, hata gösterilir"
- "Tests pass" + "Typecheck passes" (her story sonunda zorunlu)

### UI Behavior Contract

- `UI_BEHAVIOR_CONTRACT` varsa her button/link/input en az bir story acceptance criterion içinde geçmeli.
- Criterion sadece "buton var" dememeli; davranışı yazmalı: route değişimi, panel/dialog açılması, state/localStorage değişimi, filter/search sonucu, validation feedback.
- Icon-only kontroller için hem görünen/erişilebilir isim hem ikon anlamı kullanılmalı; örnek isim uydurma, PRD/Stitch/DESIGN_DOM içindeki gerçek label ve icon değerlerini kullan.
- PRD'de olmayan ama Stitch'te aktif görünen kontroller de boş bırakılamaz. Ya projeye uygun gerçek davranışla story'ye girer ya da acceptance criterion içinde disabled/hidden kararı açıkça yazılır.

Kötü (belirsiz):
- "Tasarım modern olur" (subjektif)
- "Performans iyi" (ölçülemez)

## Output Format

```
STATUS: done
STORIES_JSON:
[
  { "id": "US-001", "title": "...", "description": "...", "acceptanceCriteria": [...], "depends_on": [], "screens": [...], "scope_files": [...], "shared_files": [], "scope_description": "..." }
]
SCREEN_MAP:
[
  { "screenId": "...", "name": "...", "type": "...", "description": "...", "stories": ["US-001"] }
]
```

## Yapma

- Plan step'inde verilmeyen TECH_STACK kararı yapma
- Hayali screen yolları kullanma (PREDICTED_SCREEN_FILES kullan)
- Çok büyük story (>500 LOC, >5 criteria) yazma
- İki story aynı dosyayı scope_files'a koyma
- 0 story, eksik scope_files, eksik scope_description
- App.tsx'ı integration dışında bir story'ye scope_files'a koyma

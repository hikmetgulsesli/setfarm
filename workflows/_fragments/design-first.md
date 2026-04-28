# DESIGN-FIRST (ZORUNLU)

Aşağıdaki Stitch dosyaları tasarım kaynağıdır. Prompt'a bütün HTML basılmaz;
gerekli ekranı WORKDIR içinde dosyadan oku. Sadece mevcut story'nin scope_files
dosyalarını yaz.

STORY SCREENS:
{{story_screens}}

STITCH FILES TO READ:
- stitch/DESIGN_MANIFEST.json
- stitch/design-tokens.css
- stitch/DESIGN_DOM.json
- STORY_SCREENS içindeki ilgili stitch/*.html dosyaları

DESIGN TOKENS:
{{design_tokens}}

DESIGN DOM:
Prompt excerpt'i kısadır. Tam yapı gerektiğinde sadece bu story ekranlarını
stitch/DESIGN_DOM.json içinden oku; tüm proje DOM'unu prompt'a kopyalama.

UI CONTRACT (auto-generated from Stitch design — EVERY element MUST work):
{{ui_contract}}

LAYOUT STRUCTURE (auto-extracted from Stitch HTML — REPRODUCE THIS EXACTLY):
{{layout_skeleton}}

DESIGN ENFORCEMENT (MANDATORY):
- FONTS: Google Fonts <link> in index.html <head>:
  1. Stitch HTML'deki TÜM font link'lerini kopyala (Space Grotesk, DM Sans, vb.)
  2. Material Symbols Outlined ZORUNLU — Stitch ikon kullanıyorsa bu font MUTLAKA olmalı:
     <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
  3. Stitch HTML'deki <head> içindeki font <link> etiketlerini AYNEN kopyala, atlama.
  BANNED font-family values: system-ui, Roboto, Arial, Inter, Helvetica.
- COLORS: design-tokens.css'teki renkleri kullan. Kendi hex/rgb tanımlama.
  HARDCODED RENK YASAK: #hex veya rgb() değeri YAZMA — her zaman var(--color-*) kullan.
  Stitch HTML'de hex görsen bile, karşılık gelen design token'ı bul ve onu kullan.
  Örnek: bg-[#13091e] YANLIŞ → bg-surface DOĞRU, text-[#bd9dff] YANLIŞ → text-primary DOĞRU
- LAYOUT: Stitch HTML'deki flex/grid yapısını birebir koru.
- NEVER: emoji icons, purple gradients, transition:all
- ALWAYS: cursor-pointer on clickables, hover/focus states, focus-visible rings
- LINKS: NEVER use href="#" — every link MUST point to a real route.
- HANDLERS: NEVER use onClick={() => {}} or console.log() — every handler MUST do something real.

DİL (ZORUNLU): Tüm görünür metin TÜRKÇE. "Current Tally", "Settings", "Home" gibi İngilizce metinler YASAK. Teknik terimler hariç her şey Türkçe. Placeholder, aria-label, title, error mesajları dahil.
  Buton tıklanınca state değişmeli, modal açılmalı, veya route değişmeli. console.log YASAK.

DESIGN CONTRACT RULES:
1. Every navigation link MUST route to its page (install react-router-dom if needed)
   Stitch'te bir buton veya link varsa ama hedef sayfa/panel PRD'de yoksa,
   önce projeye uygun gerçek davranış üret; gerçekten kapsam dışıysa kontrolü açıkça disabled/hidden yap.
   Boş bırakma, console.log yazma, örnek sayfa/panel isimleri uydurma.
2. Every button MUST have a functional onClick handler — state değiştirmeli,
   modal/drawer açmalı, veya route değiştirmeli. console.log() YASAK.
3. Every input MUST have onChange and controlled state
4. All hardcoded demo data MUST be replaced with dynamic props/state

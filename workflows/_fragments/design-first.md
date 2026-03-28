# DESIGN-FIRST (ZORUNLU)

Aşağıdaki STITCH HTML bu sayfanın TASARIMINI gösterir. Bu layout'u AYNEN uygula.
design-tokens.css'i @import et. Kendi renk/font tanımlama YAPMA.
Uymazsan story REJECT edilecek.

STITCH HTML (BU LAYOUT'U KOPYALA):
{{stitch_html}}

DESIGN TOKENS:
{{design_tokens}}

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
  Buton tıklanınca state değişmeli, modal açılmalı, veya route değişmeli. console.log YASAK.

DESIGN CONTRACT RULES:
1. Every navigation link MUST route to its page (install react-router-dom if needed)
2. Every button MUST have a functional onClick handler
3. Every input MUST have onChange and controlled state
4. All hardcoded demo data MUST be replaced with dynamic props/state

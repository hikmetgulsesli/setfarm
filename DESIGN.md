# Design System Document

## 1. Overview & Creative North Star: "The Obsidian Loom"
This design system moves away from the "utility-first" aesthetic of standard productivity tools to embrace a high-end, editorial approach to time management. We view the calendar not as a grid of boxes, but as a woven tapestry of events. Our Creative North Star is **"The Obsidian Loom"**—a concept that emphasizes depth, tactile layering, and sophisticated typography.

By leveraging the geometric precision of **Space Grotesk** against the functional clarity of **DM Sans**, we create a rhythmic visual pace. We reject the "boxed-in" feeling of traditional calendars by utilizing intentional asymmetry, expansive negative space, and tonal shifts rather than rigid lines. This system is designed to feel like a premium physical planner translated into a digital, dark-mode masterpiece.

---

## 2. Colors: Tonal Architecture
We define space through light and shadow, not through strokes. The palette is anchored in deep charcoals and punctuated by a vibrant Indigo accent.

### Color Tokens (Material Mapping)
*   **Background (`surface-dim`):** `#131313` — The infinite canvas.
*   **Primary Accent (`primary`):** `#c0c1ff` — Used for active dates, primary CTAs, and focus states.
*   **Secondary Surface (`surface-container`):** `#201f1f` — Standard card background.
*   **High Elevation (`surface-container-highest`):** `#353534` — Popovers and active modal layers.
*   **Error (`error`):** `#ffb4ab` — Critical alerts or deleted events.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to define the 7-column calendar grid or to separate UI sections. Structure must be achieved through:
1.  **Background Shifts:** Place a `surface-container-low` (#1c1b1b) sidebar against a `surface` (#131313) main view.
2.  **Negative Space:** Use the Spacing Scale (specifically `8` and `12`) to create mental boundaries.

### The "Glass & Gradient" Rule
For floating elements (e.g., event previews or "Quick Add" buttons), use a semi-transparent `surface-container` with a `20px` backdrop-blur. Apply a subtle linear gradient to main buttons: `primary` (#c0c1ff) to `primary-container` (#8083ff) at a 135° angle to inject "soul" into the dark interface.

---

## 3. Typography: Editorial Rhythm
The contrast between the futuristic, expressive 'Space Grotesk' and the grounded 'DM Sans' (Inter-mapped) creates an authoritative yet approachable voice. All UI text must be in **Turkish**.

| Level | Token | Font Family | Size | Case/Style | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display** | `display-lg` | Space Grotesk | 3.5rem | Bold | Monthly Headers (e.g., **Ocak**) |
| **Headline** | `headline-sm` | Space Grotesk | 1.5rem | Medium | Section Titles (e.g., **Etkinlikler**) |
| **Title** | `title-md` | DM Sans | 1.125rem | Semi-Bold | Event Titles (e.g., **Tasarım Toplantısı**) |
| **Body** | `body-md` | DM Sans | 0.875rem | Regular | Descriptions (e.g., **Proje detayları...**) |
| **Label** | `label-sm` | DM Sans | 0.6875rem | All Caps | Weekdays (e.g., **PAZARTESİ**) |

---

## 4. Elevation & Depth: Tonal Layering
In this design system, height is indicated by color brightness, not drop shadows.

*   **The Layering Principle:** A "nested" event card should be `surface-container-low` sitting on a `surface-container` dashboard. This creates a soft, natural lift.
*   **Ambient Shadows:** Use only for floating modals. Set blur to `40px`, opacity to `8%`, and use the `on-surface` color (#e5e2e1) as the shadow tint. This mimics natural light bouncing off dark surfaces.
*   **The "Ghost Border":** If a separation is required for accessibility in the 7-column grid, use the `outline-variant` token (#464554) at **15% opacity**. It should be felt, not seen.

---

## 5. Components: Precision & Minimalist Flow

### Calendar Grid (7-Column Structure)
Avoid lines. Each day is a cell defined by its content. The "Today" state is marked by a `primary-fixed` circle behind the date number. Use `surface-container-lowest` (#0e0e0e) for "out of month" dates to push them into the background.

### Buttons (Düğmeler)
*   **Primary:** Rounded `lg` (0.5rem). Gradient fill. Typography: `title-sm` (Turkish: **Kaydet**, **Oluştur**).
*   **Secondary:** No background. `Ghost Border` (15% opacity). Typography: `title-sm` (Turkish: **İptal**).

### Event Cards (Etkinlik Kartları)
Forbid dividers. Use a `4px` vertical accent bar on the left of the card using the `tertiary` (#ffb783) color to categorize event types (e.g., Meetings vs. Personal).

### Input Fields (Giriş Alanları)
Use `surface-container-high` as the field background. Labels (Turkish: **Başlık**, **Saat**) should use `label-md` in `on-surface-variant` color. Active state is indicated by a `1px` bottom-only border in `primary`.

### Navigation (Navigasyon)
Minimalist vertical rail on the left. Icons only, with a `surface-bright` indicator for the active state. Use `title-md` for expanded states (Turkish: **Takvim**, **Görevler**, **Ayarlar**).

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical margins to create an editorial feel (e.g., a wider left margin for the month title).
*   **Do** use Turkish characters correctly (İ, ı, Ğ, ğ, Ü, ü, Ş, ş, Ö, ö, Ç, ç).
*   **Do** rely on `surface-container` shifts for hover states.

### Don't
*   **Don't** use pure black (#000000). Always use `surface-dim` (#131313) to maintain depth.
*   **Don't** use 100% opaque borders. It breaks the "Loom" aesthetic.
*   **Don't** crowd the 7-column grid. If a day has too many events, use a "+3 daha" (plus 3 more) label in `label-sm`.
*   **Don't** use standard blue for links. Always use the `primary` Indigo (#c0c1ff).
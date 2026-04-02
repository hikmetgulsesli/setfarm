STATUS: done
REPO: /home/setrox/projects/hikmet-set1
BRANCH: main
PROJECT_TYPE: ui
HAS_UI: true
DEVICE_TYPE: DESKTOP
TECH_STACK: nextjs
DB_REQUIRED: none
PRD:
# PRD v3 — hikmetgulsesli.com

## 1. Proje Genel Bakış

Hikmet Güleşli'nin kişisel web sitesi ve geliştirici portföyü. Koyu temalı, terminal estetiğine sahip modern bir portfolio platformu. Ziyaretçilere Hikmet'in projelerini, yazılarını ve profesyonel profilini sunan merkezi bir dijital varlık. Terminal/monospace tarzı UI elementleri, canlı durum göstergeleri ve hover micro-interaction'lar ile dinamik bir kullanıcı deneyimi sağlar.

**Temel Özellikler:**
- Koyu tema varsayılan, terminal estetiği
- Framer Motion tabanlı smooth animasyonlar
- Framer Motion ve React ile 60fps performans
- PWA-ready yapı
- SEO optimizasyonu ve structured data
- Responsive ve mobile-first tasarım
- Erişilebilirlik (WCAG 2.1 AA uyumlu)

---

## 2. Tasarım Sistemi

### 2.1 Renk Paleti

| İsim | Hex Kodu | Kullanım Alanı |
|------|----------|----------------|
| Background | `#0a0a0f` | Sayfa arka planı, ana zemin |
| Background Elevated | `#111113` | Kartlar, elevated yüzeyler |
| Background Subtle | `#1a1a1f` | Hover state, secondary surfaces |
| Background Overlay | `#0a0a0f/80` | Modal overlays, backdrop |
| Primary | `#10b981` | CTA butonları, aktif linkler, vurgular |
| Primary Hover | `#059669` | Buton hover durumu |
| Primary Muted | `#10b981/20` | Subtle primary backgrounds |
| Accent | `#6366f1` | Gradient efektler, secondary vurgular |
| Accent Alt | `#8b5cf6` | Gradient geçişleri |
| Accent Muted | `#6366f1/20` | Subtle accent backgrounds |
| Text Primary | `#fafafa` | Ana metin, başlıklar |
| Text Secondary | `#a1a1aa` | Alt başlıklar, açıklamalar |
| Text Muted | `#6b7280` | Placeholder, disabled metin |
| Text Inverse | `#0a0a0f` | Koyu arka plan üzerinde açık metin |
| Border | `#27272a` | Kart kenarlıkları, dividers |
| Border Hover | `#3f3f46` | Hover state border |
| Border Active | `#10b981` | Active/focus state border |
| Success | `#22c55e` | Başarı durumları |
| Warning | `#f59e0b` | Uyarı durumları |
| Error | `#ef4444` | Hata durumları |
| Info | `#3b82f6` | Bilgi durumları |

### 2.2 Tipografi

**Font Family:**
- Headings: `Space Grotesk, system-ui, sans-serif` — font-weight: 700
- Body: `Inter, system-ui, sans-serif` — font-weight: 400
- Code/Terminal: `JetBrains Mono, SF Mono, Consolas, monospace` — font-weight: 400
- Font Loading: `next/font/google` ile optimize edilmiş subset

**Font Sizes:**

| Name | Size | Line Height | Usage |
|------|------|-------------|-------|
| 2xs | `10px` | 1.4 | Legal text, timestamps |
| xs | `12px` | 1.5 | Captions, badges |
| sm | `14px` | 1.5 | Small body text |
| base | `16px` | 1.7 | Body text |
| lg | `18px` | 1.6 | Large body, lead |
| xl | `20px` | 1.5 | Section subtitles |
| 2xl | `24px` | 1.3 | H3 headings |
| 3xl | `30px` | 1.2 | H2 headings |
| 4xl | `36px` | 1.2 | H1 headings |
| 5xl | `48px` | 1.1 | Large headings |
| 6xl | `60px` | 1.0 | Display headings |
| 7xl | `72px` | 1.0 | Hero display |

### 2.3 Spacing Sistemi

Base unit: `4px`. Değerler: 0, px, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 20, 24 (her biri 4px katları).

### 2.4 Border Radius

| İsim | Değer | Kullanım |
|------|-------|----------|
| none | `0px` | Terminal-style elementler |
| sm | `4px` | Small badges |
| md | `8px` | Cards, buttons, inputs |
| lg | `12px` | Large cards, modals |
| xl | `16px` | Overlay elements |
| 2xl | `24px` | Featured cards |
| 3xl | `32px` | Special containers |
| full | `9999px` | Pills, avatars, status dots |

### 2.5 Shadows

| Name | CSS Value | Usage |
|------|-----------|-------|
| none | none | No shadow |
| sm | `0 1px 2px 0 rgb(0 0 0 / 0.05)` | Subtle elevation |
| base | `0 1px 3px 0 rgb(0 0 0 / 0.1)` | Default card shadow |
| md | `0 4px 6px -1px rgb(0 0 0 / 0.3)` | Elevated cards |
| lg | `0 10px 15px -3px rgb(0 0 0 / 0.4)` | Modals, dropdowns |
| xl | `0 20px 25px -5px rgb(0 0 0 / 0.4)` | Large overlays |
| 2xl | `0 25px 50px -12px rgb(0 0 0 / 0.5)` | Full-screen modals |
| glow-primary | `0 0 20px rgb(16 185 129 / 0.3)` | Primary color glow |
| glow-primary-lg | `0 0 40px rgb(16 185 129 / 0.4)` | Large primary glow |

### 2.6 Motion & Animasyon

| Name | Duration | Easing | Usage |
|------|----------|--------|-------|
| Fade In | 300ms | ease-out | Page loads, scroll reveals |
| Fade In Up | 400ms | ease-out | Cards, sections |
| Fade In Scale | 300ms | ease-out | Modals, tooltips |
| Slide In Left | 300ms | ease-out | Mobile menu |
| Scale Press | 100ms | ease-out | Button active |
| Card Hover | 200ms | ease-out | translateY(-4px) |
| Ping | 2s | ease-out | Status indicator, infinite |
| Typing | 80ms per char | linear | Hero typing effect |

---

## 3. Sayfalar

1. **Ana Sayfa** (`/`) — Hero section, öne çıkan projeler grid, son yazılar, CTA
2. **Projeler** (`/projects`) — Proje kartları grid, filtreleme, arama
3. **Proje Detay** (`/projects/[slug]`) — Proje detay, teknolojiler, linkler
4. **Blog** (`/blog`) — Yazı listesi, kategoriler, arama
5. **Blog Detay** (`/blog/[slug]`) — Yazı içeriği, TOC, yazar bilgisi
6. **Hakkında** (`/about`) — Profil, deneyim timeline, yetenekler
7. **İletişim** (`/contact`) — İletişim formu, sosyal medya linkleri

---

## 4. Sayfa Detayları

### 4.1 Ana Sayfa (`/`)
- Full-width hero (min-height: 100vh - header)
- Container: max-width `1280px`, padding `px-6 md:px-12`
- Hero: Terminal-style greeting `> Merhaba, ben Hikmet_`, typing animation for roles, gradient heading, CTA buttons
- Status badge with ping animation
- Social icons row: LinkedIn, GitHub, Twitter/X
- Öne Çıkan Projeler: `// featured_projects` terminal-style header, 3-col grid, max 6
- Son Yazılar: `// recent_writing` header, 3-col grid, max 3
- CTA Section: gradient border, centered text + primary button
- States: Loading (skeleton), Empty

### 4.2 Projeler Sayfası (`/projects`)
- Page header: title + description
- Filter bar: sticky, categories (Tümü, Web, Mobil, Açık Kaynak, Freelance)
- Search: Command palette (Cmd+K)
- Project Card: 16:9 thumbnail, title, description (2 lines), tech pills, GitHub/Demo links
- Hover: border-primary, translateY(-4px), shadow-glow
- States: Loading (6 skeleton), Empty, Error

### 4.3 Proje Detay Sayfası (`/projects/[slug]`)
- Hero thumbnail (max-height: 500px)
- Content: max-width `800px`
- Sticky sidebar: TOC + action buttons (desktop)
- Sections: header, overview, tech stack, gallery, challenges/solutions accordion, links, next/prev nav
- Code blocks: #0d0d12 bg, syntax highlighting, copy button
- States: Loading, Not Found (404), Draft

### 4.4 Blog Sayfası (`/blog`)
- Header: "Writing" title + description
- Search bar + category filter (Tümü, Teknik, Career, Kişisel, Tutorial)
- Articles grid: 2-col desktop, 1-col mobile
- Featured article: full-width card (if pinned)
- Article Card: date, title, excerpt (2 lines), tags
- Hover: border-primary, bg-background-elevated
- States: Loading (4 skeleton), Empty, No Results

### 4.5 Blog Detay Sayfası (`/blog/[slug]`)
- Max-width `720px` content area
- Header: title (display), date, author, read time, categories
- Featured image: full-width, max-height 400px
- Prose typography: custom heading styles, code inline/block, blockquote, lists, tables
- TOC: sticky sidebar (desktop), collapsible (mobile)
- Share buttons: Twitter, LinkedIn, Copy link
- Footer: tags, author bio card, related articles
- States: Loading, Not Found

### 4.6 Hakkında Sayfası (`/about`)
- Hero: circular avatar (200px, primary border, glow on hover) + intro text
- Name: gradient text, title: text-secondary, bio: max-width 600px
- Experience Timeline: vertical line, alternating left/right items, staggered fade-in animation
- Skills Grid: categories (Frontend, Backend, Database, DevOps, Tools, Soft Skills), icon + name + proficiency bar
- CV download button
- States: Loading (skeleton)

### 4.7 İletişim Sayfası (`/contact`)
- Split layout: form (left) + info (right) desktop; single column mobile
- Form Fields: firstName, lastName, email, subject, message (textarea)
- Validation: firstName/lastName (2-50, letters), email (valid format), subject (5-200), message (20-2000)
- Form States: idle, validating (on blur), submitting (disabled), success (toast + reset), error (toast + inline)
- Info Section: email (mailto), location (Türkiye, Europe/Istanbul), social links, availability status (green dot + text)

---

## 5. Global Bileşenler

### 5.1 Header Navigation
- Fixed, top: 0, height: 64px, bg: bg-background/80 + backdrop-blur(12px)
- Logo: gradient text, links to `/`
- Nav links: Ana Sayfa, Projeler, Blog, Hakkında, İletişim
- Mobile: hamburger → full-screen overlay

### 5.2 Footer
- bg: bg-background-elevated, border-top: 1px border
- Sections: About Snippet, Quick Links, Social, Copyright

### 5.3 Buttons
- Primary: bg-primary, hover:bg-primary-hover, shadow-glow, translateY(-1px)
- Secondary: transparent, border-border, hover:border-primary, bg-primary/10
- Ghost: transparent, hover:text-primary, hover:bg-background-subtle

### 5.4 Cards
- Base: bg-background-elevated, border-border, border-radius-lg
- Interactive: hover:border-primary, translateY(-2px), shadow-glow-primary-sm

### 5.5 Badge/Tag
- Variants: default, primary, secondary, accent, success, warning, error
- Sizes: sm (px-2 py-0.5), md (px-3 py-1)

### 5.6 Input Fields
- bg: bg-background-elevated, border-border, border-radius-md
- Focus: border-primary, ring-2 ring-primary/20
- Error: border-error, ring-2 ring-error/20

### 5.7 Status Indicator
- online (ping, bg-success), offline (none), busy (pulse, bg-error), away (none, bg-warning)

### 5.8 Cursor Glow Effect
- Radial gradient following cursor, primary (#10b981) at 15% opacity, 300px radius, disabled on mobile

### 5.9 Skeleton Loader
- Variants: text, circular, rectangular, card
- Animation: pulse (opacity 1→0.5→1) or wave (linear gradient sweep)

### 5.10 Toast Notifications
- Position: bottom-right desktop, bottom-center mobile
- Variants: default, success, error, warning, info
- Max 3 visible, older dismissed

### 5.11 Modal / Dialog
- Overlay: bg-black/80 + backdrop-blur(8px)
- Animation: fade + scale (0.95→1)
- Sizes: sm(320px), md(480px), lg(640px), xl(800px), full

### 5.12 Accordion
- Type: single or multiple
- Animation: height expand/collapse, 200ms ease-out

### 5.13 Tabs
- Border-bottom: 1px border
- Active: border-bottom-2 border-primary

### 5.14 Command Palette
- Trigger: Cmd+K (Mac) / Ctrl+K (Windows)
- Keyboard nav, debounce 300ms

### 5.15 Avatar
- Sizes: xs(24px) to 2xl(128px), border-radius-full
- Fallback: bg-primary, text-white

### 5.16 Image with Lightbox
- Click to open, arrow keys/swipe nav, Escape/X to close

---

## 6. Responsive Breakpoints

| Breakpoint | Min Width | Description |
|------------|-----------|-------------|
| mobile | `< 375px` | Ultra compact |
| mobile-lg | `375px` | Standard mobile |
| tablet-sm | `640px` | Large phones, small tablets |
| tablet | `768px` | Tablets, small laptops |
| desktop | `1024px` | Standard laptops |
| desktop-lg | `1280px` | Large screens |
| desktop-xl | `1536px` | Extra large |

---

## 7. Veri Modelleri

```typescript
interface Project extends BaseEntity {
  slug: string; title: string; description: string; shortDescription: string;
  thumbnail: string; images: string[];
  category: 'web' | 'mobile' | 'open-source' | 'freelance';
  techStack: TechItem[]; liveUrl?: string; githubUrl?: string;
  featured: boolean; publishedAt: string; status: 'draft' | 'published' | 'archived';
  content: string; // MDX
}

interface BlogPost extends BaseEntity {
  slug: string; title: string; excerpt: string; featuredImage?: string;
  category: 'teknik' | 'career' | 'kisisel' | 'tutorial';
  tags: string[]; readTime: number; publishedAt: string;
  status: 'draft' | 'published' | 'archived';
  content: string; author: Author; featured: boolean; pinned: boolean;
}

interface Author { id: string; name: string; avatar: string; title: string; bio: string; social: SocialLinks; }
interface Experience { title: string; company: string; startDate: string; endDate?: string; current: boolean; description: string; }
interface Skill { id: string; name: string; icon?: string; proficiency?: number; category: string; }
```

---

## 8. Teknoloji Stack

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Framework | Next.js | 14+ (App Router) | React framework |
| Language | TypeScript | 5.x | Type safety |
| Styling | Tailwind CSS | 3.4+ | Utility-first CSS |
| UI Components | shadcn/ui | latest | Accessible components |
| Icons | Lucide React | latest | Icon library |
| Animation | Framer Motion | 11+ | Animations |
| Content | MDX | 3.x | Blog/project content |
| Fonts | next/font/google | - | Optimized fonts |
| Forms | React Hook Form | 7.x | Form handling |
| Validation | Zod | 3.x | Schema validation |
| Hosting | Vercel | - | Deployment & CDN |

**Font Configuration:**
- Headings: Space Grotesk (700), latin subset
- Body: Inter (400, 500, 600, 700), latin subset
- Mono: JetBrains Mono (400, 500), latin subset

---

## 9. SEO & Metadata

**Default SEO:**
- title: 'Hikmet Güleşli' with template '%s | Hikmet Güleşli'
- description: 'Full-Stack Developer, UI/UX Designer. Modern web teknolojileri ile dijital ürünler geliştiriyorum.'
- openGraph: website type, tr_TR locale
- twitter: summary_large_image card

**Structured Data (JSON-LD):**
- Person Schema
- Article Schema for blog posts
- Breadcrumb Schema

**robots.txt:**
```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /_next/
Sitemap: https://hikmetgulsesli.com/sitemap.xml
```

---

## 10. Erişilebilirlik (WCAG 2.1 AA)

- Color contrast: AAA for primary text (14.5:1), AA for secondary (7.5:1)
- Focus indicators: 2px ring, primary color
- Skip to main content link
- Reduced motion: prefers-reduced-motion support
- Semantic HTML + proper heading hierarchy (h1→h2→h3)
- ARIA labels on all interactive elements

---

## 11. Performans Hedefleri

| Metric | Target | Strategy |
|--------|--------|----------|
| LCP | < 2.5s | Preload hero, priority hints |
| FID | < 100ms | Code splitting, defer non-critical JS |
| CLS | < 0.1 | Explicit dimensions, font-display: swap |
| TTFB | < 600ms | Edge caching, ISR |

---

## 12. Testing Strategy

- Unit: Vitest (component logic)
- Component: testing-library (user interactions)
- E2E: Playwright (critical paths)
- Accessibility: axe-core

**Critical Flows:**
1. Homepage Load → Hero, Projects, Blog posts, Navigation
2. Project View → List → filter → detail
3. Blog Read → List → search → article
4. Contact Form → Validation → Submit → Success

---

## 13. Edge Cases

| Scenario | UI Response |
|----------|-------------|
| 404 Page | Custom 404 with nav, recent posts |
| 500 Error | Error boundary with retry |
| Network Error | Offline indicator |
| API Failure | Toast notification |
| No projects | "Henüz proje yok" message |
| No blog posts | "Henüz yazı yok" message |
| Draft content | Hidden from public |
| Image Load fail | Placeholder with icon |

---

## 14. Design Files (Stitch)

Screen designs available in Stitch at: `~/projects/hikmet-set1/stitch/`

| Screen | Stitch ID |
|--------|-----------|
| Ana Sayfa | 0da9a09fb1e44e77824f0b81fe565023 |
| Projeler | 51b4e4fe81134726a68bfde925028f6d |
| Proje Detay (Vesta Dashboard) | 901b07591d984879a0f28a7e1279825b |
| Blog | 6179c8995f1c4f3b9d442717d40735dc |
| Blog Detay | ffd88b8781484c53936ffd6726b509ee |
| Hakkında | 9a31eab4d152451399485299e1a65cf3 |
| İletişim | 0539313873cb412d9d0b86ff0961a9ef |

---

## 15. Komponent Kütüphanesi Eşleştirmesi

| PRD Terimi | shadcn/ui | Notlar |
|------------|-----------|--------|
| card | Card | İçerik kartları |
| sidebar | Sheet | Mobile sidebar / yan panel |
| tab | Tabs | Sayfa içi sekmeler |
| accordion | Accordion | İçerik akordiyonları |
| dialog | Dialog | Modal pencereler |
| input | Input | Form girişleri |
| textarea | Textarea | Form metin alanları |
| button | Button | Butonlar |
| badge | Badge | Etiketler |
| skeleton | Skeleton | Yükleme durumları |
| toast | Toast | Bildirimler |
| avatar | Avatar | Profil resimleri |

---

## 16. Architectural Decisions

**DECISION: Static Site with MDX Content**
- Use Next.js App Router with static generation and MDX for content
- Rationale: Simple, fast, zero database cost, full control, excellent DX
- Trade-offs: Content updates require redeploy

**DECISION: shadcn/ui Component Library**
- Use shadcn/ui as the component foundation
- Rationale: Accessible, customizable, stays in codebase, follows Radix primitives
- Trade-offs: Manual updates when upstream changes

**DECISION: Framer Motion for Animations**
- Use Framer Motion as primary animation library
- Rationale: Excellent React integration, declarative API, layout animations, gesture support
- Trade-offs: Adds bundle size

---

## Ekranlar (Screens)

| # | Ekran Adı | Tür | Açıklama |
|---|-----------|-----|----------|
| 1 | Ana Sayfa | landing | Hero, öne çıkan projeler, son yazılar, CTA |
| 2 | Projeler Listesi | list-view | Proje kartları grid, filtreleme, arama |
| 3 | Proje Detay | detail-view | Proje bilgileri, teknolojiler, galeri, linkler |
| 4 | Blog Listesi | list-view | Yazı listesi, kategoriler, arama |
| 5 | Blog Detay | detail-view | Yazı içeriği, tablo of contents, paylaşım |
| 6 | Hakkında | profile | Profil, deneyim timeline, yetenekler |
| 7 | İletişim | form | İletişim formu, sosyal medya, durum bilgisi |
| 8 | 404 Sayfası | error | Hata sayfası, navigasyon önerileri |
| 9 | Boş Durum - Projeler | empty-state | Proje yok mesajı |
| 10 | Boş Durum - Blog | empty-state | Yazı yok mesajı |
| 11 | Mobil Menü | overlay | Full-screen mobil navigasyon |
PRD_SCREEN_COUNT: 11

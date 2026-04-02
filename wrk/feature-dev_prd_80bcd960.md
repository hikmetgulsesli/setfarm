STATUS: done
REPO: /home/setrox/projects/hikmetgulsesli-com
BRANCH: feature/prd-v3
PRD:

# PRD v3 — hikmetgulsesli.com

## 1. Proje Genel Bakış

**Proje Sahibi:** Hikmet Güleşli
**Proje Adı:** hikmetgulsesli.com
**Proje Tipi:** Kişisel portföy web sitesi
**Platform:** Web (responsive, mobile-first)
**Repo:** `/home/setrox/projects/hikmetgulsesli-com`
**STITCH_PROJECT_ID:** 2269194756870439603

Hikmet Güleşli'nin kişisel web sitesi ve geliştirici portföyü. Koyu temalı, terminal estetiğine sahip modern bir portfolio platformu. Ziyaretçilere Hikmet'in projelerini, yazılarını ve profesyonel profilini sunan merkezi bir dijital varlık. Terminal/monospace tarzı UI elementleri, canlı durum göstergeleri ve hover micro-interaction'lar ile dinamik bir kullanıcı deneyimi sağlar.

**Mevcut Durum:** Stitch tasarımları mevcut (7 ekran). Geliştirme başlangıcı için PRD tamamlanması gerekiyor.

**Temel Özellikler:**
- Koyu tema varsayılan, terminal estetiği
- Framer Motion tabanlı smooth animasyonlar
- Next.js 14 App Router ile 60fps performans
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

| Name | Size | Line Height | Letter Spacing | Usage |
|------|------|-------------|----------------|-------|
| 2xs | `10px` | 1.4 | -0.01em | Legal text, timestamps |
| xs | `12px` | 1.5 | -0.01em | Captions, badges |
| sm | `14px` | 1.5 | 0 | Small body text |
| base | `16px` | 1.7 | 0 | Body text |
| lg | `18px` | 1.6 | 0 | Large body, lead |
| xl | `20px` | 1.5 | 0 | Section subtitles |
| 2xl | `24px` | 1.3 | -0.02em | H3 headings |
| 3xl | `30px` | 1.2 | -0.02em | H2 headings |
| 4xl | `36px` | 1.2 | -0.03em | H1 headings |
| 5xl | `48px` | 1.1 | -0.04em | Large headings |
| 6xl | `60px` | 1.0 | -0.05em | Display headings |
| 7xl | `72px` | 1.0 | -0.06em | Hero display |

### 2.3 Spacing Sistemi

Base unit: `4px` (Tailwind default)

| İsim | Değer | px Karşılık | Kullanım |
|------|-------|-------------|----------|
| 0 | `0px` | 0 | Reset, gaps |
| px | `1px` | 1 | Hairlines, dividers |
| 0.5 | `2px` | 2 | Tiny gaps |
| 1 | `4px` | 4 | İcon padding, micro spacing |
| 1.5 | `6px` | 6 | Tight element gaps |
| 2 | `8px` | 8 | İç padding (small cards), icon gaps |
| 3 | `12px` | 12 | Badge padding, small gaps |
| 4 | `16px` | 16 | Standard padding, gap |
| 5 | `20px` | 20 | Medium gaps |
| 6 | `24px` | 24 | Section spacing |
| 8 | `32px` | 32 | Large section gap |
| 10 | `40px` | 40 | Section headers |
| 12 | `48px` | 48 | Page section margins |
| 16 | `64px` | 64 | Hero section padding |
| 20 | `80px` | 80 | Large page padding |
| 24 | `96px` | 96 | Top/bottom page padding (desktop) |

### 2.4 Border Radius

| İsim | Değer | px Karşılık | Kullanım |
|------|-------|-------------|----------|
| none | `0px` | 0 | Terminal-style elementler, code blocks |
| sm | `4px` | 4 | Small badges, small inputs |
| md | `8px` | 8 | Cards, buttons, inputs |
| lg | `12px` | 12 | Large cards, modals |
| xl | `16px` | 16 | Overlay elements, large panels |
| 2xl | `24px` | 24 | Featured cards |
| full | `9999px` | 9999 | Pills, avatars, status dots, chips |

### 2.5 Shadows

| Name | CSS Value | Usage |
|------|-----------|-------|
| none | none | No shadow |
| sm | `0 1px 2px 0 rgb(0 0 0 / 0.05)` | Subtle elevation |
| base | `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)` | Default card shadow |
| md | `0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.3)` | Elevated cards |
| lg | `0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.4)` | Modals, dropdowns |
| xl | `0 20px 25px -5px rgb(0 0 0 / 0.4), 0 8px 10px -6px rgb(0 0 0 / 0.4)` | Large overlays |
| 2xl | `0 25px 50px -12px rgb(0 0 0 / 0.5)` | Full-screen modals |
| glow-primary | `0 0 20px rgb(16 185 129 / 0.3)` | Primary color glow |
| glow-primary-lg | `0 0 40px rgb(16 185 129 / 0.4)` | Large primary glow |
| glow-accent | `0 0 20px rgb(99 102 241 / 0.3)` | Accent color glow |

### 2.6 Motion & Animasyon

**Timing Functions:**
- ease-in: `cubic-bezier(0.4, 0, 1, 1)` — Elements entering
- ease-out: `cubic-bezier(0, 0, 0.2, 1)` — Elements exiting
- ease-in-out: `cubic-bezier(0.4, 0, 0.2, 1)` — Smooth transitions
- spring: `cubic-bezier(0.175, 0.885, 0.32, 1.275)` — Bouncy interactions

**Duration Scale:**
| Name | Duration | Usage |
|------|----------|-------|
| instant | `0ms` | Immediate feedback |
| fastest | `50ms` | Micro-interactions |
| fast | `100ms` | Hovers, small state changes |
| normal | `200ms` | Default transitions |
| slow | `300ms` | Page transitions, reveals |
| slower | `400ms` | Complex animations |
| slowest | `500ms` | Full page loads |
| ambient | `2000ms+` | Ambient loops (ping, pulse) |

**Framer Motion Key Variants:**
```typescript
const fadeUpVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut', staggerChildren: 0.1 } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
};

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2, ease: 'easeIn' } }
};
```

---

## 3. Sayfa Yapısı ve Route'lar

| Route | Sayfa | Açıklama |
|-------|-------|----------|
| `/` | Ana Sayfa | Hero, öne çıkan projeler, son yazılar, CTA |
| `/projects` | Projeler | Proje kartları grid, filtreleme, arama |
| `/projects/[slug]` | Proje Detay | Proje detay sayfası, teknolojiler, demo/github linkleri |
| `/blog` | Blog | Yazı listesi, kategoriler, arama |
| `/blog/[slug]` | Blog Detay | Yazı içeriği, tablo of contents, yazar bilgisi |
| `/about` | Hakkında | Kişisel tanıtım, yetenekler, deneyim timeline |
| `/contact` | İletişim | İletişim formu, sosyal medya linkleri |
| `/404` | 404 | Sayfa bulunamadı |

---

## 4. Sayfa Detayları

### 4.1 Ana Sayfa (`/`)

**Ekran ID:** `0da9a09fb1e44e77824f0b81fe565023`
**Boyut:** 2560×5668

**Bölümler:**
1. **Header/Navigation** — Logo, nav links (Ana Sayfa, Projeler, Blog, Hakkında, İletişim), sosyal ikonlar
2. **Hero Section** — Terminal-style greeting `> Merhaba, ben Hikmet_`, animated typing roles, gradient heading, CTA buttons, availability status badge
3. **Öne Çıkan Projeler** — `// featured_projects` section, 3-column responsive grid, max 6 proje
4. **Son Yazılar** — `// recent_writing` section, 3-column grid, max 3 yazı
5. **CTA Section** — Gradient border, centered text + primary button
6. **Footer** — 4-column layout: about snippet, quick links, social, copyright

**Animasyonlar:**
- Hero text: typing effect (80ms/char)
- Scroll: fade-up reveal (staggered 100ms)
- Cards: translateY(-4px) + shadow on hover
- Status badge: ping animation (ambient, 2s)

### 4.2 Projeler Sayfası (`/projects`)

**Ekran ID:** `51b4e4fe81134726a68bfde925028f6d`
**Boyut:** 2560×4150

**Bölümler:**
1. **Page Header** — Title `// projeler`, description
2. **Filter Bar** — Categories (Tümü, Web, Mobil, Açık Kaynak, Freelance), active state: bg-primary
3. **Search** — Cmd+K trigger, command palette style
4. **Projects Grid** — Responsive: 3col desktop, 2col tablet, 1col mobile
5. **Project Card:**
   - 16:9 thumbnail
   - Title (bold)
   - Description (2 lines max)
   - Tech stack pills
   - GitHub + Demo links
   - Hover: border-primary, glow, translateY(-4px)
6. **Pagination** — numbered, prev/next
7. **Footer**

**States:** Loading (skeleton cards), Empty (no results illustration), Error (retry button)

### 4.3 Proje Detay Sayfası (`/projects/[slug]`)

**Ekran ID:** `901b07591d984879a0f28a7e1279825b`
**Boyut:** 2560×5660
**Örnek Proje:** Vesta Dashboard

**Bölümler:**
1. **Hero** — Full-width thumbnail (max-height: 500px)
2. **Project Header** — Title, date, client (if freelance), category badge
3. **Content Container** (max-width: 800px):
   - Overview (problem, solution, impact)
   - Tech Stack grid (icons + names)
   - Gallery carousel (if applicable)
   - Challenges & Solutions accordion
   - Links: GitHub, Live Demo
4. **Sticky Sidebar** (desktop): TOC + action buttons
5. **Next/Prev Navigation**
6. **Footer**

**Code Blocks:** Background #0d0d12, syntax highlighting, copy button, line numbers optional

### 4.4 Blog Sayfası (`/blog`)

**Ekran ID:** `6179c8995f1c4f3b9d442717d40735dc`
**Boyut:** 2560×3958

**Bölümler:**
1. **Page Header** — Title `// writing`, description
2. **Search + Category Filter** — Categories: Tümü, Teknik, Career, Kişisel, Tutorial
3. **Featured Article** — Full-width card at top (if pinned)
4. **Articles Grid** — 2-column desktop, 1-column mobile
5. **Article Card:**
   - Date + read time (muted)
   - Title (bold)
   - Excerpt (2 lines)
   - Category tags
   - Hover: border-primary, bg-elevated
6. **Pagination**
7. **Footer**

### 4.5 Blog Detay Sayfası (`/blog/[slug]`)

**Ekran ID:** `ffd88b8781484c53936ffd6726b509ee`
**Boyut:** 2560×5504

**Bölümler:**
1. **Article Header** — Title (display), date, author, read time, categories
2. **Featured Image** — Full-width (max-height: 400px)
3. **Content Area** (max-width: 720px):
   - Prose styling (custom typography)
   - Code blocks with copy
   - Blockquotes
   - Images with lightbox
4. **Table of Contents** — Sticky sidebar (desktop), collapsible (mobile)
5. **Share Buttons** — Twitter, LinkedIn, Copy link
6. **Tags**
7. **Author Bio Card**
8. **Related Articles** (2-3 items)
9. **Footer**

**Typography Scale:**
- p: text-lg, line-height 1.8, text-secondary
- h2: text-2xl, font-bold, mt-12 mb-4, text-primary
- h3: text-xl, font-semibold, mt-8 mb-3
- code inline: bg-subtle, px-2 py-1, rounded, font-mono
- code block: bg-#0d0d12, p-4, rounded-lg
- blockquote: border-l-4 border-primary, pl-6, italic

### 4.6 Hakkında Sayfası (`/about`)

**Ekran ID:** `9a31eab4d152451399485299e1a65cf3`
**Boyut:** 2560×3012

**Bölümler:**
1. **Hero** — Circular avatar (200px, border: 4px primary, glow on hover), name gradient, title, short bio
2. **Experience Timeline** — Vertical line, alternating left/right (desktop), stacked (mobile), scroll animation
3. **Skills Grid** — Categories: Frontend, Backend, Database, DevOps, Tools, Soft Skills
   - Each skill: icon + name + proficiency bar
   - Animation: fill on scroll into view
4. **Currently Learning/Interested In**
5. **CV Download Button**
6. **Footer**

### 4.7 İletişim Sayfası (`/contact`)

**Ekran ID:** `0539313873cb412d9d0b86ff0961a9ef`
**Boyut:** 2560×2702

**Layout:** Split (desktop): form left, info right. Single column (mobile).

**Contact Form Fields:**
| Field | Required | Min | Max | Pattern |
|-------|----------|-----|-----|---------|
| firstName | Yes | 2 | 50 | Letters only |
| lastName | Yes | 2 | 50 | Letters only |
| email | Yes | 5 | 100 | Valid email |
| subject | Yes | 5 | 200 | Any |
| message | Yes | 20 | 2000 | Any |

**Form States:** Idle, Validating (blur), Submitting (disabled + spinner), Success (toast + reset), Error (inline + toast)

**Info Section:**
- Email (mailto link)
- Location: Türkiye + Europe/Istanbul timezone
- Social links
- Availability status: green dot + "Şu an müsaitim"

### 4.8 404 Sayfası (`/404`)

**Bileşenler:**
- Terminal-style "404" büyük text
- Mesaj: "Sayfa bulunamadı"
- Önerilen sayfalar: Ana Sayfa, Projeler, Blog
- Back to home button
- Animasyon: glitch effect veya typing animation

---

## 5. Global Bileşenler

### 5.1 Header Navigation

**Desktop:**
- Fixed, top: 0, height: 64px
- Background: bg-background/80 + backdrop-blur(12px)
- Logo (left): gradient text, links to `/`
- Nav links (center): Ana Sayfa, Projeler, Blog, Hakkında, İletişim
- Social icons (right): GitHub, LinkedIn, Twitter/X
- Border-bottom: 1px border (on scroll)
- Z-index: 50

**Mobile:**
- Hamburger menu (44×44px tap target)
- Full-screen overlay when open
- Nav links: vertical stack, text-2xl
- Social icons at bottom
- Close button top-right

**Nav Link States:** Default (text-secondary), Hover (text-primary + underline animation), Active (text-primary + persistent underline)

### 5.2 Footer

- Background: bg-elevated
- Border-top: 1px border
- 4 columns: About snippet, Quick links (`// quick_links`), Social icons, Copyright
- Copyright: `© 2024 Hikmet Güleşli. Tüm hakları saklıdır.`

### 5.3 Buttons

| Variant | Background | Text | Border | Hover |
|---------|------------|------|--------|-------|
| Primary | bg-primary | text-white | none | bg-primary-hover, glow-sm, translateY(-1px) |
| Secondary | transparent | text-primary | 1px border | border-primary, bg-primary/10 |
| Ghost | transparent | text-secondary | none | text-primary, bg-subtle |
| Destructive | bg-error | text-white | none | bg-error/90 |

**Sizes:** sm (32px), md (40px), lg (48px), icon (40px square)

### 5.4 Cards

**Base Card:**
- Background: bg-elevated
- Border: 1px border
- Border-radius: lg (12px)
- Padding: p-6 (md), p-4 (sm), p-8 (lg)

**Interactive Card Hover:**
- border-primary
- translateY(-2px)
- shadow-md
- shadow-glow-primary-sm

### 5.5 Badge/Tag

| Variant | Background | Text |
|---------|------------|------|
| default | bg-subtle | text-secondary |
| primary | bg-primary/20 | text-primary |
| secondary | bg-accent/20 | text-accent |
| success | bg-success/20 | text-success |
| warning | bg-warning/20 | text-warning |
| error | bg-error/20 | text-error |

### 5.6 Input Fields

- Background: bg-elevated
- Border: 1px border, focus: border-primary + ring
- Border-radius: md
- Padding: px-4 py-3 (md)
- Error: border-error + ring-error/20

**Textarea:** Same, resize vertical only

### 5.7 Status Indicator

| Status | Color | Animation |
|--------|-------|-----------|
| online | bg-success | ping |
| offline | bg-muted | none |
| busy | bg-error | pulse |
| away | bg-warning | none |

### 5.8 Skeleton Loader

- Background: bg-subtle
- pulse: opacity 1 → 0.5 → 1
- wave: linear gradient sweep

### 5.9 Toast Notifications

**Position:** bottom-right (desktop), bottom-center (mobile)
**Variants:** default, success, error, warning, info
**Animation:** slide in from right, fade out
**Max visible:** 3

### 5.10 Modal/Dialog

- Background: bg-elevated
- Border: 1px border
- Border-radius: xl
- Overlay: bg-black/80 + backdrop-blur(8px)
- Animation: fade + scale (0.95 → 1)
- Mobile: full-screen

---

## 6. Responsive Breakpoints

| Breakpoint | Min Width | Columns | Container |
|------------|-----------|---------|-----------|
| mobile | < 375px | 1 | 100% - 24px |
| mobile-lg | 375px | 1 | 100% - 24px |
| tablet-sm | 640px | 2 | 100% - 32px |
| tablet | 768px | 2-3 | 100% - 48px |
| desktop | 1024px | 3-4 | 100% - 64px |
| desktop-lg | 1280px | 4-6 | 1280px centered |

**Touch Targets:** Minimum 44×44px, recommended 48×48px

---

## 7. Veri Modelleri

### TypeScript Interfaces

```typescript
interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

interface Project extends BaseEntity {
  slug: string;
  title: string;
  description: string;
  shortDescription: string;
  thumbnail: string;
  images: string[];
  category: 'web' | 'mobile' | 'open-source' | 'freelance';
  techStack: TechItem[];
  liveUrl?: string;
  githubUrl?: string;
  featured: boolean;
  publishedAt: string;
  status: 'draft' | 'published' | 'archived';
  content: string; // MDX
  challenges?: string;
  solutions?: string;
  results?: string;
  client?: string;
  duration?: string;
  sortOrder?: number;
}

interface TechItem {
  id: string;
  name: string;
  icon?: string;
  category: 'frontend' | 'backend' | 'database' | 'devops' | 'tool' | 'mobile';
  url?: string;
}

interface BlogPost extends BaseEntity {
  slug: string;
  title: string;
  excerpt: string;
  featuredImage?: string;
  category: 'teknik' | 'career' | 'kisisel' | 'tutorial';
  tags: string[];
  readTime: number;
  publishedAt: string;
  status: 'draft' | 'published' | 'archived';
  content: string; // MDX
  author: Author;
  featured: boolean;
  pinned: boolean;
}

interface Author {
  id: string;
  name: string;
  avatar: string;
  title: string;
  bio: string;
  location?: string;
  social: SocialLinks;
}

interface SocialLinks {
  github?: string;
  linkedin?: string;
  twitter?: string;
  email?: string;
}

interface Experience extends BaseEntity {
  title: string;
  company: string;
  companyUrl?: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description: string;
  type: 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship';
}

interface Skill {
  id: string;
  name: string;
  icon?: string;
  proficiency?: number;
  category: 'frontend' | 'backend' | 'database' | 'devops' | 'mobile' | 'design' | 'soft-skills';
}

interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

---

## 8. API Endpoints

```
GET    /api/projects
       Query: ?page=1&limit=10&category=web&featured=true&search=query
       Response: PaginatedResponse<Project>

GET    /api/projects/[slug]
       Response: Project | ApiError(404)

GET    /api/projects/featured
       Query: ?limit=6
       Response: Project[]

GET    /api/posts
       Query: ?page=1&limit=10&category=teknik&search=query
       Response: PaginatedResponse<BlogPost>

GET    /api/posts/[slug]
       Response: BlogPost | ApiError(404)

GET    /api/posts/featured
       Response: BlogPost | null

POST   /api/contact
       Body: ContactFormData
       Response: { success: boolean; id: string }
       Rate Limit: 5 requests/hour per IP

GET    /api/profile
       Response: Author

GET    /api/experience
       Response: Experience[]

GET    /api/skills
       Response: Skill[]
```

---

## 9. Teknoloji Stack

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

### Font Configuration
```typescript
const fonts = {
  heading: { family: 'Space_Grotesk', weights: [700], subsets: ['latin'] },
  body: { family: 'Inter', weights: [400, 500, 600, 700], subsets: ['latin'] },
  mono: { family: 'JetBrains_Mono', weights: [400, 500], subsets: ['latin'] }
};
```

---

## 10. SEO & Metadata

### Default SEO
```typescript
const defaultSEO = {
  title: { default: 'Hikmet Güleşli', template: '%s | Hikmet Güleşli' },
  description: 'Full-Stack Developer, UI/UX Designer. Modern web teknolojileri ile dijital ürünler geliştiriyorum.',
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: 'https://hikmetgulsesli.com',
    siteName: 'Hikmet Güleşli'
  },
  twitter: { card: 'summary_large_image', site: '@hikmetgulsesli' },
  robots: { index: true, follow: true }
};
```

### Structured Data
- Person Schema (JSON-LD)
- Article Schema (blog posts)
- Breadcrumb Schema

### Sitemap
- Static routes: /, /projects, /blog, /about, /contact
- Dynamic routes: /projects/[slug], /blog/[slug]

---

## 11. Erişilebilirlik (WCAG 2.1 AA)

- Color contrast: minimum 4.5:1 (normal text), 3:1 (large text)
- Focus indicators: 2px ring, primary color
- Skip to main content link
- Semantic HTML (nav, main, article, aside, footer)
- ARIA labels on interactive elements
- Keyboard navigation: Tab, Enter, Escape, Arrow keys
- Reduced motion: respects `prefers-reduced-motion`

---

## 12. Performans Hedefleri

| Metric | Target | Strategy |
|--------|--------|----------|
| LCP | < 2.5s | Preload hero, priority hints |
| FID | < 100ms | Code splitting |
| CLS | < 0.1 | Explicit dimensions, font-display: swap |
| TTFB | < 600ms | Edge caching, ISR |
| Bundle | < 200KB total JS | Tree shaking, minification |

---

## 13. Mimari Kararlar

**DECISION:** Next.js 14 App Router ile statik-first yaklaşım
**ALTERNATIVES_CONSIDERED:** Astro, vanilla HTML/CSS/JS
**RATIONALE:** App Router + MDX + shadcn/ui ekosistemi ile tutarlı geliştirme deneyimi. Content management kolaylığı ve API routes ile ileriye dönük esneklik.
**TRADE_OFFS:** Daha büyük bundle size (Framer Motion dahil), ancak component reusability kazanımı bunu tolere edilebilir kılıyor.

---

## 14. Ekranlar (Screens)

| # | Ekran Adı | Tür | Açıklama |
|---|-----------|-----|----------|
| 1 | Ana Sayfa | landing | Hero, projeler, blog, CTA bölümleri |
| 2 | Projeler | list-view | Proje kartları grid, filtreleme, arama |
| 3 | Proje Detay | detail | Proje detay, tech stack, galeri, linkler |
| 4 | Blog | list-view | Yazı listesi, kategoriler, arama |
| 5 | Blog Detay | detail | Yazı içeriği, TOC, yazar, paylaşım |
| 6 | Hakkında | profile | Avatar, bio, timeline, yetenekler |
| 7 | İletişim | form | İletişim formu, bilgiler, sosyal linkler |
| 8 | 404 | error | Sayfa bulunamadı hata sayfası |

---

## 15. Geliştirme Sırası Önerisi

**Phase 1 — Foundation:**
1. Next.js proje setup, Tailwind + shadcn/ui konfigürasyonu
2. Tema/tasarım sistemi (colors, typography, spacing)
3. Layout bileşenleri (Header, Footer, Navigation)
4. Global UI bileşenleri (Button, Card, Badge, Input)

**Phase 2 — Pages:**
5. Ana Sayfa
6. Projeler sayfası + Proje detay
7. Blog sayfası + Blog detay
8. Hakkında sayfası
9. İletişim sayfası

**Phase 3 — Polish:**
10. Animasyonlar (Framer Motion)
11. SEO + Metadata
12. 404 + Error handling
13. PWA optimizasyonu
14. Accessibility audit

---

## 16. Mock Data Gerekli

Geliştirme için örnek veri seti:
- 6 proje (en az 1 featured)
- 4 blog yazısı (farklı kategorilerde)
- 3 deneyim (timeline için)
- 10+ yetenek (kategorize edilmiş)
- 1 yazar profili (Hikmet Güleşli)

---

PRD_SCREEN_COUNT: 8

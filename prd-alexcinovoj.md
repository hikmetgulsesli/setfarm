# PRD — Alexcinovoj Personal Portfolio

## 1. Project Overview

**Project Name:** Alexcinovoj
**Type:** Personal Developer Portfolio & TechTide AI Founder Brand Site
**Platform:** Web (Responsive — Mobile, Tablet, Desktop)
**Repo:** /home/setrox/projects/alexcinovoj
**Target User:** Potential clients, employers, collaborators, and the developer community

### Summary
Alex Cinovoj'un kişisel geliştirici portalı ve TechTide AI kurucu portfolio sitesi. Sitede "quiet AI systems", "200+ agents in Claw" ve "10 open Claw projects" vurgulanıyor. Modern, minimalist dark-mode ağırlıklı bir tasarım ile geliştirici kimliği, projeler, blog içerikleri ve sosyal medya bağlantıları sunuluyor.

### Goals
- Showcase Alex's work as a developer and AI systems builder
- Highlight TechTide AI founder identity
- Display projects, blog posts, and developer resources
- Provide easy contact/social links
- Demonstrate technical prowess through the site itself

---

## 2. Design System

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#22c55e` | CTA buttons, active links, hover highlights |
| Primary/50 | `#22c55e80` | Gradient start, subtle accents |
| Background | `#0a0a0f` | Main background (dark mode) |
| Foreground | `#ffffff` | Primary text color |
| Muted | `#0a0a0f` | Muted background areas |
| Secondary | `#0a0a0f` | Secondary button backgrounds |
| Border | Variable | Card and input borders |
| Card | Variable | Card component backgrounds |
| Ring | `#22c55e` | Focus ring, active states |
| Theme Light | `#ffffff` | Light mode background |
| Theme Dark | `#0a0a0f` | Dark mode background |

### Typography

| Font | Usage |
|------|-------|
| **Geist** (Geist Variable) | Primary sans-serif, body text, navigation |
| **Geist Mono** | Code blocks, terminal elements, monospace accents |
| **Space Grotesk** | Headings, hero section, accent text |
| **sans-serif** | Fallback |

Font stack: `'Geist', 'Geist Mono', 'Space Grotesk', ui-sans-serif, system-ui, sans-serif`

### Spacing (Tailwind Scale)

| Token | Value | Usage |
|-------|-------|-------|
| gap-1 | 4px | Icon spacing |
| gap-2 | 8px | Component internal |
| gap-3 | 12px | Navigation items |
| gap-6 | 24px | Section elements |
| gap-8 | 32px | Card grid |
| gap-12 | 48px | Between sections |
| p-4 | 16px | Card padding |
| p-6 | 24px | Container padding |
| py-2 | 8px | Button vertical |
| px-4 | 16px | Button horizontal |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| rounded-md | 6px | Cards, buttons |
| rounded-full | 9999px | Pills, badges |
| rounded-lg | 8px | Modals, large cards |

### Shadows

| Token | Value | Usage |
|-------|-------|-------|
| shadow-sm | 0 1px 2px 0 rgb(0 0 0 / 0.05) | Subtle elevation |
| shadow-lg | 0 10px 15px -3px rgb(0 0 0 / 0.1) | Elevated cards |

---

## 3. Pages & Screens

### 3.1 Home Page (/)

**Layout:**
- Fixed/sticky header with blur backdrop, 100% width
- Hero section: full viewport height, centered content, typing animation
- Sections flow: Hero → Featured Projects → Resources → Writing → Footer
- Container: max-width 1280px (7xl), centered, px-6

**Components:**

*Navigation Header*
- Logo: "alexcinovoj" text + .dev suffix badge
- Nav Links: Home (/), Projects (/projects), Resources (/workbench), Writing (/blog)
- Social Icons: LinkedIn, Twitter/X, GitHub (external)
- Dark/Light mode toggle button
- Mobile: Hamburger menu trigger

*Hero Section*
- Pre-heading: Status badge "● 200+ agents in Claw" (pulsing dot animation)
- Main heading: "I build quiet AI systems" (Space Grotesk, text-5xl)
- Subheading: TechTide AI founder description
- CTA: "View Projects" button (primary green)
- Terminal-style decorative element with blinking cursor
- Scanline overlay effect (subtle CRT aesthetic)

*Status Badge*
- Animated pulsing green dot
- "200+ agents in Claw" text
- Green pill background

*Footer*
- Copyright: "© 2024 Alex Cinovoj"
- Social links repeat
- "Built with Next.js" credit

**Interactions:**
- Scroll: Header blur effect intensifies
- Hover (Nav Links): Text → primary green, underline slides in
- Hover (Social Icons): scale(1.1), color → primary green
- Click (Mobile Menu): Full-screen overlay, staggered link reveal
- Mode Toggle: Instant theme switch, localStorage persistence

---

### 3.2 Projects Page (/projects)

**Layout:**
- Header same as home
- Page title section with breadcrumbs
- Project grid: 2 columns desktop, 1 column mobile
- Each card: Image, title, description, tech tags, links

**Components:**

*Project Card*
- Thumbnail image (16:9 aspect, rounded-lg)
- Title: bold, truncate
- Description: muted, 2 lines max
- Tech stack badges: pill style, muted background
- External links: GitHub, Demo icons
- Hover: Subtle lift shadow, border glow

*Filter/Sort Controls*
- Category filter (optional)
- Sort by date or name

**Interactions:**
- Hover (Card): translateY(-4px), shadow-lg
- Click (Card): Navigate to project detail
- Click (Links): Open in new tab

---

### 3.3 Resources/Workbench Page (/workbench)

**Layout:**
- Header same as home
- Resource categories: Tools, Templates, Documentation
- Grid layout for resources
- Search/filter functionality

**Components:**

*Resource Card*
- Icon + Title
- Brief description
- Category badge
- Download/Access button

*Search Input*
- Icon prefix
- Placeholder: "Search resources..."
- Clear button on input

**Interactions:**
- Search: Real-time filter as user types
- Click (Resource): Download or external link

---

### 3.4 Writing/Blog Page (/blog)

**Layout:**
- Header same as home
- Featured post (large card, top)
- Post grid below (2 columns desktop)
- Pagination or infinite scroll

**Components:**

*Blog Post Card*
- Cover image (optional)
- Title
- Excerpt (2-3 lines)
- Date + Reading time
- Tags

*Featured Post*
- Larger format, full-width or 2/3 width
- Gradient overlay option

**Interactions:**
- Hover (Post): Image zoom, title underline
- Click (Post): Navigate to full article

---

### 3.5 Project Detail Page (/projects/[slug])

**Layout:**
- Header same as home
- Hero with project image
- Full description, tech stack
- Links to GitHub, Demo
- Related projects

**Interactions:**
- Back navigation
- External links open in new tab

---

### 3.6 Blog Post Detail Page (/blog/[slug])

**Layout:**
- Header same as home
- Post hero with cover image
- Full article content (MDX/Markdown rendered)
- Author info, date, reading time
- Tags
- Related posts

**Interactions:**
- Back to blog navigation
- Share functionality

---

### 3.7 Contact Page (/contact) — ADDED (minimum 3 screens rule)

**Layout:**
- Header same as home
- Contact form: name, email, message
- Alternative contact methods (email, social)

**Components:**

*Contact Form*
- Name input
- Email input
- Message textarea
- Submit button
- Success/error states

*Alternative Contact*
- Email link
- Social media links

**Interactions:**
- Form validation
- Submit sends message
- Success/error feedback

---

### 3.8 404 Error Page — MANDATORY

**Layout:**
- Header same as home (or minimal)
- Error message: "404 — Page Not Found"
- Back to home link
- Maybe a fun/characterful message

**Interactions:**
- Click to navigate home

---

### 3.9 Empty State Pages — MANDATORY

**For Projects when empty:**
- Illustration/icon
- "No projects yet" message
- Call to action to check back

**For Blog when empty:**
- "No posts published yet" message
- Suggest subscribing or checking back

**For Resources when empty:**
- "No resources available" message

---

## 4. Animations

### Cursor Glow Effect
- Duration: 150ms
- Easing: ease-out
- Properties: opacity 0→1, transform scale 1→1.2
- Trigger: mousemove on desktop
- Reset: mouseleave opacity → 0

### Ping Animation (Status Dot)
- Duration: 2s
- Easing: ease-out
- Properties: scale 1→2, opacity 1→0
- Iteration: infinite

### Hover Scale (Social Icons)
- Duration: 200ms
- Easing: ease-out
- Property: transform scale(1) → scale(1.1)

### Hover Slide Text
- Duration: 300ms
- Easing: ease-in-out
- Property: clip-path reveal, translateX(0) → translateX(4px)

### Card Hover Lift
- Duration: 300ms
- Easing: ease-out
- Property: translateY(0) → translateY(-4px), shadow-sm → shadow-lg

### Skeleton Pulse
- Duration: 1.5s
- Easing: ease-in-out
- Property: opacity 0.5 → 1 → 0.5
- Iteration: infinite

### Fade In (Page Load)
- Duration: 400ms
- Easing: ease-out
- Property: opacity 0 → 1
- Stagger: 100ms between elements

### Mobile Menu Open
- Duration: 300ms
- Easing: ease-out
- Property: opacity 0 → 1, backdrop-blur
- Child Links: opacity 0 → 1, stagger 50ms each

### Theme Toggle
- Duration: 200ms
- Easing: ease-in-out
- Property: CSS variables transition

---

## 5. Responsive Breakpoints

| Breakpoint | Min | Max | Grid Cols | Nav | Base Font |
|------------|-----|-----|-----------|-----|-----------|
| xs | 0px | 475px | 1 | Hamburger hidden | text-sm |
| sm | 476px | 640px | 1 | Hamburger visible | text-sm |
| md | 641px | 768px | 2 | Full nav, smaller | text-base |
| lg | 769px | 1024px | 2 | Full nav | text-base lg:text-lg |
| xl | 1025px | 1280px | 3 | Full nav | text-lg |
| 2xl | 1281px+ | — | 3 | Full nav, max container | text-xl |

---

## 6. Data Model (TypeScript)

```typescript
interface PersonalInfo {
  name: string;
  title: string;
  company: string;
  bio: string;
  location?: string;
  email?: string;
  socialLinks: SocialLink[];
}

interface SocialLink {
  platform: 'linkedin' | 'twitter' | 'github' | 'email' | 'website';
  url: string;
  label: string;
}

interface Project {
  id: string;
  title: string;
  slug: string;
  description: string;
  longDescription?: string;
  thumbnail: string;
  images?: string[];
  tags: string[];
  links: {
    github?: string;
    demo?: string;
    docs?: string;
  };
  featured: boolean;
  stats?: {
    stars?: number;
    forks?: number;
    downloads?: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  tags: string[];
  publishedAt: string;
  updatedAt: string;
  readingTime: number;
  featured: boolean;
  draft: boolean;
}

interface Resource {
  id: string;
  title: string;
  description: string;
  category: 'tool' | 'template' | 'documentation' | 'library';
  icon: string;
  url: string;
  external: boolean;
  tags: string[];
  createdAt: string;
}

interface NavItem {
  label: string;
  href: string;
  external?: boolean;
  children?: NavItem[];
}

type Theme = 'light' | 'dark' | 'system';
```

---

## 7. API Endpoints

### GET /api/projects
Returns paginated list of projects.

### GET /api/projects/[slug]
Returns single project by slug.

### GET /api/posts
Returns paginated blog posts with optional tag filter.

### GET /api/posts/[slug]
Returns single blog post by slug.

### GET /api/resources
Returns resources with optional category/search filter.

### GET /api/status
Returns agent status info (200+ agents, etc.).

### POST /api/contact
Accepts contact form submissions.

---

## 8. Technical Stack

- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Fonts:** next/font with Geist, Geist Mono, Space Grotesk
- **Content:** MDX for blog posts
- **State:** React hooks, localStorage for theme
- **Deployment:** Vercel (implied by Next.js)

---

## 9. Non-Functional Requirements

### Performance
- Static Site Generation (SSG) for all pages
- Image optimization with next/image
- Font optimization with next/font
- Code splitting automatic
- Prefetch on hover for internal links

### Accessibility
- Semantic HTML (nav, main, article, section)
- ARIA labels on interactive elements
- Focus visible styles (ring-2 ring-primary)
- Skip to content link
- Reduced motion support (@media prefers-reduced-motion)
- Color contrast WCAG AA compliant

### SEO
- Title: "Alex Cinovoj — Developer Portal | TechTide AI Founder"
- Meta description
- Open Graph tags
- Twitter Card metadata
- Canonical URLs
- Structured data (JSON-LD) for Person/SoftwareDeveloper

---

## 10. Component Library (shadcn/ui)

| Component | Import | Notes |
|-----------|--------|-------|
| Card | `@/components/ui/card` | Content containers |
| Tabs | `@/components/ui/tabs` | Tab navigation |
| NavigationMenu | `@/components/ui/navigation-menu` | Main nav |
| Breadcrumb | `@/components/ui/breadcrumb` | Path indicator |
| Button | `@/components/ui/button` | All buttons |
| DropdownMenu | `@/components/ui/dropdown-menu` | Options menu |
| Input | `@/components/ui/input` | Text input |
| Form | `@/components/ui/form` | React Hook Form |
| Switch | `@/components/ui/switch` | Toggle |
| Dialog | `@/components/ui/dialog` | Modal/popup |
| Skeleton | `@/components/ui/skeleton` | Loading placeholder |
| Table | `@/components/ui/table` | Data table |
| Badge | `@/components/ui/badge` | Tags/labels |
| Header | Custom | `@/components/layout/header` |

---

## Ekranlar (Screens)

| # | Ekran Adı | Tür | Açıklama |
|---|-----------|-----|----------|
| 1 | Ana Sayfa (/) | landing | Hero, featured projects, resources preview, blog preview, footer |
| 2 | Projeler Listesi (/projects) | list-view | Grid of project cards with filter/sort |
| 3 | Proje Detay (/projects/[slug]) | detail | Single project full info, links, related |
| 4 | Blog Listesi (/blog) | list-view | Featured post + grid of posts |
| 5 | Blog Yazı Detay (/blog/[slug]) | detail | Full article with MDX rendering |
| 6 | Resources/Workbench (/workbench) | list-view | Tools, templates, docs with search |
| 7 | İletişim (/contact) | form | Contact form + alternative contact |
| 8 | 404 Hata Sayfası | error | Page not found with navigation back |
| 9 | Boş Durum - Projeler | empty-state | No projects placeholder |
| 10 | Boş Durum - Blog | empty-state | No posts placeholder |
| 11 | Boş Durum - Resources | empty-state | No resources placeholder |

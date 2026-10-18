import type postgres from "postgres";

type MissionControlTransactionV1 = Pick<postgres.TransactionSql, "unsafe">;

const TABLES = Object.freeze(["tasks", "prds", "prd_templates", "agent_feed", "live_events"]);
const RELATIONS = Object.freeze([
  ...TABLES, "tasks_pkey", "prds_pkey", "prd_templates_pkey",
  "agent_feed_pkey", "agent_feed_msg_hash_key", "agent_feed_id_seq",
  "idx_agent_feed_created", "live_events_pkey", "idx_live_events_ts",
  "idx_live_events_status", "idx_live_events_project", "idx_live_events_agent",
  "idx_live_events_action", "idx_live_events_error",
]);
const ROW_TYPES = Object.freeze(TABLES.flatMap(name => [name, `_${name}`]));

const SCHEMA_STATEMENTS: readonly string[] = Object.freeze([
  "CREATE TABLE public.tasks (\n        id text PRIMARY KEY,\n        title text NOT NULL DEFAULT '',\n        description text NOT NULL DEFAULT '',\n        assigned_agent text NOT NULL DEFAULT '',\n        priority text NOT NULL DEFAULT 'medium',\n        status text NOT NULL DEFAULT 'todo',\n        images text NOT NULL DEFAULT '[]',\n        created_at timestamptz NOT NULL DEFAULT now(),\n        updated_at timestamptz NOT NULL DEFAULT now()\n      )",
  "CREATE TABLE public.prds (\n      id TEXT PRIMARY KEY,\n      title TEXT NOT NULL,\n      platform TEXT DEFAULT 'web',\n      urls TEXT,\n      description TEXT,\n      analysis TEXT,\n      research TEXT,\n      chat_history TEXT,\n      prd_content TEXT,\n      prd_version INTEGER DEFAULT 1,\n      score INTEGER,\n      score_details TEXT,\n      mockup_screens TEXT,\n      pages TEXT,\n      cost_estimate TEXT,\n      run_id TEXT,\n      template_id TEXT,\n      stitch_project_id TEXT,\n      created_at TIMESTAMPTZ DEFAULT NOW(),\n      updated_at TIMESTAMPTZ DEFAULT NOW()\n    )",
  "CREATE TABLE public.prd_templates (\n      id TEXT PRIMARY KEY,\n      name TEXT NOT NULL,\n      category TEXT,\n      platform TEXT DEFAULT 'web',\n      prd_content TEXT,\n      description TEXT,\n      created_at TIMESTAMPTZ DEFAULT NOW()\n    )",
  "CREATE TABLE public.agent_feed (\n      id SERIAL PRIMARY KEY,\n      agent_id TEXT NOT NULL,\n      agent_name TEXT NOT NULL,\n      message TEXT NOT NULL,\n      session_id TEXT,\n      msg_hash TEXT UNIQUE,\n      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n    )",
  "CREATE TABLE public.live_events (\n      id TEXT PRIMARY KEY,\n      ts TIMESTAMPTZ NOT NULL,\n      agent TEXT NOT NULL,\n      model TEXT,\n      tool TEXT,\n      action TEXT NOT NULL,\n      summary TEXT,\n      file TEXT,\n      status TEXT NOT NULL DEFAULT 'completed',\n      duration_ms INTEGER,\n      exit_code INTEGER,\n      cwd TEXT,\n      project TEXT,\n      detail TEXT,\n      output TEXT,\n      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n    )",
  "CREATE INDEX idx_agent_feed_created ON public.agent_feed(created_at DESC)",
  "CREATE INDEX idx_live_events_ts ON public.live_events(ts)",
  "CREATE INDEX idx_live_events_status ON public.live_events(status)",
  "CREATE INDEX idx_live_events_project ON public.live_events(project)",
  "CREATE INDEX idx_live_events_agent ON public.live_events(agent)",
  "CREATE INDEX idx_live_events_action ON public.live_events(action)",
  "CREATE INDEX idx_live_events_error ON public.live_events(exit_code) WHERE exit_code IS NOT NULL AND exit_code != 0",
]);

// Exact canonical template contents: SHA256 469fdfd7f73d4273b0f767d7bb0b92838161e7e8a75df3c25e563361af3a5ac7.
const TEMPLATE_CONTENTS: Readonly<Record<string, string>> = Object.freeze({
  "tpl-ecommerce": `# PRD - E-Commerce Platform

## 1. Project Overview
Build a modern responsive commerce experience with product discovery, filtering, cart management, checkout, account history, and order tracking.

**Tech Stack:** React + TypeScript + Tailwind CSS + shadcn/ui
**Goal:** Fast, accessible, SEO-friendly, mobile-first shopping flow.

## 2. Design System
- Primary: #2563EB, Secondary: #7C3AED, Accent: #F59E0B
- Background: #FFFFFF light, #0F172A dark
- Text: #1E293B light, #F8FAFC dark
- Destructive: #EF4444, Border: #E2E8F0, Muted: #F1F5F9
- Fonts: Inter for UI, JetBrains Mono for code/order identifiers
- Spacing: 4px base grid, 16px mobile page padding, 32px desktop page padding
- Motion: 200ms hover feedback, 300ms page fade, 200ms modal opacity + translateY

## 3. Pages
1. **Home** (/) - Hero, category grid, featured products, campaign banner, footer
2. **Products** (/products) - Filters, sorting, product grid, pagination
3. **Product Detail** (/products/:id) - Gallery, variant selection, stock, tabs, related products
4. **Cart** (/cart) - Item list, quantity controls, order summary, empty state
5. **Checkout** (/checkout) - Address, payment, review, submit order
6. **Account** (/account) - Orders, addresses, favorites, settings

## 4. Page Requirements
- Home: full-width product hero with primary CTA, 4-column desktop category grid, horizontal featured carousel, campaign banner, footer link groups.
- Products: sidebar filters for price, category, brand, color, and size; responsive grid; favorite and add-to-cart controls.
- Product Detail: image gallery with thumbnails, zoom interaction, price display, variant controls, quantity stepper, add-to-cart animation.
- Cart: editable quantities, remove actions, subtotal, shipping, total, checkout CTA, empty-state recovery CTA.
- Checkout: 3-step progress indicator, validated form fields, masked card input, sticky desktop summary, mobile accordion summary.
- Account: tabbed order/address/favorites/settings sections with order detail dialog.

## 5. Data Model
- Product: id, title, slug, description, price, salePrice, images, category, brand, variants, stock, rating
- Cart: items, total, itemCount
- Order: id, items, address, payment, status, total, createdAt
- User: id, name, email, phone, addresses, orders

## 6. API
- GET /api/products
- GET /api/products/:id
- GET /api/categories
- POST /api/cart/add
- PATCH /api/cart/update
- DELETE /api/cart/remove/:itemId
- POST /api/orders
- GET /api/orders/:id
`,

  "tpl-portfolio": `# PRD - Portfolio Site

## 1. Project Overview
Build a polished personal portfolio that presents identity, work, skills, experience, and contact paths in a single-page or light multi-page experience.

**Tech Stack:** React + TypeScript + Tailwind CSS
**Goal:** Minimal, memorable, fast, accessible, and responsive.

## 2. Design System
- Background: #FAFAFA light, #09090B dark
- Foreground: #09090B light, #FAFAFA dark
- Accent: #6366F1, Muted: #F4F4F5 light, #27272A dark
- Fonts: Space Grotesk for headings, Inter for body
- Motion: 600ms scroll reveal, 200ms card hover, staggered page load

## 3. Pages
1. **Home** (/) - Hero, about, projects, experience, contact, footer
2. **Projects** (/projects) - Filterable project gallery and project details
3. **About** (/about) - Profile, skills, experience, values
4. **Contact** (/contact) - Contact form and social links

## 4. Page Requirements
- Hero: first viewport identity statement, role, short positioning copy, project/contact CTAs, subtle interactive background.
- About: profile image, bio, skills grouped by category, progress or proficiency indicators.
- Projects: responsive cards with screenshot, title, description, tags, GitHub and live demo links; detail modal with gallery.
- Experience: vertical timeline with date, company, role, and impact bullets.
- Contact: name, email, subject, message, submit state, GitHub/LinkedIn/email links.

## 5. Data Model
- Project: id, title, description, image, tags, githubUrl, liveUrl, category
- Skill: name, level, category
- Experience: company, role, startDate, endDate, description
- ContactForm: name, email, subject, message
`,

  "tpl-saas": `# PRD - SaaS Landing Page

## 1. Project Overview
Build a conversion-focused SaaS landing page with product positioning, feature proof, pricing, testimonials, FAQ, and a clear acquisition funnel.

**Tech Stack:** React + TypeScript + Tailwind CSS
**Goal:** High-conversion, fast, accessible, analytics-ready marketing site.

## 2. Design System
- Primary: #6366F1, Primary hover: #4F46E5
- Background: #FFFFFF, Alternate section: #F8FAFC, Dark section: #0F172A
- Text: #0F172A heading, #475569 body, #94A3B8 muted
- Success: #10B981, Warning: #F59E0B, Error: #EF4444
- Fonts: Cal Sans or Inter for headings, Inter for body
- Motion: 500ms scroll reveal, button glow, 2s counter animation

## 3. Pages
1. **Home** (/) - Sticky nav, hero, logos, features, pricing, testimonials, FAQ, CTA, footer
2. **Pricing** (/pricing) - Plan comparison and billing toggle
3. **Docs Preview** (/docs) - Product education preview and onboarding CTA
4. **Contact Sales** (/contact) - Lead form and qualification fields

## 4. Page Requirements
- Navbar: logo, nav links, login, primary CTA, mobile sheet.
- Hero: clear headline, benefit copy, primary CTA, secondary demo CTA, product screenshot.
- Features: 3-column card grid and alternating detailed feature sections.
- Pricing: monthly/yearly toggle, three plan cards, popular plan highlight, feature comparison.
- Testimonials: carousel cards with quote, name, role, company, avatar.
- FAQ: accordion with 6-8 objections handled.
- CTA Banner: full-width conversion section with strong copy and CTA.

## 5. Data Model
- Plan: id, name, price, yearlyPrice, features, cta, popular
- Feature: id, title, description, icon
- Testimonial: id, text, author, role, company, avatar
- FAQ: id, question, answer
`,

  "tpl-blog": `# PRD - Blog Platform

## 1. Project Overview
Build a modern publishing platform with article discovery, categories, search, article detail pages, author pages, and newsletter capture.

**Tech Stack:** React + TypeScript + Tailwind CSS

## 2. Design System
- Background: #FFFFFF, Card: #F9FAFB
- Text: #111827 heading, #4B5563 body, #9CA3AF muted
- Primary: #3B82F6, Accent: #8B5CF6, Border: #E5E7EB, Code background: #1F2937
- Fonts: Merriweather for editorial headings, Source Sans 3 for body, Fira Code for code
- Motion: 300ms page fade, 200ms card hover, 500ms lazy-image blur

## 3. Pages
1. **Home** (/) - Featured article, latest posts, categories, newsletter
2. **Blog** (/blog) - Search, filters, post grid, pagination
3. **Category** (/category/:slug) - Category feed and sidebar
4. **Article** (/blog/:slug) - Cover, content, table of contents, author box, related posts
5. **About** (/about) - Author profile and site mission
6. **Contact** (/contact) - Contact form

## 4. Page Requirements
- Home: featured post card with cover image, category badge, author/date, latest post grid.
- Blog: category buttons, search input, post cards, pagination, popular posts sidebar.
- Article: large title, author metadata, cover image, markdown rendering, code blocks, blockquotes, TOC, comments.
- About: author bio, social links, metrics.
- Contact: name, email, subject, message, submit state.

## 5. Data Model
- Post: id, title, slug, content, excerpt, coverImage, category, tags, author, publishedAt, readingTime
- Category: id, name, slug, postCount
- Author: id, name, bio, avatar, socialLinks
- Comment: id, postId, name, email, content, createdAt
`,

  "tpl-dashboard": `# PRD - Analytics Dashboard

## 1. Project Overview
Build a data dashboard with metric cards, charts, tables, filters, reports, and real-time activity visibility.

**Tech Stack:** React + TypeScript + Tailwind CSS + Recharts
**Default Theme:** Dark

## 2. Design System
- Background: #09090B, Card: #18181B, Elevated: #27272A
- Text: #FAFAFA primary, #A1A1AA secondary, #71717A muted
- Primary: #3B82F6, Success: #22C55E, Warning: #EAB308, Error: #EF4444
- Chart palette: #3B82F6, #22C55E, #EAB308, #A855F7, #EC4899, #06B6D4
- Fonts: Inter for UI, JetBrains Mono for dense tables
- Motion: 800ms chart draw, 1.5s counter animation, 200ms card hover

## 3. Pages
1. **Dashboard** (/) - Date controls, metric cards, charts, latest activity
2. **Analytics** (/analytics) - Detailed charts and comparisons
3. **Users** (/users) - User table, filters, detail sheet
4. **Reports** (/reports) - Report list and report builder
5. **Settings** (/settings) - Profile, notifications, integrations, theme

## 4. Page Requirements
- Dashboard: date range picker, refresh button, four KPI cards, area chart, bar chart, pie chart, transactions table, live activity.
- Analytics: multi-series line chart, stacked bar chart, category/country/date filters, comparison overlay.
- Users: searchable table with avatar, email, status, last activity, detail sheet.
- Reports: report card grid, create-report form with type/date/format fields.
- Settings: tabbed forms and switches.

## 5. Data Model
- Metric: key, value, change, changePercent, period
- ChartData: timestamp, values
- User: id, name, email, avatar, status, createdAt, lastActive
- Transaction: id, userId, type, amount, status, createdAt
- Report: id, title, type, dateRange, format, url, createdAt
`,

  "tpl-admin": `# PRD - Admin Panel

## 1. Project Overview
Build a full CRUD admin system with authentication, user management, content management, categories, settings, and audit-friendly tables.

**Tech Stack:** React + TypeScript + Tailwind CSS + shadcn/ui + TanStack Table

## 2. Design System
- Background: #FFFFFF, Sidebar: #F8FAFC, Card: #FFFFFF
- Primary: #0F172A, Accent: #2563EB, Border: #E2E8F0
- Font: Inter, 14px base
- Spacing: 4px grid
- Dark mode via CSS custom properties

## 3. Pages
1. **Login** (/login) - Auth form and password recovery
2. **Dashboard** (/) - Metrics, recent activity, quick actions
3. **Users** (/users) - User data table and create/edit dialog
4. **Content** (/content) - Content data table and editor form
5. **Categories** (/categories) - Category table and sorting
6. **Settings** (/settings) - General, email, security, backup settings

## 4. Page Requirements
- Login: centered form, logo, email, password, login button, forgot-password link, error alert.
- Dashboard: four metric cards, recent activity list, quick action buttons.
- Users: selectable rows, avatar/name, email, role badge, status switch, actions menu, filters.
- Content: title, category, author, date, status, create/edit full-page form.
- Categories: table with order controls, create/edit dialog, parent category select.
- Settings: grouped forms with tabs.

## 5. Data Model
- User: id, name, email, role, status, avatar, createdAt
- Content: id, title, slug, body, categoryId, authorId, status, coverImage, seoTitle, seoDescription, createdAt, updatedAt
- Category: id, name, slug, parentId, sortOrder
- Setting: key, value, group
`,

  "tpl-mobile": `# PRD - Mobile Application

## 1. Project Overview
Build a React Native + Expo mobile app with tab navigation, searchable lists, detail screens, notifications, profile, and settings.

**Tech Stack:** React Native + Expo + TypeScript + NativeWind
**Platform:** iOS + Android

## 2. Design System
- Background: #FFFFFF light, #000000 dark
- Card: #F2F2F7 light, #1C1C1E dark
- Primary: #007AFF, Destructive: #FF3B30, Success: #34C759
- Text: #000000 light, #FFFFFF dark, Secondary text: #8E8E93
- Fonts: SF Pro on iOS, Roboto on Android
- Motion: 350ms slide transitions, 200ms tab cross-fade, 100ms press feedback

## 3. Screens
1. **Home** (/) - Header, carousel, feed list, pull-to-refresh
2. **Explore** (/explore) - Search, category chips, result list
3. **Detail** (/detail/:id) - Image, content, fixed CTA
4. **Notifications** (/notifications) - Grouped notification list
5. **Profile** (/profile) - Avatar, bio, stats, menu
6. **Settings** (/settings) - Switches, selects, destructive account action

## 4. Screen Requirements
- Bottom tabs: Home, Explore, Notifications, Profile with active/inactive colors.
- Home: title, notification icon, horizontal carousel, vertical item cards.
- Explore: sticky search bar, horizontal category filter chips, FlatList results.
- Detail: top image, back overlay, title, metadata, body, safe-area CTA bar.
- Notifications: sectioned groups, unread state, time labels.
- Profile: avatar, name, bio, stats row, grouped menu list.
- Settings: grouped list with switch/select/button items.

## 5. Data Model
- Item: id, title, subtitle, image, category, content, createdAt
- Notification: id, type, title, message, read, createdAt
- User: id, name, avatar, bio, stats
`,

  "tpl-game": `# PRD - Web Game

## 1. Project Overview
Build a browser-based 2D arcade/casual game with menu, gameplay, pause, game over, leaderboard, settings, and persistent high scores.

**Tech Stack:** React + TypeScript + HTML5 Canvas
**Genre:** 2D arcade/casual

## 2. Design System
- Background: #0A0A0A, Game area: #1A1A2E
- Primary: #E94560, Secondary: #0F3460, Accent: #16C79A
- Text: #EAEAEA, Score: #FFD700
- Fonts: Press Start 2P for arcade UI or Rajdhani for readable HUD
- Motion: 3s menu title float, 200ms button glow, 500ms game-over shake, particle effects

## 3. Screens
1. **Main Menu** (/) - Logo, play, leaderboard, settings
2. **Game** (/play) - Canvas, HUD, controls, pause
3. **Pause** (/pause) - Overlay with resume, restart, main menu
4. **Game Over** (/game-over) - Final score, high score, replay, main menu
5. **Leaderboard** (/leaderboard) - Stored scores
6. **Settings** (/settings) - Audio, difficulty, controls

## 4. Gameplay Requirements
- Canvas target: 60fps requestAnimationFrame loop.
- Controls: keyboard arrows/WASD plus mobile touch controls.
- State: menu, playing, paused, gameover.
- Entities: player, enemies, projectiles, particles, pickups.
- Collision: AABB or circle-circle with deterministic rules.
- Score: points, combo multiplier, bonus pickups.
- Persistence: localStorage high scores and settings.

## 5. Data Model
- GameState: score, lives, level, entities, timestamp
- HighScore: name, score, date
- Settings: volume, musicOn, difficulty
`,

  "tpl-docs": `# PRD - Documentation Site

## 1. Project Overview
Build a technical documentation site with sidebar navigation, Markdown rendering, search, code blocks, callouts, and table of contents.

**Tech Stack:** React + TypeScript + Tailwind CSS

## 2. Design System
- Background: #FFFFFF light, #0F1117 dark
- Sidebar: #F6F6F7 light, #1A1A24 dark
- Code background: #F6F8FA light, #161B22 dark
- Primary: #2563EB, Border: #E5E7EB light, #30363D dark
- Text: #1F2328 light, #E6EDF3 dark
- Fonts: Inter for UI, Fira Code or JetBrains Mono for code
- Motion: 200ms sidebar expand, 200ms command dialog scale + opacity

## 3. Pages
1. **Docs Home** (/) - Intro, quick starts, popular docs
2. **Guide** (/docs/:slug) - Markdown content with TOC
3. **Search** (/search) - Command palette results
4. **Changelog** (/changelog) - Release notes

## 4. Page Requirements
- Sidebar: logo, search trigger, nav groups, active state, collapsible groups, theme toggle, version badge.
- Content: breadcrumb, title, markdown body, headings, lists, tables, images, code blocks with copy button.
- Callouts: note, warning, tip, danger with colored left border and icon.
- Right TOC: sticky heading list with active scroll-spy.
- Search: keyboard shortcut, input, result list, highlighted matches, arrow-key navigation.
- Footer nav: previous/next links, edit-on-GitHub link, last updated date.

## 5. Data Model
- Page: id, slug, title, content, section, order, updatedAt
- NavSection: id, title, pages
- SearchResult: pageId, title, excerpt, url
`,

});

const TEMPLATE_SEEDS = Object.freeze([
  Object.freeze({"id": "tpl-ecommerce", "name": "E-Commerce", "category": "ecommerce", "platform": "web", "description": "Full e-commerce site with product discovery, cart, checkout, and account flows"}),
  Object.freeze({"id": "tpl-portfolio", "name": "Portfolio", "category": "portfolio", "platform": "web", "description": "Personal portfolio with projects, about, experience, and contact sections"}),
  Object.freeze({"id": "tpl-saas", "name": "SaaS Landing", "category": "saas", "platform": "web", "description": "SaaS landing page with hero, features, pricing, testimonials, and CTA"}),
  Object.freeze({"id": "tpl-blog", "name": "Blog", "category": "blog", "platform": "web", "description": "Blog site with article list, article details, categories, and search"}),
  Object.freeze({"id": "tpl-dashboard", "name": "Dashboard", "category": "dashboard", "platform": "web", "description": "Analytics dashboard with charts, tables, metrics, filters, and reports"}),
  Object.freeze({"id": "tpl-admin", "name": "Admin Panel", "category": "admin", "platform": "web", "description": "CRUD admin panel with users, content management, and settings"}),
  Object.freeze({"id": "tpl-mobile", "name": "Mobile App", "category": "mobile", "platform": "mobile", "description": "React Native mobile app with tab navigation, lists, details, and profile"}),
  Object.freeze({"id": "tpl-game", "name": "Game", "category": "game", "platform": "web", "description": "Canvas/WebGL game with menu, gameplay screen, settings, and score state"}),
  Object.freeze({"id": "tpl-docs", "name": "Documentation", "category": "docs", "platform": "web", "description": "Documentation site with sidebar navigation, Markdown rendering, and search"}),
]);

/** Fixed-schema install only: caller supplies its actual owner transaction. */
export async function installFreshInstallationMissionControlSchemaV1(
  sql: MissionControlTransactionV1,
  runtimeRole: string,
): Promise<void> {
  const suffix = typeof runtimeRole === "string" ? /^sf_runtime_([a-f0-9]{32})$/.exec(runtimeRole)?.[1] : undefined;
  if (!suffix) throw new Error("FRESH_INSTALLATION_MC_ROLE_INVALID");
  const ownerRole = `sf_owner_${suffix}`;
  const databaseName = `setfarm_install_${suffix}`;
  const owner = await sql.unsafe<Array<{ valid: boolean }>>(`
    SELECT current_user=$1 AND d.datname=$2 AND owner.rolname=$1
      AND NOT d.datistemplate AND d.datallowconn
      AND NOT owner.rolcanlogin AND NOT owner.rolsuper AND NOT owner.rolcreatedb
      AND NOT owner.rolcreaterole AND NOT owner.rolreplication AND NOT owner.rolbypassrls
      AND NOT owner.rolinherit
      AND runtime.rolname=$3 AND runtime.rolcanlogin AND runtime.oid<>owner.oid
      AND NOT runtime.rolsuper AND NOT runtime.rolcreatedb AND NOT runtime.rolcreaterole
      AND NOT runtime.rolreplication AND NOT runtime.rolbypassrls AND NOT runtime.rolinherit AS valid
    FROM pg_catalog.pg_database d
    JOIN pg_catalog.pg_roles owner ON owner.oid=d.datdba
    JOIN pg_catalog.pg_roles runtime ON runtime.rolname=$3
    WHERE d.datname=current_database()`, [ownerRole, databaseName, runtimeRole]);
  if (owner.length !== 1 || owner[0]?.valid !== true) {
    throw new Error("FRESH_INSTALLATION_MC_OWNER_REQUIRED");
  }
  const present = await sql.unsafe<Array<{ count: number }>>(`
    SELECT (
      (SELECT count(*) FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname=ANY($1::text[]))
      + (SELECT count(*) FROM pg_catalog.pg_type t
         JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
         WHERE n.nspname='public' AND t.typname=ANY($2::text[]))
    )::integer AS count`, [[...RELATIONS], [...ROW_TYPES]]);
  if (present.length !== 1 || present[0]?.count !== 0) {
    throw new Error("FRESH_INSTALLATION_MC_EXISTING_TARGET_REFUSED");
  }

  for (const statement of SCHEMA_STATEMENTS) await sql.unsafe(statement);
  for (const seed of TEMPLATE_SEEDS) {
    const content = TEMPLATE_CONTENTS[seed.id];
    if (typeof content !== "string" || !content) throw new Error("FRESH_INSTALLATION_MC_TEMPLATE_INVALID");
    await sql.unsafe(`INSERT INTO public.prd_templates
      (id,name,category,platform,description,prd_content) VALUES ($1,$2,$3,$4,$5,$6)`,
      [seed.id, seed.name, seed.category, seed.platform, seed.description, content]);
  }

  // Generated/validated role name only; all object and column names are fixed.
  const role = `"${runtimeRole}"`;
  const tables = "public.tasks, public.prds, public.prd_templates, public.agent_feed, public.live_events";
  await sql.unsafe(`REVOKE ALL PRIVILEGES ON TABLE ${tables} FROM PUBLIC, ${role}`);
  await sql.unsafe(`REVOKE ALL PRIVILEGES ON SEQUENCE public.agent_feed_id_seq FROM PUBLIC, ${role}`);
  await sql.unsafe(`GRANT SELECT ON TABLE ${tables} TO ${role}`);
  await sql.unsafe(`GRANT DELETE ON TABLE public.tasks, public.prds, public.agent_feed, public.live_events TO ${role}`);
  await sql.unsafe(`GRANT INSERT (id,title,description,assigned_agent,priority,status,images,created_at,updated_at)
    ON TABLE public.tasks TO ${role}`);
  await sql.unsafe(`GRANT UPDATE (title,description,assigned_agent,priority,status,images,updated_at)
    ON TABLE public.tasks TO ${role}`);
  await sql.unsafe(`GRANT INSERT (id,title,platform,urls,description,template_id)
    ON TABLE public.prds TO ${role}`);
  await sql.unsafe(`GRANT UPDATE (title,platform,urls,description,analysis,research,chat_history,prd_content,
    prd_version,score,score_details,mockup_screens,pages,cost_estimate,stitch_project_id,run_id,updated_at)
    ON TABLE public.prds TO ${role}`);
  await sql.unsafe(`GRANT INSERT (agent_id,agent_name,message,session_id,msg_hash)
    ON TABLE public.agent_feed TO ${role}`);
  await sql.unsafe(`GRANT USAGE ON SEQUENCE public.agent_feed_id_seq TO ${role}`);
  await sql.unsafe(`GRANT INSERT (id,ts,agent,model,tool,action,summary,file,status,duration_ms,exit_code,cwd,project,detail,output)
    ON TABLE public.live_events TO ${role}`);
}

# Next.js Best Practices Reference

> Source: Vercel Next.js Best Practices.
> Apply these rules when the project uses Next.js (app router).
> Skip entirely for plain React (Vite/CRA) projects.

---

## File Conventions

- Use `app/` directory with file-based routing
- Special files: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`
- Dynamic segments: `[slug]`, catch-all: `[...slug]`, optional: `[[...slug]]`
- Route groups: `(group)` for organization without URL impact
- `default.tsx` required for parallel route slots

## RSC Boundaries (CRITICAL)

- Server Components are default — only add `'use client'` when needed
- `'use client'` needed for: hooks, event handlers, browser APIs, state
- NEVER make client components async — only server components can be async
- NEVER pass non-serializable props (functions, classes) from server to client
- Push `'use client'` boundary as far down as possible (leaf components)

## Directives

- `'use client'` — marks component and its imports as client bundle
- `'use server'` — marks function as Server Action (callable from client)
- `'use cache'` — Next.js caching directive for data fetching

## Data Patterns

- **Server Components**: Direct DB/API access, no client bundle cost
- **Server Actions**: Mutations, form submissions (`'use server'`)
- **Route Handlers**: External webhooks, non-React consumers only
- Avoid waterfalls: use `Promise.all()` for parallel fetches
- Use `<Suspense>` to stream content and show loading states
- Preload pattern: call fetch early, await late

## Image Optimization

- ALWAYS use `next/image` instead of `<img>`
- Set explicit `width` and `height` or use `fill` prop
- Use `sizes` prop for responsive images: `sizes="(max-width: 768px) 100vw, 50vw"`
- LCP images: add `priority` prop
- Remote images: configure `remotePatterns` in `next.config.js`
- Use `placeholder="blur"` with `blurDataURL` for better UX

## Font Optimization

- ALWAYS use `next/font` — never manual `<link>` for Google Fonts
- Subset fonts: `subsets: ['latin']`
- Assign to CSS variable for Tailwind: `variable: '--font-heading'`
- Preload critical font weights only

## Metadata & SEO

- Use `generateMetadata` for dynamic pages
- Static metadata via `export const metadata = {...}`
- OG images: use `next/og` ImageResponse for dynamic generation
- File-based: `opengraph-image.tsx`, `favicon.ico`, `sitemap.xml`

## Error Handling

- `error.tsx` — catches errors in route segment (must be client component)
- `global-error.tsx` — catches root layout errors
- `not-found.tsx` — custom 404 pages
- Use `redirect()` for server-side redirects (throws, not returns)
- `notFound()` triggers nearest `not-found.tsx`

## Async Patterns (Next.js 15+)

- `params` and `searchParams` are now async — must `await` them
- `cookies()`, `headers()` are async — must `await`
- Use `React.use()` to unwrap promises in client components

## Bundling

- Mark server-incompatible packages in `serverExternalPackages`
- Use `next/dynamic` for heavy client components: `dynamic(() => import('...'), { ssr: false })`
- Analyze bundle: `ANALYZE=true next build` with `@next/bundle-analyzer`
- Prefer ESM packages over CommonJS

## Scripts

- Use `next/script` instead of `<script>` tags
- Loading strategies: `beforeInteractive`, `afterInteractive`, `lazyOnload`
- Inline scripts MUST have `id` prop
- Use `@next/third-parties` for Google Analytics, GTM

## Hydration Error Prevention

- Don't use `Date`, `Math.random()` in initial render without guard
- Don't nest `<p>` inside `<p>`, `<div>` inside `<p>` (invalid HTML)
- Browser extensions can modify DOM — use `suppressHydrationWarning` sparingly
- Use `useEffect` for browser-only values (window, localStorage)

## Self-Hosting

- Use `output: 'standalone'` in `next.config.js` for Docker
- Standalone output includes only needed `node_modules`
- For multi-instance: configure ISR cache handler
- Set `HOSTNAME=0.0.0.0` in Docker

## Performance Checklist

- [ ] No data waterfalls (parallel fetches + Suspense)
- [ ] `'use client'` only where needed, pushed to leaves
- [ ] Images use `next/image` with proper sizing
- [ ] Fonts use `next/font` with subsets
- [ ] Heavy components dynamically imported
- [ ] Metadata configured for all pages
- [ ] Error boundaries in place
- [ ] Loading states with `loading.tsx` or `<Suspense>`

# React Best Practices Reference

> Extracted from Vercel React Performance Guidelines.
> All developer agents MUST follow these rules when writing React code.

---

## CRITICAL: Eliminate Waterfalls

1. **Parallel fetches**: Use `Promise.all()` for independent async operations
2. **Defer await**: Move `await` into the branch where it's actually used
3. **Start early, await late**: In handlers, start promises immediately, await at the end
4. **Suspense boundaries**: Use `<Suspense>` to stream content and avoid blocking renders

## CRITICAL: Bundle Size

1. **No barrel imports**: Import directly from the module, never from `index.ts` barrel files
   ```tsx
   // BAD
   import { Button } from '@/components'
   // GOOD
   import { Button } from '@/components/Button'
   ```
2. **Dynamic imports**: Use `React.lazy()` or `next/dynamic` for heavy components (charts, editors, maps)
3. **Defer third-party**: Load analytics, logging, and tracking scripts after hydration
4. **Conditional loading**: Only import modules when the feature is activated

## HIGH: Performance Patterns

1. **Minimize serialization**: Pass only necessary data to child components, not entire objects
2. **Parallel fetching**: Restructure component tree to allow parallel data fetching
3. **Use SWR/React Query**: For client-side data fetching with automatic deduplication
4. **Passive event listeners**: Use `{ passive: true }` for scroll/touch listeners

## MEDIUM: Re-render Prevention

1. **Functional setState**: Use `setState(prev => ...)` for stable callbacks instead of creating new functions
2. **Lazy state init**: Pass a function to `useState` for expensive initial values: `useState(() => compute())`
3. **Derive state during render**: Don't use `useEffect` to compute derived state — do it inline
4. **Primitive deps**: Use primitive values (strings, numbers) in dependency arrays, not objects
5. **Hoist default props**: Define default non-primitive props outside the component to prevent re-renders
6. **Use refs for transient values**: Frequently changing values that don't need re-render → `useRef`
7. **startTransition**: Use `startTransition` for non-urgent state updates (search, filters)

## MEDIUM: Rendering

1. **Hoist static JSX**: Extract static JSX elements outside the component function
2. **content-visibility**: Use `content-visibility: auto` for long scrollable lists
3. **SVG precision**: Reduce SVG coordinate decimal places (2 max)
4. **Conditional render**: Use ternary `{x ? <A/> : <B/>}` not `{x && <A/>}` (avoids rendering `0` or `false`)
5. **No layout animation**: Only animate `transform` and `opacity`, never `width`/`height`/`margin`

## LOW-MEDIUM: JavaScript

1. **Use Map/Set**: For O(1) lookups instead of array `.find()` / `.includes()`
2. **Combine iterations**: Merge multiple `.filter().map()` chains into single loops
3. **Early return**: Exit functions early when conditions aren't met
4. **Cache regex**: Hoist `new RegExp()` outside loops and functions
5. **Check length first**: Check `array.length` before expensive array operations

---

## UX Quality Rules (from UI/UX Pro Max)

### Accessibility (MANDATORY)
- Color contrast: minimum 4.5:1 ratio for normal text
- Focus states: visible `focus-visible` rings on ALL interactive elements
- Alt text: descriptive alt for meaningful images, `alt=""` for decorative
- `aria-label`: required on ALL icon-only buttons
- Keyboard nav: tab order must match visual order
- Form labels: every input must have an associated `<label>`

### Touch & Interaction
- Touch targets: minimum 44x44px for all interactive elements
- Loading buttons: disable button + show spinner during async operations
- Error feedback: clear error messages near the problem source
- `cursor-pointer`: on ALL clickable non-link elements

### Layout
- Viewport meta: `width=device-width, initial-scale=1`
- Min body font: 16px on mobile
- No horizontal scroll: content must fit viewport width
- z-index scale: use consistent scale (10, 20, 30, 50)
- Line height: 1.5-1.75 for body text
- Line length: max 65-75 characters

### Animation
- Duration: 150-300ms for micro-interactions
- Only animate: `transform` and `opacity`
- Respect `prefers-reduced-motion: reduce`
- Use skeleton screens for loading states

### Icons & Visual
- NO emoji icons: use SVG (Lucide React or Heroicons)
- Consistent icon sizing: 24x24 viewBox, w-6 h-6
- Smooth transitions: `transition-colors duration-200`

---

## React Composition Patterns (from Vercel)

### Avoid Boolean Prop Proliferation
```tsx
// BAD — boolean props multiply
<Card isCompact isHighlighted hasBorder />

// GOOD — composition
<Card variant="compact">
  <Card.Highlight>
    <Card.Border>...</Card.Border>
  </Card.Highlight>
</Card>
```

### Compound Components
- Structure complex components with shared context (Provider + sub-components)
- Provider is the ONLY place that knows how state is managed
- Define generic interface: `{ state, actions, meta }`

### Explicit Variants Over Booleans
```tsx
// BAD
<Button isPrimary isLarge isLoading />

// GOOD
<Button variant="primary" size="lg" loading />
```

### Children Over Render Props
- Use `children` for composition instead of `renderHeader`, `renderFooter` props
- Render props only when child needs parent data

### State Lifting
- Move shared state into Provider components for sibling access
- Decouple implementation — consumers don't know if state is useState, Zustand, or URL params

### React 19+ (if applicable)
- Don't use `forwardRef` — pass `ref` as regular prop
- Use `use()` instead of `useContext()`

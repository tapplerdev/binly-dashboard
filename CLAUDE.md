# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Philosophy

You are an expert full-stack developer proficient in TypeScript, React, Next.js, and modern UI/UX frameworks (e.g., Tailwind CSS, Shadcn UI, Radix UI). Your task is to produce the most optimized and maintainable Next.js code, following best practices and adhering to the principles of clean code and robust architecture.

### Objective
Create Next.js solutions that are functional and adhere to best practices in performance, security, and maintainability.

## Server Management Rules

**CRITICAL - READ CAREFULLY:**
- **NEVER start the dev server (`npm run dev`) automatically** - The user will run it themselves
- **NEVER run background processes** without explicit user permission
- **DO NOT use `run_in_background: true`** for dev servers, builds, or any long-running commands
- If you need to check compilation errors, ASK the user to run the dev server first
- Only run quick commands like `git`, `npm install`, or single file operations
- The user manages all server processes - you only write code

## Code Style and Structure

- Write concise, technical TypeScript code with accurate examples
- Use functional and declarative programming patterns; avoid classes
- Favor iteration and modularization over code duplication
- Use descriptive variable names with auxiliary verbs (e.g., `isLoading`, `hasError`)
- Structure files with exported components, subcomponents, helpers, static content, and types
- Use lowercase with dashes for directory names (e.g., `components/auth-wizard`)

## Optimization and Best Practices

- Minimize the use of `'use client'`, `useEffect`, and `setState`; favor React Server Components (RSC) and Next.js SSR features
- Implement dynamic imports for code splitting and optimization
- Use responsive design with a mobile-first approach
- Optimize images: use WebP format, include size data, implement lazy loading

## Error Handling and Validation

Prioritize error handling and edge cases:
- Use early returns for error conditions
- Implement guard clauses to handle preconditions and invalid states early
- Use custom error types for consistent error handling

## UI and Styling

- Use modern UI frameworks (e.g., Tailwind CSS, Shadcn UI, Radix UI) for styling
- Implement consistent design and responsive patterns across platforms

## State Management and Data Fetching

- Use modern state management solutions (e.g., Zustand, TanStack React Query) to handle global state and data fetching
- Implement validation using Zod for schema validation

## Security and Performance

- Implement proper error handling, user input validation, and secure coding practices
- Follow performance optimization techniques, such as reducing load times and improving rendering efficiency

## Testing and Documentation

- Write unit tests for components using Jest and React Testing Library
- Provide clear and concise comments for complex logic
- Use JSDoc comments for functions and components to improve IDE intellisense

## Development Methodology

### 1. System 2 Thinking
Approach problems with analytical rigor. Break down requirements into smaller, manageable parts and thoroughly consider each step before implementation.

### 2. Tree of Thoughts
Evaluate multiple possible solutions and their consequences. Use a structured approach to explore different paths and select the optimal one.

### 3. Iterative Refinement
Before finalizing code, consider improvements, edge cases, and optimizations. Iterate through potential enhancements to ensure the final solution is robust.

## Implementation Process

1. **Deep Dive Analysis**: Conduct a thorough analysis of the task, considering technical requirements and constraints
2. **Planning**: Develop a clear plan outlining the architectural structure and flow of the solution
3. **Implementation**: Implement the solution step-by-step, ensuring each part adheres to specified best practices
4. **Review and Optimize**: Review the code for areas of potential optimization and improvement
5. **Finalization**: Ensure code meets all requirements, is secure, and is performant

---

## Hosting — how this dashboard is actually served (changed 2026-08-24)

### The short version

This is a **static site**. `npm run build` produces plain HTML, CSS and JS in
`out/`, those files are uploaded to a private S3 bucket, and CloudFront serves
them worldwide over HTTPS. **There is no Node server anywhere in production.**
Nothing runs on a request except the browser.

That's a change: it used to be a normal Next.js app that needed a server running
`next start`. Making it static is what allows it to live on AWS next to the rest
of Binly, for essentially nothing.

Infrastructure lives in `binly-backend/cdk/stacks/frontend_stack.py`.

### What "static export" means, and the three rules it imposes

`next.config.mjs` sets `output: 'export'`. Instead of building a server that
renders pages on demand, Next renders **every page once at build time** and
writes the resulting HTML to disk. There are 20 of them. What ships is a folder.

That buys simplicity and near-zero cost, but it takes away anything that needs
code to run per-request. Three rules follow, and **breaking any one of them
fails the build**, not production:

1. **No `middleware.ts`.** Next refuses to build an export that has one at all.
   Ours did the auth redirect — see the next section for where that went.
2. **No route handlers** (`app/**/route.ts`). We had one, at
   `app/docs/product-vision/route.ts`, which read an HTML file off disk on every
   request. That file now sits in `public/docs/product-vision.html` and is served
   as a plain asset.
3. **No dynamic route segments** (`app/bins/[id]/page.tsx`) unless you can list
   every possible value at build time via `generateStaticParams`. You obviously
   cannot list every bin id.

**Rule 3 is the one to watch.** Today there are ZERO `[param]` directories under
`app/` — every detail view is done client-side, with state or a query parameter.
That is the only reason this whole approach works. If you ever add
`app/bins/[id]/`, the build breaks and the fix is to use `/bins?id=123` instead.

### The auth gate moved, and it is not less secure

`middleware.ts` used to run on the server before every page and redirect you to
`/login` if you had no `binly-auth-token` cookie. That is now
`lib/auth/auth-gate.tsx`, running in the browser: `RequireAuth` wraps the
dashboard layout, `RedirectIfAuthenticated` wraps the login page.

**Why this loses no security.** The cookie it checked was written by client-side
JavaScript (`document.cookie` in `lib/auth/store.ts`). It was never `httpOnly`
and never signed, so anyone could type one into the console in about four
seconds. It decided *which screen you see*, not *what data you can reach*. The
actual security boundary is and always was the API: it verifies a JWT signature
on every single request and re-reads your role from Postgres for admin routes. A
faked cookie gets you an empty dashboard shell that 401s on every call — exactly
as true before this change as after.

**What genuinely changed:** the redirect happens a moment after the page starts
loading rather than before it is sent. So an unauthenticated visitor may see one
frame of blank layout. The gate deliberately renders a neutral spinner instead of
the real content while it decides, so that frame never contains data.

One subtlety worth knowing if you touch that file: the auth store persists to
`localStorage` via zustand, and **that read is asynchronous**. On the very first
render `token` is `null` even for a signed-in user. The gate waits for hydration
before deciding — without that wait, every returning user gets thrown to `/login`
on every hard refresh, which looks like broken sessions and is really a race.

### The AWS pieces, and what each one is for

| piece | what it does | why not something simpler |
|---|---|---|
| **S3 bucket** | holds the files from `out/` | it is **private** — no public URL |
| **CloudFront** | the CDN; HTTPS, caching, worldwide edges | S3 alone cannot do HTTPS on a custom domain |
| **Origin Access Control** | lets *only* CloudFront read the bucket | a public bucket can be read directly, bypassing the CDN |
| **CloudFront Function** | rewrites `/operations/routes/` → `.../index.html` | see below — this one is not optional |
| **ACM certificate** | the HTTPS certificate | free, but **must be issued in us-east-1** for CloudFront |
| **Route 53** | points your domain at CloudFront | only needed once you have a domain |

**The CloudFront Function is the non-obvious piece.** A private S3 bucket is
accessed over its REST API, which has no concept of "the index file in this
folder". A request for `/operations/routes/` asks S3 for a key that literally
ends in a slash, and gets a 403. (The old public "S3 website" endpoint *did*
handle this, but it is public-only and can't be locked behind CloudFront.) So a
tiny function runs at the edge and appends `index.html`. **Without it, every page
except the homepage 404s** — and only in production; local dev and the build look
perfectly fine.

### What it costs

**Essentially nothing.** Roughly **$0/month as configured today.**

- **S3** — ~10 MB of files, about **$0.0002/month**.
- **CloudFront** — the free tier is 1 TB of traffic and 10 million requests
  *every* month, permanently. A dashboard for ~10 operators is nowhere near it.
  **$0.**
- **ACM certificate** — free for CloudFront. **$0.**
- **Route 53** — **$0.50/month**, and *only once you attach a custom domain*.
  That is a per-hosted-zone charge. There is no public hosted zone on the
  account today, so this is not being paid.

So: **$0 now, about $0.50/month once a real domain points at it.** For context
the rest of the AWS bill is ~$53/month, mostly the NAT gateway.

### Deploying it

```bash
npm run build                                  # produces out/
cd ../binly-backend/cdk && npx --no-install cdk deploy BinlyFrontend
```

The CDK stack uploads `out/`, invalidates the CloudFront cache (skip that and the
CDN happily serves the previous build for hours, which looks like the deploy did
nothing), and prints the URL.

**With no domain configured it deploys anyway** and serves on a generated
`something.cloudfront.net` address. That is the current state and it is
deliberate — the hosting is useful before a domain exists. To attach one later:

```bash
DASHBOARD_DOMAIN=admin.yourdomain.com DASHBOARD_HOSTED_ZONE_ID=Z... \
  npx --no-install cdk deploy BinlyFrontend
```

Note for whenever that happens: if you point the **apex** domain
(`yourdomain.com`) at it you need an **A/ALIAS record, not a CNAME** — DNS
forbids a CNAME at the apex because it cannot coexist with the SOA and NS records
that must live there. A subdomain like `admin.yourdomain.com` could use either.
The stack uses an ALIAS, which is correct for both cases.

### It is live

**https://d1czl6f8c4vrm5.cloudfront.net** — deployed 2026-08-24. Verified: deep
links resolve (`/operations/routes/` → 200), the moved docs asset serves, a
missing path returns a real 404, and the S3 bucket refuses direct requests (403),
so the CDN cannot be bypassed.

### Which API it talks to — CHECK THIS BEFORE ASSUMING

`NEXT_PUBLIC_API_URL` (falling back to `NEXT_PUBLIC_BACKEND_URL`), read in
`lib/api/client.ts`. **It is baked in at build time**, not read at runtime —
`NEXT_PUBLIC_*` variables are substituted into the JavaScript during
`npm run build`. Pointing the dashboard at a different backend is therefore a
**rebuild and redeploy**, never an environment change on a running server, and
there is no way to tell from the deployed site which one it got.

> **The build deployed on 2026-08-24 points at RAILWAY**, not AWS —
> `https://ropacal-backend-production.up.railway.app`, confirmed by grepping the
> compiled chunks. So that CloudFront URL is currently a *hosted copy of the
> live production dashboard*, talking to the Go backend. Useful, but it is **not**
> exercising the Python port.
>
> Note `.env.local` and `.env.production` both set the Railway URL, and
> **`.env.local` wins** — Next gives it precedence in every environment except
> test. Editing only `.env.production` changes nothing.

To build against the AWS backend instead:

```bash
NEXT_PUBLIC_API_URL=https://ihb1xl9dr3.execute-api.us-east-1.amazonaws.com npm run build
cd ../binly-backend/cdk && npx --no-install cdk deploy BinlyFrontend
```

An inline variable beats both env files, so this needs no file edits and leaves
nothing behind to remember to revert. Verify what landed:

```bash
grep -rhoE "https://[a-z0-9.-]+(execute-api[a-z0-9.-]*|railway\.app)" out/_next/static/chunks/*.js | sort -u
```

One caveat if you do point it at AWS: **the two backends' tokens do not
interoperate** (Go signs HS256, the Python stack RS256), so you must log in
fresh against whichever one the build targets. A session from the other backend
will 401 on everything.

### Things that will break this, collected in one place

- Adding `middleware.ts` back, or any `route.ts` — build fails.
- Adding an `app/**/[param]/` directory — build fails.
- Using `next/image` with optimization on — it needs a server; `unoptimized: true`
  is set for this reason.
- Server Components that fetch at request time, `cookies()`, `headers()`,
  `'use server'` actions — none are used today and none can be.
- Deploying without invalidating the CDN cache — stale site, no error anywhere.

---

## Binly Dashboard Architecture

### Project Overview
Binly is a waste management command center dashboard following "Progressive Disclosure" UX patterns - every element is an interactive entry point to deeper functionality.

### Design System

#### Colors
- **Primary:** `#4880FF` - Interactive elements, primary actions
- **Background:** `#F4F5F9` - Page background
- **Cards:** White (`#FFFFFF`) with subtle shadows
- **Hover State:** `#EDF0FF` - Light blue background on hover

#### Typography
- **Font:** Montserrat in globals.css today (doc previously said Nunito Sans; body background is also pure white vs the documented #F4F5F9 — both flagged as a "TEMP monitor calibration" experiment in globals.css. Reconcile deliberately: either restore the documented tokens or bless the current ones.)
- **Scale:** Responsive sizing with font-semibold for headings

#### Component Patterns
- **Cards:** Always use `rounded-2xl` (16px border radius)
- **Shadows:** Use `card-shadow` utility for default, `card-shadow-hover` for hover states
- **Transitions:** All interactive elements use `transition-card` (200ms ease-in-out)
- **Spacing:** Consistent padding using p-4 (16px) for cards

#### NEVER Use Native Browser Dialogs
**NEVER** use `window.confirm()`, `window.alert()`, or `window.prompt()`. Always use custom modal components:
- **Confirmations:** Use `DeleteConfirmationModal` from `components/binly/delete-confirmation-modal.tsx` — supports custom title, message, confirm/cancel text, loading state
- **Errors:** Show inline error banners within the component, not `alert()`
- **Info:** Use toast notifications or inline messages

#### Modal Pattern (REQUIRED for all modals)
All modals MUST use the `useModalClose` hook from `components/binly/modal-wrapper.tsx` and the global CSS classes from `globals.css`:

```tsx
import { useModalClose } from '@/components/binly/modal-wrapper';

function MyModal({ onClose }: { onClose: () => void }) {
  const { handleClose, backdropClass, containerClass } = useModalClose(onClose);
  // For modals with an `open` prop that don't unmount: useModalClose(onClose, open)

  return (
    <>
      <div className={backdropClass} onClick={handleClose} />
      <div className={containerClass}>
        <div className="modal-content modal-full"> {/* or modal-lg, modal-md, modal-sm */}
          {/* header, body, footer */}
        </div>
      </div>
    </>
  );
}
```

- `modal-full`: 1800px max-width, 96vh height (placement, schedule moves)
- `modal-lg`: 1400px max-width, 90vh height
- `modal-md`: 640px max-width
- `modal-sm`: 480px max-width
- All modals get consistent 0.3s fade+scale open/close animations
- `p-6` padding ensures shadow renders on all sides (no clipping)
- Close buttons must use `handleClose` (not `onClose` directly) for exit animation

#### Map Layer Pattern (REQUIRED for all maps)
All maps MUST use shared layer components from `components/binly/map-layers/`:

```tsx
import { BinMarkersLayer, ZoneMarkersLayer, WarehouseMarkerLayer } from '@/components/binly/map-layers';

<GoogleMap ...>
  <BinMarkersLayer />           {/* fill-level colored circles, active bins only */}
  <ZoneMarkersLayer />          {/* red NoGoZonePin markers */}
  <WarehouseMarkerLayer />      {/* blue house icon */}
  <PotentialLocationsLayer />   {/* orange pins */}
</GoogleMap>
```

- `BinMarkersLayer` props: `size="sm"|"md"|"lg"`, `showLabels`, `filter`, `excludeStatuses`
- Layers fetch their own data via hooks — no need to pass data manually
- Rendering matches `live-map-view.tsx` (the gold standard)

### Target-area overlay (city boundaries)

`TargetAreaOverlay` (mounted inside the Create Potential Location dialog's map)
draws a picked area when the AI Suggest picker resolves one. It fetches the
area's TRUE legal boundary via `getAreaBoundary()` (`lib/api/areas.ts` → backend
`GET /api/areas/boundary`, TIGER city polygons) and, when found, draws that real
polygon (annexation slivers, holes, MultiPolygons) on a dedicated
`google.maps.Data` layer plus h3 hexes tiling the real shape. Districts,
counties, and unknown cities return `found=false`, and it falls back to the HERE
search bbox + hexes — the geometry the recommender actually sweeps. TIGER covers
incorporated cities only; neighborhoods are deliberately not licensed.

### Placement modal — tabs + shared basket (core+halo)

`create-potential-location-dialog.tsx` has two first-class INPUT tabs — Manual
and AI Recommendations (`ai-recommend-panel.tsx`) — feeding one shared review
basket (`placement-review-basket.tsx`) that groups picks as **In-area /
Near-area / Manual** before a single Create-N submit. Queue items are the shared
`QueuedLocation` (`lib/types/placement.ts`): `id`, `source` ('manual'|'ai'),
plus AI enrichment (`score`, `reasoning`, `locality`, `distanceFromAreaMi`,
`areaMatch`). The AI tab's "Strictly inside ⟷ Include nearby matches" toggle
sets `include_nearby` on the recommender: on = also surface profile-matching
spots just outside the area (`locality:'near_area'`, with distance-past-edge +
match strength); off = strictly in-area. Map click is scoped to the Manual tab;
submit uses a synchronous re-entry guard.

### Redeployments vs Placements (REQUIRED domain rule for shift-task UI)

Backend Phase 2 (2026-07): a **redeployment** (existing bin leaving the warehouse for
a field spot) is executed as ONE `route_tasks` row with `task_type='placement'` —
but it is tracked as a **move request** (the Move Requests table, urgency, audit
trail). The internal task_type must NEVER leak to users:

- **Discriminate** with `isRedeployPlacement()` from
  `components/binly/shift-task-card.tsx` (checks `placement_source === 'redeployment'`,
  falls back to `move_request_id != null` — among placements, only redeployments
  carry a move). Both `tasks/detailed` and shift-history feeds emit `placement_source`.
- **Redeployment** = teal + `Truck` icon + label **"Redeployment · Bin #N"**
  (`bin_number` — the existing bin). Completion finalized an existing bin, nothing
  was created.
- **Plain placement** (new bin from a potential location: `potential_location_id`
  set, no move link) = orange + `Package`/`MapPin` + "Placement #N"
  (`new_bin_number`). Completion CREATED a bin ("Converted to Bin #N").
- Shared label logic: `getTaskLabel()` in `lib/types/route-task.ts` already handles
  both — prefer it over hand-rolled labels.
- Metrics caveat: anything counting "placements" includes redeployments; filter by
  `placement_source` if a metric needs new-bin installs only.

### Component Architecture

#### Base UI Components (`components/ui/`)
Built with Shadcn UI patterns, these are primitive components:
- `card.tsx` - Base card component with Header, Content, Footer variants
- `badge.tsx` - Status indicators with variant support
- `button.tsx` - Interactive buttons with size/variant options

#### Binly Components (`components/binly/`)
Domain-specific components for the dashboard:

1. **KpiCard** - Metric display cards with click-through navigation
   - Used for: Total Harvest, Fleet Status, Critical Bins, Response Needed
   - Props: `title`, `value`, `icon`, `trend`, `onClick`

2. **IntelligenceCard** - AI-powered insights and recommendations
   - Used for: Predictive alerts, route optimization, performance tracking
   - Props: `title`, `description`, `timestamp`, `icon`, `onClick`

3. **TacticalMap** - Map container with layer toggles
   - Features: Harvest/Battlefield toggle switches, "Go to Live Map" button
   - Future: Integrate with Mapbox/Google Maps for real functionality

4. **FieldFeedItem** - Activity log entries
   - Used for: Driver updates, landlord requests, system confirmations
   - Props: `title`, `description`, `icon`, `onClick`

5. **SearchBar** - Global search with results dropdown
   - Placeholder: "Search Bin ID, Driver Name, or Location..."
   - Future: Implement search results dropdown with click-to-open drawer

### Progressive Disclosure Pattern

Every interactive element should:
1. Show summary information by default
2. Provide a click handler for navigation or detail view
3. Use hover states to indicate interactivity
4. Maintain visual consistency with the design system

### Interactive Navigation Map

- **KPI Cards → Modules:**
  - Total Harvest → Intelligence > Analytics
  - Fleet Status → Operations > Live Map
  - Critical Bins → Management > Inventory (filtered >80% fill)
  - Response Needed → Operations > Field Reports (unread only)

- **Map Interactions:**
  - Driver markers → Floating Follow Card (speed, last bin, Follow button)
  - Bin markers → Right-Side Details Drawer (ID, photo, fill %, move history)

- **Intelligence Cards:**
  - Predictive alerts → Predictive Insights page with highlighted bins
  - Route optimization → Active Routes with Smart-Path overlay
  - Top Performer → Leaders Panel with rankings

- **Field Feed:**
  - Activity logs → Specific Field Report with full details
  - Move requests → Inventory bin details with relocation dialogue

### Development Commands

**TYPE CHECKING IS OFF.** `next.config.mjs` sets `typescript.ignoreBuildErrors: true` AND `eslint.ignoreDuringBuilds: true`, and `npx tsc --noEmit` currently reports **205 errors**. So a green `npm run build` says nothing about types — a real error in new code is indistinguishable from the existing 205. Run `npx tsc --noEmit 2>&1 | grep 'yourfile'` to check your own work.

Backend + service map: see `ropacal-backend/CLAUDE.md` → "Service topology". Not duplicated here.

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Lint code
npm run lint
```

### File Structure Convention

```
app/
  [route]/
    page.tsx          # Route page (Server Component by default)
    layout.tsx        # Route layout if needed
    loading.tsx       # Loading UI
    error.tsx         # Error boundary

components/
  ui/                 # Shadcn base components
  binly/              # Domain-specific components

lib/
  utils.ts            # Shared utilities
  [feature]/          # Feature-specific utilities
```

### When Creating New Components

1. Determine if it's a base UI component or domain-specific
2. Base UI components go in `components/ui/` using Shadcn patterns
3. Binly-specific components go in `components/binly/`
4. Always include TypeScript interfaces for props
5. Use `'use client'` directive ONLY when necessary (interactivity, hooks)
6. Maintain design system consistency (colors, spacing, shadows, transitions)
7. Include onClick handlers for Progressive Disclosure navigation

### Styling Rules

- Use Tailwind utility classes
- Extract repeated patterns to component defaults
- Use `cn()` utility for conditional classes
- Hover states should be subtle but noticeable
- All clickable elements should have cursor-pointer
- Transitions should be 200ms ease-in-out

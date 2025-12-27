# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Philosophy

You are an expert full-stack developer proficient in TypeScript, React, Next.js, and modern UI/UX frameworks (e.g., Tailwind CSS, Shadcn UI, Radix UI). Your task is to produce the most optimized and maintainable Next.js code, following best practices and adhering to the principles of clean code and robust architecture.

### Objective
Create Next.js solutions that are functional and adhere to best practices in performance, security, and maintainability.

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
- **Font:** Nunito Sans (loaded via next/font/google)
- **Scale:** Responsive sizing with font-semibold for headings

#### Component Patterns
- **Cards:** Always use `rounded-2xl` (16px border radius)
- **Shadows:** Use `card-shadow` utility for default, `card-shadow-hover` for hover states
- **Transitions:** All interactive elements use `transition-card` (200ms ease-in-out)
- **Spacing:** Consistent padding using p-4 (16px) for cards

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

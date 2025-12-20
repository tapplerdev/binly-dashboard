# Binly Dashboard - The Pulse

A high-end command center for waste management operations built with Next.js 14, TypeScript, Tailwind CSS, and Shadcn UI.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** Shadcn UI + Radix UI
- **Icons:** Lucide React
- **Animations:** Framer Motion
- **Form Validation:** Zod

## Design System

### Colors
- **Primary:** `#4880FF` - Brand blue for interactive elements
- **Background:** `#F4F5F9` - Light gray for page background
- **Cards:** White with subtle shadow
- **Hover:** `#EDF0FF` - Light blue hover state

### Typography
- **Font Family:** Nunito Sans
- **Headings:** Bold, various sizes
- **Body:** Regular weight, 14-16px

### Components
- **Cards:** `rounded-2xl` with card-shadow
- **Spacing:** Consistent padding (p-4, p-6)
- **Transitions:** 200ms ease-in-out for smooth interactions

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

### Build

```bash
npm run build
```

### Production

```bash
npm start
```

## Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout with font configuration
│   ├── page.tsx           # Main "Pulse" dashboard page
│   └── globals.css        # Global styles and design tokens
├── components/
│   ├── ui/                # Base Shadcn UI components
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   └── button.tsx
│   └── binly/             # Custom Binly components
│       ├── kpi-card.tsx          # Metric cards (Total Harvest, Fleet Status, etc.)
│       ├── intelligence-card.tsx  # AI insights cards
│       ├── tactical-map.tsx      # Map container with toggles
│       ├── field-feed-item.tsx   # Activity feed items
│       └── search-bar.tsx        # Global search component
├── lib/
│   └── utils.ts           # Utility functions (cn, etc.)
└── CLAUDE.md              # Development guidelines for AI assistants

```

## Interactive Features

### KPI Cards
Each card navigates to a specific module:
- **Total Harvest** → Intelligence > Analytics
- **Fleet Status** → Operations > Live Map
- **Critical Bins** → Management > Inventory (filtered)
- **Response Needed** → Operations > Field Reports

### Tactical Map
- Click driver markers to open Follow Card
- Click bin markers to open Details Drawer
- Toggle Harvest/Battlefield layers

### Intelligence Highlights
- Predictive alerts with AI recommendations
- Route optimization suggestions
- Performance tracking

### Field Friction Feed
- Activity logs with navigation to detailed views
- Vandalism reports
- Move requests

## Styling Guidelines

All components follow the existing dashboard aesthetic:
- Clean, professional appearance
- Subtle hover effects with elevation
- Consistent rounded corners (16px)
- Shadow system for depth
- Smooth transitions (200ms)

## Next Steps

1. **Map Integration:** Replace placeholder with Mapbox/Google Maps
2. **Data Fetching:** Implement TanStack Query for server state
3. **State Management:** Add Zustand for client state if needed
4. **Authentication:** Implement auth guards and user sessions
5. **API Routes:** Create Next.js API routes or integrate with existing backend

## License

Private - Ropacal Operations

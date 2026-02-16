# Enhanced Schedule Move Modal with Map

## Overview

A complete redesign of the move request modal with:
- **Split-view layout**: Bin list (40%) + Interactive Google Map (60%)
- **Interactive bin selection**: Click bins on map or checkboxes in list
- **Per-bin granular control**: Each bin can have different move type and assignment
- **Bulk actions**: Quick assign all bins to same target
- **Advanced filtering**: Filter by fill level (Critical, High, Medium, Low)
- **Lasso select**: Draw to select multiple bins at once (UI ready)
- **Satellite map view**: Google Maps satellite imagery
- **Mobile responsive**: Stacks form above map on small screens

## Recent Updates

### ✅ Completed Features (Latest)
1. **Satellite Map View**: Changed from default to satellite view
2. **Fill Level Filter**: Filter bins by fill percentage with dropdown
3. **Lasso Select Button**: UI button added (logic to be implemented)
4. **Ascending Bin Sort**: Bins automatically sorted by bin number (1 → highest)
5. **Bin Markers**: All bins rendered as clickable markers on map
6. **Interactive Map**: Full drag, zoom, and pan support

### Map Features
- **Clickable Markers**: Click any bin marker to select/deselect
  - Color-coded by fill percentage (red/yellow/green)
  - Selected bins show pulsing blue rings
  - Hover to see bin number and fill percentage
  - Markers show bin number inside
- **Satellite View**: High-quality satellite imagery
- **Full Interaction**: Drag, zoom, pan enabled with `gestureHandling="greedy"`
- **Map Legend**: Bottom-left legend explains marker colors and selection
- **Lasso Mode**: Button in top-right (functionality to be added)

### List Features
- **Checkbox Selection**: Check/uncheck bins in scrollable list
- **Real-time Sync**: Selection syncs between map and list
- **Search Bar**: Find bins by number, street, city, or ZIP
- **Fill Level Filter**: Dropdown with color indicators
  - All bins
  - Critical (80-100%) - Red
  - High (50-79%) - Yellow
  - Medium (20-49%) - Green
  - Low (0-19%) - Gray
- **Sorted Display**: Always shows bins in ascending order by number

### Configuration Features (Step 2)
- **Per-Bin Cards**: Each selected bin gets its own configuration
- **Move Type**: Store or Relocate
- **HERE Maps Autocomplete**: For relocation addresses
- **Assignment Options**:
  - Leave Unassigned
  - Assign to User (manual one-off)
  - Assign to Active Shift
  - Assign to Future Shift
- **Insert Position**: For future shifts (Start or End)
- **Notes**: Optional per-bin notes

## Usage

```tsx
import { ScheduleMoveModalWithMap } from '@/components/binly/schedule-move-modal-with-map';

// Option 1: Open empty (user selects bins via map/search)
<ScheduleMoveModalWithMap
  onClose={() => setShowMoveModal(false)}
  onSuccess={() => {
    toast.success('Move requests created!');
  }}
/>

// Option 2: Open with pre-selected single bin
<ScheduleMoveModalWithMap
  bin={selectedBin}
  onClose={() => setShowMoveModal(false)}
  onSuccess={() => toast.success('Move request created!')}
/>

// Option 3: Open with pre-selected multiple bins
<ScheduleMoveModalWithMap
  bins={[bin1, bin2, bin3]}
  onClose={() => setShowMoveModal(false)}
  onSuccess={() => toast.success(`${bins.length} move requests created!`)}
/>
```

## Props

```typescript
interface ScheduleMoveModalWithMapProps {
  bin?: BinWithPriority;           // Single bin (optional)
  bins?: BinWithPriority[];        // Multiple bins (optional)
  onClose: () => void;              // Required: Close handler
  onSuccess?: () => void;           // Optional: Success callback
}
```

## Environment Requirements

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` must be set in `.env.local`
- Google Maps API must have:
  - Maps JavaScript API enabled
  - Marker Customization API enabled

## Dependencies

All dependencies are already installed:
- `@vis.gl/react-google-maps` - Google Maps React library
- `@tanstack/react-query` - Data fetching
- `lucide-react` - Icons
- HERE Maps autocomplete (already in project)

## API Calls

### On Load:
- `GET /api/manager/bins` - Fetch all bins for map
- `GET /api/users` - Fetch users for assignment
- `GET /api/shifts` - Fetch shifts for assignment

### On Submit:
- `POST /api/manager/bins/schedule-move` (N times) - Create move requests
- `PUT /api/manager/bins/move-requests/:id/assign-to-user` (optional, per bin)
- `POST /api/manager/bins/move-requests/:id/assign-to-shift` (optional, per bin)

## Performance

- Parallel creation: All move requests created simultaneously
- Sequential assignment: Assignments happen after all creates complete
- For 10 bins: ~20 API calls (10 creates + up to 10 assigns)
- Future optimization: Backend batch endpoint (not required for MVP)

## Design Patterns Used

- **Split-view modal**: List + Map layout
- **Bin markers**: Color function from `lib/types/bin.ts` (getBinMarkerColor)
- **Mobile responsive**: Stacks vertically on small screens
- **Portal rendering**: Uses `createPortal` for proper z-index
- **Animation**: Fade-in/scale-in for modal, pulse for selected bins
- **useMemo optimization**: Filtered/sorted bins cached for performance

## Testing Checklist

- [x] Map loads with all bins visible
- [x] Map shows satellite view
- [x] Bin markers rendered with correct colors
- [x] Click bin marker to select (blue ring appears)
- [x] Search finds bins and shows in list
- [x] Fill level filter dropdown works
- [x] Multiple bins can be selected
- [x] Bins sorted by ascending number
- [x] Map can be dragged and zoomed
- [x] Lasso button visible (logic pending)
- [ ] Lasso select functionality
- [ ] Step 2 configuration works
- [ ] Bulk actions apply to all bins
- [ ] Per-bin move type toggles work
- [ ] HERE Maps autocomplete fills relocation address
- [ ] Assignment dropdowns show correct users/shifts
- [ ] Submit creates all move requests
- [ ] Dashboard refreshes with new move requests

## Known Limitations & Future Work

1. **Lasso Select**
   - UI button added but drawing logic not implemented yet
   - Future: Add polygon drawing on map to select bins within area

2. **Insert After Bin** for active shifts not implemented yet
   - Current: Can only insert at "next waypoint" (backend default)
   - Future: Add dropdown to select specific bin to insert after

3. **Map search overlay** is basic
   - Current: Simple input that filters dropdown
   - Future: Could add autocomplete on map itself

4. **Validation** is minimal
   - Relocation addresses not validated before submit
   - Backend will catch errors

5. **No batch endpoint**
   - Uses N+1 API calls
   - Works fine for <20 bins
   - Future: Add batch endpoint for efficiency

## File Location

`/components/binly/schedule-move-modal-with-map.tsx`

## Integration

### Bins Management Page
Location: `app/(dashboard)/administration/bins/page.tsx`

```tsx
import { ScheduleMoveModalWithMap } from '@/components/binly/schedule-move-modal-with-map';

<ScheduleMoveModalWithMap
  bin={modalTargetBin || undefined}
  bins={modalTargetBins.length > 0 ? modalTargetBins : undefined}
  onClose={() => { /* ... */ }}
  onSuccess={() => { /* ... */ }}
/>
```

### Move Requests List
Location: `components/binly/move-requests-list.tsx`

Uses BOTH modals:
- **ScheduleMoveModalWithMap**: For creating new move requests
- **ScheduleMoveModal**: For editing existing move requests

```tsx
// Create new
<ScheduleMoveModalWithMap
  onClose={() => setShowCreateMoveModal(false)}
/>

// Edit existing
<ScheduleMoveModal
  moveRequest={moveToEdit}
  onClose={() => setShowScheduleMoveModal(false)}
/>
```

## Commits

- Initial implementation with split-view and map
- Redesign with improved layout and styling
- Added satellite view, filters, lasso button, and bin markers

## Questions?

Contact the dev team or check the conversation history for detailed exploration notes.

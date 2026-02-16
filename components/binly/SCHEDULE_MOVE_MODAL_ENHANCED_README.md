# Enhanced Schedule Move Modal with Map

## Overview

A complete redesign of the move request modal with:
- **Split-view layout**: Form (35%) + Interactive Google Map (65%)
- **Multi-step wizard**: Selection → Configuration → Submit
- **Per-bin granular control**: Each bin can have different move type and assignment
- **Bulk actions**: Quick assign all bins to same target
- **Mobile responsive**: Toggle between form and map views

## Features

### Step 1: Selection
- **Interactive Google Map**: All bins rendered as clickable markers
  - Color-coded by fill percentage (red/yellow/green)
  - Click to select/deselect
  - Selected bins show pulsing blue rings
  - Map legend at bottom left
- **Search Bar**: Find bins by number, street, city, or ZIP
  - Dropdown with 50 results
  - Click result to select and pan to bin
- **Selected Bins Panel**: Shows chips for selected bins
  - Remove individual bins with X button
  - "Clear All" button
- **Global Date Setting**: Apply same move date to all bins
  - Quick select: 24hrs, 3 days, Next week, Custom
- **Mobile Toggle**: Switch between Form and Map views

### Step 2: Configuration
- **Bulk Actions Panel**:
  - Set all move types (Store All / Relocate All)
  - Assign all to same target (dropdown with users/shifts)
- **Per-Bin Configuration Cards**:
  - Bin header with colored marker and info
  - Move Type: Store or Relocate
  - New Location (for relocations):
    - HERE Maps autocomplete for address
    - City and ZIP fields
  - Assignment dropdown:
    - Leave Unassigned
    - Assign to User (manual one-off)
    - Assign to Active Shift
    - Assign to Future Shift
  - Insert Position (for future shifts): Start or End
  - Notes field (optional)
  - Remove bin button

### Submission
- Creates all move requests in parallel (performance optimized)
- Assigns each to its configured target
- Shows loading state with progress
- Invalidates cache to refresh dashboard

## Usage

```tsx
import { ScheduleMoveModalWithMap } from '@/components/binly/schedule-move-modal-with-map';

// In your component:
const [showMoveModal, setShowMoveModal] = useState(false);

// Option 1: Open empty (user selects bins via map/search)
<ScheduleMoveModalWithMap
  onClose={() => setShowMoveModal(false)}
  onSuccess={() => {
    // Handle success (e.g., show toast, refresh data)
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

- **Split-view modal**: Matches `create-potential-location-dialog.tsx` pattern
- **Bin markers**: Same style as `live-map-view.tsx` (color function reused)
- **Mobile responsive**: Toggle buttons like potential location modal
- **Portal rendering**: Uses `createPortal` for proper z-index
- **Animation**: Fade-in/scale-in for modal, pulse for selected bins

## Testing Checklist

- [ ] Map loads with all bins visible
- [ ] Click bin marker to select (blue ring appears)
- [ ] Search finds bins and pans to location
- [ ] Multiple bins can be selected
- [ ] "Next" button disabled when no bins selected
- [ ] Step 2 shows correct number of configuration cards
- [ ] Bulk actions apply to all bins
- [ ] Per-bin move type toggles work
- [ ] HERE Maps autocomplete fills relocation address
- [ ] Assignment dropdowns show correct users/shifts
- [ ] Insert position shows for future shifts only
- [ ] Submit creates all move requests
- [ ] Dashboard refreshes with new move requests
- [ ] Mobile view toggles between form/map

## Known Limitations

1. **Insert After Bin** for active shifts not implemented yet
   - Current: Can only insert at "next waypoint" (backend default)
   - Future: Add dropdown to select specific bin to insert after

2. **Map search overlay** is basic
   - Current: Simple input that filters dropdown
   - Future: Could add autocomplete on map itself

3. **Validation** is minimal
   - Relocation addresses not validated before submit
   - Backend will catch errors

4. **No batch endpoint**
   - Uses N+1 API calls
   - Works fine for <20 bins
   - Future: Add batch endpoint for efficiency

## Migration from Old Modal

To replace the old `ScheduleMoveModal` with this enhanced version:

1. Find all usages of `ScheduleMoveModal` in your codebase
2. Replace import:
   ```tsx
   // Old:
   import { ScheduleMoveModal } from '@/components/binly/bin-modals';

   // New:
   import { ScheduleMoveModalWithMap } from '@/components/binly/schedule-move-modal-with-map';
   ```
3. Props are the same, no code changes needed!

## File Location

`/components/binly/schedule-move-modal-with-map.tsx`

## Screenshots

(Add screenshots here after testing)

## Questions?

Contact the dev team or check the original exploration report in conversation history.

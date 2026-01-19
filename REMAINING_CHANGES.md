# Remaining Changes for Bins Management Page

## ✅ COMPLETED:
1. Updated imports - added Dropdown, MultiSelectDropdown, SegmentedControl
2. Updated state - added sortDirection, filters array, searchQuery, openMenuId, selectedBins
3. Added handlers - handleSort, handleSelectBin, handleSelectAll, clearSelection
4. Updated queries - separate KPI query, client-side filtering/sorting
5. Replaced filter UI - now has Filter dropdown, Search bar, Status segmented control

## 🔧 STILL NEEDED:

### 1. Add Sortable Column Headers
**Location:** Table `<thead>` section (around line 407 in current file)

**Changes needed:**
- Add checkboxcolumn header with "Select All" checkbox (5% width)
- Make Bin, Priority, Fill Level, Last Checked, and Status headers sortable
- Add ChevronUp/ChevronDown icons (always gray - no highlighting)
- Remove the "#" from "Bin #" header
- Add `table-fixed` class to `<table>`

**Example for Bin column:**
```tsx
<th className="text-left py-3 px-4 w-[8%]">
  <button
    onClick={() => handleSort('bin_number')}
    className="flex items-center gap-1 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
  >
    Bin
    <div className="flex flex-col -space-y-1">
      <ChevronUp className="w-3 h-3 text-gray-400" />
      <ChevronDown className="w-3 h-3 text-gray-400" />
    </div>
  </button>
</th>
```

**Column widths:**
- Checkbox: 5%
- Bin: 8%
- Location: 25%
- Priority: 12%
- Fill Level: 12%
- Status: 12%
- Last Checked: 18%
- Actions: 13%

### 2. Add Multi-Select Checkboxes
**Location:** Table rows in `<tbody>`

**Changes:**
- Add checkbox as first `<td>` in each row
- Use `onClick={(e) => e.stopPropagation()` to prevent drawer opening
- Style: `w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer`

**Example:**
```tsx
<td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
  <input
    type="checkbox"
    checked={selectedBins.has(bin.id)}
    onChange={() => handleSelectBin(bin.id)}
    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
  />
</td>
```

### 3. Remove "#" from Bin Numbers
**Location:** Bin number cell (currently around line 316)

**Change:**
```tsx
// FROM:
<span className="font-semibold text-gray-900">#{bin.bin_number}</span>

// TO:
<span className="font-semibold text-gray-900">{bin.bin_number}</span>
```

### 4. Remove Status Icons
**Location:** Status cell (currently around line 341-344)

**Change:**
```tsx
// FROM:
<div className="flex items-center gap-2">
  <StatusIcon className="w-4 h-4" />
  <Badge className={status.color}>{status.label}</Badge>
</div>

// TO:
<Badge className={cn(status.color, 'min-w-[80px] justify-center')}>{status.label}</Badge>
```

### 5. Remove Flags Column Entirely
**Location:** Table header and body

**Changes:**
- Delete the entire `<th>` for "Flags" (around line 421)
- Delete the entire `<td>` for flags in the row (around line 362-380)

### 6. Update Actions Column
**Location:** Actions cell (currently line 381-392)

**Replace with:**
```tsx
<td className="py-4 px-4">
  <div className="flex items-center justify-center gap-2">
    {/* View Details Icon */}
    <button
      onClick={(e) => {
        e.stopPropagation();
        setSelectedBin(bin);
      }}
      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
      title="View Details"
    >
      <Eye className="w-4 h-4 text-gray-600" />
    </button>

    {/* More Actions Menu */}
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpenMenuId(openMenuId === bin.id ? null : bin.id);
        }}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        title="More Actions"
      >
        <MoreVertical className="w-4 h-4 text-gray-600" />
      </button>

      {/* Dropdown Menu */}
      {openMenuId === bin.id && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px] animate-slide-in-down">
          <button
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Add schedule move modal logic
              setOpenMenuId(null);
            }}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 rounded-t-lg"
          >
            <Calendar className="w-4 h-4" />
            Schedule Move
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Add retire bin modal logic
              setOpenMenuId(null);
            }}
            className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 rounded-b-lg"
          >
            <Trash2 className="w-4 h-4" />
            Retire Bin
          </button>
        </div>
      )}
    </div>
  </div>
</td>
```

### 7. Update Table Row Padding
**Location:** All `<td>` elements

**Change:** Replace all `py-3` with `py-4` for consistent spacing

### 8. Add Bulk Action Bar
**Location:** After the main `</div>` closing tag, before modals section

**Add:**
```tsx
{/* Bulk Action Bar */}
{selectedBins.size > 0 && (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slide-in-up">
    <Card className="px-6 py-4 shadow-2xl border-2 border-primary/20">
      <div className="flex items-center gap-6">
        {/* Selection Count */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
            <span className="text-sm font-bold text-primary">{selectedBins.size}</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {selectedBins.size} bin{selectedBins.size !== 1 ? 's' : ''} selected
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-200" />

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button
            onClick={() => {/* TODO: Bulk schedule move */}}
            className="bg-primary hover:bg-primary/90"
            size="sm"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Schedule Moves
          </Button>
          <Button
            onClick={() => {/* TODO: Bulk retire */}}
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50"
            size="sm"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Retire
          </Button>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-200" />

        {/* Cancel Button */}
        <button
          onClick={clearSelection}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Clear selection"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>
    </Card>
  </div>
)}
```

### 9. Update Priority Badge
**Location:** Priority cell

**Remove the Score line:**
```tsx
// Remove this entirely:
<div className="text-xs text-gray-500 mt-1">
  Score: {Math.round(bin.priority_score)}
</div>
```

### 10. Update Badge Styling
**Location:** Various badge cells

**Add minimum widths for consistency:**
- Priority badges: `min-w-[80px] justify-center`
- Fill badges: `min-w-[60px] justify-center`
- Status badges: `min-w-[80px] justify-center`

## Testing Checklist:

- [ ] Search bar filters bins by number, street, city, ZIP
- [ ] Multi-select filters can be combined
- [ ] Status segmented control works (All/Active/Retired)
- [ ] KPI cards never change with filters
- [ ] Column headers sort when clicked
- [ ] Checkboxes select bins without opening drawer
- [ ] Bulk action bar appears when bins are selected
- [ ] Three-dot menu opens/closes properly
- [ ] Eye icon opens bin details drawer
- [ ] No loading screens after initial load
- [ ] Table columns have consistent widths
- [ ] All styling matches across status filters

## Priority Order:

1. Add sortable headers + checkboxes (table structure)
2. Update actions column (eye icon + three-dot menu)
3. Add bulk action bar
4. Clean up styling (remove flags, score, "#", update padding)

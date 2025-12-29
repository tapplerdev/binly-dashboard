'use client';

import { useState } from 'react';
import { Calendar, List, User, X } from 'lucide-react';
import { Shift, getShiftStatusColor, getShiftStatusLabel } from '@/lib/types/shift';

type ViewMode = 'list' | 'timeline';

// Mock data for development
const MOCK_SHIFTS: Shift[] = [
  {
    id: '1',
    date: '2025-12-27',
    startTime: '08:00',
    endTime: '16:00',
    driverId: '1',
    driverName: 'Omar Gabr',
    driverPhoto: undefined,
    route: 'Route 4 - North Sector',
    binCount: 45,
    status: 'scheduled',
  },
  {
    id: '2',
    date: '2025-12-27',
    startTime: '08:00',
    endTime: '16:00',
    driverId: '2',
    driverName: 'Maria Lopez',
    driverPhoto: undefined,
    route: 'Route 2 - Central',
    binCount: 40,
    binsCollected: 23,
    status: 'active',
    estimatedCompletion: '2025-12-27T14:30:00Z',
  },
  {
    id: '3',
    date: '2025-12-27',
    startTime: '08:00',
    endTime: '16:00',
    driverId: '1',
    driverName: 'Omar Gabr',
    driverPhoto: undefined,
    route: 'Route 4 - North Sector',
    binCount: 45,
    status: 'scheduled',
  },
  {
    id: '4',
    date: '2025-12-27',
    startTime: '08:00',
    endTime: '16:00',
    driverId: '1',
    driverName: 'Omar Gabr',
    driverPhoto: undefined,
    route: 'Route 4 - North Sector',
    binCount: 45,
    status: 'scheduled',
  },
  {
    id: '5',
    date: '2025-12-28',
    startTime: '08:00',
    endTime: '16:00',
    driverId: '2',
    driverName: 'Maria Lopez',
    driverPhoto: undefined,
    route: 'Route 2 - Central',
    binCount: 40,
    status: 'scheduled',
  },
  {
    id: '6',
    date: '2025-12-28',
    startTime: '08:00',
    endTime: '16:00',
    driverId: '1',
    driverName: 'Omar Gabr',
    driverPhoto: undefined,
    route: 'Route 2 - Central',
    binCount: 40,
    status: 'scheduled',
  },
  {
    id: '7',
    date: '2025-12-26',
    startTime: '08:00',
    endTime: '14:00',
    driverId: '3',
    driverName: 'Ariel Santos',
    driverPhoto: undefined,
    route: 'Route 1 - East',
    binCount: 50,
    binsCollected: 50,
    totalWeight: 1240,
    status: 'completed',
    duration: '7h 45m',
  },
  {
    id: '8',
    date: '2025-12-25',
    startTime: '08:00',
    endTime: '14:00',
    driverId: '3',
    driverName: 'Ariel Santos',
    driverPhoto: undefined,
    route: 'Route 1 - East',
    binCount: 50,
    binsCollected: 50,
    totalWeight: 1240,
    status: 'completed',
    duration: '6h 30m',
  },
];

export function ShiftsView() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-semibold text-gray-900">Shifts</h1>

              {/* View Toggle */}
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <List className="w-4 h-4" />
                  List
                </button>
                <button
                  onClick={() => setViewMode('timeline')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'timeline'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Timeline
                </button>
              </div>
            </div>

            {/* Create Shift Button */}
            <button
              onClick={() => setIsCreateDrawerOpen(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              Create Shift
            </button>
          </div>

          {/* View Content */}
          {viewMode === 'list' ? (
            <ShiftsListView />
          ) : (
            <ShiftsTimelineView />
          )}
        </div>
      </div>

      {/* Create Shift Drawer */}
      {isCreateDrawerOpen && (
        <CreateShiftDrawer onClose={() => setIsCreateDrawerOpen(false)} />
      )}
    </div>
  );
}

// List View Component
function ShiftsListView() {
  // Group shifts by date
  const groupedShifts = MOCK_SHIFTS.reduce((acc, shift) => {
    if (!acc[shift.date]) {
      acc[shift.date] = [];
    }
    acc[shift.date].push(shift);
    return acc;
  }, {} as Record<string, Shift[]>);

  const sortedDates = Object.keys(groupedShifts).sort();
  const today = '2025-12-27'; // Mock today's date

  return (
    <div className="space-y-8">
      {sortedDates.map((date) => {
        const shifts = groupedShifts[date];
        const activeShifts = shifts.filter((s) => s.status === 'active').length;
        const totalBins = shifts.reduce((sum, s) => sum + s.binCount, 0);
        const isToday = date === today;

        return (
          <div key={date}>
            {/* Date Header */}
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {isToday ? 'Today' : 'Tomorrow'} · {activeShifts} Active Shift
                {activeShifts !== 1 ? 's' : ''} · {totalBins} Bins Total
              </h2>
            </div>

            {/* Shift Cards */}
            <div className="space-y-3">
              {shifts.map((shift) => (
                <ShiftCard key={shift.id} shift={shift} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Shift Card Component
function ShiftCard({ shift }: { shift: Shift }) {
  const statusColor = getShiftStatusColor(shift.status);
  const statusLabel = getShiftStatusLabel(shift.status);
  const isActive = shift.status === 'active';

  const progressPercentage = isActive && shift.binsCollected
    ? Math.round((shift.binsCollected / shift.binCount) * 100)
    : 0;

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 p-4 transition-all cursor-pointer ${
        isActive
          ? 'bg-green-50 border-green-200 hover:shadow-md'
          : 'hover:bg-gray-50 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Time */}
        <div className="flex-shrink-0 text-sm font-medium text-gray-900">
          {shift.startTime} AM - {shift.endTime.replace(':', ':')} PM
        </div>

        {/* Route */}
        <div className="flex-shrink-0 text-sm text-gray-600">
          {shift.route}
        </div>

        {/* Driver */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-gray-600" />
          </div>
          <span className="text-sm text-gray-700">{shift.driverName}</span>
        </div>

        {/* Bin Count / Progress */}
        <div className="flex-shrink-0 text-sm text-gray-600">
          {isActive && shift.binsCollected !== undefined
            ? `${shift.binsCollected}/${shift.binCount} Bins (${progressPercentage}%)`
            : `${shift.binCount} Bins`}
        </div>

        {/* Status Badge */}
        <div className="ml-auto">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}
          >
            {statusLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

// Timeline View Component
function ShiftsTimelineView() {
  // Generate week dates (Mon 25 - Sun 31)
  const weekDates = [
    { day: 'Mon', date: 25 },
    { day: 'Tue', date: 26 },
    { day: 'Wed', date: 27 },
    { day: 'Thu', date: 28 },
    { day: 'Fri', date: 29 },
    { day: 'Sat', date: 30 },
    { day: 'Sun', date: 31 },
  ];

  // Get unique drivers
  const drivers = Array.from(new Set(MOCK_SHIFTS.map((s) => s.driverName))).map(
    (name) => ({
      name,
      id: MOCK_SHIFTS.find((s) => s.driverName === name)?.driverId || '',
    })
  );

  // Group shifts by driver and date
  const shiftsByDriverAndDate = MOCK_SHIFTS.reduce((acc, shift) => {
    const dateNum = parseInt(shift.date.split('-')[2]);
    const key = `${shift.driverId}-${dateNum}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(shift);
    return acc;
  }, {} as Record<string, Shift[]>);

  console.log('Shifts by driver and date:', shiftsByDriverAndDate);
  console.log('Week dates:', weekDates);
  console.log('Drivers:', drivers);

  return (
    <div className="overflow-x-auto pb-6">
      <table className="w-full" style={{ minWidth: '1400px', borderCollapse: 'collapse' }}>
          {/* Table Header */}
          <thead>
            <tr>
              <th style={{ width: '200px', padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', color: '#6b7280', backgroundColor: '#f9fafb', border: '1px solid #d1d5db' }}>
                Driver
              </th>
              {weekDates.map((d) => (
                <th
                  key={d.date}
                  style={{ minWidth: '150px', padding: '12px', textAlign: 'center', fontWeight: 600, fontSize: '14px', color: '#111827', backgroundColor: '#f9fafb', border: '1px solid #d1d5db' }}
                >
                  {d.day} {d.date}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {drivers.map((driver) => (
              <tr key={driver.id}>
                {/* Driver Name Cell */}
                <td style={{ padding: '16px', verticalAlign: 'top', backgroundColor: '#f9fafb', border: '1px solid #d1d5db' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-gray-600" />
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                      {driver.name}
                    </span>
                  </div>
                </td>

                {/* Day Cells */}
                {weekDates.map((d) => {
                  const shifts = shiftsByDriverAndDate[`${driver.id}-${d.date}`] || [];
                  return (
                    <td key={d.date} style={{ padding: '16px 12px', verticalAlign: 'top', backgroundColor: '#ffffff', border: '1px solid #d1d5db' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '80px' }}>
                        {shifts.length > 0 ? (
                          shifts.map((shift) => (
                            <TimelineShiftBlock key={shift.id} shift={shift} />
                          ))
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
    </div>
  );
}

// Timeline Shift Block Component
function TimelineShiftBlock({ shift }: { shift: Shift }) {
  const isActive = shift.status === 'active';
  const isCompleted = shift.status === 'completed';
  const isScheduled = shift.status === 'scheduled';

  const bgColor = isActive
    ? 'bg-blue-600'
    : isCompleted
    ? 'bg-gray-400'
    : 'bg-blue-500';

  const progressPercentage = isActive && shift.binsCollected
    ? Math.round((shift.binsCollected / shift.binCount) * 100)
    : 0;

  // Extract route number from route string (e.g., "Route 2 - Central" -> "2")
  const routeNumber = shift.route.match(/Route (\d+)/)?.[1] || shift.route.split(' ')[1];

  return (
    <div
      className={`${bgColor} rounded-lg px-3 py-2 text-white text-xs cursor-pointer hover:opacity-90 transition-opacity`}
      title={`${shift.route} - ${shift.binCount} bins`}
    >
      <div className="font-medium">
        {isActive && `08a-4p · Route ${routeNumber} (${shift.binCount} Bins)`}
        {isCompleted && `Done · ${shift.binCount} Bins (${shift.totalWeight || 0}kg)`}
        {isScheduled && `08a-4p · Route ${routeNumber} (${shift.binCount} Bins)`}
      </div>
      {isActive && (
        <div className="mt-1 text-[10px] opacity-90">
          Active · {shift.binsCollected}/{shift.binCount} ({progressPercentage}%)
        </div>
      )}
    </div>
  );
}

// Create Shift Drawer Component
function CreateShiftDrawer({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    date: '2025-12-28',
    startTime: '08:00',
    endTime: '16:00',
    driverId: '',
    selectedBins: [] as string[],
  });

  const availableDrivers = [
    { id: '1', name: 'Omar Gabr', status: 'Available' },
    { id: '2', name: 'Maria Lopez', status: 'Available' },
    { id: '3', name: 'Ariel Santos', status: 'Available' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Creating shift:', formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center">
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Schedule New Shift</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Step 1: Date */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-medium">
                  1
                </div>
                <label className="text-sm font-semibold text-gray-900">Date</label>
              </div>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                required
              />
            </div>

            {/* Step 2: Time Range */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-medium">
                  2
                </div>
                <label className="text-sm font-semibold text-gray-900">Time Range</label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">End Time</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Driver */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-medium">
                  3
                </div>
                <label className="text-sm font-semibold text-gray-900">Driver</label>
              </div>
              <select
                value={formData.driverId}
                onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                required
              >
                <option value="">Select driver...</option>
                {availableDrivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name} · {driver.status}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 4: Bin Selection (Placeholder) */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-medium">
                  4
                </div>
                <label className="text-sm font-semibold text-gray-900">Bin Selection</label>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <p className="text-sm text-gray-500 mb-2">Map view with bin selection</p>
                <p className="text-xs text-gray-400">Coming soon: Interactive map with lasso select</p>
                <div className="mt-4">
                  <span className="text-xs font-medium text-gray-600">
                    {formData.selectedBins.length} bins selected
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData.driverId}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              Create Shift
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

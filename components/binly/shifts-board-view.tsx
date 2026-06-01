'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, LayoutGrid, List, Clock } from 'lucide-react';
import { DriverColumn } from './driver-column';
import { CreateShiftDrawer } from './shifts-view';
import { ShiftDetailsDrawer } from './shift-details-drawer';
import { ShiftHistoryView } from './shift-history-view';
import { EditShiftModal } from './edit-shift-modal';
import { PriorityBinsBanner } from './priority-bins-banner';
import { useDrivers } from '@/lib/hooks/use-drivers';
import { Shift } from '@/lib/types/shift';
import { reoptimizeShift } from '@/lib/api/shifts';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const authStorage = localStorage.getItem('binly-auth-storage');
    if (!authStorage) return null;
    return JSON.parse(authStorage)?.state?.token || null;
  } catch { return null; }
}

function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  return token ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } : { 'Content-Type': 'application/json' };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Local YYYY-MM-DD (avoids UTC timezone shift from toISOString) */
function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

// Fetch all shifts (active + recent ended) from the manager endpoint
async function fetchAllShifts(): Promise<any[]> {
  const headers = getAuthHeaders();
  const results: any[] = [];

  // Fetch active/ready/paused shifts
  for (const status of ['active', 'ready', 'paused']) {
    try {
      const resp = await fetch(`${API_BASE_URL}/api/manager/shifts?status=${status}&limit=50`, { headers });
      if (resp.ok) {
        const data = await resp.json();
        const shifts = data?.data?.shifts || [];
        results.push(...shifts);
      }
    } catch {}
  }

  // Fetch recent ended shifts (for past date view)
  try {
    const resp = await fetch(`${API_BASE_URL}/api/manager/shifts?status=ended&limit=50`, { headers });
    if (resp.ok) {
      const data = await resp.json();
      const shifts = data?.data?.shifts || [];
      results.push(...shifts);
    }
  } catch {}

  // Deduplicate by shift ID — a shift can appear in multiple status queries
  // if it transitions between statuses during the fetch
  const seen = new Map<string, any>();
  for (const s of results) {
    if (!seen.has(s.id)) {
      seen.set(s.id, s);
    }
  }
  return Array.from(seen.values());
}

// Fetch tasks for a specific shift
async function fetchShiftTasks(shiftId: string): Promise<any[]> {
  try {
    const resp = await fetch(`${API_BASE_URL}/api/shifts/${shiftId}/tasks/detailed`, {
      headers: getAuthHeaders(),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data?.data || data?.tasks || [];
  } catch { return []; }
}

export function ShiftsBoardView() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'kanban' | 'table' | 'history'>('kanban');
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [selectedShiftForDetails, setSelectedShiftForDetails] = useState<Shift | null>(null);
  const [preselectedDriverId, setPreselectedDriverId] = useState<string | null>(null);
  const [editingShift, setEditingShift] = useState<any>(null);
  const queryClient = useQueryClient();

  const today = new Date();
  const isToday = isSameDay(selectedDate, today);
  const isPast = selectedDate < today && !isToday;

  // Fetch all drivers
  const { data: driversData } = useDrivers();
  // Deduplicate drivers by ID to prevent duplicate kanban columns
  const drivers = useMemo(() => {
    const raw = driversData ?? [];
    const seen = new Set<string>();
    return raw.filter(d => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
  }, [driversData]);

  // Fetch all shifts
  const { data: allShifts, isLoading } = useQuery({
    queryKey: ['board-shifts'],
    queryFn: fetchAllShifts,
    refetchInterval: 60000, // Fallback poll; real-time via Centrifugo
  });

  // Filter shifts for the selected date
  const shiftsForDate = useMemo(() => {
    if (!allShifts) return [];
    const selectedDateStr = toLocalDateStr(selectedDate);
    console.log(`🔍 [BOARD] Filtering shifts for date: ${selectedDateStr} (${allShifts.length} total)`);
    const filtered = allShifts.filter(s => {
      if (s.scheduled_date) {
        const shiftDateStr = s.scheduled_date.split('T')[0];
        const match = shiftDateStr === selectedDateStr;
        if (!match) console.log(`   ❌ ${s.driver_name || s.driver_id?.slice(0,8)}: scheduled=${shiftDateStr} != ${selectedDateStr}`);
        return match;
      }
      const shiftDate = new Date((s.start_time || s.created_at) * 1000);
      return isSameDay(shiftDate, selectedDate);
    });
    console.log(`🔍 [BOARD] ${filtered.length} shifts match date ${selectedDateStr}:`, filtered.map((s: any) => `${s.driver_name}(${s.status})`));
    return filtered;
  }, [allShifts, selectedDate]);

  // Map drivers to their shifts — prefer active over ready, keep only one per driver
  const driverShiftMap = useMemo(() => {
    const map = new Map<string, any>();
    // Sort: active first, then ready, then others — so active takes priority
    const sorted = [...shiftsForDate].sort((a, b) => {
      const priority: Record<string, number> = { active: 0, ready: 1, paused: 2, ended: 3 };
      return (priority[a.status] ?? 9) - (priority[b.status] ?? 9);
    });
    sorted.forEach(s => {
      if (!map.has(s.driver_id)) {
        map.set(s.driver_id, s);
      }
    });
    return map;
  }, [shiftsForDate]);

  // Fetch tasks for all active shifts
  const shiftIds = shiftsForDate.map(s => s.id);
  const { data: allTasks } = useQuery({
    queryKey: ['board-tasks', ...shiftIds],
    queryFn: async () => {
      const taskMap: Record<string, any[]> = {};
      await Promise.all(
        shiftsForDate.map(async (s) => {
          taskMap[s.id] = await fetchShiftTasks(s.id);
        })
      );
      return taskMap;
    },
    enabled: shiftsForDate.length > 0,
    refetchInterval: 60000, // Fallback poll; real-time via Centrifugo
  });

  const navigateDay = (delta: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + delta);
    setSelectedDate(next);
  };

  const handleCreateShift = (driverId?: string) => {
    if (driverId) setPreselectedDriverId(driverId);
    setIsCreateDrawerOpen(true);
  };

  const handleSelectShift = (shift: any) => {
    // Convert to frontend Shift format for detail drawer
    const frontendShift: Shift = {
      id: shift.id,
      date: toLocalDateStr(new Date((shift.start_time || shift.created_at) * 1000)),
      startTime: shift.start_time ? new Date(shift.start_time * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
      endTime: shift.end_time ? new Date(shift.end_time * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
      driverId: shift.driver_id,
      driverName: shift.driver_name || 'Unknown',
      route: '',
      binCount: shift.total_bins || 0,
      binsCollected: shift.completed_bins || 0,
      status: shift.status === 'ready' ? 'scheduled' : shift.status === 'ended' ? 'completed' : shift.status as any,
      optimization_metadata: shift.optimization_metadata,
      total_distance_miles: shift.total_distance_miles,
    };
    setSelectedShiftForDetails(frontendShift);
  };

  const handleReoptimize = async (shiftId: string) => {
    try {
      await reoptimizeShift(shiftId);
      queryClient.invalidateQueries({ queryKey: ['board-shifts'] });
      queryClient.invalidateQueries({ queryKey: ['board-tasks'] });
    } catch (error) {
      console.error('Failed to re-optimize:', error);
    }
  };

  // Collect all bin IDs currently assigned to shifts today (for add-task picker filtering)
  const assignedBinIds = useMemo(() => {
    const ids = new Set<string>();
    if (!allTasks) return ids;
    for (const shiftTasks of Object.values(allTasks)) {
      for (const task of shiftTasks as any[]) {
        if (task.bin_id && !task.is_deleted) ids.add(task.bin_id);
      }
    }
    return ids;
  }, [allTasks]);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between px-4 md:px-6 py-3 md:py-4 gap-3 md:gap-0">
        {/* Page title removed — redundant with sidebar nav */}

        {/* Date navigation — hidden in history mode */}
        {viewMode !== 'history' ? (
          <div className="flex items-center gap-1">
            <button onClick={() => navigateDay(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <span className="px-3 py-1.5 text-sm font-semibold text-gray-900 min-w-[140px] text-center">
              {isToday ? 'Today' : formatDate(selectedDate)}
            </span>
            <button onClick={() => navigateDay(1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
            {!isToday && (
              <button
                onClick={() => setSelectedDate(new Date())}
                className="ml-1 px-2.5 py-1 rounded-md text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
              >
                Today
              </button>
            )}
          </div>
        ) : (
          <span className="text-sm text-gray-500">All completed & cancelled shifts</span>
        )}

        {/* Right side: view toggle + create */}
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
              title="Board view"
            >
              <LayoutGrid className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
              title="Table view"
            >
              <List className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'history' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
              title="Shift history"
            >
              <Clock className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {!isPast && viewMode !== 'history' && (
            <button
              onClick={() => handleCreateShift()}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Shift
            </button>
          )}
        </div>
      </div>

      {/* Past date banner */}
      {isPast && (
        <div className="mx-6 mb-3 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          Viewing {formatDate(selectedDate)} — read-only
        </div>
      )}

      {/* Priority bins banner — only on today's view */}
      {isToday && viewMode === 'kanban' && (
        <PriorityBinsBanner
          onCreateShiftFromBins={(binIds) => {
            // TODO: Open CreateShiftDrawer with pre-selected bins
            handleCreateShift();
          }}
        />
      )}

      {/* Board content */}
      <div className="flex-1 overflow-hidden px-6 pb-6">
        {isLoading ? (
          /* Loading skeleton */
          <div className="flex gap-4 overflow-x-auto h-full pb-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex flex-col w-[300px] shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-pulse">
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gray-200" />
                    <div className="h-4 bg-gray-200 rounded w-24" />
                    <div className="ml-auto h-5 bg-gray-100 rounded-full w-14" />
                  </div>
                  <div className="mt-3 h-1.5 bg-gray-100 rounded-full" />
                </div>
                <div className="p-2 space-y-2">
                  {[1, 2, 3, 4].map(j => (
                    <div key={j} className="flex items-center gap-2.5 px-3 py-3 rounded-lg border border-gray-100">
                      <div className="w-7 h-7 rounded-md bg-gray-100" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 bg-gray-100 rounded w-20" />
                        <div className="h-3 bg-gray-50 rounded w-32" />
                      </div>
                      <div className="w-3.5 h-3.5 rounded-full bg-gray-100" />
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
                  <div className="h-3 bg-gray-100 rounded w-36" />
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === 'kanban' ? (
          /* Kanban view — horizontal scroll on desktop, snap on mobile */
          <div className="flex gap-4 overflow-x-auto h-full pb-4 md:flex-row flex-col md:overflow-y-hidden overflow-y-auto">
            {drivers.length === 0 && shiftsForDate.length === 0 ? (
              <div className="flex flex-col items-center justify-center w-full h-64 text-gray-400">
                <p className="text-lg font-medium mb-1">No shifts scheduled for {isToday ? 'today' : formatDate(selectedDate)}</p>
                {!isPast && <p className="text-sm">Create one to get started.</p>}
              </div>
            ) : (
              <>
                {/* Driver columns */}
                {drivers.map(driver => {
                  const shift = driverShiftMap.get(driver.id) || null;
                  const tasks = shift && allTasks ? (allTasks[shift.id] || []) : [];
                  const sortedTasks = [...tasks]
                    .filter((t: any) => !t.is_deleted)
                    .sort((a: any, b: any) => (a.sequence_order || 0) - (b.sequence_order || 0));

                  return (
                    <DriverColumn
                      key={driver.id}
                      driver={driver}
                      shift={shift}
                      tasks={sortedTasks}
                      isToday={isToday}
                      onCreateShift={() => handleCreateShift(driver.id)}
                      onSelectShift={() => shift && handleSelectShift(shift)}
                      onEditShift={() => shift && setEditingShift({ ...shift, driver_name: driver.name, driver_id: driver.id })}
                      onReoptimize={handleReoptimize}
                    />
                  );
                })}

                {/* Show shifts from drivers not in the drivers list (edge case) */}
                {shiftsForDate
                  .filter(s => !drivers.some(d => d.id === s.driver_id))
                  .map(shift => {
                    const tasks = allTasks ? (allTasks[shift.id] || []) : [];
                    const sortedTasks = [...tasks]
                      .filter((t: any) => !t.is_deleted)
                      .sort((a: any, b: any) => (a.sequence_order || 0) - (b.sequence_order || 0));

                    return (
                      <DriverColumn
                        key={shift.id}
                        driver={{ id: shift.driver_id, name: shift.driver_name || 'Unknown' }}
                        shift={shift}
                        tasks={sortedTasks}
                        isToday={isToday}
                        onCreateShift={() => {}}
                        onSelectShift={() => handleSelectShift(shift)}
                        onEditShift={() => setEditingShift({ ...shift, driver_name: shift.driver_name || 'Unknown', driver_id: shift.driver_id })}
                        onReoptimize={handleReoptimize}
                      />
                    );
                  })}
              </>
            )}
          </div>
        ) : viewMode === 'table' ? (
          /* Table view */
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Driver</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Progress</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Tasks</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Distance</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Duration</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map(driver => {
                  const shift = driverShiftMap.get(driver.id) || null;
                  const tasks = shift && allTasks ? (allTasks[shift.id] || []) : [];
                  const activeTasks = tasks.filter((t: any) => !t.is_deleted && t.task_type !== 'warehouse_stop');
                  const completedCount = activeTasks.filter((t: any) => t.is_completed === 1).length;
                  const pct = activeTasks.length > 0 ? Math.round((completedCount / activeTasks.length) * 100) : 0;

                  const statusConfig: Record<string, { label: string; cls: string }> = {
                    active: { label: 'Active', cls: 'bg-green-100 text-green-700' },
                    paused: { label: 'Paused', cls: 'bg-amber-100 text-amber-700' },
                    ready: { label: 'Ready', cls: 'bg-blue-100 text-blue-700' },
                    ended: { label: 'Completed', cls: 'bg-gray-100 text-gray-600' },
                  };
                  const badge = shift ? (statusConfig[shift.status] || { label: shift.status, cls: 'bg-gray-100 text-gray-600' }) : null;

                  return (
                    <tr
                      key={driver.id}
                      onClick={() => shift && handleSelectShift(shift)}
                      className={`border-b border-gray-50 transition-colors ${shift ? 'hover:bg-gray-50 cursor-pointer' : 'opacity-50'}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                            {driver.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <span className="font-medium text-gray-800">{driver.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {badge ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                        ) : (
                          <span className="text-xs text-gray-400">No Shift</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {shift ? (
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {shift ? (
                          <span className="text-gray-700">{completedCount}/{activeTasks.length}</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {shift?.optimization_metadata?.total_distance_miles ? (
                          <span className="text-gray-700">{shift.optimization_metadata.total_distance_miles.toFixed(1)} mi</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {shift?.optimization_metadata?.total_duration_formatted ? (
                          <span className="text-gray-700">{shift.optimization_metadata.total_duration_formatted}</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {shiftsForDate.filter(s => !drivers.some(d => d.id === s.driver_id)).map(shift => {
                  const tasks = allTasks ? (allTasks[shift.id] || []) : [];
                  const activeTasks = tasks.filter((t: any) => !t.is_deleted && t.task_type !== 'warehouse_stop');
                  const completedCount = activeTasks.filter((t: any) => t.is_completed === 1).length;
                  const pct = activeTasks.length > 0 ? Math.round((completedCount / activeTasks.length) * 100) : 0;

                  return (
                    <tr
                      key={shift.id}
                      onClick={() => handleSelectShift(shift)}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                            {(shift.driver_name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <span className="font-medium text-gray-800">{shift.driver_name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">{shift.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="text-gray-700">{completedCount}/{activeTasks.length}</span></td>
                      <td className="px-4 py-3">
                        {shift.optimization_metadata?.total_distance_miles
                          ? <span className="text-gray-700">{shift.optimization_metadata.total_distance_miles.toFixed(1)} mi</span>
                          : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {shift.optimization_metadata?.total_duration_formatted
                          ? <span className="text-gray-700">{shift.optimization_metadata.total_duration_formatted}</span>
                          : <span className="text-xs text-gray-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {drivers.length === 0 && shiftsForDate.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <p className="text-lg font-medium mb-1">No shifts for {isToday ? 'today' : formatDate(selectedDate)}</p>
                {isToday && <p className="text-sm">Create one to get started.</p>}
              </div>
            )}
          </div>
        ) : (
          /* History view */
          <ShiftHistoryView />
        )}
      </div>

      {/* Create Shift Drawer */}
      {isCreateDrawerOpen && (
        <CreateShiftDrawer
          defaultDriverId={preselectedDriverId || undefined}
          scheduledDate={selectedDate}
          onClose={() => {
            setIsCreateDrawerOpen(false);
            setPreselectedDriverId(null);
          }}
          onViewExistingShift={(shiftCreatedAt: number) => {
            setIsCreateDrawerOpen(false);
            setPreselectedDriverId(null);
            setSelectedDate(new Date(shiftCreatedAt * 1000));
          }}
        />
      )}

      {/* Shift Details Drawer */}
      {selectedShiftForDetails && (
        <ShiftDetailsDrawer
          shift={selectedShiftForDetails}
          onClose={() => setSelectedShiftForDetails(null)}
        />
      )}

      {/* Edit Shift Modal */}
      {editingShift && (
        <EditShiftModal
          shift={editingShift}
          onClose={() => setEditingShift(null)}
          drivers={drivers}
          shiftsForDate={shiftsForDate}
        />
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  getBinsWithPriority,
  type BinSortOption,
  type BinFilterOption,
  type BinStatusFilter,
} from '@/lib/api/bins';
import { BinWithPriority } from '@/lib/types/bin';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/binly/kpi-card';
import { BulkCreateBinModal } from '@/components/binly/bulk-create-bin-modal';
import { BinDetailDrawer } from '@/components/binly/bin-detail-drawer';
import { RetireBinModal } from '@/components/binly/bin-modals';
import { ScheduleMoveModalWithMap } from '@/components/binly/schedule-move-modal-with-map';
import { EditBinDialog } from '@/components/binly/edit-bin-dialog';
import { Dropdown, MultiSelectDropdown } from '@/components/ui/dropdown';
import { SegmentedControl } from '@/components/ui/segmented-control';
import {
  PackageSearch,
  AlertTriangle,
  TrendingUp,
  Plus,
  Calendar,
  Trash2,
  MapPin,
  Clock,
  ChevronsUpDown,
  Search,
  Eye,
  MoreVertical,
  X,
  Edit,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function BinsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // State for filters and sorting
  const [sortBy, setSortBy] = useState<BinSortOption>('bin_number');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<BinFilterOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<BinStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBin, setSelectedBin] = useState<BinWithPriority | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedBins, setSelectedBins] = useState<Set<string>>(new Set());
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showRetireModal, setShowRetireModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [modalTargetBin, setModalTargetBin] = useState<BinWithPriority | null>(null);
  const [modalTargetBins, setModalTargetBins] = useState<BinWithPriority[]>([]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openMenuId) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  // Handle column header click for sorting
  const handleSort = (column: BinSortOption) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('asc');
    }
  };

  // Multi-select handlers
  const handleSelectBin = (binId: string) => {
    const newSelected = new Set(selectedBins);
    if (newSelected.has(binId)) {
      newSelected.delete(binId);
    } else {
      newSelected.add(binId);
    }
    setSelectedBins(newSelected);
  };

  const handleSelectAll = (binsToSelect: BinWithPriority[]) => {
    if (selectedBins.size === binsToSelect.length) {
      setSelectedBins(new Set());
    } else {
      setSelectedBins(new Set(binsToSelect.map((b) => b.id)));
    }
  };

  const clearSelection = () => {
    setSelectedBins(new Set());
  };

  // Fetch ALL bins for KPI metrics (always fetch all, regardless of status filter)
  const { data: allBinsForKpis } = useQuery({
    queryKey: ['bins', 'priority', 'all-for-kpis'],
    queryFn: () =>
      getBinsWithPriority({
        sort: 'priority',
        filter: 'all',
        status: 'all',
        limit: 1000,
      }),
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // Fetch ALL bins for table view (always fetch all statuses, filter on frontend)
  const { data: allBins, isLoading, error, refetch } = useQuery({
    queryKey: ['bins', 'priority', 'all-bins'],
    queryFn: () =>
      getBinsWithPriority({
        sort: 'priority',
        filter: 'all',
        status: 'all',
        limit: 1000,
      }),
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // Handle deep-link query params: ?editBin=<id> or ?scheduleBin=<id>
  // Fires once allBins is loaded so we can find the bin object
  useEffect(() => {
    if (!allBins) return;

    const editBinId = searchParams.get('editBin');
    const scheduleBinId = searchParams.get('scheduleBin');

    if (editBinId) {
      const bin = allBins.find((b) => b.id === editBinId);
      if (bin) {
        setModalTargetBin(bin);
        setShowEditModal(true);
        // Clear the param without triggering a navigation
        router.replace('/administration/bins', { scroll: false });
      }
    } else if (scheduleBinId) {
      const bin = allBins.find((b) => b.id === scheduleBinId);
      if (bin) {
        setModalTargetBin(bin);
        setShowScheduleModal(true);
        router.replace('/administration/bins', { scroll: false });
      }
    }
  }, [allBins, searchParams]);

  // Apply client-side filtering for status, filters, search, and sorting
  const bins = allBins
    ?.filter((bin) => {
      // Status filter
      if (statusFilter !== 'all' && bin.status !== statusFilter) {
        return false;
      }

      // Multi-select filters
      if (filters.length > 0) {
        const passesFilters = filters.every((filter) => {
          switch (filter) {
            case 'next_move_request':
              return bin.has_pending_move;
            case 'missing':
              return bin.status === 'missing';
            case 'high_fill':
              return (bin.fill_percentage || 0) >= 50 && (bin.fill_percentage || 0) < 80;
            case 'medium_fill':
              return (bin.fill_percentage || 0) >= 25 && (bin.fill_percentage || 0) < 50;
            case 'low_fill':
              return (bin.fill_percentage || 0) >= 0 && (bin.fill_percentage || 0) < 25;
            default:
              return true;
          }
        });
        if (!passesFilters) return false;
      }

      // Search filter (respects above filters)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          bin.bin_number.toString().includes(query) ||
          bin.current_street.toLowerCase().includes(query) ||
          bin.city.toLowerCase().includes(query) ||
          bin.zip.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Client-side sorting with direction
      let comparison = 0;
      switch (sortBy) {
        case 'priority':
          comparison = b.priority_score - a.priority_score;
          break;
        case 'bin_number':
          comparison = a.bin_number - b.bin_number;
          break;
        case 'fill_percentage':
          comparison = (b.fill_percentage || 0) - (a.fill_percentage || 0);
          break;
        case 'days_since_check':
          comparison = (b.days_since_check || 0) - (a.days_since_check || 0);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        default:
          return 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  // Show full-screen loader only on initial load (no data yet)
  const isInitialLoading = isLoading && !allBins;

  // Calculate KPI metrics from ALL bins (system-wide, never changes with filters)
  const totalBins = allBinsForKpis?.length || 0;
  const criticalBins = allBinsForKpis?.filter((b) => (b.fill_percentage || 0) >= 80).length || 0;
  const pendingMoves = allBinsForKpis?.filter((b) => b.has_pending_move).length || 0;
  const needsCheck = allBinsForKpis?.filter((b) => b.has_check_recommendation).length || 0;

  // Get priority badge color and label
  const getPriorityBadge = (score: number) => {
    if (score >= 1000) return { label: 'URGENT', color: 'bg-red-100 text-red-700 border-red-200' };
    if (score >= 500) return { label: 'HIGH', color: 'bg-orange-100 text-orange-700 border-orange-200' };
    if (score >= 200) return { label: 'MEDIUM', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
    return { label: 'LOW', color: 'bg-green-100 text-green-700 border-green-200' };
  };

  // Get fill level badge
  const getFillBadge = (fill?: number | null) => {
    if (!fill) return { label: 'Empty', color: 'bg-gray-100 text-gray-600' };
    if (fill >= 80) return { label: `${fill}%`, color: 'bg-red-100 text-red-700' };
    if (fill >= 60) return { label: `${fill}%`, color: 'bg-orange-100 text-orange-700' };
    if (fill >= 40) return { label: `${fill}%`, color: 'bg-yellow-100 text-yellow-700' };
    return { label: `${fill}%`, color: 'bg-green-100 text-green-700' };
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return { label: 'Active', color: 'bg-green-100 text-green-700' };
      case 'retired':
        return { label: 'Retired', color: 'bg-gray-100 text-gray-600' };
      case 'pending_move':
        return { label: 'Pending Move', color: 'bg-blue-100 text-blue-700' };
      case 'in_storage':
        return { label: 'In Storage', color: 'bg-purple-100 text-purple-700' };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-600' };
    }
  };

  // Get move request urgency badge based on scheduled date
  const getMoveRequestBadge = (moveRequestDate?: number | null) => {
    if (!moveRequestDate) return null;

    const now = Date.now() / 1000; // Convert to Unix timestamp
    const daysUntil = (moveRequestDate - now) / 86400;

    if (moveRequestDate < now) {
      return { label: '⚠️ Overdue', color: 'bg-red-500 text-white border-red-600' };
    }
    if (daysUntil < 1) {
      return { label: '🔴 Urgent Move', color: 'bg-red-500 text-white border-red-600' };
    }
    if (daysUntil < 3) {
      return { label: 'Move Soon', color: 'bg-orange-500 text-white border-orange-600' };
    }
    return { label: 'Scheduled Move', color: 'bg-blue-500 text-white border-blue-600' };
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center">
          <PackageSearch className="w-12 h-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-gray-600">Loading bins...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Card className="p-6 max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-center mb-2">Error Loading Bins</h3>
          <p className="text-gray-600 text-center mb-4">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </p>
          <Button onClick={() => refetch()} className="w-full">
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-3 md:p-6">
      <div className="max-w-[1600px] mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 lg:gap-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Bins Management</h1>
            <p className="text-sm md:text-base text-gray-600 mt-1">Monitor, manage, and optimize your bin inventory</p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary hover:bg-primary/90 w-full lg:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Bin
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
          <KpiCard
            title="Total Bins"
            value={totalBins.toString()}
            icon={<PackageSearch className="w-4 h-4 text-blue-600" />}
            iconBgColor="bg-blue-50"
          />
          <KpiCard
            title="Critical Fill"
            value={criticalBins.toString()}
            icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
            iconBgColor="bg-red-50"
            trend={criticalBins > 0 ? 'up' : undefined}
          />
          <KpiCard
            title="Pending Moves"
            value={pendingMoves.toString()}
            icon={<Calendar className="w-4 h-4 text-orange-600" />}
            iconBgColor="bg-orange-50"
          />
          <KpiCard
            title="Needs Check"
            value={needsCheck.toString()}
            icon={<Clock className="w-4 h-4 text-yellow-600" />}
            iconBgColor="bg-yellow-50"
          />
        </div>

        {/* Filters and Search */}
        <Card className="p-3 md:p-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 lg:gap-4">
            {/* Filter By Dropdown (Multi-select) */}
            <MultiSelectDropdown
              label="Filter By"
              selectedValues={filters}
              options={[
                { value: 'next_move_request', label: 'Move Requests' },
                { value: 'missing', label: 'Missing' },
                { value: 'high_fill', label: 'High Fill' },
                { value: 'medium_fill', label: 'Medium Fill' },
                { value: 'low_fill', label: 'Low Fill' },
              ]}
              onChange={(values) => setFilters(values as BinFilterOption[])}
            />

            {/* Search Bar */}
            <div className="relative flex-1 lg:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search bins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            {/* Status Segmented Control */}
            <div className="flex items-center lg:ml-auto">
              <SegmentedControl
                value={statusFilter}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'active', label: 'Active' },
                  { value: 'retired', label: 'Retired' },
                ]}
                onChange={(value) => setStatusFilter(value as BinStatusFilter)}
              />
            </div>
          </div>
        </Card>

        {/* Bins List */}
        {bins && bins.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <PackageSearch className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No bins found matching your filters</p>
            </div>
          </Card>
        ) : (
          <>
            {/* Desktop Table View */}
            <Card className="hidden lg:block overflow-visible">
              <div className="overflow-x-auto overflow-y-visible">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="py-4 px-4 w-[5%] align-middle rounded-tl-2xl">
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={bins && bins.length > 0 && selectedBins.size === bins.length}
                            onChange={() => handleSelectAll(bins || [])}
                            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                            title="Select all"
                          />
                        </div>
                      </th>
                      <th
                        className="text-center py-4 px-4 text-sm font-semibold text-gray-700 w-[8%] cursor-pointer align-middle"
                        onClick={() => handleSort('bin_number')}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Bin</span>
                          <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                        </div>
                      </th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700 align-middle">
                        Location
                      </th>
                      <th
                        className="text-left py-4 px-4 text-sm font-semibold text-gray-700 cursor-pointer align-middle"
                        onClick={() => handleSort('priority')}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Priority</span>
                          <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                        </div>
                      </th>
                      <th
                        className="text-left py-4 px-4 text-sm font-semibold text-gray-700 cursor-pointer whitespace-nowrap align-middle"
                        onClick={() => handleSort('fill_percentage')}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Fill Level</span>
                          <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                        </div>
                      </th>
                      <th
                        className="text-left py-4 px-4 text-sm font-semibold text-gray-700 cursor-pointer align-middle"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Status</span>
                          <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                        </div>
                      </th>
                      <th
                        className="text-left py-4 px-4 text-sm font-semibold text-gray-700 whitespace-nowrap cursor-pointer align-middle"
                        onClick={() => handleSort('days_since_check')}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Last Checked</span>
                          <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                        </div>
                      </th>
                      <th className="text-center py-4 px-4 text-sm font-semibold text-gray-700 align-middle rounded-tr-2xl">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bins?.map((bin) => {
                      const priority = getPriorityBadge(bin.priority_score);
                      const fill = getFillBadge(bin.fill_percentage);
                      const status = getStatusBadge(bin.status);

                      return (
                        <tr
                          key={bin.id}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => setSelectedBin(bin)}
                        >
                          <td className="py-4 px-4 align-middle" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={selectedBins.has(bin.id)}
                                onChange={() => handleSelectBin(bin.id)}
                                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                              />
                            </div>
                          </td>
                          <td className="py-4 px-4 align-middle">
                            <div className="flex items-center justify-center">
                              <span className="font-semibold text-gray-900">{bin.bin_number}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 align-middle">
                            <div className="text-sm">
                              <div className="text-gray-900 font-medium">{bin.current_street}</div>
                              <div className="text-gray-500 text-xs">
                                {bin.city}, {bin.zip}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 align-middle">
                            <Badge className={cn('border', priority.color)}>
                              {priority.label}
                            </Badge>
                          </td>
                          <td className="py-4 px-4 align-middle">
                            <div className="flex items-center justify-center">
                              <Badge className={fill.color}>{fill.label}</Badge>
                            </div>
                          </td>
                          <td className="py-4 px-4 align-middle">
                            <Badge className={cn(status.color, 'whitespace-nowrap')}>{status.label}</Badge>
                          </td>
                          <td className="py-4 px-4 align-middle">
                            <div className="flex items-center justify-center">
                              <span
                                className={cn(
                                  'text-sm font-medium',
                                  bin.days_since_check !== undefined && bin.days_since_check !== null
                                    ? bin.days_since_check >= 7
                                      ? 'text-red-600'
                                      : 'text-gray-700'
                                    : 'text-gray-500'
                                )}
                              >
                                {bin.days_since_check !== undefined && bin.days_since_check !== null
                                  ? `${bin.days_since_check} days ago`
                                  : 'Never'}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4 align-middle relative">
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
                              <div className="relative z-10">
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
                                  <div className="absolute right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px] animate-slide-in-up">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setModalTargetBin(bin);
                                        setShowEditModal(true);
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 rounded-t-lg whitespace-nowrap"
                                    >
                                      <Edit className="w-4 h-4" />
                                      Edit Bin
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setModalTargetBin(bin);
                                        setShowScheduleModal(true);
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 whitespace-nowrap"
                                    >
                                      <Calendar className="w-4 h-4" />
                                      Schedule Move
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setModalTargetBin(bin);
                                        setShowRetireModal(true);
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 rounded-b-lg whitespace-nowrap"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      Retire Bin
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-3">
              {bins?.map((bin) => {
                const priority = getPriorityBadge(bin.priority_score);
                const fill = getFillBadge(bin.fill_percentage);
                const status = getStatusBadge(bin.status);

                return (
                  <Card
                    key={bin.id}
                    className="p-4 hover:shadow-lg transition-all cursor-pointer active:scale-[0.98]"
                    onClick={() => setSelectedBin(bin)}
                  >
                    {/* Header Row: Checkbox, Bin Number, Actions */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedBins.has(bin.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleSelectBin(bin.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                        />
                        <span className="text-lg font-bold text-gray-900">Bin #{bin.bin_number}</span>
                      </div>

                      {/* Actions Menu */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === bin.id ? null : bin.id);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="More Actions"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-600" />
                        </button>

                        {openMenuId === bin.id && (
                          <div className="absolute right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px] animate-slide-in-up">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalTargetBin(bin);
                                setShowEditModal(true);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 rounded-t-lg whitespace-nowrap"
                            >
                              <Edit className="w-4 h-4" />
                              Edit Bin
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalTargetBin(bin);
                                setShowScheduleModal(true);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 whitespace-nowrap"
                            >
                              <Calendar className="w-4 h-4" />
                              Schedule Move
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalTargetBin(bin);
                                setShowRetireModal(true);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 rounded-b-lg whitespace-nowrap"
                            >
                              <Trash2 className="w-4 h-4" />
                              Retire Bin
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Location */}
                    <div className="flex items-start gap-2 mb-3">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <div className="text-gray-900 font-medium">{bin.current_street}</div>
                        <div className="text-gray-500">
                          {bin.city}, {bin.zip}
                        </div>
                      </div>
                    </div>

                    {/* Badges Row */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Badge className={cn('border', priority.color)}>
                        {priority.label}
                      </Badge>
                      <Badge className={fill.color}>{fill.label}</Badge>
                      <Badge className={cn(status.color, 'whitespace-nowrap')}>{status.label}</Badge>
                    </div>

                    {/* Last Checked */}
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-500">Last checked:</span>
                      <span
                        className={cn(
                          'font-medium',
                          bin.days_since_check !== undefined && bin.days_since_check !== null
                            ? bin.days_since_check >= 7
                              ? 'text-red-600'
                              : 'text-gray-700'
                            : 'text-gray-500'
                        )}
                      >
                        {bin.days_since_check !== undefined && bin.days_since_check !== null
                          ? `${bin.days_since_check} days ago`
                          : 'Never'}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedBins.size > 0 && (
        <div className="fixed bottom-20 lg:bottom-6 left-0 right-0 z-40 flex justify-center px-3 lg:px-0 animate-slide-in-up">
          <Card className="px-4 lg:px-6 py-3 lg:py-4 shadow-2xl border-2 border-primary/20 w-full lg:w-auto max-w-full lg:max-w-none">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 lg:gap-6">
              {/* Selection Count */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{selectedBins.size}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {selectedBins.size} bin{selectedBins.size !== 1 ? 's' : ''} selected
                </span>

                {/* Cancel Button - Mobile only, inline with count */}
                <button
                  onClick={clearSelection}
                  className="lg:hidden ml-auto p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Clear selection"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Divider - Desktop only */}
              <div className="hidden lg:block w-px h-8 bg-gray-200" />

              {/* Action Buttons */}
              <div className="flex items-center gap-2 lg:gap-3">
                <Button
                  onClick={() => {
                    const selectedBinsData = bins?.filter((b) => selectedBins.has(b.id)) || [];
                    setModalTargetBin(null);
                    setModalTargetBins(selectedBinsData);
                    setShowScheduleModal(true);
                  }}
                  className="bg-primary hover:bg-primary/90 flex-1 lg:flex-none"
                  size="sm"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Moves
                </Button>
                <Button
                  onClick={() => {
                    const selectedBinsData = bins?.filter((b) => selectedBins.has(b.id)) || [];
                    setModalTargetBin(null);
                    setModalTargetBins(selectedBinsData);
                    setShowRetireModal(true);
                  }}
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50 flex-1 lg:flex-none"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Retire
                </Button>
              </div>

              {/* Divider - Desktop only */}
              <div className="hidden lg:block w-px h-8 bg-gray-200" />

              {/* Cancel Button - Desktop only */}
              <button
                onClick={clearSelection}
                className="hidden lg:block p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Clear selection"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Modals and Drawers */}
      {showCreateModal && (
        <BulkCreateBinModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            refetch();
          }}
        />
      )}

      {selectedBin && (
        <BinDetailDrawer
          bin={selectedBin}
          onClose={() => setSelectedBin(null)}
          onUpdate={() => refetch()}
          onScheduleMove={(bin) => {
            setSelectedBin(null);
            setModalTargetBin(bin);
            setShowScheduleModal(true);
          }}
          onEdit={(bin) => {
            setSelectedBin(null);
            setModalTargetBin(bin);
            setShowEditModal(true);
          }}
        />
      )}

      {showScheduleModal && (modalTargetBin || modalTargetBins.length > 0) && (
        <ScheduleMoveModalWithMap
          bin={modalTargetBin || undefined}
          bins={modalTargetBins.length > 0 ? modalTargetBins : undefined}
          onClose={() => {
            setShowScheduleModal(false);
            setModalTargetBin(null);
            setModalTargetBins([]);
          }}
          onSuccess={() => {
            setShowScheduleModal(false);
            setModalTargetBin(null);
            setModalTargetBins([]);
            clearSelection();
            refetch();
          }}
        />
      )}

      {showRetireModal && (modalTargetBin || modalTargetBins.length > 0) && (
        <RetireBinModal
          bin={modalTargetBin || undefined}
          bins={modalTargetBins.length > 0 ? modalTargetBins : undefined}
          onClose={() => {
            setShowRetireModal(false);
            setModalTargetBin(null);
            setModalTargetBins([]);
          }}
          onSuccess={() => {
            setShowRetireModal(false);
            setModalTargetBin(null);
            setModalTargetBins([]);
            clearSelection();
            refetch();
          }}
        />
      )}

      <EditBinDialog
        open={showEditModal}
        onOpenChange={setShowEditModal}
        bin={modalTargetBin}
      />
    </div>
  );
}

export default function BinsPage() {
  return (
    <Suspense>
      <BinsPageContent />
    </Suspense>
  );
}

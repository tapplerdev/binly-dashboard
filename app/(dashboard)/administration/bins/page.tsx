'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import {
  PackageSearch,
  AlertTriangle,
  Archive,
  TrendingUp,
  Plus,
  Filter,
  ArrowUpDown,
  Calendar,
  Trash2,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BinsPage() {
  // State for filters and sorting
  const [sortBy, setSortBy] = useState<BinSortOption>('priority');
  const [filter, setFilter] = useState<BinFilterOption>('all');
  const [statusFilter, setStatusFilter] = useState<BinStatusFilter>('active');
  const [selectedBin, setSelectedBin] = useState<BinWithPriority | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch bins with priority
  const { data: bins, isLoading, error, refetch } = useQuery({
    queryKey: ['bins', 'priority', sortBy, filter, statusFilter],
    queryFn: () =>
      getBinsWithPriority({
        sort: sortBy,
        filter,
        status: statusFilter,
        limit: 100,
      }),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Calculate KPI metrics
  const totalBins = bins?.length || 0;
  const criticalBins = bins?.filter((b) => (b.fill_percentage || 0) >= 80).length || 0;
  const pendingMoves = bins?.filter((b) => b.has_pending_move).length || 0;
  const needsCheck = bins?.filter((b) => b.has_check_recommendation).length || 0;

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
        return { label: 'Active', color: 'bg-green-100 text-green-700', icon: CheckCircle2 };
      case 'retired':
        return { label: 'Retired', color: 'bg-gray-100 text-gray-600', icon: Archive };
      case 'pending_move':
        return { label: 'Pending Move', color: 'bg-blue-100 text-blue-700', icon: Calendar };
      case 'in_storage':
        return { label: 'In Storage', color: 'bg-purple-100 text-purple-700', icon: Archive };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-600', icon: XCircle };
    }
  };

  if (isLoading) {
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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bins Management</h1>
            <p className="text-gray-600 mt-1">Monitor, manage, and optimize your bin inventory</p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Bin
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

        {/* Filters and Sorting */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Sort By */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Sort:</span>
              <div className="flex gap-2">
                {[
                  { value: 'priority', label: 'Priority' },
                  { value: 'bin_number', label: 'Bin #' },
                  { value: 'fill_percentage', label: 'Fill %' },
                  { value: 'days_since_check', label: 'Last Check' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSortBy(option.value as BinSortOption)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      sortBy === option.value
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="h-8 w-px bg-gray-300" />

            {/* Filter By */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filter:</span>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: 'all', label: 'All Bins' },
                  { value: 'next_move_request', label: 'Move Requests' },
                  { value: 'longest_unchecked', label: 'Needs Check' },
                  { value: 'high_fill', label: 'High Fill' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFilter(option.value as BinFilterOption)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      filter === option.value
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="h-8 w-px bg-gray-300" />

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Status:</span>
              <div className="flex gap-2">
                {[
                  { value: 'active', label: 'Active' },
                  { value: 'all', label: 'All' },
                  { value: 'retired', label: 'Retired' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setStatusFilter(option.value as BinStatusFilter)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      statusFilter === option.value
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Bins List */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Bins ({bins?.length || 0})
          </h2>

          {bins && bins.length === 0 ? (
            <div className="text-center py-12">
              <PackageSearch className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No bins found matching your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Bin #
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Location
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Priority
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Fill Level
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Last Checked
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Flags
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bins?.map((bin) => {
                    const priority = getPriorityBadge(bin.priority_score);
                    const fill = getFillBadge(bin.fill_percentage);
                    const status = getStatusBadge(bin.status);
                    const StatusIcon = status.icon;

                    return (
                      <tr
                        key={bin.id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => setSelectedBin(bin)}
                      >
                        <td className="py-3 px-4">
                          <span className="font-semibold text-gray-900">#{bin.bin_number}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="text-sm">
                              <div className="text-gray-900">{bin.current_street}</div>
                              <div className="text-gray-500">
                                {bin.city}, {bin.zip}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={cn('border', priority.color)}>
                            {priority.label}
                          </Badge>
                          <div className="text-xs text-gray-500 mt-1">
                            Score: {Math.round(bin.priority_score)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={fill.color}>{fill.label}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <StatusIcon className="w-4 h-4" />
                            <Badge className={status.color}>{status.label}</Badge>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {bin.days_since_check !== undefined && bin.days_since_check !== null ? (
                            <div className="text-sm">
                              <span
                                className={cn(
                                  'font-medium',
                                  bin.days_since_check >= 7 ? 'text-red-600' : 'text-gray-700'
                                )}
                              >
                                {bin.days_since_check} days ago
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">Never</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1">
                            {bin.has_pending_move && (
                              <Badge className="bg-blue-100 text-blue-700 text-xs">
                                Move
                              </Badge>
                            )}
                            {bin.has_check_recommendation && (
                              <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                                Check
                              </Badge>
                            )}
                            {bin.move_request_urgency === 'urgent' && (
                              <Badge className="bg-red-100 text-red-700 text-xs">
                                Urgent
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBin(bin);
                            }}
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

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
        />
      )}
    </div>
  );
}

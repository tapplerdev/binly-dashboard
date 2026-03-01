'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDriverShiftHistory, type Driver, type DriverShift } from '@/lib/api/team';
import { Card } from '@/components/ui/card';
import {
  X,
  User,
  Mail,
  Calendar,
  TrendingUp,
  Clock,
  Package,
  MapPin,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Filter,
  Search,
} from 'lucide-react';
import { format, isWithinInterval, subDays, startOfDay, endOfDay } from 'date-fns';

interface DriverDetailDrawerProps {
  driver: Driver;
  onClose: () => void;
}

export function DriverDetailDrawer({ driver, onClose }: DriverDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  const [isClosing, setIsClosing] = useState(false);

  // Filter states
  const [dateFilter, setDateFilter] = useState<'all' | '7days' | '30days' | 'custom'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ended' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Get auth token from localStorage (Zustand persist storage)
  const getAuthToken = () => {
    try {
      const authStorage = localStorage.getItem('binly-auth-storage');
      if (!authStorage) return null;

      const parsed = JSON.parse(authStorage);
      return parsed?.state?.token || null;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  };

  const token = getAuthToken() || '';

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  // Fetch shift history
  const { data: shifts, isLoading: shiftsLoading } = useQuery({
    queryKey: ['driver-shifts', driver.driver_id],
    queryFn: () => getDriverShiftHistory(driver.driver_id, token),
  });

  // Calculate stats from shifts
  const totalShifts = shifts?.length || 0;
  const completedShifts = shifts?.filter((s) => s.status === 'ended').length || 0;
  const totalBinsCollected = shifts?.reduce((sum, s) => sum + s.completed_bins, 0) || 0;
  const avgBinsPerShift = totalShifts > 0 ? Math.round(totalBinsCollected / totalShifts) : 0;

  // Filter shifts based on selected filters
  const filteredShifts = useMemo(() => {
    if (!shifts) return [];

    return shifts.filter((shift) => {
      // Date filter
      if (dateFilter !== 'all' && shift.start_time) {
        const shiftDate = new Date(shift.start_time * 1000);
        const now = new Date();

        if (dateFilter === '7days') {
          const sevenDaysAgo = subDays(now, 7);
          if (!isWithinInterval(shiftDate, { start: sevenDaysAgo, end: now })) {
            return false;
          }
        } else if (dateFilter === '30days') {
          const thirtyDaysAgo = subDays(now, 30);
          if (!isWithinInterval(shiftDate, { start: thirtyDaysAgo, end: now })) {
            return false;
          }
        }
      }

      // Status filter
      if (statusFilter !== 'all' && shift.status !== statusFilter) {
        return false;
      }

      // Search query (search in bin numbers or shift ID)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const shiftIdMatch = shift.id.toLowerCase().includes(query);
        // Note: We don't have bin numbers in the shift history response,
        // but we can search by shift ID which contains the date
        if (!shiftIdMatch) {
          return false;
        }
      }

      return true;
    });
  }, [shifts, dateFilter, statusFilter, searchQuery]);

  // Count active filters
  const activeFilterCount = [
    dateFilter !== 'all',
    statusFilter !== 'all',
    searchQuery.trim() !== '',
  ].filter(Boolean).length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'ready':
        return 'bg-blue-100 text-blue-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'ended':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const formatDuration = (startTime?: number | null, endTime?: number | null) => {
    if (!startTime) return 'N/A';
    const end = endTime || Date.now() / 1000;
    const durationSeconds = end - startTime;
    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full w-full md:w-[500px] bg-white shadow-2xl z-50 overflow-hidden flex flex-col ${
        isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'
      }`}
    >
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">{driver.driver_name}</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 -mr-1"
          >
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              driver.status === 'active'
                ? 'bg-green-100 text-green-800'
                : driver.status === 'ready'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {driver.status.toUpperCase()}
          </span>
          {driver.shift_id && (
            <span className="text-xs text-gray-500">On Shift</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="flex overflow-x-auto scrollbar-hide px-4 md:px-6">
          <div className="flex gap-4 md:gap-6 min-w-max">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'history', label: 'Shift History' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {activeTab === 'overview' && (
          <div className="space-y-4 md:space-y-6">
            {/* Contact Info */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact Information</h3>
              <Card className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Name</p>
                    <p className="font-medium text-gray-900">{driver.driver_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="font-medium text-gray-900">{driver.email}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Current Shift */}
            {driver.shift_id && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Current Shift</h3>
                <Card className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Status</p>
                      <p className="font-medium text-gray-900 capitalize">{driver.status}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Progress</p>
                      <p className="font-medium text-gray-900">
                        {driver.completed_bins} / {driver.total_bins} bins
                      </p>
                    </div>
                  </div>
                  {driver.current_location && (
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Location</p>
                        <p className="font-mono text-xs text-gray-900">
                          {driver.current_location.latitude.toFixed(6)},{' '}
                          {driver.current_location.longitude.toFixed(6)}
                        </p>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* Performance Stats */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Performance</h3>
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <p className="text-xs text-gray-600">Total Shifts</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{totalShifts}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <p className="text-xs text-gray-600">Completed</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{completedShifts}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4 text-purple-600" />
                    <p className="text-xs text-gray-600">Total Bins</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{totalBinsCollected}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-orange-600" />
                    <p className="text-xs text-gray-600">Avg/Shift</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{avgBinsPerShift}</p>
                </Card>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="space-y-3">
              {/* Filter Toggle Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="px-2 py-0.5 bg-primary text-white text-xs rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                </div>
                <svg
                  className={`w-4 h-4 text-gray-600 transition-transform ${showFilters ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Filter Panel */}
              {showFilters && (
                <Card className="p-4 space-y-4 animate-scale-in">
                  {/* Search */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Search
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search shift ID..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none"
                      />
                    </div>
                  </div>

                  {/* Date Range Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Date Range
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'all', label: 'All Time' },
                        { value: '7days', label: 'Last 7 Days' },
                        { value: '30days', label: 'Last 30 Days' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setDateFilter(option.value as any)}
                          className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                            dateFilter === option.value
                              ? 'bg-primary text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Status Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'all', label: 'All' },
                        { value: 'ended', label: 'Completed' },
                        { value: 'cancelled', label: 'Cancelled' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setStatusFilter(option.value as any)}
                          className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                            statusFilter === option.value
                              ? 'bg-primary text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Clear Filters */}
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => {
                        setDateFilter('all');
                        setStatusFilter('all');
                        setSearchQuery('');
                      }}
                      className="w-full px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors"
                    >
                      Clear All Filters
                    </button>
                  )}
                </Card>
              )}

              {/* Results Count */}
              <div className="text-sm text-gray-600">
                Showing {filteredShifts.length} of {shifts?.length || 0} shifts
              </div>
            </div>

            {/* Shift List */}
            {shiftsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
              </div>
            ) : !shifts || shifts.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No shift history available</p>
              </div>
            ) : filteredShifts.length === 0 ? (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No shifts match your filters</p>
                <button
                  onClick={() => {
                    setDateFilter('all');
                    setStatusFilter('all');
                    setSearchQuery('');
                  }}
                  className="mt-3 text-sm text-primary hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              filteredShifts.map((shift) => (
                <Card key={shift.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        {shift.start_time
                          ? format(new Date(shift.start_time * 1000), 'PPP')
                          : 'Not started'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {shift.start_time
                          ? format(new Date(shift.start_time * 1000), 'p')
                          : ''}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        shift.status
                      )}`}
                    >
                      {shift.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs mb-1">Bins Collected</p>
                      <p className="font-medium text-gray-900">
                        {shift.completed_bins} / {shift.total_bins}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs mb-1">Duration</p>
                      <p className="font-medium text-gray-900">
                        {formatDuration(shift.start_time, shift.end_time)}
                      </p>
                    </div>
                  </div>

                  {shift.status === 'ended' && shift.completed_bins > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Completion Rate</span>
                        <span className="font-medium text-gray-900">
                          {Math.round((shift.completed_bins / shift.total_bins) * 100)}%
                        </span>
                      </div>
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${(shift.completed_bins / shift.total_bins) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* View Details Button */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => window.open(`/operations/shifts?shift=${shift.id}`, '_blank')}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary/5 hover:bg-primary/10 text-primary rounded-lg transition-colors text-sm font-medium"
                    >
                      <span>View Shift Details</span>
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

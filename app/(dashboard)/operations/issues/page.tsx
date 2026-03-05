'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getAppErrorLogs, getAppErrorStats, resolveAppErrorLog, type AppErrorLog } from '@/lib/api/error-logs';
import { AlertTriangle, CheckCircle, Info, XCircle, MapPin, Smartphone, Calendar, User, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function IssuesPage() {
  const [selectedSeverity, setSelectedSeverity] = useState<string | undefined>();
  const [selectedContext, setSelectedContext] = useState<string | undefined>();
  const [showResolvedOnly, setShowResolvedOnly] = useState(false);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Fetch error logs
  const { data: errorLogs = [], isLoading } = useQuery({
    queryKey: ['app-error-logs', selectedSeverity, selectedContext, showResolvedOnly],
    queryFn: () =>
      getAppErrorLogs({
        severity: selectedSeverity,
        context: selectedContext,
        is_resolved: showResolvedOnly ? true : false,
        limit: 100,
      }),
  });

  // Fetch error stats
  const { data: stats } = useQuery({
    queryKey: ['app-error-stats'],
    queryFn: getAppErrorStats,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Resolve error mutation
  const resolveMutation = useMutation({
    mutationFn: ({ errorLogId, notes }: { errorLogId: string; notes?: string }) =>
      resolveAppErrorLog(errorLogId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-error-logs'] });
      queryClient.invalidateQueries({ queryKey: ['app-error-stats'] });
    },
  });

  const handleResolve = (errorLogId: string) => {
    if (window.confirm('Mark this error as resolved?')) {
      resolveMutation.mutate({ errorLogId });
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'warning':
        return <Info className="w-5 h-5 text-yellow-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return <Info className="w-5 h-5 text-gray-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'error':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">App Error Logs</h1>
        <p className="text-gray-600">Driver app errors and diagnostics</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Last 24 Hours</div>
            <div className="text-2xl font-bold text-gray-900">{stats.last_24h}</div>
          </div>
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Critical Unresolved</div>
            <div className="text-2xl font-bold text-red-600">{stats.critical_unresolved}</div>
          </div>
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Navigation Errors</div>
            <div className="text-2xl font-bold text-orange-600">{stats.navigation_errors}</div>
          </div>
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Total Unresolved</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_unresolved}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          {/* Severity Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
            <select
              value={selectedSeverity || ''}
              onChange={(e) => setSelectedSeverity(e.target.value || undefined)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All</option>
              <option value="critical">Critical</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>

          {/* Context Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Context</label>
            <select
              value={selectedContext || ''}
              onChange={(e) => setSelectedContext(e.target.value || undefined)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All</option>
              <option value="navigation">Navigation</option>
              <option value="gps">GPS</option>
              <option value="sync">Sync</option>
              <option value="map_load">Map Load</option>
            </select>
          </div>

          {/* Show Resolved */}
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showResolvedOnly}
                onChange={(e) => setShowResolvedOnly(e.target.checked)}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <span className="text-sm font-medium text-gray-700">Show Resolved Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Error Logs List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white rounded-xl border-2 border-gray-200 p-8 text-center">
            <p className="text-gray-600">Loading error logs...</p>
          </div>
        ) : errorLogs.length === 0 ? (
          <div className="bg-white rounded-xl border-2 border-gray-200 p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <p className="text-gray-600">No error logs found</p>
          </div>
        ) : (
          errorLogs.map((error) => (
            <div
              key={error.id}
              className={cn(
                'bg-white rounded-xl border-2 p-4 transition-all',
                error.is_resolved ? 'border-gray-200 opacity-60' : 'border-gray-300'
              )}
            >
              {/* Error Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1">
                  {getSeverityIcon(error.severity)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', getSeverityColor(error.severity))}>
                        {error.severity.toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {error.context}
                      </span>
                      {error.platform && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {error.platform}
                        </span>
                      )}
                      {error.is_resolved && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Resolved
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{error.error_type}</h3>
                    <p className="text-sm text-gray-700">{error.error_message}</p>
                  </div>
                </div>

                {/* Expand/Resolve Buttons */}
                <div className="flex items-center gap-2">
                  {!error.is_resolved && (
                    <button
                      onClick={() => handleResolve(error.id)}
                      className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                    >
                      Resolve
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedErrorId(expandedErrorId === error.id ? null : error.id)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {expandedErrorId === error.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-600" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error Metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                {error.driver_name && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <User className="w-4 h-4" />
                    <span>{error.driver_name}</span>
                  </div>
                )}
                {error.device_info && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Smartphone className="w-4 h-4" />
                    <span className="truncate" title={error.device_info}>
                      {error.device_info}
                    </span>
                  </div>
                )}
                {error.last_gps_latitude && error.last_gps_longitude && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">
                      {error.last_gps_latitude.toFixed(4)}, {error.last_gps_longitude.toFixed(4)}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>{format(new Date(error.created_at_iso), 'MMM d, h:mm a')}</span>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedErrorId === error.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                  {error.app_version && (
                    <div>
                      <div className="text-xs font-medium text-gray-600 mb-1">App Version</div>
                      <div className="text-sm text-gray-900">{error.app_version}</div>
                    </div>
                  )}
                  {error.os_version && (
                    <div>
                      <div className="text-xs font-medium text-gray-600 mb-1">OS Version</div>
                      <div className="text-sm text-gray-900">{error.os_version}</div>
                    </div>
                  )}
                  {error.metadata && (
                    <div>
                      <div className="text-xs font-medium text-gray-600 mb-1">Metadata</div>
                      <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto">
                        {JSON.stringify(JSON.parse(error.metadata), null, 2)}
                      </pre>
                    </div>
                  )}
                  {error.stack_trace && (
                    <div>
                      <div className="text-xs font-medium text-gray-600 mb-1">Stack Trace</div>
                      <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                        {error.stack_trace}
                      </pre>
                    </div>
                  )}
                  {error.notes && (
                    <div>
                      <div className="text-xs font-medium text-gray-600 mb-1">Resolution Notes</div>
                      <div className="text-sm text-gray-900">{error.notes}</div>
                    </div>
                  )}
                  {error.resolved_by_user_name && (
                    <div>
                      <div className="text-xs font-medium text-gray-600 mb-1">Resolved By</div>
                      <div className="text-sm text-gray-900">
                        {error.resolved_by_user_name} on {format(new Date(error.resolved_at_iso!), 'MMM d, yyyy h:mm a')}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

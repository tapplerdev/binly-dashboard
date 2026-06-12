'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, X, Clock, Sparkles, ChevronDown, ChevronUp, Loader2, Inbox, Filter } from 'lucide-react';
import { getRecommendations, acceptRecommendation, dismissRecommendation, snoozeRecommendation, AIRecommendation } from '@/lib/api/ai-recommendations';

const severityConfig: Record<string, { color: string; bg: string; border: string }> = {
  critical: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  high: { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  medium: { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  low: { color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' },
};

const typeLabels: Record<string, string> = {
  bin_overflow: 'Collection Needed',
  bin_retire: 'Retire Bin',
  bin_relocate: 'Relocate Bin',
  route_split: 'Split Route',
  route_merge: 'Merge Routes',
  driver_assign: 'Driver Assignment',
};

function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function expiresIn(timestamp: number): string {
  const seconds = timestamp - Math.floor(Date.now() / 1000);
  if (seconds <= 0) return 'expired';
  if (seconds < 3600) return `expires in ${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `expires in ${Math.floor(seconds / 3600)}h`;
  return `expires in ${Math.floor(seconds / 86400)}d`;
}

function RecommendationCard({ rec, onAction }: { rec: AIRecommendation; onAction: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);
  const queryClient = useQueryClient();

  const config = severityConfig[rec.severity] || severityConfig.medium;

  const handleAccept = async () => {
    setActing(true);
    try {
      await acceptRecommendation(rec.id);
      queryClient.invalidateQueries({ queryKey: ['ai-recommendations'] });
      onAction();
    } catch { /* ignore */ }
    setActing(false);
  };

  const handleDismiss = async () => {
    setActing(true);
    try {
      await dismissRecommendation(rec.id);
      queryClient.invalidateQueries({ queryKey: ['ai-recommendations'] });
      onAction();
    } catch { /* ignore */ }
    setActing(false);
  };

  const handleSnooze = async () => {
    setActing(true);
    try {
      await snoozeRecommendation(rec.id);
      queryClient.invalidateQueries({ queryKey: ['ai-recommendations'] });
      onAction();
    } catch { /* ignore */ }
    setActing(false);
  };

  return (
    <div className={`border rounded-lg p-4 ${config.border} ${config.bg} transition-all`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${config.color} ${config.bg} border ${config.border}`}>
              {rec.severity}
            </span>
            <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {typeLabels[rec.type] || rec.type}
            </span>
            <span className="text-[10px] text-gray-400">{timeAgo(rec.created_at)}</span>
            {rec.expires_at && (
              <span className="text-[10px] text-gray-400">{expiresIn(rec.expires_at)}</span>
            )}
          </div>
          <h4 className="text-sm font-semibold text-gray-900">{rec.title}</h4>
          <p className="text-xs text-gray-600 mt-1">{rec.description}</p>

          {rec.recommended_action && (
            <p className="text-xs text-blue-700 mt-2 font-medium">Suggested: {rec.recommended_action}</p>
          )}

          {rec.reasoning && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 mt-2"
            >
              <Sparkles className="w-3 h-3" />
              AI Reasoning
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}

          {expanded && rec.reasoning && (
            <div className="mt-2 text-xs text-gray-500 bg-white/60 rounded p-2 border border-gray-200">
              {rec.reasoning}
            </div>
          )}
        </div>

        {rec.status === 'pending' && (
          <div className="flex items-center gap-1.5 shrink-0">
            {acting ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : (
              <>
                <button
                  onClick={handleAccept}
                  title="Accept"
                  className="p-1.5 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleSnooze}
                  title="Snooze 24h"
                  className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleDismiss}
                  title="Dismiss"
                  className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}

        {rec.status === 'accepted' && (
          <span className="text-[10px] font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">Accepted</span>
        )}
        {rec.status === 'dismissed' && (
          <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Dismissed</span>
        )}
        {rec.status === 'snoozed' && (
          <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded-full">Snoozed</span>
        )}
      </div>
    </div>
  );
}

export function AIRecommendationsInbox() {
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [typeFilter, setTypeFilter] = useState<string>('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ai-recommendations', statusFilter, typeFilter],
    queryFn: () => getRecommendations(statusFilter || undefined, typeFilter || undefined),
    refetchInterval: 60000, // refresh every minute
  });

  const recommendations = data?.recommendations || [];
  const counts = data?.counts || { total: 0, pending: 0, accepted: 0, dismissed: 0, snoozed: 0 };

  const tabs = [
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: '', label: 'All', count: counts.total },
    { key: 'accepted', label: 'Accepted', count: counts.accepted },
    { key: 'dismissed', label: 'Dismissed', count: counts.dismissed },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI Recommendations
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Actionable suggestions from the AI operations agent</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600"
          >
            <option value="">All Types</option>
            <option value="bin_overflow">Collection Needed</option>
            <option value="bin_retire">Retire Bin</option>
            <option value="route_split">Split Route</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
              statusFilter === tab.key
                ? 'bg-white shadow-sm text-gray-800'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                statusFilter === tab.key && tab.key === 'pending'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : recommendations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">
            {statusFilter === 'pending' ? 'No pending recommendations' : 'No recommendations found'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            The AI agent checks every 30 minutes for actionable insights
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map(rec => (
            <RecommendationCard key={rec.id} rec={rec} onAction={() => refetch()} />
          ))}
        </div>
      )}
    </div>
  );
}

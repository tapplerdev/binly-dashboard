'use client';

import { useState } from 'react';
import { X, Sparkles, Loader2, MapPin, Clock, Route, ChevronRight, Check, Trash2, ArrowLeft } from 'lucide-react';
import { generateSmartRoutes, RecommendedRoute, SmartRoutesResponse } from '@/lib/api/smart-routes';
import { createRoute } from '@/lib/api/routes';
import { useQueryClient } from '@tanstack/react-query';

interface SmartRoutesModalProps {
  onClose: () => void;
}

const tierConfig = {
  high:   { label: 'High Priority',   color: 'text-red-700',   bg: 'bg-red-50',   border: 'border-red-200',   dot: 'bg-red-500' },
  medium: { label: 'Medium Priority', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' },
  low:    { label: 'Low Priority',    color: 'text-blue-700',  bg: 'bg-blue-50',  border: 'border-blue-200',  dot: 'bg-blue-500' },
};

export function SmartRoutesModal({ onClose }: SmartRoutesModalProps) {
  const [step, setStep] = useState<'configure' | 'review' | 'saving'>('configure');
  const [maxBins, setMaxBins] = useState(30);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SmartRoutesResponse | null>(null);
  const [selectedRoutes, setSelectedRoutes] = useState<Set<number>>(new Set());
  const [routeNames, setRouteNames] = useState<Record<number, string>>({});
  const [expandedRoute, setExpandedRoute] = useState<number | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const queryClient = useQueryClient();

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const data = await generateSmartRoutes({ max_bins_per_route: maxBins });
      setResult(data);
      // Select all routes by default
      const all = new Set<number>();
      data.recommended_routes.forEach((_, i) => all.add(i));
      setSelectedRoutes(all);
      setStep('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setIsSaving(true);
    setStep('saving');
    setSavedCount(0);

    const routesToSave = result.recommended_routes.filter((_, i) => selectedRoutes.has(i));
    let saved = 0;

    for (let i = 0; i < routesToSave.length; i++) {
      const route = routesToSave[i];
      const originalIdx = result.recommended_routes.indexOf(route);
      const name = routeNames[originalIdx] || route.suggested_name;

      try {
        await createRoute({
          name,
          description: `Auto-generated: ${route.schedule_pattern}, ${route.stats.bin_count} bins`,
          geographic_area: route.geographic_area,
          schedule_pattern: route.schedule_pattern,
          bin_ids: route.bin_ids,
        });
        saved++;
        setSavedCount(saved);
      } catch (e) {
        console.error(`Failed to save route "${name}":`, e);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['routes'] });
    setTimeout(() => onClose(), 1500);
  };

  const toggleRoute = (idx: number) => {
    const next = new Set(selectedRoutes);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedRoutes(next);
  };

  const updateRouteName = (idx: number, name: string) => {
    setRouteNames(prev => ({ ...prev, [idx]: name }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] mx-4 overflow-hidden flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              {step === 'configure' ? 'Auto-Generate Routes' : step === 'saving' ? 'Saving Routes...' : 'Review Recommendations'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X className="w-5 h-5" /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 'configure' && (
            <div className="p-6 space-y-6">
              <p className="text-sm text-gray-600">
                Analyze your bin fill rates and geographic locations to generate optimized route templates.
              </p>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center"><span className="w-2 h-2 rounded-full bg-red-500" /></span>
                  <span><strong>High Priority</strong> — bins predicted to hit 80% within 4 days (collect every 3 days)</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center"><span className="w-2 h-2 rounded-full bg-amber-500" /></span>
                  <span><strong>Medium Priority</strong> — 5-9 days to 80% (collect weekly)</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center"><span className="w-2 h-2 rounded-full bg-blue-500" /></span>
                  <span><strong>Low Priority</strong> — 10+ days to 80% (collect every 2 weeks)</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Max Bins per Route</label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="number" value={maxBins} onChange={e => setMaxBins(Number(e.target.value))}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm" min={5} max={50} />
                  <span className="text-sm text-gray-500">bins per shift</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Routes with more bins will be split into separate templates</p>
              </div>
              {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
            </div>
          )}

          {step === 'review' && result && (
            <div className="divide-y divide-gray-100">
              {/* Analysis summary */}
              <div className="px-6 py-4">
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-gray-900">{result.analysis.total_active_bins}</div>
                    <div className="text-xs text-gray-500">Active Bins</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-red-700">{result.analysis.tiers.high}</div>
                    <div className="text-xs text-red-600">High Priority</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-amber-700">{result.analysis.tiers.medium}</div>
                    <div className="text-xs text-amber-600">Medium</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-blue-700">{result.analysis.tiers.low}</div>
                    <div className="text-xs text-blue-600">Low</div>
                  </div>
                </div>
              </div>

              {/* Route recommendations */}
              <div className="px-6 py-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-700">{result.recommended_routes.length} Routes Recommended</span>
                  <span className="text-xs text-gray-400">{selectedRoutes.size} selected</span>
                </div>

                <div className="space-y-2">
                  {result.recommended_routes.map((route, idx) => {
                    const cfg = tierConfig[route.tier];
                    const isSelected = selectedRoutes.has(idx);
                    const isExpanded = expandedRoute === idx;
                    const displayName = routeNames[idx] || route.suggested_name;

                    return (
                      <div key={idx} className={`rounded-xl border transition-all ${isSelected ? cfg.border + ' ' + cfg.bg : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                        {/* Route header */}
                        <div className="flex items-center gap-3 px-4 py-3">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleRoute(idx)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 shrink-0" />
                          <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                          <div className="flex-1 min-w-0">
                            <input type="text" value={displayName}
                              onChange={e => updateRouteName(idx, e.target.value)}
                              className="text-sm font-semibold text-gray-800 bg-transparent border-none p-0 w-full focus:outline-none focus:ring-0"
                            />
                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{route.stats.bin_count} bins</span>
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{route.stats.estimated_duration_hours}h</span>
                              <span className="flex items-center gap-1"><Route className="w-3 h-3" />{route.stats.estimated_distance_miles} mi</span>
                              <span className={`font-medium ${cfg.color}`}>{route.schedule_pattern}</span>
                            </div>
                          </div>
                          <button onClick={() => setExpandedRoute(isExpanded ? null : idx)}
                            className="p-1 text-gray-400 hover:text-gray-600">
                            <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </button>
                        </div>

                        {/* Expanded bin list */}
                        {isExpanded && (
                          <div className="border-t border-gray-200/50 px-4 py-2 max-h-[200px] overflow-y-auto">
                            {route.bins.map(bin => (
                              <div key={bin.id} className="flex items-center gap-2 py-1.5 text-xs">
                                <span className="font-semibold text-gray-700 w-10">#{bin.bin_number}</span>
                                <span className="text-gray-500 flex-1 truncate">{bin.current_street}, {bin.city}</span>
                                <span className="text-gray-400">{bin.avg_daily_fill_rate}%/day</span>
                                <span className={`font-medium ${bin.predicted_days_to_80 <= 2 ? 'text-red-600' : bin.predicted_days_to_80 <= 5 ? 'text-amber-600' : 'text-gray-500'}`}>
                                  {bin.predicted_days_to_80 <= 0 ? 'Now' : `${bin.predicted_days_to_80}d`}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 'saving' && result && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              <div className="text-sm text-gray-600">
                Saving {savedCount} of {selectedRoutes.size} routes...
              </div>
              {savedCount === selectedRoutes.size && (
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="w-5 h-5" />
                  <span className="font-semibold">All routes saved!</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          {error && step !== 'configure' && <div className="text-xs text-red-600 mb-2">{error}</div>}
          <div className="flex items-center justify-between">
            {step === 'configure' ? (
              <>
                <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleAnalyze} disabled={isAnalyzing}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50">
                  {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Bins'}
                </button>
              </>
            ) : step === 'review' ? (
              <>
                <button onClick={() => setStep('configure')}
                  className="flex items-center gap-1 px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{selectedRoutes.size} route{selectedRoutes.size !== 1 ? 's' : ''} selected</span>
                  <button onClick={handleSave} disabled={selectedRoutes.size === 0}
                    className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">
                    <Check className="w-3.5 h-3.5" />
                    Save {selectedRoutes.size} Route{selectedRoutes.size !== 1 ? 's' : ''} as Templates
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Toast } from '@/components/ui/toast';
import { CalendarCheck, Eye, ArrowUpRight, Warehouse, TrendingUp } from 'lucide-react';
import { RelocateSuggestModal } from '@/components/binly/relocate-suggest-modal';
import { acceptRecommendation } from '@/lib/api/ai-recommendations';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'https://ropacal-backend-production.up.railway.app';

interface WatchRow {
  bin_id: string;
  bin_number: number;
  current_street: string;
  reason: string;
  baseline_fill_rate: number | null;
  evaluate_at: number;
}

interface PlanRec {
  id: string;
  type: string;
  entity_id: string;
  bin_number: number;
  current_street: string;
  title: string;
  severity: string;
  created_at: number;
}

interface WeeklyPlan {
  watching: WatchRow[];
  escalations: PlanRec[];
  redeploys: PlanRec[];
  cadence_ups: PlanRec[];
  applied_7d: { type: string; count: number }[];
}

async function fetchPlan(): Promise<WeeklyPlan> {
  const r = await fetch(`${API_BASE_URL}/api/analytics/growth/weekly-plan`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed to fetch weekly plan');
  return (await r.json()).data;
}

/**
 * The week's growth actions as ONE reviewable plan — probation watchlist,
 * matured escalations, warehouse redeploys — each with its verb attached.
 * Managers act on plans, not on a drip of individual nags.
 */
export function WeeklyGrowthPlan() {
  const queryClient = useQueryClient();
  const { data: plan } = useQuery({
    queryKey: ['weekly-growth-plan'],
    queryFn: fetchPlan,
    staleTime: 5 * 60 * 1000,
  });
  const [action, setAction] = useState<{ rec: PlanRec; moveType: 'relocation' | 'redeployment' } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  if (!plan) return null;
  const total = plan.watching.length + plan.escalations.length + plan.redeploys.length + plan.cadence_ups.length;
  if (total === 0) return null; // nothing to plan — stay out of the way

  const appliedTotal = plan.applied_7d.reduce((s, a) => s + a.count, 0);
  const daysLeft = (t: number) => Math.max(0, Math.ceil((t - Date.now() / 1000) / 86400));

  const section = (
    title: string,
    icon: React.ReactNode,
    recs: PlanRec[],
    moveType: 'relocation' | 'redeployment' | null,
    verb: string,
  ) =>
    recs.length > 0 && (
      <div>
        <p className="text-[11px] font-semibold text-gray-500 flex items-center gap-1.5 mb-1.5">
          {icon} {title} ({recs.length})
        </p>
        <div className="space-y-1">
          {recs.slice(0, 5).map(r => (
            <div key={r.id} className="flex items-center gap-2 text-xs bg-white rounded-lg border border-gray-100 px-2.5 py-1.5">
              <span className="font-semibold text-gray-800 shrink-0">#{r.bin_number}</span>
              <span className="text-gray-500 truncate flex-1">{r.current_street}</span>
              {moveType && (
                <button
                  onClick={() => setAction({ rec: r, moveType })}
                  className="px-2 py-0.5 text-[10px] font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-fast shrink-0 focus:outline-none"
                >
                  {verb}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );

  return (
    <Card className="p-4 border-l-4 border-l-primary xl:col-span-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-primary" />
          This Week&apos;s Growth Plan
        </p>
        {appliedTotal > 0 && (
          <span className="text-[11px] text-gray-400">{appliedTotal} action{appliedTotal !== 1 ? 's' : ''} applied in the last 7 days</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
        {/* Watchlist */}
        {plan.watching.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-gray-500 flex items-center gap-1.5 mb-1.5">
              <Eye className="w-3.5 h-3.5" /> On probation ({plan.watching.length})
            </p>
            <div className="space-y-1">
              {plan.watching.slice(0, 5).map(w => (
                <div key={w.bin_id} className="flex items-center gap-2 text-xs bg-white rounded-lg border border-gray-100 px-2.5 py-1.5">
                  <span className="font-semibold text-gray-800 shrink-0">#{w.bin_number}</span>
                  <span className="text-gray-500 truncate flex-1">{w.current_street}</span>
                  <span className="text-[10px] text-amber-600 font-medium shrink-0">{daysLeft(w.evaluate_at)}d left</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {section('Escalations — relocate', <ArrowUpRight className="w-3.5 h-3.5" />, plan.escalations, 'relocation', 'Relocate')}
        {section('Warehouse redeploys', <Warehouse className="w-3.5 h-3.5" />, plan.redeploys, 'redeployment', 'Deploy')}
        {section('Collect more often', <TrendingUp className="w-3.5 h-3.5" />, plan.cadence_ups, null, '')}
      </div>

      {action && (
        <RelocateSuggestModal
          bin={{ id: action.rec.entity_id, bin_number: action.rec.bin_number }}
          reason={action.rec.title}
          moveType={action.moveType}
          onClose={() => setAction(null)}
          onDone={async msg => {
            try { await acceptRecommendation(action.rec.id); } catch { /* best-effort */ }
            queryClient.invalidateQueries({ queryKey: ['weekly-growth-plan'] });
            queryClient.invalidateQueries({ queryKey: ['ai-recommendations'] });
            setToastMsg(msg);
          }}
        />
      )}

      {toastMsg && <Toast message={toastMsg} type="success" onClose={() => setToastMsg(null)} />}
    </Card>
  );
}

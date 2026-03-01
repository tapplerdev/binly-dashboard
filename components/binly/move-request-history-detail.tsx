'use client';

import { useQuery } from '@tanstack/react-query';
import { getMoveRequest, getMoveRequestHistory } from '@/lib/api/move-requests';
import { MoveRequestSummaryCard } from './move-request-summary-card';
import { MoveRequestHistoryTimeline } from './move-request-history-timeline';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MoveRequestHistoryDetailProps {
  moveRequestId: string;
  onBack: () => void;
}

export function MoveRequestHistoryDetail({
  moveRequestId,
  onBack,
}: MoveRequestHistoryDetailProps) {
  // Fetch move request details
  const { data: moveRequest, isLoading: moveRequestLoading } = useQuery({
    queryKey: ['move-request', moveRequestId],
    queryFn: () => getMoveRequest(moveRequestId),
  });

  // Fetch move request history
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['move-request-history', moveRequestId],
    queryFn: () => getMoveRequestHistory(moveRequestId),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back Button Header */}
      <div className="sticky top-0 bg-white pt-2 pb-4 -mx-4 px-4 md:-mx-6 md:px-6 border-b border-gray-200 z-10">
        <Button
          onClick={onBack}
          variant="ghost"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors -ml-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back to Move History</span>
        </Button>
      </div>

      {/* Move Request Summary */}
      {moveRequestLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : moveRequest ? (
        <MoveRequestSummaryCard moveRequest={moveRequest} />
      ) : (
        <div className="text-center py-8 text-gray-500">
          Move request not found
        </div>
      )}

      {/* History Timeline */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Request History</h3>
        {historyLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <MoveRequestHistoryTimeline events={history || []} isLoading={false} />
        )}
      </div>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { getShiftHistory, ShiftHistoryResponse } from '@/lib/api/shifts';

export const shiftHistoryKeys = {
  all: ['shift-history'] as const,
  list: (params?: { driver_id?: string; start_date?: number; end_date?: number }) =>
    ['shift-history', params] as const,
};

export function useShiftHistory(params?: {
  driver_id?: string;
  start_date?: number;
  end_date?: number;
  limit?: number;
  offset?: number;
}) {
  return useQuery<ShiftHistoryResponse>({
    queryKey: shiftHistoryKeys.list(params),
    queryFn: () => getShiftHistory(params),
    staleTime: 60_000, // History doesn't change often
    refetchOnWindowFocus: false,
  });
}

import { useQuery } from '@tanstack/react-query';
import { getShiftHistoryTasks, ShiftHistoryTask } from '@/lib/api/shifts';

export function useShiftHistoryTasks(shiftId: string | null) {
  return useQuery<ShiftHistoryTask[]>({
    queryKey: ['shift-history-tasks', shiftId],
    queryFn: () => getShiftHistoryTasks(shiftId!),
    enabled: !!shiftId,
    staleTime: 300_000, // 5 min — task history never changes
    refetchOnWindowFocus: false,
  });
}

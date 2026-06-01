import { useQuery } from '@tanstack/react-query';
import { getDailyPriorities } from '@/lib/api/daily-priorities';

export function useDailyPriorities() {
  return useQuery({
    queryKey: ['daily-priorities'],
    queryFn: getDailyPriorities,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // refresh every 10 minutes
  });
}

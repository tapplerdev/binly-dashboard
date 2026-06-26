'use client';

import { useQuery } from '@tanstack/react-query';
import { getPlacementOpportunities, OpportunitiesResponse } from '@/lib/api/placement-opportunities';

export function usePlacementOpportunities() {
  return useQuery<OpportunitiesResponse>({
    queryKey: ['placement-opportunities'],
    queryFn: getPlacementOpportunities,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });
}

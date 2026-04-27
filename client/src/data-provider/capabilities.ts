import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dataService } from 'librechat-data-provider';

import type { UseQueryOptions } from '@tanstack/react-query';

const QUERY_KEY = 'effectiveCapabilities';

type EffectiveCapabilitiesResponse = { capabilities: string[] };

export const useEffectiveCapabilities = (
  config?: UseQueryOptions<EffectiveCapabilitiesResponse>,
) =>
  useQuery<EffectiveCapabilitiesResponse>(
    [QUERY_KEY],
    () => dataService.getEffectiveCapabilities(),
    {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 30_000,
      ...config,
    },
  );

export const useHasCapability = (capability: string): boolean => {
  const { data } = useEffectiveCapabilities();
  return useMemo(
    () => (data?.capabilities ?? []).includes(capability),
    [data?.capabilities, capability],
  );
};

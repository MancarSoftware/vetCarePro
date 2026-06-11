import { getJson } from '@/lib/api';
import type { DashboardSummary } from '@/types/dashboard';
import { useCallback, useEffect, useState } from 'react';

interface DashboardState {
  data: DashboardSummary | null;
  error: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useDashboard(): DashboardState {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const summary = await getJson<DashboardSummary>('/dashboard/summary');
      setData(summary);
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'No fue posible cargar el dashboard.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return { data, error, isLoading, refresh };
}


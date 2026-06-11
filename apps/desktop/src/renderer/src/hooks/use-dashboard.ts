import { useAuth } from '@/contexts/auth-context';
import type { DashboardSummary } from '@/types/dashboard';
import { useCallback, useEffect, useState } from 'react';

interface DashboardState {
  data: DashboardSummary | null;
  error: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useDashboard(): DashboardState {
  const { request } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const summary = await request<DashboardSummary>('/dashboard/summary');
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
  }, [request]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return { data, error, isLoading, refresh };
}

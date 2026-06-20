import { LoadingPage } from '@/pages/loading-page';
import { RuntimeConfigPage } from '@/pages/runtime-config-page';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface RuntimeConfigContextValue {
  config: VetCareRuntimeConfig;
  reloadConfig: () => Promise<void>;
}

const browserRuntimeConfig: VetCareRuntimeConfig = {
  configured: true,
  mode: 'local',
  serverHost: '127.0.0.1',
  apiPort: 4782,
  apiBaseUrl: import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:4782/api',
  healthUrl: `${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:4782/api'}/health`,
  updatedAt: new Date(0).toISOString(),
};

const RuntimeConfigContext = createContext<RuntimeConfigContextValue | null>(
  null,
);

async function loadRuntimeConfig(): Promise<VetCareRuntimeConfig> {
  return window.vetcare?.runtime.getConfig() ?? browserRuntimeConfig;
}

export function RuntimeConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<VetCareRuntimeConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reloadConfig = useCallback(async () => {
    setError(null);
    try {
      setConfig(await loadRuntimeConfig());
    } catch {
      setError('No fue posible leer la configuracion local de VetCare Pro.');
    }
  }, []);

  useEffect(() => {
    void reloadConfig();
  }, [reloadConfig]);

  const value = useMemo<RuntimeConfigContextValue | null>(
    () => (config ? { config, reloadConfig } : null),
    [config, reloadConfig],
  );

  if (error) {
    return (
      <RuntimeConfigPage
        initialConfig={browserRuntimeConfig}
        loadError={error}
        onConfigured={setConfig}
      />
    );
  }

  if (!config) {
    return <LoadingPage />;
  }

  if (!config.configured) {
    return (
      <RuntimeConfigPage
        initialConfig={config}
        onConfigured={setConfig}
      />
    );
  }

  return (
    <RuntimeConfigContext.Provider value={value}>
      {children}
    </RuntimeConfigContext.Provider>
  );
}

export function useRuntimeConfig() {
  const context = useContext(RuntimeConfigContext);
  if (!context) {
    throw new Error(
      'useRuntimeConfig debe utilizarse dentro de RuntimeConfigProvider',
    );
  }
  return context;
}

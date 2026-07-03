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
  openConfigurator: () => void;
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
  const [isConfiguring, setIsConfiguring] = useState(false);

  const reloadConfig = useCallback(async () => {
    setError(null);
    try {
      setConfig(await loadRuntimeConfig());
    } catch {
      setError('No fue posible leer la configuracion local de VetCare Pro.');
    }
  }, []);

  const handleConfigured = useCallback((nextConfig: VetCareRuntimeConfig) => {
    setConfig(nextConfig);
    setIsConfiguring(false);
  }, []);

  const openConfigurator = useCallback(() => {
    setIsConfiguring(true);
  }, []);

  const closeConfigurator = useCallback(() => {
    setIsConfiguring(false);
  }, []);

  useEffect(() => {
    void reloadConfig();
  }, [reloadConfig]);

  const value = useMemo<RuntimeConfigContextValue | null>(
    () => (config ? { config, reloadConfig, openConfigurator } : null),
    [config, reloadConfig, openConfigurator],
  );

  if (error) {
    return (
      <RuntimeConfigPage
        initialConfig={browserRuntimeConfig}
        loadError={error}
        onConfigured={handleConfigured}
      />
    );
  }

  if (!config) {
    return <LoadingPage />;
  }

  if (!config.configured || isConfiguring) {
    return (
      <RuntimeConfigPage
        initialConfig={config}
        onConfigured={handleConfigured}
        onCancel={config.configured ? closeConfigurator : undefined}
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

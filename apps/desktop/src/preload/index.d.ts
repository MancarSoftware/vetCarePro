export {};

type VetCareRuntimeMode = 'local' | 'lan-server' | 'lan-client';

interface VetCareRuntimeConfig {
  mode: VetCareRuntimeMode;
  serverHost: string;
  apiPort: number;
  apiBaseUrl: string;
  healthUrl: string;
  updatedAt: string;
}

interface SaveVetCareRuntimeConfigInput {
  mode?: VetCareRuntimeMode | string;
  serverHost?: string;
  apiPort?: number | string;
}

interface VetCareConnectionTestResult {
  ok: boolean;
  status?: number;
  apiBaseUrl: string;
  healthUrl: string;
  message: string;
  checkedAt: string;
}

declare global {
  interface Window {
    vetcare: {
      platform: NodeJS.Platform;
      versions: {
        electron: string;
        chrome: string;
      };
      runtime: {
        getConfig: () => Promise<VetCareRuntimeConfig>;
        saveConfig: (
          input: SaveVetCareRuntimeConfigInput,
        ) => Promise<VetCareRuntimeConfig>;
        testConnection: (
          input?: SaveVetCareRuntimeConfigInput,
        ) => Promise<VetCareConnectionTestResult>;
      };
      auth: {
        getRefreshToken: () => Promise<string | null>;
        setRefreshToken: (refreshToken: string) => Promise<boolean>;
        clearRefreshToken: () => Promise<boolean>;
      };
    };
  }
}

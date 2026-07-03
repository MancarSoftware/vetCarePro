export {};

declare global {
  type VetCareRuntimeMode = 'local' | 'lan-server' | 'lan-client';
  type VetCareLanAddressKind = 'recommended' | 'virtual' | 'other';

  interface VetCareRuntimeConfig {
    configured: boolean;
    mode: VetCareRuntimeMode;
    serverHost: string;
    apiPort: number;
    apiBaseUrl: string;
    healthUrl: string;
    updatedAt: string;
  }

  interface SaveVetCareRuntimeConfigInput {
    configured?: boolean;
    mode?: VetCareRuntimeMode | string;
    serverHost?: string;
    apiPort?: number | string;
    technicalCode?: string;
  }

  interface VetCareDeviceIdentity {
    deviceId: string;
    deviceName: string;
  }

  interface VetCareConnectionTestResult {
    ok: boolean;
    status?: number;
    apiBaseUrl: string;
    healthUrl: string;
    message: string;
    checkedAt: string;
  }

  interface VetCareLanAddress {
    name: string;
    address: string;
    kind: VetCareLanAddressKind;
    label: string;
    hint: string;
  }

  interface Window {
    vetcare: {
      platform: NodeJS.Platform;
      versions: {
        electron: string;
        chrome: string;
      };
      runtime: {
        getConfig: () => Promise<VetCareRuntimeConfig>;
        getDeviceIdentity: () => Promise<VetCareDeviceIdentity>;
        getLanAddresses: () => Promise<VetCareLanAddress[]>;
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

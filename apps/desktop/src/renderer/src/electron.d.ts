export {};

declare global {
  interface Window {
    vetcare: {
      platform: NodeJS.Platform;
      versions: {
        electron: string;
        chrome: string;
      };
      auth: {
        getRefreshToken: () => Promise<string | null>;
        setRefreshToken: (refreshToken: string) => Promise<boolean>;
        clearRefreshToken: () => Promise<boolean>;
      };
    };
  }
}

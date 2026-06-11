export {};

declare global {
  interface Window {
    vetcare: {
      platform: NodeJS.Platform;
      versions: {
        electron: string;
        chrome: string;
      };
    };
  }
}


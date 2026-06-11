import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('vetcare', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
  auth: {
    getRefreshToken: (): Promise<string | null> =>
      ipcRenderer.invoke('auth:get-refresh-token'),
    setRefreshToken: (refreshToken: string): Promise<boolean> =>
      ipcRenderer.invoke('auth:set-refresh-token', refreshToken),
    clearRefreshToken: (): Promise<boolean> =>
      ipcRenderer.invoke('auth:clear-refresh-token'),
  },
});

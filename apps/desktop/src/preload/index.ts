import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('vetcare', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
});


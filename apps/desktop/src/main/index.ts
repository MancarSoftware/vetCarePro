import {
  app,
  BrowserWindow,
  ipcMain,
  safeStorage,
  screen,
  shell,
} from 'electron';
import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';

const REFRESH_TOKEN_FILE = 'session.bin';

function getRefreshTokenPath(): string {
  return join(app.getPath('userData'), 'auth', REFRESH_TOKEN_FILE);
}

function registerAuthStorageHandlers(): void {
  ipcMain.handle('auth:get-refresh-token', async () => {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        return null;
      }
      const encrypted = await readFile(getRefreshTokenPath());
      return safeStorage.decryptString(encrypted);
    } catch {
      return null;
    }
  });

  ipcMain.handle(
    'auth:set-refresh-token',
    async (_event, refreshToken: string) => {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('El cifrado seguro de Windows no está disponible');
      }

      const tokenPath = getRefreshTokenPath();
      const temporaryPath = `${tokenPath}.tmp`;
      await mkdir(dirname(tokenPath), { recursive: true });
      await writeFile(
        temporaryPath,
        safeStorage.encryptString(refreshToken),
      );
      await rename(temporaryPath, tokenPath);
      return true;
    },
  );

  ipcMain.handle('auth:clear-refresh-token', async () => {
    await rm(getRefreshTokenPath(), { force: true });
    return true;
  });
}

function createWindow(): void {
  const { width: availableWidth, height: availableHeight } =
    screen.getPrimaryDisplay().workAreaSize;
  const mainWindow = new BrowserWindow({
    width: Math.min(1680, availableWidth),
    height: Math.min(960, availableHeight),
    minWidth: 1180,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f7f9fb',
    title: 'VetCare Pro',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      void shell.openExternal(url);
    }

    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  registerAuthStorageHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  safeStorage,
  screen,
  shell,
} from 'electron';
import { createWriteStream, existsSync } from 'node:fs';
import {
  access,
  appendFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';

const REFRESH_TOKEN_FILE = 'session.bin';
const API_URL = 'http://127.0.0.1:4782/api/health';
const LOCAL_DATA_DIR = 'C:\\VetCarePro';

let apiProcess: ChildProcess | null = null;

function getRefreshTokenPath(): string {
  return join(app.getPath('userData'), 'auth', REFRESH_TOKEN_FILE);
}

function getWindowIconPath(): string | undefined {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.ico')
    : join(__dirname, '../../build/icon.ico');

  return existsSync(iconPath) ? iconPath : undefined;
}

function runtimeEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ??
      'postgresql://vetcare:vetcare_dev@127.0.0.1:54329/vetcare_pro?schema=public',
    API_HOST: process.env.API_HOST ?? '127.0.0.1',
    API_PORT: process.env.API_PORT ?? '4782',
    VETCARE_DATA_DIR: process.env.VETCARE_DATA_DIR ?? LOCAL_DATA_DIR,
    UPLOADS_PATH:
      process.env.UPLOADS_PATH ?? join(LOCAL_DATA_DIR, 'uploads'),
    BACKUPS_PATH:
      process.env.BACKUPS_PATH ?? join(LOCAL_DATA_DIR, 'backups'),
    POSTGRES_CONTAINER:
      process.env.POSTGRES_CONTAINER ?? 'vetcare-pro-postgres',
    NODE_ENV: 'production',
  };
}

async function ensureLocalFolders(): Promise<void> {
  await Promise.all([
    mkdir(LOCAL_DATA_DIR, { recursive: true }),
    mkdir(join(LOCAL_DATA_DIR, 'uploads'), { recursive: true }),
    mkdir(join(LOCAL_DATA_DIR, 'backups'), { recursive: true }),
    mkdir(join(LOCAL_DATA_DIR, 'logs'), { recursive: true }),
    mkdir(join(LOCAL_DATA_DIR, 'temp'), { recursive: true }),
  ]);
}

async function runtimeLog(message: string): Promise<void> {
  try {
    await mkdir(join(LOCAL_DATA_DIR, 'logs'), { recursive: true });
    await appendFile(
      join(LOCAL_DATA_DIR, 'logs', 'desktop-runtime.log'),
      `[${new Date().toISOString()}] ${message}\n`,
      'utf8',
    );
  } catch {
    // Logging must never prevent the desktop shell from opening.
  }
}

async function assertFileExists(path: string, label: string): Promise<void> {
  try {
    await access(path);
  } catch {
    throw new Error(`No se encontro ${label}: ${path}`);
  }
}

async function isApiHealthy(): Promise<boolean> {
  try {
    const response = await fetch(API_URL, { signal: AbortSignal.timeout(900) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForApi(): Promise<void> {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    if (await isApiHealthy()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('La API local no respondio despues de iniciar.');
}

function runCommand(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
  } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const output: string[] = [];
    const timer = options.timeoutMs
      ? setTimeout(() => {
          child.kill();
          reject(new Error(`Tiempo agotado ejecutando ${command}.`));
        }, options.timeoutMs)
      : null;

    child.stdout?.on('data', (chunk: Buffer) => {
      output.push(chunk.toString('utf8'));
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      output.push(chunk.toString('utf8'));
    });
    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} termino con codigo ${code ?? 'desconocido'}.\n${output
            .join('')
            .slice(-4000)}`,
        ),
      );
    });
  });
}

async function isDockerReady(): Promise<boolean> {
  try {
    await runCommand('docker', ['version', '--format', '{{.Server.Version}}'], {
      timeoutMs: 10000,
    });
    return true;
  } catch {
    return false;
  }
}

function findDockerDesktop(): string | null {
  const candidates = [
    join(
      process.env.ProgramFiles ?? 'C:\\Program Files',
      'Docker',
      'Docker',
      'Docker Desktop.exe',
    ),
    join(
      process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
      'Docker',
      'Docker',
      'Docker Desktop.exe',
    ),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

async function ensureDockerReady(): Promise<void> {
  if (await isDockerReady()) {
    await runtimeLog('Docker daemon already available.');
    return;
  }

  const dockerDesktop = findDockerDesktop();
  if (!dockerDesktop) {
    throw new Error(
      'Docker Desktop no esta instalado o no se encontro en la ruta esperada.',
    );
  }

  await runtimeLog(`Starting Docker Desktop: ${dockerDesktop}`);
  const child = spawn(dockerDesktop, [], {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  child.unref();

  for (let attempt = 1; attempt <= 180; attempt += 1) {
    if (await isDockerReady()) {
      await runtimeLog('Docker daemon became available.');
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    'Docker Desktop no termino de iniciar. Abre Docker Desktop y vuelve a iniciar VetCare Pro.',
  );
}

function pipeProcessLogs(child: ChildProcess): void {
  const logsPath = join(LOCAL_DATA_DIR, 'logs');
  const stdout = createWriteStream(join(logsPath, 'api.log'), { flags: 'a' });
  const stderr = createWriteStream(join(logsPath, 'api-error.log'), {
    flags: 'a',
  });

  stdout.write(`\n--- VetCare Pro API ${new Date().toISOString()} ---\n`);
  stderr.write(`\n--- VetCare Pro API ${new Date().toISOString()} ---\n`);
  child.stdout?.pipe(stdout, { end: false });
  child.stderr?.pipe(stderr, { end: false });
}

function stopApiProcess(): void {
  if (!apiProcess || apiProcess.killed) {
    return;
  }
  apiProcess.kill();
  apiProcess = null;
}

async function startEmbeddedRuntime(): Promise<void> {
  if (!app.isPackaged || process.env.VETCARE_SKIP_EMBEDDED_API === '1') {
    await runtimeLog('Embedded runtime skipped.');
    return;
  }
  if (await isApiHealthy()) {
    await runtimeLog('API already healthy.');
    return;
  }

  await runtimeLog('Preparing embedded runtime.');
  await ensureLocalFolders();

  const runtimePath = join(process.resourcesPath, 'runtime');
  const nodePath = join(runtimePath, 'node', 'node.exe');
  const apiPath = join(runtimePath, 'api');
  const apiMainPath = join(apiPath, 'dist', 'main.js');
  const migrationPath = join(apiPath, 'scripts', 'migrate-database.js');
  const composePath = join(runtimePath, 'docker-compose.yml');
  const env = runtimeEnv();

  await assertFileExists(nodePath, 'Node.js embebido');
  await assertFileExists(apiMainPath, 'API local embebida');
  await assertFileExists(migrationPath, 'migrador de base de datos');
  await assertFileExists(composePath, 'configuracion de PostgreSQL local');

  await ensureDockerReady();
  await runtimeLog(`Starting PostgreSQL with compose file: ${composePath}`);
  await runCommand(
    'docker',
    ['compose', '-p', 'vetcarepro', '-f', composePath, 'up', '-d', '--wait'],
    { env, timeoutMs: 120000 },
  );
  await runtimeLog('PostgreSQL compose completed.');
  await runtimeLog(`Running database migrations: ${migrationPath}`);
  await runCommand(nodePath, [migrationPath], {
    cwd: apiPath,
    env,
    timeoutMs: 120000,
  });
  await runtimeLog('Database migrations completed.');

  await runtimeLog(`Starting API process: ${apiMainPath}`);
  apiProcess = spawn(nodePath, [apiMainPath], {
    cwd: apiPath,
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  pipeProcessLogs(apiProcess);
  apiProcess.on('exit', () => {
    apiProcess = null;
  });

  await waitForApi();
  await runtimeLog('API health check completed.');
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
    icon: getWindowIconPath(),
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

app.whenReady().then(async () => {
  registerAuthStorageHandlers();
  try {
    await startEmbeddedRuntime();
  } catch (error) {
    await runtimeLog(
      error instanceof Error
        ? `Embedded runtime failed: ${error.stack ?? error.message}`
        : 'Embedded runtime failed with an unknown error.',
    );
    dialog.showErrorBox(
      'VetCare Pro no pudo iniciar el servicio local',
      error instanceof Error
        ? error.message
        : 'No fue posible iniciar la API local.',
    );
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  stopApiProcess();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

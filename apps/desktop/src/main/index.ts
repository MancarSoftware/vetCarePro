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
import { delimiter, dirname, join } from 'node:path';

const REFRESH_TOKEN_FILE = 'session.bin';
const API_URL = 'http://127.0.0.1:4782/api/health';
const LOCAL_DATA_DIR = 'C:\\VetCarePro';
const POSTGRES_PORT = '54529';
const POSTGRES_USER = 'vetcare';
const POSTGRES_PASSWORD = 'vetcare_dev';
const POSTGRES_DATABASE = 'vetcare_pro';
const DEFAULT_DATABASE_URL = `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DATABASE}?schema=public`;

let apiProcess: ChildProcess | null = null;
let postgresProcess: ChildProcess | null = null;

function getRefreshTokenPath(): string {
  return join(app.getPath('userData'), 'auth', REFRESH_TOKEN_FILE);
}

function getWindowIconPath(): string | undefined {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.ico')
    : join(__dirname, '../../build/icon.ico');

  return existsSync(iconPath) ? iconPath : undefined;
}

function configuredDatabaseUrl(): string | undefined {
  return process.env.VETCARE_DATABASE_URL ?? process.env.DATABASE_URL;
}

function databaseUrl(): string {
  return configuredDatabaseUrl() ?? DEFAULT_DATABASE_URL;
}

function localDataDir(): string {
  return process.env.VETCARE_DATA_DIR ?? LOCAL_DATA_DIR;
}

function shouldStartEmbeddedPostgres(): boolean {
  const configured = configuredDatabaseUrl();
  if (!configured) {
    return true;
  }

  return configured === DEFAULT_DATABASE_URL;
}

function runtimeEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: databaseUrl(),
    API_HOST: process.env.API_HOST ?? '127.0.0.1',
    API_PORT: process.env.API_PORT ?? '4782',
    VETCARE_DATA_DIR: localDataDir(),
    UPLOADS_PATH:
      process.env.UPLOADS_PATH ?? join(localDataDir(), 'uploads'),
    BACKUPS_PATH:
      process.env.BACKUPS_PATH ?? join(localDataDir(), 'backups'),
    PG_DUMP_PATH:
      process.env.PG_DUMP_PATH ?? postgresCommandPath('pg_dump.exe'),
    POSTGRES_RUNTIME: shouldStartEmbeddedPostgres()
      ? 'embedded-local'
      : 'external',
    NODE_ENV: 'production',
  };
}

function postgresDataPath(): string {
  return join(localDataDir(), 'data', 'postgres');
}

function postgresRuntimePath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'runtime', 'postgres', 'pgsql')
    : join(__dirname, '../../release/runtime/postgres/pgsql');
}

function postgresBinPath(): string {
  return join(postgresRuntimePath(), 'bin');
}

function postgresCommandPath(command: string): string {
  return join(postgresBinPath(), command);
}

function postgresEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...env,
    PATH: `${postgresBinPath()}${delimiter}${env.PATH ?? ''}`,
    PGPASSWORD: POSTGRES_PASSWORD,
    PGUSER: POSTGRES_USER,
  };
}

async function ensureLocalFolders(): Promise<void> {
  await Promise.all([
    mkdir(localDataDir(), { recursive: true }),
    mkdir(join(localDataDir(), 'data'), { recursive: true }),
    mkdir(postgresDataPath(), { recursive: true }),
    mkdir(join(localDataDir(), 'uploads'), { recursive: true }),
    mkdir(join(localDataDir(), 'backups'), { recursive: true }),
    mkdir(join(localDataDir(), 'logs'), { recursive: true }),
    mkdir(join(localDataDir(), 'temp'), { recursive: true }),
  ]);
}

async function runtimeLog(message: string): Promise<void> {
  try {
    await mkdir(join(localDataDir(), 'logs'), { recursive: true });
    await appendFile(
      join(localDataDir(), 'logs', 'desktop-runtime.log'),
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

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
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
): Promise<string> {
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
      const text = output.join('');
      if (code === 0) {
        resolve(text);
        return;
      }
      reject(
        new Error(
          `${command} termino con codigo ${code ?? 'desconocido'}.\n${text.slice(-4000)}`,
        ),
      );
    });
  });
}

function pipeChildLogs(
  child: ChildProcess,
  stdoutFile: string,
  stderrFile: string,
  label: string,
): void {
  const logsPath = join(localDataDir(), 'logs');
  const stdout = createWriteStream(join(logsPath, stdoutFile), { flags: 'a' });
  const stderr = createWriteStream(join(logsPath, stderrFile), { flags: 'a' });

  stdout.write(`\n--- ${label} ${new Date().toISOString()} ---\n`);
  stderr.write(`\n--- ${label} ${new Date().toISOString()} ---\n`);
  child.stdout?.pipe(stdout, { end: false });
  child.stderr?.pipe(stderr, { end: false });
}

function pipeProcessLogs(child: ChildProcess): void {
  pipeChildLogs(child, 'api.log', 'api-error.log', 'VetCare Pro API');
}

function pipePostgresLogs(child: ChildProcess): void {
  pipeChildLogs(
    child,
    'postgres.log',
    'postgres-error.log',
    'VetCare Pro PostgreSQL',
  );
}

async function isPostgresReady(env: NodeJS.ProcessEnv): Promise<boolean> {
  try {
    await runCommand(
      postgresCommandPath('pg_isready.exe'),
      [
        '-h',
        '127.0.0.1',
        '-p',
        POSTGRES_PORT,
        '-U',
        POSTGRES_USER,
        '-d',
        'postgres',
      ],
      { env, timeoutMs: 2500 },
    );
    return true;
  } catch {
    return false;
  }
}

async function waitForPostgres(env: NodeJS.ProcessEnv): Promise<void> {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    if (await isPostgresReady(env)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('PostgreSQL local no respondio despues de iniciar.');
}

async function configurePostgresDataDirectory(): Promise<void> {
  const dataPath = postgresDataPath();
  await appendFile(
    join(dataPath, 'postgresql.conf'),
    [
      '',
      '# VetCare Pro local runtime',
      "listen_addresses = '127.0.0.1'",
      `port = ${POSTGRES_PORT}`,
      'max_connections = 60',
      'shared_buffers = 128MB',
      'logging_collector = off',
      '',
    ].join('\n'),
    'utf8',
  );

  await appendFile(
    join(dataPath, 'pg_hba.conf'),
    [
      '',
      '# VetCare Pro local runtime',
      'host all all 127.0.0.1/32 scram-sha-256',
      'host all all ::1/128 scram-sha-256',
      '',
    ].join('\n'),
    'utf8',
  );
}

async function initializePostgresIfNeeded(env: NodeJS.ProcessEnv): Promise<void> {
  const dataPath = postgresDataPath();
  if (await fileExists(join(dataPath, 'PG_VERSION'))) {
    await runtimeLog('PostgreSQL data directory already initialized.');
    return;
  }

  const passwordFile = join(localDataDir(), 'temp', 'postgres-password.txt');
  await writeFile(passwordFile, POSTGRES_PASSWORD, 'utf8');
  await runtimeLog(`Initializing PostgreSQL data directory: ${dataPath}`);

  try {
    await runCommand(
      postgresCommandPath('initdb.exe'),
      [
        '-D',
        dataPath,
        '-U',
        POSTGRES_USER,
        `--pwfile=${passwordFile}`,
        '-A',
        'scram-sha-256',
        '-E',
        'UTF8',
      ],
      { env, timeoutMs: 120000 },
    );
    await configurePostgresDataDirectory();
    await runtimeLog('PostgreSQL data directory initialized.');
  } finally {
    await rm(passwordFile, { force: true });
  }
}

async function ensureDatabaseExists(env: NodeJS.ProcessEnv): Promise<void> {
  try {
    await runCommand(
      postgresCommandPath('createdb.exe'),
      [
        '-h',
        '127.0.0.1',
        '-p',
        POSTGRES_PORT,
        '-U',
        POSTGRES_USER,
        POSTGRES_DATABASE,
      ],
      { env, timeoutMs: 30000 },
    );
    await runtimeLog(`Database ${POSTGRES_DATABASE} created.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('already exists')) {
      await runtimeLog(`Database ${POSTGRES_DATABASE} already exists.`);
      return;
    }
    throw error;
  }
}

async function startEmbeddedPostgres(env: NodeJS.ProcessEnv): Promise<void> {
  if (!shouldStartEmbeddedPostgres()) {
    await runtimeLog('Embedded PostgreSQL skipped because DATABASE_URL is external.');
    return;
  }

  const pgEnv = postgresEnv(env);
  const postgresExe = postgresCommandPath('postgres.exe');
  const initdbExe = postgresCommandPath('initdb.exe');
  const createdbExe = postgresCommandPath('createdb.exe');
  const pgIsReadyExe = postgresCommandPath('pg_isready.exe');

  await assertFileExists(postgresExe, 'PostgreSQL embebido');
  await assertFileExists(initdbExe, 'initdb embebido');
  await assertFileExists(createdbExe, 'createdb embebido');
  await assertFileExists(pgIsReadyExe, 'pg_isready embebido');

  await initializePostgresIfNeeded(pgEnv);

  if (await isPostgresReady(pgEnv)) {
    await runtimeLog('PostgreSQL local already available.');
    await ensureDatabaseExists(pgEnv);
    return;
  }

  await runtimeLog(`Starting embedded PostgreSQL on port ${POSTGRES_PORT}.`);
  postgresProcess = spawn(
    postgresExe,
    ['-D', postgresDataPath()],
    {
      env: pgEnv,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  pipePostgresLogs(postgresProcess);
  postgresProcess.on('exit', () => {
    postgresProcess = null;
  });

  await waitForPostgres(pgEnv);
  await ensureDatabaseExists(pgEnv);
  await runtimeLog('PostgreSQL health check completed.');
}

function stopApiProcess(): void {
  if (!apiProcess || apiProcess.killed) {
    return;
  }
  apiProcess.kill();
  apiProcess = null;
}

function stopPostgresProcess(): void {
  if (!postgresProcess || postgresProcess.killed) {
    return;
  }
  postgresProcess.kill();
  postgresProcess = null;
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
  const env = runtimeEnv();

  await assertFileExists(nodePath, 'Node.js embebido');
  await assertFileExists(apiMainPath, 'API local embebida');
  await assertFileExists(migrationPath, 'migrador de base de datos');

  await startEmbeddedPostgres(env);

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
        throw new Error('El cifrado seguro de Windows no esta disponible');
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
  stopPostgresProcess();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

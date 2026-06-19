import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';

export interface DatabaseConnectionInfo {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  schema: string | null;
}

export interface DatabaseDumpOptions {
  databaseUrl: string;
  outputPath: string;
  pgDumpPath?: string;
}

export function parseDatabaseUrl(databaseUrl: string): DatabaseConnectionInfo {
  const url = new URL(databaseUrl);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  return {
    host: url.hostname || '127.0.0.1',
    port: url.port || '5432',
    user: decodeURIComponent(url.username || 'postgres'),
    password: decodeURIComponent(url.password || ''),
    database: database || 'postgres',
    schema: url.searchParams.get('schema'),
  };
}

export function buildPgDumpArgs(connection: DatabaseConnectionInfo): string[] {
  return [
    '--host',
    connection.host,
    '--port',
    connection.port,
    '--username',
    connection.user,
    '--dbname',
    connection.database,
    '--format=plain',
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges',
    ...(connection.schema ? [`--schema=${connection.schema}`] : []),
  ];
}

export async function dumpPostgresDatabase(
  options: DatabaseDumpOptions,
): Promise<void> {
  const connection = parseDatabaseUrl(options.databaseUrl);
  const command = options.pgDumpPath || 'pg_dump';

  try {
    await runCommandToFile(command, buildPgDumpArgs(connection), options.outputPath, {
      ...(connection.password ? { PGPASSWORD: connection.password } : {}),
    });
  } catch (error) {
    await rm(options.outputPath, { force: true }).catch(() => undefined);
    throw new Error(
      [
        'No se pudo ejecutar pg_dump.',
        'Verifica que PG_DUMP_PATH apunte al pg_dump.exe incluido en VetCare Pro o a las herramientas cliente de PostgreSQL.',
        error instanceof Error ? error.message : String(error),
      ].join(' '),
    );
  }
}

async function runCommandToFile(
  command: string,
  args: string[],
  outputPath: string,
  env: NodeJS.ProcessEnv = {},
): Promise<void> {
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    windowsHide: true,
  });
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8');
  });

  const output = createWriteStream(outputPath, { flags: 'w' });
  const streamDone = pipeline(child.stdout, output);
  const exitDone = new Promise<void>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          stderr.trim() || `${command} finalizo con codigo de salida ${code}`,
        ),
      );
    });
  });

  await Promise.all([streamDone, exitDone]);
}

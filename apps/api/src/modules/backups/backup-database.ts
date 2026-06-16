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
  dockerPath?: string;
  dockerContainer?: string;
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

export function buildDockerPgDumpArgs(
  connection: DatabaseConnectionInfo,
  container: string,
): string[] {
  return [
    'exec',
    container,
    'pg_dump',
    '-U',
    connection.user,
    '-d',
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
  const attempts: Array<{
    label: string;
    command: string;
    args: string[];
    env?: NodeJS.ProcessEnv;
  }> = [
    {
      label: 'pg_dump local',
      command: options.pgDumpPath || 'pg_dump',
      args: buildPgDumpArgs(connection),
      env: connection.password ? { PGPASSWORD: connection.password } : {},
    },
    {
      label: 'pg_dump via Docker',
      command: options.dockerPath || 'docker',
      args: buildDockerPgDumpArgs(
        connection,
        options.dockerContainer || 'vetcare-pro-postgres',
      ),
    },
  ];

  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      await runCommandToFile(
        attempt.command,
        attempt.args,
        options.outputPath,
        attempt.env,
      );
      return;
    } catch (error) {
      await rm(options.outputPath, { force: true }).catch(() => undefined);
      errors.push(
        `${attempt.label}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  throw new Error(
    [
      'No se pudo ejecutar pg_dump.',
      'Instala PostgreSQL client tools o verifica que Docker este disponible.',
      ...errors,
    ].join(' '),
  );
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

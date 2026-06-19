const { Client } = require('pg');
const { createHash } = require('node:crypto');
const { readdir, readFile } = require('node:fs/promises');
const path = require('node:path');

const defaultDatabaseUrl =
  'postgresql://vetcare:vetcare_dev@127.0.0.1:54329/vetcare_pro?schema=public';

const databaseUrl = process.env.DATABASE_URL || defaultDatabaseUrl;
const migrationsRoot =
  process.env.PRISMA_MIGRATIONS_PATH ||
  path.resolve(__dirname, '..', 'prisma', 'migrations');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry() {
  let lastError;
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    const client = new Client({ connectionString: databaseUrl });
    try {
      await client.connect();
      return client;
    } catch (error) {
      lastError = error;
      await sleep(1000);
    }
  }
  throw lastError;
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `select to_regclass($1) as name`,
    [`public.${tableName}`],
  );
  return Boolean(result.rows[0]?.name);
}

async function appliedPrismaMigrations(client) {
  if (!(await tableExists(client, '_prisma_migrations'))) {
    return new Set();
  }
  const result = await client.query(
    `select migration_name from "_prisma_migrations" where rolled_back_at is null`,
  );
  return new Set(result.rows.map((row) => row.migration_name));
}

async function appliedRuntimeMigrations(client) {
  await client.query(`
    create table if not exists vetcare_runtime_migrations (
      migration_name text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);
  const result = await client.query(
    'select migration_name from vetcare_runtime_migrations',
  );
  return new Set(result.rows.map((row) => row.migration_name));
}

async function listMigrations() {
  const entries = await readdir(migrationsRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function applyMigration(client, migrationName) {
  const sqlPath = path.join(migrationsRoot, migrationName, 'migration.sql');
  const sql = await readFile(sqlPath, 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');

  await client.query('begin');
  try {
    await client.query(sql);
    await client.query(
      `insert into vetcare_runtime_migrations (migration_name, checksum)
       values ($1, $2)
       on conflict (migration_name) do nothing`,
      [migrationName, checksum],
    );
    await client.query('commit');
    console.log(`Applied migration ${migrationName}`);
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

async function main() {
  const client = await connectWithRetry();
  try {
    const [runtimeApplied, prismaApplied, migrations] = await Promise.all([
      appliedRuntimeMigrations(client),
      appliedPrismaMigrations(client),
      listMigrations(),
    ]);

    for (const migrationName of migrations) {
      if (runtimeApplied.has(migrationName) || prismaApplied.has(migrationName)) {
        continue;
      }
      await applyMigration(client, migrationName);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

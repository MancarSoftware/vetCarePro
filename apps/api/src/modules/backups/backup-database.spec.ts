import {
  buildDockerPgDumpArgs,
  buildPgDumpArgs,
  parseDatabaseUrl,
} from './backup-database';

describe('database backup helpers', () => {
  it('parses PostgreSQL URLs with Prisma schema query params', () => {
    const connection = parseDatabaseUrl(
      'postgresql://vetcare:secret@127.0.0.1:54329/vetcare_pro?schema=public',
    );

    expect(connection).toEqual({
      host: '127.0.0.1',
      port: '54329',
      user: 'vetcare',
      password: 'secret',
      database: 'vetcare_pro',
      schema: 'public',
    });
  });

  it('builds local pg_dump args without leaking the password', () => {
    const args = buildPgDumpArgs(
      parseDatabaseUrl(
        'postgresql://vetcare:secret@localhost:5432/vetcare_pro?schema=public',
      ),
    );

    expect(args).toContain('--host');
    expect(args).toContain('localhost');
    expect(args).toContain('--schema=public');
    expect(args).not.toContain('secret');
  });

  it('builds Docker fallback args for the configured container', () => {
    const args = buildDockerPgDumpArgs(
      parseDatabaseUrl('postgresql://vetcare:secret@localhost/vetcare_pro'),
      'vetcare-pro-postgres',
    );

    expect(args.slice(0, 3)).toEqual([
      'exec',
      'vetcare-pro-postgres',
      'pg_dump',
    ]);
    expect(args).toContain('vetcare_pro');
  });
});

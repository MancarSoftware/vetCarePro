import { buildPgDumpArgs, parseDatabaseUrl } from './backup-database';

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
    expect(args).toContain('vetcare_pro');
    expect(args).not.toContain('secret');
  });
});

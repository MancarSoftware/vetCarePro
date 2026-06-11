import { HealthService } from './health.service';
import type { PrismaService } from '../../prisma/prisma.service';

describe('HealthService', () => {
  it('reports a healthy database connection', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ connected: 1 }]);
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    const service = new HealthService(prisma);

    const result = await service.check();

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('ok');
    expect(result.database).toBe('connected');
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });
});


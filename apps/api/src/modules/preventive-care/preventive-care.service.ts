import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getPreventiveCareStatus } from './preventive-care-status';

@Injectable()
export class PreventiveCareService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(petId?: string) {
    const where = {
      deletedAt: null,
      ...(petId ? { petId } : {}),
      pet: {
        deletedAt: null,
        ...(petId ? {} : { status: 'ACTIVE' as const }),
      },
    };
    const [vaccines, dewormings] = await this.prisma.$transaction([
      this.prisma.vaccine.findMany({
        where,
        select: { nextDueDate: true },
      }),
      this.prisma.deworming.findMany({
        where,
        select: { nextDueDate: true },
      }),
    ]);
    const items = [...vaccines, ...dewormings];
    const statusCounts = {
      applied: 0,
      pending: 0,
      upcoming: 0,
      overdue: 0,
    };
    for (const item of items) {
      const status = getPreventiveCareStatus(item.nextDueDate);
      if (status === 'APPLIED') statusCounts.applied += 1;
      if (status === 'PENDING') statusCounts.pending += 1;
      if (status === 'UPCOMING') statusCounts.upcoming += 1;
      if (status === 'OVERDUE') statusCounts.overdue += 1;
    }

    return {
      vaccinesTotal: vaccines.length,
      dewormingsTotal: dewormings.length,
      ...statusCounts,
    };
  }
}

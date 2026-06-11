import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const UPCOMING_VACCINE_DAYS = 30;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const now = new Date();
    const todayStart = this.startOfDay(now);
    const tomorrowStart = this.addDays(todayStart, 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextVaccineLimit = this.addDays(todayStart, UPCOMING_VACCINE_DAYS);
    const chartStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      registeredPets,
      appointmentsToday,
      pendingVaccines,
      monthlyIncome,
      agendaToday,
      upcomingVaccines,
      inventoryProducts,
      recentPatients,
      activeTreatments,
      incomePayments,
    ] = await this.prisma.$transaction([
      this.prisma.pet.count({
        where: { status: 'ACTIVE', deletedAt: null },
      }),
      this.prisma.appointment.count({
        where: {
          startsAt: { gte: todayStart, lt: tomorrowStart },
          deletedAt: null,
        },
      }),
      this.prisma.vaccine.count({
        where: {
          nextDueDate: { gte: todayStart, lte: nextVaccineLimit },
          deletedAt: null,
          pet: { deletedAt: null, status: 'ACTIVE' },
        },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: 'PAID',
          paidAt: { gte: monthStart },
          deletedAt: null,
        },
      }),
      this.prisma.appointment.findMany({
        where: {
          startsAt: { gte: todayStart, lt: tomorrowStart },
          deletedAt: null,
        },
        orderBy: { startsAt: 'asc' },
        take: 6,
        select: {
          id: true,
          startsAt: true,
          type: true,
          status: true,
          pet: {
            select: {
              id: true,
              name: true,
              species: true,
              breed: true,
              photoPath: true,
            },
          },
        },
      }),
      this.prisma.vaccine.findMany({
        where: {
          nextDueDate: { gte: todayStart, lte: nextVaccineLimit },
          deletedAt: null,
          pet: { deletedAt: null, status: 'ACTIVE' },
        },
        orderBy: { nextDueDate: 'asc' },
        take: 6,
        select: {
          id: true,
          name: true,
          nextDueDate: true,
          pet: {
            select: {
              id: true,
              name: true,
              breed: true,
              photoPath: true,
            },
          },
        },
      }),
      this.prisma.inventoryProduct.findMany({
        where: {
          isActive: true,
          deletedAt: null,
        },
        orderBy: { currentStock: 'asc' },
        take: 30,
        select: {
          id: true,
          name: true,
          currentStock: true,
          minimumStock: true,
          unit: true,
        },
      }),
      this.prisma.pet.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          species: true,
          breed: true,
          sex: true,
          birthDate: true,
          approximateAgeMonths: true,
          photoPath: true,
        },
      }),
      this.prisma.treatment.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 4,
        select: {
          id: true,
          diagnosis: true,
          instructions: true,
          startDate: true,
          endDate: true,
          status: true,
          pet: {
            select: {
              id: true,
              name: true,
              breed: true,
              photoPath: true,
            },
          },
        },
      }),
      this.prisma.payment.findMany({
        where: {
          status: 'PAID',
          paidAt: { gte: chartStart },
          deletedAt: null,
        },
        select: { amount: true, paidAt: true },
      }),
    ]);

    const lowStock = inventoryProducts
      .filter(
        (product) =>
          product.currentStock.toNumber() <= product.minimumStock.toNumber(),
      )
      .slice(0, 6)
      .map((product) => ({
        ...product,
        currentStock: product.currentStock.toNumber(),
        minimumStock: product.minimumStock.toNumber(),
      }));

    return {
      generatedAt: now.toISOString(),
      metrics: {
        registeredPets,
        appointmentsToday,
        pendingVaccines,
        monthlyIncome: monthlyIncome._sum.amount?.toNumber() ?? 0,
      },
      agendaToday,
      upcomingVaccines: upcomingVaccines.map((vaccine) => ({
        ...vaccine,
        daysRemaining: vaccine.nextDueDate
          ? this.daysBetween(todayStart, vaccine.nextDueDate)
          : null,
      })),
      lowStock,
      recentPatients,
      activeTreatments,
      incomeLastSixMonths: this.buildIncomeSeries(now, incomePayments),
    };
  }

  private buildIncomeSeries(
    now: Date,
    payments: Array<{ amount: { toNumber(): number }; paidAt: Date | null }>,
  ): Array<{ month: string; total: number }> {
    const formatter = new Intl.DateTimeFormat('es-EC', { month: 'short' });

    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      const total = payments
        .filter(
          (payment) =>
            payment.paidAt?.getFullYear() === date.getFullYear() &&
            payment.paidAt.getMonth() === date.getMonth(),
        )
        .reduce((sum, payment) => sum + payment.amount.toNumber(), 0);

      return {
        month: formatter.format(date).replace('.', ''),
        total,
      };
    });
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private daysBetween(start: Date, end: Date): number {
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    return Math.ceil((end.getTime() - start.getTime()) / millisecondsPerDay);
  }
}


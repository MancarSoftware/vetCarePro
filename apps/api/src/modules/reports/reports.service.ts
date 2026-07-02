import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  AppointmentStatus,
  PaymentItemType,
  PaymentStatus,
  TreatmentStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ReportSection,
  ReportsQueryDto,
} from './dto/reports-query.dto';
import {
  addLocalDays,
  buildReportRange,
  startOfLocalDay,
} from './reports-range';
import { ReportsExcelService } from './reports-excel.service';

const UPCOMING_DAYS = 30;

export interface ReportsSummary {
  generatedAt: string;
  range: {
    from: string;
    to: string;
  };
  financial: {
    income: number;
    outstanding: number;
    overdueAmount: number;
    paidDocuments: number;
    pendingDocuments: number;
    averageTicket: number;
    incomeByMonth: Array<{ month: string; total: number }>;
  };
  appointments: {
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
    pending: number;
    confirmed: number;
    byType: Array<{ type: string; count: number }>;
    byStatus: Array<{ status: string; count: number }>;
  };
  clinical: {
    medicalRecords: number;
    vaccinesApplied: number;
    vaccinesPending: number;
    vaccinesOverdue: number;
    dewormingsApplied: number;
    dewormingsPending: number;
    dewormingsOverdue: number;
    treatmentsActive: number;
    treatmentsFollowUp: number;
    treatmentsCompleted: number;
  };
  inventory: {
    lowStock: number;
    outOfStock: number;
    expiringSoon: number;
    inventoryValue: number;
    productsSold: Array<{
      productId: string | null;
      name: string;
      quantity: number;
      total: number;
    }>;
  };
  clients: {
    ownersRegistered: number;
    petsRegistered: number;
  };
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportsExcel: ReportsExcelService,
  ) {}

  async getSummary(query: ReportsQueryDto): Promise<ReportsSummary> {
    const range = this.safeRange(query);
    const now = new Date();
    const today = startOfLocalDay(now);
    const upcomingLimit = addLocalDays(today, UPCOMING_DAYS);

    const [
      transactions,
      payments,
      appointments,
      ownersRegistered,
      petsRegistered,
      medicalRecords,
      vaccinesApplied,
      vaccinesPending,
      vaccinesOverdue,
      dewormingsApplied,
      dewormingsPending,
      dewormingsOverdue,
      treatmentsActive,
      treatmentsFollowUp,
      treatmentsCompleted,
      products,
      expiringBatches,
      productItems,
    ] = await this.prisma.$transaction([
      this.prisma.paymentTransaction.findMany({
        where: {
          receivedAt: { gte: range.from, lte: range.to },
          voidedAt: null,
          payment: {
            deletedAt: null,
            status: { not: PaymentStatus.VOIDED },
          },
        },
        select: { amount: true, receivedAt: true },
      }),
      this.prisma.payment.findMany({
        where: {
          deletedAt: null,
          status: { not: PaymentStatus.VOIDED },
          createdAt: { gte: range.from, lte: range.to },
        },
        select: {
          amount: true,
          paidAmount: true,
          dueAt: true,
          status: true,
        },
      }),
      this.prisma.appointment.findMany({
        where: {
          deletedAt: null,
          startsAt: { gte: range.from, lte: range.to },
        },
        select: { status: true, type: true },
      }),
      this.prisma.owner.count({
        where: {
          deletedAt: null,
          registeredAt: { gte: range.from, lte: range.to },
        },
      }),
      this.prisma.pet.count({
        where: {
          deletedAt: null,
          createdAt: { gte: range.from, lte: range.to },
        },
      }),
      this.prisma.medicalRecord.count({
        where: {
          deletedAt: null,
          occurredAt: { gte: range.from, lte: range.to },
        },
      }),
      this.prisma.vaccine.count({
        where: {
          deletedAt: null,
          appliedAt: { gte: range.from, lte: range.to },
        },
      }),
      this.prisma.vaccine.count({
        where: {
          deletedAt: null,
          nextDueDate: { gte: today, lte: upcomingLimit },
          pet: { deletedAt: null, status: 'ACTIVE' },
        },
      }),
      this.prisma.vaccine.count({
        where: {
          deletedAt: null,
          nextDueDate: { lt: today },
          pet: { deletedAt: null, status: 'ACTIVE' },
        },
      }),
      this.prisma.deworming.count({
        where: {
          deletedAt: null,
          appliedAt: { gte: range.from, lte: range.to },
        },
      }),
      this.prisma.deworming.count({
        where: {
          deletedAt: null,
          nextDueDate: { gte: today, lte: upcomingLimit },
          pet: { deletedAt: null, status: 'ACTIVE' },
        },
      }),
      this.prisma.deworming.count({
        where: {
          deletedAt: null,
          nextDueDate: { lt: today },
          pet: { deletedAt: null, status: 'ACTIVE' },
        },
      }),
      this.prisma.treatment.count({
        where: { deletedAt: null, status: TreatmentStatus.ACTIVE },
      }),
      this.prisma.treatment.count({
        where: { deletedAt: null, status: TreatmentStatus.FOLLOW_UP },
      }),
      this.prisma.treatment.count({
        where: {
          deletedAt: null,
          status: TreatmentStatus.COMPLETED,
          updatedAt: { gte: range.from, lte: range.to },
        },
      }),
      this.prisma.inventoryProduct.findMany({
        where: { deletedAt: null, isActive: true },
        select: {
          currentStock: true,
          minimumStock: true,
          purchasePrice: true,
        },
      }),
      this.prisma.inventoryBatch.count({
        where: {
          deletedAt: null,
          currentQuantity: { gt: 0 },
          expirationDate: { gte: today, lte: upcomingLimit },
          product: { deletedAt: null, isActive: true },
        },
      }),
      this.prisma.paymentItem.findMany({
        where: {
          type: PaymentItemType.PRODUCT,
          payment: {
            deletedAt: null,
            status: { not: PaymentStatus.VOIDED },
            createdAt: { gte: range.from, lte: range.to },
          },
        },
        select: {
          productId: true,
          description: true,
          quantity: true,
          total: true,
          product: { select: { name: true } },
        },
      }),
    ]);

    const income = this.money(
      transactions.reduce(
        (total, transaction) => total + transaction.amount.toNumber(),
        0,
      ),
    );
    const paidDocuments = payments.filter(
      (payment) => payment.status === PaymentStatus.PAID,
    ).length;
    const pendingDocuments = payments.filter((payment) =>
      payment.status === PaymentStatus.PENDING ||
      payment.status === PaymentStatus.PARTIAL,
    ).length;
    const outstanding = this.money(
      payments.reduce(
        (total, payment) =>
          total +
          Math.max(0, payment.amount.toNumber() - payment.paidAmount.toNumber()),
        0,
      ),
    );
    const overdueAmount = this.money(
      payments.reduce((total, payment) => {
        if (
          !payment.dueAt ||
          payment.dueAt >= today ||
          payment.status === PaymentStatus.PAID
        ) {
          return total;
        }
        return (
          total +
          Math.max(0, payment.amount.toNumber() - payment.paidAmount.toNumber())
        );
      }, 0),
    );

    return {
      generatedAt: now.toISOString(),
      range: {
        from: range.labelFrom,
        to: range.labelTo,
      },
      financial: {
        income,
        outstanding,
        overdueAmount,
        paidDocuments,
        pendingDocuments,
        averageTicket: paidDocuments ? this.money(income / paidDocuments) : 0,
        incomeByMonth: this.incomeByMonth(range.from, range.to, transactions),
      },
      appointments: {
        total: appointments.length,
        completed: this.countByStatus(
          appointments,
          AppointmentStatus.COMPLETED,
        ),
        cancelled: this.countByStatus(
          appointments,
          AppointmentStatus.CANCELLED,
        ),
        noShow: this.countByStatus(appointments, AppointmentStatus.NO_SHOW),
        pending: this.countByStatus(appointments, AppointmentStatus.PENDING),
        confirmed: this.countByStatus(
          appointments,
          AppointmentStatus.CONFIRMED,
        ),
        byType: this.countByKey(appointments, 'type'),
        byStatus: this.countByKey(appointments, 'status'),
      },
      clinical: {
        medicalRecords,
        vaccinesApplied,
        vaccinesPending,
        vaccinesOverdue,
        dewormingsApplied,
        dewormingsPending,
        dewormingsOverdue,
        treatmentsActive,
        treatmentsFollowUp,
        treatmentsCompleted,
      },
      inventory: {
        lowStock: products.filter(
          (product) =>
            product.currentStock.toNumber() > 0 &&
            product.currentStock.toNumber() <= product.minimumStock.toNumber(),
        ).length,
        outOfStock: products.filter(
          (product) => product.currentStock.toNumber() <= 0,
        ).length,
        expiringSoon: expiringBatches,
        inventoryValue: this.money(
          products.reduce(
            (total, product) =>
              total +
              product.currentStock.toNumber() *
                (product.purchasePrice?.toNumber() ?? 0),
            0,
          ),
        ),
        productsSold: this.productsSold(productItems),
      },
      clients: {
        ownersRegistered,
        petsRegistered,
      },
    };
  }

  async exportCsv(query: ReportsQueryDto): Promise<string> {
    const summary = await this.getSummary(query);
    const section = query.section ?? 'all';
    return this.toCsv(summary, section);
  }

  async exportXlsx(query: ReportsQueryDto): Promise<{
    buffer: Buffer;
    filename: string;
  }> {
    const summary = await this.getSummary(query);
    const section = query.section ?? 'all';
    return {
      buffer: await this.reportsExcel.buildWorkbook(summary, section),
      filename: this.reportsExcel.filename(summary, section),
    };
  }

  exportFilename(query: ReportsQueryDto) {
    const range = this.safeRange(query);
    const section = query.section ?? 'all';
    return `vetcare_reportes_${section}_${range.labelFrom}_${range.labelTo}.csv`;
  }

  private safeRange(query: ReportsQueryDto) {
    try {
      return buildReportRange(query);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'El rango de fechas no es valido',
      );
    }
  }

  private incomeByMonth(
    from: Date,
    to: Date,
    transactions: Array<{ amount: { toNumber(): number }; receivedAt: Date }>,
  ) {
    const formatter = new Intl.DateTimeFormat('es-EC', {
      month: 'short',
      year: '2-digit',
    });
    const months: Array<{ date: Date; month: string; total: number }> = [];
    let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const last = new Date(to.getFullYear(), to.getMonth(), 1);

    while (cursor.getTime() <= last.getTime()) {
      months.push({
        date: new Date(cursor),
        month: formatter.format(cursor).replace('.', ''),
        total: 0,
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    for (const transaction of transactions) {
      const item = months.find(
        (month) =>
          month.date.getFullYear() === transaction.receivedAt.getFullYear() &&
          month.date.getMonth() === transaction.receivedAt.getMonth(),
      );
      if (item) {
        item.total = this.money(item.total + transaction.amount.toNumber());
      }
    }

    return months.map(({ month, total }) => ({ month, total }));
  }

  private countByStatus(
    appointments: Array<{ status: AppointmentStatus }>,
    status: AppointmentStatus,
  ) {
    return appointments.filter((appointment) => appointment.status === status)
      .length;
  }

  private countByKey<T extends Record<K, string>, K extends keyof T>(
    items: T[],
    key: K,
  ) {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item[key], (counts.get(item[key]) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([value, count]) => ({ [key]: value, count }))
      .sort((a, b) => b.count - a.count) as Array<
      { count: number } & Record<K, string>
    >;
  }

  private productsSold(
    items: Array<{
      productId: string | null;
      description: string;
      quantity: Prisma.Decimal;
      total: Prisma.Decimal;
      product: { name: string } | null;
    }>,
  ) {
    const products = new Map<
      string,
      {
        productId: string | null;
        name: string;
        quantity: number;
        total: number;
      }
    >();
    for (const item of items) {
      const key = item.productId ?? item.description;
      const current = products.get(key) ?? {
        productId: item.productId,
        name: item.product?.name ?? item.description,
        quantity: 0,
        total: 0,
      };
      current.quantity = Number(
        (current.quantity + item.quantity.toNumber()).toFixed(3),
      );
      current.total = this.money(current.total + item.total.toNumber());
      products.set(key, current);
    }
    return [...products.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }

  private toCsv(summary: ReportsSummary, section: ReportSection): string {
    const rows: string[][] = [
      ['Seccion', 'Indicador', 'Detalle', 'Valor'],
      [
        'Rango',
        'Periodo',
        `${summary.range.from} a ${summary.range.to}`,
        summary.generatedAt,
      ],
    ];
    const include = (target: ReportSection) =>
      section === 'all' || section === target;

    if (include('financial')) {
      rows.push(
        ['Finanzas', 'Ingresos cobrados', '', String(summary.financial.income)],
        [
          'Finanzas',
          'Saldo por cobrar',
          '',
          String(summary.financial.outstanding),
        ],
        [
          'Finanzas',
          'Saldo vencido',
          '',
          String(summary.financial.overdueAmount),
        ],
        [
          'Finanzas',
          'Documentos pagados',
          '',
          String(summary.financial.paidDocuments),
        ],
        [
          'Finanzas',
          'Documentos pendientes',
          '',
          String(summary.financial.pendingDocuments),
        ],
        [
          'Finanzas',
          'Ticket promedio',
          '',
          String(summary.financial.averageTicket),
        ],
      );
      for (const item of summary.financial.incomeByMonth) {
        rows.push(['Finanzas', 'Ingresos por mes', item.month, String(item.total)]);
      }
    }

    if (include('appointments')) {
      rows.push(
        ['Citas', 'Total', '', String(summary.appointments.total)],
        ['Citas', 'Atendidas', '', String(summary.appointments.completed)],
        ['Citas', 'Confirmadas', '', String(summary.appointments.confirmed)],
        ['Citas', 'Pendientes', '', String(summary.appointments.pending)],
        ['Citas', 'Canceladas', '', String(summary.appointments.cancelled)],
        ['Citas', 'No asistio', '', String(summary.appointments.noShow)],
      );
      for (const item of summary.appointments.byType) {
        rows.push(['Citas', 'Por tipo', item.type, String(item.count)]);
      }
    }

    if (include('clinical')) {
      rows.push(
        [
          'Clinica',
          'Historiales creados',
          '',
          String(summary.clinical.medicalRecords),
        ],
        [
          'Clinica',
          'Vacunas aplicadas',
          '',
          String(summary.clinical.vaccinesApplied),
        ],
        [
          'Clinica',
          'Vacunas pendientes',
          '',
          String(summary.clinical.vaccinesPending),
        ],
        [
          'Clinica',
          'Vacunas vencidas',
          '',
          String(summary.clinical.vaccinesOverdue),
        ],
        [
          'Clinica',
          'Desparasitaciones aplicadas',
          '',
          String(summary.clinical.dewormingsApplied),
        ],
        [
          'Clinica',
          'Tratamientos activos',
          '',
          String(summary.clinical.treatmentsActive),
        ],
        [
          'Clinica',
          'Tratamientos en control',
          '',
          String(summary.clinical.treatmentsFollowUp),
        ],
      );
    }

    if (include('inventory')) {
      rows.push(
        ['Inventario', 'Stock bajo', '', String(summary.inventory.lowStock)],
        ['Inventario', 'Sin existencias', '', String(summary.inventory.outOfStock)],
        [
          'Inventario',
          'Lotes por vencer',
          '',
          String(summary.inventory.expiringSoon),
        ],
        [
          'Inventario',
          'Valor estimado',
          '',
          String(summary.inventory.inventoryValue),
        ],
      );
      for (const item of summary.inventory.productsSold) {
        rows.push([
          'Inventario',
          'Productos vendidos',
          `${item.name} (${item.quantity})`,
          String(item.total),
        ]);
      }
    }

    if (section === 'all') {
      rows.push(
        [
          'Clientes',
          'Duenos registrados',
          '',
          String(summary.clients.ownersRegistered),
        ],
        [
          'Clientes',
          'Mascotas registradas',
          '',
          String(summary.clients.petsRegistered),
        ],
      );
    }

    return `\uFEFF${rows.map((row) => row.map(this.csvCell).join(',')).join('\n')}`;
  }

  private csvCell(value: string): string {
    if (!/[",\n]/.test(value)) return value;
    return `"${value.replace(/"/g, '""')}"`;
  }

  private money(value: number) {
    return Number(value.toFixed(2));
  }
}

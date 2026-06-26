import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  AuditAction,
  ExpenseCategory,
  PaymentStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFinanceExpenseDto } from './dto/create-finance-expense.dto';
import { FinanceQueryDto } from './dto/finance-query.dto';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(query: FinanceQueryDto) {
    const range = this.resolveRange(query);
    const [income, expenses, expenseRows, transactionRows] =
      await this.prisma.$transaction([
        this.prisma.paymentTransaction.aggregate({
          _sum: { amount: true },
          where: {
            voidedAt: null,
            receivedAt: { gte: range.from, lte: range.to },
            payment: {
              deletedAt: null,
              status: { not: PaymentStatus.VOIDED },
            },
          },
        }),
        this.prisma.financeExpense.aggregate({
          _sum: { amount: true },
          where: this.expenseWhere(query, range),
        }),
        this.prisma.financeExpense.findMany({
          where: this.expenseWhere(query, range),
          select: {
            category: true,
            amount: true,
            occurredAt: true,
          },
        }),
        this.prisma.paymentTransaction.findMany({
          where: {
            voidedAt: null,
            receivedAt: { gte: range.from, lte: range.to },
            payment: {
              deletedAt: null,
              status: { not: PaymentStatus.VOIDED },
            },
          },
          select: { amount: true, receivedAt: true },
        }),
      ]);

    const totalIncome = this.money(income._sum.amount?.toNumber() ?? 0);
    const totalExpenses = this.money(expenses._sum.amount?.toNumber() ?? 0);
    const netIncome = this.money(totalIncome - totalExpenses);

    return {
      generatedAt: new Date().toISOString(),
      range: {
        from: this.dateLabel(range.from),
        to: this.dateLabel(range.to),
      },
      totals: {
        income: totalIncome,
        expenses: totalExpenses,
        netIncome,
        margin:
          totalIncome > 0 ? this.money((netIncome / totalIncome) * 100) : 0,
      },
      expensesByCategory: this.expensesByCategory(expenseRows),
      monthlySeries: this.monthlySeries(range.from, range.to, transactionRows, expenseRows),
    };
  }

  async findExpenses(query: FinanceQueryDto) {
    const range = this.resolveRange(query);
    const skip = (query.page - 1) * query.pageSize;
    const where = this.expenseWhere(query, range);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.financeExpense.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: query.pageSize,
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.financeExpense.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        amount: item.amount.toNumber(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async createExpense(actorId: string, dto: CreateFinanceExpenseDto) {
    const expense = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.financeExpense.create({
        data: {
          createdById: actorId,
          category: dto.category,
          description: dto.description.trim(),
          amount: this.money(dto.amount),
          occurredAt: new Date(dto.occurredAt),
          vendor: this.optionalText(dto.vendor),
          reference: this.optionalText(dto.reference),
          notes: this.optionalText(dto.notes),
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: AuditAction.CREATE,
          entityType: 'FinanceExpense',
          entityId: created.id,
          changes: {
            category: created.category,
            amount: created.amount.toNumber(),
            occurredAt: created.occurredAt,
          },
        },
      });
      return created;
    });

    return {
      ...expense,
      amount: expense.amount.toNumber(),
    };
  }

  async removeExpense(actorId: string, expenseId: string) {
    const expense = await this.prisma.financeExpense.findFirst({
      where: { id: expenseId, deletedAt: null },
    });
    if (!expense) {
      throw new NotFoundException('El gasto no existe');
    }

    await this.prisma.$transaction([
      this.prisma.financeExpense.update({
        where: { id: expenseId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          action: AuditAction.DELETE,
          entityType: 'FinanceExpense',
          entityId: expenseId,
          changes: {
            category: expense.category,
            amount: expense.amount.toNumber(),
          },
        },
      }),
    ]);
    return { success: true };
  }

  private expenseWhere(
    query: Pick<FinanceQueryDto, 'category'>,
    range: { from: Date; to: Date },
  ): Prisma.FinanceExpenseWhereInput {
    return {
      deletedAt: null,
      occurredAt: { gte: range.from, lte: range.to },
      ...(query.category ? { category: query.category } : {}),
    };
  }

  private resolveRange(query: FinanceQueryDto) {
    const now = new Date();
    const from = query.dateFrom
      ? new Date(`${query.dateFrom}T00:00:00`)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = query.dateTo
      ? new Date(`${query.dateTo}T23:59:59.999`)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return from <= to ? { from, to } : { from: to, to: from };
  }

  private expensesByCategory(
    expenses: Array<{ category: ExpenseCategory; amount: Prisma.Decimal }>,
  ) {
    const totals = new Map<ExpenseCategory, number>();
    for (const expense of expenses) {
      totals.set(
        expense.category,
        this.money((totals.get(expense.category) ?? 0) + expense.amount.toNumber()),
      );
    }
    return [...totals.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }

  private monthlySeries(
    from: Date,
    to: Date,
    transactions: Array<{ amount: Prisma.Decimal; receivedAt: Date }>,
    expenses: Array<{ amount: Prisma.Decimal; occurredAt: Date }>,
  ) {
    const formatter = new Intl.DateTimeFormat('es-EC', { month: 'short' });
    const months: Array<{
      date: Date;
      month: string;
      income: number;
      expenses: number;
      netIncome: number;
    }> = [];
    let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const last = new Date(to.getFullYear(), to.getMonth(), 1);

    while (cursor.getTime() <= last.getTime()) {
      months.push({
        date: new Date(cursor),
        month: formatter.format(cursor).replace('.', ''),
        income: 0,
        expenses: 0,
        netIncome: 0,
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    for (const transaction of transactions) {
      const item = this.monthBucket(months, transaction.receivedAt);
      if (item) item.income = this.money(item.income + transaction.amount.toNumber());
    }
    for (const expense of expenses) {
      const item = this.monthBucket(months, expense.occurredAt);
      if (item) item.expenses = this.money(item.expenses + expense.amount.toNumber());
    }

    return months.map(({ month, income, expenses }) => ({
      month,
      income,
      expenses,
      netIncome: this.money(income - expenses),
    }));
  }

  private monthBucket<T extends { date: Date }>(items: T[], date: Date): T | undefined {
    return items.find(
      (item) =>
        item.date.getFullYear() === date.getFullYear() &&
        item.date.getMonth() === date.getMonth(),
    );
  }

  private optionalText(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private dateLabel(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private money(value: number) {
    return Number(value.toFixed(2));
  }
}

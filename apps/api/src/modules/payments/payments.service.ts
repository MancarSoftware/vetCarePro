import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  InventoryMovementType,
  PaymentItemType,
  PaymentMethod,
  PaymentStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentTransactionDto } from './dto/create-payment-transaction.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsQueryDto } from './dto/payments-query.dto';
import {
  calculatePaymentItem,
  money,
  paymentStatus,
} from './payment-calculations';

const paymentListInclude = {
  owner: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
  },
  pet: {
    select: { id: true, name: true, species: true, breed: true },
  },
  appointment: {
    select: { id: true, type: true, startsAt: true },
  },
  items: {
    take: 3,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      type: true,
      description: true,
      quantity: true,
      unitPrice: true,
      discount: true,
      total: true,
      productId: true,
    },
  },
  _count: { select: { items: true, transactions: true } },
} satisfies Prisma.PaymentInclude;

const paymentDetailInclude = {
  owner: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      nationalId: true,
    },
  },
  pet: {
    select: { id: true, name: true, species: true, breed: true },
  },
  appointment: {
    select: {
      id: true,
      type: true,
      status: true,
      startsAt: true,
    },
  },
  createdBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      product: {
        select: { id: true, sku: true, name: true, unit: true },
      },
    },
  },
  transactions: {
    where: { voidedAt: null },
    orderBy: { receivedAt: 'desc' },
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  },
  _count: { select: { items: true, transactions: true } },
} satisfies Prisma.PaymentInclude;

type PaymentList = Prisma.PaymentGetPayload<{
  include: typeof paymentListInclude;
}>;
type PaymentDetail = Prisma.PaymentGetPayload<{
  include: typeof paymentDetailInclude;
}>;

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaymentsQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.PaymentWhereInput = {
      deletedAt: null,
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.petId ? { petId: query.petId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom
                ? { gte: new Date(`${query.dateFrom}T00:00:00`) }
                : {}),
              ...(query.dateTo
                ? { lte: new Date(`${query.dateTo}T23:59:59.999`) }
                : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search, mode: 'insensitive' } },
              { reference: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              {
                owner: {
                  OR: [
                    {
                      firstName: {
                        contains: search,
                        mode: 'insensitive',
                      },
                    },
                    {
                      lastName: {
                        contains: search,
                        mode: 'insensitive',
                      },
                    },
                  ],
                },
              },
              { pet: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: paymentListInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return {
      items: items.map((item) => this.paymentListResponse(item)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async findOne(paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, deletedAt: null },
      include: paymentDetailInclude,
    });
    if (!payment) {
      throw new NotFoundException('El documento de cobro no existe');
    }
    return this.paymentDetailResponse(payment);
  }

  async getSummary() {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [payments, collectedToday, collectedMonth] =
      await this.prisma.$transaction([
        this.prisma.payment.findMany({
          where: { deletedAt: null, status: { not: PaymentStatus.VOIDED } },
          select: {
            amount: true,
            paidAmount: true,
            status: true,
            dueAt: true,
          },
        }),
        this.prisma.paymentTransaction.aggregate({
          _sum: { amount: true },
          where: {
            voidedAt: null,
            receivedAt: { gte: todayStart, lt: tomorrow },
            payment: {
              deletedAt: null,
              status: { not: PaymentStatus.VOIDED },
            },
          },
        }),
        this.prisma.paymentTransaction.aggregate({
          _sum: { amount: true },
          where: {
            voidedAt: null,
            receivedAt: { gte: monthStart },
            payment: {
              deletedAt: null,
              status: { not: PaymentStatus.VOIDED },
            },
          },
        }),
      ]);
    return {
      totalDocuments: payments.length,
      pendingDocuments: payments.filter(
        (payment) =>
          payment.status === PaymentStatus.PENDING ||
          payment.status === PaymentStatus.PARTIAL,
      ).length,
      overdueDocuments: payments.filter(
        (payment) =>
          payment.dueAt &&
          payment.dueAt < todayStart &&
          payment.status !== PaymentStatus.PAID,
      ).length,
      outstanding: money(
        payments.reduce(
          (sum, payment) =>
            sum +
            payment.amount.toNumber() -
            payment.paidAmount.toNumber(),
          0,
        ),
      ),
      collectedToday:
        collectedToday._sum.amount?.toNumber() ?? 0,
      collectedMonth:
        collectedMonth._sum.amount?.toNumber() ?? 0,
    };
  }

  async create(actorId: string, dto: CreatePaymentDto) {
    const owner = await this.ensureOwner(dto.ownerId);
    const pet = dto.petId
      ? await this.ensurePet(dto.petId, owner.id)
      : null;
    if (dto.appointmentId) {
      await this.ensureAppointment(
        dto.appointmentId,
        owner.id,
        pet?.id ?? null,
      );
    }

    const productIds = [
      ...new Set(
        dto.items
          .filter((item) => item.type === PaymentItemType.PRODUCT)
          .map((item) => item.productId)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const products = await this.prisma.inventoryProduct.findMany({
      where: {
        id: { in: productIds },
        deletedAt: null,
        isActive: true,
      },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));
    if (products.length !== productIds.length) {
      throw new NotFoundException(
        'Uno de los productos no existe o está inactivo',
      );
    }

    const normalizedItems = dto.items.map((item) => {
      if (item.type === PaymentItemType.PRODUCT && !item.productId) {
        throw new BadRequestException(
          'Los conceptos de producto requieren un producto de inventario',
        );
      }
      if (item.type !== PaymentItemType.PRODUCT && item.productId) {
        throw new BadRequestException(
          'Solo los conceptos de producto pueden vincular inventario',
        );
      }
      const calculation = calculatePaymentItem(item);
      return {
        ...item,
        description: item.description.trim(),
        ...calculation,
      };
    });
    this.validateProductStock(normalizedItems, productMap);

    const subtotal = money(
      normalizedItems.reduce((sum, item) => sum + item.subtotal, 0),
    );
    const discount = money(
      normalizedItems.reduce((sum, item) => sum + item.discount, 0),
    );
    const total = money(
      normalizedItems.reduce((sum, item) => sum + item.total, 0),
    );
    if (total <= 0) {
      throw new BadRequestException(
        'El total del documento debe ser mayor que cero',
      );
    }
    const initialAmount = dto.initialPayment?.amount ?? 0;
    if (initialAmount > total) {
      throw new BadRequestException(
        'El pago inicial no puede superar el total del documento',
      );
    }
    const status = paymentStatus(total, initialAmount);
    const invoiceNumber = this.generateInvoiceNumber();
    const description =
      normalizedItems.length === 1
        ? normalizedItems[0].description
        : `${normalizedItems[0].description} y ${normalizedItems.length - 1} concepto(s) más`;

    try {
      const paymentId = await this.prisma.$transaction(
        async (transaction) => {
          const payment = await transaction.payment.create({
            data: {
              ownerId: owner.id,
              petId: pet?.id ?? null,
              appointmentId: dto.appointmentId ?? null,
              createdById: actorId,
              invoiceNumber,
              reference: this.optionalText(dto.reference),
              description,
              subtotal,
              discount,
              amount: total,
              paidAmount: initialAmount,
              method:
                dto.initialPayment?.method ?? PaymentMethod.CASH,
              status,
              paidAt:
                status === PaymentStatus.PAID
                  ? this.transactionDate(dto.initialPayment?.receivedAt)
                  : null,
              dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
              notes: this.optionalText(dto.notes),
            },
          });

          for (const item of normalizedItems) {
            const createdItem = await transaction.paymentItem.create({
              data: {
                paymentId: payment.id,
                productId: item.productId ?? null,
                type: item.type,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount,
                total: item.total,
              },
            });
            if (
              item.type === PaymentItemType.PRODUCT &&
              item.productId
            ) {
              await this.consumeProductStock(transaction, {
                actorId,
                productId: item.productId,
                paymentItemId: createdItem.id,
                quantity: item.quantity,
                invoiceNumber,
              });
            }
          }

          if (dto.initialPayment) {
            await transaction.paymentTransaction.create({
              data: {
                paymentId: payment.id,
                createdById: actorId,
                amount: dto.initialPayment.amount,
                method: dto.initialPayment.method,
                reference: this.optionalText(
                  dto.initialPayment.reference,
                ),
                notes: this.optionalText(dto.initialPayment.notes),
                receivedAt: this.transactionDate(
                  dto.initialPayment.receivedAt,
                ),
              },
            });
          }
          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'CREATE',
              entityType: 'Payment',
              entityId: payment.id,
              changes: {
                invoiceNumber,
                ownerId: owner.id,
                petId: pet?.id ?? null,
                total,
                initialAmount,
                status,
                items: normalizedItems.length,
              },
            },
          });
          return payment.id;
        },
      );
      return this.findOne(paymentId);
    } catch (error) {
      this.handleUniqueReference(error);
    }
  }

  async createTransaction(
    actorId: string,
    paymentId: string,
    dto: CreatePaymentTransactionDto,
  ) {
    const payment = await this.ensurePayment(paymentId);
    if (payment.status === PaymentStatus.VOIDED) {
      throw new BadRequestException(
        'No se pueden registrar abonos en un documento anulado',
      );
    }
    const balance = money(
      payment.amount.toNumber() - payment.paidAmount.toNumber(),
    );
    if (dto.amount > balance) {
      throw new BadRequestException(
        `El abono supera el saldo pendiente de ${balance.toFixed(2)}`,
      );
    }
    const paidAmount = money(payment.paidAmount.toNumber() + dto.amount);
    const status = paymentStatus(payment.amount.toNumber(), paidAmount);
    const receivedAt = this.transactionDate(dto.receivedAt);

    await this.prisma.$transaction([
      this.prisma.paymentTransaction.create({
        data: {
          paymentId,
          createdById: actorId,
          amount: dto.amount,
          method: dto.method,
          reference: this.optionalText(dto.reference),
          notes: this.optionalText(dto.notes),
          receivedAt,
        },
      }),
      this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          paidAmount,
          method: dto.method,
          status,
          paidAt: status === PaymentStatus.PAID ? receivedAt : null,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'CREATE',
          entityType: 'PaymentTransaction',
          entityId: paymentId,
          changes: {
            amount: dto.amount,
            method: dto.method,
            balanceBefore: balance,
            balanceAfter: money(balance - dto.amount),
          },
        },
      }),
    ]);
    return this.findOne(paymentId);
  }

  async voidPayment(actorId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, deletedAt: null },
      include: {
        items: {
          include: {
            inventoryMovements: {
              where: { type: InventoryMovementType.SALE },
            },
          },
        },
      },
    });
    if (!payment) {
      throw new NotFoundException('El documento de cobro no existe');
    }
    if (payment.status === PaymentStatus.VOIDED) {
      throw new BadRequestException('El documento ya está anulado');
    }

    await this.prisma.$transaction(async (transaction) => {
      const restoredByProduct = new Map<string, number>();
      for (const item of payment.items) {
        if (!item.productId) continue;
        for (const movement of item.inventoryMovements) {
          let batchId = movement.batchId;
          if (batchId) {
            await transaction.inventoryBatch.update({
              where: { id: batchId },
              data: {
                currentQuantity: {
                  increment: movement.quantity,
                },
              },
            });
          } else {
            const batch = await transaction.inventoryBatch.create({
              data: {
                productId: item.productId,
                batchNumber: `DEV-${payment.invoiceNumber}`,
                initialQuantity: movement.quantity,
                currentQuantity: movement.quantity,
                unitCost: movement.unitCost,
              },
            });
            batchId = batch.id;
          }
          await transaction.inventoryMovement.create({
            data: {
              productId: item.productId,
              batchId,
              paymentItemId: item.id,
              performedById: actorId,
              type: InventoryMovementType.RETURN,
              quantity: movement.quantity,
              unitCost: movement.unitCost,
              referenceType: 'PAYMENT_VOID',
              referenceId: payment.invoiceNumber,
              notes: 'Reposición automática por documento anulado',
            },
          });
          restoredByProduct.set(
            item.productId,
            (restoredByProduct.get(item.productId) ?? 0) +
              movement.quantity.toNumber(),
          );
        }
      }
      for (const [productId, quantity] of restoredByProduct) {
        await transaction.inventoryProduct.update({
          where: { id: productId },
          data: { currentStock: { increment: quantity } },
        });
        await this.syncNextExpiration(transaction, productId);
      }
      await transaction.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.VOIDED,
          voidedAt: new Date(),
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'DELETE',
          entityType: 'Payment',
          entityId: paymentId,
          changes: {
            invoiceNumber: payment.invoiceNumber,
            restoredProducts: restoredByProduct.size,
            paidAmount: payment.paidAmount.toNumber(),
          },
        },
      });
    });
    return this.findOne(paymentId);
  }

  private validateProductStock(
    items: Array<{
      type: PaymentItemType;
      productId?: string;
      quantity: number;
    }>,
    products: Map<
      string,
      { currentStock: { toNumber(): number }; name: string; unit: string }
    >,
  ) {
    const requested = new Map<string, number>();
    for (const item of items) {
      if (item.type !== PaymentItemType.PRODUCT || !item.productId) continue;
      requested.set(
        item.productId,
        (requested.get(item.productId) ?? 0) + item.quantity,
      );
    }
    for (const [productId, quantity] of requested) {
      const product = products.get(productId);
      if (!product || product.currentStock.toNumber() < quantity) {
        throw new BadRequestException(
          `Stock insuficiente para ${product?.name ?? 'el producto seleccionado'}. Disponible: ${product?.currentStock.toNumber() ?? 0} ${product?.unit ?? ''}`,
        );
      }
    }
  }

  private async consumeProductStock(
    transaction: Prisma.TransactionClient,
    input: {
      actorId: string;
      productId: string;
      paymentItemId: string;
      quantity: number;
      invoiceNumber: string;
    },
  ) {
    const batches = await transaction.inventoryBatch.findMany({
      where: {
        productId: input.productId,
        deletedAt: null,
        currentQuantity: { gt: 0 },
      },
      orderBy: [{ expirationDate: 'asc' }, { receivedAt: 'asc' }],
    });
    let remaining = input.quantity;
    for (const batch of batches) {
      if (remaining <= 0) break;
      const quantity = Math.min(
        remaining,
        batch.currentQuantity.toNumber(),
      );
      await transaction.inventoryBatch.update({
        where: { id: batch.id },
        data: { currentQuantity: { decrement: quantity } },
      });
      await transaction.inventoryMovement.create({
        data: {
          productId: input.productId,
          batchId: batch.id,
          paymentItemId: input.paymentItemId,
          performedById: input.actorId,
          type: InventoryMovementType.SALE,
          quantity,
          unitCost: batch.unitCost,
          referenceType: 'PAYMENT',
          referenceId: input.invoiceNumber,
          notes: 'Salida automática por venta',
        },
      });
      remaining = Number((remaining - quantity).toFixed(3));
    }
    if (remaining > 0) {
      await transaction.inventoryMovement.create({
        data: {
          productId: input.productId,
          paymentItemId: input.paymentItemId,
          performedById: input.actorId,
          type: InventoryMovementType.SALE,
          quantity: remaining,
          referenceType: 'PAYMENT',
          referenceId: input.invoiceNumber,
          notes: 'Salida automática por venta',
        },
      });
    }
    await transaction.inventoryProduct.update({
      where: { id: input.productId },
      data: { currentStock: { decrement: input.quantity } },
    });
    await this.syncNextExpiration(transaction, input.productId);
  }

  private async syncNextExpiration(
    transaction: Prisma.TransactionClient,
    productId: string,
  ) {
    const nextBatch = await transaction.inventoryBatch.findFirst({
      where: {
        productId,
        deletedAt: null,
        currentQuantity: { gt: 0 },
        expirationDate: { not: null },
      },
      orderBy: { expirationDate: 'asc' },
      select: { expirationDate: true },
    });
    await transaction.inventoryProduct.update({
      where: { id: productId },
      data: { expirationDate: nextBatch?.expirationDate ?? null },
    });
  }

  private ensureOwner(ownerId: string) {
    return this.prisma.owner
      .findFirst({
        where: { id: ownerId, deletedAt: null },
        select: { id: true },
      })
      .then((owner) => {
        if (!owner) throw new NotFoundException('El dueño no existe');
        return owner;
      });
  }

  private ensurePet(petId: string, ownerId: string) {
    return this.prisma.pet
      .findFirst({
        where: { id: petId, ownerId, deletedAt: null },
        select: { id: true },
      })
      .then((pet) => {
        if (!pet) {
          throw new NotFoundException(
            'La mascota no existe o pertenece a otro dueño',
          );
        }
        return pet;
      });
  }

  private ensureAppointment(
    appointmentId: string,
    ownerId: string,
    petId: string | null,
  ) {
    return this.prisma.appointment
      .findFirst({
        where: {
          id: appointmentId,
          ownerId,
          deletedAt: null,
          ...(petId ? { petId } : {}),
        },
        select: { id: true },
      })
      .then((appointment) => {
        if (!appointment) {
          throw new NotFoundException(
            'La cita no existe o no corresponde al cliente seleccionado',
          );
        }
        return appointment;
      });
  }

  private async ensurePayment(paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, deletedAt: null },
    });
    if (!payment) {
      throw new NotFoundException('El documento de cobro no existe');
    }
    return payment;
  }

  private generateInvoiceNumber() {
    const now = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');
    const unique = `${now.getTime().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 5)}`.toUpperCase();
    return `VCP-${date}-${unique.slice(-8)}`;
  }

  private transactionDate(value?: string) {
    return value ? new Date(value) : new Date();
  }

  private optionalText(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private handleUniqueReference(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new BadRequestException(
        'La referencia del documento ya está registrada',
      );
    }
    throw error;
  }

  private paymentListResponse(payment: PaymentList) {
    return {
      ...payment,
      subtotal: payment.subtotal.toNumber(),
      discount: payment.discount.toNumber(),
      amount: payment.amount.toNumber(),
      paidAmount: payment.paidAmount.toNumber(),
      balance:
        payment.status === PaymentStatus.VOIDED
          ? 0
          : money(
              payment.amount.toNumber() -
                payment.paidAmount.toNumber(),
            ),
      items: payment.items.map((item) => ({
        ...item,
        quantity: item.quantity.toNumber(),
        unitPrice: item.unitPrice.toNumber(),
        discount: item.discount.toNumber(),
        total: item.total.toNumber(),
      })),
    };
  }

  private paymentDetailResponse(payment: PaymentDetail) {
    return {
      ...this.paymentListResponse(payment),
      items: payment.items.map((item) => ({
        ...item,
        quantity: item.quantity.toNumber(),
        unitPrice: item.unitPrice.toNumber(),
        discount: item.discount.toNumber(),
        total: item.total.toNumber(),
      })),
      transactions: payment.transactions.map((transaction) => ({
        ...transaction,
        amount: transaction.amount.toNumber(),
      })),
    };
  }
}

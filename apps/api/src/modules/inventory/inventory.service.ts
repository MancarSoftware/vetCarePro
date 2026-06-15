import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { InventoryMovementType } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';
import { CreateInventoryProductDto } from './dto/create-inventory-product.dto';
import { InventoryMovementsQueryDto } from './dto/inventory-movements-query.dto';
import { InventoryProductsQueryDto } from './dto/inventory-products-query.dto';
import { UpdateInventoryProductDto } from './dto/update-inventory-product.dto';
import {
  isExpiringWithin,
  isInboundMovement,
  isLowStock,
  movementDelta,
} from './inventory-stock';

const activeBatchWhere = {
  deletedAt: null,
  currentQuantity: { gt: 0 },
} satisfies Prisma.InventoryBatchWhereInput;

const productListInclude = {
  batches: {
    where: activeBatchWhere,
    orderBy: [{ expirationDate: 'asc' }, { receivedAt: 'asc' }],
    select: {
      id: true,
      batchNumber: true,
      currentQuantity: true,
      expirationDate: true,
    },
  },
  _count: { select: { movements: true, batches: true } },
} satisfies Prisma.InventoryProductInclude;

const productDetailInclude = {
  batches: {
    where: { deletedAt: null },
    orderBy: [{ currentQuantity: 'desc' }, { expirationDate: 'asc' }],
  },
  movements: {
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: {
      batch: {
        select: { id: true, batchNumber: true, expirationDate: true },
      },
      performedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  },
  _count: { select: { movements: true, batches: true } },
} satisfies Prisma.InventoryProductInclude;

type ProductList = Prisma.InventoryProductGetPayload<{
  include: typeof productListInclude;
}>;
type ProductDetail = Prisma.InventoryProductGetPayload<{
  include: typeof productDetailInclude;
}>;

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findProducts(query: InventoryProductsQueryDto) {
    const search = query.search?.trim();
    const today = this.todayDateOnly();
    const expirationLimit = this.addDays(today, 30);
    const minimumStockField =
      this.prisma.inventoryProduct.fields.minimumStock;
    const where: Prisma.InventoryProductWhereInput = {
      deletedAt: null,
      isActive: true,
      ...(query.category ? { category: query.category } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { category: { contains: search, mode: 'insensitive' } },
              { supplier: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.stockStatus === 'OUT_OF_STOCK'
        ? { currentStock: { lte: 0 } }
        : {}),
      ...(query.stockStatus === 'LOW_STOCK'
        ? {
            currentStock: {
              gt: 0,
              lte: minimumStockField,
            },
          }
        : {}),
      ...(query.stockStatus === 'AVAILABLE'
        ? { currentStock: { gt: minimumStockField } }
        : {}),
      ...(query.stockStatus === 'EXPIRING'
        ? {
            batches: {
              some: {
                ...activeBatchWhere,
                expirationDate: { gte: today, lte: expirationLimit },
              },
            },
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventoryProduct.findMany({
        where,
        include: productListInclude,
        orderBy: [{ name: 'asc' }],
        skip,
        take: query.pageSize,
      }),
      this.prisma.inventoryProduct.count({ where }),
    ]);

    return {
      items: items.map((item) => this.productListResponse(item)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async findProduct(productId: string) {
    const product = await this.prisma.inventoryProduct.findFirst({
      where: { id: productId, deletedAt: null },
      include: productDetailInclude,
    });
    if (!product) {
      throw new NotFoundException('El producto no existe');
    }
    return this.productDetailResponse(product);
  }

  async getSummary() {
    const products = await this.prisma.inventoryProduct.findMany({
      where: { deletedAt: null, isActive: true },
      include: {
        batches: {
          where: activeBatchWhere,
          select: { expirationDate: true, currentQuantity: true },
        },
      },
    });
    const today = this.todayDateOnly();
    const expiredBatches = products.flatMap((product) => product.batches).filter(
      (batch) => batch.expirationDate && batch.expirationDate < today,
    ).length;
    const expiringSoon = products
      .flatMap((product) => product.batches)
      .filter((batch) => isExpiringWithin(batch.expirationDate)).length;

    return {
      totalProducts: products.length,
      lowStock: products.filter((product) =>
        isLowStock(
          product.currentStock.toNumber(),
          product.minimumStock.toNumber(),
        ),
      ).length,
      outOfStock: products.filter(
        (product) => product.currentStock.toNumber() <= 0,
      ).length,
      expiringSoon,
      expiredBatches,
      inventoryValue: products.reduce(
        (total, product) =>
          total +
          product.currentStock.toNumber() *
            (product.purchasePrice?.toNumber() ?? 0),
        0,
      ),
    };
  }

  async getCategories() {
    const products = await this.prisma.inventoryProduct.findMany({
      where: { deletedAt: null, isActive: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
      select: { category: true },
    });
    return products.map(({ category }) => category);
  }

  async findMovements(query: InventoryMovementsQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.InventoryMovementWhereInput = {
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.type ? { type: query.type } : {}),
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
              { notes: { contains: search, mode: 'insensitive' } },
              { referenceId: { contains: search, mode: 'insensitive' } },
              {
                product: {
                  name: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.pageSize,
        include: {
          product: { select: { id: true, name: true, unit: true } },
          batch: {
            select: { id: true, batchNumber: true, expirationDate: true },
          },
          performedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);
    return {
      items: items.map((item) => this.movementResponse(item)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async createProduct(actorId: string, dto: CreateInventoryProductDto) {
    const initialStock = dto.initialStock ?? 0;
    try {
      const product = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.inventoryProduct.create({
          data: {
            sku: this.optionalText(dto.sku),
            name: dto.name.trim(),
            category: dto.category.trim(),
            currentStock: initialStock,
            minimumStock: dto.minimumStock,
            unit: dto.unit.trim(),
            purchasePrice: dto.purchasePrice ?? null,
            salePrice: dto.salePrice ?? null,
            expirationDate: dto.expirationDate
              ? this.parseDateOnly(dto.expirationDate)
              : null,
            supplier: this.optionalText(dto.supplier),
          },
        });
        if (initialStock > 0) {
          const batch = await transaction.inventoryBatch.create({
            data: {
              productId: created.id,
              batchNumber: this.optionalText(dto.batchNumber),
              initialQuantity: initialStock,
              currentQuantity: initialStock,
              unitCost: dto.purchasePrice ?? null,
              expirationDate: dto.expirationDate
                ? this.parseDateOnly(dto.expirationDate)
                : null,
            },
          });
          await transaction.inventoryMovement.create({
            data: {
              productId: created.id,
              batchId: batch.id,
              performedById: actorId,
              type: InventoryMovementType.ADJUSTMENT_IN,
              quantity: initialStock,
              unitCost: dto.purchasePrice ?? null,
              referenceType: 'OPENING_STOCK',
              notes: this.optionalText(dto.notes) ?? 'Stock inicial',
            },
          });
        }
        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'CREATE',
            entityType: 'InventoryProduct',
            entityId: created.id,
            changes: {
              name: created.name,
              sku: created.sku,
              category: created.category,
              initialStock,
            },
          },
        });
        return transaction.inventoryProduct.findUniqueOrThrow({
          where: { id: created.id },
          include: productDetailInclude,
        });
      });
      return this.productDetailResponse(product);
    } catch (error) {
      this.handleUniqueSku(error);
    }
  }

  async updateProduct(
    actorId: string,
    productId: string,
    dto: UpdateInventoryProductDto,
  ) {
    await this.ensureProduct(productId);
    const data: Prisma.InventoryProductUpdateInput = {
      ...(dto.sku !== undefined
        ? { sku: this.optionalText(dto.sku) }
        : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.category !== undefined
        ? { category: dto.category.trim() }
        : {}),
      ...(dto.unit !== undefined ? { unit: dto.unit.trim() } : {}),
      ...(dto.minimumStock !== undefined
        ? { minimumStock: dto.minimumStock }
        : {}),
      ...(dto.purchasePrice !== undefined
        ? { purchasePrice: dto.purchasePrice }
        : {}),
      ...(dto.salePrice !== undefined ? { salePrice: dto.salePrice } : {}),
      ...(dto.supplier !== undefined
        ? { supplier: this.optionalText(dto.supplier) }
        : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };
    try {
      const product = await this.prisma.$transaction(async (transaction) => {
        const updated = await transaction.inventoryProduct.update({
          where: { id: productId },
          data,
          include: productDetailInclude,
        });
        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'UPDATE',
            entityType: 'InventoryProduct',
            entityId: productId,
            changes: this.auditChanges(data),
          },
        });
        return updated;
      });
      return this.productDetailResponse(product);
    } catch (error) {
      this.handleUniqueSku(error);
    }
  }

  async removeProduct(actorId: string, productId: string) {
    const product = await this.ensureProduct(productId);
    if (product.currentStock.toNumber() > 0) {
      throw new BadRequestException(
        'El producto debe quedar sin existencias antes de archivarlo',
      );
    }
    await this.prisma.$transaction([
      this.prisma.inventoryProduct.update({
        where: { id: productId },
        data: { isActive: false, deletedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'DELETE',
          entityType: 'InventoryProduct',
          entityId: productId,
        },
      }),
    ]);
    return { success: true };
  }

  async createMovement(
    actorId: string,
    productId: string,
    dto: CreateInventoryMovementDto,
  ) {
    const product = await this.ensureProduct(productId);
    if (!product.isActive) {
      throw new BadRequestException('El producto está inactivo');
    }
    if (
      !isInboundMovement(dto.type) &&
      product.currentStock.toNumber() < dto.quantity
    ) {
      throw new BadRequestException(
        `Stock insuficiente. Disponible: ${product.currentStock.toNumber()} ${product.unit}`,
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      const movementIds = isInboundMovement(dto.type)
        ? await this.registerInboundMovement(
            transaction,
            actorId,
            productId,
            product.purchasePrice?.toNumber() ?? null,
            dto,
          )
        : await this.registerOutboundMovement(
            transaction,
            actorId,
            productId,
            dto,
          );

      await transaction.inventoryProduct.update({
        where: { id: productId },
        data: {
          currentStock: {
            increment: movementDelta(dto.type, dto.quantity),
          },
        },
      });
      await this.syncNextExpiration(transaction, productId);
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'CREATE',
          entityType: 'InventoryMovement',
          entityId: movementIds[0],
          changes: {
            productId,
            movementIds,
            type: dto.type,
            quantity: dto.quantity,
            stockBefore: product.currentStock.toNumber(),
            stockAfter:
              product.currentStock.toNumber() +
              movementDelta(dto.type, dto.quantity),
          },
        },
      });
    });
    return this.findProduct(productId);
  }

  private async registerInboundMovement(
    transaction: Prisma.TransactionClient,
    actorId: string,
    productId: string,
    defaultUnitCost: number | null,
    dto: CreateInventoryMovementDto,
  ) {
    let batchId = dto.batchId;
    if (batchId) {
      const batch = await transaction.inventoryBatch.findFirst({
        where: { id: batchId, productId, deletedAt: null },
      });
      if (!batch) {
        throw new NotFoundException('El lote seleccionado no existe');
      }
      await transaction.inventoryBatch.update({
        where: { id: batch.id },
        data: {
          initialQuantity: { increment: dto.quantity },
          currentQuantity: { increment: dto.quantity },
          ...(dto.unitCost !== undefined ? { unitCost: dto.unitCost } : {}),
        },
      });
    } else {
      const batch = await transaction.inventoryBatch.create({
        data: {
          productId,
          batchNumber: this.optionalText(dto.batchNumber),
          initialQuantity: dto.quantity,
          currentQuantity: dto.quantity,
          unitCost: dto.unitCost ?? defaultUnitCost,
          expirationDate: dto.expirationDate
            ? this.parseDateOnly(dto.expirationDate)
            : null,
        },
      });
      batchId = batch.id;
    }
    const movement = await transaction.inventoryMovement.create({
      data: {
        productId,
        batchId,
        performedById: actorId,
        type: dto.type,
        quantity: dto.quantity,
        unitCost: dto.unitCost ?? defaultUnitCost,
        referenceType: this.optionalText(dto.referenceType),
        referenceId: this.optionalText(dto.referenceId),
        notes: this.optionalText(dto.notes),
      },
    });
    return [movement.id];
  }

  private async registerOutboundMovement(
    transaction: Prisma.TransactionClient,
    actorId: string,
    productId: string,
    dto: CreateInventoryMovementDto,
  ) {
    const batches = await transaction.inventoryBatch.findMany({
      where: {
        productId,
        ...activeBatchWhere,
        ...(dto.batchId ? { id: dto.batchId } : {}),
      },
      orderBy: [{ expirationDate: 'asc' }, { receivedAt: 'asc' }],
    });
    if (dto.batchId && batches.length === 0) {
      throw new NotFoundException('El lote seleccionado no tiene existencias');
    }
    if (
      dto.batchId &&
      batches[0].currentQuantity.toNumber() < dto.quantity
    ) {
      throw new BadRequestException(
        `El lote seleccionado solo tiene ${batches[0].currentQuantity.toNumber()} unidades`,
      );
    }

    let remaining = dto.quantity;
    const movementIds: string[] = [];
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
      const movement = await transaction.inventoryMovement.create({
        data: {
          productId,
          batchId: batch.id,
          performedById: actorId,
          type: dto.type,
          quantity,
          unitCost: batch.unitCost,
          referenceType: this.optionalText(dto.referenceType),
          referenceId: this.optionalText(dto.referenceId),
          notes: this.optionalText(dto.notes),
        },
      });
      movementIds.push(movement.id);
      remaining = Number((remaining - quantity).toFixed(3));
    }

    if (remaining > 0) {
      const movement = await transaction.inventoryMovement.create({
        data: {
          productId,
          performedById: actorId,
          type: dto.type,
          quantity: remaining,
          unitCost: dto.unitCost ?? null,
          referenceType: this.optionalText(dto.referenceType),
          referenceId: this.optionalText(dto.referenceId),
          notes: this.optionalText(dto.notes),
        },
      });
      movementIds.push(movement.id);
    }
    return movementIds;
  }

  private async syncNextExpiration(
    transaction: Prisma.TransactionClient,
    productId: string,
  ) {
    const nextBatch = await transaction.inventoryBatch.findFirst({
      where: {
        productId,
        ...activeBatchWhere,
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

  private async ensureProduct(productId: string) {
    const product = await this.prisma.inventoryProduct.findFirst({
      where: { id: productId, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundException('El producto no existe');
    }
    return product;
  }

  private productListResponse(product: ProductList) {
    const currentStock = product.currentStock.toNumber();
    const minimumStock = product.minimumStock.toNumber();
    const nextExpiration =
      product.batches.find((batch) => batch.expirationDate)?.expirationDate ??
      null;
    return {
      ...product,
      currentStock,
      minimumStock,
      purchasePrice: product.purchasePrice?.toNumber() ?? null,
      salePrice: product.salePrice?.toNumber() ?? null,
      stockStatus:
        currentStock <= 0
          ? 'OUT_OF_STOCK'
          : isLowStock(currentStock, minimumStock)
            ? 'LOW_STOCK'
            : 'AVAILABLE',
      nextExpiration,
      expiringSoon: isExpiringWithin(nextExpiration),
      batches: product.batches.map((batch) => ({
        ...batch,
        currentQuantity: batch.currentQuantity.toNumber(),
      })),
    };
  }

  private productDetailResponse(product: ProductDetail) {
    return {
      ...product,
      currentStock: product.currentStock.toNumber(),
      minimumStock: product.minimumStock.toNumber(),
      purchasePrice: product.purchasePrice?.toNumber() ?? null,
      salePrice: product.salePrice?.toNumber() ?? null,
      batches: product.batches.map((batch) => ({
        ...batch,
        initialQuantity: batch.initialQuantity.toNumber(),
        currentQuantity: batch.currentQuantity.toNumber(),
        unitCost: batch.unitCost?.toNumber() ?? null,
      })),
      movements: product.movements.map((movement) =>
        this.movementResponse(movement),
      ),
    };
  }

  private movementResponse<
    T extends {
      quantity: { toNumber(): number };
      unitCost: { toNumber(): number } | null;
    },
  >(movement: T) {
    return {
      ...movement,
      quantity: movement.quantity.toNumber(),
      unitCost: movement.unitCost?.toNumber() ?? null,
    };
  }

  private parseDateOnly(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private todayDateOnly(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
    );
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  private optionalText(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private auditChanges(
    data: Prisma.InventoryProductUpdateInput,
  ): Prisma.InputJsonObject {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, value ?? null]),
    ) as Prisma.InputJsonObject;
  }

  private handleUniqueSku(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new BadRequestException('El código SKU ya está registrado');
    }
    throw error;
  }
}

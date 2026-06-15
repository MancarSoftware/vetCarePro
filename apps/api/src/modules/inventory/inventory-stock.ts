import { InventoryMovementType } from '../../generated/prisma/enums';

const inboundTypes = new Set<InventoryMovementType>([
  InventoryMovementType.PURCHASE,
  InventoryMovementType.ADJUSTMENT_IN,
  InventoryMovementType.RETURN,
]);

export function isInboundMovement(type: InventoryMovementType): boolean {
  return inboundTypes.has(type);
}

export function movementDelta(
  type: InventoryMovementType,
  quantity: number,
): number {
  return isInboundMovement(type) ? quantity : -quantity;
}

export function isLowStock(currentStock: number, minimumStock: number) {
  return currentStock > 0 && currentStock <= minimumStock;
}

export function isExpiringWithin(
  expirationDate: Date | null,
  now = new Date(),
  days = 30,
): boolean {
  if (!expirationDate) return false;
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const limit = new Date(today);
  limit.setUTCDate(limit.getUTCDate() + days);
  return expirationDate >= today && expirationDate <= limit;
}

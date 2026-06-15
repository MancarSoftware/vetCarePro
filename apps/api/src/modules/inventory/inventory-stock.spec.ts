import { InventoryMovementType } from '../../generated/prisma/enums';
import {
  isExpiringWithin,
  isInboundMovement,
  isLowStock,
  movementDelta,
} from './inventory-stock';

describe('inventory stock helpers', () => {
  it('classifies inbound movements', () => {
    expect(isInboundMovement(InventoryMovementType.PURCHASE)).toBe(true);
    expect(isInboundMovement(InventoryMovementType.RETURN)).toBe(true);
    expect(isInboundMovement(InventoryMovementType.CLINICAL_USE)).toBe(false);
  });

  it('returns signed stock deltas', () => {
    expect(movementDelta(InventoryMovementType.ADJUSTMENT_IN, 4.5)).toBe(4.5);
    expect(movementDelta(InventoryMovementType.SALE, 4.5)).toBe(-4.5);
  });

  it('detects low stock without treating zero as low stock', () => {
    expect(isLowStock(3, 5)).toBe(true);
    expect(isLowStock(0, 5)).toBe(false);
    expect(isLowStock(8, 5)).toBe(false);
  });

  it('detects batches expiring during the configured window', () => {
    const now = new Date('2026-06-15T12:00:00.000Z');
    expect(isExpiringWithin(new Date('2026-07-10T00:00:00.000Z'), now)).toBe(
      true,
    );
    expect(isExpiringWithin(new Date('2026-08-01T00:00:00.000Z'), now)).toBe(
      false,
    );
  });
});

import { BadRequestException } from '@nestjs/common';
import { PaymentStatus } from '../../generated/prisma/enums';

export interface CalculatedPaymentItem {
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  total: number;
}

export function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePaymentItem(input: {
  quantity: number;
  unitPrice: number;
  discount?: number;
}): CalculatedPaymentItem {
  const subtotal = money(input.quantity * input.unitPrice);
  const discount = money(input.discount ?? 0);
  if (discount > subtotal) {
    throw new BadRequestException(
      'El descuento de un concepto no puede superar su subtotal',
    );
  }
  return {
    quantity: input.quantity,
    unitPrice: money(input.unitPrice),
    discount,
    subtotal,
    total: money(subtotal - discount),
  };
}

export function paymentStatus(
  total: number,
  paid: number,
): PaymentStatus {
  if (paid <= 0) return PaymentStatus.PENDING;
  if (paid >= total) return PaymentStatus.PAID;
  return PaymentStatus.PARTIAL;
}

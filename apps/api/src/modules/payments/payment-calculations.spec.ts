import { PaymentStatus } from '../../generated/prisma/enums';
import {
  calculatePaymentItem,
  money,
  paymentStatus,
} from './payment-calculations';

describe('payment calculations', () => {
  it('rounds monetary values to cents', () => {
    expect(money(10.005)).toBe(10.01);
  });

  it('calculates line totals with discounts', () => {
    expect(
      calculatePaymentItem({
        quantity: 2.5,
        unitPrice: 4,
        discount: 1.25,
      }),
    ).toEqual({
      quantity: 2.5,
      unitPrice: 4,
      discount: 1.25,
      subtotal: 10,
      total: 8.75,
    });
  });

  it('rejects discounts larger than the line subtotal', () => {
    expect(() =>
      calculatePaymentItem({
        quantity: 1,
        unitPrice: 5,
        discount: 6,
      }),
    ).toThrow();
  });

  it('derives pending, partial and paid statuses', () => {
    expect(paymentStatus(20, 0)).toBe(PaymentStatus.PENDING);
    expect(paymentStatus(20, 5)).toBe(PaymentStatus.PARTIAL);
    expect(paymentStatus(20, 20)).toBe(PaymentStatus.PAID);
  });
});

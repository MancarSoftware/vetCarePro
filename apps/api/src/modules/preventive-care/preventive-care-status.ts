import type { PreventiveCareStatus } from '../../generated/prisma/enums';

export const UPCOMING_CARE_DAYS = 30;

export function startOfUtcDay(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function todayDateOnly(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

export function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function parseDateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

export function getPreventiveCareStatus(
  nextDueDate: Date | null,
  now = new Date(),
): PreventiveCareStatus {
  if (!nextDueDate) return 'APPLIED';
  const today = todayDateOnly(now);
  const due = startOfUtcDay(nextDueDate);
  if (due < today) return 'OVERDUE';
  if (due.getTime() === today.getTime()) return 'PENDING';
  if (due <= addUtcDays(today, UPCOMING_CARE_DAYS)) return 'UPCOMING';
  return 'APPLIED';
}

export function daysUntil(nextDueDate: Date | null, now = new Date()) {
  if (!nextDueDate) return null;
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.round(
    (startOfUtcDay(nextDueDate).getTime() - todayDateOnly(now).getTime()) /
      millisecondsPerDay,
  );
}

export function preventiveStatusWhere(
  status: PreventiveCareStatus | undefined,
  now = new Date(),
) {
  if (!status) return {};
  const today = todayDateOnly(now);
  const tomorrow = addUtcDays(today, 1);
  const upcomingLimit = addUtcDays(today, UPCOMING_CARE_DAYS);

  if (status === 'OVERDUE') {
    return { nextDueDate: { lt: today } };
  }
  if (status === 'PENDING') {
    return { nextDueDate: { gte: today, lt: tomorrow } };
  }
  if (status === 'UPCOMING') {
    return { nextDueDate: { gte: tomorrow, lte: upcomingLimit } };
  }
  return {
    OR: [{ nextDueDate: null }, { nextDueDate: { gt: upcomingLimit } }],
  };
}

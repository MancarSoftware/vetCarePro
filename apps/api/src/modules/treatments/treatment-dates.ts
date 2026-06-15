import { BadRequestException } from '@nestjs/common';
import { addUtcDays, parseDateOnly } from '../preventive-care/preventive-care-status';

const DAY_MS = 24 * 60 * 60_000;

export function normalizeTreatmentDates(input: {
  startDate: string;
  endDate?: string | null;
  durationDays?: number | null;
}) {
  const startDate = parseDateOnly(input.startDate);
  let endDate = input.endDate ? parseDateOnly(input.endDate) : null;
  let durationDays = input.durationDays ?? null;

  if (endDate && endDate < startDate) {
    throw new BadRequestException(
      'La fecha de finalización no puede ser anterior al inicio',
    );
  }
  if (endDate) {
    const calculated = Math.round(
      (endDate.getTime() - startDate.getTime()) / DAY_MS,
    ) + 1;
    if (durationDays && durationDays !== calculated) {
      throw new BadRequestException(
        'La duración no coincide con las fechas del tratamiento',
      );
    }
    durationDays = calculated;
  } else if (durationDays) {
    endDate = addUtcDays(startDate, durationDays - 1);
  }

  return { startDate, endDate, durationDays };
}

export function validateEvolutionDates(input: {
  treatmentStartDate: Date;
  occurredAt: Date;
  nextReviewAt?: Date | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (input.occurredAt.getTime() > now.getTime() + 5 * 60_000) {
    throw new BadRequestException(
      'La fecha del seguimiento no puede estar en el futuro',
    );
  }
  if (
    input.occurredAt.getTime() <
    input.treatmentStartDate.getTime()
  ) {
    throw new BadRequestException(
      'El seguimiento no puede ser anterior al inicio del tratamiento',
    );
  }
  if (
    input.nextReviewAt &&
    input.nextReviewAt <= input.occurredAt
  ) {
    throw new BadRequestException(
      'La próxima revisión debe ser posterior al seguimiento',
    );
  }
}

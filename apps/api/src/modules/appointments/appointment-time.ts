import { BadRequestException } from '@nestjs/common';

const MIN_DURATION_MS = 10 * 60_000;
const MAX_DURATION_MS = 12 * 60 * 60_000;
const PAST_TOLERANCE_MS = 5 * 60_000;

export function validateAppointmentWindow(
  startsAt: Date,
  endsAt: Date,
  options: { allowPast?: boolean; now?: Date } = {},
): void {
  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime())
  ) {
    throw new BadRequestException('El horario de la cita no es válido');
  }
  if (endsAt <= startsAt) {
    throw new BadRequestException(
      'La hora de finalización debe ser posterior al inicio',
    );
  }

  const duration = endsAt.getTime() - startsAt.getTime();
  if (duration < MIN_DURATION_MS) {
    throw new BadRequestException(
      'La cita debe tener una duración mínima de 10 minutos',
    );
  }
  if (duration > MAX_DURATION_MS) {
    throw new BadRequestException(
      'La cita no puede durar más de 12 horas',
    );
  }

  const now = options.now ?? new Date();
  if (
    !options.allowPast &&
    startsAt.getTime() < now.getTime() - PAST_TOLERANCE_MS
  ) {
    throw new BadRequestException(
      'No se puede crear una cita en una fecha pasada',
    );
  }
}

export function validateAppointmentRange(
  dateFrom?: string,
  dateTo?: string,
): { from?: Date; to?: Date } {
  const from = dateFrom ? new Date(dateFrom) : undefined;
  const to = dateTo ? new Date(dateTo) : undefined;
  if (from && to && to <= from) {
    throw new BadRequestException(
      'La fecha final del filtro debe ser posterior a la inicial',
    );
  }
  return { from, to };
}

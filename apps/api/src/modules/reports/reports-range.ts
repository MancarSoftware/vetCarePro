export interface ReportRangeInput {
  dateFrom?: string;
  dateTo?: string;
}

export interface ReportRange {
  from: Date;
  to: Date;
  labelFrom: string;
  labelTo: string;
}

export function buildReportRange(
  input: ReportRangeInput,
  now = new Date(),
): ReportRange {
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultTo = endOfLocalDay(now);
  const from = input.dateFrom
    ? startOfLocalDay(parseDateInput(input.dateFrom))
    : startOfLocalDay(defaultFrom);
  const to = input.dateTo
    ? endOfLocalDay(parseDateInput(input.dateTo))
    : defaultTo;

  if (from.getTime() > to.getTime()) {
    throw new Error('La fecha inicial no puede ser mayor que la fecha final');
  }

  return {
    from,
    to,
    labelFrom: dateLabel(from),
    labelTo: dateLabel(to),
  };
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfLocalDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

export function addLocalDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function parseDateInput(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00`);
}

function dateLabel(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

import { buildReportRange } from './reports-range';

describe('buildReportRange', () => {
  it('uses the current month as the default report range', () => {
    const range = buildReportRange({}, new Date('2026-06-15T14:30:00'));

    expect(range.labelFrom).toBe('2026-06-01');
    expect(range.labelTo).toBe('2026-06-15');
    expect(range.from.getHours()).toBe(0);
    expect(range.to.getHours()).toBe(23);
    expect(range.to.getMinutes()).toBe(59);
  });

  it('accepts explicit date-only boundaries', () => {
    const range = buildReportRange({
      dateFrom: '2026-05-10',
      dateTo: '2026-05-20',
    });

    expect(range.labelFrom).toBe('2026-05-10');
    expect(range.labelTo).toBe('2026-05-20');
  });

  it('rejects inverted ranges', () => {
    expect(() =>
      buildReportRange({
        dateFrom: '2026-06-20',
        dateTo: '2026-06-10',
      }),
    ).toThrow('La fecha inicial no puede ser mayor');
  });
});

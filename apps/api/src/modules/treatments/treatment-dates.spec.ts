import { BadRequestException } from '@nestjs/common';
import {
  normalizeTreatmentDates,
  validateEvolutionDates,
} from './treatment-dates';

describe('treatment date rules', () => {
  it('calculates an end date from duration', () => {
    const result = normalizeTreatmentDates({
      startDate: '2026-06-14',
      durationDays: 5,
    });
    expect(result.endDate?.toISOString().slice(0, 10)).toBe('2026-06-18');
  });

  it('calculates duration from dates', () => {
    const result = normalizeTreatmentDates({
      startDate: '2026-06-14',
      endDate: '2026-06-20',
    });
    expect(result.durationDays).toBe(7);
  });

  it('rejects inconsistent duration and dates', () => {
    expect(() =>
      normalizeTreatmentDates({
        startDate: '2026-06-14',
        endDate: '2026-06-20',
        durationDays: 4,
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects evolution before treatment start', () => {
    expect(() =>
      validateEvolutionDates({
        treatmentStartDate: new Date('2026-06-14T00:00:00.000Z'),
        occurredAt: new Date('2026-06-13T20:00:00.000Z'),
        now: new Date('2026-06-15T00:00:00.000Z'),
      }),
    ).toThrow('anterior al inicio');
  });

  it('rejects a review before the evolution', () => {
    expect(() =>
      validateEvolutionDates({
        treatmentStartDate: new Date('2026-06-14T00:00:00.000Z'),
        occurredAt: new Date('2026-06-14T10:00:00.000Z'),
        nextReviewAt: new Date('2026-06-14T09:00:00.000Z'),
        now: new Date('2026-06-15T00:00:00.000Z'),
      }),
    ).toThrow('próxima revisión');
  });
});

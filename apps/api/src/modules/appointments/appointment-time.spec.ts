import { BadRequestException } from '@nestjs/common';
import {
  validateAppointmentRange,
  validateAppointmentWindow,
} from './appointment-time';

describe('appointment time validation', () => {
  const now = new Date('2026-06-14T12:00:00.000Z');

  it('accepts a valid future appointment', () => {
    expect(() =>
      validateAppointmentWindow(
        new Date('2026-06-14T13:00:00.000Z'),
        new Date('2026-06-14T13:30:00.000Z'),
        { now },
      ),
    ).not.toThrow();
  });

  it('rejects an end before the start', () => {
    expect(() =>
      validateAppointmentWindow(
        new Date('2026-06-14T13:00:00.000Z'),
        new Date('2026-06-14T12:30:00.000Z'),
        { now },
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects appointments shorter than ten minutes', () => {
    expect(() =>
      validateAppointmentWindow(
        new Date('2026-06-14T13:00:00.000Z'),
        new Date('2026-06-14T13:05:00.000Z'),
        { now },
      ),
    ).toThrow('duración mínima');
  });

  it('rejects new appointments in the past', () => {
    expect(() =>
      validateAppointmentWindow(
        new Date('2026-06-14T10:00:00.000Z'),
        new Date('2026-06-14T10:30:00.000Z'),
        { now },
      ),
    ).toThrow('fecha pasada');
  });

  it('rejects an inverted filter range', () => {
    expect(() =>
      validateAppointmentRange(
        '2026-06-15T00:00:00.000Z',
        '2026-06-14T00:00:00.000Z',
      ),
    ).toThrow(BadRequestException);
  });
});

import {
  getPreventiveCareStatus,
  parseDateOnly,
} from './preventive-care-status';

describe('preventive care status', () => {
  const now = new Date('2026-06-14T15:00:00.000Z');

  it('marks a past dose as overdue', () => {
    expect(
      getPreventiveCareStatus(parseDateOnly('2026-06-13'), now),
    ).toBe('OVERDUE');
  });

  it('marks a dose due today as pending', () => {
    expect(
      getPreventiveCareStatus(parseDateOnly('2026-06-14'), now),
    ).toBe('PENDING');
  });

  it('marks the next 30 days as upcoming', () => {
    expect(
      getPreventiveCareStatus(parseDateOnly('2026-07-14'), now),
    ).toBe('UPCOMING');
  });

  it('keeps distant or unscheduled doses applied', () => {
    expect(
      getPreventiveCareStatus(parseDateOnly('2026-07-15'), now),
    ).toBe('APPLIED');
    expect(getPreventiveCareStatus(null, now)).toBe('APPLIED');
  });
});

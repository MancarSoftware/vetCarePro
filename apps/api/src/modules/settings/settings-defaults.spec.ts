import {
  defaultClinicSettings,
  defaultSystemPreferences,
  mergeClinicSettings,
  mergeSystemPreferences,
} from './settings-defaults';

describe('settings defaults', () => {
  it('fills missing clinic fields without dropping stored values', () => {
    expect(mergeClinicSettings({ name: 'Vet Norte' })).toEqual({
      ...defaultClinicSettings,
      name: 'Vet Norte',
    });
  });

  it('fills missing preference fields without dropping stored values', () => {
    expect(mergeSystemPreferences({ backupReminderDays: 14 })).toEqual({
      ...defaultSystemPreferences,
      backupReminderDays: 14,
    });
  });
});

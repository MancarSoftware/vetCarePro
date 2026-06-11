import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes and verifies a password without storing it in plain text', async () => {
    const password = 'VetCareSecure2026!';
    const hash = await service.hash(password);

    expect(hash).not.toBe(password);
    expect(await service.verify(password, hash)).toBe(true);
    expect(await service.verify('incorrect-password', hash)).toBe(false);
  });
});


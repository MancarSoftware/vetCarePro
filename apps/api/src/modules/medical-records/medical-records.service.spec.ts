import { BadRequestException } from '@nestjs/common';
import { MedicalRecordsService } from './medical-records.service';

describe('MedicalRecordsService', () => {
  const prisma = {
    pet: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const service = new MedicalRecordsService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.pet.findFirst.mockResolvedValue({ id: 'pet-id' });
  });

  it('rejects an entry without clinical content', async () => {
    await expect(
      service.create('actor-id', {
        petId: 'pet-id',
        type: 'CONSULTATION',
        occurredAt: new Date().toISOString(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an attention date in the future', async () => {
    const future = new Date(Date.now() + 60 * 60_000).toISOString();

    await expect(
      service.create('actor-id', {
        petId: 'pet-id',
        type: 'CONSULTATION',
        occurredAt: future,
        complaint: 'Control general',
      }),
    ).rejects.toThrow('La fecha de atención no puede estar en el futuro');
  });

  it('rejects a review scheduled before the attention', async () => {
    const occurredAt = new Date();
    const nextReviewAt = new Date(occurredAt.getTime() - 60_000);

    await expect(
      service.create('actor-id', {
        petId: 'pet-id',
        type: 'FOLLOW_UP',
        occurredAt: occurredAt.toISOString(),
        complaint: 'Seguimiento',
        nextReviewAt: nextReviewAt.toISOString(),
      }),
    ).rejects.toThrow(
      'La próxima revisión debe ser posterior a la atención',
    );
  });
});

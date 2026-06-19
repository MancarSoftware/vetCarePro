import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS } from '../auth/authorization.constants';
import { GlobalSearchQueryDto } from './dto/global-search-query.dto';

type SearchTargetPage =
  | 'pets'
  | 'owners'
  | 'appointments'
  | 'history'
  | 'media'
  | 'preventive'
  | 'treatments'
  | 'payments'
  | 'inventory';

export interface SearchResult {
  id: string;
  type:
    | 'pet'
    | 'owner'
    | 'appointment'
    | 'medical-record'
    | 'media'
    | 'vaccine'
    | 'treatment'
    | 'payment'
    | 'inventory';
  title: string;
  subtitle: string;
  description: string | null;
  target: {
    page: SearchTargetPage;
    petId?: string;
    ownerId?: string;
    recordId?: string;
    appointmentId?: string;
    treatmentId?: string;
    mediaId?: string;
    paymentId?: string;
    productId?: string;
  };
}

@Injectable()
export class GlobalSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(user: AuthenticatedUser, query: GlobalSearchQueryDto) {
    const term = query.q.trim();
    if (term.length < 2) {
      return { query: term, items: [] };
    }

    const permissions = new Set(user.permissions);
    const perGroupLimit = Math.max(3, Math.ceil(query.limit / 6));
    const groups = await Promise.all([
      permissions.has(PERMISSIONS.PETS_READ)
        ? this.searchPets(term, perGroupLimit)
        : Promise.resolve([]),
      permissions.has(PERMISSIONS.OWNERS_READ)
        ? this.searchOwners(term, perGroupLimit)
        : Promise.resolve([]),
      permissions.has(PERMISSIONS.APPOINTMENTS_READ)
        ? this.searchAppointments(term, perGroupLimit)
        : Promise.resolve([]),
      permissions.has(PERMISSIONS.MEDICAL_READ)
        ? this.searchMedical(term, perGroupLimit)
        : Promise.resolve([]),
      permissions.has(PERMISSIONS.VACCINES_READ)
        ? this.searchVaccines(term, perGroupLimit)
        : Promise.resolve([]),
      permissions.has(PERMISSIONS.TREATMENTS_READ)
        ? this.searchTreatments(term, perGroupLimit)
        : Promise.resolve([]),
      permissions.has(PERMISSIONS.PAYMENTS_READ)
        ? this.searchPayments(term, perGroupLimit)
        : Promise.resolve([]),
      permissions.has(PERMISSIONS.INVENTORY_READ)
        ? this.searchInventory(term, perGroupLimit)
        : Promise.resolve([]),
      permissions.has(PERMISSIONS.MEDICAL_READ)
        ? this.searchMedia(term, perGroupLimit)
        : Promise.resolve([]),
    ]);

    const items = groups.flat().slice(0, query.limit);
    return { query: term, items };
  }

  private searchPets(term: string, take: number): Promise<SearchResult[]> {
    return this.prisma.pet
      .findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { species: { contains: term, mode: 'insensitive' } },
            { breed: { contains: term, mode: 'insensitive' } },
            { owner: { firstName: { contains: term, mode: 'insensitive' } } },
            { owner: { lastName: { contains: term, mode: 'insensitive' } } },
            { owner: { phone: { contains: term, mode: 'insensitive' } } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take,
        select: {
          id: true,
          name: true,
          species: true,
          breed: true,
          owner: { select: { firstName: true, lastName: true, phone: true } },
        },
      })
      .then((pets) =>
        pets.map((pet) => ({
          id: pet.id,
          type: 'pet',
          title: pet.name,
          subtitle: `${pet.species}${pet.breed ? ` - ${pet.breed}` : ''}`,
          description: `${pet.owner.firstName} ${pet.owner.lastName} - ${pet.owner.phone}`,
          target: { page: 'pets', petId: pet.id },
        })),
      );
  }

  private searchOwners(term: string, take: number): Promise<SearchResult[]> {
    return this.prisma.owner
      .findMany({
        where: {
          deletedAt: null,
          OR: [
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
            { nationalId: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            {
              pets: {
                some: {
                  deletedAt: null,
                  name: { contains: term, mode: 'insensitive' },
                },
              },
            },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          _count: { select: { pets: true } },
        },
      })
      .then((owners) =>
        owners.map((owner) => ({
          id: owner.id,
          type: 'owner',
          title: `${owner.firstName} ${owner.lastName}`,
          subtitle: `${owner._count.pets} mascota${owner._count.pets === 1 ? '' : 's'}`,
          description: owner.email ?? owner.phone,
          target: { page: 'owners', ownerId: owner.id },
        })),
      );
  }

  private searchAppointments(term: string, take: number): Promise<SearchResult[]> {
    return this.prisma.appointment
      .findMany({
        where: {
          deletedAt: null,
          OR: [
            { reason: { contains: term, mode: 'insensitive' } },
            { notes: { contains: term, mode: 'insensitive' } },
            { pet: { name: { contains: term, mode: 'insensitive' } } },
            { owner: { firstName: { contains: term, mode: 'insensitive' } } },
            { owner: { lastName: { contains: term, mode: 'insensitive' } } },
          ],
        },
        orderBy: { startsAt: 'desc' },
        take,
        select: {
          id: true,
          petId: true,
          type: true,
          status: true,
          startsAt: true,
          reason: true,
          pet: { select: { name: true } },
        },
      })
      .then((appointments) =>
        appointments.map((appointment) => ({
          id: appointment.id,
          type: 'appointment',
          title: `Cita - ${appointment.pet.name}`,
          subtitle: `${appointment.type} - ${appointment.status}`,
          description: appointment.reason ?? appointment.startsAt.toLocaleString(),
          target: {
            page: 'appointments',
            appointmentId: appointment.id,
            petId: appointment.petId,
          },
        })),
      );
  }

  private searchMedical(term: string, take: number): Promise<SearchResult[]> {
    return this.prisma.medicalRecord
      .findMany({
        where: {
          deletedAt: null,
          OR: [
            { complaint: { contains: term, mode: 'insensitive' } },
            { symptoms: { contains: term, mode: 'insensitive' } },
            { diagnosis: { contains: term, mode: 'insensitive' } },
            { treatmentPlan: { contains: term, mode: 'insensitive' } },
            { pet: { name: { contains: term, mode: 'insensitive' } } },
          ],
        },
        orderBy: { occurredAt: 'desc' },
        take,
        select: {
          id: true,
          petId: true,
          type: true,
          diagnosis: true,
          complaint: true,
          occurredAt: true,
          pet: { select: { name: true } },
        },
      })
      .then((records) =>
        records.map((record) => ({
          id: record.id,
          type: 'medical-record',
          title: `Historial - ${record.pet.name}`,
          subtitle: record.type,
          description: record.diagnosis ?? record.complaint ?? record.occurredAt.toLocaleDateString(),
          target: { page: 'history', recordId: record.id, petId: record.petId },
        })),
      );
  }

  private searchVaccines(term: string, take: number): Promise<SearchResult[]> {
    return this.prisma.vaccine
      .findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { manufacturer: { contains: term, mode: 'insensitive' } },
            { batchNumber: { contains: term, mode: 'insensitive' } },
            { pet: { name: { contains: term, mode: 'insensitive' } } },
          ],
        },
        orderBy: [{ nextDueDate: 'asc' }, { appliedAt: 'desc' }],
        take,
        select: {
          id: true,
          petId: true,
          name: true,
          status: true,
          nextDueDate: true,
          pet: { select: { name: true } },
        },
      })
      .then((vaccines) =>
        vaccines.map((vaccine) => ({
          id: vaccine.id,
          type: 'vaccine',
          title: vaccine.name,
          subtitle: `Vacuna - ${vaccine.pet.name}`,
          description: vaccine.nextDueDate
            ? `Vence: ${vaccine.nextDueDate.toLocaleDateString()}`
            : vaccine.status,
          target: { page: 'preventive', petId: vaccine.petId, recordId: vaccine.id },
        })),
      );
  }

  private searchTreatments(term: string, take: number): Promise<SearchResult[]> {
    return this.prisma.treatment
      .findMany({
        where: {
          deletedAt: null,
          OR: [
            { diagnosis: { contains: term, mode: 'insensitive' } },
            { instructions: { contains: term, mode: 'insensitive' } },
            { dosage: { contains: term, mode: 'insensitive' } },
            { pet: { name: { contains: term, mode: 'insensitive' } } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take,
        select: {
          id: true,
          petId: true,
          diagnosis: true,
          status: true,
          pet: { select: { name: true } },
        },
      })
      .then((treatments) =>
        treatments.map((treatment) => ({
          id: treatment.id,
          type: 'treatment',
          title: treatment.diagnosis,
          subtitle: `Tratamiento - ${treatment.pet.name}`,
          description: treatment.status,
          target: {
            page: 'treatments',
            treatmentId: treatment.id,
            petId: treatment.petId,
          },
        })),
      );
  }

  private searchPayments(term: string, take: number): Promise<SearchResult[]> {
    return this.prisma.payment
      .findMany({
        where: {
          deletedAt: null,
          OR: [
            { invoiceNumber: { contains: term, mode: 'insensitive' } },
            { reference: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
            { owner: { firstName: { contains: term, mode: 'insensitive' } } },
            { owner: { lastName: { contains: term, mode: 'insensitive' } } },
            { pet: { name: { contains: term, mode: 'insensitive' } } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          invoiceNumber: true,
          description: true,
          status: true,
          amount: true,
          owner: { select: { firstName: true, lastName: true } },
        },
      })
      .then((payments) =>
        payments.map((payment) => ({
          id: payment.id,
          type: 'payment',
          title: payment.invoiceNumber,
          subtitle: `${payment.owner.firstName} ${payment.owner.lastName}`,
          description: `${payment.status} - $${payment.amount.toNumber().toFixed(2)}`,
          target: { page: 'payments', paymentId: payment.id },
        })),
      );
  }

  private searchInventory(term: string, take: number): Promise<SearchResult[]> {
    return this.prisma.inventoryProduct
      .findMany({
        where: {
          deletedAt: null,
          isActive: true,
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { sku: { contains: term, mode: 'insensitive' } },
            { category: { contains: term, mode: 'insensitive' } },
            { supplier: { contains: term, mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take,
        select: {
          id: true,
          sku: true,
          name: true,
          category: true,
          currentStock: true,
          minimumStock: true,
          unit: true,
        },
      })
      .then((products) =>
        products.map((product) => ({
          id: product.id,
          type: 'inventory',
          title: product.name,
          subtitle: product.category,
          description: `Stock: ${product.currentStock.toNumber()} ${product.unit}`,
          target: { page: 'inventory', productId: product.id },
        })),
      );
  }

  private searchMedia(term: string, take: number): Promise<SearchResult[]> {
    return this.prisma.mediaFile
      .findMany({
        where: {
          deletedAt: null,
          OR: [
            { originalName: { contains: term, mode: 'insensitive' } },
            { tags: { has: term.toLowerCase() } },
            { pet: { name: { contains: term, mode: 'insensitive' } } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          petId: true,
          medicalRecordId: true,
          treatmentId: true,
          originalName: true,
          category: true,
          pet: { select: { name: true } },
        },
      })
      .then((files) =>
        files.map((file) => ({
          id: file.id,
          type: 'media',
          title: file.originalName,
          subtitle: `Archivo - ${file.pet.name}`,
          description: file.category,
          target: {
            page: 'media',
            mediaId: file.id,
            petId: file.petId,
            recordId: file.medicalRecordId ?? undefined,
            treatmentId: file.treatmentId ?? undefined,
          },
        })),
      );
  }
}

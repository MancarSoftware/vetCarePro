export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type PetSex = 'MALE' | 'FEMALE' | 'UNKNOWN';
export type PetStatus = 'ACTIVE' | 'INACTIVE' | 'DECEASED';

export interface OwnerPetSummary {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  status: PetStatus;
}

export interface Owner {
  id: string;
  firstName: string;
  lastName: string;
  nationalId: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  registeredAt: string;
  createdAt: string;
  updatedAt: string;
  pets: OwnerPetSummary[];
  _count: { pets: number };
}

export interface PetOwner {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface Pet {
  id: string;
  ownerId: string;
  name: string;
  species: string;
  breed: string | null;
  sex: PetSex;
  birthDate: string | null;
  approximateAgeMonths: number | null;
  weightKg: number | null;
  color: string | null;
  photoPath: string | null;
  status: PetStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  owner: PetOwner;
}

export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type AppointmentType =
  | 'GENERAL_CONSULTATION'
  | 'VACCINATION'
  | 'FOLLOW_UP'
  | 'SURGERY'
  | 'GROOMING'
  | 'EMERGENCY'
  | 'DEWORMING'
  | 'OTHER';

export interface AppointmentVeterinarian {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

export interface Appointment {
  id: string;
  petId: string;
  ownerId: string;
  veterinarianId: string | null;
  type: AppointmentType;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  pet: {
    id: string;
    name: string;
    species: string;
    breed: string | null;
    photoPath: string | null;
    owner: PetOwner;
  };
  veterinarian: AppointmentVeterinarian | null;
  _count: {
    medicalRecords: number;
    payments: number;
  };
}

export type MedicalRecordType =
  | 'CONSULTATION'
  | 'VACCINATION'
  | 'TREATMENT'
  | 'FOLLOW_UP'
  | 'SURGERY'
  | 'LAB_RESULT'
  | 'OTHER';

export interface Medication {
  name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
}

export interface MedicalRecord {
  id: string;
  petId: string;
  veterinarianId: string;
  type: MedicalRecordType;
  occurredAt: string;
  complaint: string | null;
  symptoms: string | null;
  diagnosis: string | null;
  treatmentPlan: string | null;
  medications: Medication[] | null;
  notes: string | null;
  nextReviewAt: string | null;
  createdAt: string;
  updatedAt: string;
  pet: {
    id: string;
    name: string;
    species: string;
    breed: string | null;
    status: PetStatus;
    owner: PetOwner;
  };
  veterinarian: {
    id: string;
    firstName: string;
    lastName: string;
  };
  _count: {
    treatments: number;
    vaccines: number;
    dewormings: number;
    mediaFiles: number;
  };
}

export type MediaCategory =
  | 'PET_PROFILE'
  | 'WOUND'
  | 'RADIOGRAPH'
  | 'DOCUMENT'
  | 'PRESCRIPTION'
  | 'EVOLUTION'
  | 'OTHER';

export interface ClinicalMediaFile {
  id: string;
  petId: string;
  medicalRecordId: string | null;
  treatmentId: string | null;
  uploadedById: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  category: MediaCategory;
  tags: string[];
  createdAt: string;
  deletedAt: string | null;
  contentUrl: string;
  pet: {
    id: string;
    name: string;
    species: string;
    breed: string | null;
  };
  medicalRecord: {
    id: string;
    type: MedicalRecordType;
    complaint: string | null;
    occurredAt: string;
  } | null;
  uploadedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export type PreventiveCareStatus =
  | 'APPLIED'
  | 'PENDING'
  | 'OVERDUE'
  | 'UPCOMING';

export interface PreventiveCareSummary {
  vaccinesTotal: number;
  dewormingsTotal: number;
  applied: number;
  pending: number;
  upcoming: number;
  overdue: number;
}

interface PreventiveCareBase {
  id: string;
  petId: string;
  medicalRecordId: string | null;
  veterinarianId: string;
  appliedAt: string;
  nextDueDate: string | null;
  status: PreventiveCareStatus;
  daysRemaining: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  pet: {
    id: string;
    name: string;
    species: string;
    breed: string | null;
    owner: PetOwner;
  };
  medicalRecord: {
    id: string;
    type: MedicalRecordType;
    complaint: string | null;
    occurredAt: string;
  } | null;
  veterinarian: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface VaccineRecord extends PreventiveCareBase {
  name: string;
  manufacturer: string | null;
  batchNumber: string | null;
}

export interface DewormingRecord extends PreventiveCareBase {
  medication: string;
  weightKg: number | null;
  dosage: string | null;
}

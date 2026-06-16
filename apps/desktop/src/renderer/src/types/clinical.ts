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
  treatment: {
    id: string;
    diagnosis: string;
    startDate: string;
    status: TreatmentStatus;
  } | null;
  uploadedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export type TreatmentStatus =
  | 'ACTIVE'
  | 'COMPLETED'
  | 'SUSPENDED'
  | 'FOLLOW_UP';

export type TreatmentEvolutionStatus =
  | 'IMPROVING'
  | 'STABLE'
  | 'WORSENING'
  | 'RECOVERED';

export interface TreatmentEvolution {
  id: string;
  treatmentId: string;
  createdById: string;
  status: TreatmentEvolutionStatus;
  title: string | null;
  notes: string;
  weightKg: number | null;
  occurredAt: string;
  nextReviewAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface TreatmentMedia {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  category: MediaCategory;
  tags: string[];
  createdAt: string;
  contentUrl: string;
}

export interface Treatment {
  id: string;
  petId: string;
  medicalRecordId: string | null;
  veterinarianId: string;
  diagnosis: string;
  instructions: string;
  medications: Medication[] | null;
  dosage: string | null;
  frequency: string | null;
  durationDays: number | null;
  startDate: string;
  endDate: string | null;
  status: TreatmentStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  pet: {
    id: string;
    name: string;
    species: string;
    breed: string | null;
    weightKg: number | null;
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
  evolutions: TreatmentEvolution[];
  mediaFiles?: TreatmentMedia[];
  _count: {
    evolutions: number;
    mediaFiles: number;
  };
}

export interface TreatmentSummary {
  total: number;
  active: number;
  followUp: number;
  completed: number;
  suspended: number;
  overdue: number;
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

export type InventoryMovementType =
  | 'PURCHASE'
  | 'SALE'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'CLINICAL_USE'
  | 'RETURN'
  | 'EXPIRED';

export type InventoryStockStatus =
  | 'AVAILABLE'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK';

export interface InventoryBatch {
  id: string;
  productId?: string;
  batchNumber: string | null;
  initialQuantity?: number;
  currentQuantity: number;
  unitCost?: number | null;
  expirationDate: string | null;
  receivedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  batchId: string | null;
  performedById: string;
  type: InventoryMovementType;
  quantity: number;
  unitCost: number | null;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  createdAt: string;
  product?: {
    id: string;
    name: string;
    unit: string;
  };
  batch: {
    id: string;
    batchNumber: string | null;
    expirationDate: string | null;
  } | null;
  performedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface InventoryProduct {
  id: string;
  sku: string | null;
  name: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  unit: string;
  purchasePrice: number | null;
  salePrice: number | null;
  expirationDate: string | null;
  supplier: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stockStatus?: InventoryStockStatus;
  nextExpiration?: string | null;
  expiringSoon?: boolean;
  batches: InventoryBatch[];
  movements?: InventoryMovement[];
  _count: {
    movements: number;
    batches: number;
  };
}

export interface InventorySummary {
  totalProducts: number;
  lowStock: number;
  outOfStock: number;
  expiringSoon: number;
  expiredBatches: number;
  inventoryValue: number;
}

export type PaymentMethod =
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'CARD'
  | 'OTHER';

export type PaymentStatus =
  | 'PAID'
  | 'PENDING'
  | 'PARTIAL'
  | 'VOIDED';

export type PaymentItemType = 'SERVICE' | 'PRODUCT' | 'OTHER';

export interface PaymentItem {
  id: string;
  paymentId: string;
  productId: string | null;
  type: PaymentItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  createdAt: string;
  product?: {
    id: string;
    sku: string | null;
    name: string;
    unit: string;
  } | null;
}

export interface PaymentTransaction {
  id: string;
  paymentId: string;
  createdById: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  receivedAt: string;
  createdAt: string;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface Payment {
  id: string;
  ownerId: string;
  petId: string | null;
  appointmentId: string | null;
  createdById: string;
  invoiceNumber: string;
  reference: string | null;
  description: string;
  subtotal: number;
  discount: number;
  amount: number;
  paidAmount: number;
  balance: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: string | null;
  dueAt: string | null;
  voidedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string | null;
    nationalId?: string | null;
  };
  pet: {
    id: string;
    name: string;
    species: string;
    breed: string | null;
  } | null;
  appointment: {
    id: string;
    type: AppointmentType;
    status?: AppointmentStatus;
    startsAt: string;
  } | null;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  items: PaymentItem[];
  transactions?: PaymentTransaction[];
  _count: {
    items: number;
    transactions: number;
  };
}

export interface PaymentSummary {
  totalDocuments: number;
  pendingDocuments: number;
  overdueDocuments: number;
  outstanding: number;
  collectedToday: number;
  collectedMonth: number;
}

export type ReportSection =
  | 'all'
  | 'financial'
  | 'appointments'
  | 'clinical'
  | 'inventory';

export interface ReportsSummary {
  generatedAt: string;
  range: {
    from: string;
    to: string;
  };
  financial: {
    income: number;
    outstanding: number;
    overdueAmount: number;
    paidDocuments: number;
    pendingDocuments: number;
    averageTicket: number;
    incomeByMonth: Array<{ month: string; total: number }>;
  };
  appointments: {
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
    pending: number;
    confirmed: number;
    byType: Array<{ type: AppointmentType; count: number }>;
    byStatus: Array<{ status: AppointmentStatus; count: number }>;
  };
  clinical: {
    medicalRecords: number;
    vaccinesApplied: number;
    vaccinesPending: number;
    vaccinesOverdue: number;
    dewormingsApplied: number;
    dewormingsPending: number;
    dewormingsOverdue: number;
    treatmentsActive: number;
    treatmentsFollowUp: number;
    treatmentsCompleted: number;
  };
  inventory: {
    lowStock: number;
    outOfStock: number;
    expiringSoon: number;
    inventoryValue: number;
    productsSold: Array<{
      productId: string | null;
      name: string;
      quantity: number;
      total: number;
    }>;
  };
  clients: {
    ownersRegistered: number;
    petsRegistered: number;
  };
}

export type BackupStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface BackupRecord {
  id: string;
  status: BackupStatus;
  databasePath: string | null;
  filesPath: string | null;
  sizeBytes: number | null;
  errorMessage: string | null;
  createdById: string | null;
  createdAt: string;
  completedAt: string | null;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface BackupSummary {
  backupPath: string;
  uploadsPath: string;
  totalBackups: number;
  completed: number;
  failed: number;
  pending: number;
  totalSizeBytes: number;
  lastCompleted: BackupRecord | null;
}

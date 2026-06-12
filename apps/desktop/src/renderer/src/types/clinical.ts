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

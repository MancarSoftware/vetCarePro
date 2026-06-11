export interface DashboardMetrics {
  registeredPets: number;
  appointmentsToday: number;
  pendingVaccines: number;
  monthlyIncome: number;
}

export interface DashboardPet {
  id: string;
  name: string;
  species?: string;
  breed: string | null;
  photoPath: string | null;
}

export interface AgendaItem {
  id: string;
  startsAt: string;
  type: string;
  status: string;
  pet: DashboardPet;
}

export interface UpcomingVaccine {
  id: string;
  name: string;
  nextDueDate: string | null;
  daysRemaining: number | null;
  pet: Omit<DashboardPet, 'species'>;
}

export interface LowStockProduct {
  id: string;
  name: string;
  currentStock: number;
  minimumStock: number;
  unit: string;
}

export interface RecentPatient extends DashboardPet {
  sex: string;
  birthDate: string | null;
  approximateAgeMonths: number | null;
}

export interface ActiveTreatment {
  id: string;
  diagnosis: string;
  instructions: string;
  startDate: string;
  endDate: string | null;
  status: string;
  pet: Omit<DashboardPet, 'species'>;
}

export interface IncomePoint {
  month: string;
  total: number;
}

export interface DashboardSummary {
  generatedAt: string;
  metrics: DashboardMetrics;
  agendaToday: AgendaItem[];
  upcomingVaccines: UpcomingVaccine[];
  lowStock: LowStockProduct[];
  recentPatients: RecentPatient[];
  activeTreatments: ActiveTreatment[];
  incomeLastSixMonths: IncomePoint[];
}


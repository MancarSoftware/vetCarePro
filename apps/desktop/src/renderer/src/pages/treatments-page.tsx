import {
  ClinicalConfirmDialog,
  ClinicalField,
  clinicalInputClass,
  ClinicalMetric,
  ClinicalModalHeader,
} from '@/components/clinical/clinical-ui';
import {
  emptyTreatmentForm,
  TreatmentFormModal,
  treatmentToForm,
  type TreatmentFormState,
} from '@/components/treatments/treatment-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type {
  PaginatedResponse,
  Pet,
  Treatment,
  TreatmentEvolutionStatus,
  TreatmentStatus,
  TreatmentSummary,
} from '@/types/clinical';
import {
  differenceInCalendarDays,
  format,
  formatDistanceToNow,
  isBefore,
  startOfDay,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CirclePause,
  Dog,
  FileHeart,
  HeartPulse,
  History,
  ImagePlus,
  Images,
  LoaderCircle,
  Pencil,
  Pill,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  Trash2,
  TrendingUp,
  UserRound,
  Weight,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';

interface TreatmentsPageProps {
  initialPetId?: string;
  initialMedicalRecordId?: string;
  onOpenHistory?: (petId: string) => void;
  onOpenMedia?: (petId: string, treatmentId: string) => void;
}

interface StatusPresentation {
  label: string;
  badge: string;
  accent: string;
  icon: LucideIcon;
}

const statusPresentation: Record<TreatmentStatus, StatusPresentation> = {
  ACTIVE: {
    label: 'Activo',
    badge: 'bg-emerald-50 text-emerald-700',
    accent: 'from-emerald-500 to-teal-500',
    icon: HeartPulse,
  },
  FOLLOW_UP: {
    label: 'En control',
    badge: 'bg-blue-50 text-blue-700',
    accent: 'from-blue-500 to-cyan-500',
    icon: Activity,
  },
  COMPLETED: {
    label: 'Finalizado',
    badge: 'bg-slate-100 text-slate-600',
    accent: 'from-slate-400 to-slate-500',
    icon: CheckCircle2,
  },
  SUSPENDED: {
    label: 'Suspendido',
    badge: 'bg-amber-50 text-amber-700',
    accent: 'from-amber-400 to-orange-500',
    icon: CirclePause,
  },
};

const evolutionPresentation: Record<
  TreatmentEvolutionStatus,
  { label: string; className: string; icon: LucideIcon }
> = {
  IMPROVING: {
    label: 'Mejorando',
    className: 'bg-emerald-100 text-emerald-700',
    icon: TrendingUp,
  },
  STABLE: {
    label: 'Estable',
    className: 'bg-blue-100 text-blue-700',
    icon: Activity,
  },
  WORSENING: {
    label: 'Empeorando',
    className: 'bg-rose-100 text-rose-700',
    icon: AlertTriangle,
  },
  RECOVERED: {
    label: 'Recuperado',
    className: 'bg-teal-100 text-teal-700',
    icon: ShieldCheck,
  },
};

const emptySummary: TreatmentSummary = {
  total: 0,
  active: 0,
  followUp: 0,
  completed: 0,
  suspended: 0,
  overdue: 0,
};

export function TreatmentsPage({
  initialPetId,
  initialMedicalRecordId,
  onOpenHistory,
  onOpenMedia,
}: TreatmentsPageProps) {
  const { request, user } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [items, setItems] = useState<Treatment[]>([]);
  const [summary, setSummary] = useState(emptySummary);
  const [selectedPetId, setSelectedPetId] = useState(initialPetId ?? '');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTreatment, setEditingTreatment] =
    useState<Treatment | null>(null);
  const [detailTreatment, setDetailTreatment] =
    useState<Treatment | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [deletingTreatment, setDeletingTreatment] =
    useState<Treatment | null>(null);
  const canManage =
    user?.permissions.includes('treatments.manage') ?? false;

  const loadPets = useCallback(async () => {
    try {
      const data = await request<PaginatedResponse<Pet>>(
        '/pets?page=1&pageSize=100&status=ACTIVE',
      );
      setPets(data.items);
      if (
        initialPetId &&
        data.items.some((pet) => pet.id === initialPetId)
      ) {
        setSelectedPetId(initialPetId);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No fue posible cargar los pacientes.',
      );
    }
  }, [initialPetId, request]);

  const loadTreatments = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        page: '1',
        pageSize: '100',
        ...(selectedPetId ? { petId: selectedPetId } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      const [treatments, treatmentSummary] = await Promise.all([
        request<PaginatedResponse<Treatment>>(
          `/treatments?${query.toString()}`,
        ),
        request<TreatmentSummary>(
          `/treatments/summary${
            selectedPetId ? `?petId=${selectedPetId}` : ''
          }`,
        ),
      ]);
      setItems(treatments.items);
      setSummary(treatmentSummary);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No fue posible cargar los tratamientos.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [request, search, selectedPetId, statusFilter]);

  useEffect(() => {
    void loadPets();
  }, [loadPets]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTreatments();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [loadTreatments]);

  const openCreate = () => {
    setEditingTreatment(null);
    setIsFormOpen(true);
  };

  const openEdit = (treatment: Treatment) => {
    setEditingTreatment(treatment);
    setIsFormOpen(true);
  };

  const openDetail = async (treatmentId: string) => {
    setIsDetailLoading(true);
    try {
      const treatment = await request<Treatment>(
        `/treatments/${treatmentId}`,
      );
      setDetailTreatment(treatment);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No fue posible abrir el tratamiento.',
      );
    } finally {
      setIsDetailLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (!detailTreatment) return;
    const treatment = await request<Treatment>(
      `/treatments/${detailTreatment.id}`,
    );
    setDetailTreatment(treatment);
  };

  const handleSubmit = async (form: TreatmentFormState) => {
    setIsSubmitting(true);
    setError(null);
    const optional = (value: string) => value.trim() || null;
    const durationDays = form.durationDays
      ? Number(form.durationDays)
      : null;
    const endDate =
      durationDays && form.startDate
        ? format(
            new Date(`${form.startDate}T12:00:00`).setDate(
              new Date(`${form.startDate}T12:00:00`).getDate() +
                durationDays -
                1,
            ),
            'yyyy-MM-dd',
          )
        : null;
    try {
      await request(
        editingTreatment
          ? `/treatments/${editingTreatment.id}`
          : '/treatments',
        {
          method: editingTreatment ? 'PATCH' : 'POST',
          body: {
            ...(!editingTreatment
              ? {
                  petId: form.petId,
                  medicalRecordId: form.medicalRecordId || undefined,
                }
              : {}),
            diagnosis: form.diagnosis.trim(),
            instructions: form.instructions.trim(),
            medications: form.medications.length
              ? form.medications.map((medication) => ({
                  name: medication.name.trim(),
                  dosage: optional(medication.dosage ?? ''),
                  frequency: optional(medication.frequency ?? ''),
                  duration: optional(medication.duration ?? ''),
                }))
              : null,
            dosage: optional(form.dosage),
            frequency: optional(form.frequency),
            durationDays,
            startDate: form.startDate,
            endDate,
            status: form.status,
            notes: optional(form.notes),
          },
        },
      );
      setSelectedPetId(form.petId);
      setIsFormOpen(false);
      setEditingTreatment(null);
      await loadTreatments();
    } catch (submitError) {
      const message =
        submitError instanceof ApiError
          ? submitError.message
          : 'No fue posible guardar el tratamiento.';
      setError(message);
      throw submitError;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (
    treatment: Treatment,
    status: TreatmentStatus,
  ) => {
    setIsSubmitting(true);
    try {
      await request(`/treatments/${treatment.id}`, {
        method: 'PATCH',
        body: { status },
      });
      await loadTreatments();
      if (detailTreatment?.id === treatment.id) {
        await refreshDetail();
      }
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'No fue posible cambiar el estado.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTreatment) return;
    setIsSubmitting(true);
    try {
      await request(`/treatments/${deletingTreatment.id}`, {
        method: 'DELETE',
      });
      setDeletingTreatment(null);
      setDetailTreatment(null);
      await loadTreatments();
    } catch (deleteError) {
      setDeletingTreatment(null);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'No fue posible archivar el tratamiento.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEvolutionCreate = async (input: {
    status: TreatmentEvolutionStatus;
    title: string;
    notes: string;
    weightKg: string;
    occurredAt: string;
    nextReviewAt: string;
  }) => {
    if (!detailTreatment) return;
    setIsSubmitting(true);
    try {
      await request(`/treatments/${detailTreatment.id}/evolutions`, {
        method: 'POST',
        body: {
          status: input.status,
          title: input.title.trim() || null,
          notes: input.notes.trim(),
          weightKg: input.weightKg ? Number(input.weightKg) : null,
          occurredAt: new Date(input.occurredAt).toISOString(),
          nextReviewAt: input.nextReviewAt
            ? new Date(input.nextReviewAt).toISOString()
            : null,
        },
      });
      await Promise.all([refreshDetail(), loadTreatments()]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEvolutionDelete = async (evolutionId: string) => {
    if (!detailTreatment) return;
    setIsSubmitting(true);
    try {
      await request(
        `/treatments/${detailTreatment.id}/evolutions/${evolutionId}`,
        { method: 'DELETE' },
      );
      await Promise.all([refreshDetail(), loadTreatments()]);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'No fue posible archivar el seguimiento.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const initialForm = editingTreatment
    ? treatmentToForm(editingTreatment)
    : emptyTreatmentForm(selectedPetId, initialMedicalRecordId);

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">
            Seguimiento terapéutico
          </p>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-slate-950">
            Tratamientos
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Planes clínicos, medicación y evolución de cada paciente.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={openCreate}
            disabled={pets.length === 0}
            className="h-10 bg-teal-600 px-4 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700"
          >
            <Plus className="size-4" />
            Nuevo tratamiento
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            <X className="size-4" />
          </button>
        </div>
      )}

      <section className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <ClinicalMetric
          icon={HeartPulse}
          color="bg-emerald-50 text-emerald-700"
          value={summary.active}
          label="Tratamientos activos"
        />
        <ClinicalMetric
          icon={Activity}
          color="bg-blue-50 text-blue-700"
          value={summary.followUp}
          label="En control"
        />
        <ClinicalMetric
          icon={CheckCircle2}
          color="bg-slate-100 text-slate-600"
          value={summary.completed}
          label="Finalizados"
        />
        <ClinicalMetric
          icon={AlertTriangle}
          color="bg-amber-50 text-amber-700"
          value={summary.overdue}
          label="Con fecha vencida"
        />
      </section>

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-[1fr_220px_220px] gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar diagnóstico, indicación o paciente..."
              className={`${clinicalInputClass} pl-10`}
            />
          </div>
          <select
            value={selectedPetId}
            onChange={(event) => setSelectedPetId(event.target.value)}
            className={clinicalInputClass}
          >
            <option value="">Todos los pacientes</option>
            {pets.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {pet.name} · {pet.owner.lastName}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={clinicalInputClass}
          >
            <option value="">Todos los estados</option>
            {Object.entries(statusPresentation).map(([status, item]) => (
              <option key={status} value={status}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {isLoading ? (
        <Card className="grid min-h-[420px] place-items-center text-slate-400">
          <LoaderCircle className="size-7 animate-spin" />
        </Card>
      ) : items.length === 0 ? (
        <EmptyTreatments canManage={canManage} onCreate={openCreate} />
      ) : (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {items.map((treatment) => (
            <TreatmentCard
              key={treatment.id}
              treatment={treatment}
              canManage={canManage}
              submitting={isSubmitting}
              onOpen={() => void openDetail(treatment.id)}
              onEdit={() => openEdit(treatment)}
              onDelete={() => setDeletingTreatment(treatment)}
              onStatusChange={(status) =>
                void handleStatusChange(treatment, status)
              }
              onOpenHistory={
                onOpenHistory
                  ? () => onOpenHistory(treatment.petId)
                  : undefined
              }
            />
          ))}
        </section>
      )}

      {isDetailLoading && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/25 backdrop-blur-sm">
          <LoaderCircle className="size-8 animate-spin text-white" />
        </div>
      )}

      {detailTreatment && (
        <TreatmentDetailModal
          treatment={detailTreatment}
          canManage={canManage}
          submitting={isSubmitting}
          onClose={() => setDetailTreatment(null)}
          onEdit={() => {
            setEditingTreatment(detailTreatment);
            setIsFormOpen(true);
          }}
          onStatusChange={(status) =>
            void handleStatusChange(detailTreatment, status)
          }
          onCreateEvolution={handleEvolutionCreate}
          onDeleteEvolution={handleEvolutionDelete}
          onOpenMedia={
            onOpenMedia
              ? () =>
                  onOpenMedia(detailTreatment.petId, detailTreatment.id)
              : undefined
          }
          onOpenHistory={
            onOpenHistory
              ? () => onOpenHistory(detailTreatment.petId)
              : undefined
          }
        />
      )}

      {isFormOpen && (
        <TreatmentFormModal
          key={editingTreatment?.id ?? `new-${selectedPetId}`}
          initialForm={initialForm}
          pets={pets}
          editing={Boolean(editingTreatment)}
          submitting={isSubmitting}
          onClose={() => {
            setIsFormOpen(false);
            setEditingTreatment(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {deletingTreatment && (
        <ClinicalConfirmDialog
          title="Archivar tratamiento"
          message={`El tratamiento de ${deletingTreatment.pet.name} dejará de aparecer en el seguimiento activo. Su entrada en el historial clínico se conservará.`}
          disabled={isSubmitting}
          onCancel={() => setDeletingTreatment(null)}
          onConfirm={() => void handleDelete()}
        />
      )}
    </>
  );
}

function TreatmentCard({
  treatment,
  canManage,
  submitting,
  onOpen,
  onEdit,
  onDelete,
  onStatusChange,
  onOpenHistory,
}: {
  treatment: Treatment;
  canManage: boolean;
  submitting: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: TreatmentStatus) => void;
  onOpenHistory?: () => void;
}) {
  const presentation = statusPresentation[treatment.status];
  const StatusIcon = presentation.icon;
  const progress = treatmentProgress(treatment);
  const overdue =
    Boolean(treatment.endDate) &&
    treatment.status !== 'COMPLETED' &&
    isBefore(
      localDateOnly(treatment.endDate as string),
      startOfDay(new Date()),
    );
  const lastEvolution = treatment.evolutions[0];

  return (
    <Card className="group overflow-hidden">
      <div className={`h-1 bg-gradient-to-r ${presentation.accent}`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-700">
              <Dog className="size-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  {treatment.pet.name}
                </h2>
                <Badge className={presentation.badge}>
                  {presentation.label}
                </Badge>
                {overdue && (
                  <Badge className="bg-rose-50 text-rose-700">Vencido</Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {treatment.pet.breed || treatment.pet.species} ·{' '}
                {treatment.pet.owner.firstName}{' '}
                {treatment.pet.owner.lastName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onOpenHistory && (
              <button
                type="button"
                onClick={onOpenHistory}
                title="Abrir historial"
                className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-violet-50 hover:text-violet-700"
              >
                <History className="size-4" />
              </button>
            )}
            {canManage && (
              <>
                <button
                  type="button"
                  onClick={onEdit}
                  title="Editar tratamiento"
                  className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-700"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  title="Archivar tratamiento"
                  className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            Diagnóstico
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-slate-700">
            {treatment.diagnosis}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(treatment.medications ?? []).slice(0, 3).map((medication, index) => (
            <span
              key={`${medication.name}-${index}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700"
            >
              <Pill className="size-3.5" />
              {medication.name}
            </span>
          ))}
          {(treatment.medications?.length ?? 0) > 3 && (
            <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-500">
              +{(treatment.medications?.length ?? 0) - 3}
            </span>
          )}
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-500">
              {format(localDateOnly(treatment.startDate), 'dd MMM', {
                locale: es,
              })}
              {treatment.endDate
                ? ` - ${format(localDateOnly(treatment.endDate), 'dd MMM', {
                    locale: es,
                  })}`
                : ' · continuo'}
            </span>
            <span className="font-bold text-teal-700">
              {progress === null ? 'Sin fecha límite' : `${progress}%`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${presentation.accent}`}
              style={{ width: `${progress ?? 28}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Activity className="size-3.5" />
              {treatment._count.evolutions} seguimientos
            </span>
            <span className="flex items-center gap-1.5">
              <Images className="size-3.5" />
              {treatment._count.mediaFiles} evidencias
            </span>
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <select
                value={treatment.status}
                disabled={submitting}
                onChange={(event) =>
                  onStatusChange(event.target.value as TreatmentStatus)
                }
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 outline-none focus:border-teal-500"
              >
                {Object.entries(statusPresentation).map(([status, item]) => (
                  <option key={status} value={status}>
                    {item.label}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={onOpen}
              className="flex h-8 items-center gap-1 rounded-lg bg-teal-50 px-3 text-xs font-bold text-teal-700 hover:bg-teal-100"
            >
              Ver evolución
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        {lastEvolution && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-xs text-slate-500">
            <StatusIcon className="size-4 text-teal-600" />
            Último control:{' '}
            <span className="font-semibold text-slate-700">
              {evolutionPresentation[lastEvolution.status].label}
            </span>
            <span className="ml-auto text-slate-400">
              {formatDistanceToNow(new Date(lastEvolution.occurredAt), {
                addSuffix: true,
                locale: es,
              })}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

function TreatmentDetailModal({
  treatment,
  canManage,
  submitting,
  onClose,
  onEdit,
  onStatusChange,
  onCreateEvolution,
  onDeleteEvolution,
  onOpenMedia,
  onOpenHistory,
}: {
  treatment: Treatment;
  canManage: boolean;
  submitting: boolean;
  onClose: () => void;
  onEdit: () => void;
  onStatusChange: (status: TreatmentStatus) => void;
  onCreateEvolution: (input: EvolutionFormState) => Promise<void>;
  onDeleteEvolution: (evolutionId: string) => Promise<void>;
  onOpenMedia?: () => void;
  onOpenHistory?: () => void;
}) {
  const [showEvolutionForm, setShowEvolutionForm] = useState(false);
  const presentation = statusPresentation[treatment.status];
  const timeline = [...treatment.evolutions].sort(
    (left, right) =>
      new Date(left.occurredAt).getTime() -
      new Date(right.occurredAt).getTime(),
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-5 backdrop-blur-sm">
      <Card className="max-h-[95vh] w-full max-w-6xl overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-2xl bg-teal-50 text-teal-700">
              <FileHeart className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">
                  Tratamiento de {treatment.pet.name}
                </h2>
                <Badge className={presentation.badge}>
                  {presentation.label}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Dr. {treatment.veterinarian.firstName}{' '}
                {treatment.veterinarian.lastName} · iniciado{' '}
                {format(localDateOnly(treatment.startDate), "d 'de' MMMM yyyy", {
                  locale: es,
                })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="grid grid-cols-[0.9fr_1.2fr] gap-5 p-6">
          <div className="space-y-4">
            <Card className="p-5 shadow-none">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-teal-600">
                  Plan terapéutico
                </p>
                {canManage && (
                  <button
                    type="button"
                    onClick={onEdit}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-teal-700"
                  >
                    <Pencil className="size-3.5" />
                    Editar
                  </button>
                )}
              </div>
              <DetailBlock label="Diagnóstico" text={treatment.diagnosis} />
              <DetailBlock
                label="Indicaciones"
                text={treatment.instructions}
              />
              {treatment.notes && (
                <DetailBlock label="Observaciones" text={treatment.notes} />
              )}
            </Card>

            <Card className="p-5 shadow-none">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800">
                  Medicación indicada
                </p>
                <Pill className="size-5 text-violet-500" />
              </div>
              {treatment.medications?.length ? (
                <div className="mt-4 space-y-2">
                  {treatment.medications.map((medication, index) => (
                    <div
                      key={`${medication.name}-${index}`}
                      className="rounded-xl bg-violet-50 p-3"
                    >
                      <p className="text-sm font-bold text-violet-800">
                        {medication.name}
                      </p>
                      <p className="mt-1 text-xs text-violet-600">
                        {[
                          medication.dosage,
                          medication.frequency,
                          medication.duration,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Sin pauta detallada'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">
                  Sin medicamentos registrados.
                </p>
              )}
            </Card>

            <div className="grid grid-cols-2 gap-3">
              {onOpenHistory && (
                <Button
                  onClick={onOpenHistory}
                  className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                >
                  <History className="size-4" />
                  Historial
                </Button>
              )}
              {onOpenMedia && (
                <Button
                  onClick={onOpenMedia}
                  className="border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100"
                >
                  <ImagePlus className="size-4" />
                  Evidencias ({treatment._count.mediaFiles})
                </Button>
              )}
            </div>

            {canManage && (
              <ClinicalField label="Estado del tratamiento">
                <select
                  value={treatment.status}
                  disabled={submitting}
                  onChange={(event) =>
                    onStatusChange(event.target.value as TreatmentStatus)
                  }
                  className={clinicalInputClass}
                >
                  {Object.entries(statusPresentation).map(([status, item]) => (
                    <option key={status} value={status}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </ClinicalField>
            )}
          </div>

          <Card className="overflow-hidden shadow-none">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Evolución clínica
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {timeline.length} controles registrados
                </p>
              </div>
              {canManage && (
                <Button
                  onClick={() => setShowEvolutionForm(true)}
                  className="bg-teal-600 text-white hover:bg-teal-700"
                >
                  <Plus className="size-4" />
                  Nuevo seguimiento
                </Button>
              )}
            </div>

            <div className="p-5">
              <TimelineStart treatment={treatment} />
              {timeline.map((evolution, index) => {
                const item = evolutionPresentation[evolution.status];
                const Icon = item.icon;
                return (
                  <article
                    key={evolution.id}
                    className="relative grid grid-cols-[44px_1fr] gap-4 pb-5"
                  >
                    <div className="absolute bottom-0 left-[21px] top-10 w-px bg-slate-200" />
                    <div
                      className={`relative z-10 grid size-11 place-items-center rounded-xl ${item.className}`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className={item.className}>
                              {item.label}
                            </Badge>
                            <span className="text-[11px] text-slate-400">
                              {format(
                                new Date(evolution.occurredAt),
                                "d MMM yyyy, HH:mm",
                                { locale: es },
                              )}
                            </span>
                          </div>
                          <h4 className="mt-2 text-sm font-bold text-slate-800">
                            {evolution.title || item.label}
                          </h4>
                        </div>
                        {canManage && (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() =>
                              void onDeleteEvolution(evolution.id)
                            }
                            title="Archivar seguimiento"
                            className="grid size-8 place-items-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                        {evolution.notes}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <UserRound className="size-3.5" />
                          {evolution.createdBy.firstName}{' '}
                          {evolution.createdBy.lastName}
                        </span>
                        {evolution.weightKg && (
                          <span className="flex items-center gap-1.5">
                            <Weight className="size-3.5" />
                            {evolution.weightKg} kg
                          </span>
                        )}
                        {evolution.nextReviewAt && (
                          <span className="flex items-center gap-1.5 text-amber-600">
                            <CalendarClock className="size-3.5" />
                            Próxima revisión{' '}
                            {format(
                              new Date(evolution.nextReviewAt),
                              'dd/MM/yyyy HH:mm',
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    {index === timeline.length - 1 &&
                      treatment.status === 'COMPLETED' && (
                        <TimelineCompleted treatment={treatment} />
                      )}
                  </article>
                );
              })}
              {timeline.length === 0 && (
                <div className="ml-[60px] rounded-2xl border border-dashed border-slate-200 px-5 py-8 text-center">
                  <Activity className="mx-auto size-7 text-slate-300" />
                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    Aún no hay seguimientos
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Registra controles para construir la evolución.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </Card>

      {showEvolutionForm && (
        <EvolutionFormModal
          defaultWeight={treatment.pet.weightKg}
          submitting={submitting}
          onClose={() => setShowEvolutionForm(false)}
          onSubmit={async (input) => {
            await onCreateEvolution(input);
            setShowEvolutionForm(false);
          }}
        />
      )}
    </div>
  );
}

interface EvolutionFormState {
  status: TreatmentEvolutionStatus;
  title: string;
  notes: string;
  weightKg: string;
  occurredAt: string;
  nextReviewAt: string;
}

function EvolutionFormModal({
  defaultWeight,
  submitting,
  onClose,
  onSubmit,
}: {
  defaultWeight: number | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: EvolutionFormState) => Promise<void>;
}) {
  const [form, setForm] = useState<EvolutionFormState>({
    status: 'IMPROVING',
    title: '',
    notes: '',
    weightKg: defaultWeight?.toString() ?? '',
    occurredAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    nextReviewAt: '',
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (form.notes.trim().length < 3) {
      setError('Describe los hallazgos del seguimiento.');
      return;
    }
    try {
      await onSubmit(form);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No fue posible guardar el seguimiento.',
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/45 p-6 backdrop-blur-sm">
      <Card className="w-full max-w-2xl p-6">
        <ClinicalModalHeader
          eyebrow="Control clínico"
          title="Registrar evolución"
          onClose={onClose}
        />
        <form onSubmit={(event) => void submit(event)} className="mt-6">
          {error && (
            <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <ClinicalField label="Estado de evolución">
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as TreatmentEvolutionStatus,
                  }))
                }
                className={clinicalInputClass}
              >
                {Object.entries(evolutionPresentation).map(
                  ([status, item]) => (
                    <option key={status} value={status}>
                      {item.label}
                    </option>
                  ),
                )}
              </select>
            </ClinicalField>
            <ClinicalField label="Fecha y hora">
              <input
                type="datetime-local"
                required
                value={form.occurredAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    occurredAt: event.target.value,
                  }))
                }
                className={clinicalInputClass}
              />
            </ClinicalField>
          </div>
          <div className="mt-4">
            <ClinicalField label="Título" optional>
              <input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Ej. Control a las 48 horas"
                className={clinicalInputClass}
              />
            </ClinicalField>
          </div>
          <div className="mt-4">
            <ClinicalField label="Hallazgos y evolución">
              <textarea
                required
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                placeholder="Respuesta al tratamiento, síntomas, cambios observados..."
                className={`${clinicalInputClass} min-h-28 resize-none py-3`}
              />
            </ClinicalField>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <ClinicalField label="Peso actual" optional>
              <input
                type="number"
                min="0.01"
                max="999.99"
                step="0.01"
                value={form.weightKg}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    weightKg: event.target.value,
                  }))
                }
                placeholder="kg"
                className={clinicalInputClass}
              />
            </ClinicalField>
            <ClinicalField label="Próxima revisión" optional>
              <input
                type="datetime-local"
                value={form.nextReviewAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    nextReviewAt: event.target.value,
                  }))
                }
                className={clinicalInputClass}
              />
            </ClinicalField>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button
              onClick={onClose}
              disabled={submitting}
              className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-teal-600 text-white hover:bg-teal-700"
            >
              {submitting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Activity className="size-4" />
              )}
              Guardar seguimiento
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function TimelineStart({ treatment }: { treatment: Treatment }) {
  return (
    <div className="relative grid grid-cols-[44px_1fr] gap-4 pb-5">
      <div className="absolute bottom-0 left-[21px] top-10 w-px bg-slate-200" />
      <div className="relative z-10 grid size-11 place-items-center rounded-xl bg-violet-100 text-violet-700">
        <Stethoscope className="size-5" />
      </div>
      <div className="rounded-2xl bg-violet-50 p-4">
        <Badge className="bg-white text-violet-700">Inicio</Badge>
        <h4 className="mt-2 text-sm font-bold text-slate-800">
          Tratamiento indicado
        </h4>
        <p className="mt-1 text-xs text-slate-500">
          {format(localDateOnly(treatment.startDate), "d 'de' MMMM yyyy", {
            locale: es,
          })}{' '}
          · {treatment.diagnosis}
        </p>
      </div>
    </div>
  );
}

function TimelineCompleted({ treatment }: { treatment: Treatment }) {
  return (
    <div className="col-start-2 mt-3 flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
      <CalendarCheck2 className="size-4" />
      Tratamiento finalizado
      {treatment.endDate
        ? ` el ${format(localDateOnly(treatment.endDate), 'dd/MM/yyyy')}`
        : ''}
    </div>
  );
}

function DetailBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
        {text}
      </p>
    </div>
  );
}

function EmptyTreatments({
  canManage,
  onCreate,
}: {
  canManage: boolean;
  onCreate: () => void;
}) {
  return (
    <Card className="grid min-h-[420px] place-items-center p-8 text-center">
      <div>
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-teal-50 text-teal-600">
          <HeartPulse className="size-8" />
        </div>
        <h2 className="mt-5 text-lg font-bold text-slate-900">
          Sin tratamientos registrados
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
          Los planes terapéuticos y su evolución aparecerán aquí.
        </p>
        {canManage && (
          <Button
            onClick={onCreate}
            className="mt-5 bg-teal-600 text-white hover:bg-teal-700"
          >
            <Plus className="size-4" />
            Crear tratamiento
          </Button>
        )}
      </div>
    </Card>
  );
}

function treatmentProgress(treatment: Treatment): number | null {
  if (treatment.status === 'COMPLETED') return 100;
  if (!treatment.endDate) return null;
  const start = startOfDay(localDateOnly(treatment.startDate));
  const end = startOfDay(localDateOnly(treatment.endDate));
  const total = Math.max(1, differenceInCalendarDays(end, start) + 1);
  const elapsed = differenceInCalendarDays(startOfDay(new Date()), start) + 1;
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
}

function localDateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

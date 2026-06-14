import {
  ClinicalConfirmDialog,
  clinicalInputClass,
  ClinicalMetric,
} from '@/components/clinical/clinical-ui';
import {
  emptyMedicalRecordForm,
  MedicalRecordFormModal,
  medicalRecordToForm,
  type MedicalRecordFormState,
} from '@/components/medical/medical-record-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api';
import type {
  MedicalRecord,
  MedicalRecordType,
  PaginatedResponse,
  Pet,
} from '@/types/clinical';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  CalendarClock,
  ClipboardPlus,
  Dog,
  FileText,
  FlaskConical,
  HeartPulse,
  Images,
  LoaderCircle,
  Paperclip,
  Pencil,
  Pill,
  Plus,
  Scissors,
  Search,
  Stethoscope,
  Syringe,
  Trash2,
  UserRound,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';

interface TypePresentation {
  label: string;
  icon: LucideIcon;
  iconClass: string;
  badgeClass: string;
}

const typePresentation: Record<MedicalRecordType, TypePresentation> = {
  CONSULTATION: {
    label: 'Consulta',
    icon: Stethoscope,
    iconClass: 'bg-teal-100 text-teal-700',
    badgeClass: 'bg-teal-50 text-teal-700',
  },
  FOLLOW_UP: {
    label: 'Control',
    icon: Activity,
    iconClass: 'bg-blue-100 text-blue-700',
    badgeClass: 'bg-blue-50 text-blue-700',
  },
  TREATMENT: {
    label: 'Tratamiento',
    icon: Pill,
    iconClass: 'bg-violet-100 text-violet-700',
    badgeClass: 'bg-violet-50 text-violet-700',
  },
  VACCINATION: {
    label: 'Vacunación',
    icon: Syringe,
    iconClass: 'bg-amber-100 text-amber-700',
    badgeClass: 'bg-amber-50 text-amber-700',
  },
  SURGERY: {
    label: 'Cirugía',
    icon: Scissors,
    iconClass: 'bg-rose-100 text-rose-700',
    badgeClass: 'bg-rose-50 text-rose-700',
  },
  LAB_RESULT: {
    label: 'Laboratorio',
    icon: FlaskConical,
    iconClass: 'bg-cyan-100 text-cyan-700',
    badgeClass: 'bg-cyan-50 text-cyan-700',
  },
  OTHER: {
    label: 'Otro',
    icon: FileText,
    iconClass: 'bg-slate-100 text-slate-600',
    badgeClass: 'bg-slate-100 text-slate-600',
  },
};

export function MedicalHistoryPage({
  initialPetId,
  onOpenMedia,
}: {
  initialPetId?: string;
  onOpenMedia?: (petId: string, medicalRecordId?: string) => void;
}) {
  const { request, user } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedPetId, setSelectedPetId] = useState(initialPetId ?? '');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isLoadingPets, setIsLoadingPets] = useState(true);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(
    null,
  );
  const [deletingRecord, setDeletingRecord] =
    useState<MedicalRecord | null>(null);
  const [form, setForm] = useState<MedicalRecordFormState>(
    emptyMedicalRecordForm(initialPetId),
  );
  const canManage = user?.permissions.includes('medical.manage') ?? false;

  const loadPets = useCallback(async () => {
    setIsLoadingPets(true);
    try {
      const data = await request<PaginatedResponse<Pet>>(
        '/pets?page=1&pageSize=100&status=ACTIVE',
      );
      setPets(data.items);
      setSelectedPetId((current) => {
        if (initialPetId && data.items.some((pet) => pet.id === initialPetId)) {
          return initialPetId;
        }
        if (current && data.items.some((pet) => pet.id === current)) {
          return current;
        }
        return data.items[0]?.id ?? '';
      });
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No fue posible cargar los pacientes.',
      );
    } finally {
      setIsLoadingPets(false);
    }
  }, [initialPetId, request]);

  const loadRecords = useCallback(
    async (petId: string, term: string, type: string) => {
      if (!petId) {
        setRecords([]);
        setTotal(0);
        return;
      }
      setIsLoadingRecords(true);
      try {
        const query = new URLSearchParams({
          page: '1',
          pageSize: '100',
          petId,
          ...(term.trim() ? { search: term.trim() } : {}),
          ...(type ? { type } : {}),
        });
        const data = await request<PaginatedResponse<MedicalRecord>>(
          `/medical-records?${query.toString()}`,
        );
        setRecords(data.items);
        setTotal(data.total);
        setError(null);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'No fue posible cargar el historial clínico.',
        );
      } finally {
        setIsLoadingRecords(false);
      }
    },
    [request],
  );

  useEffect(() => {
    void loadPets();
  }, [loadPets]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => void loadRecords(selectedPetId, search, typeFilter),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [loadRecords, search, selectedPetId, typeFilter]);

  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? null;

  const nextReview = useMemo(
    () =>
      records
        .map((record) => record.nextReviewAt)
        .filter((date): date is string => Boolean(date))
        .map((date) => new Date(date))
        .filter((date) => date > new Date())
        .sort((left, right) => left.getTime() - right.getTime())[0] ?? null,
    [records],
  );

  const openCreate = () => {
    setEditingRecord(null);
    setForm(emptyMedicalRecordForm(selectedPetId));
    setIsFormOpen(true);
  };

  const openEdit = (record: MedicalRecord) => {
    setEditingRecord(record);
    setForm(medicalRecordToForm(record));
    setIsFormOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const optional = (value: string) => value.trim() || null;
    const clinicalData = {
      type: form.type,
      occurredAt: new Date(form.occurredAt).toISOString(),
      complaint: optional(form.complaint),
      symptoms: optional(form.symptoms),
      diagnosis: optional(form.diagnosis),
      treatmentPlan: optional(form.treatmentPlan),
      medications: form.medications.length
        ? form.medications.map((medication) => ({
            name: medication.name.trim(),
            dosage: optional(medication.dosage),
            frequency: optional(medication.frequency),
            duration: optional(medication.duration),
          }))
        : null,
      notes: optional(form.notes),
      nextReviewAt: form.nextReviewAt
        ? new Date(form.nextReviewAt).toISOString()
        : null,
    };

    try {
      await request(
        editingRecord
          ? `/medical-records/${editingRecord.id}`
          : '/medical-records',
        {
          method: editingRecord ? 'PATCH' : 'POST',
          body: editingRecord
            ? clinicalData
            : { petId: form.petId, ...clinicalData },
        },
      );
      setSelectedPetId(form.petId);
      setIsFormOpen(false);
      await loadRecords(form.petId, search, typeFilter);
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : 'No fue posible guardar la entrada clínica.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRecord) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await request(`/medical-records/${deletingRecord.id}`, {
        method: 'DELETE',
      });
      setDeletingRecord(null);
      await loadRecords(selectedPetId, search, typeFilter);
    } catch (deleteError) {
      setDeletingRecord(null);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'No fue posible archivar la entrada clínica.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">
            Seguimiento del paciente
          </p>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-slate-950">
            Historial clínico
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Consultas, diagnósticos y evolución médica en una sola línea de
            tiempo.
          </p>
        </div>
        <div className="flex gap-2">
          {onOpenMedia && (
            <Button
              onClick={() => onOpenMedia(selectedPetId)}
              disabled={!selectedPetId}
              className="h-10 border border-slate-200 bg-white px-4 text-slate-600 hover:bg-slate-50"
            >
              <Images className="size-4" />
              Archivos del paciente
            </Button>
          )}
          {canManage && (
            <Button
              onClick={openCreate}
              disabled={!selectedPetId}
              className="h-10 bg-teal-600 px-4 text-white hover:bg-teal-700"
            >
              <Plus className="size-4" />
              Nueva atención
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {isLoadingPets ? (
        <Card className="grid min-h-96 place-items-center text-slate-400">
          <LoaderCircle className="size-7 animate-spin" />
        </Card>
      ) : pets.length === 0 ? (
        <Card className="grid min-h-96 place-items-center px-6 text-center">
          <div>
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-teal-50 text-teal-600">
              <Dog className="size-8" />
            </div>
            <h2 className="mt-4 font-bold text-slate-800">
              Primero registra un paciente
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              El historial clínico se construye desde la ficha de cada mascota.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <section className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <ClinicalMetric
              icon={ClipboardPlus}
              color="bg-teal-50 text-teal-600"
              value={total}
              label="Entradas clínicas"
            />
            <ClinicalMetric
              icon={HeartPulse}
              color="bg-blue-50 text-blue-600"
              value={
                records.filter((record) => Boolean(record.diagnosis)).length
              }
              label="Diagnósticos registrados"
            />
            <Card className="flex items-center gap-4 p-5">
              <div className="grid size-12 place-items-center rounded-xl bg-amber-50 text-amber-600">
                <CalendarClock className="size-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {nextReview
                    ? format(nextReview, 'd MMM, HH:mm', { locale: es })
                    : 'Sin programar'}
                </p>
                <p className="text-xs text-slate-500">Próxima revisión</p>
              </div>
            </Card>
          </section>

          <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-4">
            <PatientPanel
              pets={pets}
              selectedPet={selectedPet}
              selectedPetId={selectedPetId}
              onSelect={(petId) => {
                setSelectedPetId(petId);
                setSearch('');
                setTypeFilter('');
              }}
            />

            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">
                    Línea de tiempo clínica
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {selectedPet
                      ? `Evolución médica de ${selectedPet.name}`
                      : 'Selecciona un paciente'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <select
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                    className={`${clinicalInputClass} w-40`}
                  >
                    <option value="">Todos los tipos</option>
                    {Object.entries(typePresentation).map(
                      ([value, presentation]) => (
                        <option key={value} value={value}>
                          {presentation.label}
                        </option>
                      ),
                    )}
                  </select>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar en historial..."
                      className={`${clinicalInputClass} pl-9`}
                    />
                  </div>
                </div>
              </div>

              {isLoadingRecords ? (
                <div className="grid min-h-[440px] place-items-center text-slate-400">
                  <LoaderCircle className="size-6 animate-spin" />
                </div>
              ) : records.length === 0 ? (
                <EmptyTimeline filtered={Boolean(search || typeFilter)} />
              ) : (
                <div className="px-6 py-6">
                  {records.map((record, index) => (
                    <TimelineEntry
                      key={record.id}
                      record={record}
                      isLast={index === records.length - 1}
                      canManage={canManage}
                      onEdit={() => openEdit(record)}
                      onDelete={() => setDeletingRecord(record)}
                      onOpenMedia={
                        onOpenMedia
                          ? () => onOpenMedia(record.petId, record.id)
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {isFormOpen && (
        <MedicalRecordFormModal
          form={form}
          pets={pets}
          editing={Boolean(editingRecord)}
          submitting={isSubmitting}
          onChange={setForm}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleSubmit}
        />
      )}

      {deletingRecord && (
        <ClinicalConfirmDialog
          title="Archivar entrada clínica"
          message="La entrada dejará de mostrarse en la línea de tiempo. Los eventos clínicos vinculados impedirán esta acción para proteger la integridad del historial."
          disabled={isSubmitting}
          onCancel={() => setDeletingRecord(null)}
          onConfirm={() => void handleDelete()}
        />
      )}
    </>
  );
}

function PatientPanel({
  pets,
  selectedPet,
  selectedPetId,
  onSelect,
}: {
  pets: Pet[];
  selectedPet: Pet | null;
  selectedPetId: string;
  onSelect: (petId: string) => void;
}) {
  return (
    <Card className="self-start overflow-hidden">
      <div className="border-b border-slate-100 p-4">
        <label className="text-xs font-semibold text-slate-500">
          Paciente
          <select
            value={selectedPetId}
            onChange={(event) => onSelect(event.target.value)}
            className={`${clinicalInputClass} mt-2`}
          >
            {pets.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {pet.name} · {pet.owner.lastName}
              </option>
            ))}
          </select>
        </label>
      </div>
      {selectedPet && (
        <div className="p-5 text-center">
          <div className="mx-auto grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-teal-50 to-cyan-100 text-teal-700">
            <Dog className="size-9" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">
            {selectedPet.name}
          </h2>
          <p className="mt-1 text-xs font-medium text-teal-600">
            {selectedPet.breed || selectedPet.species}
          </p>
          <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-left">
            <PatientDetail
              label="Dueño"
              value={`${selectedPet.owner.firstName} ${selectedPet.owner.lastName}`}
            />
            <PatientDetail label="Teléfono" value={selectedPet.owner.phone} />
            <PatientDetail
              label="Peso"
              value={
                selectedPet.weightKg
                  ? `${selectedPet.weightKg} kg`
                  : 'Sin registrar'
              }
            />
            <PatientDetail
              label="Edad"
              value={
                selectedPet.approximateAgeMonths !== null
                  ? formatAge(selectedPet.approximateAgeMonths)
                  : 'Sin registrar'
              }
            />
          </div>
        </div>
      )}
    </Card>
  );
}

function PatientDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="truncate text-xs font-semibold text-slate-700">
        {value}
      </span>
    </div>
  );
}

function TimelineEntry({
  record,
  isLast,
  canManage,
  onEdit,
  onDelete,
  onOpenMedia,
}: {
  record: MedicalRecord;
  isLast: boolean;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onOpenMedia?: () => void;
}) {
  const presentation = typePresentation[record.type];
  const Icon = presentation.icon;

  return (
    <article className="relative grid grid-cols-[48px_minmax(0,1fr)] gap-4">
      {!isLast && (
        <div className="absolute left-[23px] top-12 h-[calc(100%-16px)] w-px bg-slate-200" />
      )}
      <div
        className={`relative z-10 grid size-12 place-items-center rounded-2xl ${presentation.iconClass}`}
      >
        <Icon className="size-5" />
      </div>
      <div className={isLast ? 'pb-1' : 'pb-7'}>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-teal-200 hover:shadow-md hover:shadow-slate-200/40">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge className={presentation.badgeClass}>
                  {presentation.label}
                </Badge>
                <span className="text-xs text-slate-400">
                  {format(new Date(record.occurredAt), "d MMM yyyy, HH:mm", {
                    locale: es,
                  })}
                </span>
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900">
                {record.complaint || presentation.label}
              </h3>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                <UserRound className="size-3.5" />
                {record.veterinarian.firstName}{' '}
                {record.veterinarian.lastName}
              </p>
            </div>
            {(canManage || onOpenMedia) && (
              <div className="flex items-center gap-1">
                {onOpenMedia && (
                  <button
                    type="button"
                    onClick={onOpenMedia}
                    title="Ver o adjuntar archivos"
                    className="mr-1 flex h-8 items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 text-[11px] font-semibold text-slate-500 hover:bg-teal-50 hover:text-teal-700"
                  >
                    <Paperclip className="size-3.5" />
                    {record._count.mediaFiles > 0
                      ? `${record._count.mediaFiles} archivos`
                      : 'Adjuntar'}
                  </button>
                )}
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={onEdit}
                      title="Editar entrada clínica"
                      className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-700"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={onDelete}
                      title="Archivar entrada clínica"
                      className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
            {record.symptoms && (
              <ClinicalText label="Síntomas y hallazgos" text={record.symptoms} />
            )}
            {record.diagnosis && (
              <ClinicalText label="Diagnóstico" text={record.diagnosis} />
            )}
            {record.treatmentPlan && (
              <ClinicalText
                label="Plan de tratamiento"
                text={record.treatmentPlan}
              />
            )}
            {record.notes && (
              <ClinicalText label="Observaciones" text={record.notes} />
            )}
          </div>

          {record.medications && record.medications.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Medicamentos
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {record.medications.map((medication, index) => (
                  <div
                    key={`${medication.name}-${index}`}
                    className="rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-700"
                  >
                    <span className="font-bold">{medication.name}</span>
                    {[medication.dosage, medication.frequency, medication.duration]
                      .filter(Boolean)
                      .map((detail) => ` · ${detail}`)
                      .join('')}
                  </div>
                ))}
              </div>
            </div>
          )}

          {record.nextReviewAt && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
              <CalendarClock className="size-4" />
              Próxima revisión{' '}
              {formatDistanceToNow(new Date(record.nextReviewAt), {
                addSuffix: true,
                locale: es,
              })}
              , el{' '}
              {format(new Date(record.nextReviewAt), "d 'de' MMMM, HH:mm", {
                locale: es,
              })}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function ClinicalText({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-slate-600">
        {text}
      </p>
    </div>
  );
}

function EmptyTimeline({ filtered }: { filtered: boolean }) {
  return (
    <div className="grid min-h-[440px] place-items-center px-6 text-center">
      <div>
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-teal-50 text-teal-600">
          <Stethoscope className="size-8" />
        </div>
        <h3 className="mt-4 font-bold text-slate-800">
          {filtered
            ? 'No hay resultados para este filtro'
            : 'Este paciente aún no tiene historial'}
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          {filtered
            ? 'Prueba con otro término o tipo de atención.'
            : 'Registra la primera atención para iniciar su línea clínica.'}
        </p>
      </div>
    </div>
  );
}

function formatAge(months: number): string {
  if (months < 12) return `${months} meses`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths
    ? `${years} años, ${remainingMonths} meses`
    : `${years} años`;
}

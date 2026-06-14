import {
  ClinicalConfirmDialog,
  ClinicalField,
  clinicalInputClass,
  ClinicalMetric,
  ClinicalModalHeader,
} from '@/components/clinical/clinical-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api';
import type {
  DewormingRecord,
  MedicalRecord,
  PaginatedResponse,
  Pet,
  PreventiveCareStatus,
  PreventiveCareSummary,
  VaccineRecord,
} from '@/types/clinical';
import { format } from 'date-fns';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Dog,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  ShieldPlus,
  Stethoscope,
  Syringe,
  Trash2,
  UserRound,
  Weight,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';

type PreventiveTab = 'vaccines' | 'dewormings';
type PreventiveRecord = VaccineRecord | DewormingRecord;

interface PreventiveCarePageProps {
  initialPetId?: string;
}

interface StatusPresentation {
  label: string;
  className: string;
  icon: LucideIcon;
}

const statusPresentation: Record<
  PreventiveCareStatus,
  StatusPresentation
> = {
  APPLIED: {
    label: 'Aplicada',
    className: 'bg-emerald-50 text-emerald-700',
    icon: CheckCircle2,
  },
  PENDING: {
    label: 'Pendiente hoy',
    className: 'bg-amber-50 text-amber-700',
    icon: CalendarClock,
  },
  UPCOMING: {
    label: 'Próxima',
    className: 'bg-blue-50 text-blue-700',
    icon: CalendarDays,
  },
  OVERDUE: {
    label: 'Vencida',
    className: 'bg-rose-50 text-rose-700',
    icon: AlertTriangle,
  },
};

const emptySummary: PreventiveCareSummary = {
  vaccinesTotal: 0,
  dewormingsTotal: 0,
  applied: 0,
  pending: 0,
  upcoming: 0,
  overdue: 0,
};

export function PreventiveCarePage({
  initialPetId,
}: PreventiveCarePageProps) {
  const { request, user } = useAuth();
  const [activeTab, setActiveTab] = useState<PreventiveTab>('vaccines');
  const [pets, setPets] = useState<Pet[]>([]);
  const [items, setItems] = useState<PreventiveRecord[]>([]);
  const [summary, setSummary] = useState(emptySummary);
  const [selectedPetId, setSelectedPetId] = useState(initialPetId ?? '');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] =
    useState<PreventiveRecord | null>(null);
  const [deletingItem, setDeletingItem] =
    useState<PreventiveRecord | null>(null);
  const canManage =
    user?.permissions.includes('vaccines.manage') ?? false;

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

  const loadSummary = useCallback(
    async (petId: string) => {
      const query = petId ? `?petId=${petId}` : '';
      const data = await request<PreventiveCareSummary>(
        `/preventive-care/summary${query}`,
      );
      setSummary(data);
    },
    [request],
  );

  const loadItems = useCallback(
    async (
      tab: PreventiveTab,
      petId: string,
      status: string,
      term: string,
    ) => {
      setIsLoading(true);
      try {
        const query = new URLSearchParams({
          page: '1',
          pageSize: '100',
          ...(petId ? { petId } : {}),
          ...(status ? { status } : {}),
          ...(term.trim() ? { search: term.trim() } : {}),
        });
        const data = await request<PaginatedResponse<PreventiveRecord>>(
          `/${tab}?${query.toString()}`,
        );
        setItems(data.items);
        setError(null);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'No fue posible cargar el control preventivo.',
        );
      } finally {
        setIsLoading(false);
      }
    },
    [request],
  );

  useEffect(() => {
    void loadPets();
  }, [loadPets]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([
        loadItems(activeTab, selectedPetId, statusFilter, search),
        loadSummary(selectedPetId),
      ]).catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'No fue posible cargar el resumen preventivo.',
        );
      });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [
    activeTab,
    loadItems,
    loadSummary,
    search,
    selectedPetId,
    statusFilter,
  ]);

  const selectedPet =
    pets.find((pet) => pet.id === selectedPetId) ?? null;
  const selectedItemName = deletingItem
    ? isVaccine(deletingItem)
      ? deletingItem.name
      : deletingItem.medication
    : '';

  const openCreate = () => {
    setEditingItem(null);
    setIsFormOpen(true);
  };

  const openEdit = (item: PreventiveRecord) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const refresh = async () => {
    await Promise.all([
      loadItems(activeTab, selectedPetId, statusFilter, search),
      loadSummary(selectedPetId),
    ]);
  };

  const handleSubmit = async (
    form: PreventiveFormState,
    editing: boolean,
  ) => {
    setIsSubmitting(true);
    setError(null);
    const optional = (value: string) => value.trim() || null;
    try {
      if (activeTab === 'vaccines') {
        await request(
          editingItem ? `/vaccines/${editingItem.id}` : '/vaccines',
          {
            method: editing ? 'PATCH' : 'POST',
            body: {
              ...(!editing
                ? {
                    petId: form.petId,
                    medicalRecordId: form.medicalRecordId || undefined,
                  }
                : {}),
              name: form.name.trim(),
              manufacturer: optional(form.manufacturer),
              batchNumber: optional(form.batchNumber),
              appliedAt: form.appliedAt,
              nextDueDate: form.nextDueDate || null,
              notes: optional(form.notes),
            },
          },
        );
      } else {
        await request(
          editingItem
            ? `/dewormings/${editingItem.id}`
            : '/dewormings',
          {
            method: editing ? 'PATCH' : 'POST',
            body: {
              ...(!editing
                ? {
                    petId: form.petId,
                    medicalRecordId: form.medicalRecordId || undefined,
                  }
                : {}),
              medication: form.medication.trim(),
              appliedAt: form.appliedAt,
              nextDueDate: form.nextDueDate || null,
              weightKg: form.weightKg ? Number(form.weightKg) : null,
              dosage: optional(form.dosage),
              notes: optional(form.notes),
            },
          },
        );
      }
      setIsFormOpen(false);
      setEditingItem(null);
      await refresh();
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : 'No fue posible guardar el registro preventivo.',
      );
      throw submitError;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    setIsSubmitting(true);
    try {
      await request(`/${activeTab}/${deletingItem.id}`, {
        method: 'DELETE',
      });
      setDeletingItem(null);
      await refresh();
    } catch (deleteError) {
      setDeletingItem(null);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'No fue posible archivar el registro.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">
            Medicina preventiva
          </p>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-slate-950">
            Vacunas y desparasitaciones
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Aplicaciones, próximas dosis y alertas sanitarias por paciente.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={openCreate}
            disabled={pets.length === 0}
            className="h-10 bg-teal-600 px-4 text-white hover:bg-teal-700"
          >
            <Plus className="size-4" />
            {activeTab === 'vaccines'
              ? 'Registrar vacuna'
              : 'Registrar desparasitación'}
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {summary.overdue > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <div className="grid size-10 place-items-center rounded-xl bg-white text-rose-600">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-rose-800">
              {summary.overdue}{' '}
              {summary.overdue === 1
                ? 'control preventivo vencido'
                : 'controles preventivos vencidos'}
            </p>
            <p className="text-xs text-rose-600">
              Revisa las fechas y contacta a los dueños para reprogramar.
            </p>
          </div>
        </div>
      )}

      <section className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
        <ClinicalMetric
          icon={Syringe}
          color="bg-teal-50 text-teal-600"
          value={summary.vaccinesTotal}
          label="Vacunas registradas"
        />
        <ClinicalMetric
          icon={ShieldPlus}
          color="bg-violet-50 text-violet-600"
          value={summary.dewormingsTotal}
          label="Desparasitaciones"
        />
        <ClinicalMetric
          icon={AlertTriangle}
          color="bg-rose-50 text-rose-600"
          value={summary.overdue}
          label="Controles vencidos"
        />
        <ClinicalMetric
          icon={CalendarClock}
          color="bg-blue-50 text-blue-600"
          value={summary.pending + summary.upcoming}
          label="Pendientes y próximos"
        />
      </section>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex rounded-xl bg-slate-100 p-1">
            <TabButton
              active={activeTab === 'vaccines'}
              icon={Syringe}
              label="Vacunas"
              onClick={() => {
                setActiveTab('vaccines');
                setStatusFilter('');
                setSearch('');
              }}
            />
            <TabButton
              active={activeTab === 'dewormings'}
              icon={ShieldPlus}
              label="Desparasitaciones"
              onClick={() => {
                setActiveTab('dewormings');
                setStatusFilter('');
                setSearch('');
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedPetId}
              onChange={(event) => setSelectedPetId(event.target.value)}
              className={`${clinicalInputClass} w-52`}
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
              className={`${clinicalInputClass} w-40`}
            >
              <option value="">Todos los estados</option>
              {Object.entries(statusPresentation).map(
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
                placeholder={
                  activeTab === 'vaccines'
                    ? 'Vacuna, lote o paciente...'
                    : 'Medicamento o paciente...'
                }
                className={`${clinicalInputClass} pl-9`}
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid min-h-[390px] place-items-center text-slate-400">
            <LoaderCircle className="size-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <PreventiveEmpty
            tab={activeTab}
            filtered={Boolean(search || statusFilter)}
            hasPets={pets.length > 0}
          />
        ) : (
          <PreventiveTable
            tab={activeTab}
            items={items}
            canManage={canManage}
            onEdit={openEdit}
            onDelete={setDeletingItem}
          />
        )}
      </Card>

      {isFormOpen && (
        <PreventiveFormModal
          tab={activeTab}
          pets={pets}
          selectedPet={selectedPet}
          initialPetId={selectedPetId}
          editingItem={editingItem}
          submitting={isSubmitting}
          onClose={() => {
            setIsFormOpen(false);
            setEditingItem(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {deletingItem && (
        <ClinicalConfirmDialog
          title={`Archivar ${
            activeTab === 'vaccines' ? 'vacuna' : 'desparasitación'
          }`}
          message={`${selectedItemName} dejará de aparecer en el control preventivo, pero la entrada histórica asociada se conservará.`}
          disabled={isSubmitting}
          onCancel={() => setDeletingItem(null)}
          onConfirm={() => void handleDelete()}
        />
      )}
    </>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'flex h-9 items-center gap-2 rounded-lg bg-white px-3 text-xs font-bold text-teal-700 shadow-sm'
          : 'flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-slate-500'
      }
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function PreventiveTable({
  tab,
  items,
  canManage,
  onEdit,
  onDelete,
}: {
  tab: PreventiveTab;
  items: PreventiveRecord[];
  canManage: boolean;
  onEdit: (item: PreventiveRecord) => void;
  onDelete: (item: PreventiveRecord) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-slate-100 bg-slate-50/70 text-slate-400">
          <tr>
            <th className="px-5 py-3 font-semibold">Paciente</th>
            <th className="px-4 py-3 font-semibold">
              {tab === 'vaccines' ? 'Vacuna' : 'Medicamento'}
            </th>
            <th className="px-4 py-3 font-semibold">Aplicación</th>
            <th className="px-4 py-3 font-semibold">Próxima dosis</th>
            <th className="px-4 py-3 font-semibold">Estado</th>
            <th className="px-5 py-3 text-right font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const presentation = statusPresentation[item.status];
            const StatusIcon = presentation.icon;
            return (
              <tr
                key={item.id}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-9 place-items-center rounded-xl bg-teal-50 text-teal-700">
                      <Dog className="size-4" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">
                        {item.pet.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {item.pet.owner.firstName}{' '}
                        {item.pet.owner.lastName}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <p className="font-semibold text-slate-700">
                    {isVaccine(item) ? item.name : item.medication}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {isVaccine(item)
                      ? item.manufacturer || item.batchNumber
                        ? [item.manufacturer, item.batchNumber]
                            .filter(Boolean)
                            .join(' · ')
                        : 'Sin fabricante o lote'
                      : [item.dosage, item.weightKg && `${item.weightKg} kg`]
                          .filter(Boolean)
                          .join(' · ') || 'Sin dosis registrada'}
                  </p>
                </td>
                <td className="px-4 py-4 text-slate-600">
                  {formatDateOnly(item.appliedAt)}
                </td>
                <td className="px-4 py-4">
                  <p className="font-medium text-slate-700">
                    {item.nextDueDate
                      ? formatDateOnly(item.nextDueDate)
                      : 'Sin programar'}
                  </p>
                  {item.daysRemaining !== null && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      {dueDescription(item.daysRemaining)}
                    </p>
                  )}
                </td>
                <td className="px-4 py-4">
                  <Badge className={presentation.className}>
                    <StatusIcon className="mr-1 size-3" />
                    {presentation.label}
                  </Badge>
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-1">
                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                          title="Editar registro"
                          className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-700"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(item)}
                          title="Archivar registro"
                          className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface PreventiveFormState {
  petId: string;
  medicalRecordId: string;
  name: string;
  manufacturer: string;
  batchNumber: string;
  medication: string;
  appliedAt: string;
  nextDueDate: string;
  weightKg: string;
  dosage: string;
  notes: string;
}

function PreventiveFormModal({
  tab,
  pets,
  selectedPet,
  initialPetId,
  editingItem,
  submitting,
  onClose,
  onSubmit,
}: {
  tab: PreventiveTab;
  pets: Pet[];
  selectedPet: Pet | null;
  initialPetId: string;
  editingItem: PreventiveRecord | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (
    form: PreventiveFormState,
    editing: boolean,
  ) => Promise<void>;
}) {
  const { request } = useAuth();
  const editing = Boolean(editingItem);
  const defaultPetId =
    editingItem?.petId || initialPetId || selectedPet?.id || pets[0]?.id || '';
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [form, setForm] = useState<PreventiveFormState>(() =>
    formFromRecord(tab, editingItem, defaultPetId, pets),
  );

  useEffect(() => {
    if (editing || !form.petId) {
      setRecords([]);
      return;
    }
    void request<PaginatedResponse<MedicalRecord>>(
      `/medical-records?page=1&pageSize=100&petId=${form.petId}`,
    )
      .then((data) => setRecords(data.items))
      .catch((loadError) =>
        setLocalError(
          loadError instanceof Error
            ? loadError.message
            : 'No fue posible cargar el historial.',
        ),
      );
  }, [editing, form.petId, request]);

  const updateField = <K extends keyof PreventiveFormState>(
    field: K,
    value: PreventiveFormState[K],
  ) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (
      form.nextDueDate &&
      form.nextDueDate <= form.appliedAt
    ) {
      setLocalError(
        'La próxima dosis debe ser posterior a la fecha de aplicación.',
      );
      return;
    }
    setLocalError(null);
    try {
      await onSubmit(form, editing);
    } catch {
      // The page keeps the modal open and displays the API error.
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-6 backdrop-blur-sm">
      <Card className="max-h-[92vh] w-full max-w-3xl overflow-y-auto p-6">
        <ClinicalModalHeader
          eyebrow="Control preventivo"
          title={
            editing
              ? `Editar ${
                  tab === 'vaccines' ? 'vacuna' : 'desparasitación'
                }`
              : `Registrar ${
                  tab === 'vaccines' ? 'vacuna' : 'desparasitación'
                }`
          }
          onClose={onClose}
        />
        <form onSubmit={submit} className="mt-6 space-y-4">
          <ClinicalField label="Paciente">
            <select
              required
              disabled={editing}
              value={form.petId}
              onChange={(event) => {
                const pet = pets.find(
                  (item) => item.id === event.target.value,
                );
                setForm((current) => ({
                  ...current,
                  petId: event.target.value,
                  medicalRecordId: '',
                  weightKg:
                    tab === 'dewormings' && pet?.weightKg
                      ? String(pet.weightKg)
                      : current.weightKg,
                }));
              }}
              className={clinicalInputClass}
            >
              <option value="">Selecciona un paciente</option>
              {pets.map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name} · {pet.owner.firstName}{' '}
                  {pet.owner.lastName}
                </option>
              ))}
            </select>
          </ClinicalField>

          {tab === 'vaccines' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <ClinicalField label="Vacuna">
                  <input
                    required
                    maxLength={160}
                    value={form.name}
                    onChange={(event) =>
                      updateField('name', event.target.value)
                    }
                    placeholder="Ej. Rabia, Triple felina"
                    className={clinicalInputClass}
                  />
                </ClinicalField>
                <ClinicalField label="Fabricante" optional>
                  <input
                    maxLength={160}
                    value={form.manufacturer}
                    onChange={(event) =>
                      updateField('manufacturer', event.target.value)
                    }
                    className={clinicalInputClass}
                  />
                </ClinicalField>
              </div>
              <ClinicalField label="Número de lote" optional>
                <input
                  maxLength={100}
                  value={form.batchNumber}
                  onChange={(event) =>
                    updateField('batchNumber', event.target.value)
                  }
                  className={clinicalInputClass}
                />
              </ClinicalField>
            </>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <ClinicalField label="Medicamento">
                <input
                  required
                  maxLength={160}
                  value={form.medication}
                  onChange={(event) =>
                    updateField('medication', event.target.value)
                  }
                  placeholder="Ej. Praziquantel"
                  className={clinicalInputClass}
                />
              </ClinicalField>
              <ClinicalField label="Peso (kg)" optional>
                <div className="relative">
                  <Weight className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    min="0.01"
                    max="9999"
                    step="0.01"
                    value={form.weightKg}
                    onChange={(event) =>
                      updateField('weightKg', event.target.value)
                    }
                    className={`${clinicalInputClass} pl-10`}
                  />
                </div>
              </ClinicalField>
              <ClinicalField label="Dosis" optional>
                <input
                  maxLength={120}
                  value={form.dosage}
                  onChange={(event) =>
                    updateField('dosage', event.target.value)
                  }
                  placeholder="Ej. 1 tableta"
                  className={clinicalInputClass}
                />
              </ClinicalField>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <ClinicalField label="Fecha aplicada">
              <input
                required
                type="date"
                max={todayInputValue()}
                value={form.appliedAt}
                onChange={(event) =>
                  updateField('appliedAt', event.target.value)
                }
                className={clinicalInputClass}
              />
            </ClinicalField>
            <ClinicalField label="Próxima dosis" optional>
              <input
                type="date"
                min={form.appliedAt}
                value={form.nextDueDate}
                onChange={(event) =>
                  updateField('nextDueDate', event.target.value)
                }
                className={clinicalInputClass}
              />
            </ClinicalField>
          </div>

          {!editing && (
            <ClinicalField label="Entrada del historial" optional>
              <div className="relative">
                <Stethoscope className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={form.medicalRecordId}
                  onChange={(event) =>
                    updateField('medicalRecordId', event.target.value)
                  }
                  className={`${clinicalInputClass} pl-10`}
                >
                  <option value="">
                    Crear entrada automática en el historial
                  </option>
                  {records.map((record) => (
                    <option key={record.id} value={record.id}>
                      {formatDateOnly(record.occurredAt)} ·{' '}
                      {record.complaint || 'Atención clínica'}
                    </option>
                  ))}
                </select>
              </div>
            </ClinicalField>
          )}

          <ClinicalField label="Observaciones" optional>
            <textarea
              rows={3}
              maxLength={4000}
              value={form.notes}
              onChange={(event) =>
                updateField('notes', event.target.value)
              }
              className={`${clinicalInputClass} h-auto resize-none py-3`}
            />
          </ClinicalField>

          {localError && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {localError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              onClick={onClose}
              className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-teal-600 text-white hover:bg-teal-700"
            >
              {submitting && (
                <LoaderCircle className="size-4 animate-spin" />
              )}
              {editing ? 'Guardar cambios' : 'Registrar aplicación'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function PreventiveEmpty({
  tab,
  filtered,
  hasPets,
}: {
  tab: PreventiveTab;
  filtered: boolean;
  hasPets: boolean;
}) {
  const Icon = tab === 'vaccines' ? Syringe : ShieldPlus;
  return (
    <div className="grid min-h-[390px] place-items-center px-6 text-center">
      <div>
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-teal-50 text-teal-600">
          <Icon className="size-8" />
        </div>
        <h3 className="mt-4 font-bold text-slate-800">
          {!hasPets
            ? 'Primero registra un paciente'
            : filtered
              ? 'No hay resultados para este filtro'
              : tab === 'vaccines'
                ? 'Aún no hay vacunas registradas'
                : 'Aún no hay desparasitaciones registradas'}
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          {filtered
            ? 'Prueba con otro paciente, estado o término.'
            : 'Las aplicaciones y próximas fechas aparecerán aquí.'}
        </p>
      </div>
    </div>
  );
}

function formFromRecord(
  tab: PreventiveTab,
  item: PreventiveRecord | null,
  petId: string,
  pets: Pet[],
): PreventiveFormState {
  const pet = pets.find((candidate) => candidate.id === petId);
  if (!item) {
    return {
      petId,
      medicalRecordId: '',
      name: '',
      manufacturer: '',
      batchNumber: '',
      medication: '',
      appliedAt: todayInputValue(),
      nextDueDate: '',
      weightKg:
        tab === 'dewormings' && pet?.weightKg ? String(pet.weightKg) : '',
      dosage: '',
      notes: '',
    };
  }
  return {
    petId: item.petId,
    medicalRecordId: item.medicalRecordId ?? '',
    name: isVaccine(item) ? item.name : '',
    manufacturer: isVaccine(item) ? item.manufacturer ?? '' : '',
    batchNumber: isVaccine(item) ? item.batchNumber ?? '' : '',
    medication: isVaccine(item) ? '' : item.medication,
    appliedAt: item.appliedAt.slice(0, 10),
    nextDueDate: item.nextDueDate?.slice(0, 10) ?? '',
    weightKg:
      !isVaccine(item) && item.weightKg !== null
        ? String(item.weightKg)
        : '',
    dosage: !isVaccine(item) ? item.dosage ?? '' : '',
    notes: item.notes ?? '',
  };
}

function isVaccine(
  item: PreventiveRecord,
): item is VaccineRecord {
  return 'name' in item;
}

function todayInputValue(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function formatDateOnly(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function dueDescription(days: number): string {
  if (days < 0) {
    const overdue = Math.abs(days);
    return `Venció hace ${overdue} ${overdue === 1 ? 'día' : 'días'}`;
  }
  if (days === 0) return 'Corresponde hoy';
  return `En ${days} ${days === 1 ? 'día' : 'días'}`;
}

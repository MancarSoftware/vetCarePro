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
  Owner,
  PaginatedResponse,
  Pet,
  PetSex,
  PetStatus,
} from '@/types/clinical';
import {
  Activity,
  BookOpen,
  CalendarDays,
  Cat,
  Dog,
  Images,
  LoaderCircle,
  Mars,
  Pencil,
  Plus,
  Search,
  ShieldPlus,
  Trash2,
  UserRound,
  Venus,
  Weight,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';

interface PetForm {
  ownerId: string;
  name: string;
  species: string;
  breed: string;
  sex: PetSex;
  birthDate: string;
  approximateAgeMonths: string;
  weightKg: string;
  color: string;
  status: PetStatus;
  notes: string;
}

const emptyForm: PetForm = {
  ownerId: '',
  name: '',
  species: 'Canino',
  breed: '',
  sex: 'UNKNOWN',
  birthDate: '',
  approximateAgeMonths: '',
  weightKg: '',
  color: '',
  status: 'ACTIVE',
  notes: '',
};

const sexLabels: Record<PetSex, string> = {
  MALE: 'Macho',
  FEMALE: 'Hembra',
  UNKNOWN: 'Sin definir',
};

const statusLabels: Record<PetStatus, { label: string; className: string }> = {
  ACTIVE: { label: 'Activo', className: 'bg-emerald-50 text-emerald-700' },
  INACTIVE: { label: 'Inactivo', className: 'bg-slate-100 text-slate-600' },
  DECEASED: { label: 'Fallecido', className: 'bg-rose-50 text-rose-700' },
};

function formFromPet(pet: Pet): PetForm {
  return {
    ownerId: pet.ownerId,
    name: pet.name,
    species: pet.species,
    breed: pet.breed ?? '',
    sex: pet.sex,
    birthDate: pet.birthDate?.slice(0, 10) ?? '',
    approximateAgeMonths: pet.approximateAgeMonths?.toString() ?? '',
    weightKg: pet.weightKg?.toString() ?? '',
    color: pet.color ?? '',
    status: pet.status,
    notes: pet.notes ?? '',
  };
}

export function PetsPage({
  onOpenHistory,
  onOpenMedia,
  onOpenPreventive,
  onOpenAppointments,
  onOpenTreatments,
}: {
  onOpenHistory?: (petId: string) => void;
  onOpenMedia?: (petId: string) => void;
  onOpenPreventive?: (petId: string) => void;
  onOpenAppointments?: (petId: string) => void;
  onOpenTreatments?: (petId: string) => void;
}) {
  const { request, user } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [deletingPet, setDeletingPet] = useState<Pet | null>(null);
  const [form, setForm] = useState<PetForm>(emptyForm);
  const canManage = user?.permissions.includes('pets.manage') ?? false;
  const canReadHistory = user?.permissions.includes('medical.read') ?? false;
  const canReadAppointments =
    user?.permissions.includes('appointments.read') ?? false;
  const canReadPreventive =
    user?.permissions.includes('vaccines.read') ?? false;
  const canReadTreatments =
    user?.permissions.includes('treatments.read') ?? false;

  const loadPets = useCallback(
    async (term: string, species: string) => {
      setIsLoading(true);
      try {
        const query = new URLSearchParams({
          page: '1',
          pageSize: '100',
          ...(term.trim() ? { search: term.trim() } : {}),
          ...(species ? { species } : {}),
        });
        const data = await request<PaginatedResponse<Pet>>(
          `/pets?${query.toString()}`,
        );
        setPets(data.items);
        setTotal(data.total);
        setError(null);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'No fue posible cargar las mascotas.',
        );
      } finally {
        setIsLoading(false);
      }
    },
    [request],
  );

  const loadOwners = useCallback(async () => {
    try {
      const data = await request<PaginatedResponse<Owner>>(
        '/owners?page=1&pageSize=100',
      );
      setOwners(data.items);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No fue posible cargar los dueños.',
      );
    }
  }, [request]);

  useEffect(() => {
    void loadOwners();
  }, [loadOwners]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => void loadPets(search, speciesFilter),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [loadPets, search, speciesFilter]);

  const updateField = <K extends keyof PetForm>(
    field: K,
    value: PetForm[K],
  ) => setForm((current) => ({ ...current, [field]: value }));

  const openCreate = () => {
    setEditingPet(null);
    setForm({
      ...emptyForm,
      ownerId: owners.length === 1 ? owners[0].id : '',
    });
    setIsFormOpen(true);
  };

  const openEdit = (pet: Pet) => {
    setEditingPet(pet);
    setForm(formFromPet(pet));
    setIsFormOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const optional = (value: string) => value.trim() || null;

    try {
      await request(editingPet ? `/pets/${editingPet.id}` : '/pets', {
        method: editingPet ? 'PATCH' : 'POST',
        body: {
          ownerId: form.ownerId,
          name: form.name.trim(),
          species: form.species.trim(),
          breed: optional(form.breed),
          sex: form.sex,
          birthDate: form.birthDate || null,
          approximateAgeMonths: form.approximateAgeMonths
            ? Number(form.approximateAgeMonths)
            : null,
          weightKg: form.weightKg ? Number(form.weightKg) : null,
          color: optional(form.color),
          status: form.status,
          notes: optional(form.notes),
        },
      });
      setIsFormOpen(false);
      await Promise.all([
        loadPets(search, speciesFilter),
        loadOwners(),
      ]);
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : 'No fue posible guardar la mascota.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingPet) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await request(`/pets/${deletingPet.id}`, { method: 'DELETE' });
      setDeletingPet(null);
      await Promise.all([
        loadPets(search, speciesFilter),
        loadOwners(),
      ]);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'No fue posible archivar la mascota.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const activePets = pets.filter((pet) => pet.status === 'ACTIVE').length;
  const speciesCount = new Set(
    pets.map((pet) => pet.species.toLowerCase()),
  ).size;

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">
            Registro clínico
          </p>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-slate-950">
            Mascotas
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Pacientes de la clínica y acceso a su información principal.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={openCreate}
            disabled={owners.length === 0}
            title={
              owners.length
                ? 'Registrar mascota'
                : 'Primero registra un dueño'
            }
            className="h-10 bg-teal-600 px-4 text-white hover:bg-teal-700"
          >
            <Plus className="size-4" />
            Nueva mascota
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <ClinicalMetric
          icon={Dog}
          color="bg-teal-50 text-teal-600"
          value={total}
          label="Mascotas registradas"
        />
        <ClinicalMetric
          icon={Activity}
          color="bg-emerald-50 text-emerald-600"
          value={activePets}
          label="Pacientes activos"
        />
        <ClinicalMetric
          icon={Cat}
          color="bg-violet-50 text-violet-600"
          value={speciesCount}
          label="Especies registradas"
        />
      </section>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              Pacientes de la clínica
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Busca por mascota, especie, raza o dueño.
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={speciesFilter}
              onChange={(event) => setSpeciesFilter(event.target.value)}
              className={`${clinicalInputClass} w-36`}
            >
              <option value="">Todas</option>
              <option value="Canino">Caninos</option>
              <option value="Felino">Felinos</option>
              <option value="Ave">Aves</option>
              <option value="Otro">Otros</option>
            </select>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar paciente..."
                className={`${clinicalInputClass} pl-9`}
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid min-h-80 place-items-center text-slate-400">
            <LoaderCircle className="size-6 animate-spin" />
          </div>
        ) : pets.length === 0 ? (
          <EmptyPets
            filtered={Boolean(search || speciesFilter)}
            hasOwners={owners.length > 0}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {pets.map((pet) => (
              <PetCard
                key={pet.id}
                pet={pet}
                canManage={canManage}
                canReadHistory={canReadHistory}
                canReadAppointments={canReadAppointments}
                canReadPreventive={canReadPreventive}
                canReadTreatments={canReadTreatments}
                onEdit={() => openEdit(pet)}
                onDelete={() => setDeletingPet(pet)}
                onOpenHistory={() => onOpenHistory?.(pet.id)}
                onOpenMedia={() => onOpenMedia?.(pet.id)}
                onOpenPreventive={() => onOpenPreventive?.(pet.id)}
                onOpenAppointments={() => onOpenAppointments?.(pet.id)}
                onOpenTreatments={() => onOpenTreatments?.(pet.id)}
              />
            ))}
          </div>
        )}
      </Card>

      {isFormOpen && (
        <PetFormModal
          form={form}
          owners={owners}
          editing={Boolean(editingPet)}
          submitting={isSubmitting}
          onFieldChange={updateField}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleSubmit}
        />
      )}

      {deletingPet && (
        <ClinicalConfirmDialog
          title="Archivar mascota"
          message={`${deletingPet.name} dejará de aparecer entre los pacientes activos. Su información clínica no se eliminará.`}
          disabled={isSubmitting}
          onCancel={() => setDeletingPet(null)}
          onConfirm={() => void handleDelete()}
        />
      )}
    </>
  );
}

function EmptyPets({
  filtered,
  hasOwners,
}: {
  filtered: boolean;
  hasOwners: boolean;
}) {
  return (
    <div className="grid min-h-80 place-items-center px-6 text-center">
      <div>
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-50 text-teal-600">
          <Dog className="size-7" />
        </div>
        <p className="mt-4 font-semibold text-slate-700">
          {filtered ? 'No encontramos pacientes' : 'Aún no hay mascotas'}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {hasOwners
            ? 'Registra la primera mascota para crear su ficha clínica.'
            : 'Primero registra un dueño desde el módulo de Dueños.'}
        </p>
      </div>
    </div>
  );
}

function PetCard({
  pet,
  canManage,
  canReadHistory,
  canReadAppointments,
  canReadPreventive,
  canReadTreatments,
  onEdit,
  onDelete,
  onOpenHistory,
  onOpenMedia,
  onOpenPreventive,
  onOpenAppointments,
  onOpenTreatments,
}: {
  pet: Pet;
  canManage: boolean;
  canReadHistory: boolean;
  canReadAppointments: boolean;
  canReadPreventive: boolean;
  canReadTreatments: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onOpenHistory: () => void;
  onOpenMedia: () => void;
  onOpenPreventive: () => void;
  onOpenAppointments: () => void;
  onOpenTreatments: () => void;
}) {
  const status = statusLabels[pet.status];
  const PetIcon = pet.species.toLowerCase().includes('fel') ? Cat : Dog;
  const SexIcon = pet.sex === 'FEMALE' ? Venus : Mars;

  return (
    <article className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg hover:shadow-slate-200/50">
      <div className="flex items-start justify-between">
        <PetAvatar photoPath={pet.photoPath} fallbackIcon={PetIcon} />
        <div className="flex items-center gap-1">
          <Badge className={status.className}>{status.label}</Badge>
          {canManage && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="grid size-8 place-items-center rounded-lg text-slate-300 hover:bg-teal-50 hover:text-teal-700"
                title="Editar mascota"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="grid size-8 place-items-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                title="Archivar mascota"
              >
                <Trash2 className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-900">{pet.name}</h3>
      <p className="mt-0.5 text-xs font-medium text-teal-600">
        {pet.breed || pet.species}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <PetDetail icon={SexIcon} value={sexLabels[pet.sex]} />
        <PetDetail
          icon={Weight}
          value={pet.weightKg ? `${pet.weightKg} kg` : 'Sin peso'}
        />
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
        <div className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-500">
          <UserRound className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-700">
            {pet.owner.firstName} {pet.owner.lastName}
          </p>
          <p className="text-[11px] text-slate-400">{pet.owner.phone}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {canReadHistory && (
        <button
          type="button"
          onClick={onOpenHistory}
          className="flex h-9 items-center justify-center gap-2 rounded-xl bg-teal-50 text-xs font-semibold text-teal-700 transition hover:bg-teal-100"
        >
          <BookOpen className="size-4" />
          Historial
        </button>
        )}
        {canReadAppointments && (
        <button
          type="button"
          onClick={onOpenAppointments}
          className="flex h-9 items-center justify-center gap-2 rounded-xl bg-blue-50 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
        >
          <CalendarDays className="size-4" />
          Citas
        </button>
        )}
        {canReadHistory && (
        <button
          type="button"
          onClick={onOpenMedia}
          className="flex h-9 items-center justify-center gap-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
        >
          <Images className="size-4" />
          Archivos
        </button>
        )}
        {canReadPreventive && (
        <button
          type="button"
          onClick={onOpenPreventive}
          className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-violet-50 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-100"
        >
          <ShieldPlus className="size-4" />
          Prevención
        </button>
        )}
        {canReadTreatments && (
        <button
          type="button"
          onClick={onOpenTreatments}
          className="col-span-2 flex h-9 items-center justify-center gap-2 rounded-xl bg-emerald-50 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
        >
          <Activity className="size-4" />
          Tratamientos y evolución
        </button>
        )}
      </div>
    </article>
  );
}

function PetAvatar({
  photoPath,
  fallbackIcon: FallbackIcon,
}: {
  photoPath: string | null;
  fallbackIcon: typeof Dog;
}) {
  const { requestBlob } = useAuth();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let objectUrl: string | null = null;

    setImageUrl(null);
    if (!photoPath?.startsWith('/')) {
      return () => undefined;
    }

    void requestBlob(photoPath)
      .then((blob) => {
        if (!mounted) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch(() => {
        if (mounted) setImageUrl(null);
      });

    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoPath, requestBlob]);

  return (
    <div className="size-14 overflow-hidden rounded-2xl bg-gradient-to-br from-teal-50 to-cyan-100 text-teal-700 shadow-inner shadow-white/60">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Foto de perfil de la mascota"
          className="size-full object-cover object-center"
          draggable={false}
        />
      ) : (
        <div className="grid size-full place-items-center">
          <FallbackIcon className="size-7" />
        </div>
      )}
    </div>
  );
}

function PetDetail({
  icon: Icon,
  value,
}: {
  icon: typeof Mars;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-2.5 py-2 text-[11px] text-slate-500">
      <Icon className="size-3.5 text-slate-400" />
      <span className="truncate">{value}</span>
    </div>
  );
}

function PetFormModal({
  form,
  owners,
  editing,
  submitting,
  onFieldChange,
  onClose,
  onSubmit,
}: {
  form: PetForm;
  owners: Owner[];
  editing: boolean;
  submitting: boolean;
  onFieldChange: <K extends keyof PetForm>(
    field: K,
    value: PetForm[K],
  ) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-6 backdrop-blur-sm">
      <Card className="max-h-[92vh] w-full max-w-3xl overflow-y-auto p-6">
        <ClinicalModalHeader
          eyebrow={editing ? 'Actualizar paciente' : 'Nuevo paciente'}
          title={editing ? 'Editar mascota' : 'Registrar mascota'}
          onClose={onClose}
        />
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <ClinicalField label="Dueño">
            <select
              required
              value={form.ownerId}
              onChange={(event) =>
                onFieldChange('ownerId', event.target.value)
              }
              className={clinicalInputClass}
            >
              <option value="">Selecciona un dueño</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.firstName} {owner.lastName} · {owner.phone}
                </option>
              ))}
            </select>
          </ClinicalField>
          <div className="grid grid-cols-2 gap-3">
            <ClinicalField label="Nombre">
              <input
                required
                maxLength={100}
                value={form.name}
                onChange={(event) =>
                  onFieldChange('name', event.target.value)
                }
                className={clinicalInputClass}
              />
            </ClinicalField>
            <ClinicalField label="Especie">
              <select
                value={form.species}
                onChange={(event) =>
                  onFieldChange('species', event.target.value)
                }
                className={clinicalInputClass}
              >
                {['Canino', 'Felino', 'Ave', 'Conejo', 'Reptil', 'Otro'].map(
                  (species) => (
                    <option key={species}>{species}</option>
                  ),
                )}
              </select>
            </ClinicalField>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <ClinicalField label="Raza" optional>
              <input
                maxLength={120}
                value={form.breed}
                onChange={(event) =>
                  onFieldChange('breed', event.target.value)
                }
                className={clinicalInputClass}
              />
            </ClinicalField>
            <ClinicalField label="Sexo">
              <select
                value={form.sex}
                onChange={(event) =>
                  onFieldChange('sex', event.target.value as PetSex)
                }
                className={clinicalInputClass}
              >
                <option value="UNKNOWN">Sin definir</option>
                <option value="MALE">Macho</option>
                <option value="FEMALE">Hembra</option>
              </select>
            </ClinicalField>
            <ClinicalField label="Color" optional>
              <input
                maxLength={100}
                value={form.color}
                onChange={(event) =>
                  onFieldChange('color', event.target.value)
                }
                className={clinicalInputClass}
              />
            </ClinicalField>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <ClinicalField label="Fecha de nacimiento" optional>
              <div className="relative">
                <CalendarDays className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={form.birthDate}
                  onChange={(event) =>
                    onFieldChange('birthDate', event.target.value)
                  }
                  className={`${clinicalInputClass} pl-10`}
                />
              </div>
            </ClinicalField>
            <ClinicalField label="Edad (meses)" optional>
              <input
                type="number"
                min={0}
                max={600}
                value={form.approximateAgeMonths}
                onChange={(event) =>
                  onFieldChange('approximateAgeMonths', event.target.value)
                }
                className={clinicalInputClass}
              />
            </ClinicalField>
            <ClinicalField label="Peso (kg)" optional>
              <input
                type="number"
                min="0.01"
                max="9999"
                step="0.01"
                value={form.weightKg}
                onChange={(event) =>
                  onFieldChange('weightKg', event.target.value)
                }
                className={clinicalInputClass}
              />
            </ClinicalField>
          </div>
          <ClinicalField label="Estado">
            <select
              value={form.status}
              onChange={(event) =>
                onFieldChange('status', event.target.value as PetStatus)
              }
              className={clinicalInputClass}
            >
              <option value="ACTIVE">Activo</option>
              <option value="INACTIVE">Inactivo</option>
              <option value="DECEASED">Fallecido</option>
            </select>
          </ClinicalField>
          <ClinicalField label="Observaciones" optional>
            <textarea
              maxLength={2000}
              rows={3}
              value={form.notes}
              onChange={(event) =>
                onFieldChange('notes', event.target.value)
              }
              className={`${clinicalInputClass} h-auto resize-none py-3`}
            />
          </ClinicalField>
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
              {submitting && <LoaderCircle className="size-4 animate-spin" />}
              {editing ? 'Guardar cambios' : 'Registrar mascota'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

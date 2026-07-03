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
import type { Owner, PaginatedResponse } from '@/types/clinical';
import {
  IdCard,
  LoaderCircle,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';

interface OwnerForm {
  firstName: string;
  lastName: string;
  nationalId: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

const emptyForm: OwnerForm = {
  firstName: '',
  lastName: '',
  nationalId: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
};

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}

function formFromOwner(owner: Owner): OwnerForm {
  return {
    firstName: owner.firstName,
    lastName: owner.lastName,
    nationalId: owner.nationalId ?? '',
    phone: owner.phone,
    email: owner.email ?? '',
    address: owner.address ?? '',
    notes: owner.notes ?? '',
  };
}

export function OwnersPage() {
  const { request, user } = useAuth();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [deletingOwner, setDeletingOwner] = useState<Owner | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<OwnerForm>(emptyForm);
  const canManage = user?.permissions.includes('owners.manage') ?? false;

  const load = useCallback(
    async (term: string) => {
      setIsLoading(true);
      try {
        const query = new URLSearchParams({
          page: '1',
          pageSize: '100',
          ...(term.trim() ? { search: term.trim() } : {}),
        });
        const data = await request<PaginatedResponse<Owner>>(
          `/owners?${query.toString()}`,
        );
        setOwners(data.items);
        setTotal(data.total);
        setError(null);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'No fue posible cargar los dueños.',
        );
      } finally {
        setIsLoading(false);
      }
    },
    [request],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(search), 250);
    return () => window.clearTimeout(timer);
  }, [load, search]);

  const updateField = (field: keyof OwnerForm, value: string) => {
    const nextValue =
      field === 'nationalId' || field === 'phone' ? onlyDigits(value) : value;
    setForm((current) => ({ ...current, [field]: nextValue }));
  };

  const openCreate = () => {
    setEditingOwner(null);
    setForm(emptyForm);
    setIsFormOpen(true);
  };

  const openEdit = (owner: Owner) => {
    setEditingOwner(owner);
    setForm(formFromOwner(owner));
    setIsFormOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const optional = (value: string) => value.trim() || null;

    try {
      await request(
        editingOwner ? `/owners/${editingOwner.id}` : '/owners',
        {
          method: editingOwner ? 'PATCH' : 'POST',
          body: {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            nationalId: optional(form.nationalId),
            phone: onlyDigits(form.phone),
            email: optional(form.email),
            address: optional(form.address),
            notes: optional(form.notes),
          },
        },
      );
      setIsFormOpen(false);
      await load(search);
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : 'No fue posible guardar el dueño.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingOwner) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await request(`/owners/${deletingOwner.id}`, { method: 'DELETE' });
      setDeletingOwner(null);
      await load(search);
    } catch (deleteError) {
      setDeletingOwner(null);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'No fue posible archivar el dueño.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const petCount = owners.reduce(
    (count, owner) => count + owner._count.pets,
    0,
  );
  const withPets = owners.filter((owner) => owner._count.pets > 0).length;

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">
            Directorio de clientes
          </p>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-slate-950">
            Dueños de mascotas
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Información de contacto y pacientes asociados a cada cliente.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={openCreate}
            className="h-10 bg-teal-600 px-4 text-white hover:bg-teal-700"
          >
            <Plus className="size-4" />
            Nuevo dueño
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
          icon={UsersRound}
          color="bg-teal-50 text-teal-600"
          value={total}
          label="Dueños registrados"
        />
        <ClinicalMetric
          icon={UserRound}
          color="bg-blue-50 text-blue-600"
          value={withPets}
          label="Clientes con pacientes"
        />
        <ClinicalMetric
          icon={IdCard}
          color="bg-amber-50 text-amber-600"
          value={petCount}
          label="Mascotas vinculadas"
        />
      </section>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              Directorio de dueños
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Busca por nombre, cédula, teléfono o mascota.
            </p>
          </div>
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar dueño o mascota..."
              className={`${clinicalInputClass} pl-9`}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid min-h-72 place-items-center text-slate-400">
            <LoaderCircle className="size-6 animate-spin" />
          </div>
        ) : owners.length === 0 ? (
          <EmptyOwners search={search} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-xs text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Dueño</th>
                  <th className="px-5 py-3 font-medium">Contacto</th>
                  <th className="px-5 py-3 font-medium">Identificación</th>
                  <th className="px-5 py-3 font-medium">Mascotas</th>
                  <th className="px-5 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {owners.map((owner) => (
                  <tr
                    key={owner.id}
                    className="border-t border-slate-100 transition hover:bg-slate-50/60"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="grid size-10 place-items-center rounded-full bg-teal-50 font-bold text-teal-700">
                          {owner.firstName[0]}
                          {owner.lastName[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">
                            {owner.firstName} {owner.lastName}
                          </p>
                          <p className="mt-0.5 max-w-56 truncate text-xs text-slate-400">
                            {owner.address || 'Sin dirección registrada'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="flex items-center gap-2 text-xs text-slate-600">
                        <Phone className="size-3.5 text-teal-500" />
                        {owner.phone}
                      </p>
                      <p className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
                        <Mail className="size-3.5" />
                        {owner.email || 'Sin correo'}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {owner.nationalId || 'No registrada'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex max-w-72 flex-wrap gap-1.5">
                        {owner.pets.length ? (
                          owner.pets.map((pet) => (
                            <Badge
                              key={pet.id}
                              className="bg-blue-50 text-blue-700"
                            >
                              {pet.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">
                            Sin mascotas
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {canManage && (
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(owner)}
                            title="Editar dueño"
                            className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-700"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingOwner(owner)}
                            title="Archivar dueño"
                            className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {isFormOpen && (
        <OwnerFormModal
          form={form}
          editing={Boolean(editingOwner)}
          submitting={isSubmitting}
          onFieldChange={updateField}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleSubmit}
        />
      )}

      {deletingOwner && (
        <ClinicalConfirmDialog
          title="Archivar dueño"
          message={
            deletingOwner._count.pets
              ? `${deletingOwner.firstName} tiene mascotas registradas. Primero debes archivarlas o reasignarlas.`
              : `Se archivará a ${deletingOwner.firstName} ${deletingOwner.lastName}. Su información dejará de aparecer en el directorio.`
          }
          disabled={deletingOwner._count.pets > 0 || isSubmitting}
          onCancel={() => setDeletingOwner(null)}
          onConfirm={() => void handleDelete()}
        />
      )}
    </>
  );
}

function EmptyOwners({ search }: { search: string }) {
  return (
    <div className="grid min-h-72 place-items-center px-6 text-center">
      <div>
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-50 text-teal-600">
          <UsersRound className="size-7" />
        </div>
        <p className="mt-4 font-semibold text-slate-700">
          {search ? 'No encontramos coincidencias' : 'Aún no hay dueños'}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {search
            ? 'Prueba con otro nombre, teléfono o identificación.'
            : 'Registra el primer cliente para comenzar.'}
        </p>
      </div>
    </div>
  );
}

function OwnerFormModal({
  form,
  editing,
  submitting,
  onFieldChange,
  onClose,
  onSubmit,
}: {
  form: OwnerForm;
  editing: boolean;
  submitting: boolean;
  onFieldChange: (field: keyof OwnerForm, value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-6 backdrop-blur-sm">
      <Card className="max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6">
        <ClinicalModalHeader
          eyebrow={editing ? 'Actualizar cliente' : 'Nuevo cliente'}
          title={editing ? 'Editar dueño' : 'Registrar dueño'}
          onClose={onClose}
        />
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ClinicalField label="Nombre">
              <input
                required
                minLength={2}
                maxLength={100}
                value={form.firstName}
                onChange={(event) =>
                  onFieldChange('firstName', event.target.value)
                }
                className={clinicalInputClass}
              />
            </ClinicalField>
            <ClinicalField label="Apellido">
              <input
                required
                minLength={2}
                maxLength={100}
                value={form.lastName}
                onChange={(event) =>
                  onFieldChange('lastName', event.target.value)
                }
                className={clinicalInputClass}
              />
            </ClinicalField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ClinicalField label="Cédula o identificación" optional>
              <input
                inputMode="numeric"
                pattern="\d{10}"
                maxLength={10}
                title="La cedula debe tener exactamente 10 digitos numericos"
                value={form.nationalId}
                onChange={(event) =>
                  onFieldChange('nationalId', event.target.value)
                }
                className={clinicalInputClass}
              />
            </ClinicalField>
            <ClinicalField label="Teléfono">
              <input
                required
                inputMode="numeric"
                pattern="\d{10}"
                minLength={10}
                maxLength={10}
                title="El telefono debe tener exactamente 10 digitos numericos"
                value={form.phone}
                onChange={(event) =>
                  onFieldChange('phone', event.target.value)
                }
                className={clinicalInputClass}
              />
            </ClinicalField>
          </div>
          <ClinicalField label="Correo electrónico" optional>
            <input
              type="email"
              maxLength={160}
              value={form.email}
              onChange={(event) => onFieldChange('email', event.target.value)}
              className={clinicalInputClass}
            />
          </ClinicalField>
          <ClinicalField label="Dirección" optional>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                maxLength={255}
                value={form.address}
                onChange={(event) =>
                  onFieldChange('address', event.target.value)
                }
                className={`${clinicalInputClass} pl-10`}
              />
            </div>
          </ClinicalField>
          <ClinicalField label="Observaciones" optional>
            <textarea
              maxLength={2000}
              rows={3}
              value={form.notes}
              onChange={(event) => onFieldChange('notes', event.target.value)}
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
              {editing ? 'Guardar cambios' : 'Registrar dueño'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

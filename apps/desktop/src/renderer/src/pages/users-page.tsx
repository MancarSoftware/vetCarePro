import { PasswordInput } from '@/components/auth/password-input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { SystemRole, SystemUser } from '@/types/users';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Check,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Plus,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';

const statusLabels = {
  ACTIVE: {
    label: 'Activo',
    className: 'bg-emerald-50 text-emerald-700',
  },
  INACTIVE: {
    label: 'Inactivo',
    className: 'bg-slate-100 text-slate-600',
  },
  LOCKED: {
    label: 'Bloqueado',
    className: 'bg-rose-50 text-rose-700',
  },
};

interface UserFormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleCodes: string[];
}

const emptyForm: UserFormState = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  roleCodes: [],
};

export function UsersPage() {
  const { request, user: currentUser } = useAuth();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canManage = currentUser?.permissions.includes('users.manage') ?? false;

  const load = useCallback(async () => {
    try {
      const [userData, roleData] = await Promise.all([
        request<SystemUser[]>('/users'),
        request<SystemRole[]>('/roles'),
      ]);
      setUsers(userData);
      setRoles(roleData);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No fue posible cargar los usuarios.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleRole = (code: string) => {
    setForm((current) => ({
      ...current,
      roleCodes: current.roleCodes.includes(code)
        ? current.roleCodes.filter((roleCode) => roleCode !== code)
        : [...current.roleCodes, code],
    }));
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await request('/users', {
        method: 'POST',
        body: form,
      });
      setForm(emptyForm);
      setIsModalOpen(false);
      await load();
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : 'No fue posible crear el usuario.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (
    systemUser: SystemUser,
    status: SystemUser['status'],
  ) => {
    setError(null);
    try {
      await request(`/users/${systemUser.id}/status`, {
        method: 'PATCH',
        body: { status },
      });
      await load();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'No fue posible actualizar el usuario.',
      );
    }
  };

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">
            Seguridad y acceso
          </p>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-slate-950">
            Usuarios y roles
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Administra quién puede entrar y qué puede hacer dentro del sistema.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setForm(emptyForm);
              setIsModalOpen(true);
            }}
            className="bg-teal-600 text-white hover:bg-teal-700"
          >
            <Plus className="size-4" />
            Nuevo usuario
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="flex items-center gap-4 p-5">
          <div className="grid size-12 place-items-center rounded-xl bg-teal-50 text-teal-600">
            <UsersRound className="size-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{users.length}</p>
            <p className="text-xs text-slate-500">Usuarios registrados</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <div className="grid size-12 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <Check className="size-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">
              {users.filter(({ status }) => status === 'ACTIVE').length}
            </p>
            <p className="text-xs text-slate-500">Cuentas activas</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <div className="grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{roles.length}</p>
            <p className="text-xs text-slate-500">Roles configurados</p>
          </div>
        </Card>
      </section>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-800">
            Equipo de la clínica
          </h2>
        </div>

        {isLoading ? (
          <div className="grid min-h-64 place-items-center text-slate-400">
            <LoaderCircle className="size-6 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-xs text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Usuario</th>
                  <th className="px-5 py-3 font-medium">Roles</th>
                  <th className="px-5 py-3 font-medium">Último acceso</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 text-right font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {users.map((systemUser) => {
                  const status = statusLabels[systemUser.status];
                  const isCurrentUser = systemUser.id === currentUser?.id;

                  return (
                    <tr
                      key={systemUser.id}
                      className="border-t border-slate-100"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid size-10 place-items-center rounded-full bg-teal-50 text-teal-600">
                            <UserRound className="size-5" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">
                              {systemUser.firstName} {systemUser.lastName}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs font-medium text-teal-600">
                                  Tú
                                </span>
                              )}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              {systemUser.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {systemUser.roles.map(({ role }) => (
                            <Badge
                              key={role.code}
                              className="bg-blue-50 text-blue-700"
                            >
                              {role.name}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {systemUser.lastLoginAt
                          ? format(
                              new Date(systemUser.lastLoginAt),
                              "d MMM yyyy, HH:mm",
                              { locale: es },
                            )
                          : 'Sin acceso todavía'}
                      </td>
                      <td className="px-5 py-4">
                        <Badge className={status.className}>
                          {status.label}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {canManage && !isCurrentUser ? (
                          <Button
                            onClick={() =>
                              void updateStatus(
                                systemUser,
                                systemUser.status === 'ACTIVE'
                                  ? 'INACTIVE'
                                  : 'ACTIVE',
                              )
                            }
                            className={cn(
                              'h-8 border px-3 text-xs',
                              systemUser.status === 'ACTIVE'
                                ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                            )}
                          >
                            {systemUser.status === 'ACTIVE'
                              ? 'Desactivar'
                              : 'Activar'}
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-6 backdrop-blur-sm">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-600">
                  Nuevo acceso
                </p>
                <h2 className="mt-2 text-xl font-bold text-slate-900">
                  Crear usuario
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  value={form.firstName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      firstName: event.target.value,
                    }))
                  }
                  placeholder="Nombre"
                  className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                />
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  value={form.lastName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      lastName: event.target.value,
                    }))
                  }
                  placeholder="Apellido"
                  className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                />
              </div>

              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="correo@clinica.com"
                  className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                />
              </div>

              <PasswordInput
                required
                minLength={10}
                maxLength={128}
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="Contraseña temporal segura"
              />

              <fieldset>
                <legend className="mb-3 text-sm font-semibold text-slate-700">
                  Roles asignados
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map((role) => {
                    const selected = form.roleCodes.includes(role.code);
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => toggleRole(role.code)}
                        className={cn(
                          'rounded-xl border p-3 text-left transition',
                          selected
                            ? 'border-teal-500 bg-teal-50'
                            : 'border-slate-200 bg-white hover:border-slate-300',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'grid size-5 place-items-center rounded-md border',
                              selected
                                ? 'border-teal-600 bg-teal-600 text-white'
                                : 'border-slate-300 text-transparent',
                            )}
                          >
                            <Check className="size-3" />
                          </div>
                          <span className="text-sm font-semibold text-slate-800">
                            {role.name}
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] leading-4 text-slate-400">
                          {role.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  onClick={() => setIsModalOpen(false)}
                  className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isSubmitting || form.roleCodes.length === 0
                  }
                  className="bg-teal-600 text-white hover:bg-teal-700"
                >
                  {isSubmitting ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <LockKeyhole className="size-4" />
                  )}
                  Crear acceso
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}


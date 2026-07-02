import { useAuth } from '@/contexts/auth-context';
import { RuntimeStatusPill } from '@/components/runtime/runtime-status-pill';
import type { BackupRecord, PaginatedResponse } from '@/types/clinical';
import type { DashboardSummary } from '@/types/dashboard';
import type {
  GlobalSearchResponse,
  GlobalSearchResult,
  NavigationTarget,
} from '@/types/global-search';
import {
  Bell,
  Boxes,
  CalendarDays,
  ClipboardPlus,
  CreditCard,
  Database,
  FileImage,
  HeartPulse,
  LogOut,
  PawPrint,
  Search,
  Settings,
  Syringe,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import type { AuthUser } from '@/types/auth';

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrador',
  VETERINARIAN: 'Veterinario',
  RECEPTION: 'Recepcion',
  CASHIER: 'Caja',
};

const resultIcons: Record<GlobalSearchResult['type'], LucideIcon> = {
  pet: PawPrint,
  owner: UsersRound,
  appointment: CalendarDays,
  'medical-record': ClipboardPlus,
  media: FileImage,
  vaccine: Syringe,
  treatment: HeartPulse,
  payment: CreditCard,
  inventory: Boxes,
};

interface AppNotification {
  id: string;
  title: string;
  description: string;
  tone: 'info' | 'warning' | 'danger';
  target: NavigationTarget;
}

const notificationToneClasses: Record<AppNotification['tone'], string> = {
  info: 'bg-sky-50 text-sky-700 ring-sky-100',
  warning: 'bg-amber-50 text-amber-700 ring-amber-100',
  danger: 'bg-rose-50 text-rose-700 ring-rose-100',
};

const targetPermissions: Partial<Record<NavigationTarget['page'], string>> = {
  dashboard: 'dashboard.read',
  pets: 'pets.read',
  owners: 'owners.read',
  appointments: 'appointments.read',
  history: 'medical.read',
  media: 'medical.read',
  preventive: 'vaccines.read',
  treatments: 'treatments.read',
  payments: 'payments.read',
  finance: 'finance.read',
  inventory: 'inventory.read',
  reports: 'reports.read',
  backups: 'backups.manage',
  users: 'users.read',
  settings: 'settings.manage',
};

export function Topbar({
  user,
  onLogout,
  onNavigate,
}: {
  user: AuthUser;
  onLogout: () => Promise<void>;
  onNavigate: (target: NavigationTarget) => void;
}) {
  const { request } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [failedBackups, setFailedBackups] = useState<BackupRecord[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const primaryRole = roleLabels[user.roles[0]] ?? user.roles[0] ?? 'Usuario';
  const canManageBackups = user.permissions.includes('backups.manage');
  const canNavigateToTarget = useCallback(
    (target: NavigationTarget) => {
      const permission = targetPermissions[target.page];
      return !permission || user.permissions.includes(permission);
    },
    [user.permissions],
  );

  const quickActions = useMemo(
    () =>
      [
        {
          label: 'Dashboard',
          description: 'Volver al resumen general',
          icon: Search,
          target: { page: 'dashboard' },
          permission: 'dashboard.read',
        },
        {
          label: 'Mascotas',
          description: 'Ver pacientes registrados',
          icon: PawPrint,
          target: { page: 'pets' },
          permission: 'pets.read',
        },
        {
          label: 'Duenos',
          description: 'Gestionar clientes',
          icon: UsersRound,
          target: { page: 'owners' },
          permission: 'owners.read',
        },
        {
          label: 'Citas',
          description: 'Abrir agenda',
          icon: CalendarDays,
          target: { page: 'appointments' },
          permission: 'appointments.read',
        },
        {
          label: 'Backups',
          description: 'Crear y descargar respaldos',
          icon: Database,
          target: { page: 'backups' },
          permission: 'backups.manage',
        },
        {
          label: 'Configuracion',
          description: 'Ajustes locales del sistema',
          icon: Settings,
          target: { page: 'settings' },
          permission: 'settings.manage',
        },
      ].filter((action) => user.permissions.includes(action.permission)),
    [user.permissions],
  );

  const notifications = useMemo<AppNotification[]>(() => {
    const items: AppNotification[] = [];
    const today = new Date();

    for (const vaccine of dashboard?.upcomingVaccines ?? []) {
      const overdue = vaccine.status === 'OVERDUE' || (vaccine.daysRemaining ?? 1) < 0;
      items.push({
        id: `vaccine-${vaccine.id}`,
        title: overdue ? 'Vacuna vencida' : 'Vacuna proxima',
        description: `${vaccine.pet.name} - ${vaccine.name}${
          vaccine.daysRemaining !== null
            ? ` (${Math.abs(vaccine.daysRemaining)} dia${Math.abs(vaccine.daysRemaining) === 1 ? '' : 's'})`
            : ''
        }`,
        tone: overdue ? 'danger' : 'warning',
        target: { page: 'preventive', petId: vaccine.pet.id },
      });
    }

    for (const product of dashboard?.lowStock ?? []) {
      items.push({
        id: `stock-${product.id}`,
        title: 'Inventario bajo',
        description: `${product.name}: ${product.currentStock} ${product.unit} disponibles`,
        tone: product.currentStock <= 0 ? 'danger' : 'warning',
        target: { page: 'inventory', productId: product.id },
      });
    }

    for (const appointment of dashboard?.agendaToday ?? []) {
      if (appointment.status === 'COMPLETED' || appointment.status === 'CANCELLED') {
        continue;
      }
      items.push({
        id: `appointment-${appointment.id}`,
        title: 'Cita de hoy',
        description: `${appointment.pet.name} - ${new Date(appointment.startsAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}`,
        tone: 'info',
        target: {
          page: 'appointments',
          appointmentId: appointment.id,
          petId: appointment.pet.id,
        },
      });
    }

    for (const treatment of dashboard?.activeTreatments ?? []) {
      const isOverdue = treatment.endDate
        ? new Date(treatment.endDate).getTime() < today.getTime()
        : false;
      if (!isOverdue) continue;
      items.push({
        id: `treatment-${treatment.id}`,
        title: 'Tratamiento por revisar',
        description: `${treatment.pet.name} - ${treatment.diagnosis}`,
        tone: 'warning',
        target: {
          page: 'treatments',
          treatmentId: treatment.id,
          petId: treatment.pet.id,
        },
      });
    }

    for (const backup of failedBackups) {
      items.push({
        id: `backup-${backup.id}`,
        title: 'Backup fallido',
        description: backup.errorMessage ?? 'Revisa la ruta de pg_dump o vuelve a intentar.',
        tone: 'danger',
        target: { page: 'backups' },
      });
    }

    return items.filter((item) => canNavigateToTarget(item.target)).slice(0, 12);
  }, [canNavigateToTarget, dashboard, failedBackups]);

  const loadNotifications = useCallback(async () => {
    try {
      const [summary, backups] = await Promise.all([
        request<DashboardSummary>('/dashboard/summary'),
        canManageBackups
          ? request<PaginatedResponse<BackupRecord>>(
              '/backups?status=FAILED&pageSize=3',
            )
          : Promise.resolve({
              items: [],
              total: 0,
              page: 1,
              pageSize: 3,
              totalPages: 1,
            }),
      ]);
      setDashboard(summary);
      setFailedBackups(backups.items);
    } catch {
      // Alerts should never block the main workflow.
    }
  }, [canManageBackups, request]);

  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(() => void loadNotifications(), 30_000);
    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setNotificationsOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [searchOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationsOpen(false);
    };
    const closeOnScroll = (event: Event) => {
      if (
        notificationsRef.current &&
        notificationsRef.current.contains(event.target as Node)
      ) {
        return;
      }
      setNotificationsOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('scroll', closeOnScroll, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const term = query.trim();
    setSelectedIndex(0);
    if (term.length < 2) {
      setResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await request<GlobalSearchResponse>(
          `/global-search?q=${encodeURIComponent(term)}&limit=24`,
          { signal: controller.signal },
        );
        setResults(response.items);
        setSearchError(null);
      } catch (error) {
        if (controller.signal.aborted) return;
        setSearchError(
          error instanceof Error
            ? error.message
            : 'No fue posible buscar en VetCare Pro.',
        );
      } finally {
        if (!controller.signal.aborted) {
          setSearchLoading(false);
        }
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, request, searchOpen]);

  const openTarget = (target: NavigationTarget) => {
    onNavigate(target);
    setSearchOpen(false);
    setNotificationsOpen(false);
    setQuery('');
  };

  const visibleItemsCount =
    query.trim().length >= 2 ? results.length : quickActions.length;

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((index) =>
        visibleItemsCount ? (index + 1) % visibleItemsCount : 0,
      );
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((index) =>
        visibleItemsCount ? (index - 1 + visibleItemsCount) % visibleItemsCount : 0,
      );
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (query.trim().length >= 2) {
        const result = results[selectedIndex];
        if (result) openTarget(result.target);
        return;
      }
      const action = quickActions[selectedIndex];
      if (action) openTarget(action.target as NavigationTarget);
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-[76px] items-center border-b border-slate-200 bg-white/95 px-7 backdrop-blur">
      <button
        type="button"
        onClick={() => {
          setNotificationsOpen(false);
          setSearchOpen(true);
        }}
        className="relative mx-auto h-11 w-full max-w-2xl rounded-xl border border-slate-200 bg-slate-50/70 pl-12 pr-20 text-left text-sm text-slate-500 outline-none transition hover:border-teal-200 hover:bg-white hover:text-slate-700"
      >
        <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
        Buscar mascotas, duenos, citas, tratamientos...
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-400">
          Ctrl + K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-5 pl-8">
        <RuntimeStatusPill />

        <div ref={notificationsRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen((open) => !open);
              void loadNotifications();
            }}
            className="relative grid size-10 place-items-center rounded-full text-slate-600 transition hover:bg-slate-100"
            title="Alertas"
            aria-label="Alertas"
          >
            <Bell className="size-5" />
            <span className="absolute right-0 top-0 grid min-w-4 place-items-center rounded-full bg-teal-600 px-1 text-[9px] font-bold text-white">
              {notifications.length}
            </span>
          </button>

          {notificationsOpen ? (
            <div
              className="absolute right-0 top-12 z-40 flex max-h-[70vh] w-[360px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10"
              onWheel={(event) => event.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">Alertas</p>
                  <p className="text-xs text-slate-500">
                    Vacunas, inventario, citas y backups
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(false)}
                  className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pr-3 [scrollbar-gutter:stable]">
                {notifications.length ? (
                  notifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => openTarget(notification.target)}
                      className="flex w-full gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50"
                    >
                      <span
                        className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ring-1 ${notificationToneClasses[notification.tone]}`}
                      >
                        <Bell className="size-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">
                          {notification.title}
                        </span>
                        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-500">
                          {notification.description}
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm font-semibold text-slate-800">
                      Sin alertas pendientes
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Todo se ve tranquilo por ahora.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-teal-100 to-cyan-100 text-teal-700">
          <UserRound className="size-5" />
        </div>
        <div className="hidden min-w-36 xl:block">
          <p className="text-sm font-bold text-slate-800">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs text-slate-500">{primaryRole}</p>
        </div>
        <button
          type="button"
          onClick={() => void onLogout()}
          title="Cerrar sesion"
          aria-label="Cerrar sesion"
          className="grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <LogOut className="size-4" />
        </button>
      </div>

      {searchOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/35 px-4 pt-[12vh] backdrop-blur-sm">
          <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
            <div className="relative border-b border-slate-100">
              <Search className="absolute left-5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Buscar mascota, dueno, cita, vacuna, pago..."
                className="h-14 w-full pl-12 pr-14 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-[430px] overflow-y-auto p-2">
              {query.trim().length < 2 ? (
                <div>
                  <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Accesos rapidos
                  </p>
                  {quickActions.map((action, index) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => openTarget(action.target as NavigationTarget)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                          selectedIndex === index ? 'bg-teal-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className="grid size-10 place-items-center rounded-xl bg-white text-teal-700 shadow-sm ring-1 ring-slate-100">
                          <Icon className="size-5" />
                        </span>
                        <span>
                          <span className="block text-sm font-bold text-slate-900">
                            {action.label}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {action.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : searchError ? (
                <div className="px-4 py-10 text-center text-sm text-rose-600">
                  {searchError}
                </div>
              ) : searchLoading ? (
                <div className="px-4 py-10 text-center text-sm text-slate-500">
                  Buscando en VetCare Pro...
                </div>
              ) : results.length ? (
                results.map((result, index) => {
                  const Icon = resultIcons[result.type];
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      type="button"
                      onClick={() => openTarget(result.target)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                        selectedIndex === index ? 'bg-teal-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="grid size-10 place-items-center rounded-xl bg-white text-teal-700 shadow-sm ring-1 ring-slate-100">
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-slate-900">
                          {result.title}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {result.subtitle}
                          {result.description ? ` - ${result.description}` : ''}
                        </span>
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-800">
                    No encontramos resultados
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Prueba con el nombre de la mascota, dueno o documento.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[11px] text-slate-400">
              <span>Enter para abrir</span>
              <span>Esc para cerrar</span>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

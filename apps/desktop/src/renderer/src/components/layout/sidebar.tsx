import {
  BarChart3,
  Boxes,
  CalendarDays,
  ClipboardPlus,
  CreditCard,
  HeartHandshake,
  Images,
  LayoutDashboard,
  PawPrint,
  Settings,
  ShieldCheck,
  Syringe,
  UserRound,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AuthUser } from '@/types/auth';

export type AppPage =
  | 'dashboard'
  | 'pets'
  | 'owners'
  | 'appointments'
  | 'history'
  | 'media'
  | 'preventive'
  | 'users';

interface NavigationItem {
  id: AppPage | null;
  label: string;
  icon: LucideIcon;
  permission?: string;
}

const navigation: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    permission: 'dashboard.read',
  },
  {
    id: 'pets',
    label: 'Mascotas',
    icon: PawPrint,
    permission: 'pets.read',
  },
  {
    id: 'owners',
    label: 'Dueños',
    icon: UsersRound,
    permission: 'owners.read',
  },
  {
    id: 'appointments',
    label: 'Citas',
    icon: CalendarDays,
    permission: 'appointments.read',
  },
  {
    id: 'history',
    label: 'Historial',
    icon: ClipboardPlus,
    permission: 'medical.read',
  },
  {
    id: 'media',
    label: 'Archivos',
    icon: Images,
    permission: 'medical.read',
  },
  {
    id: 'preventive',
    label: 'Vacunas',
    icon: Syringe,
    permission: 'vaccines.read',
  },
  { id: null, label: 'Tratamientos', icon: HeartHandshake },
  { id: null, label: 'Pagos', icon: CreditCard },
  { id: null, label: 'Inventario', icon: Boxes },
  { id: null, label: 'Reportes', icon: BarChart3 },
  {
    id: 'users',
    label: 'Usuarios',
    icon: UserRound,
    permission: 'users.read',
  },
  { id: null, label: 'Configuración', icon: Settings },
];

export function Sidebar({
  currentPage,
  onNavigate,
  user,
}: {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  user: AuthUser;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[246px] flex-col overflow-y-auto border-r border-slate-200 bg-white px-3 py-4">
      <div className="flex h-16 items-center gap-3 px-4">
        <div className="grid size-10 place-items-center rounded-xl bg-teal-600 text-white shadow-lg shadow-teal-600/20">
          <HeartHandshake className="size-6" />
        </div>
        <div className="text-[22px] font-bold tracking-[-0.03em] text-slate-700">
          VetCare <span className="text-teal-600">Pro</span>
        </div>
      </div>

      <nav className="mt-2 space-y-0.5">
        {navigation.map(({ id, label, icon: Icon, permission }) => {
          const available =
            id !== null &&
            (!permission || user.permissions.includes(permission));
          const active = id === currentPage;

          return (
          <button
            key={label}
            type="button"
            disabled={!available}
            onClick={() => id && onNavigate(id)}
            title={
              available ? label : `${label}: disponible en una próxima fase`
            }
            className={
              active
                ? 'flex h-10 w-full items-center gap-3 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-4 text-sm font-semibold text-white shadow-md shadow-teal-600/15'
                : 'flex h-10 w-full items-center gap-3 rounded-xl px-4 text-sm font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-75'
            }
          >
            <Icon className="size-5" strokeWidth={1.8} />
            {label}
          </button>
          );
        })}
      </nav>

      <div className="mt-auto">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-teal-50 p-4 [@media(max-height:850px)]:hidden">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-teal-100 text-teal-700">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Clínica VetCare</p>
              <p className="text-xs text-slate-500">Entorno local seguro</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-xs text-slate-600">
            <UserRound className="size-4 text-teal-600" />
            Configuración inicial
          </div>
        </div>

        <div className="flex items-center justify-between px-3 pt-4 text-[11px] text-slate-400">
          <span>Versión 0.1.0</span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            Local
          </span>
        </div>
      </div>
    </aside>
  );
}

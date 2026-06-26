import {
  BarChart3,
  Boxes,
  CalendarDays,
  ClipboardPlus,
  CreditCard,
  Database,
  HeartHandshake,
  Images,
  LayoutDashboard,
  PawPrint,
  Settings,
  ShieldCheck,
  Syringe,
  UserRound,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AuthUser } from '@/types/auth';
import { BrandLogo } from '@/components/brand/brand-logo';
import { APP_VERSION } from '@/lib/app-version';

export type AppPage =
  | 'dashboard'
  | 'pets'
  | 'owners'
  | 'appointments'
  | 'history'
  | 'media'
  | 'preventive'
  | 'treatments'
  | 'payments'
  | 'finance'
  | 'inventory'
  | 'reports'
  | 'backups'
  | 'users'
  | 'settings';

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
  {
    id: 'treatments',
    label: 'Tratamientos',
    icon: HeartHandshake,
    permission: 'treatments.read',
  },
  {
    id: 'payments',
    label: 'Pagos',
    icon: CreditCard,
    permission: 'payments.read',
  },
  {
    id: 'finance',
    label: 'Finanzas',
    icon: WalletCards,
    permission: 'finance.read',
  },
  {
    id: 'inventory',
    label: 'Inventario',
    icon: Boxes,
    permission: 'inventory.read',
  },
  {
    id: 'reports',
    label: 'Reportes',
    icon: BarChart3,
    permission: 'reports.read',
  },
  {
    id: 'backups',
    label: 'Backups',
    icon: Database,
    permission: 'backups.manage',
  },
  {
    id: 'users',
    label: 'Usuarios',
    icon: UserRound,
    permission: 'users.read',
  },
  {
    id: 'settings',
    label: 'Configuración',
    icon: Settings,
    permission: 'settings.manage',
  },
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
      <div className="flex h-16 items-center px-4">
        <BrandLogo iconClassName="size-12" textClassName="text-[22px]" />
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
          <span>Versión {APP_VERSION}</span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            Local
          </span>
        </div>
      </div>
    </aside>
  );
}

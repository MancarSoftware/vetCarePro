import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useDashboard } from '@/hooks/use-dashboard';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import type {
  AgendaItem,
  DashboardMetrics,
  LowStockProduct,
  UpcomingVaccine,
} from '@/types/dashboard';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  HeartPulse,
  PackageOpen,
  PawPrint,
  RefreshCw,
  Syringe,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const currency = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const integer = new Intl.NumberFormat('es-EC');

const appointmentLabels: Record<string, string> = {
  GENERAL_CONSULTATION: 'Consulta general',
  VACCINATION: 'Vacunación',
  FOLLOW_UP: 'Control',
  SURGERY: 'Cirugía',
  GROOMING: 'Baño y peluquería',
  EMERGENCY: 'Emergencia',
  DEWORMING: 'Desparasitación',
  OTHER: 'Otro',
};

const appointmentStatus: Record<
  string,
  { label: string; className: string }
> = {
  PENDING: { label: 'Pendiente', className: 'bg-amber-50 text-amber-700' },
  CONFIRMED: {
    label: 'Confirmada',
    className: 'bg-emerald-50 text-emerald-700',
  },
  COMPLETED: { label: 'Atendida', className: 'bg-blue-50 text-blue-700' },
  CANCELLED: { label: 'Cancelada', className: 'bg-rose-50 text-rose-700' },
  NO_SHOW: { label: 'No asistió', className: 'bg-slate-100 text-slate-600' },
};

interface MetricCardProps {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: 'teal' | 'blue' | 'orange' | 'green';
}

const toneStyles = {
  teal: {
    bubble: 'bg-teal-50 text-teal-600',
    detail: 'text-teal-600',
    line: '#0f9b9a',
  },
  blue: {
    bubble: 'bg-blue-50 text-blue-600',
    detail: 'text-blue-600',
    line: '#2563eb',
  },
  orange: {
    bubble: 'bg-orange-50 text-orange-500',
    detail: 'text-orange-500',
    line: '#f97316',
  },
  green: {
    bubble: 'bg-emerald-50 text-emerald-600',
    detail: 'text-emerald-600',
    line: '#16a34a',
  },
};

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone,
}: MetricCardProps) {
  const style = toneStyles[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="flex h-[120px] items-center gap-4 p-4">
        <div
          className={cn(
            'grid size-[70px] shrink-0 place-items-center rounded-full',
            style.bubble,
          )}
        >
          <Icon className="size-8" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-600">{title}</p>
          <p className="mt-1 text-[26px] font-bold leading-none tracking-[-0.03em] text-slate-950">
            {value}
          </p>
          <p className={cn('mt-2 text-xs font-medium', style.detail)}>
            {detail}
          </p>
        </div>
        <svg
          aria-hidden="true"
          viewBox="0 0 72 34"
          className="h-10 w-16 shrink-0"
        >
          <path
            d="M2 28 L14 18 L26 23 L39 10 L50 16 L62 5 L70 9"
            fill="none"
            stroke={style.line}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Card>
    </motion.div>
  );
}

function PanelHeader({
  icon: Icon,
  title,
  action,
}: {
  icon: LucideIcon;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-14 items-center justify-between border-b border-slate-100 px-5">
      <div className="flex items-center gap-2.5">
        <Icon className="size-5 text-teal-600" strokeWidth={1.8} />
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="grid min-h-44 place-items-center px-6 py-8 text-center">
      <div>
        <div className="mx-auto grid size-11 place-items-center rounded-full bg-slate-50 text-slate-400">
          <Icon className="size-5" />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function AgendaTable({ items }: { items: AgendaItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No hay citas para hoy"
        description="Las citas registradas aparecerán aquí automáticamente."
      />
    );
  }

  return (
    <div className="overflow-x-auto px-5 pb-4">
      <table className="w-full text-left text-xs">
        <thead className="text-slate-400">
          <tr>
            <th className="py-3 font-medium">Hora</th>
            <th className="py-3 font-medium">Mascota</th>
            <th className="py-3 font-medium">Servicio</th>
            <th className="py-3 text-right font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const status = appointmentStatus[item.status] ?? {
              label: item.status,
              className: 'bg-slate-100 text-slate-600',
            };
            return (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="py-3 font-semibold text-slate-600">
                  {format(new Date(item.startsAt), 'HH:mm')}
                </td>
                <td className="py-3">
                  <p className="font-semibold text-slate-800">{item.pet.name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {item.pet.breed || item.pet.species}
                  </p>
                </td>
                <td className="py-3 text-slate-600">
                  {appointmentLabels[item.type] ?? item.type}
                </td>
                <td className="py-3 text-right">
                  <Badge className={status.className}>{status.label}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VaccineTable({ items }: { items: UpcomingVaccine[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Syringe}
        title="No hay vacunas próximas"
        description="Las próximas dosis se calcularán desde el historial de vacunación."
      />
    );
  }

  return (
    <div className="overflow-x-auto px-5 pb-4">
      <table className="w-full text-left text-xs">
        <thead className="text-slate-400">
          <tr>
            <th className="py-3 font-medium">Mascota</th>
            <th className="py-3 font-medium">Vacuna</th>
            <th className="py-3 font-medium">Vence el</th>
            <th className="py-3 text-right font-medium">Días</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-slate-100">
              <td className="py-3">
                <p className="font-semibold text-slate-800">{item.pet.name}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {item.pet.breed || 'Sin raza registrada'}
                </p>
              </td>
              <td className="py-3 text-slate-600">{item.name}</td>
              <td className="py-3 text-slate-600">
                {item.nextDueDate
                  ? formatDateOnly(item.nextDueDate)
                  : 'Sin fecha'}
              </td>
              <td className="py-3 text-right">
                <Badge
                  className={cn(
                    item.status === 'OVERDUE'
                      ? 'bg-rose-50 text-rose-600'
                      : item.status === 'PENDING'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-orange-50 text-orange-600',
                  )}
                >
                  {vaccineDueLabel(item)}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDateOnly(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function vaccineDueLabel(item: UpcomingVaccine): string {
  if (item.daysRemaining === null) return '-';
  if (item.status === 'PENDING') return 'Hoy';
  if (item.status === 'OVERDUE') {
    return `${Math.abs(item.daysRemaining)} d vencida`;
  }
  return `${item.daysRemaining} d`;
}

function InventoryList({ items }: { items: LowStockProduct[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={PackageOpen}
        title="Inventario bajo control"
        description="No hay productos registrados por debajo del stock mínimo."
      />
    );
  }

  return (
    <div className="divide-y divide-slate-100 px-5">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 py-3">
          <AlertTriangle className="size-4 shrink-0 text-orange-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-800">
              {item.name}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Stock mínimo: {item.minimumStock}
            </p>
          </div>
          <span className="text-xs font-bold text-rose-500">
            {item.currentStock} {item.unit}
          </span>
        </div>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-14 w-80 animate-pulse rounded-xl bg-slate-200/70" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-[120px] animate-pulse rounded-2xl bg-slate-200/70"
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-[320px] animate-pulse rounded-2xl bg-slate-200/70"
          />
        ))}
      </div>
    </div>
  );
}

function getMetricCards(metrics: DashboardMetrics): MetricCardProps[] {
  return [
    {
      title: 'Mascotas registradas',
      value: integer.format(metrics.registeredPets),
      detail: 'Pacientes activos',
      icon: PawPrint,
      tone: 'teal',
    },
    {
      title: 'Citas de hoy',
      value: integer.format(metrics.appointmentsToday),
      detail: 'Agenda del día',
      icon: CalendarDays,
      tone: 'blue',
    },
    {
      title: 'Vacunas pendientes',
      value: integer.format(metrics.pendingVaccines),
      detail: 'Próximos 30 días',
      icon: Syringe,
      tone: 'orange',
    },
    {
      title: 'Ingresos del mes',
      value: currency.format(metrics.monthlyIncome),
      detail: 'Pagos confirmados',
      icon: CircleDollarSign,
      tone: 'green',
    },
    {
      title: 'Gastos del mes',
      value: currency.format(metrics.monthlyExpenses),
      detail: 'Salidas registradas',
      icon: ArrowDownRight,
      tone: 'orange',
    },
    {
      title: 'Utilidad neta',
      value: currency.format(metrics.monthlyNetIncome),
      detail: 'Ingresos menos gastos',
      icon: TrendingUp,
      tone: 'teal',
    },
  ];
}

export function DashboardPage({
  onOpenAppointments,
  onOpenPreventive,
  onOpenTreatments,
  onOpenInventory,
  onOpenPayments,
  onOpenFinance,
}: {
  onOpenAppointments?: () => void;
  onOpenPreventive?: () => void;
  onOpenTreatments?: () => void;
  onOpenInventory?: () => void;
  onOpenPayments?: () => void;
  onOpenFinance?: () => void;
}) {
  const { user } = useAuth();
  const { data, error, isLoading, refresh } = useDashboard();
  const now = new Date();

  if (isLoading && !data) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return (
      <Card className="mx-auto mt-24 max-w-xl p-10 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-rose-50 text-rose-500">
          <HeartPulse className="size-7" />
        </div>
        <h1 className="mt-5 text-xl font-bold text-slate-900">
          El servicio local no está disponible
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{error}</p>
        <Button
          onClick={() => void refresh()}
          className="mt-6 bg-teal-600 text-white hover:bg-teal-700"
        >
          <RefreshCw className="size-4" />
          Reintentar
        </Button>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.04em] text-slate-950">
            Buenos días, {user?.firstName || 'equipo VetCare'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Así va la actividad de tu clínica hoy,{' '}
            {format(now, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}.
          </p>
        </div>
        <Button
          onClick={() => void refresh()}
          className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="size-4" />
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Mostrando la última información disponible. {error}
        </div>
      )}

      <section className="grid grid-cols-2 gap-4 2xl:grid-cols-3 min-[1800px]:grid-cols-6">
        {getMetricCards(data.metrics).map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </section>

      {onOpenFinance && user?.permissions.includes('finance.read') && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onOpenFinance}
            className="text-xs font-bold text-teal-600 hover:text-teal-700"
          >
            Ver analisis financiero
          </button>
        </div>
      )}

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_1.15fr_0.82fr]">
        <Card className="min-h-[310px] overflow-hidden">
          <PanelHeader
            icon={CalendarDays}
            title="Agenda de hoy"
            action={
              onOpenAppointments ? (
                <button
                  type="button"
                  onClick={onOpenAppointments}
                  className="text-[11px] font-bold text-teal-600 hover:text-teal-700"
                >
                  Ver agenda
                </button>
              ) : undefined
            }
          />
          <AgendaTable items={data.agendaToday} />
        </Card>

        <Card className="min-h-[310px] overflow-hidden">
          <PanelHeader
            icon={Syringe}
            title="Alertas de vacunación"
            action={
              onOpenPreventive ? (
                <button
                  type="button"
                  onClick={onOpenPreventive}
                  className="text-[11px] font-bold text-teal-600 hover:text-teal-700"
                >
                  Ver todas
                </button>
              ) : undefined
            }
          />
          <VaccineTable items={data.upcomingVaccines} />
        </Card>

        <Card className="min-h-[310px] overflow-hidden">
          <PanelHeader
            icon={PackageOpen}
            title="Inventario bajo"
            action={
              onOpenInventory &&
              user?.permissions.includes('inventory.read') ? (
                <button
                  type="button"
                  onClick={onOpenInventory}
                  className="text-[11px] font-bold text-teal-600 hover:text-teal-700"
                >
                  Ver inventario
                </button>
              ) : undefined
            }
          />
          <InventoryList items={data.lowStock} />
        </Card>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.2fr_0.9fr]">
        <Card className="min-h-[280px] overflow-hidden">
          <PanelHeader icon={PawPrint} title="Pacientes recientes" />
          {data.recentPatients.length === 0 ? (
            <EmptyState
              icon={PawPrint}
              title="Aún no hay pacientes"
              description="Los últimos pacientes registrados se mostrarán en esta galería."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
              {data.recentPatients.map((pet) => (
                <div
                  key={pet.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center"
                >
                  <div className="mx-auto grid size-14 place-items-center rounded-full bg-teal-100 text-teal-700">
                    <PawPrint className="size-6" />
                  </div>
                  <p className="mt-2 truncate text-sm font-bold text-slate-800">
                    {pet.name}
                  </p>
                  <p className="truncate text-[11px] text-slate-400">
                    {pet.breed || pet.species}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="min-h-[280px] overflow-hidden">
          <PanelHeader
            icon={HeartPulse}
            title="Evolución del tratamiento"
            action={
              onOpenTreatments ? (
                <button
                  type="button"
                  onClick={onOpenTreatments}
                  className="text-[11px] font-bold text-teal-600 hover:text-teal-700"
                >
                  Ver tratamientos
                </button>
              ) : undefined
            }
          />
          {data.activeTreatments.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No hay tratamientos activos"
              description="La evolución clínica aparecerá al registrar tratamientos."
            />
          ) : (
            <div className="space-y-3 p-5">
              {data.activeTreatments.map((treatment) => (
                <div
                  key={treatment.id}
                  className="flex items-center gap-4 rounded-xl border border-slate-100 p-4"
                >
                  <div className="grid size-11 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-600">
                    <HeartPulse className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800">
                      {treatment.pet.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {treatment.diagnosis}
                    </p>
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-700">
                    Activo
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="min-h-[280px] overflow-hidden">
          <PanelHeader
            icon={CircleDollarSign}
            title="Ingresos últimos 6 meses"
            action={
              onOpenPayments &&
              user?.permissions.includes('payments.read') ? (
                <button
                  type="button"
                  onClick={onOpenPayments}
                  className="text-[11px] font-bold text-teal-600 hover:text-teal-700"
                >
                  Ver pagos
                </button>
              ) : (
                <span className="text-[11px] font-medium text-slate-400">
                  Mensual
                </span>
              )
            }
          />
          <div className="h-[220px] px-3 pb-3 pt-5">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={180}
              initialDimension={{ width: 360, height: 180 }}
            >
              <BarChart data={data.incomeLastSixMonths}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#eef2f7"
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={45}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  formatter={(value) => [
                    currency.format(Number(value ?? 0)),
                    'Ingresos',
                  ]}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 30px rgba(15,23,42,.08)',
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="total"
                  fill="#27b7b0"
                  radius={[7, 7, 0, 0]}
                  maxBarSize={34}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <footer className="flex items-center justify-center gap-1 pt-6 text-xs text-slate-400">
        VetCare Pro · Datos almacenados localmente
        <ArrowUpRight className="size-3" />
      </footer>
    </>
  );
}

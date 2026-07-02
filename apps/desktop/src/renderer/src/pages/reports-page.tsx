import { clinicalInputClass } from '@/components/clinical/clinical-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import type {
  AppointmentStatus,
  AppointmentType,
  ReportSection,
  ReportsSummary,
} from '@/types/clinical';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Download,
  FileSpreadsheet,
  HeartPulse,
  LoaderCircle,
  PackageOpen,
  PawPrint,
  RefreshCw,
  Syringe,
  WalletCards,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
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
});

const integer = new Intl.NumberFormat('es-EC');
const decimal = new Intl.NumberFormat('es-EC', {
  maximumFractionDigits: 3,
});

const reportSections: Array<{ value: ReportSection; label: string }> = [
  { value: 'all', label: 'Reporte completo' },
  { value: 'financial', label: 'Finanzas' },
  { value: 'appointments', label: 'Citas' },
  { value: 'clinical', label: 'Clinica' },
  { value: 'inventory', label: 'Inventario' },
];

const appointmentLabels: Record<AppointmentType, string> = {
  GENERAL_CONSULTATION: 'Consulta general',
  VACCINATION: 'Vacunacion',
  FOLLOW_UP: 'Control',
  SURGERY: 'Cirugia',
  GROOMING: 'Bano y peluqueria',
  EMERGENCY: 'Emergencia',
  DEWORMING: 'Desparasitacion',
  OTHER: 'Otro',
};

const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Atendida',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No asistio',
};

const emptySummary: ReportsSummary = {
  generatedAt: new Date().toISOString(),
  range: { from: '', to: '' },
  financial: {
    income: 0,
    outstanding: 0,
    overdueAmount: 0,
    paidDocuments: 0,
    pendingDocuments: 0,
    averageTicket: 0,
    expenses: 0,
    netIncome: 0,
    margin: 0,
    incomeByMonth: [],
    expensesByCategory: [],
    monthlySeries: [],
  },
  appointments: {
    total: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
    pending: 0,
    confirmed: 0,
    byType: [],
    byStatus: [],
  },
  clinical: {
    medicalRecords: 0,
    vaccinesApplied: 0,
    vaccinesPending: 0,
    vaccinesOverdue: 0,
    dewormingsApplied: 0,
    dewormingsPending: 0,
    dewormingsOverdue: 0,
    treatmentsActive: 0,
    treatmentsFollowUp: 0,
    treatmentsCompleted: 0,
  },
  inventory: {
    lowStock: 0,
    outOfStock: 0,
    expiringSoon: 0,
    inventoryValue: 0,
    productsSold: [],
  },
  clients: {
    ownersRegistered: 0,
    petsRegistered: 0,
  },
};

export function ReportsPage() {
  const { request, requestBlob } = useAuth();
  const [dateFrom, setDateFrom] = useState(() =>
    dateInputValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  );
  const [dateTo, setDateTo] = useState(() => dateInputValue(new Date()));
  const [section, setSection] = useState<ReportSection>('all');
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const query = new URLSearchParams({
      dateFrom,
      dateTo,
    });
    return query.toString();
  }, [dateFrom, dateTo]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setSummary(
        await request<ReportsSummary>(`/reports/summary?${queryString}`),
      );
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No fue posible cargar los reportes.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [queryString, request]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 180);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const exportExcel = async () => {
    setIsExporting(true);
    try {
      const query = new URLSearchParams({
        dateFrom,
        dateTo,
        section,
      });
      const blob = await requestBlob(`/reports/export.xlsx?${query.toString()}`);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vetcare_reportes_${section}_${dateFrom}_${dateTo}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setError(null);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : 'No fue posible exportar el Excel del reporte.',
      );
    } finally {
      setIsExporting(false);
    }
  };

  const data = summary ?? emptySummary;

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">
            Inteligencia local
          </p>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-slate-950">
            Reportes
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Ingresos, citas, actividad clinica, inventario y crecimiento de la
            clinica.
          </p>
        </div>
        <Badge className="bg-teal-50 px-3 py-1.5 text-teal-700">
          {summary
            ? `Generado ${format(new Date(summary.generatedAt), 'dd/MM/yyyy HH:mm')}`
            : 'Preparando datos'}
        </Badge>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            <X className="size-4" />
          </button>
        </div>
      )}

      <Card className="mb-4 p-4">
        <div className="grid gap-3 xl:grid-cols-[180px_180px_240px_1fr_auto_auto]">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Desde
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className={clinicalInputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Hasta
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className={clinicalInputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Exportar
            </label>
            <select
              value={section}
              onChange={(event) =>
                setSection(event.target.value as ReportSection)
              }
              className={clinicalInputClass}
            >
              {reportSections.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end text-xs text-slate-500">
            <span>
              Periodo activo:{' '}
              <strong className="font-bold text-slate-700">
                {data.range.from || dateFrom} a {data.range.to || dateTo}
              </strong>
            </span>
          </div>
          <Button
            onClick={() => void refresh()}
            disabled={isLoading}
            className="self-end border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            {isLoading ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Actualizar
          </Button>
          <Button
            onClick={() => void exportExcel()}
            disabled={isExporting || isLoading}
            className="self-end bg-teal-600 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700"
          >
            {isExporting ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Excel
          </Button>
        </div>
      </Card>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-7">
        <ReportMetric
          icon={CircleDollarSign}
          label="Ingresos cobrados"
          value={currency.format(data.financial.income)}
          detail={`${data.financial.paidDocuments} documentos pagados`}
          tone="teal"
        />
        <ReportMetric
          icon={ClipboardList}
          label="Gastos del periodo"
          value={currency.format(data.financial.expenses)}
          detail="Egresos registrados"
          tone="rose"
        />
        <ReportMetric
          icon={Activity}
          label="Utilidad neta"
          value={currency.format(data.financial.netIncome)}
          detail={`Margen ${decimal.format(data.financial.margin)}%`}
          tone={data.financial.netIncome >= 0 ? 'emerald' : 'rose'}
        />
        <ReportMetric
          icon={WalletCards}
          label="Saldo por cobrar"
          value={currency.format(data.financial.outstanding)}
          detail={`${data.financial.pendingDocuments} pendientes`}
          tone="amber"
        />
        <ReportMetric
          icon={CalendarDays}
          label="Citas atendidas"
          value={integer.format(data.appointments.completed)}
          detail={`${integer.format(data.appointments.total)} citas totales`}
          tone="blue"
        />
        <ReportMetric
          icon={Syringe}
          label="Vacunas pendientes"
          value={integer.format(data.clinical.vaccinesPending)}
          detail={`${data.clinical.vaccinesOverdue} vencidas`}
          tone="rose"
        />
        <ReportMetric
          icon={PackageOpen}
          label="Inventario bajo"
          value={integer.format(data.inventory.lowStock)}
          detail={`${data.inventory.outOfStock} sin existencias`}
          tone="violet"
        />
      </section>

      {isLoading && !summary ? (
        <ReportsLoading />
      ) : (
        <>
          <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.9fr]">
            <Card className="overflow-hidden">
              <PanelHeader
                icon={BarChart3}
                title="Ingresos, gastos y utilidad neta"
                detail={`Neto ${currency.format(data.financial.netIncome)} · Margen ${decimal.format(data.financial.margin)}%`}
              />
              <div className="h-[310px] px-4 pb-4 pt-6">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={0}
                  minHeight={240}
                  initialDimension={{ width: 820, height: 280 }}
                >
                  <BarChart data={data.financial.monthlySeries}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#eef2f7"
                    />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      formatter={(value, name) => [
                        currency.format(Number(value ?? 0)),
                        name === 'income'
                          ? 'Ingresos'
                          : name === 'expenses'
                            ? 'Gastos'
                            : 'Utilidad neta',
                      ]}
                      contentStyle={{
                        borderRadius: 14,
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 12px 34px rgba(15,23,42,.08)',
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="income"
                      fill="#0f9b9a"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={34}
                    />
                    <Bar
                      dataKey="expenses"
                      fill="#f43f5e"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={34}
                    />
                    <Bar
                      dataKey="netIncome"
                      fill="#22c55e"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={34}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <PanelHeader
                icon={CalendarDays}
                title="Rendimiento de agenda"
                detail={`${completionRate(data)}% atendidas`}
              />
              <div className="space-y-3 p-5">
                <ProgressRow
                  label="Atendidas"
                  value={data.appointments.completed}
                  total={data.appointments.total}
                  className="bg-emerald-500"
                />
                <ProgressRow
                  label="Confirmadas"
                  value={data.appointments.confirmed}
                  total={data.appointments.total}
                  className="bg-blue-500"
                />
                <ProgressRow
                  label="Pendientes"
                  value={data.appointments.pending}
                  total={data.appointments.total}
                  className="bg-amber-400"
                />
                <ProgressRow
                  label="Canceladas / no asistio"
                  value={data.appointments.cancelled + data.appointments.noShow}
                  total={data.appointments.total}
                  className="bg-rose-400"
                />
              </div>
              <div className="border-t border-slate-100 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  Servicios mas solicitados
                </p>
                <div className="mt-3 space-y-2">
                  {data.appointments.byType.length ? (
                    data.appointments.byType.slice(0, 5).map((item) => (
                      <div
                        key={item.type}
                        className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                      >
                        <span className="text-xs font-semibold text-slate-600">
                          {appointmentLabels[item.type] ?? item.type}
                        </span>
                        <Badge className="bg-white text-slate-600">
                          {item.count}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
                      No hay citas en el periodo.
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </section>

          <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="overflow-hidden">
              <PanelHeader
                icon={HeartPulse}
                title="Actividad clinica"
                detail={`${data.clinical.medicalRecords} entradas de historial`}
              />
              <div className="grid grid-cols-2 gap-3 p-5">
                <MiniStat
                  icon={ClipboardList}
                  label="Historiales"
                  value={data.clinical.medicalRecords}
                  tone="teal"
                />
                <MiniStat
                  icon={Syringe}
                  label="Vacunas aplicadas"
                  value={data.clinical.vaccinesApplied}
                  tone="blue"
                />
                <MiniStat
                  icon={Activity}
                  label="Desparasitaciones"
                  value={data.clinical.dewormingsApplied}
                  tone="emerald"
                />
                <MiniStat
                  icon={HeartPulse}
                  label="Tratamientos activos"
                  value={data.clinical.treatmentsActive}
                  tone="violet"
                />
              </div>
              <div className="border-t border-slate-100 p-5">
                <AlertLine
                  label="Vacunas vencidas"
                  value={data.clinical.vaccinesOverdue}
                />
                <AlertLine
                  label="Desparasitaciones vencidas"
                  value={data.clinical.dewormingsOverdue}
                />
                <AlertLine
                  label="Tratamientos en control"
                  value={data.clinical.treatmentsFollowUp}
                />
              </div>
            </Card>

            <Card className="overflow-hidden">
              <PanelHeader
                icon={PackageOpen}
                title="Inventario y ventas"
                detail={currency.format(data.inventory.inventoryValue)}
              />
              <div className="space-y-3 p-5">
                <InventorySignal
                  icon={AlertTriangle}
                  label="Stock bajo"
                  value={data.inventory.lowStock}
                  className="bg-amber-50 text-amber-700"
                />
                <InventorySignal
                  icon={PackageOpen}
                  label="Sin existencias"
                  value={data.inventory.outOfStock}
                  className="bg-rose-50 text-rose-700"
                />
                <InventorySignal
                  icon={CalendarDays}
                  label="Lotes por vencer"
                  value={data.inventory.expiringSoon}
                  className="bg-violet-50 text-violet-700"
                />
              </div>
              <div className="border-t border-slate-100 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  Valor estimado en stock
                </p>
                <p className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-900">
                  {currency.format(data.inventory.inventoryValue)}
                </p>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <PanelHeader
                icon={FileSpreadsheet}
                title="Productos mas vendidos"
                detail="Por valor facturado"
              />
              {data.inventory.productsSold.length ? (
                <div className="divide-y divide-slate-100">
                  {data.inventory.productsSold.map((item, index) => (
                    <div
                      key={`${item.productId ?? item.name}-${index}`}
                      className="flex items-center gap-3 px-5 py-4"
                    >
                      <div className="grid size-9 place-items-center rounded-xl bg-teal-50 text-sm font-bold text-teal-700">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">
                          {item.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {decimal.format(item.quantity)} unidades
                        </p>
                      </div>
                      <p className="text-sm font-bold text-slate-900">
                        {currency.format(item.total)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyBlock
                  icon={FileSpreadsheet}
                  title="Aun no hay productos vendidos"
                  description="Cuando registres cobros con productos, apareceran aqui."
                />
              )}
            </Card>
          </section>

          <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <Card className="overflow-hidden">
              <PanelHeader
                icon={PawPrint}
                title="Crecimiento de clientes"
                detail="Registros del periodo"
              />
              <div className="grid grid-cols-2 gap-4 p-5">
                <ClientGrowth
                  icon={PawPrint}
                  label="Mascotas nuevas"
                  value={data.clients.petsRegistered}
                />
                <ClientGrowth
                  icon={ClipboardList}
                  label="Duenos nuevos"
                  value={data.clients.ownersRegistered}
                />
              </div>
            </Card>

            <Card className="overflow-hidden">
              <PanelHeader
                icon={CalendarDays}
                title="Detalle por estado de cita"
                detail="Distribucion operativa"
              />
              <div className="grid grid-cols-2 gap-3 p-5 xl:grid-cols-5">
                {(
                  [
                    'COMPLETED',
                    'CONFIRMED',
                    'PENDING',
                    'CANCELLED',
                    'NO_SHOW',
                  ] as AppointmentStatus[]
                ).map((status) => {
                  const count =
                    data.appointments.byStatus.find(
                      (item) => item.status === status,
                    )?.count ?? 0;
                  return (
                    <div
                      key={status}
                      className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                    >
                      <p className="text-xl font-bold text-slate-900">
                        {count}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {appointmentStatusLabels[status]}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Card>
          </section>
        </>
      )}
    </>
  );
}

function ReportMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: 'teal' | 'blue' | 'amber' | 'rose' | 'violet' | 'emerald';
}) {
  const tones = {
    teal: 'bg-teal-50 text-teal-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    violet: 'bg-violet-50 text-violet-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <Card className="flex items-center gap-4 p-4">
      <div
        className={cn(
          'grid size-12 shrink-0 place-items-center rounded-2xl',
          tones[tone],
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xl font-bold tracking-[-0.03em] text-slate-900">
          {value}
        </p>
        <p className="truncate text-xs font-semibold text-slate-500">{label}</p>
        <p className="mt-1 truncate text-[11px] text-slate-400">{detail}</p>
      </div>
    </Card>
  );
}

function PanelHeader({
  icon: Icon,
  title,
  detail,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
      <div className="flex items-center gap-2.5">
        <Icon className="size-5 text-teal-600" />
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      </div>
      <span className="text-xs font-semibold text-slate-400">{detail}</span>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  total,
  className,
}: {
  label: string;
  value: number;
  total: number;
  className: string;
}) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-600">{label}</span>
        <span className="font-bold text-slate-800">
          {integer.format(value)} ({percent}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full', className)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: 'teal' | 'blue' | 'emerald' | 'violet';
}) {
  const tones = {
    teal: 'bg-teal-50 text-teal-700',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    violet: 'bg-violet-50 text-violet-700',
  };
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div
        className={cn('grid size-9 place-items-center rounded-xl', tones[tone])}
      >
        <Icon className="size-4" />
      </div>
      <p className="mt-3 text-xl font-bold text-slate-900">
        {integer.format(value)}
      </p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
    </div>
  );
}

function AlertLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <Badge
        className={
          value > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
        }
      >
        {integer.format(value)}
      </Badge>
    </div>
  );
}

function InventorySignal({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3">
      <div className={cn('grid size-10 place-items-center rounded-xl', className)}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-800">{integer.format(value)}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function ClientGrowth({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-teal-50 to-white p-5">
      <Icon className="size-6 text-teal-600" />
      <p className="mt-4 text-3xl font-bold tracking-[-0.04em] text-slate-900">
        {integer.format(value)}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-500">{label}</p>
    </div>
  );
}

function EmptyBlock({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="grid min-h-[260px] place-items-center p-8 text-center">
      <div>
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-50 text-slate-400">
          <Icon className="size-7" />
        </div>
        <h2 className="mt-4 text-sm font-bold text-slate-800">{title}</h2>
        <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}

function ReportsLoading() {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-[320px] animate-pulse rounded-2xl bg-slate-200/70"
        />
      ))}
    </div>
  );
}

function completionRate(summary: ReportsSummary) {
  if (!summary.appointments.total) return 0;
  return Math.round(
    (summary.appointments.completed / summary.appointments.total) * 100,
  );
}

function dateInputValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

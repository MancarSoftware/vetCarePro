import { clinicalInputClass } from '@/components/clinical/clinical-ui';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api';
import type {
  ExpenseCategory,
  FinanceExpense,
  FinanceSummary,
  PaginatedResponse,
} from '@/types/clinical';
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  LoaderCircle,
  Plus,
  ReceiptText,
  RefreshCw,
  Trash2,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const currency = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
});

const percent = new Intl.NumberFormat('es-EC', {
  maximumFractionDigits: 1,
});

const expenseCategories: Array<{ value: ExpenseCategory; label: string }> = [
  { value: 'INVENTORY', label: 'Inventario e insumos' },
  { value: 'SALARIES', label: 'Sueldos' },
  { value: 'RENT', label: 'Arriendo' },
  { value: 'UTILITIES', label: 'Servicios basicos' },
  { value: 'SERVICES', label: 'Servicios profesionales' },
  { value: 'MAINTENANCE', label: 'Mantenimiento' },
  { value: 'TAXES', label: 'Impuestos' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'ADMINISTRATIVE', label: 'Administrativos' },
  { value: 'OTHER', label: 'Otros' },
];

const emptySummary: FinanceSummary = {
  generatedAt: new Date().toISOString(),
  range: { from: '', to: '' },
  totals: {
    income: 0,
    expenses: 0,
    netIncome: 0,
    margin: 0,
  },
  expensesByCategory: [],
  monthlySeries: [],
};

interface ExpenseForm {
  category: ExpenseCategory;
  description: string;
  amount: string;
  occurredAt: string;
  vendor: string;
  reference: string;
  notes: string;
}

const emptyForm: ExpenseForm = {
  category: 'INVENTORY',
  description: '',
  amount: '',
  occurredAt: dateInputValue(new Date()),
  vendor: '',
  reference: '',
  notes: '',
};

export function FinancePage() {
  const { request, user } = useAuth();
  const [dateFrom, setDateFrom] = useState(() =>
    dateInputValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  );
  const [dateTo, setDateTo] = useState(() => dateInputValue(new Date()));
  const [category, setCategory] = useState<ExpenseCategory | 'all'>('all');
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const canManage = user?.permissions.includes('finance.manage') ?? false;

  const queryString = useMemo(() => {
    const query = new URLSearchParams({
      page: '1',
      pageSize: '100',
      dateFrom,
      dateTo,
      ...(category !== 'all' ? { category } : {}),
    });
    return query.toString();
  }, [category, dateFrom, dateTo]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextSummary, nextExpenses] = await Promise.all([
        request<FinanceSummary>(`/finance/summary?${queryString}`),
        request<PaginatedResponse<FinanceExpense>>(
          `/finance/expenses?${queryString}`,
        ),
      ]);
      setSummary(nextSummary);
      setExpenses(nextExpenses.items);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No fue posible cargar finanzas.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [queryString, request]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 180);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const updateForm = (field: keyof ExpenseForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitExpense = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const optional = (value: string) => value.trim() || null;
    try {
      await request('/finance/expenses', {
        method: 'POST',
        body: {
          category: form.category,
          description: form.description.trim(),
          amount: Number(form.amount),
          occurredAt: form.occurredAt,
          vendor: optional(form.vendor),
          reference: optional(form.reference),
          notes: optional(form.notes),
        },
      });
      setForm({ ...emptyForm, occurredAt: dateInputValue(new Date()) });
      setIsFormOpen(false);
      await refresh();
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : 'No fue posible registrar el gasto.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeExpense = async (expenseId: string) => {
    if (!window.confirm('Deseas eliminar este gasto del reporte financiero?')) {
      return;
    }
    setIsSubmitting(true);
    try {
      await request(`/finance/expenses/${expenseId}`, { method: 'DELETE' });
      await refresh();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : 'No fue posible eliminar el gasto.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const data = summary ?? emptySummary;

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">
            Rentabilidad
          </p>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-slate-950">
            Finanzas
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Controla ingresos, gastos y utilidad neta de la veterinaria.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => void refresh()}
            className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="size-4" />
            Actualizar
          </Button>
          {canManage && (
            <Button
              onClick={() => setIsFormOpen(true)}
              className="bg-teal-600 text-white hover:bg-teal-700"
            >
              <Plus className="size-4" />
              Registrar gasto
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            Desde
          </span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className={clinicalInputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            Hasta
          </span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className={clinicalInputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            Categoria de gasto
          </span>
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as ExpenseCategory | 'all')
            }
            className={clinicalInputClass}
          >
            <option value="all">Todas las categorias</option>
            {expenseCategories.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </Card>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FinanceMetric
          title="Ingresos"
          value={currency.format(data.totals.income)}
          detail="Pagos cobrados"
          icon={ArrowUpRight}
          className="bg-emerald-50 text-emerald-700"
        />
        <FinanceMetric
          title="Gastos"
          value={currency.format(data.totals.expenses)}
          detail="Salidas registradas"
          icon={ArrowDownRight}
          className="bg-rose-50 text-rose-700"
        />
        <FinanceMetric
          title="Utilidad neta"
          value={currency.format(data.totals.netIncome)}
          detail="Ingresos menos gastos"
          icon={TrendingUp}
          className="bg-teal-50 text-teal-700"
        />
        <FinanceMetric
          title="Margen"
          value={`${percent.format(data.totals.margin)}%`}
          detail="Rentabilidad estimada"
          icon={CircleDollarSign}
          className="bg-blue-50 text-blue-700"
        />
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="min-h-[360px] p-5">
          <div className="mb-4 flex items-center gap-2">
            <WalletCards className="size-5 text-teal-600" />
            <h2 className="text-sm font-bold text-slate-800">
              Ingresos vs gastos
            </h2>
          </div>
          <div className="h-[285px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  formatter={(value, name) => [
                    currency.format(Number(value ?? 0)),
                    name === 'income'
                      ? 'Ingresos'
                      : name === 'expenses'
                        ? 'Gastos'
                        : 'Utilidad neta',
                  ]}
                />
                <Legend />
                <Bar dataKey="income" fill="#0f9b9a" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="netIncome" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="min-h-[360px] p-5">
          <div className="mb-4 flex items-center gap-2">
            <ReceiptText className="size-5 text-teal-600" />
            <h2 className="text-sm font-bold text-slate-800">
              Gastos por categoria
            </h2>
          </div>
          {data.expensesByCategory.length === 0 ? (
            <EmptyFinance text="No hay gastos registrados en este periodo." />
          ) : (
            <div className="space-y-3">
              {data.expensesByCategory.map((item) => (
                <div key={item.category} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-600">
                      {categoryLabel(item.category)}
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {currency.format(item.total)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-teal-500"
                      style={{
                        width: `${Math.min(
                          100,
                          data.totals.expenses
                            ? (item.total / data.totals.expenses) * 100
                            : 0,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <Card className="mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              Historial de gastos
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Salidas manuales usadas para calcular utilidad neta.
            </p>
          </div>
        </div>
        {isLoading ? (
          <div className="grid min-h-52 place-items-center text-slate-400">
            <LoaderCircle className="size-6 animate-spin" />
          </div>
        ) : expenses.length === 0 ? (
          <EmptyFinance text="Todavia no hay gastos para mostrar." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3 font-medium">Descripcion</th>
                  <th className="px-5 py-3 font-medium">Categoria</th>
                  <th className="px-5 py-3 font-medium">Proveedor</th>
                  <th className="px-5 py-3 text-right font-medium">Monto</th>
                  <th className="px-5 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="border-t border-slate-100">
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {dateDisplay(expense.occurredAt)}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800">
                        {expense.description}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {expense.reference || 'Sin referencia'}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {categoryLabel(expense.category)}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {expense.vendor || 'No registrado'}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-rose-600">
                      {currency.format(expense.amount)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {canManage && (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => void removeExpense(expense.id)}
                          className="inline-grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          title="Eliminar gasto"
                        >
                          <Trash2 className="size-4" />
                        </button>
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
        <ExpenseModal
          form={form}
          submitting={isSubmitting}
          onChange={updateForm}
          onClose={() => setIsFormOpen(false)}
          onSubmit={submitExpense}
        />
      )}
    </>
  );
}

function FinanceMetric({
  title,
  value,
  detail,
  icon: Icon,
  className,
}: {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  className: string;
}) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className={`grid size-12 place-items-center rounded-2xl ${className}`}>
        <Icon className="size-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="mt-1 text-2xl font-bold tracking-[-0.04em] text-slate-950">
          {value}
        </p>
        <p className="mt-1 text-xs text-slate-400">{detail}</p>
      </div>
    </Card>
  );
}

function ExpenseModal({
  form,
  submitting,
  onChange,
  onClose,
  onSubmit,
}: {
  form: ExpenseForm;
  submitting: boolean;
  onChange: (field: keyof ExpenseForm, value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-6 backdrop-blur-sm">
      <Card className="w-full max-w-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">
              Nuevo gasto
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              Registrar salida de dinero
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
          >
            Cerrar
          </button>
        </div>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-500">
                Categoria
              </span>
              <select
                value={form.category}
                onChange={(event) =>
                  onChange('category', event.target.value as ExpenseCategory)
                }
                className={clinicalInputClass}
              >
                {expenseCategories.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-500">
                Fecha
              </span>
              <input
                required
                type="date"
                value={form.occurredAt}
                onChange={(event) => onChange('occurredAt', event.target.value)}
                className={clinicalInputClass}
              />
            </label>
          </div>
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              Descripcion
            </span>
            <input
              required
              minLength={3}
              maxLength={255}
              value={form.description}
              onChange={(event) => onChange('description', event.target.value)}
              className={clinicalInputClass}
              placeholder="Compra de vacunas, arriendo, sueldo..."
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-500">
                Monto
              </span>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(event) => onChange('amount', event.target.value)}
                className={clinicalInputClass}
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-500">
                Proveedor
              </span>
              <input
                maxLength={180}
                value={form.vendor}
                onChange={(event) => onChange('vendor', event.target.value)}
                className={clinicalInputClass}
              />
            </label>
          </div>
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              Referencia o comprobante
            </span>
            <input
              maxLength={120}
              value={form.reference}
              onChange={(event) => onChange('reference', event.target.value)}
              className={clinicalInputClass}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              Notas
            </span>
            <textarea
              rows={3}
              maxLength={2000}
              value={form.notes}
              onChange={(event) => onChange('notes', event.target.value)}
              className={`${clinicalInputClass} h-auto resize-none py-3`}
            />
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
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
              Registrar gasto
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function EmptyFinance({ text }: { text: string }) {
  return (
    <div className="grid min-h-40 place-items-center p-6 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

function categoryLabel(value: ExpenseCategory) {
  return expenseCategories.find((item) => item.value === value)?.label ?? value;
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateDisplay(value: string) {
  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}
